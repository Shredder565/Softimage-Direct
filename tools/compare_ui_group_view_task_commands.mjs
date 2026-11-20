// CMD-B7a: the built-in task commands of siuitasks / grouptask / siviewtasks / siclustertasks / selectionmgr on the
// command bus (src/commands/uiGroupViewTasks.ts, uiGroupViewTasksViews.ts). Checked against the "Wire contract"
// sections of docs/ghidra/cmd-b7a-uitasks-group-view-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the row, so this is a contract check. The parts the note leaves open are driven
// through the seams of `app.uiGroupViewTasks` (regionView, captureRegion, attachmentEntries, runWith).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_ui_group_view_task_commands.mjs
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

const UI = ['SetUserKeyword', 'SetUserTab', 'GetUserKeyword', 'GetUserTab', 'ClearUserKeyword', 'ClearUserTab', 'RemoveUserKeyword', 'RemoveUserTab',
  'AddUserKeyword', 'AddUserTab', 'SetParameterColor', 'ClearParameterColor', 'SetThumbnail', 'SetThumbnailFromRegion', 'ClearThumbnail'];
const GROUP = ['AssignObjectGroup', 'UnassignObjectGroup', 'SetParTypeInstanceGroup', 'RemoveParTypeInstanceGroup', 'SetInstanceGroup', 'RemoveInstanceGroup'];
const VIEW = ['OpenXSIExplorer', 'OpenTransientExplorer', 'OpenAttachments'];
const CLUSTER = ['SITogglePolygonVisibility', 'ClusterNonOverlapEnforcement'];
const SEL = ['SetActiveElements', 'SetAndToggleActiveElements', 'ActivateElements', 'DeactivateElements', 'ToggleActiveElements',
  'ActivateSampledPointSelTool', 'ActivateSampledPointSelToolWithNoObjStateChange'];
const NAMES = [...UI, ...GROUP, ...VIEW, ...CLUSTER, ...SEL];

