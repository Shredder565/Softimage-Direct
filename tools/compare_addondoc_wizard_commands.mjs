// CMD-01-ADDONDOC: the six add-on documentation / wizard helper commands on the command bus.
// Checked against the "Wire contract" of docs/ghidra/cmd-01-addondoc-wizardhelper.md and the registry dump
// data/commands_full.json. No XSIBATCH golden was run for this row, so this is a contract check. File
// operations run against the session's virtual host file system (app.hostFs).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_addondoc_wizard_commands.mjs
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

const NAMES = ['GetAddonDocHelper', 'GetAddonDocPath', 'GetAddonUpdateArray', 'GetNbUpdatesPending', 'WizardHelper', 'CreateXMLDoc'];
const DETAIL_KEYS = ['Categories', 'PlatForms', 'Title', 'AuthorName', 'AuthorEMail', 'Company', 'URL', 'Language', 'Summary', 'Usage'];
const DOC_Q2 = ['GetTemplateInfo', 'GetContentItemInfo', 'GetTemplateShortName', 'GetTemplateImage', 'SortAddons', 'GetAddonDocTableAsHTML',
  'GetTemplateTableAsHTML', 'GetContentItemTableAsHTML', 'ExecuteContentItem', 'GenerateTemplateWizard'];
// CMD-B15f closed Q3 for nine of these (miscScriptsB15fGen.ts); the rest stay "not yet attested".
const WIZ_Q3 = ['GetSelectedRows', 'DeleteSelectedRows', 'DeleteRow', 'ClearGrid', 'GetNullOrValue',
  'GenerateRTShaderCode', 'GenerateRTShaderFile', 'GenerateCppProjectFromArray', 'BuildCSVarType'];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => { const c = list.find(x => (x.scripting_name || x.name) === n); return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('CreateXMLDoc') && !!window.Application?.commands?.get('FindFilesInFolder'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, DOC_Q2, WIZ_Q3 }) => {
  const app = window.Application; const fsx = app.hostFs; const S = app.addonDocWizard; const SH = app.sdkHelpers;
  const out = {};
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: v === undefined ? '<none>' : v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const call = (f) => { try { const v = f(); return { v: v === undefined ? '<none>' : v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const mark = () => app.log.length;
  const tick = () => new Promise(r => setTimeout(r, 30));
  const q = (s) => document.querySelector(s);

  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.flags = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? { noLog: !!d.noLog } : null]; }));

  // ---- defaults: every command with default arguments
  out.defaults = {};
  for (const n of NAMES) {
    const m = mark(); const u = app.undoStack.length; const r = run(n);
    out.defaults[n] = { err: r.err ?? null, type: r.err ? null : r.v === null ? 'null' : typeof r.v, v: (r.v !== null && typeof r.v === 'object') ? null : r.v, log: logFrom(m), undo: app.undoStack.length - u };
  }
  out.fresh = [app.run('GetAddonDocHelper') !== app.run('GetAddonDocHelper'), app.run('WizardHelper') !== app.run('WizardHelper'), app.run('CreateXMLDoc') !== app.run('CreateXMLDoc')];

  const H = app.run('GetAddonDocHelper'); const W = app.run('WizardHelper');
  const USER = SH.paths[1]; const ADDONS = USER + '\\Addons'; const A = ADDONS + '\\MyTool';
  out.env = { user: USER, login: S.login, version: S.version, factory: S.factoryPath };

  // ---- naming
  out.naming = {
    prefix: H.Prefix,
    files: [H.GetAddonDocFileName('X'), H.GetAddonJpgFileName('X'), H.GetAddonDescriptionFileName('X'), H.GetAddonDetailFileName('X')],
    subdir: [H.GetAddonSubdirFromFullPath(A), H.GetAddonSubdirFromFullPath('C:\\x\\Addons\\A\\B'), H.GetAddonSubdirFromFullPath('C:\\x\\addons\\A'),
      H.GetAddonSubdirFromFullPath('C:\\x\\NoSuch\\A'), H.GetAddonSubdirFromFullPath('C:\\a\\Addons\\b\\Addons\\c')],
    fromFile: [H.GetAddonNameFromFile('netview_MyTool.htm'), H.GetAddonNameFromFile('NETVIEW_Other.v2.htm'), H.GetAddonNameFromFile('readme.htm'), H.GetAddonNameFromFile('netview_nodot')],
    recommended: H.GetRecommendedAddonDocPath(A),
  };

  // ---- GetAddonDocPath (command and helper)
  {
    const g = {};
    fsx.ensureFolder(A);
    let m = mark();
    g.noAddons = [run('GetAddonDocPath', { Path: 'C:\\temp\\nowhere' }), logFrom(m)];
    g.empty = run('GetAddonDocPath', { Path: A });
    fsx.writeFile(A + '\\zz.htm', 'x'); fsx.writeFile(A + '\\netview_Other.htm', 'other'); fsx.writeFile(A + '\\netview_Third.htm', 'third');
    g.fallback = run('GetAddonDocPath', { Path: A });
    g.findSub = H.FindAddonDocInSubFolder(A);
    fsx.writeFile(A + '\\netview_MyTool.htm', 'mine');
    g.direct = run('GetAddonDocPath', { Path: A });
    g.helperSame = H.GetAddonDocPath(A);
    // not recursive
    const B = ADDONS + '\\Deep'; fsx.ensureFolder(B + '\\sub'); fsx.writeFile(B + '\\sub\\netview_Deep.htm', 'x');
    g.notRecursive = run('GetAddonDocPath', { Path: B });
    // .htm must be at the end
    const C = ADDONS + '\\Tail'; fsx.ensureFolder(C); fsx.writeFile(C + '\\netview_Tail.htm.bak', 'x');
    g.atEnd = run('GetAddonDocPath', { Path: C });
    out.docPath = g;
  }

  // ---- folders / walks
  {
    const f = {};
    fsx.ensureFolder(ADDONS + '\\Application'); fsx.ensureFolder(ADDONS + '\\Data');
    fsx.writeFile(A + '\\one.xsitemplate', '<t Date="2010-01-01"/>'); fsx.writeFile(A + '\\two.xsitemplate', '<t/>');
    f.folders = [H.GetAddonFolders(ADDONS, false), H.GetAddonFolders(ADDONS, true), H.GetAddonFolders('C:\\nope\\Addons', true)];
    f.templatesInDir = H.FindTemplateDocInSubFolder(A);
    let m = mark(); f.templatesMissing = [H.FindTemplateDocInSubFolder('C:\\nope\\x'), logFrom(m).some(l => l.startsWith('info:WARNING : '))];
    const FA = S.factoryPath + '\\Addons\\FactoryAddon'; fsx.ensureFolder(FA); fsx.writeFile(FA + '\\netview_FactoryAddon.htm', 'f'); fsx.writeFile(FA + '\\f.xsitemplate', '<t/>');
    const WG = 'C:\\wg1'; fsx.ensureFolder(WG + '\\Addons\\WgAddon'); fsx.writeFile(WG + '\\Addons\\WgAddon\\netview_WgAddon.htm', 'w');
    S.workgroups = [WG];
    f.docsAll = H.FindAddonDocs(true, true, true);
    f.docsUser = H.FindAddonDocs(true, false, false);
    f.docsFactory = H.FindAddonDocs(false, true, false);
    f.templatesAll = H.FindTemplateDocs(true, true, true);
    out.walk = f;
  }

  // ---- detail / description files
  {
    const d = {};
    d.def = H.GetDefaultDetailDict(); d.defKeys = Object.keys(d.def);
    const file = A + '\\netview_MyTool.xml';
    const dict = H.GetDefaultDetailDict(); dict.Company = 'ACME'; dict.URL = 'http://example.com'; dict.AuthorEMail = 'a@b.c';
    d.saved = H.saveAddonDetails(file, dict);
    d.text = fsx.readFile(file);
    d.loaded = H.loadAddonDetails(file); d.loadedKeys = Object.keys(d.loaded);
    let m = mark(); d.missing = [H.loadAddonDetails(A + '\\nope.xml'), logFrom(m)];
    fsx.writeFile(A + '\\bad.xml', '<a><b></a>');
    m = mark(); d.bad = [H.loadAddonDetails(A + '\\bad.xml'), logFrom(m).map(l => l.slice(0, 60))];
    fsx.writeFile(A + '\\dup.xml', '<?xml version="1.0"?>\n<anything foo="1">\n\t<K>first</K>\n\t<L>x</L>\n\t<K>last</K>\n</anything>\n');
    d.dup = H.loadAddonDetails(A + '\\dup.xml');
    m = mark(); d.saveFail = [H.saveAddonDetails('C:\\no\\such\\folder\\f.xml', dict), logFrom(m)];
    // no escaping: a value with & produces a file that will not load again
    H.saveAddonDetails(A + '\\amp.xml', { Title: 'a & b' });
    d.ampText = fsx.readFile(A + '\\amp.xml').includes('<Title>a & b</Title>');
    m = mark(); d.ampLoad = [H.loadAddonDetails(A + '\\amp.xml'), logFrom(m).length];
    out.details = d;
  }

  // ---- CreateXMLDoc
  {
    const x = {};
    const doc = app.run('CreateXMLDoc');
    x.objType = doc.ObjType; x.noRoot = call(() => doc.GetXMLAsString());
    const r0 = doc.CreateRootElement('old'); const root = doc.CreateRootElement('root');
    x.replaced = [doc.documentElement === root, r0 !== root, root.ObjType, root.name];
    root.SetAttribute('b', '1'); root.SetAttribute('a', 2); root.SetAttribute('b', 'again');
    const c1 = root.AddChild('leaf'); c1.text = 'T'; c1.cdata = 'ignored';
    const c2 = root.AddChild('cd'); c2.cdata = 'x < y';
    root.AddChild('empty');
    const c4 = root.AddChild('nest'); c4.SetAttribute('k', 'v'); const g = c4.AddChild('inner'); g.text = 'deep & raw';
    x.state = { attrs: root.attrs, children: root.children.map(c => c.name) };
    x.text = doc.GetXMLAsString();
    x.save = [doc.Save(A + '\\doc.xml'), fsx.readFile(A + '\\doc.xml') .split('\n').slice(2).join('\n') === x.text.split('\n').slice(2).join('\n')];
    x.saveFail = doc.Save('C:\\no\\such\\folder\\doc.xml');
    out.xml = x;
  }

  // ---- WizardHelper: text files
  {
    const t = {};
    t.type = W.Type;
    t.write = call(() => W.TextToFile(A + '\\t.txt', 'one\r\ntwo\nthree'));
    t.read = W.TextFromFile(A + '\\t.txt'); t.readArr = W.TextFromFile(A + '\\t.txt', true);
    W.TextToFile(A + '\\t.txt', 'over'); t.overwrite = W.TextFromFile(A + '\\t.txt');
    W.TextToFile(A + '\\e.txt', ''); t.empty = [W.TextFromFile(A + '\\e.txt'), W.TextFromFile(A + '\\e.txt', true)];
    t.missing = call(() => W.TextFromFile(A + '\\nope.txt'));
    t.writeFail = call(() => W.TextToFile('C:\\no\\such\\f.txt', 'x'));
    t.noThrow = [W.TextToFile_NoThrow(A + '\\n.txt', 'x'), W.TextToFile_NoThrow('C:\\no\\such\\f.txt', 'x')];
    t.login = W.GetCurrentUserLogin(); t.templateFolder = W.GetTemplateFolder(); t.fso = W.FSO() === app.run('WizardHelper').FSO();
    out.text = t;
  }

  // ---- WizardHelper: template expansion
  {
    const e = {}; const T = A + '\\tpl.template';
    const gen = (...a) => call(() => W.GenerateStringFromTemplate(...a));
    fsx.writeFile(T, 'Hello %NAME% and %NAME%\n@if A\nonly A %X1%\n@elseif B\nonly B\n@else\nneither\n@endif\n@if !A\nnot A\n@endif\ntail');
    e.noDefines = gen(T, ['%NAME%', '%X\\d%'], ['World', 'num']);
    e.defA = gen(T, ['%NAME%', '%X\\d%'], ['World', 'num'], ['A']);
    e.defB = gen(T, ['%NAME%'], ['W'], ['B']);
    e.defNone = gen(T, [], [], []);
    e.defAB = gen(T, [], [], ['A', 'B']);
    fsx.writeFile(T, '@if A\na\n@if B\nab\n@else\na-notb\n@endif\n@else\nnota\n@if B\nnota-b\n@endif\n@endif\nend');
    e.nest = [gen(T, [], [], ['A']), gen(T, [], [], ['A', 'B']), gen(T, [], [], ['B']), gen(T, [], [], [])];
    fsx.writeFile(T, 'ab\nac'); e.order = gen(T, ['a', 'Xb'], ['X', 'Y']);
    let m = mark(); e.mismatch = [gen(T, ['a'], []), logFrom(m).filter(l => l.startsWith('error:')).length];
    fsx.writeFile(T, 'x\n@elseif A\n'); e.errElseif = gen(T, [], [], ['A']);
    fsx.writeFile(T, 'x\n@else\n'); e.errElse = gen(T, [], [], ['A']);
    fsx.writeFile(T, 'x\n@endif\n'); e.errEndif = gen(T, [], [], ['A']);
    fsx.writeFile(T, '@if A\nx'); e.errMissing = gen(T, [], [], ['A']);
    e.T = T;
    e.missingFile = gen(A + '\\nope.template', [], []);
    fsx.writeFile(T, 'v=%V%');
    e.file = [call(() => W.GenerateFileFromTemplate(T, A + '\\gen.txt', ['%V%'], ['7'])), fsx.readFile(A + '\\gen.txt')];
    fsx.writeFile(T, '@if A\nx\n@endif'); e.fileEmpty = [call(() => W.GenerateFileFromTemplate(T, A + '\\gen2.txt', [], [], [])), fsx.exists(A + '\\gen2.txt')];
    fsx.writeFile(T, '<p>%DESCRIPTION%</p><img src="%ADDONIMAGE%">'); e.initialHtml = H.GenerateInitialHTML('My text', T, 'pic.jpg');
    out.tpl = e;
  }

  // ---- WizardHelper: small helpers
  {
    const s = {};
    let m = mark();
    s.ext = ['VBScript', 'JScript', 'Python', 'PerlScript', 'Cpp', 'C#', 'HLSL', 'CGFX'].map(l => W.GetScriptExtension(l));
    s.extLogBefore = logFrom(m).length;
    m = mark(); s.extUnknown = [W.GetScriptExtension('Lua'), logFrom(m)];
    S.scriptingLanguage = 'Python ActiveX Scripting Engine';
    s.lang = ['a.so', 'a.cpp', 'a.h', 'a.c', 'a.js', 'a.vbs', 'a.pys', 'a.py', 'a.pls', 'a.pl', 'a.cs', 'a.fx', 'a.cgfx', 'a.txt'].map(f => W.GetLangFromExtension(f));
    S.scriptingLanguage = 'VBScript'; s.langPrefVb = W.GetLangFromExtension('noext');
    S.scriptingLanguage = 'Something else'; s.langPrefOther = W.GetLangFromExtension('a.unknown');
    S.scriptingLanguage = '';
    s.template = ['Python', 'JScript', 'Cpp', 'VBScript'].map(l => W.GetTemplate(l, 'Cmd'));
    s.vcproj = [W.GetVCProjFileTemplate('P', 'VS2012'), W.GetVCProjFileTemplate('P', 'VS2010')];
    s.reg = ['VBScript', 'JScript', 'Cpp', 'C#', 'Python', 'PerlScript'].map(l => W.GetRegInsertionComment(l));
    const plat = SH.platform; s.dll = ['Win32', 'Win64', 'Linux64'].map(p => { SH.platform = p; return W.GetDllFolder(); }); SH.platform = plat;
    s.decl0 = W.GetXSIDeclPath();
    const f2 = S.factoryPath + '\\include\\Rayflex'; fsx.ensureFolder(f2); fsx.writeFile(f2 + '\\xsi_decl.h', '//');
    s.decl1 = W.GetXSIDeclPath();
    const f1 = S.xsiSdkRoot + '\\include'; fsx.ensureFolder(f1); fsx.writeFile(f1 + '\\xsi_decl.h', '//');
    s.decl2 = W.GetXSIDeclPath();
    s.strings = [W.RemoveSpaces('  my new tool '), W.RemoveNonAlphaNumeric(' a-b c.d_9 '), W.ReplaceTokenInStr('a1b22c', '\\d+', '#'), W.Bool2Str(true), W.Bool2Str(false)];
    s.nums = [W.FloatPrec3(1.23456), W.FloatPrec3(-1.23456), W.FloatPrec3(2), W.IntToLong(5), W.IntToLong(1.5), W.IntToLong(true), W.IntToLong('false'), W.IntToLong('abc')];
    s.inplace = [W.GetInplaceProp('obj', 'Prop', [1, 'x']), W.GetInplaceProp(null, 'Prop', [1]), W.GetInplaceProp('obj', 'Prop', []), W.GetInplaceProp('obj', 'Prop')];
    out.small = s;
  }

  // ---- WizardHelper: views, wizard model
  {
    const v = {};
    S.views.length = 0;
    const n1 = W.ShowUrlInNetview('http://one/');
    v.created = { type: n1.type, name: n1.name, w: n1.width, h: n1.height, url: n1.attrs.url, visible: n1.visible, count: S.views.length };
    S.views.length = 0; S.views.push({ type: 'netview', name: 'netview', attrs: {}, width: 1, height: 1, visible: false, state: 2 }, { type: 'netview', name: 'netview2', attrs: {}, width: 1, height: 1, visible: false, state: 2 });
    const n2 = W.ShowUrlInNetview('http://two/');
    v.prefers2 = [n2.name, n2.attrs.url, n2.width, n2.height, n2.visible, n2.state, S.views.length];
    S.views.pop(); const n3 = W.ShowUrlInNetview('http://three/'); v.thenNetview = [n3.name, n3.attrs.url, S.views.length];
    W.ShowMenuAnchorPointsInNetview(); v.help = S.lastHelpTopic;
    const before = app.scene.root.children.filter(c => c.name === 'SDK_Wizards').length;
    const p1 = W.CreateWizard('MyWizardProp', true);
    const model = app.scene.root.children.find(c => c.name === 'SDK_Wizards');
    const p2 = W.CreateWizard('MyWizardProp', true); const p3 = W.CreateWizard('MyWizardProp', false);
    v.wizard = { before, models: app.scene.root.children.filter(c => c.name === 'SDK_Wizards').length, kind: model?.kind ?? model?.type, viewvis: model?.property('visibility')?.val('viewvis'),
      name: p1.name, type: p1.type, reuseSame: p1 === p2, noReuseNew: p3 !== p1, props: model.properties.filter(p => p.type === 'MyWizardProp').length };
    out.views = v;
  }

  // ---- unspecified members raise "not yet attested"
  out.unspec = {
    doc: DOC_Q2.map(n => typeof H[n] === 'function' ? call(() => H[n]()).err ?? 'no error' : 'missing'),
    wiz: WIZ_Q3.map(n => typeof W[n] === 'function' ? call(() => W[n]()).err ?? 'no error' : 'missing'),
  };

  // ---- update check
  {
    const u = {};
    S.fetchUpdateXml = null;
    let m = mark(); u.unreachable = [run('GetAddonUpdateArray'), logFrom(m)];
    m = mark(); u.nbUnreachable = [run('GetNbUpdatesPending'), logFrom(m).filter(l => l.startsWith('info:WARNING : Error checking for updates - ')).length];
    m = mark(); u.installUnreachable = call(() => H.CheckAndInstallAddonUpdates());
    S.fetchUpdateXml = () => '<root><content/></root>';
    m = mark(); u.noLastMod = [run('GetAddonUpdateArray'), logFrom(m)];
    S.fetchUpdateXml = () => '<root><oops></root>';
    m = mark(); u.parseErr = [run('GetAddonUpdateArray'), logFrom(m).map(l => l.slice(0, 44))];
    // installed: one.xsitemplate (Date 2010-01-01), two.xsitemplate (no Date), f.xsitemplate (no Date)
    fsx.writeFile(A + '\\fresh.xsitemplate', '<t Date="2014-06-01"/>');
    S.fetchUpdateXml = () => `<autocontent><lastmodification>2014</lastmodification><content>
      <item><date>2012-01-01</date><template>one.xsitemplate</template><url>http://u/one</url></item>
      <item><date>2012-01-01</date><template>fresh.xsitemplate</template><url>http://u/fresh</url></item>
      <item><date>2012-01-01</date><template>absent.xsitemplate</template><url>http://u/absent</url></item>
      <item><url>http://u/early</url><date>2012-01-01</date><template>absent2.xsitemplate</template></item>
      </content></autocontent>`;
    m = mark(); u.check = [run('GetAddonUpdateArray'), logFrom(m)];
    u.nb = run('GetNbUpdatesPending');
    u.upToDate = [H.IsAddonUpToDate('2012-01-01', 'fresh.xsitemplate'), H.IsAddonUpToDate('2012-01-01', 'one.xsitemplate')];
    m = mark(); u.install = [call(() => H.CheckAndInstallAddonUpdates()), logFrom(m).filter(l => l.startsWith('info:Installing addon: '))];
    S.fetchUpdateXml = () => '<autocontent><lastmodification/><content/></autocontent>';
    u.emptyArr = [run('GetAddonUpdateArray'), run('GetNbUpdatesPending')];
    S.fetchUpdateXml = null;
    out.update = u;
  }

  // ---- GenerateAddDocWizard
  {
    const w = {};
    const N = ADDONS + '\\DocTool'; fsx.ensureFolder(N);
    const prop = H.makeAddDocProperty();
    w.prop = { name: prop.name, params: ['AddonDescription', 'AddonImage', 'AddonHtmlTemplate'].map(n => prop.val(n)), tabs: prop.sdkTabs.map(t => [t.tab, t.items.map(i => [i.param ?? 'text', i.label ?? null, i.control ?? null, i.height ?? null]), t.button ?? null]), help: prop.helpTopic };
    app.Interactive = false;
    let m = mark(); w.batch = [H.GenerateAddDocWizard(N), fsx.listFiles(N).length, logFrom(m).length];
    app.Interactive = true;
    // cancel: nothing written
    let pr = H.GenerateAddDocWizard(N); await tick();
    w.open = !!q('.addondoc-wizard'); w.rows = [...document.querySelectorAll('.addondoc-wizard .sdkh-row')].map(r => [r.dataset.param, r.dataset.control]);
    w.groups = [...document.querySelectorAll('.addondoc-wizard .sdkh-group')].map(g => g.dataset.group);
    S.views.length = 0; q('.addondoc-wizard .addondoc-show-page').click(); w.showPage = [S.views[0]?.name, S.views[0]?.attrs.url];
    q('.addondoc-wizard .sdkh-modal-cancel').click(); w.cancel = [await pr, fsx.listFiles(N)];
    // OK with the default (missing) template: the description file is written, then the page step raises
    pr = H.GenerateAddDocWizard(N); await tick(); q('.addondoc-wizard .sdkh-modal-ok').click();
    w.okMissing = [await pr.then(v => ({ v }), e => ({ err: String(e?.message ?? e) })), fsx.listFiles(N)];
    // OK with a template and an image present
    const TF = W.GetTemplateFolder(); fsx.ensureFolder(TF);
    fsx.writeFile(TF + 'netview_ADDONNAME.htm.template', '<html>\n<img src="%ADDONIMAGE%">\n<p>%DESCRIPTION%</p>\n</html>'); fsx.writeFile(TF + 'netview_Default.jpg', 'JPEGDATA');
    SH.views.length = 0; app.prefValues = { ...(app.prefValues ?? {}), 'preferences.scripting.externaleditor': '' };
    pr = H.GenerateAddDocWizard(N); await tick();
    const ta = q('.addondoc-wizard .sdkh-row[data-param="AddonDescription"] textarea'); ta.value = 'A fine tool'; ta.dispatchEvent(new Event('input')); ta.dispatchEvent(new Event('change'));
    q('.addondoc-wizard .sdkh-modal-ok').click();
    w.ok = await pr.then(v => ({ v }), e => ({ err: String(e?.message ?? e) }));
    w.files = fsx.listFiles(N).slice().sort();
    w.txt = fsx.readFile(N + '\\netview_DocTool.txt'); w.htm = fsx.readFile(N + '\\netview_DocTool.htm'); w.jpg = fsx.readFile(N + '\\netview_DocTool.jpg');
    w.xml = H.loadAddonDetails(N + '\\netview_DocTool.xml');
    w.shown = SH.views.map(v => v.attrs.filename);
    w.docPathCmd = run('GetAddonDocPath', { Path: N });
    [...document.querySelectorAll('.sdkh-editor-window')].forEach(e => e.remove());
    out.wizard = w;
  }
  return out;
}, { NAMES, DOC_Q2, WIZ_Q3 });
await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const V = (v) => ({ v });
const isNYA = (s) => typeof s === 'string' && s.startsWith('not yet attested');

