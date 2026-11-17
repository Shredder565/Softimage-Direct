// CMD-B6c: the 28 uixsiscripts commands on the command bus (preferences import / export / restore / inspect,
// SIUpdate...FromGlobalPref, ICE tree branch / promote, point cloud group / split, view switching, camera sequencer
// layout / plot, rig OnUpdate callbacks, InfoGeometry, ParamBracketing, InspectLocks, RenamePropAndRebind[UI],
// SavePivotKey, TransferShapeAnimation, GetShaderOnCnxPointFunction, LockEnvelopeDeformerWeights).
// Checked against the "Wire contract" of docs/ghidra/cmd-b6c-uixsi-prefs-ice-views.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check: registration with
// the registry's argument list, a run with default arguments, and the contract's stated results.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_uixsi_prefs_ice_views_commands.mjs
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

// scripting name -> registry display name of the entry that is registered (the scripted / generic one)
const LABELS = {
  ImportPreferences: 'Import Preferences', ExportPreferences: 'Export Preferences', RestoreDefaultPreference: 'Restore Default Preference',
  InspectPreferences: 'Inspect Preferences', SIUpdateCamerasFromGlobalPref: 'Update Cameras', SIUpdateFxTreesFromGlobalPref: 'Update FxTrees',
  SIUpdatePlayControlFromGlobalPref: 'Update PlayControl', MakeICETreeBranch: 'MakeICETreeBranch', PromoteICETree: 'PromoteICETree',
  GroupPointClouds: 'GroupPointClouds', SplitCloud: 'SplitCloud', SwitchToView: 'Switch to View', SwitchToViewByType: 'Switch to View by Type',
  GetViewportUnderMouse: 'Get Viewport Under Mouse', SetFocusedViewport: 'Set Focused Viewport', SetCameraSequencerLayout: 'Reset Camera Sequencer Layout',
  PlotCameraSequencer: 'Plot Camera Sequencer', ManCharacterOnUpdate: 'Man Character update', BipedRigOnUpdate: 'Biped Rig update',
  InfoGeometry: 'Info Geometry', ParamBracketing: 'Parameter Bracketing', InspectLocks: 'InspectLocks', RenamePropAndRebind: 'RenamePropAndRebind',
  RenamePropAndRebindUI: 'RenamePropAndRebindUI', SavePivotKey: 'Save Pivot Key', TransferShapeAnimation: 'Transfer Shape Animation',
  GetShaderOnCnxPointFunction: '', LockEnvelopeDeformerWeights: 'Lock Envelope Deformer Weights',
};
const NAMES = Object.keys(LABELS);
// the other registry entries of the two multi-entry names: display name -> [command, argument, default]
const VARIANTS = {
  'Save Pivot Key on Scl': ['SavePivotKey', 'Type'], 'Save Pivot Key on Rot': ['SavePivotKey', 'Type'], 'Save Pivot Key on Pos': ['SavePivotKey', 'Type'],
  'Switch to Panel Weight': ['SwitchToViewByType', 'ViewType'], 'Switch to Panel Toolbar': ['SwitchToViewByType', 'ViewType'], 'Switch to Panel Palette': ['SwitchToViewByType', 'ViewType'],
};

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const entry = (n) => list.find(x => x.scripting_name === n && x.name === LABELS[n] && (n !== 'LockEnvelopeDeformerWeights' || x.language === 'VBScript'));
const registry = Object.fromEntries(NAMES.map(n => { const c = entry(n); return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));
const regCategory = Object.fromEntries(NAMES.map(n => [n, entry(n)?.category ?? null]));
const regVariants = Object.fromEntries(Object.entries(VARIANTS).map(([label, [cmd, arg]]) => { const c = list.find(x => x.scripting_name === cmd && x.name === label); return [label, c ? { command: cmd, args: { [arg]: c.args.find(a => a.name === arg)?.default } } : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('LockEnvelopeDeformerWeights') && !!window.__vm && !!window.__layout, null, { timeout: 120000 });
await page.waitForTimeout(800);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.uixsiPrefsIceViews; const root = app.scene.root; const vm = window.__vm;
  const out = {};
  const ser = (v) => v === undefined ? '<none>' : v === null ? null : Array.isArray(v) ? v.map(ser) : typeof v === 'object' ? (v.fullName ? `node:${v.name}` : typeof v.then === 'function' ? '<promise>' : `{${Object.keys(v).join(',')}}`) : v;
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: ser(v), raw: v }; } catch (e) { return { err: String(e?.message ?? e), name: e?.name }; } };
  const pub = (r) => r.err !== undefined ? { err: r.err } : { v: r.v };
  const mark = () => app.log.length;
  const logFrom = (i, kinds = ['info', 'error']) => app.log.slice(i).filter(l => kinds.includes(l.kind)).map(l => `${l.kind}:${l.text}`);
  const nya = (i, command) => logFrom(i, ['info']).filter(l => l.startsWith(`info:${command}: not yet attested`)).length;
  const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
  const settle = async (p) => { try { await p; return 'resolved'; } catch (e) { return e?.name ?? String(e); } };
  const find = (n) => app.scene.find(n);
  const names = () => [...app.scene.allObjects()].map(o => o.name);
  const Property = root.properties[0].constructor;
  const mkProp = (name, type, defs) => new Property(name, type, defs);
  const P = (name, type, value) => ({ name, type, value });
  const modalWin = () => [...document.querySelectorAll('.sdkh-modal-window')].pop() ?? null;
  const modalInfo = () => { const w = modalWin(); if (!w) return null; const b = w.querySelector('.sdkh-modal-content'); return { title: w.querySelector('.ppg-float-title')?.textContent ?? null, mode: b?.dataset.mode ?? null, filter: b?.dataset.filter ?? null }; };
  const modalClick = (ok) => modalWin()?.querySelector(ok ? '.sdkh-modal-ok' : '.sdkh-modal-cancel')?.click();
  const type = (sel, text) => { const i = modalWin()?.querySelector(sel); if (i) { i.value = text; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } return !!i; };
  const closeFloating = (title) => { let n = 0; for (const w of document.querySelectorAll('.ppg-float')) if (w.querySelector('.ppg-float-title')?.textContent === title) { [...w.querySelectorAll('.ppg-float-close')].pop()?.click(); n++; } return n; };
  const letterOfActive = () => 'ABCD'[vm.viewports().indexOf(vm.active())];
  const cube = find('cube'), sphere = find('sphere'), camera = find('Camera');
  app.autoInspect = false;
  const pref = (n) => S.prefs.get('output_format.' + n);

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.labels = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n)?.label ?? null]));
  out.categories = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n)?.category ?? null]));
  out.variants = S.variants;

  // ---- every command with default arguments, nothing selected
  out.defaults = {};
  for (const n of NAMES) {
    app.select([]); app.compSel = null; const m = mark(); const before = names().length;
    const r = run(n); let dialog = null, settled = null;
    if (r.raw && typeof r.raw.then === 'function') { const s = settle(r.raw); await tick(); dialog = modalInfo(); modalClick(false); settled = await s; }
    await tick(5);
    out.defaults[n] = { r: pub(r), log: logFrom(m), dialog, settled, made: names().length - before };
  }
  out.defaultsAfter = {
    netViews: S.netViews.map(v => [v.url.slice(v.url.lastIndexOf('/') + 1), v.reuse, v.flags, v.reused]),
    prefsWindow: closeFloating('Preferences'), focused: letterOfActive(),
    camera: ['std', 'aspect', 'pixelratio'].map(n => camera.primitive.val(n)), play: [app.anim.step, app.anim.fps, app.anim.frameFormat],
    plotCameraLeft: names().filter(n => /SequencerCamera_Plot/.test(n)).length,
  };
  for (const v of S.netViews) v.win?.close();
  window.dispatchEvent(new CustomEvent('vmlayout', { detail: { layout: 'standard' } }));
  vm.setActive(2); vm.view('Front'); vm.setActive(3); vm.view('Right'); vm.setActive(1);

  // ================= preferences
  {
    const d = {}; const file = 'c:\\prefs\\out.xsipref';
    d.categoryNames = [S.prefs.resolve('output_format')?.category, S.prefs.resolve('preferences.output_format.frame_rate')?.param, S.prefs.resolve('Preferences.time')?.key, S.prefs.resolve('nosuch')];
    S.prefs.set('output_format.frame_rate', 24);
    let m = mark();
    d.export = [pub(run('ExportPreferences', { FileName: file, Categories: 'output_format' })), logFrom(m), S.out.ExportPreferences];
    d.restoreOne = [pub(run('RestoreDefaultPreference', { PreferenceName: 'output_format.frame_rate' })), pref('frame_rate')];
    d.import = [pub(run('ImportPreferences', { FileName: file })), pref('frame_rate'), S.out.ImportPreferences];
    S.prefs.set('output_format.ir_xres', 640);
    d.restoreCategory = [pub(run('RestoreDefaultPreference', { PreferenceName: 'output_format' })), pref('frame_rate'), pref('ir_xres')];
    m = mark(); d.restoreUnknown = [pub(run('RestoreDefaultPreference', { PreferenceName: 'no_such_category' })), nya(m, 'RestoreDefaultPreference')];
    d.importMissing = run('ImportPreferences', { FileName: 'c:\\prefs\\missing.xsipref' }).err ?? null;
    m = mark(); d.exportUnknown = [pub(run('ExportPreferences', { FileName: 'c:\\prefs\\x.xsipref', Categories: 'no_such_category' })), nya(m, 'ExportPreferences')];
    // the file browser: Save mode, base name preset to Categories
    S.prefs.set('output_format.frame_rate', 25);
    let r = run('ExportPreferences', { Categories: 'output_format' }); let s = settle(r.raw); await tick();
    d.exportBrowser = [modalInfo(), modalWin()?.querySelector('.uixsi-browse-dir input')?.value, modalWin()?.querySelector('.uixsi-browse-name input')?.value];
    modalClick(true); d.exportBrowserDone = [await s, S.out.ExportPreferences];
    run('RestoreDefaultPreference', { PreferenceName: 'output_format' });
    r = run('ImportPreferences'); s = settle(r.raw); await tick();
    d.importBrowser = [modalInfo(), modalWin()?.querySelector('.uixsi-browse-dir input')?.value, modalWin()?.querySelector('.uixsi-browse-name input')?.value];
    type('.uixsi-browse-name input', 'output_format'); modalClick(true);
    d.importBrowserDone = [await s, pref('frame_rate'), S.out.ImportPreferences];
    // OK without a file name counts as no choice
    r = run('ImportPreferences'); s = settle(r.raw); await tick(); modalClick(true); d.importNoName = await s;
    run('RestoreDefaultPreference', { PreferenceName: 'output_format' });
    // batch: no browser, the import is called with the empty name
    app.Interactive = false; m = mark();
    d.batch = [pub(run('ImportPreferences')), modalWin() === null, nya(m, 'ImportPreferences'), pub(run('ExportPreferences')), nya(m, 'ExportPreferences')];
    app.Interactive = true;
    // InspectPreferences
    d.inspect = [pub(run('InspectPreferences', { Preference: 'output_format' })), S.lastInspectPreferences];
    await tick();
    const w = [...document.querySelectorAll('.ppg-float')].find(x => x.querySelector('.ppg-float-title')?.textContent === 'Preferences');
    d.inspectWindow = [!!w, !!w?.querySelector('.prefs-tree'), !!w?.querySelector('.prefs-page'), !!w?.querySelector('.prefs-item.active')];
    run('InspectPreferences', { Preference: 'preferences.time.somevalue' }); d.inspectDotted = S.lastInspectPreferences;
    run('InspectPreferences'); d.inspectEmpty = S.lastInspectPreferences;
    closeFloating('Preferences');
    out.prefs = d;
  }

  // ================= SIUpdateCamerasFromGlobalPref
  {
    const d = {}; const prim = camera.primitive; const reset = () => { prim.set('std', 9); prim.set('aspect', 1.333); prim.set('pixelratio', 0.9); };
    const vals = () => ['std', 'aspect', 'pixelratio'].map(n => prim.val(n));
    d.prefs = [pref('picture_standard'), pref('picture_ratio'), pref('roto_pixel_ratio')];
    reset(); const order = []; const off = prim.onChange((p) => order.push(p.name));
    d.run = pub(run('SIUpdateCamerasFromGlobalPref')); off();
    d.values = vals(); d.order = order;
    app.undo(); d.undo = vals(); app.redo();
    reset(); run('SIUpdateCamerasFromGlobalPref', { InputObjs: 'cube' }); d.notACamera = vals();
    run('SIUpdateCamerasFromGlobalPref', { InputObjs: 'cube,Camera' }); d.listed = vals();
    S.prefs.set('output_format.roto_pixel_ratio', 2); S.prefs.set('output_format.ir_pixel_ratio', 3);
    reset(); run('SIUpdateCamerasFromGlobalPref', { InputObjs: [camera] }); d.rotoRatio = prim.val('pixelratio');
    run('RestoreDefaultPreference', { PreferenceName: 'output_format' });
    out.cams = d;
  }

  // ================= SIUpdateFxTreesFromGlobalPref
  {
    const d = {}; const fx = () => mkProp('FxTree', 'FxTree', [P('DefaultWidth', 'int', 0), P('DefaultHeight', 'int', 0), P('PixelRatio', 'double', 0)]);
    const vals = (p) => ['DefaultWidth', 'DefaultHeight', 'PixelRatio'].map(n => p.val(n));
    const model = run('CreateModel', { InputObj: '', Name: 'FxModel' }).raw;
    const a = fx(), b = fx(), other = mkProp('NotFx', 'customparamset', [P('DefaultWidth', 'int', 0)]), onObject = fx();
    root.addProperty(a); model.addProperty(b); root.addProperty(other); cube.addProperty(onObject);
    d.run = pub(run('SIUpdateFxTreesFromGlobalPref'));
    d.values = [vals(a), vals(b), other.val('DefaultWidth'), vals(onObject)];
    app.undo(); d.undo = vals(a);
    S.prefs.set('output_format.ir_xres', 800); S.prefs.set('output_format.ir_yres', 600); S.prefs.set('output_format.ir_pixel_ratio', 1.5);
    d.listed = [pub(run('SIUpdateFxTreesFromGlobalPref', { InputObjs: [onObject, other] })), vals(onObject), other.val('DefaultWidth'), vals(a)];
    run('RestoreDefaultPreference', { PreferenceName: 'output_format' });
    root.removeProperty(a); root.removeProperty(other); cube.removeProperty(onObject);
    out.fx = d;
  }

  // ================= SIUpdatePlayControlFromGlobalPref
  {
    const d = {}; const play = () => [app.anim.step, app.anim.fps, app.anim.frameFormat];
    S.prefs.set('output_format.frame_step', 2); S.prefs.set('output_format.frame_rate', 24); S.prefs.set('output_format.frame_format', 7);
    const before = play();
    d.run = pub(run('SIUpdatePlayControlFromGlobalPref')); d.values = play();
    app.undo(); d.undo = JSON.stringify(play()) === JSON.stringify(before); app.redo();
    run('RestoreDefaultPreference', { PreferenceName: 'output_format' });
    run('SIUpdatePlayControlFromGlobalPref'); d.defaults = play();
    out.play = d;
  }

  // ================= ICE trees
  {
    const d = {};
    const mkCloud = (name) => run('CreatePrim', { PresetObj: 'Empty', GeometryType: 'PointCloud', Name: name }).raw;
    const mkNull = (name, parent) => { const n = run('GetPrim', { PresetObj: 'Null', Name: name }).raw; if (parent) parent.addChild(n); return n; };
    const grp = mkNull('iceGrp'), sub = mkNull('iceSub', grp);
    const pc = mkCloud('pc'); const tree = run('CreateICETree', { InputObjs: 'pc' }).raw; sub.addChild(pc);
    d.setup = [pc.type, tree.type, pc.parentObj.name, sub.parentObj.name, grp.parentObj === root];
    let m = mark();
    d.notATree = [pub(run('MakeICETreeBranch', { Operator: cube.primitive.operators[0] })), pub(run('MakeICETreeBranch', { Operator: cube })), logFrom(m)];
    m = mark();
    d.branch = [pub(run('MakeICETreeBranch', { Operator: tree })), tree.branch === true, tree.branchHost === pc, pc.primitive.operators.includes(tree), nya(m, 'MakeICETreeBranch')];
    app.undo(); d.branchUndo = [tree.branch === undefined, tree.branchHost === undefined]; app.redo();
    const pc2 = mkCloud('pc2'); const tree2 = run('CreateICETree', { InputObjs: 'pc2' }).raw;
    run('MakeICETreeBranch', { Operator: 'pc2.ICETree' }); d.byName = [tree2.branch === true, tree2.branchHost === pc2];
    m = mark();
    d.promote1 = [pub(run('PromoteICETree', { Operator: tree })), tree.branchHost?.name, nya(m, 'PromoteICETree')];
    d.promote2 = [pub(run('PromoteICETree', { Operator: tree })), tree.branchHost?.name];
    m = mark(); d.promoteAtRoot = [pub(run('PromoteICETree', { Operator: tree })), tree.branchHost?.name, logFrom(m)];
    m = mark(); d.promoteUnderRoot = [pub(run('PromoteICETree', { Operator: tree2 })), tree2.branchHost === pc2, logFrom(m)];
    d.promoteNotATree = [pub(run('PromoteICETree', { Operator: cube.primitive.operators[0] })), pub(run('PromoteICETree'))];
    app.undo(); // the last undoable command: promote2
    d.promoteUndo = tree.branchHost?.name;

    // ---- GroupPointClouds
    const g = {}; const a = mkCloud('pcA'), b = mkCloud('pcB'); sub.addChild(a);
    app.select([a, b, cube]); let before = new Set(names());
    let r = run('GroupPointClouds');
    let made = names().filter(n => !before.has(n)).map(find);
    g.fromSelection = [r.v, made.length, made[0]?.type, made[0]?.parentObj?.name, a.parentObj === made[0], b.parentObj === made[0], cube.parentObj === root, app.selection.length === 1 && app.selection[0] === made[0], r.raw === made[0]];
    app.undo(); g.undo = [a.parentObj?.name, b.parentObj === root, names().includes(made[0]?.name)];
    before = new Set(names());
    r = run('GroupPointClouds', { InputObjs: 'pcB,pcA,cube', Name: 'Grp', Parent: 'iceGrp' });
    g.named = [r.v, r.raw?.parentObj?.name, a.parentObj === r.raw, b.parentObj === r.raw, r.raw?.children.map(c => c.name)];
    before = names().length; app.select([]);
    g.oneCloud = [pub(run('GroupPointClouds', { InputObjs: 'pcA,cube' })), names().length - before];
    g.noCloud = [pub(run('GroupPointClouds', { InputObjs: 'cube,sphere' })), pub(run('GroupPointClouds')), names().length - before];
    d.group = g;

    // ---- SplitCloud
    const s = {}; const pcS = mkCloud('pcS'); const treeS = run('CreateICETree', { InputObjs: 'pcS' }).raw; sub.addChild(pcS);
    before = new Set(names()); m = mark(); app.select([]);
    r = run('SplitCloud', { InputObj: 'pcS' });
    made = names().filter(n => !before.has(n)).map(find);
    const eff = made.find(o => o.type === 'null'), copy = made.find(o => o.type === 'pointcloud');
    s.run = [r.v, r.raw === eff, eff?.name, eff?.parentObj?.name, pcS.parentObj === eff, treeS.branch === true, treeS.branchHost === eff, app.selection.length === 1 && app.selection[0] === eff];
    s.copy = [made.length, !!copy, copy ? copy.primitive.operators.some(o => o.type === 'icetree') : null, nya(m, 'SplitCloud') >= 1];
    const pcT = mkCloud('pcT'); app.select([pcT]);
    r = run('SplitCloud', { Name: 'Fx' }); s.named = [r.v, pcT.parentObj?.name, pcT.parentObj?.parentObj === root];
    before = names().length; s.notACloud = [pub(run('SplitCloud', { InputObj: 'cube' })), names().length - before];
    app.select([]); d.split = s;
    out.ice = d;
  }

  // ================= views
  {
    const d = {}; const view = (n) => S.views().find(v => v.name === n);
    d.before = [view('explorer')?.visible, view('weight_paint_panel')?.visible, view('palettes')?.visible];
    d.byName = [pub(run('SwitchToView', { ViewName: 'explorer' })), view('explorer')?.visible];
    d.byType = [pub(run('SwitchToViewByType', { ViewType: 'Weight Paint Panel' })), view('weight_paint_panel')?.visible];
    d.variant = [ser(S.runVariant('Switch to Panel Palette')), view('palettes')?.visible];
    const m = mark();
    d.unknown = [pub(run('SwitchToView', { ViewName: 'no such view' })), pub(run('SwitchToViewByType', { ViewType: 'no such type' })), pub(run('SwitchToViewByType', { ViewType: 'weight paint panel' })), logFrom(m), view('palettes')?.visible];
    d.back = [ser(S.runVariant('Switch to Panel Toolbar')), view('toolbar_panel')?.visible];
    out.views = d;
  }

  // ================= viewports
  {
    const d = {}; const vps = vm.viewports(); const VM = S.viewManager;
    d.focus = [pub(run('SetFocusedViewport', { Viewport: 'C' })), letterOfActive(), vps[2].el.classList.contains('active'), vps[1].el.classList.contains('active'), VM.get('focusedviewport')];
    run('SetFocusedViewport', { Viewport: 'a' }); d.lowerCase = letterOfActive();
    run('SetFocusedViewport', { Viewport: 'Z' }); d.noValidation = letterOfActive();
    const over = (i) => { const r = vps[i].el.getBoundingClientRect(); window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true })); };
    over(3); d.underMouse = pub(run('GetViewportUnderMouse'));
    over(0); d.underMouse2 = [pub(run('GetViewportUnderMouse')), letterOfActive()];
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1, clientY: 1, bubbles: true })); d.lastPane = pub(run('GetViewportUnderMouse'));
    d.log = (() => { const m = mark(); run('GetViewportUnderMouse'); return app.log.slice(m).filter(l => l.kind === 'cmd').length; })();

    // ---- SetCameraSequencerLayout
    const c = {}; run('SetFocusedViewport', { Viewport: 'B' });
    VM.trace.length = 0; let m = mark();
    c.run = pub(run('SetCameraSequencerLayout')); c.trace = VM.trace.map(t => t.join('='));
    c.after = [letterOfActive(), vps.map(v => v.name), nya(m, 'SetCameraSequencerLayout')];
    const r1 = vps[1].el.getBoundingClientRect(), r0 = vps[0].el.getBoundingClientRect(); c.alternate = r1.width > r0.width * 2;
    // a shot clip at the current frame names the camera of the editing pane; the pane ids are mapped
    const Cam = camera.constructor; const shotCam = new Cam('ShotCam'); root.addChild(shotCam);
    root.cameraSequencer = { tracks: [{ name: 'Shot_Track', clips: [{ name: 'shot', source: 'ShotCam', start: 1, duration: 50, type: 'camerashotclip' }] }] };
    run('SetFocusedViewport', { Viewport: 'B' }); VM.trace.length = 0;
    run('SetCameraSequencerLayout', { EditorViewportID: 'siViewportD', SequencerCameraViewportID: 'siViewportC', CameraEditingViewportID: ':siViewportFocussed:siViewport', UserViewportID: 'siViewportA' });
    c.mapped = VM.trace.map(t => t.join('=')); c.mappedAfter = [letterOfActive(), vps.map(v => v.name)];
    root.cameraSequencer = { tracks: [] }; root.removeChild(shotCam);
    app.Interactive = false; VM.trace.length = 0; c.batch = [pub(run('SetCameraSequencerLayout')), VM.trace.length]; app.Interactive = true;
    window.dispatchEvent(new CustomEvent('vmlayout', { detail: { layout: 'standard' } }));
    vm.setActive(0); vm.view('Top'); vm.setActive(1); vm.view('Camera'); vm.setActive(2); vm.view('Front'); vm.setActive(3); vm.view('Right'); vm.setActive(1);
    d.seq = c; out.vp = d;
  }

  // ================= PlotCameraSequencer
  {
    const d = {}; const mix = root.properties.find(p => p.type === 'mixer'); if (!mix.clips) mix.clips = []; if (!mix.compounds) mix.compounds = [];
    const clipNames = () => [mix.clips.map(c => c.name), mix.compounds.map(c => c.name)];
    const fill = () => { mix.clips.splice(0, mix.clips.length, { name: 'oldAnim', source: 'none', start: 1, duration: 10 }, { name: 'oldShape', source: 'none', start: 1, duration: 10, type: 'mixershapeclip' }, { name: 'oldAudio', source: 'none', start: 1, duration: 10, type: 'mixeraudioclip' }); mix.compounds.splice(0, mix.compounds.length, { name: 'oldCompound', clips: [], start: 1, duration: 10 }); };
    fill(); const range0 = [app.anim.startFrame, app.anim.endFrame]; let before = names().length;
    // default arguments: the sequencer camera plot of this build is empty, so its failure propagates (steps 1 to 6)
    let r = run('PlotCameraSequencer'); d.noSequencer = [/status 0x80004004/.test(r.err ?? ''), clipNames(), names().length - before, [app.anim.startFrame, app.anim.endFrame]];
    r = run('PlotCameraSequencer', { StartFrame: 50, EndFrame: 10 }); d.badRange = /status 0x80070057/.test(r.err ?? '');
    app.seqCam.plot = () => ({ curves: { 'kine.local.posx': [{ time: 5, value: 0 }, { time: 40, value: 7 }] }, constants: {} });
    let m = mark(); before = new Set(names());
    r = run('PlotCameraSequencer', { StartFrame: 5, EndFrame: 40 });
    const cam = names().filter(n => !before.has(n)).map(find).find(o => o.type === 'camera');
    d.applied = [pub(r), cam?.name, cam ? (app.anim.fcurve(cam.kinematics.local.get('posx'))?.keys.length ?? 0) : null, clipNames(), [app.anim.startFrame, app.anim.endFrame], S.out.PlotCameraSequencer];
    d.notes = [nya(m, 'PlotCameraSequencer'), logFrom(m, ['error'])];
    app.undo(); d.undo = [clipNames(), [app.anim.startFrame, app.anim.endFrame], names().includes(cam?.name)];
    // ApplyToCamera false: the plotted camera's clip is the one animation clip that stays
    fill(); r = run('PlotCameraSequencer', { StartFrame: 3, EndFrame: 30, SequencerCameraName: 'PlotCam2', ApplyToCamera: false, PlotWithoutGaps: true });
    d.clipKept = [pub(r), clipNames(), !!find('PlotCam2'), [app.anim.startFrame, app.anim.endFrame]];
    app.undo(); app.seqCam.plot = null; mix.clips.length = 0; mix.compounds.length = 0;
    app.anim.startFrame = range0[0]; app.anim.endFrame = range0[1];
    out.plot = d;
  }

  // ================= rig callbacks
  {
    const d = {}; const pos = cube.primitive.mesh().positions; const pt = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    app.selectComponents(cube, 'point', [0]); const c0 = run('CreateCluster', { Name: 'outer' }).raw;
    app.selectComponents(cube, 'point', [6, 2]); const c1 = run('CreateCluster', { Name: 'upper' }).raw;
    app.setSelMode('object'); app.select([]);
    const first = (c) => Number([...c.elements][0]); const p = pt(first(c0)), q = pt(first(c1));
    const expected = Math.sqrt(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1])) / 4 + 0.005;
    const target = find('root_null'); const local = target.kinematics.local; const scl = () => ['sclx', 'scly', 'sclz'].map(n => Math.round(local.val(n) * 1e6) / 1e6);
    const ctx = { Parameters: { Eye_scaling_factor: { Value: 4 } } };
    let m = mark();
    d.man = [pub(run('ManCharacterOnUpdate', { UpdateContext: ctx, InMesh: { Value: cube.primitive }, InOuter: { Value: c0 }, InUpper: { Value: c1 }, Out: { Value: local } })), scl(), Math.round(expected * 1e6) / 1e6, expected > 0.005, logFrom(m)];
    const plain = {}; run('ManCharacterOnUpdate', { UpdateContext: { Parameters: (n) => ({ Value: n === 'Eye_scaling_factor' ? 2 : NaN }) }, InMesh: cube, InOuter: c0, InUpper: c1, Out: { Value: plain } });
    d.manPlain = [Math.round(plain.sclx * 1e6) / 1e6, plain.sclx === plain.scly && plain.scly === plain.sclz, Math.round((Math.sqrt(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1])) / 2 + 0.005) * 1e6) / 1e6];
    m = mark(); const o2 = {};
    d.manNotCluster = [pub(run('ManCharacterOnUpdate', { UpdateContext: ctx, InMesh: cube.primitive, InOuter: { Value: cube }, InUpper: 5, Out: { Value: o2 } })), logFrom(m), typeof o2.sclx === 'number' && o2.sclx === o2.sclz];
    local.set('sclx', 1); local.set('scly', 1); local.set('sclz', 1);
    const biped = (port, h) => { const o = { Name: port }; run('BipedRigOnUpdate', { UpdateContext: { Parameters: { SteppingAngle: { Value: 30 } } }, InHandle: { Value: h }, Out: o }); return 'Value' in o ? o.Value : '<not written>'; };
    d.biped = {
      heel: [-5, 0, 10].map(h => biped('heel_out', h)), toe: [-5, 20, 30, 40].map(h => biped('toe_out', h)), mid: [-5, 0, 10, 30, 45].map(h => biped('mid_out', h)), other: biped('knee_out', 10),
    };
    d.bipedNumber = (() => { const o = { Name: 'toe_out' }; run('BipedRigOnUpdate', { UpdateContext: { Parameters: { SteppingAngle: 10 } }, InHandle: 25, Out: o }); return o.Value; })();
    out.rig = d; out._clusters = [c0.name, c1.name];
  }

  // ================= HTML pages
  {
    const d = {}; const wins = () => document.querySelectorAll('.uixsi-netview-window').length; const last = () => { const v = S.netViews[S.netViews.length - 1]; return [v.url, v.reuse, v.flags, v.reused]; };
    const w0 = wins(); let m = mark();
    d.info = [pub(run('InfoGeometry')), last(), wins() - w0, nya(m, 'InfoGeometry')];
    d.infoAgain = [pub(run('InfoGeometry')), wins() - w0];
    d.bracketing = [pub(run('ParamBracketing')), last(), wins() - w0];
    app.select([sphere]);
    d.locks = [pub(run('InspectLocks', { InputObj: 'cube' })), last(), wins() - w0, app.selection.map(n => n.name), document.querySelector('.uixsi-netview-window:last-of-type .uixsi-netview-url')?.textContent ?? [...document.querySelectorAll('.uixsi-netview-url')].pop()?.textContent];
    for (const v of S.netViews) v.win?.close();
    app.select([cube]);
    d.locksFresh = [pub(run('InspectLocks')), last()[3], wins(), app.selection.map(n => n.name)];
    for (const v of S.netViews) v.win?.close(); d.closed = wins(); app.select([]);
    out.pages = d;
  }

  // ================= RenamePropAndRebind
  {
    const d = {}; const prop = mkProp('MyProj', 'customparamset', [P('amount', 'double', 1)]); const ref = mkProp('Uses', 'customparamset', [P('tspace', 'string', 'MyProj'), P('other', 'string', 'Else')]);
    const taken = mkProp('Taken', 'customparamset', []);
    cube.addProperty(prop); cube.addProperty(ref); cube.addProperty(taken);
    let m = mark();
    d.rename = [pub(run('RenamePropAndRebind', { Properties: [prop], NewName: 'NewProj' })), prop.name, ref.val('tspace'), ref.val('other'), nya(m, 'RenamePropAndRebind')];
    app.undo(); d.undo = [prop.name, ref.val('tspace')];
    d.noRefs = [pub(run('RenamePropAndRebind', { Properties: 'cube.MyProj', NewName: 'Second', UpdateRefs: false })), prop.name, ref.val('tspace')];
    ref.set('tspace', 'Second');
    d.collision = [pub(run('RenamePropAndRebind', { Properties: [prop], NewName: 'Taken' })), prop.name, ref.val('tspace')];
    app.select([prop]); d.fromSelection = [pub(run('RenamePropAndRebind', { NewName: 'Picked' })), prop.name]; app.select([]);
    m = mark(); d.emptyName = [pub(run('RenamePropAndRebind', { Properties: [prop] })), prop.name, nya(m, 'RenamePropAndRebind')];
    // UI
    const dlgProp = () => root.properties.find(p => p.type === 'RenamePropertyDialog');
    const rows = () => [...(modalWin()?.querySelectorAll('.sdkh-row') ?? [])].map(r => [r.dataset.param, r.querySelector('input')?.type === 'checkbox' ? r.querySelector('input').checked : r.querySelector('input')?.value]);
    let r = run('RenamePropAndRebindUI', { Properties: [prop], UpdateWildcards: true }); let s = settle(r.raw); await tick();
    d.ui = [modalInfo()?.title, rows(), dlgProp()?.name];
    type('.sdkh-row[data-param="newname"] input', 'FromDialog'); modalClick(true);
    d.uiOk = [await s, prop.name, !!dlgProp(), S.out.RenamePropAndRebind, S.out.RenamePropAndRebindUI];
    r = run('RenamePropAndRebind', { Properties: [prop], NewName: 'Offered', UpdateRefs: false, ShowUI: true }); s = settle(r.raw); await tick();
    d.uiGiven = [modalInfo()?.title, rows()];
    modalClick(false); d.uiCancel = [await s, prop.name, !!dlgProp()];
    r = run('RenamePropAndRebindUI', { Properties: [prop, taken], NewName: 'Many' }); s = settle(r.raw); await tick();
    d.uiMany = modalInfo()?.title; modalClick(false); await s;
    app.Interactive = false; r = run('RenamePropAndRebindUI', { Properties: [prop], NewName: 'Batch' }); d.uiBatch = [r.name ?? pub(r), prop.name, !!dlgProp(), modalWin() === null]; app.Interactive = true;
    cube.removeProperty(prop); cube.removeProperty(ref); cube.removeProperty(taken);
    out.rename = d;
  }

  // ================= SavePivotKey
  {
    const d = {}; const l = cube.kinematics.local; const P3 = ['pposx', 'pposy', 'pposz'].map(n => l.get(n));
    const fc = (p) => { const f = app.anim.fcurve(p); return f ? f.keys.map(k => [k.time, k.value, k.interp]) : null; };
    const clear = () => { for (const p of P3) app.anim.removeAnimation(p); };
    l.set('pposx', 2); l.set('pposy', 3); app.anim.setKey(P3[0], 1, 0.5); app.anim.frame = 7; l.set('pposx', 2);
    app.select([cube]); let m = mark();
    d.run = [pub(run('SavePivotKey')), P3.map(fc), app.anim.fcurve(P3[0])?.interp, S.out.SavePivotKey, app.anim.frame];
    d.missing = logFrom(m).filter(x => /SavePivotKey: not yet attested/.test(x)).map(x => x.replace(/^.*parameter\(s\) ([^(]*) \(.*$/, '$1'));
    app.undo(); d.undo = P3.map(fc);
    clear(); app.anim.setExpression(P3[1], '1 + 1', () => undefined); m = mark();
    run('SavePivotKey', { InputObjs: 'cube', Time: 7 });
    d.expression = [logFrom(m).filter(x => /WARNING/.test(x)), fc(P3[1]), fc(P3[0])?.length, fc(P3[2])?.length];
    app.anim.removeAnimation(P3[1]); clear();
    // the group table: "any common bit" against the transform filter values (Q6); with the inferred bit set every type reaches every group
    d.filter = S.transformFilter;
    S.runVariant('Save Pivot Key on Scl'); d.sclInferred = P3.map(p => fc(p)?.length ?? 0); clear();
    const saved = { ...S.transformFilter }; Object.assign(S.transformFilter, { siScl: 1, siRot: 2, siTrn: 4, siSR: 8, siST: 16, siRT: 32, siSRT: 64 });
    S.runVariant('Save Pivot Key on Scl'); d.sclDisjoint = P3.map(p => fc(p)?.length ?? 0); clear();
    S.runVariant('Save Pivot Key on Pos'); d.posDisjoint = P3.map(p => fc(p)?.length ?? 0); clear();
    run('SavePivotKey', { Type: 0 }); d.zeroIsSRT = P3.map(p => fc(p)?.length ?? 0); clear();
    Object.assign(S.transformFilter, saved);
    app.select([]); m = mark(); d.nothingSelected = [pub(run('SavePivotKey')), logFrom(m)];
    l.set('pposx', 0); l.set('pposy', 0); app.anim.frame = 1;
    out.pivot = d;
  }

  // ================= TransferShapeAnimation
  {
    const d = {}; const key = (o, name) => { app.select([o]); const k = run('StoreShapeKey', { Name: name }).raw; app.select([]); return k; };
    const a1 = key(cube, 'A1'), a2 = key(cube, 'A2'), b1 = key(sphere, 'B1'), b2 = key(sphere, 'B2');
    d.setup = [a1.type, a1.parent === cube, b1.parent === sphere];
    const errs = (args) => { const m = mark(); const r = run('TransferShapeAnimation', args); return [pub(r), logFrom(m)]; };
    d.same = errs({ SourceObject: 'cube', DestinationObject: cube, SourceShapeKeys: [a1], DestinationShapeKeys: [a2] });
    d.notCollections = errs({ SourceObject: cube, DestinationObject: sphere, SourceShapeKeys: 'A1', DestinationShapeKeys: [b1] });
    const S1 = [a1, a1, a2], D1 = [b1];
    d.count = [errs({ SourceObject: cube, DestinationObject: sphere, SourceShapeKeys: S1, DestinationShapeKeys: D1 }), S1.length];
    d.srcNotKey = errs({ SourceObject: cube, DestinationObject: sphere, SourceShapeKeys: [a1, cube.properties[0]], DestinationShapeKeys: [cube.properties[1], b2] });
    d.srcNotNested = errs({ SourceObject: cube, DestinationObject: sphere, SourceShapeKeys: [b1], DestinationShapeKeys: [b2] });
    d.dstNotKey = errs({ SourceObject: cube, DestinationObject: sphere, SourceShapeKeys: [a1], DestinationShapeKeys: [sphere.properties[0]] });
    d.dstNotNested = errs({ SourceObject: cube, DestinationObject: sphere, SourceShapeKeys: [a1], DestinationShapeKeys: [a2] });
    // valid: handed to SITransferShapeAnimation with the same four arguments
    const low = app.commands.get('SITransferShapeAnimation'); let seen = null;
    if (low) { const ex = low.execute; low.execute = (_app, args) => { seen = [args.SourceObject === cube, args.DestinationObject === sphere, args.SourceShapeKeys.length, args.DestinationShapeKeys.length]; return undefined; };
      d.delegated = [errs({ SourceObject: cube, DestinationObject: sphere, SourceShapeKeys: [a1, a2, a1], DestinationShapeKeys: [b1, b2] }), seen]; low.execute = ex; }
    d.lowLevelOnBus = !!low;
    // without that command: the stand-in copies the weight animation by position
    app.commands.delete('SITransferShapeAnimation');
    const w = (k) => k.get('weight'); app.anim.setKey(w(a1), 1, 0); app.anim.setKey(w(a1), 10, 1); w(a2).value = 0.25;
    const m = mark();
    d.standIn = [pub(run('TransferShapeAnimation', { SourceObject: cube, DestinationObject: 'sphere', SourceShapeKeys: [a1, a2], DestinationShapeKeys: [b1, b2] })), app.anim.fcurve(w(b1))?.keys.map(k => [k.time, k.value]), w(b2).value, nya(m, 'TransferShapeAnimation'), logFrom(m, ['error'])];
    app.undo(); d.standInUndo = [app.anim.fcurve(w(b1))?.keys.length ?? 0, w(b2).value];
    if (low) app.commands.set('SITransferShapeAnimation', low);
    app.anim.removeAnimation(w(a1));
    out.shape = d;
  }

  // ================= GetShaderOnCnxPointFunction
  {
    const d = {}; const mat = app.scene.materials[0]; const surf = mat.surface; const Shader = surf.constructor;
    d.surface = [run('GetShaderOnCnxPointFunction', { InputObj: `${mat.name}.surface` }).raw === surf, run('GetShaderOnCnxPointFunction', { InputObj: mat }).raw === surf];
    const tex = new Shader('Tex', 'Image', []); surf.connect('diffuse', tex);
    d.port = [run('GetShaderOnCnxPointFunction', { InputObj: `${mat.name}.${surf.name}.diffuse` }).raw === tex, run('GetShaderOnCnxPointFunction', { InputObj: [`${surf.name}.diffuse`] }).raw === tex];
    d.unconnected = [pub(run('GetShaderOnCnxPointFunction', { InputObj: `${mat.name}.${surf.name}.specular` })), pub(run('GetShaderOnCnxPointFunction', { InputObj: 'cube' }))];
    surf.connect('diffuse', null);
    const low = { name: 'SIGetShaderOnCnxPoint', args: [{ name: 'InputObj', default: null }], undoable: false, execute: (_a, args) => `low:${args.InputObj}` };
    app.commands.set(low.name, low); d.delegated = pub(run('GetShaderOnCnxPointFunction', { InputObj: 'x.y' })); app.commands.delete(low.name);
    out.shader = d;
  }

  // ================= LockEnvelopeDeformerWeights
  {
    const d = {};
    const g = run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'lockGrid' }).raw;
    const L = run('GetPrim', { PresetObj: 'Null', Name: 'lockL' }).raw, R = run('GetPrim', { PresetObj: 'Null', Name: 'lockR' }).raw;
    d.envelope = pub(run('ApplyFlexEnv', { ConnectionSet: 'lockGrid', DeformerSet: 'lockL,lockR', Mode: 0 })).err ?? 'ok';
    const env = g.primitive.operators.find(o => o.weights && o.deformers); const locked = () => [...(env.lockedDeformers ?? [])].map(o => o.name).sort();
    app.select([]); let m = mark();
    d.lock = [pub(run('LockEnvelopeDeformerWeights', { PropObj: 'lockGrid', Deformers: 'lockL' })), locked(), nya(m, 'LockEnvelopeDeformerWeights')];
    run('LockEnvelopeDeformerWeights', { PropObj: g, Deformers: [L, R] }); d.both = locked();
    run('LockEnvelopeDeformerWeights', { PropObj: 'lockGrid', Deformers: 'lockL', Locked: false }); d.unlock = locked();
    app.undo(); d.undo = locked();
    app.select([g]); run('LockEnvelopeDeformerWeights', { Deformers: 'lockR', Locked: false }); d.fromSelection = locked(); app.select([]);
    m = mark(); d.noEnvelope = [pub(run('LockEnvelopeDeformerWeights', { PropObj: 'cube', Deformers: 'lockL' })), nya(m, 'LockEnvelopeDeformerWeights')];
    m = mark(); d.noDeformers = [pub(run('LockEnvelopeDeformerWeights', { PropObj: 'lockGrid' })), pub(run('LockEnvelopeDeformerWeights', { PropObj: 'lockGrid', Deformers: 'cube' })), nya(m, 'LockEnvelopeDeformerWeights'), locked()];
    out.lock = d;
  }

  await tick(50);
  out.leftover = [modalWin() === null, document.querySelectorAll('.sdkh-modal-backdrop').length, document.querySelectorAll('.uixsi-netview-window').length, app.activeTool === null];
  try { localStorage.removeItem('si.prefs'); } catch { /* ignore */ }
  return out;
}, { NAMES });

