// CMD-B15f (remaining script-implemented commands): contract check of src/commands/miscScriptsB15f*.ts against
// docs/ghidra/cmd-b15f-misc-scripts.md ("Wire contract" incl. the (inferred) parts) and docs/re/WIRE_CORRECTIONS_B15.md items 38-39.
// There is no XSIBATCH golden for the row:
//   1. every name is registered with the registry argument list (data/command_registry.json, else data/commands_full.json);
//   2. every command runs with its default arguments on the ?demo scene (batch mode, so no modal page opens) without an
//      unexpected error (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (wizard properties and generated files, shader upgrades, lip-sync tracks, camera rig, ...).
// Not in this row: CreateInspectParticleType* (particle worker). The four Syflex map pickers were wired by CMD-B7b and are
// re-checked here against item 38 (they select a weight map and return nothing).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_miscscripts_b15f_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = ['CreateCommandWizard', 'AddCommandToPlugin', 'GenerateCommandPlugin', 'CreatePluginWizard', 'SIGeneratePlugin', 'CreateToolbarWizard', 'SIGenerateToolbar',
  'CreateTemplateWizard', 'CreateMRShaderWizard', 'GenerateLipSync', 'UpgradeShaders', 'syCachePaint1', 'syCachePaint2', 'SyGetMassMap', 'SyGetSpringMap',
  'Get default camera', 'OBJ Import...', 'Save Zero Key Hot Key', 'GenNormalMap', 'GenDiffuseMap'];
// commands whose default-argument run must fail (required input without default), with a pattern the message must match
const DEFAULT_FAILS = { AddCommandToPlugin: /Bad argument/, GenerateCommandPlugin: /Bad Argument to GenerateCommandObj/, SIGeneratePlugin: /in_Prop/, SIGenerateToolbar: /in_Prop/,
  GenNormalMap: /GPUSurfaceFX\.js/, GenDiffuseMap: /GPUSurfaceFX\.js/, GenerateLipSync: /Invalid argument/ };