// 1. registration and flags
for (const n of NAMES) {
  ok(`${n}: in the registry dump`, registry[n] !== null, n);
  eq(`${n}: registered with the registry's arguments`, got.reg[n], registry[n]);
  eq(`${n}: logging off`, got.flags[n], { noLog: true });
}

// 2. defaults
const D = got.defaults;
for (const n of ['GetAddonDocHelper', 'WizardHelper', 'CreateXMLDoc']) eq(`${n}() returns an object, logs nothing, no undo entry`, [D[n].err, D[n].type, D[n].log, D[n].undo], [null, 'object', [], 0]);
eq('each call returns a fresh object (doc helper, wizard helper, XML doc)', got.fresh, [true, true, true]);
eq('GetAddonDocPath() without a path returns ""', [D.GetAddonDocPath.err, D.GetAddonDocPath.v], [null, '']);
eq('GetAddonUpdateArray() returns null (address not reachable, no request made)', [D.GetAddonUpdateArray.err, D.GetAddonUpdateArray.type], [null, 'null']);
ok('GetAddonUpdateArray() logs the warning "Error checking for updates - <reason>"', D.GetAddonUpdateArray.log.length === 1 && D.GetAddonUpdateArray.log[0].startsWith('info:WARNING : Error checking for updates - ') && /not reachable/.test(D.GetAddonUpdateArray.log[0]), D.GetAddonUpdateArray.log);
ok('GetNbUpdatesPending() ends in a script error when the check fails (contract, inferred; Q4)', typeof D.GetNbUpdatesPending.err === 'string', D.GetNbUpdatesPending);