await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const NONE = { v: '<none>' };
const FACTORY = 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2/Application/views/html/';
const FILTER = 'xsipref (*.xsipref)|*.xsipref|All Files (*.*)|*.*||';

// ---- registration
for (const n of NAMES) {
  ok(`${n}: registry entry found in data/commands_full.json`, registry[n] !== null, n);
  eq(`${n}: registered with the registry's arguments and defaults`, got.reg[n], registry[n]);
}
eq('display names', got.labels, LABELS);
eq('categories', got.categories, regCategory);
eq('other registry entries of SavePivotKey / SwitchToViewByType are variants', got.variants, regVariants);

// ---- defaults
const D = got.defaults;
for (const n of NAMES) ok(`${n}: runs with default arguments (or raises the contract's error)`, D[n].r.err === undefined || n === 'PlotCameraSequencer', D[n]);
eq('ImportPreferences default: browser "Import a Category of Preferences" (Open), Cancel = siErrCancelled', [D.ImportPreferences.dialog, D.ImportPreferences.settled], [{ title: 'Import a Category of Preferences', mode: 'open', filter: FILTER }, 'siErrCancelled']);
eq('ExportPreferences default: browser "Export a Category of Preferences" (Save), Cancel = siErrCancelled', [D.ExportPreferences.dialog, D.ExportPreferences.settled], [{ title: 'Export a Category of Preferences', mode: 'save', filter: FILTER }, 'siErrCancelled']);
eq('RenamePropAndRebindUI default: modal page, Cancel = siErrCancelled', [D.RenamePropAndRebindUI.dialog?.title, D.RenamePropAndRebindUI.settled], ['Rename ', 'siErrCancelled']);
ok('PlotCameraSequencer default: the failure of the sequencer camera plot propagates (E_ABORT; this build has no Camera Sequencer)', /status 0x80004004/.test(D.PlotCameraSequencer.r.err ?? ''), D.PlotCameraSequencer);
eq('TransferShapeAnimation default: source = destination (both empty)', D.TransferShapeAnimation.log, ['error:TransferShapeAnimation: the destination needs to be different than the target.']);
eq('ManCharacterOnUpdate default: two non-cluster inputs logged, carries on', D.ManCharacterOnUpdate.log, ['info:Expected cluster, got Nothing', 'info:Expected cluster, got Nothing']);
eq('GetViewportUnderMouse default: the pane letter', D.GetViewportUnderMouse.r, { v: 'B' });
for (const n of ['MakeICETreeBranch', 'PromoteICETree', 'GroupPointClouds', 'SplitCloud', 'SwitchToView', 'SwitchToViewByType', 'SetFocusedViewport', 'BipedRigOnUpdate', 'SavePivotKey', 'GetShaderOnCnxPointFunction', 'SIUpdateFxTreesFromGlobalPref'])
  eq(`${n} default: nothing returned, nothing logged, nothing created`, [D[n].r, D[n].log, D[n].made], [NONE, [], 0]);