// The registry entry of a name: the one handled by a task DLL, the superset argument list when there are two.
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const cs = reg.filter(c => c.scripting_name === n && (c.handler_dlls ?? []).length).sort((x, y) => y.args.length - x.args.length);
  return [n, cs[0] ? cs[0].args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('OpenXSIExplorer') && !!window.Application?.uiGroupViewTasks, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.uiGroupViewTasks; const fsx = app.hostFs;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const run = (n, a = {}, extra = null) => {
    S.lastStatus = null;
    try { const v = extra ? S.runWith(n, a, extra) : app.run(n, a); return { v, st: hex(S.lastStatus?.status) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status) }; }
  };
  /** Status of a call: the thrown status, else the recorded task status. */
  const st = (n, a, extra) => { const r = run(n, a, extra); return r.status ?? r.st; };
  const mark = () => app.log.length;
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const tick = () => new Promise(r => setTimeout(r, 40));
  const settle = (p) => Promise.resolve(p).then(() => 'ok', e => `rejected:${hex(e?.status) ?? String(e?.message ?? e)}`);
  const names = (l) => [...l].map(o => o?.name ?? o);
  const withCommand = async (def, f) => { const old = app.commands.get(def.name); app.commands.set(def.name, def); try { return await f(); } finally { if (old) app.commands.set(def.name, old); else app.commands.delete(def.name); } };

  // ---- modal helpers
  const win = () => [...document.querySelectorAll('.sdkh-modal-window')].pop() ?? null;
  const modalCount = () => document.querySelectorAll('.sdkh-modal-window').length;
  const title = () => win()?.querySelector('.ppg-float-title')?.textContent ?? null;
  const click = async (sel) => { win().querySelector(sel).click(); await tick(); };
  const okBtn = () => click('.sdkh-modal-ok'), cancelBtn = () => click('.sdkh-modal-cancel');
  const content = () => win().querySelector('.sdkh-modal-content');
  const browserState = () => { const c = content(); return { title: title(), mode: c.dataset.mode, dir: c.querySelector('.ugv-browse-dir input').value, name: c.querySelector('.ugv-browse-name input').value }; };
  const typeName = (v) => { content().querySelector('.ugv-browse-name input').value = v; };
  const typeDir = (v) => { content().querySelector('.ugv-browse-dir input').value = v; };

  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));

  app.run('NewScene', {});
  const cube = app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'tCube' });
  const sph = app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'tSphere' });
  const nul = app.run('GetPrim', { PresetObj: 'Null', Name: 'tNull' });
  const hair = app.run('GetPrim', { PresetObj: 'Null', Name: 'hair_emitter' });
  const GA = app.run('SICreateGroup', { Name: 'GA' });
  const PropertyClass = cube.properties[0].constructor;
  const clear = () => { app.compSel = null; app.setSelMode('object'); app.select([]); };
  clear();

  // ================= default arguments, batch mode, nothing selected
  app.Interactive = false;
  out.defaults = {};
  for (const n of NAMES) {
    const m = mark(); const r = run(n);
    out.defaults[n] = { err: r.err ?? null, status: r.status ?? r.st, nya: logFrom(m).filter(l => /not yet attested/.test(l) && !l.startsWith('error:')).length };
    if (n === 'OpenAttachments') { out.defaultAttachments = S.attachmentsExplorer ? [S.attachmentsExplorer.mode, S.attachmentsExplorer.width, S.attachmentsExplorer.height] : null; run(n); out.defaultAttachmentsToggled = S.attachmentsExplorer; }
  }
  out.defaultsState = { explorers: S.explorers.length, selFilter: S.selFilter, region: S.ambient.SI3D_RECTSEL_REGION_MODE };

  // ================= user keywords / tabs
  {
    const K = {}; out.kw = K;
    const events = []; const h = (e) => events.push(e.detail.name); window.addEventListener('si-property-changed', h);
    app.select([cube]);
    K.batchEmpty = [st('SetUserKeyword'), st('SetUserTab'), cube.userKeywords ?? null];
    let m = mark(); run('SetUserKeyword', { Keywords: 'alpha, beta ,Gamma' });
    K.set = [cube.userKeywords, logFrom(m).filter(l => l.startsWith('cmd:')).some(l => l.includes('alpha,beta,Gamma'))];
    K.setStatus = st('SetUserKeyword', { InputObjs: [cube, sph], Keywords: 'x' });
    K.replaced = [cube.userKeywords, sph.userKeywords];
    app.undo(); K.undo = [cube.userKeywords, sph.userKeywords ?? null]; app.redo(); K.redo = [cube.userKeywords, sph.userKeywords];
    cube.userKeywords = 'a,B'; sph.userKeywords = 'b,c,a';
    const g = run('GetUserKeyword', { InputObjs: 'tCube,tSphere' });
    K.get = [g.v.items, g.v.Count, g.v.Item(1), g.v.Item('C'), String(g.v), g.st, cube.userKeywords, sph.userKeywords];
    K.getEmpty = [run('GetUserKeyword', { InputObjs: [nul] }).v.Count, run('GetUserTab', { InputObjs: [cube] }).v.Count];
    // blank string: the internal clear sub-task; under SetUserTab it clears the keyword attribute (Q2, as read)
    cube.userTabs = 't0';
    run('SetUserTab', { Keywords: '  ' }); K.blankTab = [cube.userKeywords ?? null, cube.userTabs];
    cube.userKeywords = 'a,B'; run('SetUserKeyword', { Keywords: ' ' }); K.blankKeyword = cube.userKeywords ?? null;
    run('SetUserTab', { Keywords: 't1, t2' }); K.tabs = [cube.userTabs, run('GetUserTab').v.items, cube.userKeywords ?? null];
    // Add / Remove
    cube.userKeywords = 'a,B'; delete nul.userKeywords;
    K.addStatus = st('AddUserKeyword', { InputObjs: [cube, nul], Keywords: 'b, z,q' });
    K.add = [cube.userKeywords, nul.userKeywords];
    app.undo(); K.addUndo = [cube.userKeywords, nul.userKeywords ?? null]; app.redo();
    run('RemoveUserKeyword', { InputObjs: [cube, sph, hair], Keywords: 'A,Q' });
    K.remove = [cube.userKeywords, sph.userKeywords, hair.userKeywords ?? null];
    run('RemoveUserKeyword', { InputObjs: [nul], Keywords: 'b, z,q' }); K.removeAll = nul.userKeywords ?? null;
    K.emptyKeywords = [st('AddUserKeyword', { InputObjs: [cube] }), st('RemoveUserTab', { InputObjs: [cube] }), st('AddUserTab', { InputObjs: [], Keywords: 'x' })];
    run('AddUserTab', { Keywords: 'T1,t3' }); K.addTab = cube.userTabs; run('RemoveUserTab', { Keywords: 't2' }); K.removeTab = cube.userTabs;
    // Clear
    K.clearStatus = st('ClearUserTab'); K.clear = cube.userTabs ?? null; app.undo(); K.clearUndo = cube.userTabs;
    cube.userKeywords = 'k1'; run('ClearUserKeyword'); K.clearKeyword = [cube.userKeywords ?? null, cube.userTabs];
    K.events = [...new Set(events)].sort(); window.removeEventListener('si-property-changed', h);

    // the dialog
    app.Interactive = true;
    cube.userKeywords = 'kk'; cube.userTabs = 'tt';
    let p = app.run('SetUserTab', {}); await tick();
    K.dialog = [title(), content().querySelector('.ugv-keywords-prompt').textContent, content().querySelector('.ugv-keywords-input').value];
    content().querySelector('.ugv-keywords-input').value = 'n1, n2'; await okBtn(); K.dialogOk = [await settle(p), cube.userTabs, cube.userKeywords, hex(S.lastStatus?.status)];
    m = mark(); p = app.run('SetUserKeyword', {}); await tick(); const pre = content().querySelector('.ugv-keywords-input').value; await cancelBtn();
    K.dialogCancel = [pre, await settle(p), hex(S.lastStatus?.status), logFrom(m).some(l => /^info:SetUserKeyword: cancelled \(message 0x1e/.test(l)), cube.userKeywords];
    p = app.run('SetUserKeyword', {}); await tick(); content().querySelector('.ugv-keywords-input').value = ''; await okBtn();
    K.dialogEmpty = [await settle(p), hex(S.lastStatus?.status), cube.userKeywords];
    K.modalsLeft = modalCount();
    app.Interactive = false;
  }

  // ================= parameter colour
  {
    const C = {}; out.color = C;
    const px = cube.kinematics.local.get('posx'), py = cube.kinematics.local.get('posy');
    C.unusable = [st('SetParameterColor', { InputObjs: px }), st('SetParameterColor', { InputObjs: px, Value: 1.5 }), st('SetParameterColor', { InputObjs: px, Value: true }),
      st('SetParameterColor', { InputObjs: px, Value: 0x1000000 }), px.parameterColor ?? null];
    C.setStatus = st('SetParameterColor', { InputObjs: [px, py], Value: 0x00ff8040 }); C.set = [px.parameterColor, py.parameterColor];
    run('SetParameterColor', { InputObjs: 'tCube.kine.local.posx', Value: '255' }); C.byName = [px.parameterColor, py.parameterColor];
    app.undo(); C.undo = px.parameterColor;
    app.anim.marked.clear(); app.anim.marked.add(py);
    run('SetParameterColor', { Value: 7 }); C.marked = [px.parameterColor, py.parameterColor];
    C.clearStatus = st('ClearParameterColor'); C.clear = [px.parameterColor, py.parameterColor ?? null]; app.undo(); C.clearUndo = py.parameterColor;
    app.anim.marked.clear(); C.nothingMarked = [st('SetParameterColor', { Value: 1 }), st('ClearParameterColor')];
    app.Interactive = true;
    delete py.parameterColor;
    let p = app.run('SetParameterColor', { InputObjs: py }); await tick();
    C.dialogInitial = [title(), content().dataset.initial]; content().querySelector('.ugv-color-input').value = '#102030'; await okBtn();
    C.dialogOk = [await settle(p), py.parameterColor, hex(S.lastStatus?.status)];
    const m = mark(); p = app.run('SetParameterColor', { InputObjs: py, Value: 2.5 }); await tick(); const init = content().dataset.initial; await cancelBtn();
    C.dialogCancel = [init, await settle(p), hex(S.lastStatus?.status), py.parameterColor, logFrom(m).some(l => /^info:SetParameterColor: cancelled \(message 0x1e/.test(l))];
    app.Interactive = false;
  }

  // ================= thumbnails
  {
    const T = {}; out.thumb = T;
    const folder = S.thumbnailFolder(); T.folder = folder;
    const F = (n) => folder + '\\' + n;
    clear();
    T.noTargets = st('SetThumbnail', { Pathname: 'a.jpg' });
    app.select([cube]);
    T.batchNoPath = run('SetThumbnail');
    T.folderCreated = fsx.isFolder(folder);
    T.missing = run('SetThumbnail', { Pathname: 'missing.jpg' });
    fsx.writeFile(F('a.jpg'), 'A'); fsx.ensureFolder('C:\\pics'); fsx.writeFile('C:\\pics\\b.jpg', 'B'); fsx.writeFile('C:\\pics\\a.jpg', 'other A');
    T.plain = [st('SetThumbnail', { Pathname: 'a.jpg' }), cube.thumbnail?.kind, cube.thumbnail?.fileName, cube.thumbnail?.target === cube];
    fsx.writeFile(F('c.jpg'), 'C'); run('SetThumbnail', { InputObjs: [cube, sph], Pathname: F('c.jpg') }); T.inFolder = [cube.thumbnail.fileName, sph.thumbnail.fileName];
    app.undo(); T.undo = [cube.thumbnail.fileName, sph.thumbnail ?? null];
    let m = mark(); run('SetThumbnail', { Pathname: 'C:\\pics\\b.jpg' });
    T.copied = [cube.thumbnail.fileName, fsx.isFile(F('b.jpg')) && fsx.readFile(F('b.jpg')), logFrom(m).some(l => l.includes('C:\\pics\\b.jpg') && l.includes(F('b.jpg')) && l.includes('message 0x26'))];
    T.exists = run('SetThumbnail', { Pathname: 'C:\\pics\\a.jpg' }); T.existsKept = fsx.readFile(F('a.jpg'));
    T.unreadable = run('SetThumbnail', { Pathname: 'C:\\pics\\nope.jpg' });
    cube.thumbnail.fixed = true; T.fixed = st('SetThumbnail', { Pathname: 'a.jpg' }); delete cube.thumbnail.fixed;
    // Clear
    app.select([cube, nul]); T.clearStatus = st('ClearThumbnail'); T.clear = [cube.thumbnail ?? null, S.lastClearThumbnailUndo];
    app.undo(); T.clearUndo = cube.thumbnail?.fileName;
    // browser
    app.Interactive = true; app.select([cube]);
    let p = app.run('SetThumbnail', {}); await tick(); T.browse = browserState(); await cancelBtn(); T.browseCancel = await settle(p);
    p = app.run('SetThumbnail', {}); await tick(); typeName('a.jpg'); await okBtn(); T.browseOk = [await settle(p), cube.thumbnail.fileName];
    app.Interactive = false;

    // from region
    m = mark(); T.noRegion = [st('SetThumbnailFromRegion', { FileName: 'r.jpg' }), logFrom(m).some(l => /not yet attested: which view has a render region/.test(l))];
    S.regionView = () => null; T.regionNone = st('SetThumbnailFromRegion', { FileName: 'r.jpg' });
    S.regionView = () => 'viewB';
    m = mark(); T.noCapture = [run('SetThumbnailFromRegion', { FileName: 'r.jpg' }), logFrom(m).some(l => /not yet attested: the region-capture task/.test(l))];
    const captures = []; S.captureRegion = (view, file) => { captures.push([view, file]); fsx.writeFile(file, 'region'); };
    m = mark(); T.batchNoName = [st('SetThumbnailFromRegion'), logFrom(m).some(l => /message 0x3eb/.test(l)), captures.length];
    T.region = [st('SetThumbnailFromRegion', { FileName: 'C:\\elsewhere\\shot.jpg' }), captures.slice(), cube.thumbnail.fileName, fsx.isFile(F('shot.jpg'))];
    T.regionExists = run('SetThumbnailFromRegion', { FileName: 'shot.jpg' });
    T.regionOverwrite = [st('SetThumbnailFromRegion', { FileName: 'shot.jpg', Overwrite: true }), captures.length];
    app.Interactive = true;
    p = app.run('SetThumbnailFromRegion', {}); await tick(); T.regionBrowse = browserState();
    typeDir('C:\\pics'); typeName('x.jpg'); await okBtn(); T.regionWrongFolder = [title(), win().querySelector('.sdkh-msg-text')?.textContent];
    await okBtn(); T.regionReopened = browserState();
    typeName('shot.jpg'); await okBtn(); T.regionPickedExisting = [await settle(p), cube.thumbnail.fileName, captures.length];
    m = mark(); p = app.run('SetThumbnailFromRegion', {}); await tick(); await cancelBtn();
    T.regionCancel = [await settle(p), logFrom(m).some(l => /^info:SetThumbnailFromRegion: cancelled \(message 0x1e/.test(l))];
    clear(); p = app.run('SetThumbnailFromRegion', {}); await tick(); T.regionDefaultName = browserState().name; await cancelBtn(); await settle(p);
    app.Interactive = false; S.regionView = null; S.captureRegion = null;
    T.modalsLeft = modalCount();
  }

  // ================= group containers
  {
    const G = {}; out.group = G;
    const pt = new PropertyClass('PT', 'ParType', []); sph.addProperty(pt);
    let m = mark();
    G.assign = [st('AssignObjectGroup', { Object: 'hair_emitter', Group: 'GA' }), hair.instanceGroup === GA, logFrom(m).some(l => /^info:AssignObjectGroup: hair_emitter instance group = GA; not yet attested: instantiation/.test(l))];
    app.undo(); G.assignUndo = hair.instanceGroup ?? null; app.redo(); G.assignRedo = hair.instanceGroup === GA;
    G.errors = [run('AssignObjectGroup', { Group: 'GA' }), run('AssignObjectGroup', { Object: 'tCube', Group: 'GA' }), run('AssignObjectGroup', { Object: 'hair_emitter', Group: 'tCube' }),
      run('UnassignObjectGroup'), run('UnassignObjectGroup', { Object: 'tCube' })];
    G.unassign = [st('UnassignObjectGroup', { Object: 'hair_emitter' }), hair.instanceGroup ?? null]; app.undo(); G.unassignUndo = hair.instanceGroup === GA; app.redo();
    G.unassignNone = st('RemoveInstanceGroup', { Object: 'hair_emitter' });
    run('SetInstanceGroup', { Object: hair, Group: GA }); G.setInstance = hair.instanceGroup === GA; run('RemoveInstanceGroup', { Object: hair }); G.removeInstance = hair.instanceGroup ?? null;
    m = mark(); G.parType = [st('SetParTypeInstanceGroup', { ParType: pt, Group: GA }), pt.instanceGroup === GA, logFrom(m).some(l => /not yet attested: how the ParType argument reaches the handler/.test(l) && /Q4/.test(l))];
    G.parTypeRemove = [st('RemoveParTypeInstanceGroup', { ParType: pt }), pt.instanceGroup ?? null];
    // nested container: the object that carries the particle type (assign only)
    G.nested = [st('AssignObjectGroup', { Object: sph, Group: GA }), pt.instanceGroup === GA, run('UnassignObjectGroup', { Object: sph }).status, pt.instanceGroup === GA];
    sph.removeProperty(pt);
  }

  // ================= views
  {
    const V = {}; out.view = V;
    const xw = () => document.querySelectorAll('.ugv-xsi-explorer').length;
    for (const w of [...S.explorers]) w.win.close(); S.explorers.length = 0;
    const pick = (r) => r.v && r.v.type ? { type: r.v.type, scope: r.v.scope, internal: r.v.internalScope, toolbar: r.v.showToolbar, reuse: r.v.reuse, reused: r.v.reused, content: names(r.v.content), viewer: r.v.viewer, title: r.v.title } : r;
    const args = {}; const d = app.commands.get('OpenXSIExplorer');
    let r = run('OpenXSIExplorer'); V.def = [pick(r), xw(), r.st, r.v.win.el.querySelector('.ppg-float-body').dataset.viewClass, !!r.v.win.el.querySelector('.xsi-explorer')];
    const first = r.v;
    r = run('OpenXSIExplorer'); V.reused = [r.v === first, r.v.reused, xw()];
    V.scopes = []; for (let i = 0; i <= 21; i++) V.scopes.push(run('OpenXSIExplorer', { Scope: i }).v.internalScope);
    V.windowsAfterScopes = xw();
    r = run('OpenXSIExplorer', { Viewer: 'property editor', InputObjs: [cube, nul], ShowToolbar: false, Title: 'My Explorer', Reuse: false });
    V.full = [pick(r), xw(), r.v.win.title, [...r.v.win.el.querySelectorAll('.explorer-head')].every(h => h.style.display === 'none'), r.v !== first];
    V.badViewer = run('OpenXSIExplorer', { Viewer: 'No Such View' });
    const before = xw(); const m = mark(); r = run('OpenXSIExplorer', { InputObjs: 'Preferences' });
    V.noContent = [r.v?.command, xw() - before, logFrom(m).some(l => /not yet attested: explorer content for "Preferences"/.test(l))];
    if (app.commands.get('InspectPreferences') && app.uixsiPrefsIceViews) { run('InspectPreferences', { Preference: 'output_format' }); V.inspectPreferences = app.uixsiPrefsIceViews.lastInspectPreferences; }
    for (const w of [...S.explorers]) w.win.close();

    // transient explorer
    const rows = () => [...S.transient.win.el.querySelectorAll('.ugv-tx-row')];
    V.batch = [run('OpenTransientExplorer').v, S.transient];
    app.Interactive = true;
    V.masks = [];
    for (const f of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, ':siSEFilterAllNodes:siTransientExplorerFilter']) {
      const p = app.run('OpenTransientExplorer', { Filter: f }); await tick(); V.masks.push(S.transient.mask === null ? 'iface' : S.transient.mask.toString(16)); S.transient.terminate(); await p;
    }
    let p = app.run('OpenTransientExplorer', {}); await tick();
    V.open = [S.transient.win.el.style.width, S.transient.win.el.style.height, S.transient.win.el.querySelector('.ppg-float-body').dataset.style, rows().map(x => x.dataset.name.split('.').pop()), S.transient.multiSelect];
    S.transient.terminate(); V.nothingPicked = await p;
    p = app.run('OpenTransientExplorer', { ExpandLevel: 1, Sort: true }); await tick();
    const sorted = rows().map(x => x.dataset.name).slice(1); V.sorted = [sorted.length > 3, JSON.stringify(sorted) === JSON.stringify([...sorted].sort((x, y) => x.split('.').pop().localeCompare(y.split('.').pop())))];
    rows().find(x => x.dataset.name.endsWith('tCube')).click(); await tick();
    V.single = [names(await p), S.transient];
    p = app.run('OpenTransientExplorer', { InitObjects: [cube, sph, nul], MultiSelect: true, Sort: false }); await tick();
    V.multiRoots = rows().map(x => x.dataset.name.split('.').pop());
    const T = S.transient; const seq = [];
    T.notify('set', [cube]); seq.push(names(T.result)); T.notify('add', [sph, cube]); seq.push(names(T.result)); T.notify('toggle', [cube, nul]); seq.push(names(T.result));
    T.notify('remove', [sph]); seq.push(names(T.result)); T.notify('set', [sph, cube]); seq.push(names(T.result));
    rows().find(x => x.dataset.name.endsWith('tNull')).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })); await tick(); seq.push(names(T.result));
    V.notifications = seq; V.multiStaysOpen = S.transient === T;
    T.terminate(); V.multi = names(await p);
    app.Interactive = false;

    // attachments
    const A = {}; V.att = A;
    const ax = () => document.querySelectorAll('.ugv-attachments-explorer').length;
    run('OpenAttachments', { ForceExplorer: true, Target: cube }); A.forced = [S.attachmentsExplorer?.mode, ax()];
    run('OpenAttachments', { Target: cube }); A.toggledOff = [S.attachmentsExplorer, ax()];
    let m2 = mark(); run('OpenAttachments', { Target: cube, ForceExplorer: false });
    A.nothing = [S.attachmentsExplorer?.mode, logFrom(m2).some(l => /^info:OpenAttachments: tCube has no attachment \(message 0x79 or 0x7a/.test(l)), logFrom(m2).some(l => /not yet attested: the attachment entries/.test(l))];
    run('OpenAttachments'); A.closed = ax();
    const note = new PropertyClass('Annotation', 'annotation', [{ name: 'text', label: 'Text', type: 'string', value: 'Note' }]); nul.addProperty(note);
    const calls = [];
    await withCommand({ name: 'InspectObj', args: [{ name: 'InputObjs', default: '' }], undoable: false, execute: (_a, a) => { calls.push(names(a.InputObjs)); } }, async () => { run('OpenAttachments', { Target: nul, ForceExplorer: false }); });
    A.annotation = [calls, ax()];
    S.attachmentEntries = (t) => t === cube ? ['n1,n2', 'p1,p2', 'k1,k2'] : null;
    run('OpenAttachments', { Target: cube, ForceExplorer: false }); run('OpenAttachments', { Target: cube, ForceExplorer: false });
    A.viewer = [S.attachmentViewers.map(v => [v.name.split('.').pop(), v.strings, v.reused]), ax()];
    S.attachmentEntries = null; nul.removeProperty(note);
  }

  // ================= clusters
  {
    const L = {}; out.cluster = L;
    const el = (c) => [...c.elements].map(Number).sort((x, y) => x - y);
    let m = mark(); L.noCluster = [st('SITogglePolygonVisibility', { InputObjs: 'tCube.poly[1,2]' }), logFrom(m).some(l => /not yet attested: tCube has no InvisiblePolygons cluster/.test(l) && /Q5/.test(l)), cube.clusters.length];
    app.selectComponents(cube, 'polygon', [0, 1]); const inv = app.run('CreateCluster', { Name: 'InvisiblePolygons' }); clear();
    L.created = [inv.name, inv.compKind, el(inv)];
    L.add = [st('SITogglePolygonVisibility', { InputObjs: 'tCube.poly[1,2]' }), el(inv)];
    run('SITogglePolygonVisibility', { InputObjs: 'tCube.poly[0,1]' }); L.remove = el(inv);
    app.undo(); L.undo = el(inv); app.redo();
    run('SITogglePolygonVisibility', { InputObjs: 'tCube.poly[2],tCube.poly[3-4]' }); L.merged = el(inv);
    app.selectComponents(cube, 'polygon', [2, 3, 4]); run('SITogglePolygonVisibility'); L.fromSelection = el(inv); clear();
    L.badItem = run('SITogglePolygonVisibility', { InputObjs: [nul] });
    L.nothingSelected = st('SITogglePolygonVisibility');

    app.selectComponents(cube, 'polygon', [0, 1, 2]); const A = app.run('CreateCluster', { Name: 'A' });
    app.selectComponents(cube, 'polygon', [2, 3]); const B = app.run('CreateCluster', { Name: 'B' });
    app.selectComponents(cube, 'polygon', [1, 5]); const D = app.run('CreateCluster', { Name: 'D' }); clear();
    const mat = new PropertyClass('LocalMaterial', 'material', []); B.properties.push(mat);   // D holds no property of the category
    L.errors = [run('ClusterNonOverlapEnforcement', { InputObjs: [A] }), run('ClusterNonOverlapEnforcement', { InputObjs: [nul], Property: mat }),
      run('ClusterNonOverlapEnforcement', { InputObjs: [A], Property: mat, ActionWhenLocalMaterialsOverlap: 3 })];
    m = mark(); let r = run('ClusterNonOverlapEnforcement', { InputObjs: [A], Property: mat });
    L.action1 = [names(r.v), el(A), el(B), el(D), r.st, logFrom(m).some(l => /not yet attested: the exact overlap test/.test(l))];
    app.undo(); L.action1Undo = el(A);
    r = run('ClusterNonOverlapEnforcement', { InputObjs: [A], Property: mat, ActionWhenLocalMaterialsOverlap: 4 }); L.action4 = [names(r.v), el(A), el(B)];
    r = run('ClusterNonOverlapEnforcement', { InputObjs: [A], Property: mat, ActionWhenLocalMaterialsOverlap: 2 }); L.action2 = [names(r.v), el(A), el(B)];
    app.undo();
    r = run('ClusterNonOverlapEnforcement', { InputObjs: [A], ActionWhenLocalMaterialsOverlap: 4 }, { CategoryID: 'material' }); L.categoryId = names(r.v);
    r = run('ClusterNonOverlapEnforcement', { InputObjs: [A], Property: B, ActionWhenLocalMaterialsOverlap: 4 }); L.nestedProperty = names(r.v);
  }

  // ================= active elements
  {
    const E = {}; out.sel = E;
    const sel = () => names(app.selection);
    clear();
    E.set = [st('SetActiveElements', { SelectionList: 'tCube,tSphere' }), sel()];
    E.setSame = st('SetActiveElements', { SelectionList: 'tCube,tSphere' });
    E.activate = [st('ActivateElements', { SelectionList: [nul, cube] }), sel()];
    E.deactivate = [st('DeactivateElements', { SelectionList: 'tSphere' }), sel()];
    E.toggle = [st('ToggleActiveElements', { SelectionList: 'tCube,tSphere' }), sel()];
    app.undo(); E.undo = sel(); app.redo(); E.redo = sel();
    let m = mark(); E.setAndToggle = [st('SetAndToggleActiveElements', { SelectionList: 'tCube' }), sel(), logFrom(m).some(l => /not yet attested: the rule that splits the list/.test(l) && /Q6/.test(l))];
    E.clear = [st('SetActiveElements'), sel()]; app.undo(); E.clearUndo = sel();
    E.levels = [st('SetActiveElements', { SelectionList: 'tCube' }, { HierarchyLevel: 8 }), st('SetActiveElements', { SelectionList: 'tCube' }, { HierarchyLevel: -1 }),
      st('ActivateElements', { SelectionList: 'tNull' }, { HierarchyLevel: 4 }), st('ToggleActiveElements', { SelectionList: 'tNull' }, { HierarchyLevel: 4 }),
      st('SetAndToggleActiveElements', { SelectionList: 'tNull' }, { HierarchyLevel: 4 }), st('DeactivateElements', { SelectionList: 'tNull' }, { HierarchyLevel: 4 }), sel()];
    clear(); const selectability = sph.property('visibility').get('selectability'); selectability.value = false;
    run('ActivateElements', { SelectionList: 'tCube,tSphere' }, { CheckObjectSelectability: true }); E.checkSelectability = sel();
    run('ActivateElements', { SelectionList: 'tCube,tSphere' }); E.noCheck = sel(); selectability.value = true;
    // components
    clear(); const pts = () => app.compSel ? [app.compSel.obj.name, app.compSel.kind, [...app.compSel.points].sort()] : null;
    run('SetActiveElements', { SelectionList: 'tCube.pnt[0,1]' }); E.compSet = [pts(), sel()];
    run('ActivateElements', { SelectionList: 'tCube.pnt[2]' }); E.compAdd = pts();
    run('ToggleActiveElements', { SelectionList: 'tCube.pnt[0,3]' }); E.compToggle = pts();
    run('DeactivateElements', { SelectionList: 'tCube.pnt[1]' }); E.compRemove = pts();
    app.undo(); E.compUndo = pts();
    clear();

    // selection tool
    const X = {}; out.tool = X;
    S.selFilter = null; S.ambient = {}; app.select([cube]);
    m = mark(); X.def = [st('ActivateSampledPointSelTool'), S.selFilter, S.ambient.SI3D_RECTSEL_REGION_MODE, sel(), logFrom(m).filter(l => /not yet attested/.test(l)).length];
    app.undo(); X.deselectUndo = sel();
    S.selFilter = null; X.noStateChange = [st('ActivateSampledPointSelToolWithNoObjStateChange'), S.selFilter, sel()];
    X.sameFilter = [st('ActivateSampledPointSelTool'), sel()];
    X.badRegion = [st('ActivateSampledPointSelTool', { SelRegionMode: 7 }), st('ActivateSampledPointSelTool', { SelRegionMode: 0 }), st('ActivateSampledPointSelTool', { SelRegionMode: 6 }), S.ambient.SI3D_RECTSEL_REGION_MODE];
    run('ActivateSampledPointSelTool', {}, { GroupMode: true }); X.groupMode = S.ambient.SI3D_GROUP_SEL_MODE;
    let cancelled = 0; S.selFilter = null; const n0 = S.selectionToolActivations;
    app.setTool({ name: 'other', prompt: 'other tool', onCancel() { cancelled++; } });
    run('ActivateSampledPointSelTool'); X.otherTool = [app.activeTool, cancelled, sel(), S.selectionToolActivations - n0];
    run('ActivateSampledPointSelTool'); X.alreadyCurrent = S.selectionToolActivations - n0;
    clear();
  }
  app.Interactive = true;
  return out;
}, { NAMES });
await browser.close();