const U = got.env.user, AD = `${U}\\Addons`, A = `${AD}\\MyTool`, F = got.env.factory;

// 3. naming
const n = got.naming;
eq('helper Prefix', n.prefix, 'netview_');
eq('the four file names', n.files, ['netview_X.htm', 'netview_X.jpg', 'netview_X.txt', 'netview_X.xml']);
eq('GetAddonSubdirFromFullPath: name, nested, case-sensitive, no segment, first segment', n.subdir, ['MyTool', 'A\\B', '', '', 'b\\Addons\\c']);
eq('GetAddonNameFromFile: name, case-insensitive + first dot, wrong shape, no dot', n.fromFile, ['MyTool', 'Other', '', '']);
eq('GetRecommendedAddonDocPath does not check existence', n.recommended, `${A}\\netview_MyTool.htm`);

// 4. GetAddonDocPath
const p = got.docPath;
eq('GetAddonDocPath: path not under Addons gives "" and no log', p.noAddons, [V(''), []]);
eq('GetAddonDocPath: add-on folder without a page gives ""', p.empty, V(''));
eq('GetAddonDocPath: falls back to the first netview_*.htm of the folder', p.fallback, V(`${A}\\netview_Other.htm`));
eq('FindAddonDocInSubFolder: first match, full path', p.findSub, `${A}\\netview_Other.htm`);
eq('GetAddonDocPath: dir\\netview_<N>.htm wins when it exists', p.direct, V(`${A}\\netview_MyTool.htm`));
eq('command and helper method agree', p.helperSame, p.direct.v);
eq('GetAddonDocPath: the search is not recursive', p.notRecursive, V(''));
eq('GetAddonDocPath: ".htm" must end the name', p.atEnd, V(''));

