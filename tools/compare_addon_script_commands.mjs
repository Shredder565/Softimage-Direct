// CMD-B7c: the 29 script commands of the shipped add-ons (Cache Manager, Render Manager, render tree user
// tools, Lagoa, ICE flow builder, sdkui helpers, Polygonizer) on the command bus. Checked against the "Wire
// contract" sections of docs/ghidra/cmd-b7c-addon-scripts.md and the registry dump data/commands_full.json.
// No XSIBATCH golden exists for this row, so this is a contract check. Objects the build has no class for
// (property pages, mixer cache clips, shader graphs with loose nodes, ICE trees with root ports) are given
// to the commands as plain objects with the documented members, or through the seams on `app.addonScripts`.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_addon_script_commands.mjs
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

const CACHE = ['RemoveNumbering', 'AddToList', 'RemoveFromList', 'GetItemsAsString', 'SelectionValueToItemName', 'GetObjectsFromSource', 'WriteCachesFile', 'ReadCachesFile',
  'RefreshCachesPathProp', 'UpdateCacheManager', 'GetCacheOnFile'];
const RENDER = ['OpenOutputFormatPreferences', 'OverrideMarkedPassParameters', 'DeleteUnusedShaders', 'RTShaderSetCategories'];
const ICE = ['LagoaEmitMPVolume', 'LagoaTagCollisionObject', 'LagoaDisplayType', 'LagoaSetupAdvectMesh', 'LagoaSetupClothMesh', 'ICEFlowInsertSimulationRoot'];
const SDKUI = ['SIGetExternalFilesViewerProp', 'SISetExternalFilesManagerTarget', 'ConnectToWorkgroupUI', 'SDKGetScriptGenerator', 'PPGLayoutControl', 'GetWizardParamTab', 'GetShaderDefHelper'];
const NAMES = [...CACHE, ...RENDER, ...ICE, ...SDKUI, 'Create_Polygonizer_Polymesh'];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => { const c = list.find(x => (x.scripting_name || x.name) === n); return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('Create_Polygonizer_Polymesh') && !!window.Application?.commands?.get('GetGlobal'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const A = app.addonScripts; const fsys = app.hostFs;
  app.cmdLogSize = 100000;   // the log is read back by index; keep it from rolling over
  const out = {};
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: v === undefined ? '<none>' : v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const val = (n, a = {}) => { const r = run(n, a); return 'err' in r ? `ERR:${r.err}` : r.v; };
  const mark = () => app.log.length;
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const callsFrom = (i) => A.calls.slice(i).map(c => [c.name, c.args, c.via]);
  const tick = () => new Promise(r => setTimeout(r, 40));
  const cube = (name) => app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: name });
  const q = (s) => document.querySelector(s);

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.flags = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? [!!d.noLog, d.category, d.description ?? ''] : null]; }));

  app.run('NewScene', {});
  app.select([]);

  // ---- before anything exists
  { const m = mark(); out.setTargetNoViewer = [val('SISetExternalFilesManagerTarget', {}), logFrom(m)]; }

  // ---- every command with default arguments, empty selection
  {
    const res = {};
    for (const n of NAMES) {
      const r = run(n, {});
      if (n === 'ConnectToWorkgroupUI') {
        res[n] = typeof r.v?.then === 'function' ? 'promise' : JSON.stringify(r);
        await tick(); q('.addon-ConnectWorkgroup .sdkh-modal-cancel')?.click();
        res[n] += ':' + String(await r.v);
      } else res[n] = 'err' in r ? 'ERR' : (r.v !== null && typeof r.v === 'object' && !Array.isArray(r.v)) ? `object:${r.v.Type ?? r.v.type ?? ''}` : r.v;
    }
    out.defaults = res;
  }
  app.run('NewScene', {}); app.select([]);

  // ====================================================== Cache Manager
  {
    const c = {};
    c.removeNumbering = ['3 : Cone', 'Cone', '-1 : x', '12 : a:b', 'x : y', '0:'].map(s => val('RemoveNumbering', { inString: s }));
    let refresh = 0; let selValue = '0:';
    const L = new A.ScriptLayout(); const item = L.AddItem('List');
    const ppg = { PPGLayout: L, Refresh() { refresh++; }, Inspected() { return { Parameters: () => ({ Value: selValue }) }; } };
    c.add1 = [val('AddToList', { PPG: ppg, dataArray: ['Cone', 'Cube'], ppgItem: item, multiInstance: false }), [...item.UIItems], refresh];
    run('AddToList', { PPG: ppg, dataArray: ['1 : Cube', 'Sphere', 'Sphere'], ppgItem: item, multiInstance: false });
    run('AddToList', { PPG: ppg, dataArray: ['Cone'], ppgItem: item, multiInstance: true });
    c.add2 = [[...item.UIItems], refresh];
    c.items = [val('GetItemsAsString', { PPG: ppg, in_ItemName: 'List' }), val('GetItemsAsString', { PPG: ppg, in_ItemName: 'Nope' }), val('GetItemsAsString', {})];
    c.selToName = val('SelectionValueToItemName', { PPG: ppg, in_splitSel: ['1:', '9:', '0:'], in_FromList: 'List' });
    c.selToNameMissing = 'err' in run('SelectionValueToItemName', { PPG: ppg, in_splitSel: ['1:'], in_FromList: 'Nope' });
    const r0 = refresh;
    run('RemoveFromList', { PPG: ppg, in_FromList: 'List', selected: '' });
    c.removeEmpty = [item.UIItems.length, refresh - r0];
    c.remove1 = [val('RemoveFromList', { PPG: ppg, in_FromList: 'List', selected: '1:;3:' }), [...item.UIItems], refresh - r0];
    run('RemoveFromList', { PPG: ppg, in_FromList: 'List' });   // selected null: the inspected object's parameter ("0:")
    c.remove2 = [...item.UIItems];
    c.removeBad = val('RemoveFromList', { PPG: {}, in_FromList: 'List', selected: '0:' });

    // GetObjectsFromSource
    A.scannedMixers = null; A.sourceObjects = null;
    const mixer = { Type: 'Mixer', Name: 'Mixer', Clips: [] };
    const clip = (n, src, dest) => ({ Type: 'mixercacheclip', FullName: `Mixer.${n}`, Source: { Name: src }, MappedItems: dest.map(d => ({ Destination: { Parent: { FullName: d } } })) });
    mixer.Clips.push(clip('Clip1', 'src', ['cube']), { Type: 'mixeranimclip', FullName: 'Mixer.Anim', Source: { Name: 'src' }, MappedItems: [] }, clip('Clip3', 'src', ['sphere', 'cone']));
    const src = { Name: 'src', FullName: 'Sources.src', Parent: mixer };
    c.objs1 = val('GetObjectsFromSource', { inSource: src });
    mixer.Clips.push(clip('Clip4', 'src', ['late']));
    c.objsStale = val('GetObjectsFromSource', { inSource: src });
    c.objsUnknown = val('GetObjectsFromSource', { inSource: { Name: 'other', FullName: 'Sources.other', Parent: mixer } });
    c.objsNoMixer = val('GetObjectsFromSource', { inSource: { Name: 'lone', FullName: 'lone', Parent: { Type: 'Model', Name: 'm' } } });
    A.scannedMixers = null; A.sourceObjects = null;

    // WriteCachesFile / ReadCachesFile
    fsys.ensureFolder('C:\\temp\\b7c');
    const args = { FileName: 'C:\\temp\\b7c\\caches.txt', objects: 'cube, sphere,cone', StartFrame: 1, EndFrame: 100, Step: 2, Type: 'Custom', ResolvedPath: 'C:\\cache\\[object]' };
    const u = app.undoStack.length; const m = mark();
    c.write = [val('WriteCachesFile', args), fsys.readFile(args.FileName), app.undoStack.length - u, logFrom(m).filter(l => l.startsWith('cmd:')).length];
    c.writeBadPath = 'err' in run('WriteCachesFile', { ...args, FileName: 'C:\\temp\\b7c\\nofolder\\x.txt' });
    c.writeBadObjects = 'err' in run('WriteCachesFile', { ...args, objects: 5 });
    fsys.writeFile(args.FileName, 'keep');
    c.read = [val('ReadCachesFile', args), fsys.readFile(args.FileName)];

    // CachesPathProp + UpdateCacheManager + RefreshCachesPathProp
    c.refreshNoInstance = 'err' in run('RefreshCachesPathProp', {});
    c.updateNoView = [val('UpdateCacheManager', {}), A.cachesPathProp === null, A.cacheOnFileListProp === null];
    const view = { type: 'Cache Manager', name: 'cm', attrs: {}, subViews: {} };
    const other = { type: 'Explorer', name: 'ex', attrs: {}, subViews: {} };
    A.views.push(other, view);
    c.update1 = [val('UpdateCacheManager', {}), Object.fromEntries(Object.entries(view.subViews).map(([k, v]) => [k, v.attrs.targetcontent])), Object.keys(other.subViews).length];
    const sim = { FullName: 'Environments.Environment.simtimectrl' };
    A.namedObjects.set('WriteAnimation', { FullName: 'WriteAnimation' }); A.namedObjects.set('ReadAnimation', { FullName: 'ReadAnimation' });
    A.namedObjects.set('Environments.Environment.simtimectrl', sim);
    const before = A.cachesPathProp;
    run('UpdateCacheManager', {});
    c.update2 = [Object.fromEntries(Object.entries(view.subViews).map(([k, v]) => [k, v.attrs.targetcontent])), sim.cacheppg, A.cachesPathProp === before];
    A.namedObjects.clear();
    const P = A.cachesPathProp; const G = A.gridOf(P, 'CachePathGrid');
    c.pathProp = { name: P.name, type: P.type, columns: G.columns, layout: P.scriptLayout.describe(), gridAttrs: P.scriptLayout.Item('CachePathGrid').attrs, buttonAttrs: P.scriptLayout.Item('BntOpenMixer').attrs, lastButtonAttrs: P.scriptLayout.Item('BntDeleteUnusedSource').attrs };
    fsys.ensureFolder('C:\\cache'); fsys.writeFile('C:\\cache\\a.icecache', 'x'); fsys.writeFile('C:\\cache\\seq.1.icecache', 'x');
    const mixer2 = { Type: 'Mixer', Name: 'Mixer', Clips: [clip('CacheClip', 'srcA', ['Model.cube'])] };
    A.externalFiles = () => [
      { Path: '$PROJ\\a.icecache', ResolvedPath: 'C:\\cache\\a.icecache', FileType: 'Caches', GUID: '{G1}', Owners: [{ Name: 'srcA', FullName: 'Sources.srcA', Parent: mixer2 }] },
      { Path: 'C:\\pic.png', ResolvedPath: 'C:\\pic.png', FileType: 'Pictures', GUID: '{G2}', Owners: [{ Name: 'clip', FullName: 'Clips.pic' }] },
      { Path: 'C:\\cache\\gone.icecache', ResolvedPath: 'C:\\cache\\gone.icecache', FileType: 'Caches', GUID: '{G3}', Owners: [{ Name: 'srcB', FullName: 'Sources.srcB', Parent: mixer2 }] },
      { Path: 'C:\\noowner.icecache', ResolvedPath: 'C:\\noowner.icecache', FileType: 'Caches', GUID: '{G4}', Owners: [] },
      { Path: '', ResolvedPath: 'C:\\cache\\seq.[1..2].icecache', Files: ['C:\\cache\\seq.1.icecache', 'C:\\cache\\seq.2.icecache'], FileType: 'Caches', GUID: '{G5}', Owners: [{ Name: 'srcA', FullName: 'Sources.srcA', Parent: mixer2 }] },
    ];
    c.refresh = [val('RefreshCachesPathProp', {}), G.rows.map(r => Array.from(r, x => x === undefined ? null : x)), G.rowLabels, G.rowColors, A.scannedMixers, A.sourceObjects];
    // CacheOnFileListProp + GetCacheOnFile
    const node = (name, mode, full) => ({ Name: name, FullName: full, Parameters: { filemode: { Value: mode }, ResolvedFilePath: { Value: `C:\\c\\${full}.icecache` } } });
    A.extraIceTrees.push({ Name: 'ICETree', FullName: 'pc.ICETree', Nodes: [node('Cache on File', 2, 'n1'), node('Cache on File', 1, 'n2'), node('Cache On File', 2, 'n3'),
      { Name: 'Compound', FullName: 'cmp', Nodes: [node('Cache on File', 2, 'n4')] }] });
    c.cacheOnFile = val('GetCacheOnFile', {}).map(n => n.FullName);
    const Q = A.cacheOnFileListProp; A.fillCacheOnFileGrid(Q);
    c.onFileProp = { name: Q.name, type: Q.type, columns: A.gridOf(Q, 'CachePathGrid').columns, rows: A.gridOf(Q, 'CachePathGrid').rows, layout: Q.scriptLayout.describe() };
    A.extraIceTrees.length = 0; A.externalFiles = null; A.views.length = 0;
    out.cache = c;
  }

  // ====================================================== Render Manager
  {
    const r = {};
    r.openPrefs = [val('OpenOutputFormatPreferences', {}), A.inspected[A.inspected.length - 1], A.calls[A.calls.length - 1].name];
    const pass = app.scene.passes[0]; const mr = pass.mentalray;
    app.anim.marked.clear(); app.select([]);
    let m = mark(); r.noSel = [val('OverrideMarkedPassParameters', {}), logFrom(m).filter(l => !l.startsWith('cmd:'))];
    const c1 = cube('ovCube');
    app.select([c1]); m = mark(); r.objectSel = [val('OverrideMarkedPassParameters', {}), logFrom(m).filter(l => !l.startsWith('cmd:'))];
    app.select([mr]); m = mark(); r.noMarking = [val('OverrideMarkedPassParameters', {}), logFrom(m).filter(l => !l.startsWith('cmd:'))];
    const vis = c1.properties.find(p => p.type === 'visibility');
    app.anim.marked.add(vis.params[0]);
    app.select([vis]); m = mark(); r.notPass = [val('OverrideMarkedPassParameters', {}), logFrom(m).filter(l => !l.startsWith('cmd:')), pass.passOverride === undefined];
    app.anim.marked.clear(); const p0 = mr.params[0], p1 = mr.params[1]; app.anim.marked.add(p0); app.anim.marked.add(p1);
    app.select([mr]); m = mark(); const k = A.calls.length;
    r.ok = [val('OverrideMarkedPassParameters', {}), pass.passOverride?.name, pass.passOverride?.type, pass.passOverride?.parent === pass,
      JSON.stringify(pass.passOverride?.entries) === JSON.stringify([`Passes.${pass.name}.${mr.name}.${p0.name}`, `Passes.${pass.name}.${mr.name}.${p1.name}`]),
      callsFrom(k).map(c => c[0]), A.inspected[A.inspected.length - 1] === `Passes.${pass.name}.PassOverride`, logFrom(m).filter(l => /WARNING/.test(l))];
    const ov = pass.passOverride; run('OverrideMarkedPassParameters', {});
    r.reuse = [pass.passOverride === ov, ov.entries.length];
    app.anim.marked.clear(); app.select([]);
    out.render = r;
  }

  // ====================================================== RTUserTools
  {
    const t = {};
    const c1 = cube('rtCube');
    app.select([c1]); let m = mark(); let k = A.calls.length;
    t.skipOther = [val('DeleteUnusedShaders', {}), logFrom(m).filter(l => !l.startsWith('cmd:')), callsFrom(k)];
    const mat = app.scene.materials[0]; const surf = mat.surface;
    k = A.calls.length; t.buildMaterial = [val('DeleteUnusedShaders', { container: mat }), mat.surface === surf, callsFrom(k)];
    // a container with an unconnected two-node tree, a comment and two image clips
    const C = { Type: 'material', FullName: 'Mat', shaders: [], imageClips: [], removed: [] };
    C.remove = (x) => { C.removed.push(x.FullName); C.shaders = C.shaders.filter(s => s !== x); C.imageClips = C.imageClips.filter(s => s !== x); for (const s of C.shaders) s.targets = s.targets.filter(tg => tg !== x); };
    const sh = (n, targets, extra = {}) => ({ Type: 'Shader', ShaderType: 'siShader', FullName: n, targets, ...extra });
    const s1 = sh('s1', [C]); const s3 = sh('s3', []); const s2 = sh('s2', [s3]); const note = sh('note', [], { ShaderType: 'siShaderComment' });
    C.shaders = [s1, s2, s3, note];
    C.imageClips = [{ Type: 'ImageClip', FullName: 'clipA', targets: [s1] }, { Type: 'ImageClip', FullName: 'clipB', targets: [s2] }];
    k = A.calls.length;
    t.loose = [val('DeleteUnusedShaders', { container: C }), C.shaders.map(s => s.FullName), C.imageClips.map(s => s.FullName), C.removed, callsFrom(k).map(c => [c[0], c[1]])];
    // a light under a light: the parent is the container; the clip pass gets the original argument
    const Lp = { Type: 'light', FullName: 'LightRoot', shaders: [sh('u', [])], imageClips: [{ Type: 'ImageClip', FullName: 'clipL', targets: [] }], removed: [] };
    Lp.remove = (x) => { Lp.removed.push(x.FullName); Lp.shaders = Lp.shaders.filter(s => s !== x); };
    const Lc = { Type: 'light', FullName: 'LightRoot.light', Parent: Lp, removed: [], remove(x) { Lc.removed.push(x.FullName); Lp.imageClips = Lp.imageClips.filter(s => s !== x); } };
    k = A.calls.length; run('DeleteUnusedShaders', { container: [Lc, { Type: 'null', FullName: 'n' }] });
    t.lightParent = [Lp.removed, Lc.removed, callsFrom(k).map(c => c[1])];
    // a shader compound: a shader fed by an input of the compound is left alone
    const K = { Type: 'Shader', ShaderType: 'siShaderCompound', FullName: 'Cmp', shaders: [], removed: [] };
    K.remove = (x) => { K.removed.push(x.FullName); K.shaders = K.shaders.filter(s => s !== x); };
    const fed = sh('fed', [], { sources: [K] }); const viaFed = sh('viaFed', [], { sources: [fed] }); const free = sh('free', []);
    K.shaders = [fed, viaFed, free];
    run('DeleteUnusedShaders', { container: K });
    t.compound = [K.shaders.map(s => s.FullName), K.removed];

    // RTShaderSetCategories
    A.shaderDefs.set('Softimage.sib_color_math_basic.1.0', { ProgID: 'Softimage.sib_color_math_basic.1.0', Category: 'old', DisplayName: 'Color Math Basic', attributes: {} });
    A.shaderDefs.set('Softimage.mib_texture_checkerboard.1.0', { ProgID: 'Softimage.mib_texture_checkerboard.1.0', Category: '', DisplayName: 'mib Texture Checkerboard', attributes: {} });
    A.shaderDefs.set('Softimage.XSIVDM.1.0', { ProgID: 'Softimage.XSIVDM.1.0', Category: '', DisplayName: 'VDM', attributes: {} });
    A.env.XSI_NO_DEFAULT_SHADERS = '1';
    m = mark(); t.catOff = [val('RTShaderSetCategories', {}), logFrom(m).length, A.shaderDefs.get('Softimage.sib_color_math_basic.1.0').Category];
    delete A.env.XSI_NO_DEFAULT_SHADERS;
    m = mark(); const res = val('RTShaderSetCategories', {});
    const lg = logFrom(m); const errs = lg.filter(l => /^error:Shader 'Softimage\..+\.1\.0' not found\.$/.test(l));
    const d = (n) => { const x = A.shaderDefs.get(`Softimage.${n}.1.0`); return x ? [x.Category, x.DisplayName, x.attributes.Thumbnail ?? null] : null; };
    t.cat = { res, logLines: lg.length, errors: errs.length, defs: A.shaderDefs.size, firstError: errs[0] ?? null,
      blinn: d('material-blinn'), phong: d('material-phong')?.[0] ?? null, phongThumb: d('material-phong')?.[2] ?? null, math: d('sib_color_math_basic'), checker: d('mib_texture_checkerboard'), vdm: d('XSIVDM'),
      missingLogged: lg.includes("error:Shader 'Softimage.mia_material_phen.1.0' not found.") || !!d('mia_material_phen') };
    app.select([]);
    out.rt = t;
  }

  // ====================================================== Lagoa / ICE flow
  {
    const l = {};
    app.select([]);
    let m = mark(); l.emitNone = [val('LagoaEmitMPVolume', {}), logFrom(m)];
    const a = cube('lagA'), b = cube('lagB');
    app.select([a, b]); m = mark(); let k = A.calls.length;
    const r2 = val('LagoaEmitMPVolume', {});
    const cl = callsFrom(k); const cloud = app.scene.find('Lagoa_MP_Cloud');
    l.emit2 = { res: r2, cloudType: cloud?.type ?? null, order: cl.map(c => c[0]).filter((n, i, arr) => n !== arr[i - 1]),
      compounds: cl.filter(c => c[0] === 'AddICECompoundNode').map(c => c[1][0]), ports: cl.filter(c => c[0] === 'AddPortToICENode').map(c => String(c[1][0]).replace(/^.*?\.(port|Lagoa_Emit_Volume\.)/i, '$1')),
      portMode: [...new Set(cl.filter(c => c[0] === 'AddPortToICENode').map(c => c[1][1]))], getData: cl.filter(c => c[0] === 'AddICENode').length,
      refs: cl.filter(c => c[0] === 'SetValue' && /reference$/.test(c[1][0])).map(c => c[1][1]), wire: cl.filter(c => c[0] === 'SetValue' && /wirecolor/.test(c[1][0])).map(c => [String(c[1][0]).split('.').pop(), c[1][1]]),
      connects: cl.filter(c => c[0] === 'ConnectICENodes').map(c => c[1].map(p => String(p).replace(/^.*ICETree\./, '').replace(/Get_Data.*\./, 'GetData.').replace(/Get Data.*\./, 'GetData.'))),
      infos: logFrom(m).filter(x => x === 'info:lagA' || x === 'info:lagB'), nya: logFrom(m).some(x => /LagoaEmitMPVolume: not yet attested/.test(x)) };
    app.select([a]); k = A.calls.length; run('LagoaEmitMPVolume', {});
    l.emit1Ports = callsFrom(k).filter(c => c[0] === 'AddPortToICENode').length;
    app.select([]); m = mark(); const ins = A.inspected.length;
    l.tagNone = [val('LagoaTagCollisionObject', {}), A.inspected.length - ins, A.inspected[A.inspected.length - 1], logFrom(m)];
    m = mark(); k = A.calls.length;
    const rt = val('LagoaTagCollisionObject', { SelectionList: [b, cloud] });
    const tree = b.primitive.operators.find(o => o.type === 'icetree');
    l.tag = [rt, callsFrom(k).map(c => c[0]), !!tree, (tree?.lagoaLinks ?? []).map(x => [x.dest.replace(/^.*ICETree\./, ''), x.source.replace(/^.*ICETree\./, '')]),
      logFrom(m).filter(x => /tagged/.test(x)), /Lagoa_Set_Collision_Data$/.test(A.inspected[A.inspected.length - 1])];
    l.displayNoProp = 'err' in run('LagoaDisplayType', { SelectionList: [cloud] });
    const pd = { Name: 'Particle Display' }; const duck = { type: 'pointcloud', FullName: 'pc', Properties: [{ Name: 'x' }, pd] }; const pd2 = { Name: 'Particle Display' };
    l.display = [val('LagoaDisplayType', { SelectionList: [duck, b, { type: 'polymsh', Properties: [pd2] }], arg1: 7, arg2: 3 }), { ...pd }, Object.keys(pd2).length];
    run('LagoaDisplayType', { SelectionList: [duck] }); l.displayDefaults = [pd.pointsize, pd.displaytype];

    app.select([]); m = mark(); k = A.calls.length;
    l.advectNone = [val('LagoaSetupAdvectMesh', {}), logFrom(m).filter(x => x.startsWith('error:')), callsFrom(k).length];
    const g = cube('advCube'); const opsBefore = g.primitive.operators.length;
    app.select([cloud, g]); k = A.calls.length;
    l.advect = [val('LagoaSetupAdvectMesh', { inspectPPG: false }), g.primitive.operators.length - opsBefore, callsFrom(k).map(c => [c[0], c[2]]), callsFrom(k).find(c => c[0] === 'ICEFlow_CreateParticlesFromPreset')?.[1],
      callsFrom(k).find(c => c[0] === 'CreateSimulatedICETree')?.[1]];
    app.select([]); k = A.calls.length; l.clothNone = [val('LagoaSetupClothMesh', {}), callsFrom(k).length];
    g.kinematics.local.set('posx', 5); app.select([g]); k = A.calls.length;
    l.cloth = [val('LagoaSetupClothMesh', {}), callsFrom(k).map(c => [c[0], c[1], c[2]]), g.kinematics.local.val('posx')];
    app.select([]);

    // ICEFlowInsertSimulationRoot
    const T = A.IceFlowTree, N = A.IceFlowNode;
    const G = 'SimulateParticlesPortIndex';
    app.run('SetGlobal', { in_VariableName: G, in_Value: null });
    m = mark(); l.rootBuildTree = [val('ICEFlowInsertSimulationRoot', {}), logFrom(m).some(x => /ICEFlowInsertSimulationRoot: not yet attested/.test(x)), val('ICEFlowInsertSimulationRoot', { in_ICETree: tree })];
    const shape = (t) => ({ ports: t.ports.map(p => [p.name, p.source ? `${p.source.node.name}.${p.source.port}` : null]),
      root: (t.nodes.find(n => n.type === 'Simulation_Root')?.inputs ?? []).map(p => [p.name, p.source ? `${p.source.node.name}.${p.source.port}` : null]) });
    const t1 = new T('pc.pointcloud.ICETree', 7);
    const mk = (name, outs, type = name) => t1.addNode(new N(name, type, [], outs));
    const emit = mk('Emit_from_Surface', ['Emit']), mine = mk('My_Node', ['Execute']), forces = mk('Add_Forces', ['Execute']), simn = mk('Simulate_Particles', ['simulate']),
      post = mk('Post', ['Out']), post2 = mk('Post2', ['Out']), sm = mk('State_Machine', ['Execute']);
    const plug = (t, i, node, port) => { t.ports[i].source = { node, port }; };
    plug(t1, 0, emit, 'Emit'); plug(t1, 1, mine, 'Execute'); plug(t1, 2, forces, 'Execute'); plug(t1, 3, simn, 'simulate'); plug(t1, 4, post, 'Out'); plug(t1, 5, post2, 'Out'); plug(t1, 6, sm, 'Execute');
    k = A.calls.length; m = mark();
    l.root1 = [val('ICEFlowInsertSimulationRoot', { in_ICETree: t1 }), shape(t1), app.run('GetGlobal', { in_VariableName: G }), callsFrom(k).map(c => c[0]).filter((n, i, arr) => n !== arr[i - 1]), logFrom(m).filter(x => /WARNING/.test(x)).length];
    l.root1Again = [val('ICEFlowInsertSimulationRoot', { in_ICETree: t1 }), t1.nodes.filter(n => n.type === 'Simulation_Root').length, JSON.stringify(shape(t1)) === JSON.stringify(l.root1[1])];
    A.iceFlowTrees.set(t1.fullName, t1); l.rootByName = val('ICEFlowInsertSimulationRoot', { in_ICETree: t1.fullName });
    const t2 = new T('b.ICETree', 2); const x2 = t2.addNode(new N('Thing', 'Thing', [], ['Execute'])); plug(t2, 0, x2, 'Execute');
    m = mark(); l.rootNoEmit = [val('ICEFlowInsertSimulationRoot', { in_ICETree: t2 }), logFrom(m).filter(x => /WARNING/.test(x)), shape(t2), app.run('GetGlobal', { in_VariableName: G })];
    m = mark(); l.rootFoundNotFirst = [val('ICEFlowInsertSimulationRoot', { in_ICETree: t2 }), logFrom(m).filter(x => !x.startsWith('cmd:')).length, t2.nodes.length];
    const t3 = new T('c.ICETree', 2); const e3 = t3.addNode(new N('Emitter_A', 'Emit_from_Surface', [], ['Emit'])); plug(t3, 0, e3, 'Emit');   // the node's name differs from its type
    l.rootTypePath = [val('ICEFlowInsertSimulationRoot', { in_ICETree: t3 }), shape(t3)];
    app.run('SetGlobal', { in_VariableName: G, in_Value: null });
    out.ice = l;
  }

  // ====================================================== sdkui: External Files Manager
  {
    const e = {};
    fsys.ensureFolder('C:\\Users\\user\\Autodesk\\Softimage_2015_SP2\\Data\\XSI_SAMPLES\\Pictures');
    const proj = A.projectPath;
    fsys.writeFile(`${proj}\\Pictures\\in.png`, 'x');
    const files = [
      { Path: 'Pictures\\in.png', ResolvedPath: `${proj}\\Pictures\\in.png`, FileType: 'Pictures', GUID: '{E1}', Owners: [{ FullName: 'Clips.in_png' }] },
      { Path: 'D:\\ref\\m.emdl', ResolvedPath: 'D:\\ref\\m.emdl', FileType: 'Models', GUID: '{E2}', Owners: [{ FullName: 'RefModel', LockType: 'siLockTypeRefModel' }, { FullName: 'Other' }] },
    ];
    A.externalFiles = () => files; A.modelExternalFiles = () => [files[1]];
    A.externalFilesViewer = null;
    const V = val('SIGetExternalFilesViewerProp', {}); const F = A.gridOf(V, 'Files'), FC = A.gridOf(V, 'FilesCache');
    e.same = val('SIGetExternalFilesViewerProp', {}) === V;
    e.prop = { name: V.name, type: V.type, params: V.params.map(p => [p.name, p.def.type, p.value, !!p.def.readOnly]), columns: F.columns.length, fixedColumns: [F.columns[5], F.columns[7], F.columns[8]], cacheColumns: FC.columns.length, rowLabel: F.rowLabels[0] };
    e.layout = V.scriptLayout.describe();
    e.layoutAttrs = [V.scriptLayout.Item('Files').attrs, V.scriptLayout.Item('FileType').UIItems, V.scriptLayout.Item('ShowRecords').UIItems, V.scriptLayout.Item('BntBrowse').attrs, V.scriptLayout.Item('BntDeleteAllMat').attrs, V.scriptLayout.Item('Target').attrs];
    e.fill = JSON.parse(JSON.stringify([F.rows, F.rowColors, FC.rows]));
    V.set('Validateondisk', false);
    e.closedNoRefill = F.rows[0][3];   // the page is closed: a change does not refill
    A.openExternalFilesPage(V);
    e.noValidate = [F.rows.map(r => [r[3], r[4]])];
    V.set('Validateondisk', true); V.set('FileType', 'Models');
    e.filter = [F.rows.map(r => r[0]), V.pageRefreshes];
    V.set('FileType', 'All');
    let m = mark();
    e.setTarget = [val('SISetExternalFilesManagerTarget', { Target: 'NoSuchModel' }), V.val('Target'), F.RowCount];
    A.namedObjects.set('MyModel', { Type: '#model', FullName: 'MyModel' });
    run('SISetExternalFilesManagerTarget', { Target: 'MyModel' });
    e.modelTarget = [V.val('Target'), F.rows.map(r => r[0])];
    A.namedObjects.clear();
    const rm = V.val('RefreshMe');
    e.emptyTarget = [val('SISetExternalFilesManagerTarget', {}), V.val('Target'), V.val('RefreshMe') !== rm, F.RowCount];
    const rm2 = V.val('RefreshMe'); run('SISetExternalFilesManagerTarget', {});
    e.emptyTargetOk = [V.val('Target'), V.val('RefreshMe') !== rm2];
    for (let i = 0; i < 12; i++) files.push({ Path: `C:\\x${i}.png`, ResolvedPath: `C:\\x${i}.png`, FileType: 'Pictures', GUID: `{X${i}}`, Owners: [] });
    V.set('ShowRecords', '10'); const h10 = V.scriptLayout.Item('Files').attrs.siUICY;
    V.set('ShowRecords', '25'); const h25 = V.scriptLayout.Item('Files').attrs.siUICY ?? null;
    V.set('ShowRecords', 'All');
    e.height = [h10, h25, V.scriptLayout.Item('Files').attrs.siUICY ?? null, F.RowCount];
    A.closeExternalFilesPage(V); V.set('Target', 'Gone'); A.openExternalFilesPage(V);
    e.openResets = V.val('Target');
    A.closeExternalFilesPage(V);
    A.externalFiles = null; A.modelExternalFiles = null;
    out.ext = e;
  }

  // ====================================================== sdkui: ConnectToWorkgroupUI
  {
    const w = {}; const D = app.addonDocWizard; D.workgroups.length = 0; A.lastWorkgroupPath = '';
    const W = '.addon-ConnectWorkgroup';
    const field = () => q(`${W} .sdkh-row input`);
    const type = (v) => { const i = field(); i.value = v; i.dispatchEvent(new Event('change')); };
    const msgText = () => q('.sdkh-msg .sdkh-msg-text')?.textContent ?? null;
    app.Interactive = false; w.batch = 'err' in run('ConnectToWorkgroupUI', {}); app.Interactive = true;
    const rootProps = () => app.scene.root.properties.map(p => p.name).join(',');
    const before = rootProps();
    let pr = app.run('ConnectToWorkgroupUI', {}); await tick();
    const dp = app.scene.root.properties.find(p => p.name === 'ConnectWorkgroup');
    w.dialog = { promise: typeof pr?.then === 'function', title: q(`${W} .ppg-float-title`)?.textContent, prop: !!dp, params: dp?.params.map(p => p.name), text: q(`${W} .sdkh-static`)?.textContent, control: q(`${W} .sdkh-row`)?.dataset.control,
      hasLabel: !!q(`${W} .sdkh-row label`), value: field()?.value, exampleButton: !!q(`${W} [data-button=SDKWorkgroup]`) };
    q(`${W} .sdkh-modal-cancel`).click(); w.cancel = [String(await pr), rootProps() === before];
    pr = app.run('ConnectToWorkgroupUI', {}); await tick(); type(''); q(`${W} .sdkh-modal-ok`).click(); w.emptyDir = String(await pr);
    // a folder that does not exist: message, then the dialog again with the last path
    fsys.ensureFolder('C:\\wg\\studio');
    const views = A.views; views.push({ type: 'Plugin Manager', name: 'pm', attrs: { refresh: 'x' }, subViews: {} });
    let m = mark();
    pr = app.run('ConnectToWorkgroupUI', {}); await tick(); type('C:\\wg\\missing'); q(`${W} .sdkh-modal-ok`).click(); await tick();
    w.missing = [msgText(), !!q(W)];
    q('.sdkh-msg .sdkh-modal-ok').click(); await tick();
    w.reopened = [!!q(W), field()?.value];
    type('C:\\wg\\studio'); q(`${W} .sdkh-modal-ok`).click();
    w.ok = [await pr, [...D.workgroups], views[views.length - 1].attrs.refresh, logFrom(m).filter(x => /WARNING/.test(x)).length, rootProps() === before, A.lastWorkgroupPath];
    // already in the list
    pr = app.run('ConnectToWorkgroupUI', {}); await tick(); w.prefilled = field()?.value; q(`${W} .sdkh-modal-ok`).click(); await tick();
    w.duplicateMsg = msgText(); q('.sdkh-msg .sdkh-modal-ok').click(); w.duplicate = [await pr, D.workgroups.length];
    // AddWorkgroup raising
    fsys.ensureFolder('C:\\wg\\bad'); A.addWorkgroup = () => { throw new Error('access denied'); };
    pr = app.run('ConnectToWorkgroupUI', {}); await tick(); type('C:\\wg\\bad'); q(`${W} .sdkh-modal-ok`).click(); await tick();
    w.addFailsMsg = /access denied/.test(msgText() ?? ''); q('.sdkh-msg .sdkh-modal-ok').click(); w.addFails = [await pr, D.workgroups.length];
    delete A.addWorkgroup;
    // the SDK example workgroup button
    const example = `${D.factoryPath}\\XSISDK\\examples\\workgroup`; fsys.ensureFolder(example);
    pr = app.run('ConnectToWorkgroupUI', {}); await tick();
    const dp2 = app.scene.root.properties.find(p => p.name === 'ConnectWorkgroup');
    const btn = q(`${W} [data-button=SDKWorkgroup]`);
    w.example = [btn?.textContent ?? null, dp2?.val('SDKExampleWorkgroupPath') === example];
    btn?.click(); await tick(); w.exampleCopied = field()?.value === example;
    q(`${W} .sdkh-modal-ok`).click(); w.exampleOk = (await pr) === example;
    pr = app.run('ConnectToWorkgroupUI', {}); await tick(); w.exampleGone = !q(`${W} [data-button=SDKWorkgroup]`); q(`${W} .sdkh-modal-cancel`).click(); await pr;
    views.length = 0; D.workgroups.length = 0;
    w.leftOver = document.querySelectorAll('.sdkh-modal-window').length;
    out.wg = w;
  }

  // ====================================================== sdkui: SDKGetScriptGenerator
  {
    const s = {};
    s.unknown = [val('SDKGetScriptGenerator', { Language: 'Lua' }), val('SDKGetScriptGenerator', {}), 'err' in run('SDKGetScriptGenerator', { Language: 'PerlScript' })];
    const langs = ['JScript', 'Cpp', 'C#', 'VBScript', 'Python'];
    s.text = {}; s.small = {};
    for (const lang of langs) {
      const w = app.run('SDKGetScriptGenerator', { Language: lang });
      w.Clear();
      w.BeginFn('bool', 'F', ['CValue a', 'int b']);
      w.VarDecl(['CValue x', 'int y']);
      w.FnCall('r', 'g', ['1', null, '2'], false, 'int');
      w.FnCall(null, 'h', null);
      w.OMCall(null, 'o', 'M', ['a']);
      w.OMAssignProp('o', 'P', '5', true);
      w.OMReadProp('CValue r', 'o', 'P', true, 'T');
      w.Comment(['c1', 'c2'], 1);
      w.LogMessage('"hi"');
      w.EndFn('F', 'r', true);
      w.BeginStdFn('S');
      w.EndFn('S');
      s.text[lang] = w.GetWriterString();
      let noPrefix; try { w.UseConstant('c'); noPrefix = 'no error'; } catch (e) { noPrefix = String(e.message); }
      s.small[lang] = [w.Type, w.Language, w.StrConst('s'), w.BoolStr(true), w.BoolStr(0), w.CallbackSuccess, w.ORSyntax, w.UseConstant('c', 'P'), noPrefix, w.StrCat(['a', 'b']), w.ToStr('e'), w.NestingPrefix(2)];
    }
    const js = app.run('SDKGetScriptGenerator', { Language: 'JScript' }), vb = app.run('SDKGetScriptGenerator', { Language: 'VBScript' }), cs = app.run('SDKGetScriptGenerator', { Language: 'C#' }),
      cpp = app.run('SDKGetScriptGenerator', { Language: 'Cpp' }), py = app.run('SDKGetScriptGenerator', { Language: 'Python' });
    const arr = ['CValue & x', 5, 'int y'];
    s.strip = [js.StripType('CValue & x'), js.StripType(arr) === arr, arr, js.StripVar('int x'), js.StripVar(7), js.BeginClass('A', 'B'), js.EndClass()];
    js.Clear(); js.Append('one;'); vb.Append('two');
    s.shared = [cs.GetWriterString(), A.generatorBuffer];
    const emit = (w, f) => { w.Clear(); f(w); return w.GetWriterString(); };
    s.noArgs = [emit(js, w => w.BeginFn(null, 'f')), emit(py, w => w.BeginFn(null, 'f')), emit(js, w => w.FnCall(null, 'f', 'a, b')), emit(js, w => w.FnCall('r', 'f', ['x'])), emit(js, w => w.VarDecl('int z'))];
    let m = mark();
    s.badArgs = [emit(js, w => w.FnCall('r', 'g', 5)), emit(cpp, w => w.FnCall('r', 'g', 5)), emit(cs, w => w.FnCall('r', 'g', 5)), emit(py, w => w.FnCall('r', 'g', 5)), emit(vb, w => w.FnCall('r', 'g', 5)), logFrom(m)];
    s.csharp = [emit(cs, w => { w.BeginClass('A', 'B'); w.BeginClass('C'); w.EndClass(); }), emit(cs, w => w.OMCall('r', null, 'M', ['a'])), emit(cs, w => w.OMReadProp('r', 'o', 'P'))];
    s.vb = [emit(vb, w => { w.BeginSub('S', ['int a']); w.EndSub(); }), emit(vb, w => w.FnCall(null, 'f', ['a', null, 'b', null, null])), emit(vb, w => w.FnCall('r', 'f', ['a'], true)), emit(vb, w => w.EndFn('F')), emit(vb, w => w.OMAssignProp('o', 'P', 1))];
    s.cpp = [emit(cpp, w => w.BeginLocalFn('void', 'L', 'int a')), emit(cpp, w => w.OMReadProp('r', 'o', 'P')), emit(cpp, w => w.FnCall('r', 'f', null))];
    const hl = app.run('SDKGetScriptGenerator', { Language: 'HLSL' }), cg = app.run('SDKGetScriptGenerator', { Language: 'CGFX' });
    const templ = (w) => ['UIParamDeclTempl', 'UIParamColorDeclTempl', 'UIParamTex2DDeclTempl', 'SemanticParamDeclTempl', 'SASParamDeclTempl', 'GlobalDeclTempl', 'ShaderFuncDeclTempl', 'MatrixDeclTempl', 'UIParamNoMinMaxDeclTempl', 'Extension'].map(n => w[n]());
    s.hlsl = { templ: templ(hl), cgfx: templ(cg).filter((x, i) => x !== templ(hl)[i]), struct: ['Position', 'normal', 'COLOR', 'binormal', 'tangent', 'TexCoord3', 'other'].map(x => hl.StructMember(x)),
      noCalls: ['FnCall', 'OMCall', 'OMAssignProp', 'OMReadProp'].map(n => typeof hl[n]), misc: [hl.CallbackSuccess, hl.ORSyntax, hl.ToStr('e'), hl.StrCat(['a', 'b']), hl.Language, cg.Language],
      text: emit(hl, w => { w.Comment(['c']); w.VarDecl(['float x']); w.BeginFn('', 'f', 'float a'); w.EndFn('f', 'x'); w.BeginLocalFn('float', 'g', null); }), logFails: (() => { try { hl.LogMessage('x'); return false; } catch { return true; } })() };
    js.Clear();
    out.gen = s;
  }

  // ====================================================== sdkui: PPGLayoutControl
  {
    const p = {};
    const list = { Value: '' }, ui = { UIItems: [] }, ls = { Value: '' };
    let m = mark();
    const c = app.run('PPGLayoutControl', { LayoutList: list, LayoutListUI: ui, LayoutString: ls });
    p.type = c.Type;
    p.updateEmpty = c.updateList(['a']);
    p.add1 = [c.addParameter('a'), ls.Value, [...ui.UIItems]];
    c.addParameter('b'); p.add2 = ls.Value;                       // '' selects the final empty pair: at the end
    list.Value = 'zzz'; c.addParameter('c'); p.addUnselected = ls.Value;   // no pair has that value: before the last entry
    list.Value = 'c'; p.group = [c.addGroup('G1'), ls.Value, [...ui.UIItems]];
    p.groupDup = [c.addGroup('G1'), c.addGroup(''), logFrom(m).filter(x => /LayoutControl/.test(x))];
    list.Value = 'b'; p.row = [c.addRow(), ls.Value];
    list.Value = 'a'; p.tab = [c.addTab('T1'), ls.Value, [...ui.UIItems]];
    m = mark(); list.Value = 'c'; p.tabInside = [c.addTab('T2'), c.addTab('T1'), c.addTab(''), ls.Value.includes('T2'), logFrom(m)];
    list.Value = 'c'; p.move = [c.moveSelected(1), ls.Value, list.Value];
    list.Value = 'G1'; p.moveMarker = [c.moveSelected(1), c.moveSelected(2), c.moveSelected(0)];
    list.Value = 'T1'; p.moveOut = c.moveSelected(-1);
    list.Value = 'nothing'; p.moveNoSel = [c.moveSelected(1), c.deleteSelected()];
    p.layout = c.getLayout('  ');
    p.raw = c.getLayoutRawData().slice(0, 3);
    list.Value = 'G1'; p.deleteMarker = [c.deleteSelected(), ls.Value, list.Value];
    p.update = [c.updateList(['a', 'c']), ls.Value, c.updateList(['a', 'c'])];
    list.Value = 'T1_1'; p.deleteLast = [c.deleteSelected(), ls.Value, list.Value];
    // an unmatched marker and a custom reporter
    const warned = []; const ls2 = { Value: 'G:x|a' }, ui2 = { UIItems: [] }, list2 = { Value: '' };
    const c2 = app.run('PPGLayoutControl', { LayoutList: list2, LayoutListUI: ui2, LayoutString: ls2, errorReporter: { Warning: (t) => warned.push(t) } });
    c2.updateList(['a']); list2.Value = 'x'; m = mark();
    p.unmatched = [c2.deleteSelected(), ls2.Value, [...warned], logFrom(m).length];
    // generateLayoutMethod
    const grid = new A.GridData(['Type', 'Name']); grid.rows = [['siInt4', 'a'], ['Color', 'c'], ['Button', 'b'], ['Grid', 'g']];
    const wiz = { grids: { Params: grid } };
    const gen = (lang, layoutText) => {
      const w = app.run('SDKGetScriptGenerator', { Language: lang }); w.Clear();
      const lc = app.run('PPGLayoutControl', { LayoutList: { Value: '' }, LayoutListUI: { UIItems: [] }, LayoutString: { Value: layoutText }, errorReporter: { Warning: (t) => warned.push(t) } });
      try { lc.generateLayoutMethod(w, wiz, 'MyProp', 'x'); return w.GetWriterString(); } catch (e) { return `ERR:${e.message}`; }
    };
    warned.length = 0;
    p.genJs = gen('JScript', 'T:Main|G:Grp|a|ghost|g:Grp|R:row0|c|r:row0|t:Main');
    p.genWarned = [...warned];
    p.genJsEmpty = gen('JScript', '');
    p.genCs = gen('C#', 'G:Grp|b|g|g:Grp');
    p.genVb = gen('VBScript', 'a');
    p.genPy = gen('Python', 'g');
    p.genCpp = gen('Cpp', 'a|b');
    p.genCppGrid = gen('Cpp', 'g');
    out.lc = p;
  }

  // ====================================================== sdkui: GetWizardParamTab
  {
    const w = {};
    const H = app.run('WizardHelper', {});
    const wiz = H.CreateWizard('B7cParamWiz');
    const tab = app.run('GetWizardParamTab', { in_Type: 'CustomProperty' });
    tab.AddParameters(wiz);
    const G = A.gridOf(wiz, 'Params');
    w.params = { type: tab.Type, helper: tab.WizardHelper?.Type, count: wiz.params.length, columns: G.columns, ParamType: wiz.val('ParamType'), ParamName: wiz.val('ParamName'),
      defaults: ['Keyable', 'Callback', 'ReadOnly', 'Animatable', 'DefaultBool', 'UIRange', 'DefaultInt4', 'MaxInt4', 'UIMaxInt4', 'MaxUByte', 'UIMaxUByte', 'MaxFloat', 'UIMaxFloat', 'DefaultColorA'].map(n => wiz.val(n)),
      ranges: ['MaxInt4', 'MaxUByte', 'MaxFloat', 'DefaultColorR'].map(n => { const d = wiz.get(n).def; return [d.min ?? null, d.max ?? null, d.uimin ?? null, d.uimax ?? null]; }) };
    const lay = (type, t, n) => { const L = new A.ScriptLayout(); app.run('GetWizardParamTab', { in_Type: type }).BuildParamTabLayout(L, t, 'Generate It', n); return L; };
    w.layoutInt = lay('CustomProperty', 'siInt4', 0).describe();
    w.layoutButton = lay('CustomProperty', 'Button', 2).describe();
    w.layoutString = lay('CustomPrimitive', 'siString', 1).describe();
    w.layoutColor = lay('CustomProperty', 'Color', 1).describe().filter(x => /^color|DefaultBool/.test(x));
    w.comboProp = lay('CustomProperty', 'siBool', 0).Item('ParamType').UIItems;
    w.comboOp = lay('CustomOperator', 'siBool', 0).Item('ParamType').UIItems.filter((_, i) => i % 2 === 1);
    const msgs = () => A.messages.length;
    let n0 = msgs();
    tab.AddParam_OnClicked(wiz);
    w.addInt = [G.rows.map(r => [...r]), [...G.rowLabels], wiz.val('ParamName'), msgs() - n0];
    wiz.set('ParamName', 'Param'); tab.AddParam_OnClicked(wiz); w.dup = [G.RowCount, msgs() - n0];
    wiz.set('ParamName', ''); tab.AddParam_OnClicked(wiz); w.empty = [G.RowCount, msgs() - n0];
    wiz.set('ParamName', ' My Name '); wiz.set('MinInt4', 200); tab.AddParam_OnClicked(wiz); w.badRange = [G.RowCount, msgs() - n0];
    wiz.set('MinInt4', 0); wiz.set('ParamType', 'siFloat'); wiz.set('DefaultFloat', 0.12345); wiz.set('UIRange', true); wiz.set('UIMinFloat', 0.25); wiz.set('UIMaxFloat', 0.75); wiz.set('Animatable', true);
    tab.AddParam_OnClicked(wiz);
    wiz.set('ParamType', 'Color'); wiz.set('DefaultColorR', 0.5); wiz.set('DefaultColorA', 1); wiz.set('ParamName', 'Tint'); tab.AddParam_OnClicked(wiz);
    wiz.set('ParamType', 'siBool'); wiz.set('DefaultBool', true); wiz.set('ParamName', 'Flag'); tab.AddParam_OnClicked(wiz);
    wiz.set('ParamType', 'siString'); wiz.set('DefaultString', 'hello'); wiz.set('ParamName', 'Text'); wiz.set('Callback', false); tab.AddParam_OnClicked(wiz);
    wiz.set('ParamType', 'Button'); wiz.set('ParamName', 'Go'); wiz.set('Callback', true); tab.AddParam_OnClicked(wiz);
    w.rows = G.rows.slice(1).map(r => Array.from(r, x => x === undefined ? null : x)); w.nextName = wiz.val('ParamName');
    w.rules = [tab.IncrementParameterName('a9'), tab.IncrementParameterName('a'), tab.SupportsReadOnly('Button'), tab.SupportsReadOnly('Grid'), ['Button', 'Grid', 'FCurve', 'String', 'siInt4'].map(t => tab.SupportsAnimatable(t)),
      tab.ReasonableNumber(100000), tab.ReasonableNumber(100001) === undefined, tab.ReasonableNumber(-100001) === undefined, [0, 2, 3, 4, 5, 8, 9, 11, 13, 16, 17, 18, 19, 31, 99].map(t => tab.StrFromVariantType(t))];
    n0 = msgs();
    w.testRanges = [tab.TestRanges(0, 0, 1, 0, 1, true), tab.TestRanges(0, 1, 1, 0, 1, false), tab.TestRanges(-1, 0, 1, 0, 1, false), tab.TestRanges(2, 0, 1, 0, 1, false), tab.TestRanges(0, 0, 1, -1, 1, true), tab.TestRanges(0, 0, 1, 0, 2, true),
      tab.TestRanges(0, 0, 1, 0.5, 0.5, true), tab.TestRanges(0, 0, 1, -1, 2, false), msgs() - n0, new Set(A.messages.slice(n0).filter(t => t !== '')).size];
    wiz.set('UIRange', false); tab.UIRange_OnChanged(wiz); const off = [...wiz.disabledParams].sort();
    wiz.set('UIRange', true); tab.UIRange_OnChanged(new A.ScriptPPG(wiz)); w.uiRange = [off, wiz.disabledParams.size];
    // generators
    const gen = (lang, type, f) => { const wr = app.run('SDKGetScriptGenerator', { Language: lang }); wr.Clear(); const t = app.run('GetWizardParamTab', { in_Type: type }); try { f(t, wr); return wr.GetWriterString(); } catch (e) { return `ERR:${e.message}`; } };
    w.defineJs = gen('JScript', 'CustomProperty', (t, wr) => t.GenerateDefineMethod(wr, wiz, 'MyProp'));
    w.defineVbOp = gen('VBScript', 'CustomOperator', (t, wr) => t.GenerateDefineMethod(wr, wiz, 'MyOp'));
    w.defineCppOp = gen('Cpp', 'CustomOperator', (t, wr) => t.GenerateDefineMethod(wr, wiz, 'MyOp'));
    w.defineCs = gen('C#', 'CustomProperty', (t, wr) => t.GenerateDefineMethod(wr, wiz, 'MyProp'));
    w.definePyPrim = gen('Python', 'CustomPrimitive', (t, wr) => t.GenerateDefineMethod(wr, wiz, 'MyPrim'));
    w.logicJs = gen('JScript', 'CustomProperty', (t, wr) => t.GenerateLogicCallbacks(wr, 'JScript', wiz, 'MyProp'));
    let m = mark();
    w.logicCppNoTemplate = [gen('Cpp', 'CustomProperty', (t, wr) => t.GenerateLogicCallbacks(wr, 'Cpp', wiz, 'MyProp')), logFrom(m).filter(x => /GetWizardParamTab: not yet attested/.test(x)).length];
    const folder = tab.WizardHelper.GetTemplateFolder(); fsys.ensureFolder(folder);
    fsys.writeFile(folder + 'PPGEvent.cpp.template', 'cpp %%plugin%% / %%objtype%%'); fsys.writeFile(folder + 'PPGEvent.cs.template', 'cs %%plugin%% / %%objtype%%');
    w.logicCompiled = [gen('Cpp', 'CustomProperty', (t, wr) => t.GenerateLogicCallbacks(wr, 'Cpp', wiz, 'MyProp')), gen('C#', 'CustomOperator', (t, wr) => t.GenerateLogicCallbacks(wr, 'C#', wiz, 'MyOp'))];
    fsys.deleteFile(folder + 'PPGEvent.cpp.template'); fsys.deleteFile(folder + 'PPGEvent.cs.template');
    // an existing object
    n0 = msgs(); const c1 = cube('psetCube'); const vis = c1.properties.find(p => p.type === 'visibility');
    const wiz2 = H.CreateWizard('B7cParamWiz2'); tab.AddParameters(wiz2); const G2 = A.gridOf(wiz2, 'Params');
    w.populate = [tab.PopulateParamListFromExistingPSet(wiz2, ''), tab.PopulateParamListFromExistingPSet(wiz2, 'NoSuchObject'), msgs() - n0, G2.RowCount,
      tab.PopulateParamListFromExistingPSet(wiz2, `psetCube.${vis.name}`) === undefined, G2.RowCount === vis.params.length, G2.rows[0]?.[1] === vis.params[0].name, G2.rows[0]?.[2]];
    out.wpt = w;
  }

  // ====================================================== sdkui: GetShaderDefHelper
  {
    const s = {};
    const H = app.run('WizardHelper', {});
    const wiz = H.CreateWizard('B7cShaderWiz');
    wiz.add({ name: 'Language', type: 'string', value: 'JScript' }); wiz.add({ name: 'PluginName', type: 'string', value: 'MyPlugin' });
    s.noWizard = 'err' in run('GetShaderDefHelper', {});
    const h = app.run('GetShaderDefHelper', { wiz });
    s.object = [h.WizardHelper?.Type, h.writer?.Language];
    h.CreateShaderDefParams(); h.CreateShaderParserParams();
    const IN = A.gridOf(wiz, 'InParamGrid'), OUT = A.gridOf(wiz, 'OutParamGrid'), OPT = A.gridOf(wiz, 'RendOptionGrid');
    s.params = { values: ['ShaderDefClassName', 'ShaderDefMajor', 'ShaderDefMinor', 'ShaderDefFamily', 'ShaderDefCategory', 'ShaderDefDisplayName', 'InParamName', 'InParamLongName', 'InParamType', 'InParamTexturable', 'InParamAnimatable',
      'InParamInspectable', 'InParamReadOnly', 'InParamHardLimitMinI', 'InParamHardLimitMaxI', 'InParamSoftLimitMaxF', 'OutParamName', 'OutParamLongName', 'OutParamType', 'OutParamMain', 'ShaderDefRendName', 'ShaderDefRendSymbol',
      'ShaderDefRendCodePath', 'ShaderDefRendShaderType'].map(n => wiz.val(n)), grids: [IN.columns.length, OUT.columns.length, OPT.columns.length, OPT.columns[1]],
      disabled: [...wiz.disabledParams], parser: ['ShaderParserName', 'ShaderParserFolder', 'ShaderParserExt'].map(n => wiz.get(n)?.def.type), count: wiz.params.length };
    h.BuildShaderDefLayout();
    const L = wiz.scriptLayout;
    s.layout = { tabs: L.items.filter(i => i.kind === 'tab').map(i => i.name), groups: L.items.filter(i => i.kind === 'group').map(i => i.name), buttons: L.items.filter(i => i.kind === 'button').map(i => `${i.name}=${i.label}`),
      attrs: L.attrs, families: L.Item('ShaderDefFamily').UIItems.length / 2, sorted: L.Item('ShaderDefFamily').UIItems[0], inTypes: L.Item('InParamType').UIItems.length / 2, outTypes: L.Item('OutParamType').UIItems.length / 2,
      attribs: L.Item('InParamAttrib').UIItems.length / 2, renderers: L.Item('ShaderDefRendName').UIItems.filter((_, i) => i % 2 === 0), defaultCtl: L.items.find(i => i.label === 'Default Value')?.name, texts: L.items.filter(i => i.kind === 'text').length,
      limits: L.items.filter(i => i.kind === 'item' && /Limit/.test(i.name)).map(i => `${i.name}=${i.label}`), codePath: L.Item('ShaderDefRendCodePath').attrs };
    wiz.set('InParamAttrib', 'siPropertyFilterAttribute'); wiz.set('InParamType', 'siShaderDataTypeImage'); L.Clear(); h.BuildShaderDefLayout();
    s.layout2 = [L.Item('InParamAttribVal').UIItems.length / 2, L.items.find(i => i.label === 'Default Value')?.name, L.items.find(i => i.label === 'Default Value')?.attrs, wiz.disabledParams.has('InParamHardLimitMinF')];
    L.Clear(); h.BuildParserLayout(); s.parserLayout = [L.describe(), L.Item('ShaderParserFolder').attrs];
    wiz.set('InParamAttrib', ''); wiz.set('InParamType', 'siShaderDataTypeScalar');
    // grids
    wiz.set('InParamDefaultValScalar1', 0.12345);
    s.addIn = [h.AddInputParamToGrid(), h.AddInputParamToGrid(), IN.rows.map(r => Array.from(r, x => x === undefined ? null : x)), [...IN.rowLabels], wiz.val('ParamNameSuffix')];
    wiz.set('InParamType', 'siShaderDataTypeInteger'); wiz.set('InParamName', 'count'); wiz.set('InParamDefaultValInt', 4); wiz.set('InParamAttrib', 'siShaderFamilyAttribute'); wiz.set('InParamAttribVal', 'v'); h.AddInputParamToGrid();
    wiz.set('InParamType', 'siShaderDataTypeBoolean'); wiz.set('InParamName', 'flag'); wiz.set('InParamDefaultValBool', true); wiz.set('InParamAttrib', ''); wiz.set('InParamAttribVal', ''); h.AddInputParamToGrid();
    wiz.set('InParamType', 'siShaderDataTypeColor4'); wiz.set('InParamName', 'tint'); h.AddInputParamToGrid();
    s.addIn2 = IN.rows.slice(2).map(r => Array.from(r, x => x === undefined ? null : x));
    // an image default
    wiz.set('InParamType', 'siShaderDataTypeImage'); wiz.set('InParamName', 'tex'); wiz.set('InParamDefaultValImage', 'C:\\img\\a.png');
    let m = mark(); const rowsBefore = IN.RowCount;
    s.imageMissing = [h.AddInputParamToGrid() === undefined, IN.RowCount - rowsBefore, logFrom(m)];
    fsys.ensureFolder('C:\\img'); fsys.writeFile('C:\\img\\a.png', 'PNG'); m = mark();
    const user = app.sdkHelpers?.paths?.[1] ?? 'C:\\Users\\user\\Autodesk\\Softimage_2015_SP2';
    s.imageCopied = [h.AddInputParamToGrid(), IN.rows[IN.RowCount - 1][13], wiz.val('InParamDefaultValImage'), fsys.isFile(`${user}\\Application\\fxtextures\\a.png`), logFrom(m)];
    wiz.set('InParamName', 'tex2'); m = mark(); h.AddInputParamToGrid(); s.imageInFolder = [IN.rows[IN.RowCount - 1][13], logFrom(m).length];
    s.addOut = [h.AddOutputParamToGrid(), wiz.set('OutParamName', 'COUNT'), h.AddOutputParamToGrid(), OUT.rows.map(r => [...r])];
    m = mark();
    s.addOpt = [h.AddRendererOptionToGrid(), logFrom(m), (wiz.set('ShaderDefRendOptionName', 'opt'), wiz.set('ShaderDefRendOptionVal', 'val'), h.AddRendererOptionToGrid()), h.AddRendererOptionToGrid(), OPT.rows.map(r => [...r])];
    // page events
    s.changed = [h.OnParamChanged('zzz'), (wiz.set('ShaderDefClassName', 'My Shader'), h.OnParamChanged('ShaderDefClassName')), wiz.val('ShaderDefClassName'), wiz.val('ShaderDefRendSymbol'),
      (wiz.set('InParamAttrib', 'a'), wiz.set('InParamAttribVal', 'b'), h.OnParamChanged('InParamType')), wiz.val('InParamAttrib'), wiz.val('InParamAttribVal'),
      (wiz.set('OutParamMain', true), h.OnParamChanged('OutParamType')), wiz.val('OutParamMain'), h.OnParamChanged('InParamAttrib'), wiz.val('InParamAttribVal'),
      (wiz.set('Language', 'Cpp'), h.OnParamChanged('Language')), wiz.disabledParams.has('ShaderDefRendCodePath'), (wiz.set('Language', 'JScript'), h.OnParamChanged('Language')), wiz.disabledParams.has('ShaderDefRendCodePath')];
    OPT.selectedRows = [0];
    s.buttons = [h.OnButtonClick('nothing'), h.OnButtonClick('RemoveRendererOptionBtn'), OPT.rows.map(r => r[0])];
    OUT.selectedRows = [1]; s.removeOut = [h.OnButtonClick('OutParamRemoveBtn'), OUT.rows.map(r => r[0])];
    // templates: not staged
    m = mark();
    s.noTemplates = [h.GenerateShaderDefRegisterCode(), h.GenerateRegisterParserCode() === undefined, h.GenerateParserCallback() === undefined, h.GenerateShaderDefCallback(), h.GenerateHWShaderCode(),
      logFrom(m).filter(x => /GetShaderDefHelper: not yet attested/.test(x)).length > 0];
    s.includes = h.ShaderDefCppIncludeFiles();
    // templates: staged
    const folder = h.WizardHelper.GetTemplateFolder(); fsys.ensureFolder(folder);
    const stage = (prefix, text, ext = '.js.template') => fsys.writeFile(folder + prefix + ext, text);
    stage('shaderdef_reg', 'REG %%shaderclass%% %%major%%.%%minor%%');
    stage('shaderparserdef_reg', 'PREG %%parser_name%%'); stage('shaderparserdef_CB', 'PCB %%parser_name%% %%folder%% %%ext%%');
    stage('shaderdef_defineinfo_attrib', '<A %%attrib%%=%%attrib_val%%>');
    stage('shaderdef_defineinfo_CB', 'INFO %%plugin%% %%shaderclass%% %%major%%.%%minor%% [%%category%%] [%%displayname%%] %%attrib%% %%attribcall%%;');
    stage('shaderdef_define_CB', 'DEFINE %%plugin%% %%shaderclass%% %%major%%.%%minor%% %%shader_family%% {%%parameter_definitions%%} {%%renderer_definition%%}');
    stage('shaderdef_input_paramdef', '(in %%param_name%% %%param_type%% "%%descr%%" %%animatable%%/%%inspectable%%/%%texturable%%/%%readonly%% %%default%% %%attrib%%)');
    stage('shaderdef_input_paramdef_default', '<d %%hlmin%% %%hlmax%% %%slmin%% %%slmax%% %%default_val%%>');
    stage('shaderdef_input_paramdef_attrib', '<a %%attribname%%=%%attribval%%>');
    stage('shaderdef_output_paramdef', '(out %%param_name%% %%param_type%% "%%descr%%" %%mainport%%)');
    stage('shaderdef_rendereroption', '<o %%option%%=%%value%%>'); stage('shaderdef_rendereroptions_def', '<opts %%options%%>');
    stage('shaderdef_rendererdef', 'REND %%name%% %%symbol%% [%%code_path%%] %%renderoptions%%');
    stage('hwshader_CB', 'HW %%symbol%% %%major%%.%%minor%% %%renderername%% %%shadername%%', '.cpp.template');
    s.reg = h.GenerateShaderDefRegisterCode();
    wiz.set('ShaderParserName', 'MyParser'); wiz.set('ShaderParserFolder', 'C:\\p'); wiz.set('ShaderParserExt', 'fx');
    s.parser = [h.GenerateRegisterParserCode(), h.GenerateParserCallback()];
    // presets
    IN.clear(); OUT.clear(); OPT.clear();
    wiz.set('InParamType', 'siShaderDataTypeScalar'); wiz.set('InParamName', 'amount'); wiz.set('InParamLongName', 'Amount'); wiz.set('InParamAttrib', ''); wiz.set('InParamAttribVal', ''); wiz.set('InParamDefaultValScalar1', 0.5); h.AddInputParamToGrid();
    wiz.set('InParamType', 'siShaderDataTypeImage'); wiz.set('InParamName', 'tex'); wiz.set('InParamLongName', 'Tex'); wiz.set('InParamDefaultValImage', 'a.png'); wiz.set('InParamAttrib', 'siShaderFamilyAttribute'); wiz.set('InParamAttribVal', 'fam'); h.AddInputParamToGrid();
    wiz.set('ShaderDefAttrib', 'k'); wiz.set('ShaderDefAttribVal', 'v');
    wiz.set('OutParamName', 'out'); wiz.set('OutParamLongName', 'Result'); wiz.set('OutParamType', 'siShaderDataTypeColor4'); h.AddOutputParamToGrid();
    wiz.set('ShaderDefRendOptionName', 'o1'); wiz.set('ShaderDefRendOptionVal', 'v1'); h.AddRendererOptionToGrid();
    s.callback = h.GenerateShaderDefCallback();
    s.hwNotHw = h.GenerateHWShaderCode();
    s.mr = [h.OnButtonClick('MRShaderPreset'), ['ShaderDefRendName', 'ShaderDefRendCodePath', 'ShaderDefRendShaderType', 'ShaderDefFamily', 'OutParamType', 'OutParamName', 'OutParamLongName', 'ShaderDefRendOptionName'].map(n => wiz.val(n)),
      [IN.RowCount, OUT.RowCount, OPT.RowCount]];
    IN.clear();
    s.hw = [h.OnButtonClick('HWShaderPreset'), ['ShaderDefRendName', 'ShaderDefRendCodePath', 'ShaderDefRendShaderType', 'ShaderDefFamily', 'OutParamName', 'ShaderDefRendOptionName', 'ShaderDefRendOptionVal'].map(n => wiz.val(n)),
      OUT.rows.map(r => [...r]), OPT.rows.map(r => [...r])];
    s.hwCode = h.GenerateHWShaderCode();
    s.hwCallback = h.GenerateShaderDefCallback();
    m = mark(); wiz.set('ShaderDefRendName', 'Mental ray'); s.hwWrong = [h.GenerateHWShaderCode(), logFrom(m)];
    wiz.set('ShaderDefRendName', ''); s.noRenderer = /\{\}$/.test(h.GenerateShaderDefCallback());
    for (const f of fsys.listFiles(folder)) fsys.deleteFile(folder + f);
    out.sdh = s;
  }

  // ====================================================== Polygonizer
  {
    const p = {};
    app.run('NewScene', {}); app.select([]);
    const a = cube('polyA'), b = cube('polyB');
    app.select([a, b]); const k = A.calls.length; const m = mark(); const u = app.undoStack.length;
    const r = val('Create_Polygonizer_Polymesh', {});
    const mesh = app.scene.find('Polygonizer');
    p.run = [r, mesh?.type ?? null, app.selection.map(n => n.name), callsFrom(k), logFrom(m).filter(x => /not yet attested/.test(x)).length, app.undoStack.length - u, logFrom(m).filter(x => x.startsWith('cmd:')).length];
    app.select([]); const k2 = A.calls.length;
    p.empty = [val('Create_Polygonizer_Polymesh', {}), app.selection.length, callsFrom(k2).filter(c => c[0] === 'SelectObj').map(c => c[1][0])];
    out.poly = p;
  }
  app.run('NewScene', {});
  return out;
}, { NAMES });