eq('defaults: InfoGeometry / ParamBracketing / InspectLocks pages (Reuse false, false, true; Flags 1)', got.defaultsAfter.netViews, [['InfoGeometry.htm', false, 1, false], ['ParamBracketing.htm', false, 1, false], ['InfoLocks.htm', true, 1, true]]);
eq('defaults: InspectPreferences opened the Preferences window', got.defaultsAfter.prefsWindow, 1);
eq('defaults: SetCameraSequencerLayout left pane D focused', got.defaultsAfter.focused, 'D');
eq('defaults: SIUpdateCamerasFromGlobalPref / SIUpdatePlayControlFromGlobalPref wrote the output_format preferences', [got.defaultsAfter.camera, got.defaultsAfter.play], [[18, 1.777778, 1], [1, 30, 19]]);
eq('defaults: the failed PlotCameraSequencer left no camera behind', got.defaultsAfter.plotCameraLeft, 0);

// ---- preferences
const pr = got.prefs;
eq('preference names: category, preference, case-insensitive prefix; unknown = none', pr.categoryNames, ['preferences.output_format', 'frame_rate', 'C3DPrefsTime', null]);
eq('ExportPreferences <file>, <category>: written without browser, FileName kept', pr.export, [NONE, [], { FileName: 'c:\\prefs\\out.xsipref' }]);
eq('RestoreDefaultPreference <one preference>', pr.restoreOne, [NONE, 30]);
eq('ImportPreferences <file>: the exported values come back', pr.import, [NONE, 24, { FileName: 'c:\\prefs\\out.xsipref' }]);
eq('RestoreDefaultPreference <category>: every value of the category', pr.restoreCategory, [NONE, 30, 1920]);
eq('RestoreDefaultPreference unknown name: flagged not yet attested (Q3)', pr.restoreUnknown, [NONE, 1]);
ok('ImportPreferences of a missing file fails (inferred, Q3)', /not found/.test(pr.importMissing ?? ''), pr.importMissing);
eq('ExportPreferences unknown category: flagged not yet attested (Q3)', pr.exportUnknown, [NONE, 1]);
eq('ExportPreferences browser: Save mode, directory c:\\, base name preset to Categories', pr.exportBrowser, [{ title: 'Export a Category of Preferences', mode: 'save', filter: FILTER }, 'c:\\', 'output_format']);
eq('ExportPreferences browser OK: the chosen path is written back to FileName', pr.exportBrowserDone, ['resolved', { FileName: 'c:\\output_format' }]);
eq('ImportPreferences browser: Open mode, directory c:\\, empty base name', pr.importBrowser, [{ title: 'Import a Category of Preferences', mode: 'open', filter: FILTER }, 'c:\\', '']);
eq('ImportPreferences browser OK: imported, path written back to FileName', pr.importBrowserDone, ['resolved', 25, { FileName: 'c:\\output_format' }]);
eq('ImportPreferences browser without a choice: siErrCancelled', pr.importNoName, 'siErrCancelled');
eq('Import / ExportPreferences in batch with an empty name: no browser, flagged not yet attested (Q3)', pr.batch, [NONE, true, 1, NONE, 1]);
eq('InspectPreferences <category>: select = Preferences.<category>', pr.inspect, [NONE, { select: 'Preferences.output_format', page: 'C3DPrefsOutputFormat' }]);
eq('InspectPreferences: window with the category list and the property page', pr.inspectWindow, [true, true, true, true]);
eq('InspectPreferences: a name with a dot is used as given; empty = nothing selected', [pr.inspectDotted, pr.inspectEmpty], [{ select: 'preferences.time.somevalue', page: 'C3DPrefsTime' }, { select: null, page: null }]);