// ---------------------------------------------------------------- compare
let checks = 0; const diffs = [];
const show = (x) => JSON.stringify(x);
const eq = (what, a, b) => { checks++; if (show(a) !== show(b)) diffs.push(`${what}\n      got      ${show(a)}\n      expected ${show(b)}`); };
const ok = (what, cond, detail) => { checks++; if (!cond) diffs.push(`${what}${detail === undefined ? '' : `\n      got ${show(detail)}`}`); };
const NOTHING = '1', OKS = '0', CANCELLED = '562e80c7', POINTER = '80004003', FAIL = '80004005', DENIED = '80070005', INVALID = '80070057', UNEXPECTED = '8000ffff';
void POINTER;

// 1. registration
// CMD-B18d (WIRE_CORRECTIONS_B18 item 10): AddUserKeyword is one registration shared with the Face Robot plug-in command
// (Obj, Key); the built-in's arguments stay first and the plug-in's two follow.
const B18D_EXTRA = { AddUserKeyword: [['Obj', null], ['Key', null]] };
for (const n of NAMES) { ok(`${n}: in the registry dump`, registry[n] !== null); eq(`${n}: registered with the contract's arguments and defaults`, got.reg[n], registry[n] && B18D_EXTRA[n] ? [...registry[n], ...B18D_EXTRA[n]] : registry[n]); }