await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const NONE = '<none>';
const T = '\t';

// ---- 1. registration
for (const n of NAMES) eq(`${n}: registered with the registry's argument list`, got.reg[n], registry[n]);
const NOLOG = new Set(['UpdateCacheManager', 'RefreshCachesPathProp', 'GetItemsAsString', 'RemoveNumbering', 'SelectionValueToItemName', 'GetObjectsFromSource', 'GetCacheOnFile', 'AddToList', 'RemoveFromList',
  'OpenOutputFormatPreferences', 'RTShaderSetCategories', 'LagoaEmitMPVolume', 'LagoaTagCollisionObject', 'LagoaDisplayType', 'SIGetExternalFilesViewerProp', 'SISetExternalFilesManagerTarget', 'GetShaderDefHelper',
  'GetWizardParamTab', 'PPGLayoutControl', 'SDKGetScriptGenerator', 'ConnectToWorkgroupUI']);
eq('logging flags (off for the siNoLogging commands), category Custom', NAMES.filter(n => got.flags[n][0] !== NOLOG.has(n) || got.flags[n][1] !== 'Custom'), []);
eq('only ConnectToWorkgroupUI has a description', NAMES.filter(n => got.flags[n][2] !== ''), ['ConnectToWorkgroupUI']);
eq('ConnectToWorkgroupUI description', got.flags.ConnectToWorkgroupUI[2], 'Ask user to pick a workgroup and connect to it');