// 5. folders / walks
const w = got.walk;
eq('GetAddonFolders skips Application and Data (names / full paths / missing folder)', w.folders,
  [['MyTool', 'Deep', 'Tail'], [`${A}`, `${AD}\\Deep`, `${AD}\\Tail`], []]);
eq('FindTemplateDocInSubFolder: every .xsitemplate, full paths', w.templatesInDir, [`${A}\\one.xsitemplate`, `${A}\\two.xsitemplate`]);
eq('FindTemplateDocInSubFolder: failure gives an empty array and a warning', w.templatesMissing, [[], true]);
eq('FindAddonDocs: user, workgroups, factory; one page per add-on folder', w.docsAll,
  [`${A}\\netview_Other.htm`, 'C:\\wg1\\Addons\\WgAddon\\netview_WgAddon.htm', `${F}\\Addons\\FactoryAddon\\netview_FactoryAddon.htm`]);
eq('FindAddonDocs: user only', w.docsUser, [`${A}\\netview_Other.htm`]);
eq('FindAddonDocs: factory only', w.docsFactory, [`${F}\\Addons\\FactoryAddon\\netview_FactoryAddon.htm`]);
eq('FindTemplateDocs: same walk, all templates', w.templatesAll, [`${A}\\one.xsitemplate`, `${A}\\two.xsitemplate`, `${F}\\Addons\\FactoryAddon\\f.xsitemplate`]);