// ---- cameras
const ca = got.cams;
eq('SIUpdateCamerasFromGlobalPref: aspect, pixelratio, then std, from picture_ratio / roto_pixel_ratio / picture_standard', [ca.run, ca.prefs, ca.values, ca.order], [NONE, [18, 1.777778, 1], [18, 1.777778, 1], ['aspect', 'pixelratio', 'std']]);
eq('SIUpdateCamerasFromGlobalPref: undoable', ca.undo, [9, 1.333, 0.9]);
eq('SIUpdateCamerasFromGlobalPref: input filtered to cameras', [ca.notACamera, ca.listed], [[9, 1.333, 0.9], [18, 1.777778, 1]]);
eq('SIUpdateCamerasFromGlobalPref: the pixel ratio is roto_pixel_ratio, not ir_pixel_ratio', ca.rotoRatio, 2);

// ---- fx trees
const fx = got.fx;
eq('SIUpdateFxTreesFromGlobalPref empty input: FxTree properties of the scene root and of the models only', [fx.run, fx.values], [NONE, [[1920, 1080, 1], [1920, 1080, 1], 0, [0, 0, 0]]]);
eq('SIUpdateFxTreesFromGlobalPref: undoable', fx.undo, [0, 0, 0]);
eq('SIUpdateFxTreesFromGlobalPref input list: FxTree items only, other types ignored without message', fx.listed, [NONE, [800, 600, 1.5], 0, [0, 0, 0]]);