// 2. defaults (batch, nothing selected)
const D = got.defaults;
const DEFAULT_STATUS = {
  SetUserKeyword: NOTHING, SetUserTab: NOTHING, GetUserKeyword: NOTHING, GetUserTab: NOTHING, ClearUserKeyword: NOTHING, ClearUserTab: NOTHING,
  RemoveUserKeyword: NOTHING, RemoveUserTab: NOTHING, AddUserKeyword: NOTHING, AddUserTab: NOTHING, SetParameterColor: NOTHING, ClearParameterColor: NOTHING,
  SetThumbnail: INVALID, SetThumbnailFromRegion: NOTHING, ClearThumbnail: NOTHING,
  AssignObjectGroup: UNEXPECTED, UnassignObjectGroup: UNEXPECTED, SetParTypeInstanceGroup: UNEXPECTED, RemoveParTypeInstanceGroup: UNEXPECTED, SetInstanceGroup: UNEXPECTED, RemoveInstanceGroup: UNEXPECTED,
  OpenXSIExplorer: NOTHING, OpenTransientExplorer: NOTHING, OpenAttachments: NOTHING,
  SITogglePolygonVisibility: NOTHING, ClusterNonOverlapEnforcement: INVALID,
  SetActiveElements: CANCELLED, SetAndToggleActiveElements: NOTHING, ActivateElements: NOTHING, DeactivateElements: NOTHING, ToggleActiveElements: NOTHING,
  ActivateSampledPointSelTool: OKS, ActivateSampledPointSelToolWithNoObjStateChange: OKS,
};
for (const n of NAMES) {
  eq(`${n} default arguments: status`, D[n].status, DEFAULT_STATUS[n]);
  ok(`${n} default arguments: ${[INVALID, UNEXPECTED].includes(DEFAULT_STATUS[n]) ? 'raises the contract error' : 'no error'}`, (D[n].err !== null) === [INVALID, UNEXPECTED].includes(DEFAULT_STATUS[n]), D[n]);
}
for (const n of ['SetThumbnailFromRegion', 'SetParTypeInstanceGroup', 'RemoveParTypeInstanceGroup', 'OpenTransientExplorer', 'SetAndToggleActiveElements', 'ActivateSampledPointSelTool', 'ActivateSampledPointSelToolWithNoObjStateChange'])
  ok(`${n} default arguments: the open part logs "not yet attested"`, D[n].nya > 0, D[n]);
