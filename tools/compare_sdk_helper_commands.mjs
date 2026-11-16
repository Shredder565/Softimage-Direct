// CMD-01b: the 17 script-implemented SDK helper commands on the command bus.
// Checked against the "Wire contract" of docs/ghidra/cmd-01b-sdk-helpers.md and the registry dump
// data/commands_full.json. No XSIBATCH golden was run for this row, so this is a contract check: every
// "Golden:" line of the note that can be tested headless is covered. File-system commands run against the
// session's virtual host file system (app.hostFs).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_sdk_helper_commands.mjs
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

const NAMES = ['ShowFileForEdit', 'ShowFileInShaderCodeEditor', 'CreateAddonDirectories', 'CreateWorkgroupDirectories', 'PackageAddon',
  'PackageAddonUI', 'SpdlCheck', 'FindFilesInFolder', 'XSIInputBox', 'StringSearch', 'TrimString', 'XSIRound', 'GetGlobal', 'SetGlobal',
  'SetGlobalObject', 'LargeMsgBox', 'PickFolder'];
// Contract flag table: commands that appear in the command history.
const LOGGED = new Set(['CreateAddonDirectories', 'CreateWorkgroupDirectories', 'PackageAddon', 'SpdlCheck']);
const SUBFOLDERS = ['Application/Plugins', 'Application/layouts', 'Application/toolbars', 'Application/views', 'Application/spdl',
  'Application/bin/nt-x86-64', 'Data/Scripts', 'Data/Preferences/Keymaps', 'Data/DSPresets/Operators', 'Data/DSPresets/Shaders/Realtime',
  'Data/DSPresets/Shaders/Texture', 'Data/DSPresets/Shaders/Geometry', 'Data/DSPresets/Shaders/Light', 'Data/DSPresets/Shaders/Lens',
  'Data/DSPresets/Shaders/Volume'];