// ---- play control
const pl = got.play;
eq('SIUpdatePlayControlFromGlobalPref: Step, Rate, Format from frame_step / frame_rate / frame_format; undoable', [pl.run, pl.values, pl.undo, pl.defaults], [NONE, [2, 24, 7], true, [1, 30, 19]]);

// ---- ICE
const ic = got.ice;
eq('ICE test hierarchy: iceGrp > iceSub > pc (point cloud with an ICE tree)', ic.setup, ['pointcloud', 'icetree', 'iceSub', 'iceGrp', true]);
eq('MakeICETreeBranch: any other operator type = nothing, no message', ic.notATree, [NONE, NONE, []]);
eq('MakeICETreeBranch: TransferICETree <tree>, <its object>, 0, True (stand-in, flagged Q9)', ic.branch, [NONE, true, true, true, 1]);
eq('MakeICETreeBranch: undoable; operator by name', [ic.branchUndo, ic.byName], [[true, true], [true, true]]);
eq('PromoteICETree: one level up per call (parent of the tree\'s object), flagged Q9', [ic.promote1, ic.promote2], [[NONE, 'iceSub', 1], [NONE, 'iceGrp']]);
eq('PromoteICETree: target = scene root -> nothing, no message', [ic.promoteAtRoot, ic.promoteUnderRoot], [[NONE, 'iceGrp', []], [NONE, true, []]]);
eq('PromoteICETree: not an ICE tree / nothing given = nothing; undoable', [ic.promoteNotATree, ic.promoteUndo], [[NONE, NONE], 'iceSub']);
const gr = ic.group;
eq('GroupPointClouds from the selection: null under the first cloud\'s parent, clouds (only) parented, null selected and returned', gr.fromSelection, ['node:null', 1, 'null', 'iceSub', true, true, true, true, true]);
eq('GroupPointClouds: undoable', gr.undo, ['iceSub', true, false]);
eq('GroupPointClouds Name / Parent', gr.named, ['node:Grp', 'iceGrp', true, true, ['pcB', 'pcA']]);
eq('GroupPointClouds: fewer than two point clouds = nothing', [gr.oneCloud, gr.noCloud], [[NONE, 0], [NONE, NONE, 0]]);
const sp = ic.split;
eq('SplitCloud: null "Effect" under the cloud\'s parent, cloud parented, trees transferred as branch trees, null selected and returned', sp.run, ['node:Effect', true, 'Effect', 'iceSub', true, true, true, true]);
eq('SplitCloud: one copy of the cloud, made after the trees left it (no tree); landing / driving flagged Q5', sp.copy, [2, true, false, true]);
eq('SplitCloud: Name; input from the selection; not a point cloud = nothing', [sp.named, sp.notACloud], [['node:Fx', 'Fx', true], [NONE, 0]]);