// ---- 2. defaults
const D = got.defaults;
eq('default arguments: the unguarded commands end in a script error, no other command raises', NAMES.filter(n => D[n] === 'ERR'),
  ['RemoveNumbering', 'AddToList', 'SelectionValueToItemName', 'GetObjectsFromSource', 'WriteCachesFile', 'RefreshCachesPathProp', 'GetShaderDefHelper']);
eq('default arguments: return values', Object.fromEntries(NAMES.filter(n => D[n] !== 'ERR').map(n => [n, D[n]])), {
  RemoveFromList: NONE, GetItemsAsString: '', ReadCachesFile: NONE, UpdateCacheManager: NONE, GetCacheOnFile: [],
  OpenOutputFormatPreferences: true, OverrideMarkedPassParameters: true, DeleteUnusedShaders: NONE, RTShaderSetCategories: true,
  LagoaEmitMPVolume: true, LagoaTagCollisionObject: NONE, LagoaDisplayType: NONE, LagoaSetupAdvectMesh: true, LagoaSetupClothMesh: true, ICEFlowInsertSimulationRoot: NONE,
  SIGetExternalFilesViewerProp: 'object:CExternalFilesViewer', SISetExternalFilesManagerTarget: NONE, ConnectToWorkgroupUI: 'promise:undefined',
  SDKGetScriptGenerator: NONE, PPGLayoutControl: 'object:LayoutControl', GetWizardParamTab: 'object:', Create_Polygonizer_Polymesh: true,
});
eq('SISetExternalFilesManagerTarget without a viewer: information log, no return value', got.setTargetNoViewer, [NONE, ['info:Error running SISetExternalFilesManagerTarget. Try re-opening the view']]);