// every folder the 15 leaf paths imply, as a sorted set
const TREE = [...new Set(SUBFOLDERS.flatMap(s => s.split('/').map((_, i, a) => a.slice(0, i + 1).join('\\'))))].sort();

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => { const c = list.find(x => (x.scripting_name || x.name) === n); return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('GetGlobal'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const fsx = app.hostFs; const S = app.sdkHelpers;
  const out = {};
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: v === undefined ? '<none>' : v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const mark = () => app.log.length;
  const tick = () => new Promise(r => setTimeout(r, 30));
  const rootProps = () => app.scene.root.properties.map(p => p.name);

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.flags = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? { noLog: !!d.noLog, undoable: d.undoable !== false } : null]; }));

  // ================= batch mode
  app.Interactive = false;

  // ---- defaults: every command with default arguments
  out.defaults = {};
  for (const n of NAMES) { const m = mark(); const r = run(n); out.defaults[n] = { r, log: logFrom(m) }; }

  // ---- globals
  {
    const g = {}; const n0 = S.globals.size; const m = mark();
    g.set = run('SetGlobal', { in_VariableName: 'k1', in_Value: 42 });
    g.get = run('GetGlobal', { in_VariableName: 'k1' });
    run('SetGlobal', { in_VariableName: 'k1', in_Value: 'second' });
    g.overwrite = run('GetGlobal', { in_VariableName: 'k1' });
    const n1 = S.globals.size;
    g.unknown = run('GetGlobal', { in_VariableName: 'never_set' });
    g.unknownGrowth = S.globals.size - n1;
    g.caseSensitive = run('GetGlobal', { in_VariableName: 'K1' });
    run('SetGlobal', { in_VariableName: 'nul', in_Value: null });
    g.nullStored = [run('GetGlobal', { in_VariableName: 'nul' }), S.globals.has('nul')];
    const obj = { a: 1 };
    run('SetGlobalObject', { in_VariableName: 'o1', in_Value: obj });
    g.object = app.run('GetGlobal', { in_VariableName: 'o1' }) === obj;
    g.growth = S.globals.size - n0;
    g.empty = [run('GetGlobal', { in_VariableName: '' }), run('SetGlobal', { in_VariableName: '', in_Value: 1 }), run('SetGlobalObject', { in_VariableName: '', in_Value: 1 })];
    const undo0 = app.undoStack.length;
    run('SetGlobal', { in_VariableName: 'k2', in_Value: 7 });
    g.undoGrowth = app.undoStack.length - undo0;
    g.cmdLog = logFrom(m).filter(l => l.startsWith('cmd:'));
    app.run('NewScene', {});
    g.afterNewScene = [run('GetGlobal', { in_VariableName: 'k1' }), run('GetGlobal', { in_VariableName: 'k2' })];
    out.globals = g;
  }

  // ---- XSIInputBox (batch)
  out.inputBatch = [run('XSIInputBox', { Prompt: 'p', Title: 't', Default: 'the default' }), run('XSIInputBox', { Default: 12 })];

  // ---- StringSearch
  {
    const ss = (a) => run('StringSearch', a);
    out.search = {
      found: ss({ SearchTarget: 'hello world', SearchStr: 'world' }),
      notFound: ss({ SearchTarget: 'hello world', SearchStr: 'xyz' }),
      emptyTarget: ss({ SearchTarget: '', SearchStr: 'a' }),
      emptySearch: [ss({ SearchTarget: 'hello', SearchStr: '' }), ss({ SearchTarget: 'hello', SearchStr: '', StartPos: 3 })],
      beyondEnd: ss({ SearchTarget: 'hello', SearchStr: 'o', StartPos: 9 }),
      nullTarget: ss({ SearchTarget: null, SearchStr: 'a' }),
      nullSearch: ss({ SearchTarget: 'abc', SearchStr: null }),
      negative: ss({ SearchTarget: 'abc', SearchStr: 'a', StartPos: -1 }),
      caseSensitiveMiss: ss({ SearchTarget: 'Hello World', SearchStr: 'world' }),
      caseInsensitiveHit: ss({ SearchTarget: 'Hello World', SearchStr: 'world', CaseSensitive: false }),
      startPosHit: [ss({ SearchTarget: 'abcabc', SearchStr: 'abc' }), ss({ SearchTarget: 'abcabc', SearchStr: 'abc', StartPos: 1 })],
      startPosOnly: [ss({ SearchTarget: 'xxabc', SearchStr: 'x', StartPos: 2 }), ss({ SearchTarget: 'xxabc', SearchStr: 'c', StartPos: 4 })],
    };
  }

  // ---- TrimString
  {
    const m = mark();
    const t = (s, l, r) => run('TrimString', { StringToTrim: s, TrimLeft: l, TrimRight: r });
    out.trim = { both: t('  ab c  ', true, true), left: t('  ab c  ', true, false), right: t('  ab c  ', false, true) };
    out.trimLogBefore = logFrom(m);
    const m2 = mark();
    out.trim.none = t('  ab c  ', false, false);
    out.trimWarn = logFrom(m2);
    out.trim.tabNewline = t('\t  x \n', true, true);
    out.trim.spacesAroundTab = t('  \tx\n  ', true, true);
    out.trim.nul = t(null, true, true);
  }

  // ---- XSIRound
  {
    const r = (x, n) => run('XSIRound', n === undefined ? { in_Expression: x } : { in_Expression: x, in_NumDecimals: n });
    out.round = [r(2.5), r(3.5), r(0.125, 2), r(-2.5), r(1.2345, 2), r(0.5), r(1.5), r(-3.5), r(2.4), r(2.6), r(-0.5), r(1.005, 2), r(7), r(null), r(1.25, 1), r(1.35, 1)];
    out.roundErr = r(1.5, -1);
  }

  // ---- LargeMsgBox / PickFolder (batch)
  {
    const before = rootProps(); const u = app.undoStack.length;
    out.largeBatch = [run('LargeMsgBox', { Text: 'some text' }), JSON.stringify(rootProps()) === JSON.stringify(before), app.undoStack.length - u];
    out.pickBatch = [run('PickFolder', { Title: 't', HelpText: 'h', DefaultValue: 'C:\\x' }), JSON.stringify(rootProps()) === JSON.stringify(before)];
  }

  // ---- CreateAddonDirectories / CreateWorkgroupDirectories
  {
    const d = {}; const m = mark();
    d.plain = run('CreateAddonDirectories', { RootPath: 'C:\\temp\\cad1', AddonName: 'MyTool' });
    d.plainRoot = fsx.isFolder('C:\\temp\\cad1\\Addons\\MyTool');
    d.plainTree = fsx.tree('C:\\temp\\cad1\\Addons\\MyTool').sort();
    d.plainAll = fsx.tree('C:\\temp\\cad1').length;
    d.addons = run('CreateAddonDirectories', { RootPath: 'C:\\temp\\cad2\\aDDons', AddonName: 'MyTool' });
    d.addonsRoot = [fsx.isFolder('C:\\temp\\cad2\\aDDons\\MyTool'), fsx.exists('C:\\temp\\cad2\\aDDons\\Addons')];
    d.addonsTree = fsx.tree('C:\\temp\\cad2\\aDDons\\MyTool').sort();
    d.trailing = run('CreateAddonDirectories', { RootPath: 'C:\\temp\\cad3\\Addons\\', AddonName: 'MyTool' });
    d.trailingRoot = fsx.isFolder('C:\\temp\\cad3\\Addons\\Addons\\MyTool');
    // existing folders are left alone
    fsx.writeFile('C:\\temp\\cad1\\Addons\\MyTool\\Application\\Plugins\\keep.js', '// keep');
    d.again = run('CreateAddonDirectories', { RootPath: 'C:\\temp\\cad1', AddonName: 'MyTool' });
    d.kept = fsx.readFile('C:\\temp\\cad1\\Addons\\MyTool\\Application\\Plugins\\keep.js');
    // failure of the add-on root: a file is in the way
    fsx.ensureFolder('C:\\temp\\cad4'); fsx.writeFile('C:\\temp\\cad4\\Addons', 'a file');
    d.fail = run('CreateAddonDirectories', { RootPath: 'C:\\temp\\cad4', AddonName: 'MyTool' });
    // failure of a sub-folder is not caught
    fsx.ensureFolder('C:\\temp\\cad5\\Addons\\T'); fsx.writeFile('C:\\temp\\cad5\\Addons\\T\\Data', 'a file');
    d.subFail = run('CreateAddonDirectories', { RootPath: 'C:\\temp\\cad5', AddonName: 'T' });
    d.wg = run('CreateWorkgroupDirectories', { WorkgroupPath: 'C:\\temp\\wg1' });
    d.wgTree = fsx.tree('C:\\temp\\wg1').sort();
    d.wgFail = run('CreateWorkgroupDirectories', { WorkgroupPath: 'C:\\temp\\cad4\\Addons\\wg' });
    d.cmdLog = logFrom(m).filter(l => l.startsWith('cmd:')).length;
    out.dirs = d;
  }

  // ---- FindFilesInFolder
  {
    const D = 'C:\\temp\\find'; fsx.ensureFolder(D + '\\sub.js');
    for (const f of ['abcdef.txt', 'a.json', 'b.js', 'README.md', 'xabc.txt']) fsx.writeFile(D + '\\' + f, f);
    const ff = (a) => run('FindFilesInFolder', { Directory: D, ...a });
    const m = mark();
    out.find = {
      firstFull: ff({}),
      firstBare: ff({ ReturnFullPath: false }),
      allFull: ff({ FindAllMatches: true }),
      allBare: ff({ FindAllMatches: true, ReturnFullPath: false }),
      prefix: ff({ RegularExpression: 'abc', FindAllMatches: true, ReturnFullPath: false }),
      jsPrefix: ff({ RegularExpression: '.*\\.js', FindAllMatches: true, ReturnFullPath: false }),
      caseInsensitive: ff({ RegularExpression: 'readme', ReturnFullPath: false }),
      none: [ff({ RegularExpression: 'zzz' }), ff({ RegularExpression: 'zzz', FindAllMatches: true })],
    };
    out.findLog = logFrom(m);
    const m2 = mark();
    out.findMissing = [run('FindFilesInFolder', { Directory: 'C:\\temp\\nope' }), run('FindFilesInFolder', { Directory: 'C:\\temp\\nope', FindAllMatches: true })];
    out.findMissingLog = logFrom(m2);
  }

  // ---- SpdlCheck
  {
    const s = {}; let m = mark();
    s.empty = run('SpdlCheck', { strFilePath: '' }); s.emptyLog = logFrom(m);
    m = mark();
    s.notSpdl = run('SpdlCheck', { strFilePath: 'C:\\x\\thing.txt', in_WithUI: false }); s.notSpdlLog = logFrom(m);
    s.notSpdlUi = run('SpdlCheck', { strFilePath: 'C:\\x\\thing.txt' });
    s.noLauncher = run('SpdlCheck', { strFilePath: 'C:\\x\\Thing.SPDL', in_WithUI: false });
    s.cmdLine = S.lastLaunch;
    // with a launcher hook standing in for spdlcheck.exe, steps 4 to 6 are observable
    const tmp = S.paths[1] + '\\spdlcheckoutput.tmp'; const seen = [];
    S.launchProcess = (cmd, blocking) => { seen.push([cmd, blocking]); fsx.writeFile(tmp, 'Compilation succeeded\n'); };
    s.withLauncher = run('SpdlCheck', { strFilePath: 'C:\\x\\thing.spdl', in_WithUI: true });
    s.launched = seen; s.tmpDeleted = !fsx.exists(tmp);
    S.launchProcess = () => { /* tool failed to start: no temp file */ };
    s.noTemp = run('SpdlCheck', { strFilePath: 'C:\\x\\thing.spdl', in_WithUI: false });
    S.launchProcess = null;
    out.spdl = s;
  }

  // ---- PackageAddon
  {
    const p = {}; const U = S.paths[1];
    const A = 'C:\\temp\\pk\\Addons'; const T = A + '\\MyTool';
    fsx.ensureFolder(T + '\\Application\\Plugins'); fsx.ensureFolder(T + '\\src'); fsx.ensureFolder(T + '\\Debug\\x'); fsx.ensureFolder(T + '\\Data\\SRC');
    fsx.writeFile(T + '\\readme.txt', 'r'); fsx.writeFile(T + '\\Application\\Plugins\\p.js', 'p'); fsx.writeFile(T + '\\src\\a.cpp', 'a');
    fsx.writeFile(T + '\\src\\b.cpp', 'b'); fsx.writeFile(T + '\\Debug\\x\\o.obj', 'o'); fsx.writeFile(T + '\\Data\\SRC\\d.txt', 'd');
    const pk = (a) => { const m = mark(); const r = run('PackageAddon', a); return { r, log: logFrom(m) }; };
    p.badSource = pk({ SrcDir: 'NoSuchAddon' });
    p.badSourceExpect = `no such folder: ${U}\\Addons\\NoSuchAddon`;
    fsx.ensureFolder('C:\\temp\\pk\\Other\\Tool'); fsx.writeFile('C:\\temp\\pk\\Other\\Tool\\f.txt', 'f');
    p.outside = pk({ SrcDir: 'C:\\temp\\pk\\Other\\Tool' });
    fsx.ensureFolder('C:\\temp\\pk\\out');
    p.all = pk({ SrcDir: T, DestinationPath: 'C:\\temp\\pk\\out\\all.xsiaddon' });
    p.allManifest = fsx.isFile('C:\\temp\\pk\\out\\all.xsiaddon') ? fsx.readFile('C:\\temp\\pk\\out\\all.xsiaddon').split('\n') : null;
    p.allStatus = S.progress.status.slice(); p.progress = { ...S.progress, status: undefined };
    p.exists = pk({ SrcDir: T, DestinationPath: 'C:\\temp\\pk\\out\\all.xsiaddon', Overwrite: false });
    p.overwrite = pk({ SrcDir: T, DestinationPath: 'C:\\temp\\pk\\out\\ALL', Overwrite: true, ExcludeDirs: 'src;Debug' });
    p.overwriteManifest = fsx.readFile('C:\\temp\\pk\\out\\all.xsiaddon').split('\n');
    p.excludeStatus = S.progress.status.slice();
    p.noTrim = pk({ SrcDir: T, DestinationPath: 'C:\\temp\\pk\\out\\notrim', ExcludeDirs: 'src; Debug' });
    p.destFolder = pk({ SrcDir: T, DestinationPath: 'C:\\temp\\pk\\out' });
    p.destFolderFile = fsx.isFile('C:\\temp\\pk\\out\\MyTool.xsiaddon');
    p.newParent = pk({ SrcDir: T, DestinationPath: 'C:\\temp\\pk\\new\\deep\\x.XSIADDON' });
    p.newParentFile = fsx.isFile('C:\\temp\\pk\\new\\deep\\x.XSIADDON');
    p.defaultDest = pk({ SrcDir: T });
    p.defaultDestFile = [fsx.isFile(A + 'MyTool.xsiaddon'), fsx.exists(T + '.xsiaddon')];
    fsx.ensureFolder(A + '\\Empty\\src'); fsx.writeFile(A + '\\Empty\\src\\only.cpp', 'x');
    p.empty = pk({ SrcDir: A + '\\Empty', DestinationPath: 'C:\\temp\\pk\\out\\empty', ExcludeDirs: 'SRC' });
    p.emptyFile = fsx.exists('C:\\temp\\pk\\out\\empty.xsiaddon');
    // by name, relative to <user path>\Addons
    fsx.ensureFolder(U + '\\Addons\\ByName'); fsx.writeFile(U + '\\Addons\\ByName\\one.txt', '1');
    p.byName = pk({ SrcDir: 'ByName', DestinationPath: 'C:\\temp\\pk\\out\\byname' });
    p.byNameSrc = `${U}\\Addons\\ByName`;
    p.progressHidden = S.progress.visible === false;
    out.pkg = p;
  }

  // ---- PackageAddonUI (batch) / ShowFile* errors
  {
    out.pkgUiBatch = run('PackageAddonUI', { Source: 'C:\\temp\\pk\\Addons\\MyTool' });
    let m = mark(); out.showEmpty = [run('ShowFileForEdit', {}), logFrom(m)];
    m = mark(); out.showShaderEmpty = [run('ShowFileInShaderCodeEditor', {}), logFrom(m)];
  }

  // ---- ShowFileForEdit over the editor-view model (still batch: no windows)
  {
    const v = {}; S.views.length = 0; app.prefValues = { 'preferences.scripting.externaleditor': '' };
    const shape = (x) => x && x.v && typeof x.v === 'object' ? { type: x.v.type, name: x.v.name, visible: x.v.visible, state: x.v.state, attrs: { ...x.v.attrs } } : x;
    let m = mark(); v.dll = [run('ShowFileForEdit', { FileName: 'C:\\p\\plugin.dll' }), run('ShowFileForEdit', { FileName: '/p/plugin.so' }), S.views.length, logFrom(m).length];
    v.created = shape(run('ShowFileForEdit', { FileName: 'C:\\Scripts\\My.js', LineNumber: 12 }));
    v.viewCount1 = S.views.length;
    // found in an existing view: regex / case-insensitive / slash-insensitive; activetab as given
    S.views[0].visible = false;
    v.found = run('ShowFileForEdit', { FileName: 'c:/scripts/MY.js', LineNumber: 3 });
    v.foundState = { visible: S.views[0].visible, attrs: { ...S.views[0].attrs }, count: S.views.length };
    v.foundNoLine = [run('ShowFileForEdit', { FileName: 'scripts.my' }), S.views[0].attrs.errorlinenum, S.views[0].attrs.activetab];
    // not found, visible view reused
    v.reuse = run('ShowFileForEdit', { FileName: 'C:\\Scripts\\Other.vbs' });
    v.reuseState = { attrs: { ...S.views[0].attrs }, count: S.views.length };
    // Script Editor views are walked before Text Editor views
    const se = S.createView('Script Editor', 'Script Editor', true);
    v.order = run('ShowFileForEdit', { FileName: 'C:\\Scripts\\Third.py' });
    v.orderState = [se.attrs.filename, S.views[0].attrs.filename, S.views.length];
    // ".DLL" passes the lower-case test
    v.upperDll = [run('ShowFileForEdit', { FileName: 'C:\\p\\PLUGIN.DLL' }), se.attrs.filename];
    // a regex-special path raises
    v.regexErr = 'err' in run('ShowFileForEdit', { FileName: 'C:\\p\\a(b.js' });
    // external editor
    S.views.length = 0; const seen = [];
    app.prefValues['preferences.scripting.externaleditor'] = '  notepad.exe  ';
    m = mark(); v.extNoHook = shape(run('ShowFileForEdit', { FileName: 'C:\\a b\\f.js' })); v.extNoHookLog = logFrom(m); v.extNoHookCmd = S.lastLaunch;
    S.views.length = 0; S.launchProcess = (c, b) => seen.push([c, b]); S.verbose.length = 0;
    v.extQuoted = run('ShowFileForEdit', { FileName: 'C:\\a b\\f.js' });
    app.prefValues['preferences.scripting.externaleditor'] = 'edit %s -n%l %s %l';
    v.extSubst = run('ShowFileForEdit', { FileName: 'C:\\f.js', LineNumber: 7 });
    v.extSubstNoLine = run('ShowFileForEdit', { FileName: 'C:\\f.js' });
    app.prefValues['preferences.scripting.externaleditor'] = 'edit %s';
    v.extOnlyS = run('ShowFileForEdit', { FileName: 'C:\\f.js', LineNumber: 7 });
    v.extSeen = seen; v.extVerbose = S.verbose.slice(); v.extViews = S.views.length;
    S.launchProcess = null; app.prefValues['preferences.scripting.externaleditor'] = '';
    // shader code editor
    S.views.length = 0; S.createView('Text Editor', 'Text Editor', true);
    v.shNew = shape(run('ShowFileInShaderCodeEditor', { FileName: 'C:\\sh\\a.cgfx', Parser: 'cgfx', LineNumber: 4 }));
    v.shCount = S.views.length; v.shTextUntouched = S.views[0].attrs.filename === undefined;
    v.shReuse = run('ShowFileInShaderCodeEditor', { FileName: 'C:\\sh\\b.glsl', Parser: 'glsl' });
    v.shReuseAttrs = { ...S.views[1].attrs };
    v.shFound = run('ShowFileInShaderCodeEditor', { FileName: 'C:\\sh\\A.CGFX', Parser: 'hlsl', LineNumber: 9 });
    v.shFoundAttrs = { ...S.views[1].attrs };
    S.views.length = 0;
    out.views = v;
  }

  // ================= interactive mode (modal pages; commands return a Promise)
  app.Interactive = true;
  const q = (s) => document.querySelector(s);
  const modalCount = () => document.querySelectorAll('.sdkh-modal-window').length;
  {
    const i = {};
    // LargeMsgBox
    const before = rootProps(); const u = app.undoStack.length; const m = mark();
    let pr = app.run('LargeMsgBox', { Text: 'line one\nline two', Title: 'My Title' });
    await tick();
    const tp = app.scene.root.properties.find(p => p.name === 'Text');
    i.large = { promise: typeof pr?.then === 'function', propType: tp?.type, propText: tp?.val('Text'), title: q('.sdkh-TextProp .ppg-float-title')?.textContent, shown: q('.sdkh-TextProp textarea')?.value, height: q('.sdkh-TextProp textarea')?.style.height };
    q('.sdkh-TextProp .sdkh-modal-ok').click();
    i.largeOk = await pr; i.largeGone = JSON.stringify(rootProps()) === JSON.stringify(before);
    pr = app.run('LargeMsgBox', { Text: 'x' }); await tick();
    i.largeDefaultTitle = q('.sdkh-TextProp .ppg-float-title')?.textContent;
    q('.sdkh-TextProp .sdkh-modal-cancel').click();
    i.largeCancel = await pr; i.largeGone2 = JSON.stringify(rootProps()) === JSON.stringify(before);
    i.largeUndo = app.undoStack.length - u; i.largeCmdLog = logFrom(m).filter(l => l.startsWith('cmd:'));
    // PickFolder
    pr = app.run('PickFolder', { Title: 'Pick', HelpText: 'Choose the folder', DefaultValue: 'C:\\start' }); await tick();
    const pf = app.scene.root.properties.find(p => p.name === 'PickFolder');
    i.pick = { prop: !!pf, params: pf?.params.map(p => p.name), value: pf?.val('Directory'), title: q('.sdkh-PickFolder .ppg-float-title')?.textContent, help: q('.sdkh-PickFolder .sdkh-static')?.textContent, control: q('.sdkh-PickFolder .sdkh-row')?.dataset.control, hasLabel: !!q('.sdkh-PickFolder .sdkh-row label'), group: q('.sdkh-PickFolder .sdkh-group')?.dataset.group };
    const inp = q('.sdkh-PickFolder .sdkh-row input'); inp.value = 'D:\\picked'; inp.dispatchEvent(new Event('change'));
    q('.sdkh-PickFolder .sdkh-modal-ok').click();
    i.pickOk = await pr; i.pickGone = JSON.stringify(rootProps()) === JSON.stringify(before);
    pr = app.run('PickFolder', { DefaultValue: 'C:\\start' }); await tick();
    q('.sdkh-PickFolder .sdkh-modal-cancel').click();
    i.pickCancel = await pr; i.pickGone2 = JSON.stringify(rootProps()) === JSON.stringify(before);
    // XSIInputBox
    pr = app.run('XSIInputBox', { Prompt: 'Your name', Title: 'Ask', Default: 'anon' }); await tick();
    i.input = { title: q('.sdkh-inputbox .ppg-float-title')?.textContent, prompt: q('.sdkh-inputbox .sdkh-static')?.textContent, value: q('.sdkh-inputbox input')?.value };
    const ib = q('.sdkh-inputbox input'); ib.value = 'typed'; ib.dispatchEvent(new Event('input'));
    q('.sdkh-inputbox .sdkh-modal-ok').click(); i.inputOk = await pr;
    pr = app.run('XSIInputBox', { Default: 'anon' }); await tick();
    q('.sdkh-inputbox .sdkh-modal-cancel').click(); i.inputCancel = await pr;
    // SpdlCheck with UI: message box 1194
    const mb0 = document.querySelectorAll('.si-msgbox-window').length;
    i.spdlBox = [run('SpdlCheck', { strFilePath: 'C:\\x\\a.txt' }), document.querySelectorAll('.si-msgbox-window').length - mb0, [...document.querySelectorAll('.si-msgbox-window .si-msgbox-text')].pop()?.textContent];
    [...document.querySelectorAll('.si-msgbox-window .si-msgbox-ok')].forEach(b => b.click());
    // ShowFileForEdit .dll: message box 1190
    i.dllBox = [run('ShowFileForEdit', { FileName: 'x.dll' }), [...document.querySelectorAll('.si-msgbox-window .si-msgbox-text')].pop()?.textContent];
    [...document.querySelectorAll('.si-msgbox-window .si-msgbox-ok')].forEach(b => b.click());
    // ShowFileForEdit: a new floating Text Editor showing the virtual file
    S.views.length = 0; fsx.ensureFolder('C:\\temp\\ed'); fsx.writeFile('C:\\temp\\ed\\s.js', '// hello');
    const r = app.run('ShowFileForEdit', { FileName: 'C:\\temp\\ed\\s.js' });
    i.editor = { type: r?.type, name: r?.name, visible: r?.visible, text: q('.sdkh-editor-window textarea')?.value, title: q('.sdkh-editor-window .ppg-float-title')?.textContent };
    r?.window?.close(); i.editorClosed = [S.views.length, !!q('.sdkh-editor-window')];

    // PackageAddonUI
    const P = {}; const T = 'C:\\temp\\pk\\Addons\\MyTool';
    let m2 = mark(); P.badPath = [run('PackageAddonUI', { Source: 'C:\\temp\\nope' }), logFrom(m2), modalCount()];
    S.globals.set('PackageAddon_DetailDict', 'stale');
    pr = app.run('PackageAddonUI', {}); await tick();
    const W = '.sdkh-PackageLocationOptions';
    const field = (n) => q(`${W} .sdkh-row[data-param="${n}"] input, ${W} .sdkh-row[data-param="${n}"] textarea`);
    const setField = (n, v) => { const f = field(n); f.value = v; f.dispatchEvent(new Event('change')); };
    P.defaults = { Source: field('Source').value, Destination: field('Destination').value, Overwrite: field('Overwrite').checked, ExcludeDir: field('ExcludeDir').value, AuthorName: field('AuthorName').value, Description: field('Description').value };
    P.userAddonPath = S.paths[5];
    P.layout = [...q(`${W} .sdkh-modal-content`).children].map(c => c.classList.contains('sdkh-static') ? 'text:' + c.textContent : c.classList.contains('sdkh-spacer') ? 'spacer' : 'group:' + c.dataset.group + '=' + [...c.querySelectorAll('.sdkh-row')].map(r2 => `${r2.dataset.param}/${r2.dataset.control}/${r2.querySelector('label')?.textContent ?? ''}`).join(','));
    P.filter = q(`${W} .sdkh-row[data-param="Destination"]`).dataset.filter;
    P.descHeight = field('Description').style.height; P.platformsShown = !!q(`${W} .sdkh-row[data-param="Platforms"]`);
    P.detailGlobal = S.globals.get('PackageAddon_DetailDict');
    // validation loop: empty source -> 1191, missing folder -> 1192, not under Addons -> 1193
    const msgs = [];
    const okAndMsg = async () => { q(`${W} .sdkh-modal-ok`).click(); await tick(); const t = q('.sdkh-msg-critical .sdkh-msg-text')?.textContent; msgs.push(t); q('.sdkh-msg-critical .sdkh-modal-ok')?.click(); await tick(); };
    setField('Source', ''); await okAndMsg();
    P.reopened = modalCount();
    setField('Source', 'C:\\temp\\nope'); await okAndMsg();
    setField('Source', 'C:\\temp\\pk\\Other\\Tool'); await okAndMsg();
    P.msgs = msgs;
    // success
    setField('Source', T); setField('Destination', 'C:\\temp\\pk\\out\\fromui.xsiaddon'); setField('ExcludeDir', 'src');
    m2 = mark(); q(`${W} .sdkh-modal-ok`).click();
    P.result = await pr; P.runLog = logFrom(m2).filter(l => l.startsWith('cmd:')); P.file = fsx.isFile('C:\\temp\\pk\\out\\fromui.xsiaddon');
    P.remembered = S.excludeDirs; P.detailAfter = [S.globals.has('PackageAddon_DetailDict'), S.globals.get('PackageAddon_DetailDict')];
    // with a Source argument: destination is <parent>\<name>.xsiaddon and the exclude list is remembered; cancel returns false
    pr = app.run('PackageAddonUI', { Source: T }); await tick();
    P.withSource = { Source: field('Source').value, Destination: field('Destination').value, ExcludeDir: field('ExcludeDir').value, title: q(`${W} .ppg-float-title`)?.textContent };
    q(`${W} .sdkh-modal-cancel`).click(); P.cancel = await pr;
    // a packaging failure is shown in a critical box and still returns false
    pr = app.run('PackageAddonUI', { Source: T }); await tick();
    setField('Destination', 'C:\\temp\\pk\\out\\fromui.xsiaddon'); field('Overwrite').click();
    q(`${W} .sdkh-modal-ok`).click(); await tick();
    P.failMsg = q('.sdkh-msg-critical .sdkh-msg-text')?.textContent; q('.sdkh-msg-critical .sdkh-modal-ok')?.click();
    P.failResult = await pr;
    P.left = modalCount();
    i.pkgUi = P;
    out.inter = i;
  }
  return out;
}, { NAMES });
await browser.close();