eq('OpenAttachments default (ForceExplorer true, no target): transient explorer mode 3, 300 x 300; a second call hides it', [got.defaultAttachments, got.defaultAttachmentsToggled], [[3, 300, 300], null]);
eq('defaults: one explorer view, the SampledPoint filter recorded, SI3D_RECTSEL_REGION_MODE 1', got.defaultsState, { explorers: 1, selFilter: 'SampledPoint', region: 1 });

// 3. user keywords / tabs
const K = got.kw;
eq('SetUserKeyword / SetUserTab, empty Keywords, no UI: 0x80070057, nothing set', K.batchEmpty, [INVALID, INVALID, null]);
eq('SetUserKeyword: every space removed; the final string is written back to Keywords (logged call)', K.set, ['alpha,beta,Gamma', true]);
eq('SetUserKeyword: the attribute of every target is replaced, not merged', [K.setStatus, K.replaced], [OKS, ['x', 'x']]);
eq('SetUserKeyword undo: old value back, attribute removed where there was none; redo', [K.undo, K.redo], [['alpha,beta,Gamma', null], ['x', 'x']]);
eq('GetUserKeyword: tokens merged without duplicates, case-insensitive, first-seen order; a collection keyed by token; nothing modified, status 1', K.get, [['a', 'B', 'c'], 3, 'B', 'c', 'a,B,c', NOTHING, 'a,B', 'b,c,a']);
eq('GetUserKeyword / GetUserTab with no keywords: empty collection', K.getEmpty, [0, 0]);
eq('SetUserTab with a blank string: the clear sub-task removes the *keyword* attribute (Q2, as read), tabs untouched', K.blankTab, [null, 't0']);
eq('SetUserKeyword with a blank string: keyword attribute removed', K.blankKeyword, null);
eq('SetUserTab / GetUserTab use the user tab attribute', K.tabs, ['t1,t2', ['t1', 't2'], null]);
eq('AddUserKeyword: given tokens appended (not stripped, no duplicates); a target without the attribute starts empty', [K.addStatus, K.add], [OKS, ['a,B, z,q', 'b, z,q']]);
eq('AddUserKeyword undo', K.addUndo, ['a,B', null]);
eq('RemoveUserKeyword: drops the given tokens; a target without the attribute is left untouched', K.remove, ['B, z', 'b,c', null]);
eq('RemoveUserKeyword: an emptied list removes the attribute', K.removeAll, null);
eq('Add / Remove with empty Keywords or no targets: status 1', K.emptyKeywords, [NOTHING, NOTHING, NOTHING]);
eq('AddUserTab / RemoveUserTab act on the tab attribute', [K.addTab, K.removeTab], ['t1,t2,t3', 't1,t3']);
eq('ClearUserTab removes the attribute; undo restores the string', [K.clearStatus, K.clear, K.clearUndo], [OKS, null, 't1,t3']);
eq('ClearUserKeyword leaves the tabs alone', K.clearKeyword, [null, 't1,t3']);
eq('keyword / tab tasks broadcast the attribute GUID', K.events, ['{732ad5de-b58e-4468-9f13-60c2deccf1a1}', '{fd1a0da8-ae6f-4580-9367-b5bc1f112880}']);
eq('SetUserTab dialog: "User Keyword(s)", prompt, pre-filled from the keyword attribute (Q2)', K.dialog, ['User Keyword(s)', 'Please enter the User Keywords (comma separated)', 'kk']);
eq('dialog OK: the typed text is applied (spaces removed)', K.dialogOk, ['ok', 'n1,n2', 'kk', OKS]);
eq('dialog Cancel: message 0x1e logged, status 0x562e80c7, nothing changed', K.dialogCancel, ['kk', 'ok', CANCELLED, true, 'kk']);
eq('dialog OK with an empty field counts as Cancel', K.dialogEmpty, ['ok', CANCELLED, 'kk']);
eq('no dialog left open', K.modalsLeft, 0);