// ---- 3. Cache Manager
const C = got.cache;
eq('RemoveNumbering', C.removeNumbering, ['Cone', 'Cone', '-1 : x', 'a:b', 'x : y', '0:']);
eq('AddToList: numbered pairs appended, page refreshed, no return value', C.add1, [NONE, ['0 : Cone', '0:', '1 : Cube', '1:'], 1]);
eq('AddToList: existing texts skipped unless multiInstance, duplicates inside the array kept', C.add2, [['0 : Cone', '0:', '1 : Cube', '1:', '2 : Sphere', '2:', '3 : Sphere', '3:', '4 : Cone', '4:'], 3]);
eq('GetItemsAsString: un-numbered labels joined by ","; unreadable item gives ""', C.items, ['Cone,Cube,Sphere,Sphere,Cone', '', '']);
eq('SelectionValueToItemName: labels with their number, unmatched values skipped', C.selToName, ['1 : Cube', '0 : Cone']);
eq('SelectionValueToItemName: a missing item is a script error', C.selToNameMissing, true);
eq('RemoveFromList: empty selection leaves the list alone, no refresh', C.removeEmpty, [10, 0]);
eq('RemoveFromList: selected values removed, the rest renumbered, refreshed', C.remove1, [NONE, ['0 : Cone', '0:', '1 : Sphere', '1:', '2 : Cone', '2:'], 1]);
eq('RemoveFromList: a null selection reads the inspected object\'s parameter', C.remove2, ['0 : Sphere', '0:', '1 : Cone', '1:']);
eq('RemoveFromList: failures are swallowed', C.removeBad, NONE);
eq('GetObjectsFromSource: source, cache clips, driven objects', C.objs1, ['Sources.src', 'Mixer.Clip1;Mixer.Clip3', 'cube;sphere;cone']);
eq('GetObjectsFromSource: a scanned mixer is not read again', C.objsStale, C.objs1);
eq('GetObjectsFromSource: no clip known gives two empty strings', [C.objsUnknown, C.objsNoMixer], [['Sources.other', '', ''], ['lone', '', '']]);
eq('WriteCachesFile: file layout, pieces not trimmed, no return value, logged', C.write,
  [NONE, '[General]\r\nStart=1\r\nEnd=100\r\nStep=2\r\nType=Custom\r\nPath=C:\\cache\\[object]\r\n[Parts]\r\ncube=cube\r\n sphere= sphere\r\ncone=cone\r\n', 0, 1]);