// ---------------------------------------------------------------- compare
let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const V = (v) => ({ v });
const NONE = V('<none>');

// 1. registration against the registry dump
for (const n of NAMES) {
  ok(`${n} is in the registry dump`, !!registry[n], registry[n]);
  eq(`${n} registered with the registry arguments`, got.reg[n], registry[n]);
  eq(`${n} logged flag`, !got.flags[n]?.noLog, LOGGED.has(n));
}
eq('siUndoable cleared on GetGlobal / SetGlobal, default on SetGlobalObject', [got.flags.GetGlobal.undoable, got.flags.SetGlobal.undoable, got.flags.SetGlobalObject.undoable], [false, false, true]);

// 2. default arguments (batch): nothing throws except where the contract says so
const D = got.defaults;
eq('defaults: ShowFileForEdit', D.ShowFileForEdit, { r: NONE, log: ['error:No file specified in call to ShowFileForEdit'] });
eq('defaults: ShowFileInShaderCodeEditor', D.ShowFileInShaderCodeEditor, { r: NONE, log: ['error:No file specified in call to ShowFileInShaderCodeEditor'] });
ok('defaults: CreateAddonDirectories returns the problem text', typeof D.CreateAddonDirectories.r.v === 'string' && D.CreateAddonDirectories.r.v.split('\n').length === 3 && D.CreateAddonDirectories.r.v.startsWith('Problem creating directory\n'), D.CreateAddonDirectories);
ok('defaults: CreateWorkgroupDirectories returns the problem text', typeof D.CreateWorkgroupDirectories.r.v === 'string' && D.CreateWorkgroupDirectories.r.v.startsWith('Problem creating directory\n\n'), D.CreateWorkgroupDirectories);
ok('defaults: PackageAddon returns a reason and does not raise', typeof D.PackageAddon.r.v === 'string' && D.PackageAddon.r.v !== '' && D.PackageAddon.log[0] === 'error:' + D.PackageAddon.r.v, D.PackageAddon);
ok('defaults: PackageAddonUI is refused in batch', typeof D.PackageAddonUI.r.err === 'string' && /batch/.test(D.PackageAddonUI.r.err), D.PackageAddonUI);
eq('defaults: SpdlCheck', D.SpdlCheck, { r: NONE, log: ['error:Invalid empty path argument to SpdlCheck', 'cmd:SpdlCheck , true'] });
eq('defaults: FindFilesInFolder', D.FindFilesInFolder, { r: V(''), log: ['error:FindFilesInFolder - problem with argument  : Path not found'] });
eq('defaults: XSIInputBox', D.XSIInputBox, { r: V(''), log: [] });
eq('defaults: StringSearch (Null strings)', D.StringSearch, { r: V(null), log: [] });
eq('defaults: TrimString (Null)', D.TrimString, { r: V(null), log: [] });
eq('defaults: XSIRound (Null)', D.XSIRound, { r: V(null), log: [] });
eq('defaults: GetGlobal', D.GetGlobal.r, { err: 'Invalid argument to GetGlobal' });
eq('defaults: SetGlobal', D.SetGlobal.r, { err: 'Invalid argument to SetGlobal' });
eq('defaults: SetGlobalObject', D.SetGlobalObject.r, { err: 'Invalid argument to SetGlobal' });
eq('defaults: LargeMsgBox', D.LargeMsgBox, { r: V(true), log: [] });
ok('defaults: PickFolder errors in batch (Q5)', typeof D.PickFolder.r.err === 'string', D.PickFolder);