// 6. detail files
const d = got.details;
eq('default detail dictionary: ten keys in order', d.defKeys, DETAIL_KEYS);
eq('default detail dictionary: all empty except AuthorName = login', d.def, Object.fromEntries(DETAIL_KEYS.map(k => [k, k === 'AuthorName' ? got.env.login : ''])));
eq('saveAddonDetails returns true', d.saved, true);
{
  const lines = d.text.split('\n');
  eq('detail file line 1: XML declaration, version 1.0, no encoding', lines[0], '<?xml version="1.0"?>');
  ok('detail file line 2: "Generated by SimpleXMLDoc helper.  Executed <date> by <login>" comment', new RegExp(`^<!-- Generated by SimpleXMLDoc helper\\.  Executed .+ by ${got.env.login} -->$`).test(lines[1]), lines[1]);
  eq('detail file root: xsi_file with type, xsi_version, syntax_version in order', lines[2], `<xsi_file type="AddonInfo" xsi_version="${got.env.version}" syntax_version="1.0">`);
  eq('detail file children: one per key, dictionary order, one tab', lines.slice(3, 13),
    DETAIL_KEYS.map(k => `\t<${k}>${{ AuthorName: got.env.login, Company: 'ACME', URL: 'http://example.com', AuthorEMail: 'a@b.c' }[k] ?? ''}</${k}>`));
  eq('detail file: root end tag, final line feed, no carriage returns', [lines[13], lines[14], lines.length, d.text.includes('\r')], ['</xsi_file>', '', 15, false]);
}
eq('loadAddonDetails reads back every key in order', [d.loadedKeys, d.loaded.Company, d.loaded.URL, d.loaded.AuthorEMail, d.loaded.AuthorName], [DETAIL_KEYS, 'ACME', 'http://example.com', 'a@b.c', got.env.login]);
ok('loadAddonDetails: missing file gives an empty dictionary and one warning', JSON.stringify(d.missing[0]) === '{}' && d.missing[1].length === 1 && d.missing[1][0].startsWith(`info:WARNING : loadAddonDetails failure - ${A}\\nope.xml - `), d.missing);
ok('loadAddonDetails: parse error gives an empty dictionary and one warning', JSON.stringify(d.bad[0]) === '{}' && d.bad[1].length === 1 && d.bad[1][0].startsWith('info:WARNING : loadAddonDetails failure - '), d.bad);
eq('loadAddonDetails: root name / attributes not checked, a repeated tag keeps the last value', d.dup, { K: 'last', L: 'x' });
ok('saveAddonDetails: write failure returns false and logs "Error saving <file> - <reason>"', d.saveFail[0] === false && d.saveFail[1].length === 1 && d.saveFail[1][0].startsWith('info:Error saving C:\\no\\such\\folder\\f.xml - '), d.saveFail);
eq('no XML escaping on write; such a file does not load again (warning, empty dictionary)', [d.ampText, d.ampLoad], [true, [{}, 1]]);