eq('WriteCachesFile: unwritable path and non-string objects are script errors', [C.writeBadPath, C.writeBadObjects], [true, true]);
eq('ReadCachesFile: does nothing', C.read, [NONE, 'keep']);
eq('RefreshCachesPathProp: no instance is a script error', C.refreshNoInstance, true);
eq('UpdateCacheManager: nothing happens without a Cache Manager view', C.updateNoView, [NONE, true, true]);
eq('UpdateCacheManager: targetcontent of the five sub-views, other views untouched', C.update1,
  [NONE, { WriteAnimationTab: '', ReadAnimationPPG: '', CachesPathPPG: 'Scene Animation Cache Path', SimulationPPG: '', CacheOnFilePPG: 'Scene Simulation Cache on File nodes' }, 0]);
eq('UpdateCacheManager: scene objects by name, cacheppg set, instances reused', C.update2,
  [{ WriteAnimationTab: 'WriteAnimation', ReadAnimationPPG: 'ReadAnimation', CachesPathPPG: 'Scene Animation Cache Path', SimulationPPG: 'Environments.Environment.simtimectrl', CacheOnFilePPG: 'Scene Simulation Cache on File nodes' }, true, true]);
eq('CachesPathProp: name, type, grid columns', [C.pathProp.name, C.pathProp.type, C.pathProp.columns], ['Scene Animation Cache Path', 'CachesPathProp', ['Objects', 'User Path (Usr)', 'Valid', 'Resolved Path (Res)', 'Guid', 'Source', 'Clip']]);
eq('CachesPathProp: layout', C.pathProp.layout, ['group', 'button:BntSelectSceneObjects=Select Scene Objects', 'button:BntOpenMixer=Open Mixer', 'button:BntBrowse=Browse Selected Path', 'button:BntSearchAndReplace=Search and Replace',
  'button:BntDelete=Delete Sources/Clips', 'button:BntDeleteUnusedSource=Delete Unused Sources', 'endgroup', 'item:CachePathGrid']);
eq('CachesPathProp: grid and button attributes', [C.pathProp.gridAttrs, C.pathProp.buttonAttrs, C.pathProp.lastButtonAttrs],
  [{ control: 'siControlGrid', siUINoLabel: true, siUIGridSelectionMode: 'siSelectionHeader', siUIGridReadOnlyColumns: '1:0:1:1:1:1:1', siUIGridHideColumns: '1:1:1:1:0:0:0' }, { siUICX: 130, siUIContinue: true }, { siUICX: 130 }]);
eq('RefreshCachesPathProp: one row per owned Caches file; tables discarded', C.refresh, [NONE,
  [['Model.cube', '$PROJ\\a.icecache', 'valid', 'C:\\cache\\a.icecache', '{G1}', 'Sources.srcA', 'Mixer.CacheClip'],
    ['', 'C:\\cache\\gone.icecache', 'invalid', 'C:\\cache\\gone.icecache', '{G3}', 'Sources.srcB', ''],
    ['Model.cube', null, 'valid', 'C:\\cache\\seq.1.icecache', '{G5}', 'Sources.srcA', 'Mixer.CacheClip']],
  ['    ', '', ''], [[166, 168, 171], [184, 137, 137], [166, 168, 171]], null, null]);
eq('GetCacheOnFile: read-mode "Cache on File" nodes, node containers walked', C.cacheOnFile, ['n1', 'n4']);
eq('CacheOnFileListProp', C.onFileProp, { name: 'Scene Simulation Cache on File nodes', type: 'CacheOnFileListProp', columns: ['Cache On File', 'Resolved Path (Res)'],
  rows: [['n1', 'C:\\c\\n1.icecache'], ['n4', 'C:\\c\\n4.icecache']], layout: ['group:Cache On File nodes', 'button:BntSelectSceneObjects=Inspect', 'item:CachePathGrid', 'endgroup'] });

// ---- 4. Render Manager
const R = got.render;
eq('OpenOutputFormatPreferences: property page on preferences.output_format, returns true', R.openPrefs, [true, 'preferences.output_format', 'InspectObj']);
eq('OverrideMarkedPassParameters: empty selection', R.noSel, [true, ['info:WARNING : Please select a pass global renderer']]);
eq('OverrideMarkedPassParameters: not a property', R.objectSel, [true, ['info:WARNING : Please select a pass global renderer']]);
eq('OverrideMarkedPassParameters: nothing marked', R.noMarking, [true, ['info:WARNING : Please mark some parameters on pass global renderer']]);
eq('OverrideMarkedPassParameters: the property is not under a pass', R.notPass, [true, ['info:WARNING : Please select a pass global renderer'], true]);
ok('OverrideMarkedPassParameters: PassOverride added to the pass, one entry per marked parameter, page opened', R.ok[0] === true && R.ok[1] === 'PassOverride' && R.ok[2] === 'Override' && R.ok[3] && R.ok[4]
  && JSON.stringify(R.ok[5]) === JSON.stringify(['AddProp', 'SIAddEntryToOverride', 'SIAddEntryToOverride', 'InspectObj']) && R.ok[6] && R.ok[7].length === 0, R.ok);
eq('OverrideMarkedPassParameters: an existing PassOverride is reused', R.reuse, [true, 2]);

// ---- 5. RTUserTools
const U = got.rt;
eq('DeleteUnusedShaders: a container of another type is skipped silently', U.skipOther, [NONE, [], []]);
eq('DeleteUnusedShaders: a connected render tree is left alone', U.buildMaterial, [NONE, true, []]);
eq('DeleteUnusedShaders: unconnected trees deleted root first, comments kept, unused clips deleted', U.loose,
  [NONE, ['s1', 'note'], ['clipA'], ['s3', 's2', 'clipB'], [['DisconnectAndDeleteOrUnnestShaders', ['s3', 'Mat']], ['DisconnectAndDeleteOrUnnestShaders', ['s2', 'Mat']], ['DisconnectAndDeleteOrUnnestShaders', ['clipB', 'Mat']]]]);
eq('DeleteUnusedShaders: a light under a light uses the parent; the clip pass passes the original argument', U.lightParent, [['u'], ['clipL'], [['u', 'LightRoot'], ['clipL', 'LightRoot.light']]]);
eq('DeleteUnusedShaders: in a compound, shaders fed by its inputs are skipped', U.compound, [['fed', 'viaFed'], ['free']]);
eq('RTShaderSetCategories: XSI_NO_DEFAULT_SHADERS set does nothing and returns nothing', U.catOff, [NONE, 0, 'old']);
ok('RTShaderSetCategories: returns true; one error per missing definition, nothing else logged', U.cat.res === true && U.cat.errors === U.cat.logLines && U.cat.errors > 0 && U.cat.errors < 230 && U.cat.missingLogged, U.cat);
eq('RTShaderSetCategories: category, display name, thumbnail', [U.cat.blinn, U.cat.phong, U.cat.phongThumb], [['Illumination@100/@100', 'Blinn', 'ML_blinn_apple.bmp'], 'Illumination@100/@100', 'ML_phong_apple.bmp']);
eq('RTShaderSetCategories: strip rules M and T, a row without display name or thumbnail', [U.cat.math, U.cat.checker, U.cat.vdm],
  [['Processing@400/Math/@100', 'Color Basic', 'Math.bmp'], ['Texture Generators@500/@100', 'Checkerboard', 'checker.bmp'], ['Texture@100/@300', 'VDM', null]]);