// 4. parameter colour
const C = got.color;
eq('SetParameterColor without a usable Value (none, float, boolean, top byte set), no UI: 0x80070057', C.unusable, [INVALID, INVALID, INVALID, INVALID, null]);
eq('SetParameterColor: the colour is written to every target', [C.setStatus, C.set], [OKS, [0x00ff8040, 0x00ff8040]]);
eq('SetParameterColor: InputObjs by parameter path', C.byName, [255, 0x00ff8040]);
eq('SetParameterColor undo', C.undo, 0x00ff8040);
eq('SetParameterColor default InputObjs: the marked parameters', C.marked, [0x00ff8040, 7]);
eq('ClearParameterColor removes the attribute from the marked parameter; undo', [C.clearStatus, C.clear, C.clearUndo], [OKS, [0x00ff8040, null], 7]);
eq('nothing marked: status 1', C.nothingMarked, [NOTHING, NOTHING]);
eq('colour editor: initialised with 0xff when the first target has no colour', C.dialogInitial, ['Color Editor', '255']);
eq('colour editor OK: 0x00BBGGRR written', C.dialogOk, ['ok', 0x302010, OKS]);
eq('colour editor: initialised with the current colour; Cancel logs message 0x1e, status 0x562e80c7', C.dialogCancel, [String(0x302010), 'ok', CANCELLED, 0x302010, true]);