// 3. globals
const g = got.globals;
eq('SetGlobal returns nothing', g.set, NONE);
eq('GetGlobal after set', g.get, V(42));
eq('GetGlobal after overwrite', g.overwrite, V('second'));
eq('GetGlobal of an unknown name is null', g.unknown, V(null));
eq('GetGlobal of an unknown name creates no entry', g.unknownGrowth, 0);
eq('keys are case-sensitive', g.caseSensitive, V(null));
eq('a stored null: key exists, reads null', g.nullStored, [V(null), true]);
eq('SetGlobalObject stores the object itself', g.object, true);
eq('key count grew by the three names set', g.growth, 3);
eq('empty-name error text, all three', g.empty, [{ err: 'Invalid argument to GetGlobal' }, { err: 'Invalid argument to SetGlobal' }, { err: 'Invalid argument to SetGlobal' }]);
eq('SetGlobal adds no undo entry', g.undoGrowth, 0);
eq('none of the three appears in the command log', g.cmdLog, []);
eq('values survive New Scene', g.afterNewScene, [V('second'), V(7)]);

// 4. XSIInputBox batch
eq('XSIInputBox (batch) returns the default unchanged', got.inputBatch, [V('the default'), V(12)]);

// 5. StringSearch
const s = got.search;
eq('StringSearch found', s.found, V(6));
eq('StringSearch not found', s.notFound, V(-1));
eq('StringSearch empty SearchTarget', s.emptyTarget, V(-1));
eq('StringSearch empty SearchStr gives StartPos', s.emptySearch, [V(0), V(3)]);
eq('StringSearch StartPos beyond the end', s.beyondEnd, V(-1));
eq('StringSearch Null SearchTarget', s.nullTarget, V(null));
eq('StringSearch Null SearchStr', s.nullSearch, V(null));
ok('StringSearch negative StartPos is a script error', typeof s.negative.err === 'string' && /Invalid procedure call/.test(s.negative.err), s.negative);
eq('StringSearch is case-sensitive by default', s.caseSensitiveMiss, V(-1));
eq('StringSearch case-insensitive hit', s.caseInsensitiveHit, V(6));
eq('StringSearch second occurrence through StartPos', s.startPosHit, [V(0), V(3)]);
eq('StringSearch StartPos is inclusive', s.startPosOnly, [V(-1), V(4)]);