// ---- 6. Lagoa / ICE flow
const L = got.ice;
eq('LagoaEmitMPVolume: no polygon mesh', L.emitNone, [true, ['info:WARNING : No polymesh objects in selection']]);
eq('LagoaEmitMPVolume: returns true, point cloud created', [L.emit2.res, L.emit2.cloudType], [true, 'pointcloud']);
eq('LagoaEmitMPVolume: call order', L.emit2.order, ['GetPrim', 'AddProp', 'SetValue', 'CreateSimulatedICETree', 'AddICECompoundNode', 'AddPortToICENode', 'AddICENode', 'SetValue', 'ConnectICENodes', 'AddICENode', 'SetValue', 'ConnectICENodes']);
eq('LagoaEmitMPVolume: wire colour, compounds in order', [L.emit2.wire, L.emit2.compounds], [[['wirecolorr', 0.2], ['wirecolorg', 0.3], ['wirecolorb', 1]],
  ['Lagoa Emit Volume', 'Lagoa Simulate Multiphysics', 'Lagoa Main Material', 'Lagoa Add Forces', 'Lagoa Phase']]);
eq('LagoaEmitMPVolume: ports for two meshes (n + 2 on the tree, n - 1 on the emit compound)', [L.emit2.ports, L.emit2.portMode],
  [['port1', 'port2', 'port3', 'port4', 'Lagoa_Emit_Volume.Emitter In Name1'], ['siNodePortDataInsertionLocationAfter']]);
eq('LagoaEmitMPVolume: one get-data node per mesh, logged, same destination', [L.emit2.getData, L.emit2.refs, L.emit2.infos, L.emit2.connects.slice(0, 2)],
  [2, ['lagA', 'lagB'], ['info:lagA', 'info:lagB'], [['Lagoa_Emit_Volume.Emitter_In_Name', 'GetData.outname'], ['Lagoa_Emit_Volume.Emitter_In_Name', 'GetData.outname']]]);
eq('LagoaEmitMPVolume: the five fixed connections, Port4 left free', L.emit2.connects.slice(2), [['Port1', 'Lagoa_Emit_Volume.Execute'], ['Port2', 'Lagoa_Add_Forces.Execute'], ['Port3', 'Lagoa_Phase.Execute'],
  ['Lagoa_Phase.Execute1', 'Lagoa_Main_Material.Execute'], ['Port5', 'Lagoa_Simulate_Multiphysics.Execute']]);
eq('LagoaEmitMPVolume: one mesh adds four ports; the missing parts are logged "not yet attested"', [L.emit1Ports, L.emit2.nya], [4, true]);
eq('LagoaTagCollisionObject: nothing to tag still opens the page and warns', L.tagNone, [NONE, 1, '', ['info:WARNING : Objects tagged! Make sure these objects are added to the collision ports on the Lagoa Framework']]);
eq('LagoaTagCollisionObject: tree, compound, connection, log per polygon mesh', L.tag, [NONE, ['ApplyOp', 'AddICECompoundNode', 'ConnectICENodes', 'InspectObj'], true, [['Port1', 'Lagoa_Set_Collision_Data.Execute']],
  ['info:Object -->lagB tagged with Set Collision Data node, inspect ICEtree', 'info:WARNING : Objects tagged! Make sure these objects are added to the collision ports on the Lagoa Framework'], true]);
eq('LagoaDisplayType: a cloud without "Particle Display" is a script error', L.displayNoProp, true);
eq('LagoaDisplayType: displaytype = arg2, pointsize = arg1, point clouds only', L.display, [NONE, { Name: 'Particle Display', displaytype: 3, pointsize: 7 }, 1]);
eq('LagoaDisplayType: defaults 1, 1', L.displayDefaults, [1, 1]);
eq('LagoaSetupAdvectMesh: nothing selected', L.advectNone, [true, ['error:You need to Select a Polygon Mesh Object !'], 0]);
eq('LagoaSetupAdvectMesh: tree created and deleted, then the preset command', [L.advect[0], L.advect[1], L.advect[2]], [true, 0, [['CreateSimulatedICETree', 'bus'], ['DeleteObj', 'stand-in'], ['ICEFlow_CreateParticlesFromPreset', 'missing']]]);
eq('LagoaSetupAdvectMesh: preset arguments, first geometry', [L.advect[3], L.advect[4]], [['Lagoa Setup Advect Mesh', 'Execute', 'Emitter In Name', 'Passive Body In Name', false, null, false, false], ['advCube', 'siNode']]);
eq('LagoaSetupClothMesh: nothing selected does nothing', L.clothNone, [true, 0]);
eq('LagoaSetupClothMesh: ResetTransform on the selection, then the preset command', L.cloth, [true, [['ResetTransform', ['', 'siCtr', 'siSRT', 'siXYZ'], 'bus'],
  ['ICEFlow_CreateParticlesFromPreset', ['Lagoa Setup Cloth Mesh', 'Execute', ' ', 'Passive Body In Name', false], 'missing']], 0]);
eq('ICEFlowInsertSimulationRoot: the build\'s ICE tree is "not yet attested"', L.rootBuildTree, [NONE, true, NONE]);
eq('ICEFlowInsertSimulationRoot: returns true, global back to 99', [L.root1[0], L.root1[2], L.root1[4]], [true, 99, 0]);
eq('ICEFlowInsertSimulationRoot: root ports after the insert', L.root1[1].ports, [['Port1', 'Simulation_Root.Execute'], ['Port2', null], ['Port3', null], ['Port4', null], ['Port5', null], ['Port6', null], ['Port7', 'State_Machine.Execute']]);
eq('ICEFlowInsertSimulationRoot: Simulation Root inputs (Execute before the simulate port, PostSimExecute after, a port added when all are taken)', L.root1[1].root,
  [['Emitter', 'Emit_from_Surface.Emit'], ['Forces', 'Add_Forces.Execute'], ['Simulate', 'Simulate_Particles.simulate'], ['Execute', 'My_Node.Execute'], ['PostSimExecute', 'Post.Out'], ['PostSimExecute1', 'Post2.Out']]);
eq('ICEFlowInsertSimulationRoot: a second run on the same tree changes nothing', L.root1Again, [true, 1, true]);
eq('ICEFlowInsertSimulationRoot: a tree given by name', L.rootByName, true);
eq('ICEFlowInsertSimulationRoot: first port not fed by Emit: warning, no return value, compound left unconnected', L.rootNoEmit,
  [NONE, ['info:WARNING : Unable to connect Simulation Root as no Emit output plugged in to the ICETree node'], { ports: [['Port1', 'Thing.Execute'], ['Port2', null]],
    root: [['Emitter', null], ['Forces', null], ['Simulate', null], ['Execute', null], ['PostSimExecute', null]] }, 99]);
eq('ICEFlowInsertSimulationRoot: a root exists but is not on the first port: stops silently', L.rootFoundNotFirst, [NONE, 0, 2]);
eq('ICEFlowInsertSimulationRoot: the emitter path is built from the node type; when it does not resolve the tree port stays', L.rootTypePath,
  [true, { ports: [['Port1', 'Emitter_A.Emit'], ['Port2', null]], root: [['Emitter', null], ['Forces', null], ['Simulate', null], ['Execute', null], ['PostSimExecute', null]] }]);

// ---- 7. External Files Manager
const E = got.ext;
eq('SIGetExternalFilesViewerProp: one instance', E.same, true);
eq('viewer: name, type, parameters', [E.prop.name, E.prop.type, E.prop.params], ['External Files Manager', 'CExternalFilesViewer',
  [['Target', 'string', 'Scene', true], ['FileType', 'string', 'All', false], ['ShowRecords', 'string', 'All', false], ['Validateondisk', 'bool', true, false], ['RefreshMe', 'bool', false, false], ['Files', 'string', '', true], ['FilesCache', 'string', '', true]]]);
eq('viewer: grids', [E.prop.columns, E.prop.fixedColumns, E.prop.cacheColumns, E.prop.rowLabel], [9, ['Guid', 'Reference', 'Local To Project'], 1, '    ']);
eq('viewer: layout', E.layout, ['group', 'item:Target=External Files For: ', 'endgroup', 'row', 'group:Options', 'enum:FileType', 'item:Validateondisk=View Resolved Paths', 'enum:ShowRecords=Grid size', 'endgroup',
  'group:Actions', 'row', 'button:BntBrowse=Browse Selected Path...', 'button:BntSearchAndReplace=Search and Replace...', 'endrow', 'row', 'button:BntSort=Sort Selected Column', 'button:BntCopyUnderProject=Copy Files to Project...', 'endrow', 'endgroup',
  'group:Cleanup', 'button:BntDeleteAllMat=Delete Unused Materials', 'button:BntDeleteImagesSourcesAndClips=Delete Unused Image Sources and Clips', 'button:BntDeleteAnimationSources=Delete Unused Animation Sources',
  'button:BntDeleteAudioSources=Delete Unused Audio Sources', 'button:BntDeleteCacheSources=Delete Unused Cache Sources', 'endgroup', 'button:BntHelp=Help', 'endrow', 'item:Files']);
eq('viewer: control attributes', E.layoutAttrs, [{ control: 'siControlGrid', siUINoLabel: true, siUIGridSelectionMode: 'siSelectionHeader', siUIGridReadOnlyColumns: '0:1:1:0:1:1:1:1:1', siUIGridHideColumns: '1:1:1:1:0:0:1:0:0' },
  ['All', 'All', 'Actions', 'Actions', 'Audio', 'Audio', 'Caches', 'Caches', 'Deltas', 'Deltas', 'Models', 'Models', 'Material Lib', 'MatLib', 'Pictures', 'Pictures', 'Render_Pictures', 'Render_Pictures', 'Scenes', 'Scenes', 'Scripts', 'Scripts',
    'Synoptic', 'Synoptic', 'Thumbnails', 'Thumbnails'], ['Show All', 'All', '10', 10, '25', 25, '50', 50], { siUICX: 130 }, { siUICX: 210 }, { siUILabelPercentage: 20 }]);
const PROJ = 'C:\\Users\\user\\Autodesk\\Softimage_2015_SP2\\Data\\XSI_SAMPLES';
eq('viewer: grid fill at definition time', E.fill, [[
  ['Pictures\\in.png', 'Pictures', 'valid', `${PROJ}\\Pictures\\in.png`, 'Alienbrain is not installed', '{E1}', 'Clips.in_png', false, true],
  ['D:\\ref\\m.emdl', 'Models', 'invalid', 'D:\\ref\\m.emdl', 'Alienbrain is not installed', '{E2}', 'RefModel,Other (ref lock)', true, false]],
  [[166, 168, 171], [184, 137, 137]], [['Pictures\\in.png'], ['D:\\ref\\m.emdl']]]);
eq('viewer: a change while the page is closed does not refill', E.closedNoRefill, `${PROJ}\\Pictures\\in.png`);
eq('viewer: without "View Resolved Paths" the resolved path and Alienbrain cells are "?"', E.noValidate, [[['?', '?'], ['?', '?']]]);
eq('viewer: FileType filter refills and refreshes the open page', E.filter, [['D:\\ref\\m.emdl'], 2]);
eq('SISetExternalFilesManagerTarget: a target text is written to Target', [E.setTarget[0], E.setTarget[1]], [NONE, 'NoSuchModel']);
eq('SISetExternalFilesManagerTarget: a model target lists the model\'s files', E.modelTarget, ['MyModel', ['D:\\ref\\m.emdl']]);
eq('SISetExternalFilesManagerTarget: empty target, stale Target reset to Scene, RefreshMe flipped', E.emptyTarget, [NONE, 'Scene', true, 2]);
eq('SISetExternalFilesManagerTarget: empty target, valid Target kept, RefreshMe flipped', E.emptyTargetOk, ['Scene', true]);
eq('viewer: grid height from ShowRecords (21 x n + 21, none for All or fewer rows)', E.height, [231, null, null, 14]);
eq('viewer: opening the page resets a Target that no longer resolves', E.openResets, 'Scene');

// ---- 8. ConnectToWorkgroupUI
const W = got.wg;
eq('ConnectToWorkgroupUI: not usable in batch', W.batch, true);
eq('ConnectToWorkgroupUI: dialog', W.dialog, { promise: true, title: 'Connect to Workgroup', prop: true, params: ['Directory'], text: 'Pick the root location of an existing workgroup', control: 'folder', hasLabel: false, value: '', exampleButton: false });
eq('ConnectToWorkgroupUI: cancel and empty directory return nothing; the property is deleted', [W.cancel, W.emptyDir], [['undefined', true], 'undefined']);
eq('ConnectToWorkgroupUI: missing folder shows the message and reopens the dialog with the last path', [W.missing, W.reopened], [['This workgroup directory does not exist\nC:\\wg\\missing', false], [true, 'C:\\wg\\missing']]);
eq('ConnectToWorkgroupUI: connects, warns (7164), refreshes the Plug-in Manager, returns the path', W.ok, ['C:\\wg\\studio', ['C:\\wg\\studio'], '', 1, true, 'C:\\wg\\studio']);
eq('ConnectToWorkgroupUI: a workgroup already in the list', [W.prefilled, W.duplicateMsg, W.duplicate], ['C:\\wg\\studio', 'This workgroup is already in the list', ['', 1]]);
eq('ConnectToWorkgroupUI: AddWorkgroup raising shows the error description and returns ""', [W.addFailsMsg, W.addFails], [true, ['', 1]]);
eq('ConnectToWorkgroupUI: SDK example workgroup button', [W.example, W.exampleCopied, W.exampleOk, W.exampleGone, W.leftOver], [['Try SDK Example Workgroup', true], true, true, true, 0]);

// ---- 9. SDKGetScriptGenerator
const S = got.gen;
eq('SDKGetScriptGenerator: unknown language returns nothing; PerlScript is a script error', S.unknown, [NONE, NONE, true]);
eq('writer text: JScript', S.text.JScript, `function F( a,b )\n{\n${T}var x,y;\n${T}var r = g(1,null,2);\n${T}h();\n${T}o.M(a);\n${T}o.P = 5;\n${T}r = o.P;\n${T}// c1\n${T}// c2\n${T}Application.LogMessage("hi",siVerbose);\n${T}return r;\n}\n\nfunction S( in_ctxt )\n{\n}\n\n`);
eq('writer text: Cpp', S.text.Cpp, `SICALLBACK F( CValue a,int b )\n{\n${T}CValue x;\n${T}int y;\n${T}int r = g(1,null,2);\n${T}h();\n${T}o.M(a);\n${T}o.PutP(5);\n${T}T CValue r = o.GetP();\n${T}// c1\n${T}// c2\n${T}Application().LogMessage("hi",siVerboseMsg);\n${T}return r;\n}\n\nSICALLBACK S( CRef& in_ctxt )\n{\n${T}Context ctxt( in_ctxt );\n}\n\n`);
eq('writer text: C#', S.text['C#'], `${T}public bool F( CValue a,int b )\n${T}{\n${T}${T}CValue x = null;\n${T}${T}int y = null;\n${T}${T}int r = g(1,null,2);\n${T}${T}h();\n${T}${T}o.M(a);\n${T}${T}o.P = 5;\n${T}${T}CValue r = (T)o.P;\n${T}// c1\n${T}// c2\n${T}${T}Log("hi");\n${T}${T}return r;\n${T}}\n\n${T}public bool S( Context in_ctxt )\n${T}{\n${T}}\n\n`);
eq('writer text: VBScript', S.text.VBScript, `function F( a,b )\n${T}dim x,y\n${T}dim r : r = g(1,,2)\n${T}h\n${T}o.M a\n${T}set o.P = 5\n${T}set CValue r = o.P\n${T}' c1\n${T}' c2\n${T}Application.LogMessage "hi",siVerbose\n${T}set F = r\nend function\n\nfunction S( in_ctxt )\nend function\n\n`);
eq('writer text: Python', S.text.Python, `def F( a,b ):\n${T}r = g(1,null,2)\n${T}h()\n${T}o.M(a)\n${T}o.P = 5\n${T}CValue r = o.P\n${T}# c1\n${T}# c2\n${T}Application.LogMessage("hi",constants.siVerbose)\n${T}return r\n\ndef S( in_ctxt ):\n\n`);
const PE = 'Prefix is not defined. Prefix should be the name of the enum. C# needs it';
eq('writer members', S.small, {
  JScript: ['SDK Script Generator', 'JScript', '"s"', 'true', 'false', 'true', ' | ', 'c', PE, 'a + b', 'e', '\t\t'],
  Cpp: ['SDK Script Generator', 'Cpp', 'L"s"', 'true', 'false', 'CStatus::OK', ' | ', 'c', PE, 'a + b', 'e', '\t\t'],
  'C#': ['SDK Script Generator', 'C#', '"s"', 'true', 'false', 'true', ' | ', 'P.c', PE, 'a + b', 'e', '\t\t'],
  VBScript: ['SDK Script Generator', 'VBScript', '"s"', 'True', 'False', 'true', ' OR ', 'c', PE, 'a & b', 'cstr(e)', '\t\t'],
  Python: ['SDK Script Generator', 'Python', '"s"', 'True', 'False', 'true', ' + ', 'constants.c', PE, 'str(a) + str(b)', 'str(e)', '\t\t'],
});
eq('StripType / StripVar / BeginClass / EndClass', S.strip, ['x', true, ['x', 5, 'y'], 'int', 7, '', '']);
eq('one buffer for all writers', S.shared, ['one;two', 'one;two']);
eq('no arguments, a string argument list, no declare, a single declaration', S.noArgs, ['function f( )\n{\n', 'def f( ):\n', '\tf(a, b);\n', '\tr = f(x);\n', '\tvar z;\n']);
eq('FnCall with an argument that is not null, a string or an array', S.badArgs, ['\tr = g();\n', '\tr = g();\n', '\t\tr = g();\n', '\tr = g()\n', '\tr = g()\n',
  ['info:Error call to JS_FnCall r g 5', 'info:Error call to CPP_FnCall r g 5', 'info:Error call to CS_FnCall r g 5', 'info:Error call to Python_FnCall r g 5']]);