// 5. thumbnails
const T = got.thumb; const TF = T.folder;
ok('thumbnail folder is the Thumbnails folder of the project; created when missing', /\\Thumbnails$/.test(TF) && T.folderCreated === true, [TF, T.folderCreated]);
eq('SetThumbnail with nothing to set: 0x80070057', T.noTargets, INVALID);
ok('SetThumbnail, empty Pathname, no UI: 0x80004005 message 0x17', T.batchNoPath.status === FAIL && /message 0x17/.test(T.batchNoPath.err), T.batchNoPath);
ok('SetThumbnail, bare file name not in the thumbnail folder: 0x80004005 message 0x17', T.missing.status === FAIL && /message 0x17/.test(T.missing.err), T.missing);
eq('SetThumbnail, bare file name in the folder: a thumbnail object (target, file name) per target', T.plain, [OKS, 'thumbnail', 'a.jpg', true]);
eq('SetThumbnail, path inside the thumbnail folder: only the file name is kept', T.inFolder, ['c.jpg', 'c.jpg']);
eq('SetThumbnail undo: previous thumbnail back / attribute removed', T.undo, ['a.jpg', null]);
eq('SetThumbnail, other directory: copied into the folder, message 0x26 (source, destination), file name kept', T.copied, ['b.jpg', 'B', true]);
ok('SetThumbnail, other directory, name already in the folder: 0x80070005 message 0x3b, no overwrite', T.exists.status === DENIED && /message 0x3b/.test(T.exists.err) && T.existsKept === 'A', [T.exists, T.existsKept]);
ok('SetThumbnail, unreadable file: 0x80004005 message 0x17', T.unreadable.status === FAIL && /message 0x17/.test(T.unreadable.err), T.unreadable);
eq('SetThumbnail skips a target whose thumbnail must not be replaced (Q3); none left: 0x80070057', T.fixed, INVALID);
eq('ClearThumbnail: attribute removed; undo data = file name or __NOTHUMBNAIL__', [T.clearStatus, T.clear], [OKS, [null, ['b.jpg', '__NOTHUMBNAIL__']]]);
eq('ClearThumbnail undo', T.clearUndo, 'b.jpg');
eq('SetThumbnail browser: "Browse for Thumbnail", open, starting in the thumbnail folder', T.browse, { title: 'Browse for Thumbnail', mode: 'open', dir: TF, name: '' });
eq('SetThumbnail browser Cancel: 0x80004005 (message 1000)', T.browseCancel, `rejected:${FAIL}`);
eq('SetThumbnail browser OK: the chosen file is set', T.browseOk, ['ok', 'a.jpg']);
eq('SetThumbnailFromRegion: no view with a render region, nothing happens (the lookup is logged as not yet attested)', [T.noRegion, T.regionNone], [[NOTHING, true], NOTHING]);
ok('SetThumbnailFromRegion without the capture task: logged as not yet attested, file unreadable: message 0x17', T.noCapture[0].status === FAIL && /message 0x17/.test(T.noCapture[0].err) && T.noCapture[1] === true, T.noCapture);
eq('SetThumbnailFromRegion, empty FileName, no UI: message 0x3eb logged, nothing captured', T.batchNoName, [NOTHING, true, 0]);
eq('SetThumbnailFromRegion: file-name part only, capture (view, path) in the thumbnail folder, then SetThumbnail', T.region, [OKS, [['viewB', `${TF}\\shot.jpg`]], 'shot.jpg', true]);
ok('SetThumbnailFromRegion: existing file, Overwrite off: 0x80004005 message 0x3b', T.regionExists.status === FAIL && /message 0x3b/.test(T.regionExists.err), T.regionExists);
eq('SetThumbnailFromRegion: Overwrite on captures again', T.regionOverwrite, [OKS, 2]);
eq('SetThumbnailFromRegion browser: "Enter the Thumbnail filename", save, default <first target>.jpg', T.regionBrowse, { title: 'Enter the Thumbnail filename', mode: 'save', dir: TF, name: 'tCube.jpg' });
eq('another folder: error box with the dictionary text', T.regionWrongFolder[1], "The thumbnail file MUST be saved in the 'Thumbnails' sub-folder of the current project.");
eq('then the browser reopens in the thumbnail folder', [T.regionReopened.title, T.regionReopened.dir], ['Enter the Thumbnail filename', TF]);
eq('picking an existing file switches overwrite on', T.regionPickedExisting, ['ok', 'shot.jpg', 3]);
eq('SetThumbnailFromRegion browser Cancel: message 0x1e logged', T.regionCancel, ['ok', true]);
eq('default name without a target: Thumbnail.jpg', T.regionDefaultName, 'Thumbnail.jpg');
eq('no dialog left open (thumbnails)', T.modalsLeft, 0);

// 6. group containers
const G = got.group;
eq('AssignObjectGroup: the group is set at the container index; the instancing itself is logged as not yet attested', G.assign, [OKS, true, true]);
eq('AssignObjectGroup undo clears the index (there was no group); redo', [G.assignUndo, G.assignRedo], [null, true]);
eq('Assign / Unassign errors: empty Object 0x8000ffff, not a container 0x80070057, not a group 0x80004005 (message 0x6f)',
  [G.errors.map(e => e.status), /message 0x6f/.test(G.errors[2].err)], [[UNEXPECTED, INVALID, FAIL, UNEXPECTED, INVALID], true]);
eq('UnassignObjectGroup clears the index; undo sets the remembered group back', [G.unassign, G.unassignUndo], [[OKS, null], true]);
eq('Unassign with no group at the index: nothing to do', G.unassignNone, NOTHING);
eq('SetInstanceGroup / RemoveInstanceGroup are the same two tasks', [G.setInstance, G.removeInstance], [true, null]);
eq('SetParTypeInstanceGroup: first argument used, Q4 logged', G.parType, [OKS, true, true]);
eq('RemoveParTypeInstanceGroup', G.parTypeRemove, [OKS, null]);
eq('Assign looks up a nested container (index 0); Unassign has no such fallback (0x80070057)', G.nested, [OKS, true, INVALID, true]);

// 7. views
const V = got.view;
eq('OpenXSIExplorer default: explorer view (class {ba75acc4-...}), scope 0 -> internal 3, toolbar on, returned in Value; status 1',
  V.def, [{ type: 'XSI Explorer', scope: 0, internal: 3, toolbar: true, reuse: true, reused: false, content: [], viewer: null, title: '' }, 1, NOTHING, '{ba75acc4-5ef1-4052-b1c1-7b4698a3175b}', true]);
eq('OpenXSIExplorer Reuse: the same view again', V.reused, [true, true, 1]);
eq('OpenXSIExplorer Scope 0..21 -> internal scope', V.scopes, [3, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 3, 3]);
eq('still one reused view', V.windowsAfterScopes, 1);
eq('OpenXSIExplorer Viewer / InputObjs / ShowToolbar false / Title / Reuse false: a new view with all of them applied',
  V.full, [{ type: 'XSI Explorer', scope: 0, internal: 3, toolbar: false, reuse: false, reused: false, content: ['tCube', 'tNull'], viewer: { name: 'Property Editor', clsid: '{5F3351D9-A33E-11D3-A93D-00C04F8EDEB9}' }, title: 'My Explorer' }, 2, 'My Explorer', true, true]);