// ---- views
const vi = got.views;
eq('view test: explorer / weight paint panel / palettes start hidden', vi.before, [false, false, false]);
eq('SwitchToView: the named view becomes visible', vi.byName, [NONE, true]);
eq('SwitchToViewByType: the first view of the type becomes visible', vi.byType, [NONE, true]);
eq('registry entry "Switch to Panel Palette" (ViewType Palettes)', vi.variant, ['<none>', true]);
eq('SwitchToView / SwitchToViewByType: unknown name / type (exact compare) = nothing, no message', vi.unknown, [NONE, NONE, NONE, [], true]);
eq('registry entry "Switch to Panel Toolbar"', vi.back, ['<none>', true]);

// ---- viewports
const vp = got.vp;
eq('SetFocusedViewport: the view manager attribute focusedviewport', vp.focus, [NONE, 'C', true, false, 'C']);
eq('SetFocusedViewport: lower-case letter accepted; no validation (unknown letter changes nothing)', [vp.lowerCase, vp.noValidation], ['A', 'A']);
eq('GetViewportUnderMouse: pane under the pointer, independent of the focus; last pane when the pointer leaves', [vp.underMouse, vp.underMouse2, vp.lastPane], [{ v: 'D' }, [{ v: 'A' }, 'A'], { v: 'A' }]);
eq('GetViewportUnderMouse: not logged', vp.log, 0);
const sq = vp.seq;
eq('SetCameraSequencerLayout: attribute writes in contract order (no shot clip: first renderable camera; focus fixed to d)', [sq.run, sq.trace],
  [NONE, ['suspenddrawing=true', 'layout=alternate', 'layout=reset', 'viewport:a=Camera Sequencer Editor', 'activecamera:c=Camera', 'activecamera:d=User', 'focusedviewport=d', 'suspenddrawing=false']]);