// 7. CreateXMLDoc
const x = got.xml;
eq('XML doc ObjType', x.objType, 'SimpleXMLDoc');
ok('serialising without a root element is a script error', typeof x.noRoot.err === 'string', x.noRoot);
eq('CreateRootElement stores the root; calling again replaces it', x.replaced, [true, true, 'SimpleXMLElement', 'root']);
eq('element state: attrs (replaced value, first-insertion order), children', [Object.keys(x.state.attrs), x.state.attrs, x.state.children], [['b', 'a'], { b: 'again', a: 2 }, ['leaf', 'cd', 'empty', 'nest']]);
{
  const lines = x.text.split('\n');
  eq('serialisation: tree lines (text wins over cdata, CDATA leaf, empty leaf, nested, no escaping)', lines.slice(2),
    ['<root b="again" a="2">', '\t<leaf>T</leaf>', '\t<cd><![CDATA[x < y]]></cd>', '\t<empty></empty>', '\t<nest k="v">', '\t\t<inner>deep & raw</inner>', '\t</nest>', '</root>', '']);
  ok('serialisation: declaration and comment lines', lines[0] === '<?xml version="1.0"?>' && lines[1].startsWith('<!-- Generated by SimpleXMLDoc helper.  Executed '), lines.slice(0, 2));
}
eq('Save returns "" and writes the serialised document', x.save, ['', true]);
ok('Save returns the failure message when the file cannot be written', x.saveFail.startsWith('Failure to create output file C:\\no\\such\\folder\\doc.xml\n'), x.saveFail);

// 8. text files
const t = got.text;
eq('wizard helper Type', t.type, 'WizardHelperObj');
eq('TextToFile / TextFromFile round trip', [t.write, t.read], [V('<none>'), 'one\r\ntwo\nthree']);
eq('TextFromFile as array: split on line feeds, carriage returns stay', t.readArr, ['one\r', 'two', 'three']);
eq('TextToFile overwrites', t.overwrite, 'over');
eq('empty file: "" and an empty array', t.empty, ['', []]);
eq('TextFromFile: missing file raises "File does not exist <file>"', t.missing, { err: `File does not exist ${A}\\nope.txt` });
ok('TextToFile: failure raises "Failure to create output file <dest>" + newline + reason', typeof t.writeFail.err === 'string' && t.writeFail.err.startsWith('Failure to create output file C:\\no\\such\\f.txt\n') && t.writeFail.err.length > 46, t.writeFail);
ok('TextToFile_NoThrow: "" on success, the message on failure', t.noThrow[0] === '' && t.noThrow[1] === t.writeFail.err, t.noThrow);
eq('GetCurrentUserLogin, GetTemplateFolder (trailing separator), shared FSO', [t.login, t.templateFolder, t.fso], [got.env.login, `${F}\\Addons\\sdkui\\Application\\Plugins\\Templates\\`, true]);