ok('OpenXSIExplorer unknown Viewer: 0x80070057', V.badViewer.status === INVALID, V.badViewer);
eq('OpenXSIExplorer content this build cannot show: no view, placeholder result, logged', V.noContent, ['OpenXSIExplorer', 0, true]);
if (V.inspectPreferences !== undefined) eq('InspectPreferences (CMD-18b) keeps its stand-in window', V.inspectPreferences, { select: 'Preferences.output_format', page: 'C3DPrefsOutputFormat' });
eq('OpenTransientExplorer without a UI: empty list, no session', V.batch, [[], null]);
eq('OpenTransientExplorer Filter 0..9, another value, the default member -> node filter mask', V.masks, ['ffff', 'f7ff', '44f', '443', '5d3', '47b', '5eb', '401', '443', 'iface', '0', 'ffff']);
eq('OpenTransientExplorer: 300 x 300 pop-up, style word 0x12b1, ExpandLevel 0 shows the root only, single-select', V.open, ['300px', '300px', '0x12b1', ['Scene_Root'], false]);
eq('session terminated with nothing picked: empty list', V.nothingPicked, []);
eq('ExpandLevel 1 lists the children, sorted', V.sorted, [true, true]);
eq('single-select: a pick sets the result and ends the session', V.single, [['tCube'], null]);
eq('InitObjects are the initial content (unsorted when Sort is off)', V.multiRoots, ['tCube', 'tSphere', 'tNull']);
eq('picking notifications: set replaces, add appends, toggle flips, remove removes', V.notifications,
  [['tCube'], ['tCube', 'tSphere'], ['tSphere', 'tNull'], ['tNull'], ['tSphere', 'tCube'], ['tSphere', 'tCube', 'tNull']]);
eq('MultiSelect: the session stays open until terminated; Value is the result list', [V.multiStaysOpen, V.multi], [true, ['tSphere', 'tCube', 'tNull']]);
const A = V.att;
eq('OpenAttachments ForceExplorer with a target: transient explorer mode 9', A.forced, [9, 1]);
eq('OpenAttachments while the explorer is shown: hides it and stops', A.toggledOff, [null, 0]);
eq('OpenAttachments, target without attachments or annotations: message logged, falls back to the explorer', A.nothing, [9, true, true]);
eq('toggle closes it again', A.closed, 0);
eq('OpenAttachments, target with an annotation: InspectObj on the first annotation, no explorer', A.annotation, [[['Annotation']], 0]);
eq('OpenAttachments with attachment entries: the viewer is created for the target name, then reused', A.viewer, [[['tCube', ['n1,n2', 'p1,p2', 'k1,k2'], true]], 0]);

// 8. clusters
const L = got.cluster;
eq('SITogglePolygonVisibility without an InvisiblePolygons cluster: nothing done (Q5 logged)', L.noCluster, [NOTHING, true, 0]);
eq('test cluster', L.created, ['InvisiblePolygons', 'poly', [0, 1]]);
eq('toggle: some selected polygons are not members -> the non-members are added, members stay', L.add, [OKS, [0, 1, 2]]);
eq('toggle: every selected polygon is a member -> all removed', L.remove, [2]);
eq('toggle undo', L.undo, [0, 1, 2]);
eq('items on the same object are merged into one polygon set', L.merged, [2, 3, 4]);
eq('default InputObjs: the polygon selection', L.fromSelection, []);
ok('an item that is not a polygon item: 0x80070057', L.badItem.status === INVALID, L.badItem);
eq('nothing selected: nothing to do', L.nothingSelected, NOTHING);
eq('ClusterNonOverlapEnforcement errors: no category, non-cluster input, action 3 -> 0x80070057', L.errors.map(e => e.status), [INVALID, INVALID, INVALID]);
eq('action 1 (default): overlapping elements removed from the input cluster; OutputObj lists the overlapped cluster; clusters without the category are ignored',
  L.action1, [['B'], [0, 1], [2, 3], [1, 5], OKS, true]);
eq('action 1 undo', L.action1Undo, [0, 1, 2]);
eq('action 4: detect only', L.action4, [['B'], [0, 1, 2], [2, 3]]);
eq('action 2: removed from the other existing cluster', L.action2, [['B'], [0, 1, 2], [3]]);
eq('CategoryID (unregistered, read first) gives the category', L.categoryId, ['B']);
eq('Property given as an object whose nested property is taken', L.nestedProperty, ['B']);

// 9. active elements
const E = got.sel;
eq('SetActiveElements: active list := list', E.set, [OKS, ['tCube', 'tSphere']]);
eq('SetActiveElements, nothing changed: 0x562e80c7', E.setSame, CANCELLED);
eq('ActivateElements adds', E.activate, [OKS, ['tCube', 'tSphere', 'tNull']]);
eq('DeactivateElements removes', E.deactivate, [OKS, ['tCube', 'tNull']]);
eq('ToggleActiveElements: active items removed, the others added', E.toggle, [OKS, ['tNull', 'tSphere']]);
eq('undo sets the saved list back; redo re-applies', [E.undo, E.redo], [['tCube', 'tNull'], ['tNull', 'tSphere']]);
eq('SetAndToggleActiveElements: active list := first part (split rule Q6 logged)', E.setAndToggle, [OKS, ['tCube'], true]);
eq('SetActiveElements with an empty list clears; undo', [E.clear, E.clearUndo], [[OKS, []], ['tCube']]);
eq('HierarchyLevel outside 0..7: 0x80070057; level 4 rejected by Activate / Toggle / SetAndToggle, not by Deactivate', E.levels, [INVALID, INVALID, INVALID, INVALID, INVALID, NOTHING, ['tCube']]);
eq('CheckObjectSelectability drops unselectable objects; without it they are added', [E.checkSelectability, E.noCheck], [['tCube'], ['tCube', 'tSphere']]);
eq('component items: set', E.compSet, [['tCube', 'point', [0, 1]], ['tCube']]);
eq('component items: activate / toggle / deactivate / undo', [E.compAdd, E.compToggle, E.compRemove, E.compUndo],
  [['tCube', 'point', [0, 1, 2]], ['tCube', 'point', [1, 2, 3]], ['tCube', 'point', [2, 3]], ['tCube', 'point', [1, 2, 3]]]);
const X = got.tool;
eq('ActivateSampledPointSelTool defaults: filter SampledPoint set (deselect on new filter), SI3D_RECTSEL_REGION_MODE 1', X.def.slice(0, 4), [OKS, 'SampledPoint', 1, []]);
ok('the set-filter task and the key-mode branches are logged as not yet attested', X.def[4] >= 2, X.def);
eq('the deselection is undoable', X.deselectUndo, ['tCube']);
eq('...WithNoObjStateChange (DeselectOnNewFilter false): selection kept', X.noStateChange, [OKS, 'SampledPoint', ['tCube']]);
eq('same filter again: nothing deselected', X.sameFilter, [OKS, ['tCube']]);
eq('SelRegionMode outside 1..6: 0x80070057; 6 is set', X.badRegion, [INVALID, INVALID, OKS, 6]);
eq('GroupMode (unregistered) sets SI3D_GROUP_SEL_MODE', X.groupMode, true);
eq('another tool current: DeselectOnNewFilter forced off, the selection tool is activated', X.otherTool, [null, 1, ['tCube'], 1]);
eq('selection tool already current: not activated again', X.alreadyCurrent, 1);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B7a UI / group / view / cluster / selection task commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B7a UI / group / view / cluster / selection task commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer): Set/Get/Clear/Remove/Add UserKeyword + UserTab, SetParameterColor, ClearParameterColor, ClearThumbnail, OpenXSIExplorer, OpenTransientExplorer');
console.log('   partly wired: SetThumbnail (Q3), SetThumbnailFromRegion (region lookup + capture task), Assign/Unassign group family (Q4, container kinds), OpenAttachments (entries, viewer), SITogglePolygonVisibility (Q5), ClusterNonOverlapEnforcement (overlap test), active-elements commands (Q6, hierarchy levels), Activate...SampledPointSelTool (set-filter task, key modes)');