eq('SetCameraSequencerLayout: panes after (C = camera, D = User, D focused, 1-up + 3-down)', [sq.after[0], sq.after[1], sq.alternate], ['D', ['Top', 'Camera', 'Camera', 'User'], true]);
ok('SetCameraSequencerLayout: layout switch and Camera Sequencer Editor view flagged not yet attested', sq.after[2] === 2, sq.after);
eq('SetCameraSequencerLayout: pane ids mapped (siViewportFocussed = focused pane), shot camera at the current frame wins',
  sq.mapped, ['suspenddrawing=true', 'layout=alternate', 'layout=reset', 'viewport:d=Camera Sequencer Editor', 'activecamera:b=ShotCam', 'activecamera:a=User', 'focusedviewport=d', 'suspenddrawing=false']);
eq('SetCameraSequencerLayout mapped: panes after', sq.mappedAfter, ['D', ['User', 'ShotCam', 'Camera', 'User']]);
eq('SetCameraSequencerLayout in batch: nothing', sq.batch, [NONE, 0]);

// ---- plot
const po = got.plot;
eq('PlotCameraSequencer, empty sequencer plot: error propagates, clips / range / scene untouched', po.noSequencer, [true, [['oldAnim', 'oldShape', 'oldAudio'], ['oldCompound']], 0, [1, 100]]);
eq('PlotCameraSequencer: an invalid range fails in the plot commands (E_INVALIDARG)', po.badRange, true);
eq('PlotCameraSequencer: camera plotted, animation clips and compounds deleted (shape / audio kept), PlayControl In / Out = range', po.applied,
  [NONE, 'SequencerCamera_Plot', 2, [['oldShape', 'oldAudio'], []], [5, 40], { StartFrame: 5, EndFrame: 40 }]);
eq('PlotCameraSequencer: unlock / plot-to-actions / shape plot flagged not yet attested, no error', po.notes, [3, []]);
eq('PlotCameraSequencer: undoable', po.undo, [[['oldAnim', 'oldShape', 'oldAudio'], ['oldCompound']], [1, 100], false]);
eq('PlotCameraSequencer ApplyToCamera false: the plotted camera\'s clip is taken out of the delete', po.clipKept, [NONE, [['oldShape', 'oldAudio', 'SequencerCamera_Plot_Action'], []], true, [3, 30]]);

// ---- rig
const ri = got.rig;
eq('ManCharacterOnUpdate: sclx = scly = sclz = sqrt(|Px-Qx| + |Py-Qy|) / Eye_scaling_factor + 0.005 (first cluster elements)', [ri.man[0], ri.man[1], ri.man[3], ri.man[4]], [NONE, [ri.man[2], ri.man[2], ri.man[2]], true, []]);
eq('ManCharacterOnUpdate: unwrapped inputs, context parameters as a function, plain output', [ri.manPlain[0], ri.manPlain[1]], [ri.manPlain[2], true]);
eq('ManCharacterOnUpdate: non-cluster input = "Expected cluster, got <type>", carries on', ri.manNotCluster, [NONE, ['info:Expected cluster, got X3DObject', 'info:Expected cluster, got Double'], true]);
eq('BipedRigOnUpdate: heel / toe / mid table (SteppingAngle 30), other port not written', ri.biped, { heel: [-5, 0, 0], toe: [0, 0, 0, 10], mid: [0, 0, 10, 30, 30], other: '<not written>' });
eq('BipedRigOnUpdate: plain numbers', ri.bipedNumber, 15);

// ---- pages
const pg = got.pages;
eq('InfoGeometry: OpenNetView <factory>/Application/views/html/InfoGeometry.htm, False, 1; page content flagged Q11', pg.info, [NONE, [FACTORY + 'InfoGeometry.htm', false, 1, false], 1, 1]);
eq('InfoGeometry: a new Net View each time', pg.infoAgain, [NONE, 2]);
eq('ParamBracketing: ParamBracketing.htm, False, 1', pg.bracketing, [NONE, [FACTORY + 'ParamBracketing.htm', false, 1, false], 3]);
eq('InspectLocks: AddToSelection <InputObj>, then InfoLocks.htm with Reuse true (an open Net View is reused)', pg.locks, [NONE, [FACTORY + 'InfoLocks.htm', true, 1, true], 3, ['sphere', 'cube'], FACTORY + 'InfoLocks.htm']);
eq('InspectLocks: no Net View open = a new one; default input = the selection', pg.locksFresh, [NONE, false, 1, ['cube']]);