eq('C#: BeginClass / EndClass, OMCall with a null object, OMReadProp without a cast', S.csharp, ['\npublic class A : B\n{\n\npublic class C\n{\n}\n', '\t\tr = M(a);\n', '\t\tr = o.P;\n']);
eq('VBScript: BeginSub / EndSub, null and trailing null arguments, set, EndFn without a value', S.vb, ['sub S( a )\nend sub\n\n', '\tf a,,b\n', '\tset r = f(a)\n', 'end function\n\n', '\to.P = 1\n']);
eq('Cpp: BeginLocalFn, OMReadProp without a type, FnCall without arguments', S.cpp, ['void L( int a )\n{\n', '\tr = o.GetP();\n', '\tr = f();\n']);
eq('HLSL: template names', S.hlsl.templ, ['rtshader_uiparam_decl.hlsl.template', 'rtshader_color_uiparam_decl.hlsl.template', 'rtshader_texture_uiparam_decl.hlsl.template', 'rtshader_semantic_param_decl.hlsl.template',
  'rtshader_sas_param_decl.hlsl.template', 'rtshader_global_decl.hlsl.template', 'rtshader_shaderfunc_decl.hlsl.template', 'rtshader_matrix_decl.hlsl.template', 'rtshader_uiparam_nominmax_decl.hlsl.template', '.fx']);
eq('CGFX: differs in the shader function template and the extension', S.hlsl.cgfx, ['rtshader_shaderfunc_decl.cgfx.template', '.cgfx']);
eq('HLSL: StructMember', S.hlsl.struct, ['float4 position : POSITION0;', 'float4 normal : NORMAL;', 'float4 color : COLOR0;', 'float4 binormal : BINORMAL0;', 'float4 tangent : TANGENT0;', 'float4 texcoord3 : TEXCOORD3;', 'undefined HLSL struct data member;']);
eq('HLSL: no object-model calls, LogMessage cannot be used', [S.hlsl.noCalls, S.hlsl.logFails, S.hlsl.misc], [['undefined', 'undefined', 'undefined', 'undefined'], true, ['true', ' | ', 'e', 'a + b', 'HLSL', 'CGFX']]);
eq('HLSL: Comment / VarDecl / BeginFn / EndFn / BeginLocalFn as in the Cpp writer', S.hlsl.text, '// c\n\tfloat x;\nSICALLBACK f( float a )\n{\n\treturn x;\n}\n\nfloat g( )\n{\n');

// ---- 10. PPGLayoutControl
const P = got.lc;
eq('PPGLayoutControl: Type, updateList on an empty layout', [P.type, P.updateEmpty], ['LayoutControl', false]);
eq('addParameter', P.add1, [true, 'a', ['a', 'a', '', '']]);
eq('addParameter: the final empty pair addresses the end; nothing selected lands before the last entry', [P.add2, P.addUnselected], ['a|b', 'a|c|b']);
eq('addGroup: two adjacent markers before the selection; labels and values', P.group, [true, 'a|G:G1|g:G1|c|b', ['a', 'a', 'Group "G1" {', 'G1', '}', 'G1_1', 'c', 'c', 'b', 'b', '', '']]);
eq('addGroup: duplicate and empty names', P.groupDup, [false, false, ['info:WARNING : LayoutControl: A Group with the same name already exists.']]);
eq('addRow: first unused row name', P.row, [true, 'a|G:G1|g:G1|c|R:row0|r:row0|b']);
eq('addTab: wraps the range between the neighbouring tabs', [P.tab[0], P.tab[1]], [true, 'T:T1|a|G:G1|g:G1|c|R:row0|r:row0|b|t:T1']);
eq('list box: indentation, unique labels, unique values, final empty pair', P.tab[2], ['Tab "T1" {', 'T1', '  a', 'a', '  Group "G1" {', 'G1', '  }', 'G1_1', '  c', 'c', '  Row {', 'row0', '  } ', 'row0_1', '  b', 'b', '}', 'T1_1', '', '']);
eq('addTab: inside another tab, duplicate, empty', P.tabInside, [false, false, false, false, ['info:WARNING : LayoutControl: A new Tab cannot be enclosed in another Tab.', 'info:WARNING : LayoutControl: A Tab with the same name already exists.']]);
eq('moveSelected: swaps with the neighbour', P.move, [true, 'T:T1|a|G:G1|g:G1|R:row0|c|r:row0|b|t:T1', 'c']);
eq('moveSelected: marker onto marker, other directions, out of the list, no selection; deleteSelected without a selection', [P.moveMarker, P.moveOut, P.moveNoSel], [[false, false, false], false, [false, false]]);
eq('getLayout', P.layout, ['Tab "T1"', '{', '  a;', '  Group "G1"', '  {', '  }', '  Row', '  {', '    c;', '  }', '  b;', '}']);
eq('getLayoutRawData', P.raw, [{ type: 'T', id: 'T1' }, { type: '', id: 'a' }, { type: 'G', id: 'G1' }]);
eq('deleteSelected: a marker goes with its partner; the entry at the old position is selected', P.deleteMarker, [true, 'T:T1|a|R:row0|c|r:row0|b|t:T1', 'row0']);
eq('updateList: parameters not in the list are removed, markers stay', P.update, [true, 'T:T1|a|R:row0|c|r:row0|t:T1', false]);
eq('deleteSelected: nothing at the old position or before it selects the first entry', P.deleteLast, [true, 'a|R:row0|c|r:row0', 'a']);
eq('deleteSelected: unmatched marker warns through the given reporter only', P.unmatched, [true, 'a', ['LayoutList_FindPartner: Unmatched grouping!'], 0]);
const TIP = `// Tip: Use the "Refresh" option on the Property Page context menu to \n// reload your script changes and re-execute the DefineLayout callback.\n`;
const jsHead = `${TIP}function MyProp_DefineLayout( in_ctxt )\n{\n${T}var oLayout,oItem;\n${T}oLayout = in_ctxt.Source;\n${T}oLayout.Clear();\n`;
const gridBlockJs = `${T}oLayout.AddGroup("g");\n${T}oItem = oLayout.AddItem("g");\n${T}oItem.SetAttribute(siUIValueOnly,true);\n${T}oLayout.EndGroup();\n`;
eq('generateLayoutMethod: JScript, layout with tab / group / row', P.genJs, `${jsHead}${T}oLayout.AddTab("Main");\n${T}oLayout.AddGroup("Grp");\n${T}oLayout.AddItem("a");\n${T}oLayout.EndGroup();\n${T}oLayout.AddRow();\n${T}oLayout.AddColor("c_R","c",true);\n${T}oLayout.EndRow();\n${T}return true;\n}\n\n`);
eq('generateLayoutMethod: a layout parameter that is not in the grid', P.genWarned, ['Unexpected: parameter ghost found in layout but not in parameter list']);
eq('generateLayoutMethod: empty layout lists every grid row', P.genJsEmpty, `${jsHead}${T}oLayout.AddItem("a");\n${T}oLayout.AddColor("c_R","c",true);\n${T}oLayout.AddButton("b");\n${gridBlockJs}${T}return true;\n}\n\n`);
eq('generateLayoutMethod: C#', P.genCs, `${TIP}${T}public bool DefineLayout( Context in_ctxt )\n${T}{\n${T}${T}PPGLayout oLayout = null;\n${T}${T}PPGItem oItem = null;\n${T}${T}oLayout = (PPGLayout)in_ctxt.Source;\n${T}${T}oLayout.Clear();\n${T}${T}oLayout.AddGroup("Grp",true,0);\n${T}${T}oLayout.AddButton("b",null);\n${T}${T}oLayout.AddGroup("g",true,0);\n${T}${T}oItem = oLayout.AddItem("g",null,null);\n${T}${T}oItem.SetAttribute(siPPGItemAttribute.siUIValueOnly,true);\n${T}${T}oLayout.EndGroup();\n${T}${T}oLayout.EndGroup();\n${T}${T}return true;\n${T}}\n\n`);
eq('generateLayoutMethod: VBScript', P.genVb, `' Tip: Use the "Refresh" option on the Property Page context menu to \n' reload your script changes and re-execute the DefineLayout callback.\nfunction MyProp_DefineLayout( in_ctxt )\n${T}dim oLayout,oItem\n${T}set oLayout = in_ctxt.Source\n${T}oLayout.Clear\n${T}oLayout.AddItem "a"\n${T}MyProp_DefineLayout = true\nend function\n\n`);
eq('generateLayoutMethod: Python', P.genPy, `# Tip: Use the "Refresh" option on the Property Page context menu to \n# reload your script changes and re-execute the DefineLayout callback.\ndef MyProp_DefineLayout( in_ctxt ):\n${T}oLayout = in_ctxt.Source\n${T}oLayout.Clear()\n${T}oLayout.AddGroup("g")\n${T}oItem = oLayout.AddItem("g")\n${T}oItem.SetAttribute(constants.siUIValueOnly,True)\n${T}oLayout.EndGroup()\n${T}return true\n\n`);
eq('generateLayoutMethod: Cpp', P.genCpp, `${TIP}SICALLBACK MyProp_DefineLayout( CRef& in_ctxt )\n{\n${T}Context ctxt( in_ctxt );\n${T}PPGLayout oLayout;\n${T}PPGItem oItem;\n${T}oLayout = ctxt.GetSource();\n${T}oLayout.Clear();\n${T}oLayout.AddItem(L"a");\n${T}oLayout.AddButton(L"b");\n${T}return CStatus::OK;\n}\n\n`);
eq('generateLayoutMethod: Cpp with a grid parameter fails on the missing prefix', P.genCppGrid, `ERR:${PE}`);

// ---- 11. GetWizardParamTab
const Z = got.wpt;
eq('GetWizardParamTab: object, AddParameters', [Z.params.type, Z.params.helper, Z.params.columns, Z.params.ParamType, Z.params.ParamName],
  ['CustomProperty', 'WizardHelperObj', ['Type', 'Name', 'Callback', 'Read-Only', 'Animatable', 'Keyable', 'Default', 'Min', 'Max', 'UIMin', 'UIMax'], 'siInt4', 'Param']);
eq('AddParameters: defaults and ranges', [Z.params.defaults, Z.params.ranges], [[true, true, false, false, false, false, 0, 100, 100, 255, 255, 1, 1, 0], [[null, null, -500, 500], [0, 255, 0, 255], [null, null, -1, 1], [0, 1, 0, 1]]]);
eq('BuildParamTabLayout: integer type, no parameters yet', Z.layoutInt, ['tab:Add Parameter', 'group:Define Item', 'enum:ParamType', 'item:ParamName=Name/Label', 'item:ReadOnly', 'item:Animatable', 'item:Keyable', 'item:Callback',
  'item:DefaultInt4=Default', 'group:Value Range', 'item:MinInt4=Min', 'item:MaxInt4=Max', 'endgroup', 'group:UI Value Range', 'item:UIRange', 'item:UIMinInt4=UI Min', 'item:UIMaxInt4=UI Max', 'endgroup', 'endgroup',
  'group:Parameters', 'row', 'button:AddParam=Add Item', 'button:RemoveParam=Delete Selected', 'endrow', 'text=No parameters defined', 'endgroup', 'button:Generate2=Generate It']);
eq('BuildParamTabLayout: button type with parameters', Z.layoutButton, ['tab:Add Parameter', 'group:Define Item', 'enum:ParamType', 'item:ParamName=Name/Label', 'item:Callback', 'endgroup',
  'group:Parameters', 'row', 'button:AddParam=Add Item', 'button:RemoveParam=Delete Selected', 'endrow', 'item:Params=', 'endgroup', 'button:Generate2=Generate It'].map(x => x === 'item:Params=' ? 'item:Params' : x));
eq('BuildParamTabLayout: text type for a custom primitive has no Callback', Z.layoutString.slice(2, 8), ['enum:ParamType', 'item:ParamName=Name/Label', 'item:ReadOnly', 'item:Animatable', 'item:Keyable', 'item:DefaultString=Default']);
eq('BuildParamTabLayout: colour control', Z.layoutColor, ['color:DefaultColorR=Default']);
eq('type combo', Z.comboProp, ['Boolean', 'siBool', 'Button', 'Button', 'Color (with Alpha)', 'Color', 'Double Precision Number', 'siDouble', 'Floating Point Number', 'siFloat', 'FCurve', 'FCurve', 'Grid Control', 'Grid', 'Integer', 'siInt4',
  'Small Integer', 'siUByte', 'Text', 'siString']);
eq('type combo for a custom operator', Z.comboOp, ['siBool', 'Button', 'Color', 'siDouble', 'siInt4', 'siUByte', 'siString']);
eq('AddParam_OnClicked: one row, the name is incremented', Z.addInt, [[['siInt4', 'Param', 'true', 'false', 'false', 'true', 0, 0, 100, 0, 100]], ['  '], 'Param1', 0]);
eq('AddParam_OnClicked: duplicate name, empty name, bad range each show a message and add nothing', [Z.dup, Z.empty, Z.badRange], [[1, 1], [1, 2], [1, 3]]);
eq('AddParam_OnClicked: float (three decimals, UI range), colour, boolean, text, button', Z.rows, [
  ['siFloat', 'My_Name', 'true', 'false', 'true', 'true', 0.123, 0, 1, 0.25, 0.75],
  ['Color', 'Tint', 'true', 'false', 'true', 'true', '0.5,0,0,1', null, null, null, null],
  ['siBool', 'Flag', 'true', 'false', 'true', 'true', 'true', null, null, null, null],
  ['siString', 'Text', 'false', 'false', 'true', 'true', 'hello', null, null, null, null],
  ['Button', 'Go', 'true', 'false', 'true', 'true', null, null, null, null, null]]);
eq('name after the last add', Z.nextName, 'Go1');
eq('small rules', Z.rules, ['a10', 'a1', false, true, [false, false, false, false, true], 100000, true, true,
  ['siEmpty', 'siInt2', 'siInt4', 'siFloat', 'siDouble', 'siString', 'siDispatch', 'siBool', 'siUnknown', 'siByte', 'siUByte', 'siUInt2', 'siUInt4', 'siWStr', 99]]);