// 6. TrimString
eq('TrimString both', got.trim.both, V('ab c'));
eq('TrimString leading only', got.trim.left, V('ab c  '));
eq('TrimString trailing only', got.trim.right, V('  ab c'));
eq('TrimString neither: unchanged', got.trim.none, V('  ab c  '));
eq('TrimString logs nothing when it trims', got.trimLogBefore, []);
eq('TrimString neither: warning', got.trimWarn, ['info:WARNING : TrimString has no effect when both TrimLeft,TrimRight are false']);
eq('TrimString keeps a leading tab and a trailing newline', got.trim.tabNewline, V('\t  x \n'));
eq('TrimString removes only the spaces outside the tab / newline', got.trim.spacesAroundTab, V('\tx\n'));
eq('TrimString Null', got.trim.nul, V(null));

// 7. XSIRound
eq('XSIRound: 2.5, 3.5, 0.125@2, -2.5, 1.2345@2, 0.5, 1.5, -3.5, 2.4, 2.6, -0.5, 1.005@2, 7, Null, 1.25@1, 1.35@1', got.round,
  [2, 4, 0.12, -2, 1.23, 0, 2, -4, 2, 3, 0, 1, 7, null, 1.2, 1.4].map(V));
ok('XSIRound negative decimals is a script error', typeof got.roundErr.err === 'string', got.roundErr);