// ---- rename
const rn = got.rename;
eq('RenamePropAndRebind: renamed, name references updated (stand-in for the C++ command, flagged Q8)', rn.rename, [NONE, 'NewProj', 'NewProj', 'Else', 1]);
eq('RenamePropAndRebind: undoable; UpdateRefs false leaves references; property by name', [rn.undo, rn.noRefs], [['MyProj', 'MyProj'], [NONE, 'Second', 'MyProj']]);
eq('RenamePropAndRebind: a taken name gets a suffix (inferred); default input = the selection', [rn.collision, rn.fromSelection], [[NONE, 'Taken1', 'Taken1'], [NONE, 'Picked']]);
eq('RenamePropAndRebind: empty name without UI = nothing, flagged', rn.emptyName, [NONE, 'Picked', 1]);
eq('RenamePropAndRebindUI: page "Rename <name>" on a Rename property; newname = first property\'s name, wildcard box off whatever the argument', rn.ui,
  ['Rename Picked', [['newname', 'Picked'], ['updaterefs', true], ['updatewildcards', false]], 'Rename']);
eq('RenamePropAndRebindUI OK: dialog values used and written back, dialog property deleted', rn.uiOk,
  ['resolved', 'FromDialog', false, { NewName: 'FromDialog', UpdateRefs: true, UpdateWildcards: false }, { NewName: 'FromDialog', UpdateRefs: true, UpdateWildcards: false }]);
eq('RenamePropAndRebind ShowUI: given NewName / UpdateRefs prime the page', rn.uiGiven, ['Rename Offered', [['newname', 'Offered'], ['updaterefs', false], ['updatewildcards', false]]]);
eq('RenamePropAndRebind ShowUI Cancel: siErrCancelled, nothing renamed, dialog property deleted', rn.uiCancel, ['siErrCancelled', 'FromDialog', false]);
eq('RenamePropAndRebindUI: several properties = "Rename multiple properties"', rn.uiMany, 'Rename multiple properties');
eq('RenamePropAndRebindUI without a user session: treated as Cancel', rn.uiBatch, ['siErrCancelled', 'FromDialog', false, true]);

// ---- pivot
const pv = got.pivot;
eq('SavePivotKey: key at the play control key frame with the current value, whole curve stepped; Time written back', pv.run,
  [NONE, [[[1, 0.5, 0], [7, 2, 0]], [[7, 3, 0]], [[7, 0, 0]]], 0, { Time: 7 }, 7]);
eq('SavePivotKey: parameters this build\'s kinematics lack are flagged (pivot scaling / rotation and all compensation)', pv.missing, ['psclx, pscly, psclz, pcsclx, pcscly, pcsclz, protx, proty, protz, pcrotx, pcroty, pcrotz, pcposx, pcposy, pcposz']);
eq('SavePivotKey: undoable (earlier key and interpolation restored)', pv.undo, [[[1, 0.5, 3]], null, null]);
ok('SavePivotKey: a parameter with a non-fcurve source = warning, skipped', pv.expression[0].length === 1 && /^info:WARNING : Cannot save key, Expression on .*cube\.kine\.local\.pposy$/.test(pv.expression[0][0]) && pv.expression[1] === null && pv.expression[2] === 1 && pv.expression[3] === 1, pv.expression);
eq('SavePivotKey transform filter values (inferred bit set, Q6)', pv.filter, { siScl: 1, siRot: 2, siSR: 3, siTrn: 4, siST: 5, siRT: 6, siSRT: 7 });
eq('SavePivotKey "on Scl" with the inferred values: any-common-bit test reaches every group (Q6)', pv.sclInferred, [1, 1, 1]);
eq('SavePivotKey group table with disjoint filter values: Scl = scaling only, Pos = translation, 0 = siSRT', [pv.sclDisjoint, pv.posDisjoint, pv.zeroIsSRT], [[0, 0, 0], [1, 1, 1], [1, 1, 1]]);
eq('SavePivotKey: nothing selected = nothing', pv.nothingSelected, [NONE, []]);

// ---- shapes
const sh = got.shape; const TS = 'error:TransferShapeAnimation: ';
eq('shape test keys', sh.setup, ['shapekey', true, true]);
eq('TransferShapeAnimation: same object', sh.same, [NONE, [TS + 'the destination needs to be different than the target.']]);
eq('TransferShapeAnimation: a shape list that is not a collection = silent return', sh.notCollections, [NONE, []]);
eq('TransferShapeAnimation: counts differ after duplicates are removed (the caller\'s list is made unique)', sh.count, [[NONE, [TS + 'you need to provide the same amount of shapes.']], 2]);
eq('TransferShapeAnimation: source item not a shape key (sources are checked before destinations)', sh.srcNotKey, [NONE, [TS + 'origin shapes needs to be shape key.']]);
eq('TransferShapeAnimation: source key not under the source object', sh.srcNotNested, [NONE, [TS + 'origin shapes needs to be shapes nested under the origin object.']]);
eq('TransferShapeAnimation: destination item not a shape key', sh.dstNotKey, [NONE, [TS + 'destination shapes needs to be shape key.']]);
eq('TransferShapeAnimation: destination key not under the destination object', sh.dstNotNested, [NONE, [TS + 'destination shapes needs to be shapes nested under the destination object.']]);
ok('TransferShapeAnimation valid: SITransferShapeAnimation with the same four arguments (lists made unique)', sh.lowLevelOnBus && JSON.stringify(sh.delegated) === JSON.stringify([[NONE, []], [true, true, 2, 2]]), sh.delegated);
eq('TransferShapeAnimation without that command: weight animation copied by position, flagged; undoable', [sh.standIn, sh.standInUndo], [[NONE, [[1, 0], [10, 1]], 0.25, 1, []], [0, 0]]);

// ---- shader
const sd = got.shader;
eq('GetShaderOnCnxPointFunction: <material>.surface and a material', sd.surface, [true, true]);
eq('GetShaderOnCnxPointFunction: the shader on a port; nothing connected = nothing', [sd.port, sd.unconnected], [[true, true], [NONE, NONE]]);
eq('GetShaderOnCnxPointFunction: returns the result of SIGetShaderOnCnxPoint unchanged when that command is on the bus', sd.delegated, { v: 'low:x.y' });

// ---- lock
const lk = got.lock;
eq('LockEnvelopeDeformerWeights (SPEC-PARTIAL): lock flag per deformer on the envelope, flagged not yet attested (Q7)', [lk.envelope, lk.lock], ['ok', [NONE, ['lockL'], 1]]);
eq('LockEnvelopeDeformerWeights: several deformers, Locked false, undo, property from the selection', [lk.both, lk.unlock, lk.undo, lk.fromSelection], [['lockL', 'lockR'], ['lockR'], ['lockL', 'lockR'], ['lockL']]);
eq('LockEnvelopeDeformerWeights: no envelope / no deformer of the envelope = nothing, flagged', [lk.noEnvelope, lk.noDeformers], [[NONE, 1], [NONE, NONE, 2, ['lockL']]]);

eq('no modal, backdrop, Net View or tool left open', got.leftover, [true, 0, 0, true]);
eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B6c uixsi prefs / ICE / views commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B6c uixsi prefs / ICE / views commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired: RestoreDefaultPreference, SIUpdateCamerasFromGlobalPref, SIUpdateFxTreesFromGlobalPref, SIUpdatePlayControlFromGlobalPref, SwitchToView, SwitchToViewByType, SetFocusedViewport, ManCharacterOnUpdate, BipedRigOnUpdate, RenamePropAndRebindUI (dialog), TransferShapeAnimation (validation + hand-over)');
console.log('   partly wired: ImportPreferences / ExportPreferences (.xsipref format, Categories form, empty name: Q3), InspectPreferences (one reused Preferences window), GetViewportUnderMouse (attribute name Q1), SetCameraSequencerLayout (no Camera Sequencer layout / editor view), PlotCameraSequencer (unlock, plot-to-actions, shape plot not on the bus: Q10), SavePivotKey (filter values Q6; only pposx/y/z exist), GroupPointClouds (object filter Q4), SplitCloud (object filter Q4, copy placement Q5)');
console.log('   stand-in for a C++ command that is not on the bus: MakeICETreeBranch / PromoteICETree / SplitCloud (TransferICETree, Q9), RenamePropAndRebind (RenamePropAndRebind_Internal, Q8), InfoGeometry / ParamBracketing / InspectLocks (OpenNetView; page content Q11), GetShaderOnCnxPointFunction (SIGetShaderOnCnxPoint), LockEnvelopeDeformerWeights (Q7)');