eq('TestRanges: first failing test shows its own message (ids 7206 to 7211)', Z.testRanges, [true, false, false, false, false, false, false, true, 6, 6]);
eq('UIRange_OnChanged', Z.uiRange, [['UIMaxFloat', 'UIMaxInt4', 'UIMaxUByte', 'UIMinFloat', 'UIMinInt4', 'UIMinUByte'], 0]);
const K = 'siClassifUnknown';
eq('GenerateDefineMethod: JScript custom property', Z.defineJs, `function MyProp_Define( in_ctxt )\n{\n${T}var oCustomProperty;\n${T}oCustomProperty = in_ctxt.Source;\n`
  + `${T}oCustomProperty.AddParameter2("Param",siInt4,0,0,100,0,100,${K},siPersistable | siKeyable);\n`
  + `${T}oCustomProperty.AddParameter2("My_Name",siFloat,0.123,0,1,0.25,0.75,${K},siPersistable | siAnimatable | siKeyable);\n`
  + ['R', 'G', 'B', 'A'].map((c, i) => `${T}oCustomProperty.AddParameter2("Tint_${c}",siDouble,${['0.5', '0', '0', '1'][i]},0,1,0,1,${K},siPersistable | siAnimatable | siKeyable);\n`).join('')
  + `${T}oCustomProperty.AddParameter2("Flag",siBool,true,null,null,null,null,${K},siPersistable | siAnimatable | siKeyable);\n`
  + `${T}oCustomProperty.AddParameter2("Text",siString,"hello",null,null,null,null,${K},siPersistable | siAnimatable | siKeyable);\n${T}return true;\n}\n\n`);
ok('GenerateDefineMethod: VBScript custom operator (factory calls, AlwaysEvaluate, Debug)', Z.defineVbOp.startsWith(`function MyOp_Define( in_ctxt )\n${T}dim oCustomOperator\n${T}dim oPDef\n${T}set oCustomOperator = in_ctxt.Source\n`
  + `${T}set oPDef = XSIFactory.CreateParamDef("Param",siInt4,${K},siPersistable OR siKeyable,"","",0,0,100,0,100)\n${T}oCustomOperator.AddParameter oPDef\n`)
  && Z.defineVbOp.includes(`${T}set oPDef = XSIFactory.CreateParamDef2("Text",siString,"hello")\n`) && Z.defineVbOp.endsWith(`\n${T}oCustomOperator.AlwaysEvaluate = false\n${T}oCustomOperator.Debug = 1\n${T}MyOp_Define = true\nend function\n\n`), Z.defineVbOp);
ok('GenerateDefineMethod: Cpp custom operator', Z.defineCppOp.startsWith(`SICALLBACK MyOp_Define( CRef& in_ctxt )\n{\n${T}Context ctxt( in_ctxt );\n${T}CustomOperator oCustomOperator;\n${T}Parameter oParam;\n${T}CRef oPDef;\n${T}Factory oFactory = Application().GetFactory();\n${T}oCustomOperator = ctxt.GetSource();\n`
  + `${T}oPDef = oFactory.CreateParamDef(L"Param",CValue::siInt4,siPersistable | siKeyable,L"",L"",0l,0l,100l,0l,100l);\n${T}oCustomOperator.AddParameter(oPDef,oParam);\n`)
  && Z.defineCppOp.includes(`${T}oPDef = oFactory.CreateParamDef(L"Text",CValue::siString,L"hello");\n`) && Z.defineCppOp.includes(`CValue::siBool,siPersistable | siAnimatable | siKeyable,L"",L"",true,CValue(),CValue(),CValue(),CValue());\n`)
  && Z.defineCppOp.endsWith(`\n${T}oCustomOperator.PutAlwaysEvaluate(false);\n${T}oCustomOperator.PutDebug(1);\n${T}return CStatus::OK;\n}\n\n`), Z.defineCppOp);
ok('GenerateDefineMethod: C# custom property (Define, cast, enum prefixes, three more nulls)', Z.defineCs.startsWith(`${T}public bool Define( Context in_ctxt )\n${T}{\n${T}${T}CustomProperty oCustomProperty = null;\n${T}${T}oCustomProperty = (CustomProperty)in_ctxt.Source;\n`
  + `${T}${T}oCustomProperty.AddParameter2("Param",siVariantType.siInt4,0,0,100,0,100,siParamClassification.siClassifUnknown,(int)siCapabilities.siPersistable | (int)siCapabilities.siKeyable,null,null,null);\n`), Z.defineCs);
ok('GenerateDefineMethod: Python custom primitive (no AlwaysEvaluate)', Z.definePyPrim.startsWith(`def MyPrim_Define( in_ctxt ):\n${T}oCustomPrimitive = in_ctxt.Source\n${T}oPDef = XSIFactory.CreateParamDef("Param",constants.siInt4,constants.siClassifUnknown,constants.siPersistable + constants.siKeyable,"","",0,0,100,0,100)\n${T}oCustomPrimitive.AddParameter(oPDef)\n`)
  && !/AlwaysEvaluate/.test(Z.definePyPrim) && Z.definePyPrim.endsWith(`${T}return true\n\n`), Z.definePyPrim);
const logged = (n) => `function ${n}( )\n{\n${T}Application.LogMessage("${n} called",siVerbose);\n`;
eq('GenerateLogicCallbacks: JScript', Z.logicJs, `${logged('MyProp_OnInit')}}\n\n${logged('MyProp_OnClosed')}}\n\n`
  + ['Param', 'My_Name'].map(n => `${logged(`MyProp_${n}_OnChanged`)}${T}var oParam;\n${T}oParam = PPG.${n};\n${T}var paramVal;\n${T}paramVal = oParam.Value;\n${T}Application.LogMessage("New value: " + paramVal,siVerbose);\n}\n\n`).join('')
  + ['R', 'G', 'B', 'A'].map(c => `${logged(`MyProp_Tint_${c}_OnChanged`)}}\n\n`).join('')
  + `${logged('MyProp_Flag_OnChanged')}${T}var oParam;\n${T}oParam = PPG.Flag;\n${T}var paramVal;\n${T}paramVal = oParam.Value;\n${T}Application.LogMessage("New value: " + paramVal,siVerbose);\n}\n\n${logged('MyProp_Go_OnClicked')}}\n\n`);
eq('GenerateLogicCallbacks: compiled languages without the template files', Z.logicCppNoTemplate, ['', 1]);
eq('GenerateLogicCallbacks: compiled languages expand the PPGEvent template', Z.logicCompiled, ['cpp MyProp / CustomProperty', 'cs MyOp / CustomOperator']);
eq('PopulateParamListFromExistingPSet', Z.populate, [false, false, 1, 0, true, true, true, 'true']);

// ---- 12. GetShaderDefHelper
const H = got.sdh;
eq('GetShaderDefHelper: needs the wizard; holds a WizardHelper and a writer for the wizard language', [H.noWizard, H.object], [true, ['WizardHelperObj', 'JScript']]);
eq('CreateShaderDefParams: defaults', H.params.values, ['MyShader', 1, 0, 'siShaderFamilyTexture', 'My Shader Category', 'My Shader', 'input', 'input', 'siShaderDataTypeScalar', true, true, true, false, 0, 1, 1, 'out', 'out',
  'siShaderDataTypeScalar', false, 'OpenGL', 'MyShader', '', '']);
eq('CreateShaderDefParams: grids, the disabled placeholder; CreateShaderParserParams', [H.params.grids, H.params.disabled, H.params.parser], [[14, 4, 2, 'Value'], ['InParamDefaultValDisabled'], ['string', 'string', 'string']]);
eq('BuildShaderDefLayout: tabs, groups, buttons', [H.layout.tabs, H.layout.groups, H.layout.buttons], [['Definition', 'Parameters'],
  ['Shader', 'Renderer', 'Options', 'Input Parameters', 'Hard Limit Values', 'Soft Limit Values', 'Attribute', '', 'Output Parameters'],
  ['HWShaderPreset=Hardware Shader Preset', 'MRShaderPreset=Mental ray Preset', 'AddRendererOptionBtn=Add', 'RemoveRendererOptionBtn=Remove Selected', 'GenerateCode=Generate Code', 'InParamAddBtn=Add', 'InParamRemoveBtn=Remove Selected',
    'OutParamAddBtn=Add', 'OutParamRemoveBtn=Remove Selected', 'GenerateCode=Generate Code']]);
eq('BuildShaderDefLayout: label sizes, combos, default control, empty-grid texts, limits', [H.layout.attrs, H.layout.families, H.layout.sorted, H.layout.inTypes, H.layout.outTypes, H.layout.attribs, H.layout.renderers, H.layout.defaultCtl, H.layout.texts, H.layout.limits, H.layout.codePath],
  [{ siUILabelMinPixels: 140, siUILabelPercentage: 50 }, 20, 'siShaderFamilyCntContrast', 21, 18, 10, ['DirectX9', 'Mental Ray', 'OpenGL'], 'InParamDefaultValScalar1', 3,
    ['InParamHardLimitMinF=Min', 'InParamHardLimitMaxF=Max', 'InParamSoftLimitMinF=Min', 'InParamSoftLimitMaxF=Max'], { control: 'siControlFilePath', siUIOpenFile: true }]);
eq('BuildShaderDefLayout: attribute value combo, image default control, limits disabled for other types', H.layout2, [7, 'InParamDefaultValImage', { control: 'siControlFilePath', siUIImageFile: true, siUIOpenFile: true }, true]);
eq('BuildParserLayout', H.parserLayout, [['tab:Parser', 'item:ShaderParserName=Name', 'item:ShaderParserFolder=Directory', 'item:ShaderParserExt=File Extension', 'button:GenerateCode=Generate Code'],
  { control: 'siControlFolder', siUIInitialDir: 'C:\\Users\\user\\Autodesk\\Softimage_2015_SP2\\Application\\Plugins' }]);
eq('AddInputParamToGrid: scalar row; a clashing name gets the suffix counter', H.addIn, [0, 1, [
  ['input', 'siShaderDataTypeScalar', 'input', 'true', 'true', 'true', 'false', 0, 1, 0, 1, '', '', 0.123],
  ['input1', 'siShaderDataTypeScalar', 'input', 'true', 'true', 'true', 'false', 0, 1, 0, 1, '', '', 0.123]], ['  ', '  '], 1]);
eq('AddInputParamToGrid: integer, boolean, other types', H.addIn2, [
  ['count', 'siShaderDataTypeInteger', 'input', 'true', 'true', 'true', 'false', 0, 1, 0, 1, 'siShaderFamilyAttribute', 'v', 4],
  ['flag', 'siShaderDataTypeBoolean', 'input', 'true', 'true', 'true', 'false', null, null, null, null, '', '', 'true'],
  ['tint', 'siShaderDataTypeColor4', 'input', 'true', 'true', 'true', 'false', null, null, null, null, '', '', '']]);
eq('AddInputParamToGrid: a missing default image adds nothing', H.imageMissing, [true, 0, ["error:Selected image doesn't exist: C:\\Users\\user\\Autodesk\\Softimage_2015_SP2\\Application\\fxtextures\\C:\\img\\a.png"]]);
eq('AddInputParamToGrid: the image is copied to fxtextures; the grid holds the bare file name', H.imageCopied, [5, 'a.png', 'a.png', true, ['info:Selected image has been copied to: C:\\Users\\user\\Autodesk\\Softimage_2015_SP2\\Application\\fxtextures\\a.png']]);
eq('AddInputParamToGrid: an image already in fxtextures is not copied again', H.imageInFolder, ['a.png', 0]);
eq('AddOutputParamToGrid: unique without regard to case', [H.addOut[0], H.addOut[2], H.addOut[3]], [0, 1, [['out', 'siShaderDataTypeScalar', 'out', 'false'], ['COUNT2', 'siShaderDataTypeScalar', 'out', 'false']]]);
eq('AddRendererOptionToGrid', H.addOpt, [-1, ['error:No option specified.'], 0, 1, [['opt', 'val'], ['opt1', 'val']]]);
eq('OnParamChanged', H.changed, [false, true, 'My_Shader', 'My_Shader', true, '', '', true, false, true, false, true, true, true, false]);
eq('OnButtonClick: unknown button, remove selected rows', [H.buttons, H.removeOut], [[-1, 1, ['opt1']], [1, ['out']]]);
eq('generators without the template files: empty text, "not yet attested"', H.noTemplates, ['', true, true, '', ['', ''], true]);
eq('ShaderDefCppIncludeFiles', H.includes, '#include <xsi_factory.h>\n#include <xsi_shaderdef.h>\n#include <xsi_shaderparamdefoptions.h>\n#include <xsi_shaderparamdefcontainer.h>\n#include <xsi_metashaderrendererdef.h>\n#include <xsi_valuemap.h>\n');
eq('GenerateShaderDefRegisterCode / parser code with staged templates', [H.reg, H.parser], ['REG My_Shader 1.0', ['PREG MyParser', 'PCB MyParser C:\\p fx']]);
eq('GenerateShaderDefCallback: DefineInfo text then Define text', H.callback, 'INFO MyPlugin My_Shader 1.0 [My Shader Category] [My Shader] k <A k=v>;'
  + 'DEFINE MyPlugin My_Shader 1.0 siShaderFamilyTexture {(in amount siShaderDataTypeScalar "Amount" true/true/true/false <d 0 1 0 1 0.5> )'
  + '(in tex siShaderDataTypeImage "Tex" true/true/true/false <a DefaultTextureFilename=a.png> <a siShaderFamilyAttribute=fam>)(out out siShaderDataTypeColor4 "Result" false)} {REND OpenGL My_Shader [] <opts <o "o1"="v1">>}');
eq('GenerateHWShaderCode: not a hardware shader', H.hwNotHw, ['', '']);
eq('OnButtonClick MRShaderPreset (the grid clear leaves every other row)', H.mr, [0, ['Mental ray', '{LIBS}/xsibase.{EXT}', 'mentalray', 'siShaderFamilyTexture', 'siShaderDataTypeColor3', 'out', 'out', ''], [1, 0, 0]]);
eq('OnButtonClick HWShaderPreset', H.hw, [0, ['OpenGL', 'MyPlugin', 'hwshader', 'siShaderFamilyRTShader', '', '', ''], [['out', 'siHWShaderPortType', 'out', 'false']], [['siHWShaderVersionAttribute', 'siHWShaderV1']]]);
eq('GenerateHWShaderCode', H.hwCode, ['My_Shader_shader', 'HW My_Shader 1.0 opengl My_Shader']);
ok('GenerateShaderDefCallback: for a hardware shader the first option goes through UseConstant', H.hwCallback.endsWith('{REND OpenGL My_Shader [MyPlugin] <opts <o siHWShaderVersionAttribute=siHWShaderV1>>}'), H.hwCallback);
eq('GenerateHWShaderCode: wrong renderer', H.hwWrong, [['', ''], ['info:Wrong Renderer name or symbol name specified.']]);
eq('GenerateShaderDefCallback: no renderer name gives an empty renderer definition', H.noRenderer, true);

// ---- 13. Polygonizer
const Y = got.poly;
eq('Create_Polygonizer_Polymesh: returns true, empty polygon mesh, selected alone afterwards', [Y.run[0], Y.run[1], Y.run[2]], [true, 'polymsh', ['Polygonizer']]);
eq('Create_Polygonizer_Polymesh: call order', Y.run[3], [['SIGetPrim', ['EmptyPolygonMesh', 'Polygonizer'], 'stand-in'], ['DeselectAll', [], 'bus'], ['SelectObj', ['Polygonizer,polyA,polyB'], 'bus'], ['ApplyPolygonizer', [], 'missing'],
  ['DeselectAll', [], 'bus'], ['SelectObj', ['Polygonizer'], 'bus']]);
eq('Create_Polygonizer_Polymesh: the missing operator is logged "not yet attested"; one undo entry, logged once', [Y.run[4], Y.run[5], Y.run[6]], [1, 1, 1]);
ok('Create_Polygonizer_Polymesh: empty selection applies to the new mesh alone', Y.empty[0] === true && Y.empty[1] === 1 && Y.empty[2].length === 2 && Y.empty[2][0] === Y.empty[2][1], Y.empty);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B7c add-on script commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B7c add-on script commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired (script layer): the 11 Cache Manager commands, OpenOutputFormatPreferences, RTShaderSetCategories, SIGetExternalFilesViewerProp, SISetExternalFilesManagerTarget, ConnectToWorkgroupUI, SDKGetScriptGenerator, PPGLayoutControl');
console.log('   partly wired: OverrideMarkedPassParameters, DeleteUnusedShaders, Create_Polygonizer_Polymesh, the Lagoa / ICE flow commands (delegated commands, compounds, root ports), GetWizardParamTab and GetShaderDefHelper (template files, Q11)');