// 9. template expansion
const e = got.tpl;
eq('template without defines: directives are ordinary text, tokens are regular expressions replaced everywhere', e.noDefines,
  V('Hello World and World\n@if A\nonly A num\n@elseif B\nonly B\n@else\nneither\n@endif\n@if !A\nnot A\n@endif\ntail'));
eq('template with A defined', e.defA, V('Hello World and World\nonly A num\ntail'));
eq('template with B defined (@elseif, @if !A)', e.defB, V('Hello W and W\nonly B\nnot A\ntail'));
eq('template with nothing defined (@else)', e.defNone, V('Hello %NAME% and %NAME%\nneither\nnot A\ntail'));
eq('template with A and B: only the first branch that holds is copied', e.defAB, V('Hello %NAME% and %NAME%\nonly A %X1%\ntail'));
eq('nested blocks (A / A,B / B / none)', e.nest, [V('a\na-notb\nend'), V('a\nab\nend'), V('nota\nnota-b\nend'), V('nota\nend')]);
eq('tokens are applied in order', e.order, V('Y\nXc'));
ok('token / replacement length mismatch is logged as an error and raised', typeof e.mismatch[0].err === 'string' && e.mismatch[1] === 1, e.mismatch);
eq('template errors name the template file', [e.errElseif, e.errElse, e.errEndif, e.errMissing],
  ['@elseif outside @if', '@else without @if', '@endifs without @if', 'Missing @endif'].map(s => ({ err: `${s} in template file '${e.T}'` })));
eq('missing template file raises "File does not exist"', e.missingFile, { err: `File does not exist ${A}\\nope.template` });
eq('GenerateFileFromTemplate writes the expansion', e.file, [V('<none>'), 'v=7']);
eq('GenerateFileFromTemplate: an empty result raises and writes nothing', e.fileEmpty, [{ err: 'Unexpected inside GenerateFileFromTemplate' }, false]);
eq('GenerateInitialHTML fills %DESCRIPTION% and %ADDONIMAGE%', e.initialHtml, '<p>My text</p><img src="pic.jpg">');

// 10. small helpers
const s = got.small;
eq('GetScriptExtension table (no log)', [s.ext, s.extLogBefore], [['.vbs', '.js', '.py', '.pls', '.cpp', '.cs', '.fx', '.cgfx'], 0]);
eq('GetScriptExtension: unknown language logs "Not implemented" and gives .vbs', s.extUnknown, ['.vbs', ['info:Not implemented']]);
eq('GetLangFromExtension table; unknown extension follows the scripting-language preference', s.lang,
  ['Cpp', 'Cpp', 'Cpp', 'Cpp', 'JScript', 'VBScript', 'Python', 'Python', 'PerlScript', 'PerlScript', 'C#', 'HLSL', 'CGFX', 'Python']);
eq('GetLangFromExtension fallback: VBScript preference, anything else gives JScript', [s.langPrefVb, s.langPrefOther], ['VBScript', 'JScript']);
const TF = `${F}\\Addons\\sdkui\\Application\\Plugins\\Templates\\`;
eq('GetTemplate: template folder + prefix + extension', s.template, ['.py', '.js', '.cpp', '.vbs'].map(x2 => `${TF}Cmd${x2}.template`));
eq('GetVCProjFileTemplate', s.vcproj, ['P.VS2012.vcxproj.template', 'P.vcxproj.template']);
{
  const T2 = 'RegistrationInsertionPoint - do not remove this line';
  eq('GetRegInsertionComment: comment marker per language', s.reg, ["'", '//', '//', '//', '#', '#'].map(m => m + T2));
}
eq('GetDllFolder (Win32, Win64, Linux64)', s.dll, ['nt-x86-32', 'nt-x86-64', 'linux-64']);
eq('GetXSIDeclPath: none, factory include\\Rayflex, then XSISDK_ROOT\\include first', [s.decl0, s.decl1, s.decl2.endsWith('\\include\\xsi_decl.h') && !s.decl2.includes('Rayflex')], ['', `${F}\\include\\Rayflex\\xsi_decl.h`, true]);
eq('RemoveSpaces, RemoveNonAlphaNumeric, ReplaceTokenInStr, Bool2Str', s.strings, ['my_new_tool', 'a_b_c_d_9', 'a#b#c', 'true', 'false']);
eq('FloatPrec3 (towards minus infinity), IntToLong', s.nums, [1.234, -1.235, 2, '5l', 1.5, true, 'false', 'abc']);
eq('GetInplaceProp', s.inplace, ['obj.Prop(1, x)', 'Prop(1)', 'obj.Prop', 'obj.Prop']);

// 11. views / wizard model
const v = got.views;
eq('ShowUrlInNetview: no netview in the layout creates "SDK Info", 800x800, url set, shown', v.created, { type: 'netview', name: 'SDK Info', w: 800, h: 800, url: 'http://one/', visible: true, count: 1 });
eq('ShowUrlInNetview: netview2 is preferred, resized, restored and shown', v.prefers2, ['netview2', 'http://two/', 800, 800, true, 0, 2]);
eq('ShowUrlInNetview: else the view netview', v.thenNetview, ['netview', 'http://three/', 1]);
eq('ShowMenuAnchorPointsInNetview opens help topic siMenuAnchorPoints', v.help, 'siMenuAnchorPoints');
eq('CreateWizard: SDK_Wizards model under the scene root (view visibility off), reuse / new property', v.wizard,
  { before: 0, models: 1, kind: 'model', viewvis: false, name: 'MyWizardProp', type: 'MyWizardProp', reuseSame: true, noReuseNew: true, props: 2 });