// 8. LargeMsgBox / PickFolder batch
eq('LargeMsgBox (batch): true, no new property under the scene root, no undo entry', got.largeBatch, [V(true), true, 0]);
ok('PickFolder (batch) raises and leaves the scene root alone (Q5)', typeof got.pickBatch[0].err === 'string' && got.pickBatch[1] === true, got.pickBatch);

// 9. directories
const d = got.dirs;
eq('CreateAddonDirectories returns ""', d.plain, V(''));
eq('add-on root is RootPath\\Addons\\AddonName', d.plainRoot, true);
eq('the standard tree (15 leaves) below the add-on root', d.plainTree, TREE);
eq('16 folders: the add-on root plus 15 standard sub-folders', 1 + SUBFOLDERS.filter(x => d.plainTree.includes(x.replace(/\//g, '\\'))).length, 16);
eq('RootPath ending in "Addons" (any case): returns ""', d.addons, V(''));
eq('RootPath ending in "Addons": no second Addons level', d.addonsRoot, [true, false]);
eq('RootPath ending in "Addons": same tree', d.addonsTree, TREE);
eq('a trailing separator defeats the "Addons" test', [d.trailing, d.trailingRoot], [V(''), true]);
eq('existing folders are left alone', [d.again, d.kept], [V(''), '// keep']);
ok('add-on root cannot be created: "Problem creating directory" + path + description', typeof d.fail.v === 'string' && d.fail.v.startsWith('Problem creating directory\nC:\\temp\\cad4\\Addons\\MyTool\n') && d.fail.v.split('\n').length === 3 && d.fail.v.split('\n')[2] !== '', d.fail);
ok('a sub-folder failure is a command error', typeof d.subFail.err === 'string', d.subFail);
eq('CreateWorkgroupDirectories returns ""', d.wg, V(''));
eq('workgroup: the same tree directly under WorkgroupPath', d.wgTree, TREE);
ok('workgroup root cannot be created: problem text with the workgroup path', typeof d.wgFail.v === 'string' && d.wgFail.v.startsWith('Problem creating directory\nC:\\temp\\cad4\\Addons\\wg\n'), d.wgFail);
eq('both directory commands are logged (7 completed calls; the raised one is not)', d.cmdLog, 7);

// 10. FindFilesInFolder
const f = got.find; const FD = 'C:\\temp\\find\\'; const FILES = ['abcdef.txt', 'a.json', 'b.js', 'README.md', 'xabc.txt'];
eq('FindFilesInFolder first match, full path', f.firstFull, V(FD + 'abcdef.txt'));
eq('FindFilesInFolder first match, bare name', f.firstBare, V('abcdef.txt'));
eq('FindFilesInFolder all, full path (files only, no folders)', f.allFull, V(FILES.map(x => FD + x)));
eq('FindFilesInFolder all, bare names', f.allBare, V(FILES));
eq('pattern "abc" matches abcdef.txt, not xabc.txt (must start at the first character)', f.prefix, V(['abcdef.txt']));
eq('pattern ".*\\.js" matches a.json and b.js (need not reach the end)', f.jsPrefix, V(['a.json', 'b.js']));
eq('pattern is case-insensitive', f.caseInsensitive, V('README.md'));
eq('no match: "" or an empty array', f.none, [V(''), V([])]);
eq('FindFilesInFolder logs nothing (not in the command log either)', got.findLog, []);
eq('missing folder: "" or an empty array', got.findMissing, [V(''), V([])]);
eq('missing folder: error text', got.findMissingLog, Array(2).fill('error:FindFilesInFolder - problem with argument C:\\temp\\nope : Path not found'));

// 11. SpdlCheck
const sp = got.spdl;
eq('SpdlCheck empty path', [sp.empty, sp.emptyLog], [NONE, ['error:Invalid empty path argument to SpdlCheck', 'cmd:SpdlCheck "", true']]);
eq('SpdlCheck not a .spdl file, no UI', [sp.notSpdl, sp.notSpdlLog], [V('Failure: Not a SPDL File'), ['cmd:SpdlCheck "C:\\x\\thing.txt", false']]);
eq('SpdlCheck not a .spdl file, with UI (batch)', sp.notSpdlUi, V('Failure: Not a SPDL File'));
ok('SpdlCheck run step raises "not yet attested" without a launcher (Q3, Q8)', typeof sp.noLauncher.err === 'string' && /^not yet attested/.test(sp.noLauncher.err) && /cmd-01b-sdk-helpers\.md/.test(sp.noLauncher.err), sp.noLauncher);
ok('SpdlCheck command line (".SPDL" in any case is accepted)', /^spdlcheck -nologo -noverbose -out "(.+)\\spdlcheckoutput\.tmp" "C:\\x\\Thing\.SPDL"$/.test(sp.cmdLine ?? ''), sp.cmdLine);
eq('SpdlCheck with a launcher hook: returns the temp file text', sp.withLauncher, V('Compilation succeeded\n'));
ok('SpdlCheck launches blocking, once', sp.launched.length === 1 && sp.launched[0][1] === true && /"C:\\x\\thing\.spdl"$/.test(sp.launched[0][0]), sp.launched);
eq('SpdlCheck deletes the temp file', sp.tmpDeleted, true);
ok('SpdlCheck missing temp file is a command error', typeof sp.noTemp.err === 'string', sp.noTemp);

// 12. PackageAddon
const p = got.pkg; const T = 'C:\\temp\\pk\\Addons\\MyTool';
eq('PackageAddon bad source', p.badSource, { r: V(p.badSourceExpect), log: ['error:' + p.badSourceExpect, 'cmd:PackageAddon "NoSuchAddon", "", true, ""'] });
const OUTSIDE = 'Invalid Source Directory argument - must be a directory within the Addons folder';
eq('PackageAddon source outside an Addons folder', [p.outside.r, p.outside.log[0]], [V(OUTSIDE), 'error:' + OUTSIDE]);
eq('PackageAddon success returns ""', p.all.r, V(''));
eq('PackageAddon log lines', p.all.log.slice(0, 2), [`info:Packaging: ${T}`, 'info:Destination: C:\\temp\\pk\\out\\all.xsiaddon']);
ok('PackageAddon completion line with the file count', /^info:Packaging of 6 files complete \([0-9.e-]+ seconds\)$/.test(p.all.log[2] ?? ''), p.all.log);
eq('PackageAddon file count without ExcludeDirs', p.allManifest?.filter(l => l.startsWith('other\t')).length, 6);
eq('PackageAddon collects depth first: files of a folder, then its sub-folders', p.allStatus,
  [`\tadding: ${T}\\readme.txt`, `\tadding: ${T}\\Application\\Plugins\\p.js`, `\tadding: ${T}\\src\\a.cpp`, `\tadding: ${T}\\src\\b.cpp`, `\tadding: ${T}\\Debug\\x\\o.obj`, `\tadding: ${T}\\Data\\SRC\\d.txt`, 'Compressing and saving to disk']);
eq('PackageAddon target directories are relative to the source root', p.allManifest?.filter(l => l.startsWith('other\t')).map(l => l.split('\t')[2]), ['', '\\Application\\Plugins', '\\src', '\\src', '\\Debug\\x', '\\Data\\SRC']);
eq('PackageAddon progress bar: caption, cancel disabled, maximum, step, hidden at the end, one increment per status', [p.progress.caption, p.progress.cancelEnabled, p.progress.maximum, p.progress.step, p.progress.visible, p.progress.value], ['Packaging Addon', false, 200000, 1, false, 7]);
ok('PackageAddon sub-directory and default installation path are set on the add-on', p.allManifest?.includes('SubDirectory=MyTool') && p.allManifest?.some(l => /^DefaultInstallationPath=.+\\Addons$/.test(l)), p.allManifest);
const EXISTS = 'File already exists C:\\temp\\pk\\out\\all.xsiaddon';
eq('PackageAddon existing destination, Overwrite false', [p.exists.r, p.exists.log[0]], [V(EXISTS), 'error:' + EXISTS]);
eq('PackageAddon Overwrite true replaces the file; .xsiaddon appended; exclusion ignores case', [p.overwrite.r, p.overwriteManifest.filter(l => l.startsWith('other\t')).length], [V(''), 2]);
eq('PackageAddon file count with ExcludeDirs "src;Debug" (matches folder names at any depth)', p.excludeStatus,
  [`\tadding: ${T}\\readme.txt`, `\tadding: ${T}\\Application\\Plugins\\p.js`, `Skipping ${T}\\src`, `Skipping ${T}\\Debug`, `Skipping ${T}\\Data\\SRC`, 'Compressing and saving to disk']);
ok('PackageAddon exclusions are not trimmed ("src; Debug" keeps Debug)', /^info:Packaging of 3 files complete/.test(p.noTrim.log[2] ?? ''), p.noTrim.log);
eq('PackageAddon destination that is a folder: <folder>\\<name>.xsiaddon', [p.destFolder.r, p.destFolder.log[1], p.destFolderFile], [V(''), 'info:Destination: C:\\temp\\pk\\out\\MyTool.xsiaddon', true]);
eq('PackageAddon creates missing destination folders; existing .XSIADDON suffix kept', [p.newParent.r, p.newParentFile], [V(''), true]);
eq('PackageAddon default destination has no separator (as the script reads; Q9)', [p.defaultDest.r, p.defaultDest.log[1], p.defaultDestFile], [V(''), 'info:Destination: C:\\temp\\pk\\AddonsMyTool.xsiaddon', [true, false]]);
const EMPTY = 'No .xsiaddon file was created because no files were found to package';
eq('PackageAddon empty source', [p.empty.r, p.empty.log.includes('error:' + EMPTY), p.emptyFile], [V(EMPTY), true, false]);
eq('PackageAddon source by name under <user path>\\Addons', [p.byName.r, p.byName.log[0]], [V(''), `info:Packaging: ${p.byNameSrc}`]);
eq('PackageAddon is logged', p.byName.log[p.byName.log.length - 1], 'cmd:PackageAddon "ByName", "C:\\temp\\pk\\out\\byname", true, ""');
eq('PackageAddon hides the progress bar', p.progressHidden, true);

// 13. PackageAddonUI batch, ShowFile* errors
ok('PackageAddonUI is refused in batch', typeof got.pkgUiBatch.err === 'string' && /batch/.test(got.pkgUiBatch.err), got.pkgUiBatch);
eq('ShowFileForEdit empty name', got.showEmpty, [NONE, ['error:No file specified in call to ShowFileForEdit']]);
eq('ShowFileInShaderCodeEditor empty name', got.showShaderEmpty, [NONE, ['error:No file specified in call to ShowFileInShaderCodeEditor']]);

// 14. editor-view model
const v = got.views;
eq('ShowFileForEdit .dll / .so: null, no view', v.dll.slice(0, 3), [V(null), V(null), 0]);
eq('ShowFileForEdit creates a "Text Editor" view and returns it', v.created, { type: 'Text Editor', name: 'Text Editor', visible: true, state: 0, attrs: { filename: 'C:\\Scripts\\My.js', files: 'C:\\Scripts\\My.js', activetab: 'C:\\Scripts\\My.js', errorlinenum: '12' } });
eq('file already open: null, view made visible, errorlinenum and activetab (as given) set, no new view', [v.found, v.foundState.visible, v.foundState.attrs.errorlinenum, v.foundState.attrs.activetab, v.foundState.count], [V(null), true, '3', 'c:/scripts/MY.js', 1]);
eq('the file name is a regex pattern ("." matches "\\"); no errorlinenum without a line', v.foundNoLine, [V(null), '3', 'scripts.my']);
eq('not open, a visible view exists: opened there, null', [v.reuse, v.reuseState.attrs.filename, v.reuseState.count], [V(null), 'C:\\Scripts\\Other.vbs', 1]);
eq('Script Editor views come before Text Editor views', [v.order, ...v.orderState], [V(null), 'C:\\Scripts\\Third.py', 'C:\\Scripts\\Other.vbs', 2]);
eq('".DLL" passes the lower-case extension test', v.upperDll, [V(null), 'C:\\p\\PLUGIN.DLL']);
eq('a path with regex characters can raise', v.regexErr, true);
eq('external editor, launch fails: warning, then the built-in editor', [v.extNoHook?.type, v.extNoHookLog.length, /^info:WARNING : Problem launching external editor: /.test(v.extNoHookLog[0] ?? ''), v.extNoHookCmd], ['Text Editor', 1, true, 'notepad.exe "C:\\a b\\f.js"']);
eq('external editor: null, no view, launched without waiting', [v.extQuoted, v.extSubst, v.extSubstNoLine, v.extOnlyS, v.extViews], [V(null), V(null), V(null), V(null), 0]);
eq('external editor command lines (trimmed; quoted name; first %s / %l; line 1 when <= 0)', v.extSeen, [['notepad.exe "C:\\a b\\f.js"', false], ['edit C:\\f.js -n7 %s %l', false], ['edit C:\\f.js -n1 %s %l', false], ['edit C:\\f.js', false]]);
eq('external editor: "Launching <command line>" at verbose level', v.extVerbose, ['Launching notepad.exe "C:\\a b\\f.js"', 'Launching edit C:\\f.js -n7 %s %l', 'Launching edit C:\\f.js -n1 %s %l', 'Launching edit C:\\f.js']);
eq('shader editor: new "Shader Code Editor" view with the parser; text editors ignored', [v.shNew, v.shCount, v.shTextUntouched], [{ type: 'Shader Code Editor', name: 'Shader Code Editor', visible: true, state: 0, attrs: { parser: 'cgfx', filename: 'C:\\sh\\a.cgfx', files: 'C:\\sh\\a.cgfx', activetab: 'C:\\sh\\a.cgfx', errorlinenum: '4' } }, 2, true]);
eq('shader editor: reused view keeps its parser', [v.shReuse, v.shReuseAttrs.parser, v.shReuseAttrs.filename], [V(null), 'cgfx', 'C:\\sh\\b.glsl']);
eq('shader editor: file already open', [v.shFound, v.shFoundAttrs.activetab, v.shFoundAttrs.errorlinenum, v.shFoundAttrs.parser], [V(null), 'C:\\sh\\A.CGFX', '9', 'cgfx']);

// 15. interactive
const i = got.inter;
eq('LargeMsgBox (interactive): TextProp "Text" under the scene root, shown modally with the title', i.large, { promise: true, propType: 'TextProp', propText: 'line one\nline two', title: 'My Title', shown: 'line one\nline two', height: '275px' });
eq('LargeMsgBox OK: true, property deleted', [i.largeOk, i.largeGone], [true, true]);
eq('LargeMsgBox Cancel: false, property deleted; default title "Info"', [i.largeCancel, i.largeGone2, i.largeDefaultTitle], [false, true, 'Info']);
eq('LargeMsgBox is not in the command log', i.largeCmdLog, []);
eq('PickFolder (interactive): property, Directory parameter, layout', i.pick, { prop: true, params: ['Directory'], value: 'C:\\start', title: 'Pick', help: 'Choose the folder', control: 'folder', hasLabel: false, group: '' });
eq('PickFolder OK: the Directory value, property deleted', [i.pickOk, i.pickGone], ['D:\\picked', true]);
eq('PickFolder Cancel: "", property deleted', [i.pickCancel, i.pickGone2], ['', true]);
eq('XSIInputBox (interactive): prompt, title, default', i.input, { title: 'Ask', prompt: 'Your name', value: 'anon' });
eq('XSIInputBox OK: the typed string; Cancel: ""', [i.inputOk, i.inputCancel], ['typed', '']);
eq('SpdlCheck with UI: message box 1194', i.spdlBox, [V('Failure: Not a SPDL File'), 1, 'Spdlcheck only works on files with the .spdl extension']);
ok('ShowFileForEdit .dll: message box 1190', i.dllBox[0].v === null && /^This is a compiled C\+\+ plug-in\./.test(i.dllBox[1] ?? ''), i.dllBox);
eq('ShowFileForEdit (interactive): floating Text Editor on the virtual file', i.editor, { type: 'Text Editor', name: 'Text Editor', visible: true, text: '// hello', title: 'Text Editor' });
eq('closing the floating editor removes the view', i.editorClosed, [0, false]);
const P = i.pkgUi;
eq('PackageAddonUI bad path argument', P.badPath, [NONE, ['error:PackageAddonUI - Problem with path argument C:\\temp\\nope : Path not found'], 0]);
eq('PackageAddonUI defaults (no Source): both fields = user add-on path', P.defaults, { Source: P.userAddonPath, Destination: P.userAddonPath, Overwrite: true, ExcludeDir: 'src;Debug;Ship', AuthorName: '', Description: '' });
eq('PackageAddonUI layout', P.layout, [
  'text:Use this dialog to build an .xsiaddon file containing all the files\nat the Source directory, including subdirectories.',
  'spacer',
  'group:Input=Source/folder/Source,ExcludeDir/string/Directories to Exclude',
  'group:Output=Destination/file/Destination,Overwrite/bool/Overwrite existing .xsiaddon',
  'group:Author=AuthorName/string/Name,AuthorEmail/string/Email,Company/string/Company,URL/string/URL',
  'group:Description=Description/multiline/',
]);
eq('PackageAddonUI destination filter, description height, Platforms hidden', [P.filter, P.descHeight, P.platformsShown], ['xsiaddon (*.xsiaddon)|*.xsiaddon||', '200px', false]);
eq('PackageAddonUI resets the PackageAddon_DetailDict global to null', P.detailGlobal, null);
eq('PackageAddonUI validation messages 1191, 1192, 1193 (page reopens)', [P.msgs, P.reopened], [['No addon directory specified', 'Source Add-on Directory does not exist', 'Source directory must be a directory within the Addons folder'], 1]);
eq('PackageAddonUI returns false on success; runs the logged PackageAddon command', [P.result, P.runLog, P.file], [false, ['cmd:PackageAddon "C:\\temp\\pk\\Addons\\MyTool", "C:\\temp\\pk\\out\\fromui.xsiaddon", true, "src"'], true]);
eq('PackageAddonUI remembers the exclude list; detail global null afterwards', [P.remembered, P.detailAfter], ['src', [true, null]]);
ok('PackageAddonUI with Source: destination <parent>\\<name>.xsiaddon, remembered excludes', P.withSource.Source === T && P.withSource.Destination === T + '.xsiaddon' && P.withSource.ExcludeDir === 'src' && typeof P.withSource.title === 'string' && P.withSource.title !== '', P.withSource);
eq('PackageAddonUI Cancel returns false', P.cancel, false);
eq('PackageAddonUI packaging failure: critical box with the reason, still false', [P.failMsg, P.failResult, P.left], ['File already exists C:\\temp\\pk\\out\\fromui.xsiaddon', false, 0]);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-01b SDK helper commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-01b SDK helper commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired: GetGlobal, SetGlobal, SetGlobalObject, XSIInputBox, StringSearch, TrimString, XSIRound, LargeMsgBox, FindFilesInFolder, CreateAddonDirectories, CreateWorkgroupDirectories (file system = the session\'s virtual host FS)');
console.log('   partly wired: PackageAddon (.xsiaddon content SYS-13, detail files Q10, default destination Q9), PackageAddonUI (title id 1532 Q2, detail files Q10), SpdlCheck (run step Q3/Q8), ShowFileForEdit / ShowFileInShaderCodeEditor (editor-view model, Q6), PickFolder (batch error Q5)');