const readJson = f => { const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8')); return Array.isArray(j) ? j : (j.commands ?? Object.values(j)); };
const reg = readJson('command_registry.json'), full = readJson('commands_full.json');
const registry = Object.fromEntries(NAMES.map(n => {
  const hit = (l) => l.find(x => (x.scripting_name || x.name) === n);
  const f = hit(reg) ?? hit(full);
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('UpgradeShaders') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, DEFAULT_FAILS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false;
  const S = A.miscScriptsB15f, FS = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)?.slice(0, 400)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nyIn = (r) => r.log.some(t => /not yet attested/.test(t));
  const boxes = (from) => S.boxes.slice(from).map(b => b.id);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ---- 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // ---- 2. default-argument runs (batch mode)
  for (const n of NAMES) {
    const m = A.log.length; let res;
    try { const v = A.run(n); res = { ok: true, v: v === undefined ? '<none>' : typeof v }; if (v && typeof v.then === 'function') await v; }
    catch (e) { res = { ok: false, err: String(e?.message ?? e) }; }
    res.errLog = A.log.slice(m).filter(l => l.kind === 'error').map(l => l.text);
    out.defaults[n] = res;
  }
  S.boxes.length = 0;

  const dirOf = (p) => p.replace(/\\[^\\]*$/, '');
  const login = A.addonDocWizard.login;
  const user = A.sdkHelpers?.paths?.[1] ?? 'C:\\Users\\' + login;
  const wizards = () => A.scene.root.children.find(c => c.name === 'SDK_Wizards');

  // ================= CreateCommandWizard / unique name / callbacks
  try {
    const W = S.cmdWizardOps;
    const p1 = A.run('CreateCommandWizard', { DestinationDir: '' });
    ok('CreateCommandWizard: new CCmdWizard property under the hidden model SDK_Wizards', p1.type === 'CCmdWizard' && wizards()?.properties.includes(p1) && wizards().property('visibility')?.val('viewvis') === false, [p1.type]);
    ok('CCmdWizard: defaults (Python, VS2012, None, ReturnValue true, key assignment true, AppendMode false)', p1.val('ScriptLanguage') === 'Python' && p1.val('CompilerVersion') === 'VS2012' && p1.val('MenuID') === 'None' && p1.val('ReturnValue') === true && p1.val('SupportsKeyAssignment') === true && p1.val('AppendMode') === false && p1.val('CannotBeUsedInBatch') === false && p1.val('NotLogged') === false && p1.val('UndoRedoSupport') === false);
    ok('CCmdWizard: ScriptingName NewCommand, PluginName <name>Plugin, Author = login, DestDir = <UserPath>\\Application\\Plugins', p1.val('ScriptingName') === 'NewCommand' && p1.val('PluginName') === 'NewCommandPlugin' && p1.val('Author') === login && /\\Application\\Plugins$/.test(p1.val('DestDir')), [p1.val('ScriptingName'), p1.val('DestDir')]);
    const p2 = A.run('CreateCommandWizard', { DestinationDir: 'C:\\b15f\\dest' });
    ok('CreateCommandWizard: always a new property; DestinationDir used', p2 !== p1 && wizards().properties.filter(p => p.type === 'CCmdWizard').length >= 2 && p2.val('DestDir') === 'C:\\b15f\\dest');
    A.commands.set('NewCommand', { name: 'NewCommand', args: [], execute() {} });
    const p3 = A.run('CreateCommandWizard', {});
    ok('unique name: NewCommand taken -> NewCommand1 (empty suffix counts as 0)', p3.val('ScriptingName') === 'NewCommand1', p3.val('ScriptingName'));
    A.commands.set('NewCommand7', { name: 'NewCommand7', args: [], execute() {} }); A.commands.set('NewCommand3x', { name: 'NewCommand3x', args: [], execute() {} });
    ok('unique name: largest numeric suffix + 1 (non-digit suffix ignored)', A.run('CreateCommandWizard', {}).val('ScriptingName') === 'NewCommand8');
    A.commands.delete('NewCommand'); A.commands.delete('NewCommand7'); A.commands.delete('NewCommand3x');
    ok('unique name: none -> NewCommand', A.run('CreateCommandWizard', {}).val('ScriptingName') === 'NewCommand');
    W.add(p1); W.add(p1);
    ok('Add appends rows Arg0, Arg1 with empty default and handler 0', JSON.stringify(p1.grid) === JSON.stringify([['Arg0', '', 0], ['Arg1', '', 0]]), p1.grid);
    W.remove(p1, [0]); ok('Remove deletes the selected rows', JSON.stringify(p1.grid) === JSON.stringify([['Arg1', '', 0]]));
    W.scriptingNameChanged(p1, 'My Cmd');
    ok('ScriptingName changed: spaces stripped, PluginName = typed + "Plugin", MenuLabel = typed', p1.val('ScriptingName') === 'MyCmd' && p1.val('PluginName') === 'My CmdPlugin' && p1.val('MenuLabel') === 'My Cmd');
    const m = A.log.length; p1.set('ScriptLanguage', 'Cpp'); W.languageChanged(A, p1);
    ok('ScriptLanguage changed: logs CCmdWizard_ScriptingLanguage_OnChanged; undo/redo + compiler shown only for Cpp', A.log.slice(m).some(l => l.text === 'CCmdWizard_ScriptingLanguage_OnChanged') && p1.undoRedoEnabled === true && p1.compilerVisible === true);
    // Generate button checks
    let b = S.boxes.length; p1.set('ScriptingName', ''); W.generate(A, p1);
    ok('Generate: empty command name -> box 7165, stop', boxes(b).join() === '7165', boxes(b));
    b = S.boxes.length; p1.set('ScriptingName', 'GetPrim'); W.generate(A, p1);
    ok('Generate: a command with that name exists -> box 7166', boxes(b).join() === '7166', boxes(b));
  } catch (e) { ok('CreateCommandWizard block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= GenerateCommandPlugin
  const ROOT = 'C:\\b15f\\Application', PLUG = ROOT + '\\Plugins';
  try {
    const mk = (over = {}, grid = []) => { const p = A.run('CreateCommandWizard', { DestinationDir: PLUG }); const set = { ScriptingName: 'B15fCmd', PluginName: 'B15fPlug', ScriptLanguage: 'JScript', Description: 'A test command', ...over }; for (const [k, v] of Object.entries(set)) p.set(k, v); p.grid = grid; return p; };
    let b = S.boxes.length; let m = A.log.length;
    const p = mk({ MenuID: 'siMenuMainFileID', MenuLabel: 'B15f Menu', ToolTip: 'tip', NotLogged: true }, [['x', '5', 0], ['sel', '', 2], ['flag', 'true', 0], ['txt', 'hi', 0]]);
    const r = run('GenerateCommandPlugin', { Wizard: p });
    const f = PLUG + '\\B15fPlug.js';
    ok('GenerateCommandPlugin (JScript): no return value; file <DestDir>\\<PluginName>.js written', r.v === undefined && !r.err && FS.isFile(f), r);
    const src = FS.isFile(f) ? FS.readFile(f) : '';
    ok('generated source: author/name/version 1.0, RegisterCommand, RegisterMenu, insertion comment, unload callback', /in_reg\.Author = "/.test(src) && src.includes(`in_reg.Name = "B15fPlug"`) && src.includes('in_reg.Minor = 0') && src.includes('in_reg.RegisterCommand( "B15fCmd", "B15fCmd" );') && src.includes('in_reg.RegisterMenu( siMenuMainFileID, "B15fCmd_Menu", false, false );') && src.includes('//RegistrationInsertionPoint - do not remove this line') && src.includes('B15fPlug has been unloaded.'), src.slice(0, 300));
    ok('generated Init: Description, Tooltip when non-empty, no-logging flag, ReturnValue, key assignment flag untouched', src.includes('oCmd.Description = "A test command";') && src.includes('oCmd.Tooltip = "tip";') && src.includes('siNoLogging, true') && !src.includes('siSupportsKeyAssignment') && src.includes('oCmd.ReturnValue = true;') && !src.includes('siCannotBeUsedInBatch'), src);
    ok('generated Init: arguments (handler -> AddWithHandler, plain -> Add with siArgumentInput; defaults: number bare, boolean, string quoted)', src.includes('oArgs.Add( "x", siArgumentInput, 5 );') && src.includes('oArgs.AddWithHandler( "sel", "Collection" );') && src.includes('oArgs.Add( "flag", siArgumentInput, true );') && src.includes('oArgs.Add( "txt", siArgumentInput, "hi" );'), src);
    ok('generated Execute / Menu callbacks', src.includes('function B15fCmd_Execute( x, sel, flag, txt )') && src.includes('B15fCmd_Execute called') && src.includes('function B15fCmd_Menu_Init( in_ctxt )') && src.includes('AddCommandItem( "B15f Menu", "B15fCmd" )'));
    ok('script plug-in loaded; the new command was executed once (to get it into the command map)', S.plugins.some(x => x.file === f) && A.commands.has('B15fCmd') && A.log.slice(m).some(l => l.text === 'B15fCmd_Execute called'));
    // overwrite check
    b = S.boxes.length; S.yesNo = () => false; FS.writeFile(f, 'MARK');
    run('GenerateCommandPlugin', { Wizard: mk() });
    ok('existing target file: yes/no box 7197, No -> file unchanged', boxes(b).includes(7197) && FS.readFile(f) === 'MARK', boxes(b));
    S.yesNo = () => true; run('GenerateCommandPlugin', { Wizard: mk() });
    ok('existing target file: Yes -> overwritten', FS.readFile(f) !== 'MARK'); S.yesNo = null;
    // other-file same name
    b = S.boxes.length; run('GenerateCommandPlugin', { Wizard: mk({ ScriptLanguage: 'Python' }) });
    ok('plug-in of the same name loaded from another file -> box 7196, nothing written', boxes(b).includes(7196) && !FS.isFile(PLUG + '\\B15fPlug.py'), boxes(b));
    // other languages
    run('GenerateCommandPlugin', { Wizard: mk({ PluginName: 'B15fPy', ScriptingName: 'B15fPyCmd', ScriptLanguage: 'Python' }, [['a', '', 3]]) });
    const py = FS.isFile(PLUG + '\\B15fPy.py') ? FS.readFile(PLUG + '\\B15fPy.py') : '';
    ok('Python plug-in: def XSILoadPlugin / B15fPyCmd_Init / _Execute(a)', py.includes('def XSILoadPlugin( in_reg ):') && py.includes('def B15fPyCmd_Init( in_ctxt ):') && py.includes('def B15fPyCmd_Execute( a ):') && py.includes('AddWithHandler( "a", "SingleObj" )'), py.slice(0, 200));
    run('GenerateCommandPlugin', { Wizard: mk({ PluginName: 'B15fVb', ScriptingName: 'B15fVbCmd', ScriptLanguage: 'VBScript', ReturnValue: false }, [['a', '', 0]]) });
    const vb = FS.isFile(PLUG + '\\B15fVb.vbs') ? FS.readFile(PLUG + '\\B15fVb.vbs') : '';
    ok('VBScript with return value off: Sub taking the argument names', vb.includes('Sub B15fVbCmd_Execute( a )') && vb.includes('End Sub'), vb.slice(0, 200));
    // Cpp / C#
    b = S.boxes.length; run('GenerateCommandPlugin', { Wizard: mk({ ScriptLanguage: 'Cpp', DestDir: '' }) });
    ok('Cpp with empty DestDir -> box 7172', boxes(b).join() === '7172', boxes(b));
    const CP = 'C:\\b15f\\cpp'; run('GenerateCommandPlugin', { Wizard: mk({ PluginName: 'CppPlug', ScriptingName: 'CppCmd', ScriptLanguage: 'Cpp', DestDir: CP, UndoRedoSupport: true }, [['n', '3', 0]]) });
    ok('Cpp: <command>.cpp, .vcxproj, GNUmakefile written; nothing loaded', FS.isFile(CP + '\\CppCmd.cpp') && FS.isFile(CP + '\\CppCmd.vcxproj') && FS.isFile(CP + '\\GNUmakefile') && !S.plugins.some(x => x.name === 'CppPlug'));
    const cpp = FS.readFile(CP + '\\CppCmd.cpp');
    ok('Cpp source: EnableReturnValue, Add with l-suffixed default, undo/redo stubs, argument array read', cpp.includes('oCmd.EnableReturnValue( true );') && cpp.includes('oArgs.Add( L"n", 3l );') && cpp.includes('CppCmd_Undo') && cpp.includes('CppCmd_Redo') && cpp.includes('CppCmd_TermUndoRedo') && cpp.includes('CValue n = args[0];'), cpp.slice(0, 200));
    const CS = 'C:\\b15f\\cs'; run('GenerateCommandPlugin', { Wizard: mk({ PluginName: 'CsPlug', ScriptingName: 'CsCmd', ScriptLanguage: 'C#', DestDir: CS }, [['n', '', 0]]) });
    ok('C#: <command>.cs and .csproj written, no makefile', FS.isFile(CS + '\\CsCmd.cs') && FS.isFile(CS + '\\CsCmd.csproj') && !FS.isFile(CS + '\\GNUmakefile'));
    ok('C# source: class XSIPlugin : Base, Add with siEmpty and null default', FS.readFile(CS + '\\CsCmd.cs').includes('public class XSIPlugin : Base') && FS.readFile(CS + '\\CsCmd.cs').includes('oArgs.Add( "n", siEmpty, null );'));
    // checks
    b = S.boxes.length; run('GenerateCommandPlugin', { Wizard: mk({ ScriptingName: '' }) });
    ok('empty command name -> box 7168', boxes(b).join() === '7168', boxes(b));
    b = S.boxes.length; run('GenerateCommandPlugin', { Wizard: mk({ PluginName: '' }) });
    ok('empty plug-in name -> box 7170, nothing written', boxes(b).join() === '7170', boxes(b));
    const bad = run('GenerateCommandPlugin', { Wizard: A.run('CreateTemplateWizard', {}) });
    ok('a property that is not a CCmdWizard -> "Bad Argument to GenerateCommandObj"', !!bad.err && /Bad Argument to GenerateCommandObj/.test(bad.err), bad);
  } catch (e) { ok('GenerateCommandPlugin block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= AddCommandToPlugin
  try {
    const mkView = (type, file, text) => { const at = { filename: file, text }; return { type, getAttr: n => at[n] ?? '', setAttr: (n, v) => { at[n] = String(v); }, at }; };
    let r = run('AddCommandToPlugin', { ScriptEditView: { type: 'Netview', getAttr() { return ''; } } });
    ok('AddCommandToPlugin: a view that is not a Text/Script Editor -> "Bad argument - expect a Text Editor View"', /Bad argument - expect a Text Editor View/.test(r.err ?? ''), r);
    const marker = "//RegistrationInsertionPoint - do not remove this line";
    const v = mkView('Script Editor', 'C:\\x\\a.js', `function XSILoadPlugin( in_reg )\n{\n\t${marker}\n\treturn true;\n}\n`);
    S.inspect = (prop) => { prop.set('ScriptingName', 'AddedCmd'); prop.grid = [['q', '', 0]]; return true; };
        r = run('AddCommandToPlugin', { ScriptEditView: v });
    S.inspect = null;
    const t = v.at.text;
    ok('AddCommandToPlugin: always returns false', r.v === false && !r.err, r);
    ok('registration lines inserted before the insertion comment (comment kept, preceded by a tab); callbacks appended', t.indexOf('RegisterCommand( "AddedCmd", "AddedCmd" )') > 0 && t.indexOf('RegisterCommand') < t.indexOf(marker) && t.includes('\t' + marker) && t.includes('function AddedCmd_Execute( q )'), t);
    ok('the wizard property (AppendMode) is deleted afterwards', !wizards().properties.some(p => p.type === 'CCmdWizard' && p.val('AppendMode')));
    const v2 = mkView('Text Editor', 'C:\\x\\b.cpp', 'int x;\n'); S.inspect = (prop) => { prop.set('ScriptingName', 'CppAdd'); return true; };
    run('AddCommandToPlugin', { ScriptEditView: v2 }); S.inspect = null;
    ok('Cpp without the marker: registration line appended with "PUT THIS LINE IN YOUR XSILOADPLUGIN IMPLEMENTATION:"', v2.at.text.includes('PUT THIS LINE IN YOUR XSILOADPLUGIN IMPLEMENTATION:') && v2.at.text.includes('in_reg.RegisterCommand( L"CppAdd", L"CppAdd" );'), v2.at.text);
    const v3 = mkView('Text Editor', 'C:\\x\\c.cs', 'class X {}\n'); S.inspect = (prop) => { prop.set('ScriptingName', 'CsAdd'); return true; };
    run('AddCommandToPlugin', { ScriptEditView: v3 }); S.inspect = null;
    ok('C# without the marker: "...XSIPlugin.Load IMPLEMENTATION:"', v3.at.text.includes('XSIPlugin.Load IMPLEMENTATION:'));
    const v4 = mkView('Text Editor', 'C:\\x\\d.py', 'print 1\n'); S.inspect = (prop) => { prop.set('ScriptingName', 'PyAdd'); return true; };
    const m = A.log.length; run('AddCommandToPlugin', { ScriptEditView: v4 }); S.inspect = null;
    ok('script language without the marker: text becomes "undefined" + callbacks (inferred; logged as not yet attested)', v4.at.text.startsWith('undefined') && A.log.slice(m).some(l => /not yet attested/.test(l.text)), v4.at.text.slice(0, 40));
    const v5 = mkView('Text Editor', 'C:\\x\\e.js', 'orig'); S.inspect = () => false; r = run('AddCommandToPlugin', { ScriptEditView: v5 }); S.inspect = null;
    ok('cancel: text untouched, still false', r.v === false && v5.at.text === 'orig');
  } catch (e) { ok('AddCommandToPlugin block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CreatePluginWizard / SIGeneratePlugin
  try {
    const PD = 'C:\\b15f\\pw'; let b = S.boxes.length; let calls = 0;
    S.inspect = (prop) => { calls++; if (calls === 1) { prop.set('PluginName', ''); } else { prop.set('PluginName', 'My Plug'); prop.set('ScriptLanguage', 'Python'); } return true; };
    let r = run('CreatePluginWizard', { in_dest: PD });
    S.inspect = null;
    const prop = wizards().properties.find(p => p.type === 'PluginWizardProp');
    ok('CreatePluginWizard: PluginWizardProp defaults (New Plugin, Python, VS2012), DestDir = in_dest', !!prop && prop.val('Author') === login && prop.val('DestDir') === PD);
    ok('CreatePluginWizard: the page is shown again until a plug-in was generated, then returns true', r.v === true && calls === 2 && boxes(b).includes(7194), [r.v, calls, boxes(b)]);
    ok('SIGeneratePlugin (Python): <root>.py with spaces -> "_", an empty plug-in, loaded', FS.isFile(PD + '\\My_Plug.py') && !/RegisterCommand/.test(FS.readFile(PD + '\\My_Plug.py')) && S.plugins.some(x => x.name === 'My Plug'));
    S.inspect = () => false; r = run('CreatePluginWizard', {}); S.inspect = null;
    ok('CreatePluginWizard: cancel -> false; default DestDir <UserPath>\\Application\\Plugins', r.v === false && /\\Application\\Plugins$/.test(wizards().properties.find(p => p.type === 'PluginWizardProp').val('DestDir')));
    const P = A.run('CreateCommandWizard', {}); // any property object to carry the fields below
    const mkP = (o) => { const q = wizards().properties.find(p => p.type === 'PluginWizardProp'); for (const [k, v] of Object.entries({ PluginName: 'GenPlug', Author: 'me', ScriptLanguage: 'JScript', CompilerVersion: 'VS2012', DestDir: PD, ...o })) q.set(k, v); return q; };
    b = S.boxes.length; r = run('SIGeneratePlugin', { in_Prop: mkP({ PluginName: '  ' }) });
    ok('SIGeneratePlugin: empty name -> box 7194, false', r.v === false && boxes(b).join() === '7194');
    b = S.boxes.length; r = run('SIGeneratePlugin', { in_Prop: mkP({ PluginName: 'My Plug' }) });
    ok('SIGeneratePlugin: a loaded plug-in of that name -> box 7195, false', r.v === false && boxes(b).join() === '7195');
    b = S.boxes.length; r = run('SIGeneratePlugin', { in_Prop: mkP({ DestDir: ' ' }) });
    ok('SIGeneratePlugin: empty DestDir -> box 7172, EMPTY return (item 38)', r.v === undefined && boxes(b).join() === '7172', [r.v, boxes(b)]);
    b = S.boxes.length; r = run('SIGeneratePlugin', { in_Prop: mkP({ DestDir: 'nodrive\\x' }) });
    ok('SIGeneratePlugin: folder cannot be created -> box 7176, EMPTY return (item 38)', r.v === undefined && boxes(b).join() === '7176', [r.v, boxes(b)]);
    r = run('SIGeneratePlugin', { in_Prop: mkP({}) });
    ok('SIGeneratePlugin (JScript): true; GenPlug.js loaded', r.v === true && FS.isFile(PD + '\\GenPlug.js'));
    r = run('SIGeneratePlugin', { in_Prop: mkP({ PluginName: 'Gen Cpp', ScriptLanguage: 'Cpp' }) });
    ok('SIGeneratePlugin (Cpp): Gen_Cpp.cpp / .vcxproj / GNUmakefile, true', r.v === true && FS.isFile(PD + '\\Gen_Cpp.cpp') && FS.isFile(PD + '\\Gen_Cpp.vcxproj') && FS.isFile(PD + '\\GNUmakefile'));
    r = run('SIGeneratePlugin', { in_Prop: mkP({ PluginName: 'GenCs', ScriptLanguage: 'C#' }) });
    ok('SIGeneratePlugin (C#): GenCs.cs / .csproj, true', r.v === true && FS.isFile(PD + '\\GenCs.cs') && FS.isFile(PD + '\\GenCs.csproj'));
    b = S.boxes.length; S.failLoad = true; r = run('SIGeneratePlugin', { in_Prop: mkP({ PluginName: 'LoadFail' }) }); S.failLoad = false;
    ok('script load failure -> box 7199 but the result is still true', r.v === true && boxes(b).includes(7199));
    // helper methods
    const w = A.run('WizardHelper');
    ok('WizardHelper generators: GetDefaultVCCompiler VS2012, supported array, GetCppCompilerInfo(.vcxproj)', w.GetDefaultVCCompiler() === 'VS2012' && w.GetSupportedVCCompilerArray().join() === 'Visual Studio 2010,VS2010,Visual Studio 2012,VS2012' && w.GetCppCompilerInfo('VS2010').projectExtension === '.vcxproj' && w.GetCppCompilerInfo('x').name === 'VS2012');
    ok('WizardHelper.CreateMenuIDArray: without the SDK header only "None" (-1)', JSON.stringify(w.CreateMenuIDArray()) === JSON.stringify(['None', -1]));
    let e; try { w.GeneratePluginFile('JScript', '', '', 'a', 'p', '', undefined); } catch (x) { e = String(x.message); }
    ok('GeneratePluginFile: all seven arguments required', e === 'Invalid arg to GeneratePluginFile', e);
    ok('StandardIncludes: Cpp four headers; C# System + three namespaces; Python COM import; others nothing', w.StandardIncludes('Cpp').split('\n').length === 4 && /using System;/.test(w.StandardIncludes('C#')) && /win32com/.test(w.StandardIncludes('Python')) && w.StandardIncludes('JScript') === '');
  } catch (e) { ok('CreatePluginWizard block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= toolbar wizard
  try {
    const TD = ROOT + '\\toolbars'; let b = S.boxes.length; let calls = 0;
    S.inspect = (prop) => { calls++; prop.set('ToolbarName', 'My Bar'); return true; };
    let r = run('CreateToolbarWizard', { in_dest: TD }); S.inspect = null;
    const tp = wizards().properties.find(p => p.type === 'ToolbarWizardProp');
    ok('CreateToolbarWizard: ToolbarWizardProp (NewToolbar, AddCommands true); true after generation', r.v === true && tp.val('AddCommands') === true && calls === 1, [r.v, calls]);
    const f = TD + '\\My_Bar.xsitb';
    ok('SIGenerateToolbar: <DestDir>\\<name with spaces -> _>.xsitb written', FS.isFile(f));
    const x = FS.isFile(f) ? FS.readFile(f) : '';
    ok('toolbar XML: xsi_file type Shelf, syntax_version 1.0, shelf_view name/clsid, definition, DS Toolbar tab', /<xsi_file type="Shelf" xsi_version="[^"]*" syntax_version="1.0">/.test(x) && /<shelf_view name="My Bar" clsid="\{[0-9A-F-]{36}\}">/.test(x) && x.includes('<showtabs>false</showtabs>') && x.includes('maxinstances="10000"') && x.includes('defaultsize="0,100,200,300"') && x.includes('supportedtypes="6"') && x.includes('<tabs layout="top" active="DS Toolbar">') && x.includes('<tab label="DS Toolbar" type="toolbar">'), x.slice(0, 500));
    ok('AddCommands: custom commands of plug-ins below the root get a script item with userwidth (80 for short labels without a space)', /<item type="script" name="B15fCmd" label="B15fCmd" userwidth="80">/.test(x) && /name="B15fPyCmd"/.test(x), x.slice(-600));
    ok('the toolbar is opened as a floating view (stand-in record)', S.toolbarViews?.some(v => v.file === f));
    b = S.boxes.length; r = run('SIGenerateToolbar', { in_Prop: Object.assign(tp, {}) && (tp.set('ToolbarName', ' '), tp) });
    ok('SIGenerateToolbar: empty name -> box 7201, false', r.v === false && boxes(b).join() === '7201');
    tp.set('ToolbarName', 'Z'); tp.set('DestDir', ''); b = S.boxes.length; r = run('SIGenerateToolbar', { in_Prop: tp });
    ok('SIGenerateToolbar: empty DestDir -> box 7172, EMPTY return', r.v === undefined && boxes(b).join() === '7172');
    tp.set('DestDir', 'nodrive\\x'); b = S.boxes.length; r = run('SIGenerateToolbar', { in_Prop: tp });
    ok('SIGenerateToolbar: folder failure -> box 7176, EMPTY return', r.v === undefined && boxes(b).join() === '7176');
    tp.set('DestDir', 'C:\\b15f\\other'); tp.set('AddCommands', true); r = run('SIGenerateToolbar', { in_Prop: tp });
    ok('AddCommands with a destination outside an Application folder: no buttons', r.v === true && !/<item /.test(FS.readFile('C:\\b15f\\other\\Z.xsitb')));
    S.inspect = () => false; r = run('CreateToolbarWizard', {}); S.inspect = null;
    ok('CreateToolbarWizard: cancel -> false; default <UserPath>\\Application\\toolbars', r.v === false && /\\Application\\toolbars$/.test(wizards().properties.find(p => p.type === 'ToolbarWizardProp').val('DestDir')));
  } catch (e) { ok('toolbar block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= template / MR shader wizard
  try {
    const T = S.templateOps;
    const p = A.run('CreateTemplateWizard', { DefaultDest: '' });
    ok('CreateTemplateWizard: new TemplateWizard property under SDK_Wizards, Template_DestDir = <UserPath>', p.type === 'TemplateWizard' && wizards().properties.includes(p) && p.val('Template_DestDir') === user, [p.val('Template_DestDir'), user]);
    ok('TemplateWizard defaults: MyTemplate / My New Template / Addon; ParamMenu true', p.val('TemplateShortName') === 'MyTemplate' && p.val('TemplateLongName') === 'My New Template' && p.val('TemplateType') === 'Addon' && p.val('ParamMenu') === true);
    ok('CreateTemplateWizard: always a new property', A.run('CreateTemplateWizard', { DefaultDest: 'C:\\b15f\\t' }) !== p);
    let m = A.log.length; ok('Generate with an empty grid: "No content items defined." (error, prefix TemplateWizard: )', T.generate(A, p) === false && A.log.slice(m).some(l => l.kind === 'error' && l.text === 'TemplateWizard: No content items defined.'));
    p.set('ParamTitle', 'Item1'); p.set('ParamDesc', 'd'); p.set('ParamScript', 's'); p.set('ParamImage', 'i.jpg');
    T.addUpdate(p);
    ok('Add content item: a row is added and the trailing number of the title increments', p.grid.length === 1 && p.grid[0][0] === 'Item1' && p.val('ParamTitle') === 'Item2' && p.grid[0][4] === '1', [p.grid, p.val('ParamTitle')]);
    p.set('ParamTitle', 'Item1'); p.set('ParamDesc', 'changed'); T.addUpdate(p);
    ok('Update content item: the row named like ParamTitle is overwritten', p.grid.length === 1 && p.grid[0][1] === 'changed');
    m = A.log.length; T.edit(A, p, []); T.edit(A, p, [0, 1]);
    ok('Edit with none / several selected: warnings "Nothing selected." / "Multiple items selected."', A.log.slice(m).filter(l => /^WARNING : TemplateWizard: /.test(l.text)).map(l => l.text).join('|') === 'WARNING : TemplateWizard: Nothing selected.|WARNING : TemplateWizard: Multiple items selected.');
    p.set('TemplateDescription', 'desc'); p.set('Template_DestDir', 'C:\\b15f\\t'); m = A.log.length;
    ok('Generate: writes <dir>\\<ShortName>.xsitemplate, logs Generating ... and Done.', T.generate(A, p) === true && FS.isFile('C:\\b15f\\t\\MyTemplate.xsitemplate') && A.log.slice(m).some(l => l.text === "TemplateWizard: Generating template files in 'C:\\b15f\\t'...") && A.log.slice(m).some(l => l.text === 'TemplateWizard: Done.'));
    const xt = FS.readFile('C:\\b15f\\t\\MyTemplate.xsitemplate');
    ok('xsitemplate: root xsi_template (syntax_version, Date), ShortName, LongName, Description, Image, Type, Content/Item', /<xsi_template xsi_version="[^"]*" syntax_version="1.0" Date="[^"]+">/.test(xt) && xt.includes('<ShortName>MyTemplate</ShortName>') && xt.includes('<Type>Addon</Type>') && xt.includes('<Content>') && xt.includes('<Name>Item1</Name>'), xt.slice(0, 300));
    const q = A.run('CreateTemplateWizard', { DefaultDest: '' }); T.load(A, q, 'C:\\b15f\\t\\MyTemplate.xsitemplate');
    ok('Load Existing: Template_DestDir = chosen folder; short name, description and content rows rebuilt', q.val('Template_DestDir') === 'C:\\b15f\\t' && q.val('TemplateShortName') === 'MyTemplate' && q.val('TemplateDescription') === 'desc' && q.grid.length === 1 && q.grid[0][0] === 'Item1' && q.grid[0][4] === '1', [q.grid]);
    FS.writeFile('C:\\b15f\\t\\bad.xsitemplate', '<foo/>'); let e; try { T.load(A, q, 'C:\\b15f\\t\\bad.xsitemplate'); } catch (x) { e = String(x.message); }
    ok('Load Existing: not a template file -> "load failed: this is not a xsitemplate file."', e === 'load failed: this is not a xsitemplate file.', e);
    const mr = run('CreateMRShaderWizard', { DefaultDest: 'C:\\b15f\\mr' });
    ok('CreateMRShaderWizard (SPEC-PARTIAL): a wizard property is returned; unread parts logged "not yet attested"', mr.v?.name === 'MRShaderWizard' && mr.v.val('DestDir') === 'C:\\b15f\\mr' && nyIn(mr), mr);
  } catch (e) { ok('template block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= GenerateLipSync
  try {
    FS.ensureFolder('C:\\b15f\\lip'); FS.writeFile('C:\\b15f\\lip\\a.wav', 'RIFF'); FS.writeFile('C:\\b15f\\lip\\t.txt', 'hello;world'); FS.writeFile('C:\\b15f\\lip\\map.xml', '<m/>');
    const L = S.lipsync;
    const model = A.run('CreateModel', { InputObj: '', Name: 'LipModel' });
    const Null = A.run('GetPrim', { PresetObj: 'Null', Name: 'H_DDS_HighRes', Parent: 'LipModel' });
    A.run('GetPrim', { PresetObj: 'Null', Name: 'H_DDS_LowRes', Parent: 'LipModel' });
    model.evolverMixerTracks = [{ name: 'Base', clips: [{ name: 'Container', container: { tracks: [{ clips: [{ name: 'H_SH_CH_x' }] }, { clips: [{ name: 'L_FV_x' }] }, { clips: [{ name: 'H_nomatch' }] }, { clips: [{ name: 'M_UW_U' }] }] } }] }];
    const args = (o = {}) => ({ InputObjs: [model], AudioFileName: 'C:\\b15f\\lip\\a.wav', TextFileName: 'C:\\b15f\\lip\\t.txt', Language: 'en', Resolutions: 'hl', MappingProfilePath: 'C:\\b15f\\lip\\map.xml', ...o });
    let seen; L.workers.ExtractPhonemesToSpeechOp = (clip, audio, text, off, sil) => { seen = [clip.name, audio, text, off, sil]; };
    L.audioFrames['C:\\b15f\\lip\\a.wav'] = 240;
    let r = run('GenerateLipSync', args());
    ok('GenerateLipSync: returns the speech clip (action EvolverSpeechAction_<compact>)', r.v?.name === 'EvolverSpeechAction_hl' && !r.err, r);
    ok('mesh resolutions found ("h","l") join the compact string; the missing ones warn 1091 (only when requested)', L.last.compact === 'hl' && !r.log.some(t => /H_DDS_MidRes/.test(t)), [L.last, r.log]);
    ok('base shape clips: first clip of container tracks matching a name token with a requested letter (H_SH_CH_x, L_FV_x); others skipped', JSON.stringify(L.last.keys.map(k => k.clip)) === JSON.stringify(['H_SH_CH_x', 'L_FV_x']), L.last.keys);
    ok('two mixer tracks: Phoneme_Speech (type 0, "Phoneme,Speech") and Phoneme_Audio (type 2, "Phoneme,Audio")', L.tracks.some(t => t.name === 'Phoneme_Speech' && t.type === 0 && t.keywords === 'Phoneme,Speech') && L.tracks.some(t => t.name === 'Phoneme_Audio' && t.type === 2 && t.keywords === 'Phoneme,Audio'), L.tracks);
    ok('audio source + clip at offset 0; play range Out = clip-out, In = clip-in - 1', L.audioClips.length === 1 && L.audioClips[0].offset === 0 && L.playRange.out === 240 && L.playRange.in === 0 && A.anim.endFrame === 240);
    ok('phoneme extraction called with (clip, audio, text with ";" -> space, 0, 10); clip relation added', seen?.[1] === 'C:\\b15f\\lip\\a.wav' && seen[2] === 'hello world' && seen[3] === 0 && seen[4] === 10 && L.relations.length === 1, seen);
    let jp = 0; L.workers.ExtractPhonemesToSpeechOpJapanese = () => { jp++; };
    r = run('GenerateLipSync', args({ Language: 'JP' })); ok('Language "JP" is lower-cased and accepted; the Japanese extractor is used', !r.err && jp === 1, r);
    r = run('GenerateLipSync', args({ Language: 'fr' })); ok('Language other than en/jp -> Invalid argument "fr"', /Invalid argument.* "fr"/.test(r.err ?? ''), r);
    r = run('GenerateLipSync', args({ Language: 5 })); ok('non-string Language -> Invalid argument', /Invalid argument/.test(r.err ?? ''), r);
    r = run('GenerateLipSync', args({ Resolutions: 'xyz' })); ok('Resolutions without h/m/l/c -> Invalid argument', /Invalid argument.* "xyz"/.test(r.err ?? ''), r);
    r = run('GenerateLipSync', args({ AudioFileName: 'C:\\b15f\\lip\\none.wav' })); ok('batch: missing audio file -> Invalid argument', /Invalid argument.* "C:\\b15f\\lip\\none\.wav"/.test(r.err ?? ''), r);
    r = run('GenerateLipSync', args({ TextFileName: 'C:\\b15f\\lip\\none.txt' })); ok('missing text file -> file not found', /none\.txt/.test(r.err ?? ''), r);
    r = run('GenerateLipSync', args({ MappingProfilePath: 'C:\\b15f\\lip\\nomap.xml' })); ok('missing mapping profile -> file not found', /nomap\.xml/.test(r.err ?? ''), r);
    r = run('GenerateLipSync', args({ InputObjs: [A.scene.find('cube')] })); ok('batch: first item not a model -> Invalid argument', /Invalid argument/.test(r.err ?? ''), r);
    r = run('GenerateLipSync', args({ Resolutions: 'm' })); ok('no requested mesh exists -> warning 1091 then error 1091 naming Resolutions', /Face mesh resolution not found: m/.test(r.err ?? '') && r.log.some(t => /LipModel\.H_DDS_MidRes/.test(t)), r);
    const nt = L.tracks.length, na = L.actions.length, ns = L.audioSources.length; delete L.workers.ExtractPhonemesToSpeechOp; L.workers.ExtractPhonemesToSpeechOp = () => { throw new Error('recogniser'); };
    r = run('GenerateLipSync', args()); ok('phoneme recognition failure -> error 1090, tracks / action / audio source removed', /Phoneme recognition failed/.test(r.err ?? '') && L.tracks.length === nt && L.actions.length === na && L.audioSources.length === ns, [r.err, L.tracks.length, nt]);
    A.Interactive = true; r = run('GenerateLipSync', { InputObjs: null }); A.Interactive = false;
    ok('interactive without model and no pick hook: warning "Command cancelled", nothing returned', r.v === undefined && !r.err && r.log.some(t => /^WARNING : /.test(t)) && nyIn(r), r);
  } catch (e) { ok('lipsync block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= UpgradeShaders
  try {
    const sample = [...A.scene.allObjects()].map(o => o.material?.surface).find(Boolean) ?? A.scene.materials.map(m => m.surface).find(Boolean);
    const Sh = sample.constructor;
    const d = (name, type, value) => ({ name, type, value });
    const col = (n, v) => d(n, 'color', v), sc = (n, v) => d(n, 'double', v), it = (n, v) => d(n, 'int', v), bo = (n, v) => d(n, 'bool', v);
    const mat = (name, surf) => A.scene.newMaterial(name, surf);
    // 1. simple one: invert
    const inv = new Sh('inv1', 'sib_color_invert', [col('input', [0.2, 0.4, 0.6]), sc('alpha', 0.5)]);
    const m1 = mat('B15fUpg1', inv);
    let m = A.log.length; let r = run('UpgradeShaders');
    ok('UpgradeShaders: returns true when a shader was replaced; "Upgrading <name>" logged', r.v === true && r.log.some(t => t === 'Upgrading inv1'), r);
    ok('sib_color_invert -> Image_Processing\\Invert (input, alpha), same name, connected to the material', m1.surface.type === 'Invert' && m1.surface.preset === 'Image_Processing\\Invert' && m1.surface.name === 'inv1' && JSON.stringify(m1.surface.val('input')) === '[0.2,0.4,0.6]' && m1.surface.val('alpha') === 0.5, [m1.surface.type, m1.surface.val('input')]);
    ok('second run: nothing to upgrade -> false', run('UpgradeShaders').v === false);
    // 2. bias / gain with constants and a consumer shader
    const bias = new Sh('bias1', 'sib_scalar_bias', [sc('input', 0.3), sc('bias', 0.7)]);
    const par = new Sh('par1', 'consumer', [sc('x', 0)]); par.connect('x', bias);
    const gain = new Sh('gain1', 'sib_color_gain', [col('input', [1, 0, 0]), sc('gain', 0.25), sc('alpha', 1)]);
    const m2 = mat('B15fUpg2', par); par.connect('y', gain);
    run('UpgradeShaders');
    const nb = par.inputs.get('x'), ng = par.inputs.get('y');
    ok('sib_scalar_bias -> Math\\Scalar_Math_Exponent: input, bias->factor, op 2; output connection moved, old shader deleted', nb?.type === 'Scalar_Math_Exponent' && nb.val('factor') === 0.7 && nb.val('input') === 0.3 && nb.val('op') === 2 && bias.inputs.size === 0, [nb?.type]);
    ok('sib_color_gain -> Math\\Color_Math_Exponent: gain->factor, op 3', ng?.type === 'Color_Math_Exponent' && ng.val('factor') === 0.25 && ng.val('op') === 3 && ng.val('alpha') === 1);
    // 3. mix8 plain count
    const mix8 = new Sh('mix8a', 'sib_color_mix8', [col('base_color', [1, 1, 1]), it('count', 3), ...[1, 2, 3, 4, 5, 6, 7].flatMap(i => [it(`mode${i}`, 0), col(`color${i}`, [i / 10, 0, 0]), sc(`weight${i}`, 0.5), sc(`alpha${i}`, 0)])]);
    const m3 = mat('B15fUpg3', mix8); run('UpgradeShaders');
    const n8 = m3.surface;
    ok('sib_color_mix8 -> Mixers\\Mix_8colors: base_color, color/weight 1-7 copied; inuse<i> = (i <= count) for a plain count', n8.type === 'Mix_8colors' && JSON.stringify([1, 2, 3, 4, 5, 6, 7].map(i => n8.val(`inuse${i}`))) === JSON.stringify([true, true, true, false, false, false, false]) && n8.val('color2')[0] === 0.2, [n8.type]);
    const mixc = new Sh('mixc', 'sib_color_mix_color', [col('color1', [1, 0, 0]), col('color2', [0, 1, 0]), col('mix', [0.5, 0.5, 0.5, 1]), bo('alpha', false)]);
    const m4 = mat('B15fUpg4', mixc); run('UpgradeShaders');
    ok('sib_color_mix_color -> Mix_2colors: color1->base_color, color2->color1, weight1 alpha component 0 when the alpha flag is false; alpha1 false, mode1 1', m4.surface.type === 'Mix_2colors' && JSON.stringify(m4.surface.val('base_color')) === '[1,0,0]' && JSON.stringify(m4.surface.val('color1')) === '[0,1,0]' && JSON.stringify(m4.surface.val('weight1')) === '[0.5,0.5,0.5,0]' && m4.surface.val('alpha1') === false && m4.surface.val('mode1') === 1, m4.surface.val('weight1'));
    const mixs = new Sh('mixs', 'sib_scalar_mix_color', [col('color1', [1, 0, 0]), col('color2', [0, 1, 0]), sc('mix', 0.4), bo('alpha', true)]);
    const m5 = mat('B15fUpg5', mixs); run('UpgradeShaders');
    ok('sib_scalar_mix_color: scalar mix copied into all weight channels (alpha true)', JSON.stringify(m5.surface.val('weight1')) === '[0.4,0.4,0.4,0.4]', m5.surface.val('weight1'));
    const clip = new Sh('addc', 'sib_color_add_clipping', [col('input1', [0.1, 0.1, 0.1]), col('input2', [0.2, 0.2, 0.2])]);
    const m6 = mat('B15fUpg6', clip); run('UpgradeShaders');
    ok('sib_color_add_clipping -> Mix_2colors with weight1 (1,1,1,1), alpha1 false, mode1 0', JSON.stringify(m6.surface.val('weight1')) === '[1,1,1,1]' && m6.surface.val('mode1') === 0 && m6.surface.val('alpha1') === false && JSON.stringify(m6.surface.val('color1')) === '[0.2,0.2,0.2]');
    const sw = new Sh('swo', 'sib_color_switch_opp', [col('input1', [1, 0, 0]), col('input2', [0, 0, 1]), bo('switch', true)]);
    const m7 = mat('B15fUpg7', sw); run('UpgradeShaders');
    ok('sib_color_switch_opp -> Switch\\Boolean_switch with input1/input2 swapped', m7.surface.type === 'Boolean_switch' && JSON.stringify(m7.surface.val('input2')) === '[1,0,0]' && JSON.stringify(m7.surface.val('input1')) === '[0,0,1]' && m7.surface.val('switch') === true);
    const xx = new Sh('xcc', 'sib_color_X_color', [col('color1', [1, 1, 1]), col('color2', [0.5, 0.5, 0.5])]);
    const m8 = mat('B15fUpg8', xx); run('UpgradeShaders');
    ok('sib_color_X_color (both plain) -> Color_Math_Basic op 2; each side keeps RGB with alpha 0; alpha true (color2 is the plain side)', m8.surface.type === 'Color_Math_Basic' && m8.surface.val('op') === 2 && JSON.stringify(m8.surface.val('input1')) === '[1,1,1,0]' && m8.surface.val('alpha') === true, m8.surface.val('input1'));
    const a1 = new Sh('src1', 'driver', [col('c', [1, 0, 0])]), a2 = new Sh('src2', 'driver', [col('c', [0, 1, 0])]);
    const xx2 = new Sh('xcc2', 'sib_color_X_color', [col('color1', [1, 1, 1]), col('color2', [0.5, 0.5, 0.5])]); xx2.connect('color1', a1); xx2.connect('color2', a2);
    const m9 = mat('B15fUpg9', xx2); run('UpgradeShaders');
    ok('sib_color_X_color (both shaded): an extra Color_Math_Basic "Zero_Alpha" on input1 multiplying by (1,1,1,0)', m9.surface.inputs.get('input1')?.name === 'Zero_Alpha' && JSON.stringify(m9.surface.inputs.get('input1').val('input2')) === '[1,1,1,0]' && m9.surface.inputs.get('input2') === a2, [m9.surface.inputs.get('input1')?.name]);
    // 4. hair
    const hair = new Sh('hair1', 'sib_render_hair', [sc('material', 0), col('diffuse_root', [1, 0, 0]), col('diffuse_tip1', [0, 1, 0]), col('diffuse_tip2', [0, 0, 1]), sc('diffuse_balance', 0.5), sc('diffuse_crossover_point', 0.5), sc('diffuse_crossover_range', 0.1), sc('color_varation', 0), bo('specular_inuse', true), col('specular', [1, 1, 1]), sc('specular_decay', 10), bo('transparency_inuse', false), sc('transparency_root', 0), sc('transparency_tip', 0), sc('transparency_crossover_point', 0.5), sc('transparency_crossover_range', 0.1), sc('radiance', 0.3)]);
    const m10 = mat('B15fUpg10', hair); m = A.log.length; run('UpgradeShaders');
    ok('sib_render_hair (output only to a material) -> Hair_Renderer connected to Surface/Shadow/Volume/PhotonVolume; log "...Shading model was changed to \'Fur\'."', m10.surface.type === 'Hair_Renderer' && m10.surface.val('DiffuseRoot')[0] === 1 && m10.surface.val('Irradiance') === 0.3 && ['shadow', 'volume', 'photonvolume'].every(p => m10.portConnections.has(p)) && A.log.slice(m).some(l => l.text === "Upgraded hair1 to new hair shader. Shading model was changed to 'Fur'."), A.log.slice(m).map(l => l.text));
    const hair2 = new Sh('hair2', 'sib_render_hair', [...hair.params.map(p => d(p.name, p.def.type, p.def.value))]); const hp = new Sh('hp', 'consumer', []); hp.connect('x', hair2); const m11 = mat('B15fUpg11', hp);
    m = A.log.length; run('UpgradeShaders');
    ok('sib_render_hair feeding a shader (not a material): counted as failed ("Failed to upgrade"), old shader kept', hp.inputs.get('x') === hair2 && A.log.slice(m).some(l => /Failed to upgrade hair2/.test(l.text)));
    // 5. port transfer rules (colour -> scalar always fails, item 38)
    const U = S.upgrade; const o = new Sh('o', 't', [col('c', [1, 0.5, 0.25, 1]), sc('s', 0.6), it('i', 4), d('str', 'string', 'x')]); const nn = new Sh('n', 't', []);
    m = A.log.length;
    ok('transfer: colour -> scalar fails as shipped (item 38)', U.transfer(o, nn, 'c', 'd1', 'scalar') === false);
    ok('transfer: scalar -> colour fills R, G, B, A', U.transfer(o, nn, 's', 'd2', 'color') === true && JSON.stringify(nn.val('d2')) === '[0.6,0.6,0.6,0.6]');
    ok('transfer: integer -> scalar', U.transfer(o, nn, 'i', 'd3', 'scalar') === true && nn.val('d3') === 4);
    ok('transfer: unknown type -> warning "Unknown type(s)", fail', U.transfer(o, nn, 'str', 'd4') === false && A.log.slice(m).some(l => /Unknown type\(s\)/.test(l.text)));
    ok('transfer: other combination -> warning "Cannot convert <type> to <type>", fail', U.transfer(o, nn, 's', 'd5', 'boolean') === false && A.log.slice(m).some(l => /Cannot convert scalar to boolean/.test(l.text)));
    ok('the 16 obsolete shader kinds are listed', U.families.length === 16, U.families.length);
    for (const mm of ['B15fUpg1', 'B15fUpg2', 'B15fUpg3', 'B15fUpg4', 'B15fUpg5', 'B15fUpg6', 'B15fUpg7', 'B15fUpg8', 'B15fUpg9', 'B15fUpg10', 'B15fUpg11']) { const i = A.scene.materials.findIndex(x => x.name.startsWith(mm)); if (i >= 0) A.scene.materials.splice(i, 1); }
  } catch (e) { ok('UpgradeShaders block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= Get default camera
  try {
    const r = run('Get default camera', { PresetObj: 'Camera', Name: 'B15fCam', Parent: '' });
    const root = r.v; const cam = A.scene.find('B15fCam'), intr = A.scene.find('B15fCam_Interest');
    ok('Get default camera: returns <Name>_Root with children <Name> and <Name>_Interest', root?.name === 'B15fCam_Root' && !!cam && !!intr && cam.parentObj === root && intr.parentObj === root, [root?.name, !!cam, !!intr]);
    const gp = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]]; };
    const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
    ok('the root sits at the camera\'s global position (camera local position is then 0)', near(gp(root), gp(cam)) && Math.abs(cam.kinematics.local.val('posx')) < 1e-6 && Math.abs(cam.kinematics.local.val('posz')) < 1e-6, [gp(root), gp(cam)]);
    ok('outputs recorded: primitive, camera, interest; no selection change requirement', S.camera?.['3DObjCamera'] === cam && S.camera['3DObjCameraInterest'] === intr);
    const r2 = run('Get default camera', {}); ok('empty Name -> "Camera" (unique): root Camera_Root (made unique)', /^Camera_Root\d*$/.test(r2.v?.name ?? ''), r2.v?.name);
  } catch (e) { ok('camera block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= OBJ Import...
  try {
    const calls = []; const keep = {};
    for (const n of ['ObjImport', 'SetupDisplacement', 'SI_InspectWavefrontImportOptions']) keep[n] = A.commands.get(n).execute;
    A.commands.get('ObjImport').execute = (app, a) => { calls.push(['ObjImport', a.FileName, a.Group, a.hrc, a.Material, a.UV, a.UserNormal, a.UVwrapping]); return ['obj']; };
    A.commands.get('SetupDisplacement').execute = (app, a) => { calls.push(['SetupDisplacement', a.FileName, a.InputObjs]); };
    A.commands.get('SI_InspectWavefrontImportOptions').execute = () => ({ FileName: 'C:\\m\\x.obj', Group: 1, hrc: 2, Material: true, UV: false, UVwrapping: true, UserNormal: true, DisplImage: 'd.png', DisplDepth: 0.5, DisplFlipVert: true, DisplViewDep: false, DisplSubDLevel: 1 });
    const lastCmd = A.commands.get('OBJ Import...');
    ok('"OBJ Import..." registered (File category, no arguments, no return)', lastCmd.category === 'File' && lastCmd.args.length === 0);
    A.cmdLog = true; run('OBJ Import...');
    ok('options dialog then ObjImport(FileName, Group, hrc, Material, UV, UserNormal, UVwrapping); SetupDisplacement for a non-empty displacement image; logging restored', JSON.stringify(calls[0]) === JSON.stringify(['ObjImport', 'C:\\m\\x.obj', 1, 2, true, false, true, true]) && calls[1]?.[0] === 'SetupDisplacement' && calls[1][1] === 'd.png' && A.cmdLog === true, calls);
    calls.length = 0; A.commands.get('SI_InspectWavefrontImportOptions').execute = () => ({ FileName: '', Group: 0, hrc: 0 });
    run('OBJ Import...'); ok('cancelled dialog (empty file name): no import', calls.length === 0);
    const I = A.importExportModelScripts; const lic = I.licence, fb = I.fileBrowser; I.licence = 'Avid 3D'; I.fileBrowser = () => 'C:\\m\\y.obj';
    calls.length = 0; run('OBJ Import...'); await sleep(50);
    ok('licence "Avid 3D": browser straight to ObjImport(file, 1, 2, true, true, false), no empty check', JSON.stringify(calls[0]) === JSON.stringify(['ObjImport', 'C:\\m\\y.obj', 1, 2, true, true, false, false]) && calls.length === 1, calls);
    I.licence = lic; I.fileBrowser = fb;
    for (const n of Object.keys(keep)) A.commands.get(n).execute = keep[n];
  } catch (e) { ok('OBJ block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= Save Zero Key Hot Key, GPUSurfaceFX, Syflex pickers
  try {
    let r = run('Save Zero Key Hot Key'); ok('Save Zero Key Hot Key (SPEC-PARTIAL): no return, logged "not yet attested"', r.v === undefined && !r.err && nyIn(r), r);
    for (const n of ['GenNormalMap', 'GenDiffuseMap']) { r = run(n, { PSet: A.scene.find('cube'), InputObj: A.scene.find('cube') }); ok(`${n}: fails to find GPUSurfaceFX.js (item 39)`, /GPUSurfaceFX\.js/.test(r.err ?? '') && r.err.includes(n === 'GenNormalMap' ? 'XSI_GenerateNormalMap' : 'XSI_GenerateDiffuseMap'), r); }
    // Syflex pickers (CMD-B7b): select a weight map, no return, no paint tool
    A.select([]); r = run('SyGetMassMap'); ok('SyGetMassMap: nothing selected -> returns nothing (message 1002), no tool', r.v === undefined && !r.err && A.activeTool === null, r);
    r = run('syCachePaint1'); ok('syCachePaint1: nothing selected -> returns nothing (message 1004)', r.v === undefined && !r.err, r);
    ok('Syflex pickers return nothing and select only (item 38)', ['syCachePaint1', 'syCachePaint2', 'SyGetMassMap', 'SyGetSpringMap'].every(n => { const q = run(n); return q.v === undefined && !q.err; }));
  } catch (e) { ok('misc block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  return out;
}, { NAMES, DEFAULT_FAILS: Object.fromEntries(Object.entries(DEFAULT_FAILS).map(([k, v]) => [k, v.source])) });

await browser.close();

let checks = 0; const diffs = [];
const report = (name, cond, detail = '') => { checks++; if (!cond) diffs.push(`${name}${detail ? ` -- ${detail}` : ''}`); };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, registry[n] !== null && JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  const d = got.defaults[n];
  if (DEFAULT_FAILS[n]) report(`${n}: default-argument run fails with a message naming the problem`, !d.ok && DEFAULT_FAILS[n].test(d.err), JSON.stringify(d));
  else report(`${n}: default-argument run without error`, d.ok, JSON.stringify(d));
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('page errors', pageErrors.length === 0, pageErrors.join(' | '));

if (diffs.length) {
  console.error(`FAIL CMD-B15f misc script commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B15f misc script commands: ${checks} checks, ${NAMES.length} commands (contract check; no XSIBATCH golden)`);
console.log('   fully wired (script level): the wizards (command / plug-in / toolbar / template), GenerateLipSync (on a stand-in mixer/speech model), UpgradeShaders (stand-in presets), Get default camera, OBJ Import..., Syflex pickers (CMD-B7b)');
console.log('   partly wired ("not yet attested"): CreateMRShaderWizard (ShaderWizard.js unread), Save Zero Key Hot Key (uixsiscripts.vbs unread), GenNormalMap / GenDiffuseMap (script not shipped: fail to find it)');