// 12. unspecified members
ok(`the ${DOC_Q2.length} unspecified doc helper methods (Q2) raise "not yet attested"`, got.unspec.doc.every(isNYA), got.unspec.doc);
ok(`the ${WIZ_Q3.length} unspecified wizard helper methods (Q3) raise "not yet attested"`, got.unspec.wiz.every(isNYA), got.unspec.wiz);

// 13. update check
const u = got.update;
ok('update check, unreachable: null and the warning', u.unreachable[0].v === null && u.unreachable[1].length === 1 && u.unreachable[1][0].startsWith('info:WARNING : Error checking for updates - '), u.unreachable);
ok('GetNbUpdatesPending raises after a failed check (the warning is still logged)', typeof u.nbUnreachable[0].err === 'string' && u.nbUnreachable[1] === 1, u.nbUnreachable);
eq('CheckAndInstallAddonUpdates returns 0 after a failed check', u.installUnreachable, V(0));
eq('update document without lastmodification gives null, no warning', u.noLastMod, [V(null), []]);
ok('update document that does not parse gives null and the warning', u.parseErr[0].v === null && u.parseErr[1].length === 1 && u.parseErr[1][0] === 'info:WARNING : Error checking for updates - ', u.parseErr);
eq('update check: out-of-date and missing templates contribute their url; a url before the template is not collected', u.check[0], V(['http://u/one', 'http://u/absent']));
eq('update check log lines', u.check[1], ['info:Updated addon found: one.xsitemplate', 'info:fresh.xsitemplate is up-to-date', 'info:Updated addon found: absent.xsitemplate', 'info:Updated addon found: absent2.xsitemplate']);
eq('GetNbUpdatesPending returns the number of URLs', u.nb, V(2));
eq('IsAddonUpToDate (newer installed / older installed)', u.upToDate, [true, false]);
eq('CheckAndInstallAddonUpdates logs "Installing addon: <url>" per URL and returns 0', u.install, [V(0), ['info:Installing addon: http://u/one', 'info:Installing addon: http://u/absent']]);
eq('update check with no entries: empty array, 0 pending', u.emptyArr, [V([]), V(0)]);

// 14. GenerateAddDocWizard
const g = got.wizard; const N = `${AD}\\DocTool`;
eq('add-documentation property: name and the three string parameters', [g.prop.name, g.prop.params],
  ['Add-on Documentation', ['...Describe your Add-on Here...', `${TF}netview_Default.jpg`, `${TF}netview_ADDONNAME.htm.template`]]);
eq('add-documentation layout: tab Info (Description multi-line 200, Image, Template for html), tab Help (text + button)', [g.prop.tabs.map(t2 => t2[0]), g.prop.tabs[0][1], g.prop.tabs[1][1].length, g.prop.tabs[1][2], g.prop.help],
  [['Info', 'Help'], [['AddonDescription', 'Description', 'multiline', 200], ['AddonImage', 'Image', 'file', null], ['AddonHtmlTemplate', 'Template for html', 'file', null]], 1, 'Show Add-Ons Page', 'cus_addons_AddonDocWizard']);
eq('GenerateAddDocWizard in batch: nothing written, one "not yet attested" log line', g.batch, ['', 0, 1]);
eq('GenerateAddDocWizard opens the modal page with the three controls', [g.open, g.rows, g.groups], [true, [['AddonDescription', 'multiline'], ['AddonImage', 'file'], ['AddonHtmlTemplate', 'file']], ['Info', 'Help']]);
eq('"Show Add-Ons Page" opens the add-ons page in Netview', g.showPage, ['SDK Info', `${F}/Data/NetView_Database/L04_body/content/addons/default.htm`]);
eq('Cancel: nothing written', g.cancel, ['', []]);
ok('OK with a missing template: description file first, then the page step raises "File does not exist"', typeof g.okMissing[0].err === 'string' && g.okMissing[0].err.startsWith('File does not exist ') && JSON.stringify(g.okMissing[1]) === JSON.stringify(['netview_DocTool.txt']), g.okMissing);
eq('OK: resolves to the new page', g.ok, V(`${N}\\netview_DocTool.htm`));
eq('OK: the four companion files exist', g.files, ['netview_DocTool.htm', 'netview_DocTool.jpg', 'netview_DocTool.txt', 'netview_DocTool.xml']);
eq('OK: description file is the description, page is the filled template, image is copied', [g.txt, g.htm, g.jpg], ['A fine tool', '<html>\n<img src="netview_DocTool.jpg">\n<p>A fine tool</p>\n</html>', 'JPEGDATA']);
eq('OK: detail file holds the default dictionary', g.xml, Object.fromEntries(DETAIL_KEYS.map(k => [k, k === 'AuthorName' ? got.env.login : ''])));
eq('OK: the new page is opened with ShowFileForEdit', g.shown, [`${N}\\netview_DocTool.htm`]);
eq('GetAddonDocPath finds the generated page', g.docPathCmd, V(`${N}\\netview_DocTool.htm`));

eq('no page errors', pageErrors, []);

if (diffs.length) {
  console.log(`\nFAIL CMD-01-ADDONDOC add-on doc / wizard helper commands: ${diffs.length} of ${checks} checks failed`);
  for (const x2 of diffs) console.log('  ' + x2);
  process.exit(1);
}
console.log(`OK CMD-01-ADDONDOC add-on doc / wizard helper commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired: GetAddonDocPath, GetAddonUpdateArray (no request made: warning + null), GetNbUpdatesPending, CreateXMLDoc (file system = the session\'s virtual host FS)');
console.log('   partly wired: GetAddonDocHelper (Netview HTML builders Q2 raise "not yet attested"), WizardHelper (grid / RT-shader / array-project methods Q3 raise "not yet attested"; the nine code generators were wired by CMD-B15f)');
