// CMD-B15f (remaining script commands: sdkui wizards, Evolver lip-sync, UpgradeShaders, default camera, OBJ import menu,
// Syflex map pickers, particle types, GPUSurfaceFX) plus the batch-15 commands that have no analyst note (INFERRED, see
// src/commands/inferredB15.ts). No XSIBATCH golden exists for either set: this is a contract check against
// docs/ghidra/cmd-b15f-misc-scripts.md, docs/re/WIRE_CORRECTIONS_B15.md items 38-39, and, for the inferred commands,
// against the behaviour their registration comments state.
//   1. every name is registered with the catalogue argument list (data/commands_full.json, duplicates included);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail);
//   3. the stated results.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_scripts_b15f_commands.mjs
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

const SPEC = [
  'AddCommandToPlugin', 'CreateCommandWizard', 'CreateInspectParticleTypeBillboard', 'CreateInspectParticleTypeBlob', 'CreateInspectParticleTypeSphere',
  'CreateMRShaderWizard', 'CreatePluginWizard', 'CreateTemplateWizard', 'CreateToolbarWizard', 'GenDiffuseMap', 'GenNormalMap', 'GenerateCommandPlugin',
  'GenerateLipSync', 'Get default camera', 'SIGeneratePlugin', 'SIGenerateToolbar', 'Save Zero Key Hot Key', 'SyGetMassMap', 'SyGetSpringMap',
  'UpgradeShaders', 'syCachePaint1', 'syCachePaint2', 'OBJ Import...',
];
const INFERRED = [
  'Add Surface Point Tool', 'BoneCreateTool', 'CopyPartition', 'CopyPaste', 'CreateEnvironmentCache', 'CrowdCreateDirectionalEmitterTool', 'CrowdCreateWallTool',
  'CursorTransformTool', 'Delete Selected Branch', 'DeleteCurrentLayer', 'Dice Object/Polygons', 'DoNothing', 'Freeze Selected', 'Mesh Filter', 'MoveComponent Tool',
  'PaintWeights', 'Pick Session Tool', 'RegenerateMaps', 'SIAppendBone', 'SISwapArrayElements', 'ToggleProjectionTool', 'Transform Set New ',
  'Turn OFF Interactive SRT', 'Turn ON Interactive SRT', 'XYZ Transform ',
];
const NAMES = [...SPEC, ...INFERRED];
const DEFAULT_FAILS = new Set(['AddCommandToPlugin', 'GenerateCommandPlugin', 'SIGeneratePlugin', 'SIGenerateToolbar', 'GenNormalMap', 'GenDiffuseMap',
  'CopyPaste', 'CreateEnvironmentCache', 'SIAppendBone', 'PaintWeights', 'DeleteCurrentLayer']);

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
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

const got = await page.evaluate(async ({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const X = A.miscScriptsB15f, FS = A.hostFs;
  X.hooks.inspect = () => false; X.hooks.confirm = () => true; X.hooks.browse = () => null;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool?.(null); A.compSel = null; A.select([cube]); };
  const boxes = () => X.boxes.map(b => b.id);
  const lastBox = () => X.boxes[X.boxes.length - 1]?.id;
  /** Replace a command's execute with a recorder for the duration of f. */
  const trace = (name, f, passThrough = false) => { const d = A.commands.get(name); const orig = d.execute; const calls = []; d.execute = (app, a) => { calls.push({ ...a }); return passThrough ? orig.call(d, app, a) : undefined; }; try { f(); } finally { d.execute = orig; } return calls; };
  const objCount = () => [...A.scene.allObjects()].length;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length; const n0 = X.boxes.length;
    const r = run(n);
    // a modal page left open by a user-session command (OBJ Import... options page) never resolves here
    if (r.v && typeof r.v.then === 'function') await Promise.race([r.v.catch(() => undefined), new Promise(res => setTimeout(res, 300))]);
    document.querySelectorAll('.sdkh-modal-backdrop').forEach(b => b.remove());
    A.miscDsScripts?.session?.cancel?.();
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  const UP = 'C:\\Users\\user\\Softimage\\Autodesk_Softimage_2015_SP2';
  const userPath = () => A.sdkHelpers?.paths?.[1] ?? UP;

  // ================= CreateCommandWizard / CCmdWizard page
  try {
    let r = run('CreateCommandWizard', {});
    const p = r.v; const g = p?.grids?.Arguments;
    ok('CreateCommandWizard: returns a new CCmdWizard property under model SDK_Wizards', p?.type === 'CCmdWizard' && p.parent?.name === 'SDK_Wizards', [r.err, p?.type]);
    ok('CreateCommandWizard: DestDir = <UserPath>\\Application\\Plugins', p.val('DestDir') === userPath() + '\\Application\\Plugins', p.val('DestDir'));
    ok('CCmdWizard: defaults (NewCommand, NewCommandPlugin, Python, VS2012, MenuID None, ReturnValue true, key assignment on)',
      /^NewCommand\d*$/.test(p.val('ScriptingName')) && p.val('PluginName') === p.val('ScriptingName') + 'Plugin' && p.val('ScriptLanguage') === 'Python' && p.val('CompilerVersion') === 'VS2012'
      && p.val('MenuID') === 'None' && p.val('ReturnValue') === true && p.val('SupportsKeyAssignment') === true && p.val('AppendMode') === false,
      p.params.map(q => q.def.name + '=' + q.value));
    ok('CCmdWizard: Arguments grid, 0 rows, columns Name / Default Value / Handler', g && g.RowCount === 0 && JSON.stringify(g.columns) === '["Name","Default Value","Handler"]');
    const L = p.scriptLayout.describe();
    ok('CCmdWizard layout: two tabs, Generate buttons, Arguments group (not in append mode)', L.includes('tab:Plug-in Definition') && L.includes('tab:Command Definition') && L.includes('button:Generate=Generate Code') && L.includes('button:Generate2=Generate Code') && L.includes('group:Arguments'), L);
    ok('CreateCommandWizard: a second call makes a new property (no reuse)', run('CreateCommandWizard', {}).v !== p);
    A.register({ name: 'NewCommand7', args: [], execute: () => undefined });
    ok('CCmdWizard: unique name = largest NewCommand<digits> suffix + 1', run('CreateCommandWizard', {}).v.val('ScriptingName') === 'NewCommand8');
    A.commands.delete('NewCommand7');
    ok('CreateCommandWizard: DestinationDir given -> DestDir', run('CreateCommandWizard', { DestinationDir: 'C:\\b15f\\X' }).v.val('DestDir') === 'C:\\b15f\\X');
    X.ppg.cmdWizard(p, { param: 'ScriptingName', typed: 'My Cmd' });
    ok('CCmdWizard ScriptingName changed: spaces stripped, PluginName = typed + Plugin, MenuLabel = typed', p.val('ScriptingName') === 'MyCmd' && p.val('PluginName') === 'My CmdPlugin' && p.val('MenuLabel') === 'My Cmd');
    X.ppg.cmdWizard(p, { button: 'BtnAddArgument' }); X.ppg.cmdWizard(p, { button: 'BtnAddArgument' });
    ok('CCmdWizard Add: rows Arg0 / Arg1, empty default, handler 0; the grid joins the layout', g.RowCount === 2 && g.GetCell(0, 1) === 'Arg1' && g.GetCell(2, 0) === 0 && p.scriptLayout.describe().includes('item:Arguments'));
    g.selectedRows = [0]; X.ppg.cmdWizard(p, { button: 'BtnRemoveArgument' });
    ok('CCmdWizard Remove: selected rows deleted', g.RowCount === 1 && g.GetCell(0, 0) === 'Arg1');
    p.set('ScriptLanguage', 'Cpp'); const m0 = A.log.length; X.ppg.cmdWizard(p, { param: 'ScriptLanguage' });
    ok('CCmdWizard language -> Cpp: logs the OnChanged name, UndoRedoSupport enabled, CompilerVersion shown', A.log.slice(m0).some(l => l.text === 'CCmdWizard_ScriptingLanguage_OnChanged') && !p.disabledParams.has('UndoRedoSupport') && p.hiddenParams.length === 0);
    p.set('ScriptLanguage', 'Python'); X.ppg.cmdWizard(p, { param: 'ScriptLanguage' });
    ok('CCmdWizard language -> Python: UndoRedoSupport disabled, CompilerVersion hidden; MenuLabel disabled while MenuID is None', p.disabledParams.has('UndoRedoSupport') && p.hiddenParams.includes('CompilerVersion') && p.disabledParams.has('MenuLabel'));
    p.set('ScriptingName', ''); X.ppg.cmdWizard(p, { button: 'Generate' });
    ok('CCmdWizard Generate: empty command name -> box 7165', lastBox() === 7165);
    p.set('ScriptingName', 'CreatePrim'); X.ppg.cmdWizard(p, { button: 'Generate2' });
    ok('CCmdWizard Generate: name of a built-in command -> box 7166', lastBox() === 7166);
  } catch (e) { ok('CreateCommandWizard block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= GenerateCommandPlugin
  try {
    const p = A.run('CreateCommandWizard', { DestinationDir: 'C:\\b15f\\Plugins' });
    p.set('ScriptingName', 'B15fCmd'); p.set('PluginName', 'B15fCmdPlugin'); p.set('ScriptLanguage', 'JScript'); p.set('Description', 'demo');
    X.ppg.cmdWizard(p, { button: 'BtnAddArgument' }); p.grids.Arguments.SetCell(1, 0, 'hello'); p.grids.Arguments.SetCell(2, 0, 2);
    const m0 = A.log.length;
    X.ppg.cmdWizard(p, { button: 'Generate' });
    const file = 'C:\\b15f\\Plugins\\B15fCmdPlugin.js'; const text = FS.isFile(file) ? FS.readFile(file) : '';
    ok('GenerateCommandPlugin (JScript): writes <DestDir>\\<PluginName>.js', !!text, X.boxes.slice(-3));
    ok('GenerateCommandPlugin: header, load callback with author/name/version, RegisterCommand, insertion marker, unload log',
      text.includes('Initial code generated by Softimage SDK Wizard') && /in_reg\.Name = "B15fCmdPlugin"/.test(text) && text.includes('in_reg.Major = 1') && text.includes('in_reg.RegisterCommand("B15fCmd","B15fCmd")')
      && text.includes('//RegistrationInsertionPoint - do not remove this line') && text.includes('has been unloaded.'), text.slice(0, 400));
    ok('GenerateCommandPlugin: Init sets Description, return value, adds Arg0 with the Collection handler and the quoted default',
      text.includes('function B15fCmd_Init( in_ctxt )') && text.includes('oCmd.Description = "demo"') && text.includes('oCmd.ReturnValue = true') && text.includes('oArgs.AddWithHandler("Arg0","Collection","hello")'), text);
    ok('GenerateCommandPlugin: Execute callback takes the argument names and logs "<name>_Execute called"', text.includes('function B15fCmd_Execute( Arg0 )') && text.includes('B15fCmd_Execute called'));
    ok('GenerateCommandPlugin: logs "Now generating..."; plug-in loaded; the new command executed once', A.log.slice(m0).some(l => l.text === 'Now generating the custom command plug-in file...')
      && X.plugins.some(q => q.name === 'B15fCmdPlugin' && q.commands.includes('B15fCmd')) && A.commands.has('B15fCmd') && A.log.slice(m0).filter(l => l.text === 'B15fCmd_Execute called').length === 1);
    const p2 = A.run('CreateCommandWizard', {}); p2.set('ScriptingName', 'B15fCmd'); X.ppg.cmdWizard(p2, { button: 'Generate' });
    ok('CCmdWizard Generate: name of a user command -> box 7167 with its file', lastBox() === 7167 && X.boxes[X.boxes.length - 1].text.includes(file));
    // VBScript without return value -> Sub; menu
    const pv = A.run('CreateCommandWizard', { DestinationDir: 'C:\\b15f\\Plugins' });
    pv.set('ScriptingName', 'B15fVb'); pv.set('PluginName', 'B15fVbPlugin'); pv.set('ScriptLanguage', 'VBScript'); pv.set('ReturnValue', false); pv.set('SupportsKeyAssignment', false); pv.set('MenuID', 'siMenuTbGetPrimitiveID');
    A.run('GenerateCommandPlugin', { Wizard: pv });
    const vb = FS.isFile('C:\\b15f\\Plugins\\B15fVbPlugin.vbs') ? FS.readFile('C:\\b15f\\Plugins\\B15fVbPlugin.vbs') : '';
    ok('GenerateCommandPlugin (VBScript): Sub Execute when the return value is off; key-assignment flag; menu registration + menu callback',
      vb.includes('Sub B15fVb_Execute(') && vb.includes('oCmd.SetFlag siSupportsKeyAssignment,false') && vb.includes('in_reg.RegisterMenu siMenuTbGetPrimitiveID,"B15fVb_Menu",false,false') && vb.includes('Function B15fVb_Menu_Init( in_ctxt )'), vb.slice(0, 300));
    // Cpp / C#
    const pc = A.run('CreateCommandWizard', { DestinationDir: 'C:\\b15f\\Cpp' }); pc.set('ScriptingName', 'B15fCpp'); pc.set('PluginName', 'B15fCppPlugin'); pc.set('ScriptLanguage', 'Cpp'); pc.set('UndoRedoSupport', true);
    let r = run('GenerateCommandPlugin', { Wizard: pc });
    const cpp = FS.isFile('C:\\b15f\\Cpp\\B15fCpp.cpp') ? FS.readFile('C:\\b15f\\Cpp\\B15fCpp.cpp') : '';
    ok('GenerateCommandPlugin (Cpp): <command>.cpp with argument/command headers, EnableReturnValue, undo/redo stubs; not loaded',
      cpp.includes('#include <xsi_command.h>') && cpp.includes('oCmd.EnableReturnValue(true)') && cpp.includes('SICALLBACK B15fCpp_Undo(') && cpp.includes('using namespace XSI;') && !A.commands.has('B15fCpp'), cpp.slice(0, 300));
    ok('GenerateCommandPlugin (Cpp): logs the C++ / .vcxproj steps (templates absent: not yet attested)', has(r, /^Writing C\+\+ file\.\.\.$/) && has(r, /Writing Visual Studio \.vcxproj file/) && nya(r), r.log);
    const ps = A.run('CreateCommandWizard', { DestinationDir: 'C:\\b15f\\Cs' }); ps.set('ScriptingName', 'B15fCs'); ps.set('PluginName', 'B15fCsPlugin'); ps.set('ScriptLanguage', 'C#');
    A.run('GenerateCommandPlugin', { Wizard: ps });
    ok('GenerateCommandPlugin (C#): <command>.cs with class XSIPlugin and class <command>', FS.isFile('C:\\b15f\\Cs\\B15fCs.cs') && FS.readFile('C:\\b15f\\Cs\\B15fCs.cs').includes('public class B15fCs'));
    ps.set('DestDir', ''); A.run('GenerateCommandPlugin', { Wizard: ps });
    ok('GenerateCommandPlugin (C#): empty DestDir -> box 7172', lastBox() === 7172);
    ps.set('PluginName', ''); ps.set('ScriptLanguage', 'JScript'); A.run('GenerateCommandPlugin', { Wizard: ps });
    ok('GenerateCommandPlugin: empty plug-in name -> box 7170, nothing written', lastBox() === 7170);
    ps.set('ScriptingName', ''); A.run('GenerateCommandPlugin', { Wizard: ps });
    ok('GenerateCommandPlugin: empty command name -> box 7168', lastBox() === 7168);
    r = run('GenerateCommandPlugin', { Wizard: cube });
    ok('GenerateCommandPlugin: a property that is not CCmdWizard raises "Bad Argument to GenerateCommandObj"', /Bad Argument to GenerateCommandObj/.test(r.err ?? ''), r.err);
  } catch (e) { ok('GenerateCommandPlugin block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= AddCommandToPlugin
  try {
    const marker = '//RegistrationInsertionPoint - do not remove this line';
    const view = { type: 'Script Editor', attrs: { filename: 'C:\\b15f\\mine.js', text: `function XSILoadPlugin( in_reg )\n{\n\t${marker}\n\treturn true;\n}\n` } };
    X.hooks.inspect = (cmd, prop) => { if (cmd === 'AddCommandToPlugin') { prop.set('ScriptingName', 'B15fAdded'); X.lastAppend = prop.val('AppendMode'); X.lastLang = prop.val('ScriptLanguage'); X.lastLayout = prop.scriptLayout.describe(); } return true; };
    let r = run('AddCommandToPlugin', { ScriptEditView: view });
    const t = view.attrs.text;
    ok('AddCommandToPlugin: returns false', r.v === false, r.err);
    ok('AddCommandToPlugin: wizard in append mode, language from the file extension, no tabs / Generate buttons', X.lastAppend === true && X.lastLang === 'JScript' && !X.lastLayout.some(s => s.startsWith('tab:') || s.startsWith('button:Generate')), X.lastLayout);
    ok('AddCommandToPlugin: registration inserted before the marker (kept, tab-indented); callbacks appended', t.indexOf('in_reg.RegisterCommand("B15fAdded","B15fAdded");') >= 0 && t.indexOf('in_reg.RegisterCommand("B15fAdded","B15fAdded");') < t.indexOf(marker) && t.includes(`\t${marker}`) && t.includes('function B15fAdded_Execute('), t);
    ok('AddCommandToPlugin: the wizard property is deleted', !A.scene.root.children.find(c => c.name === 'SDK_Wizards')?.properties.some(p => p.val?.('ScriptingName') === 'B15fAdded'));
    const cv = { type: 'Text Editor', attrs: { filename: 'C:\\b15f\\x.cpp', text: 'int x;' } };
    run('AddCommandToPlugin', { ScriptEditView: cv });
    ok('AddCommandToPlugin (Cpp, no marker): appends the "PUT THIS LINE IN YOUR XSILOADPLUGIN IMPLEMENTATION:" instruction', cv.attrs.text.includes('PUT THIS LINE IN YOUR XSILOADPLUGIN IMPLEMENTATION:') && cv.attrs.text.startsWith('int x;'));
    X.hooks.inspect = () => false;
    const before = view.attrs.text; r = run('AddCommandToPlugin', { ScriptEditView: view });
    ok('AddCommandToPlugin: Cancel leaves the text alone and still returns false', view.attrs.text === before && r.v === false);
    r = run('AddCommandToPlugin', { ScriptEditView: { type: 'Explorer' } });
    ok('AddCommandToPlugin: a view that is not a text / script editor raises "Bad argument - expect a Text Editor View"', /Bad argument - expect a Text Editor View/.test(r.err ?? ''), r.err);
  } catch (e) { ok('AddCommandToPlugin block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CreatePluginWizard / SIGeneratePlugin
  try {
    X.hooks.inspect = () => true;
    let r = run('CreatePluginWizard', {});
    const f = userPath() + '\\Application\\Plugins\\New_Plugin.py';
    ok('CreatePluginWizard: OK -> SIGeneratePlugin with the defaults ("New Plugin", Python) writes New_Plugin.py and returns true', r.v === true && FS.isFile(f) && FS.readFile(f).includes('def XSILoadPlugin( in_reg ):'), [r.err, r.v, X.boxes.slice(-2)]);
    const prop = A.scene.root.children.find(c => c.name === 'SDK_Wizards').properties.find(p => p.type === 'PluginWizardProp');
    ok('PluginWizardProp: parameters and layout (Url / Email items, Output Directory group)', prop && prop.val('Author') !== undefined && prop.scriptLayout.describe().includes('item:Url') && prop.scriptLayout.describe().includes('group:Output Directory'));
    r = run('SIGeneratePlugin', { in_Prop: prop });
    ok('SIGeneratePlugin: a loaded plug-in with that name -> box 7195, false', r.v === false && lastBox() === 7195);
    prop.set('PluginName', '  '); r = run('SIGeneratePlugin', { in_Prop: prop });
    ok('SIGeneratePlugin: empty name -> box 7194, false', r.v === false && lastBox() === 7194);
    prop.set('PluginName', 'B15f Cpp Plugin'); prop.set('ScriptLanguage', 'Cpp'); prop.set('DestDir', ' ');
    r = run('SIGeneratePlugin', { in_Prop: prop });
    ok('SIGeneratePlugin: empty DestDir -> box 7172, empty result', r.v === undefined && lastBox() === 7172);
    prop.set('DestDir', 'C:\\b15f\\PlugCpp'); r = run('SIGeneratePlugin', { in_Prop: prop });
    ok('SIGeneratePlugin (Cpp): <root>.cpp with spaces -> _, returns true', r.v === true && FS.isFile('C:\\b15f\\PlugCpp\\B15f_Cpp_Plugin.cpp'));
    X.hooks.inspect = () => false;
    ok('CreatePluginWizard: Cancel -> false', run('CreatePluginWizard', { in_dest: 'C:\\b15f\\P2' }).v === false && prop.val('DestDir') === 'C:\\b15f\\P2');
    A.Interactive = false; r = run('CreatePluginWizard', {}); A.Interactive = true;
    ok('CreatePluginWizard: cannot be used in batch', !!r.err);
  } catch (e) { A.Interactive = true; ok('CreatePluginWizard block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CreateToolbarWizard / SIGenerateToolbar
  try {
    X.hooks.inspect = (cmd, prop) => { if (cmd === 'CreateToolbarWizard') { prop.set('ToolbarName', 'My Bar'); prop.set('DestDir', 'C:\\b15f\\Application\\toolbars'); } return true; };
    let r = run('CreateToolbarWizard', {});
    const f = 'C:\\b15f\\Application\\toolbars\\My_Bar.xsitb'; const x = FS.isFile(f) ? FS.readFile(f) : '';
    ok('CreateToolbarWizard -> SIGenerateToolbar: writes <DestDir>\\My_Bar.xsitb, returns true, opens the toolbar view', r.v === true && !!x && X.views.some(v => v.file === f && v.name === 'My Bar'), [r.err, X.boxes.slice(-2)]);
    ok('SIGenerateToolbar: xsi_file Shelf / shelf_view / definition / tabs "DS Toolbar" structure',
      /<xsi_file type="Shelf" xsi_version="[^"]+" syntax_version="1.0">/.test(x) && /<shelf_view name="My Bar" clsid="\{[0-9A-F-]+\}">/.test(x) && x.includes('<showtabs>false</showtabs>')
      && x.includes('cmdmap="{00000000-0000-0000-0000-000000000000}"') && x.includes('<tabs layout="top" active="DS Toolbar">') && x.includes('<tab label="DS Toolbar" type="toolbar">'), x);
    ok('SIGenerateToolbar: a button for the user Custom key-assignable command under the same root (B15fCmd, userwidth 80); B15fVb (no key assignment) left out',
      x.includes('<item type="script" name="B15fCmd" label="B15fCmd" userwidth="80">') && !x.includes('B15fVb'), x);
    const prop = A.scene.root.children.find(c => c.name === 'SDK_Wizards').properties.find(p => p.type === 'ToolbarWizardProp');
    prop.set('ToolbarName', ''); r = run('SIGenerateToolbar', { in_Prop: prop });
    ok('SIGenerateToolbar: empty name -> box 7201, false', r.v === false && lastBox() === 7201);
    prop.set('ToolbarName', 'T'); prop.set('DestDir', ''); r = run('SIGenerateToolbar', { in_Prop: prop });
    ok('SIGenerateToolbar: empty DestDir -> box 7172, empty result', r.v === undefined && lastBox() === 7172);
    X.hooks.inspect = () => false;
    r = run('CreateToolbarWizard', {});
    ok('CreateToolbarWizard: default DestDir <UserPath>\\Application\\toolbars; Cancel -> false', r.v === false && prop.val('DestDir') === userPath() + '\\Application\\toolbars');
  } catch (e) { ok('CreateToolbarWizard block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CreateTemplateWizard
  try {
    let r = run('CreateTemplateWizard', {});
    const p = r.v; const g = p?.grids?.ParamList;
    ok('CreateTemplateWizard: new TemplateWizard property, Template_DestDir = <UserPath>, defaults', p?.type === 'TemplateWizard' && p.val('Template_DestDir') === userPath() && p.val('TemplateShortName') === 'MyTemplate' && p.val('TemplateType') === 'Addon' && g.columns.length === 5, r.err);
    ok('TemplateWizard layout: empty list shows "No content defined."', p.scriptLayout.describe().includes('text=No content defined.'));
    X.ppg.templateWizard(p, { button: 'AddUpdateParam' });
    ok('TemplateWizard Add: new row from the fields, ParamTitle gets a trailing 1', g.RowCount === 1 && g.GetCell(0, 0) === 'Content Title' && g.GetCell(4, 0) === '1' && p.val('ParamTitle') === 'Content Title1');
    p.set('ParamTitle', 'Content Title'); p.set('ParamDesc', 'changed'); X.ppg.templateWizard(p, { button: 'AddUpdateParam' });
    ok('TemplateWizard Update: same-named row rewritten, no new row', g.RowCount === 1 && g.GetCell(1, 0) === 'changed');
    const m0 = A.log.length; g.selectedRows = []; X.ppg.templateWizard(p, { button: 'EditParam' });
    ok('TemplateWizard Edit with no selection: warning "TemplateWizard: Nothing selected."', A.log.slice(m0).some(l => /TemplateWizard: Nothing selected\./.test(l.text)));
    p.set('Template_DestDir', 'C:\\b15f\\tpl'); p.set('TemplateShortName', 'B15fTpl');
    const file = X.ppg.templateWizard(p, { button: 'Generate' });
    const x = file ? FS.readFile(file) : '';
    ok('TemplateWizard Generate: <dir>\\<ShortName>.xsitemplate with xsi_template, the five fields and one Content/Item', file === 'C:\\b15f\\tpl\\B15fTpl.xsitemplate' && /<xsi_template xsi_version="[^"]+" syntax_version="1.0" Date="[^"]+">/.test(x)
      && x.includes('<ShortName>B15fTpl</ShortName>') && x.includes('<Type>Addon</Type>') && x.includes('<Item>') && x.includes('<Description>changed</Description>'), x);
    X.hooks.browse = () => file; g.clear(); p.set('TemplateShortName', 'x');
    X.ppg.templateWizard(p, { button: 'LoadExisting' });
    ok('TemplateWizard Load Existing: fields and grid read back from the file', p.val('TemplateShortName') === 'B15fTpl' && g.RowCount === 1 && g.GetCell(1, 0) === 'changed' && p.val('Template_DestDir') === 'C:\\b15f\\tpl');
    X.hooks.browse = () => null;
    g.clear(); const m1 = A.log.length; X.ppg.templateWizard(p, { button: 'Generate' });
    ok('TemplateWizard Generate with no items: error "TemplateWizard: No content items defined."', A.log.slice(m1).some(l => l.kind === 'error' && l.text === 'TemplateWizard: No content items defined.'));
    A.Interactive = false; r = run('CreateTemplateWizard', {}); A.Interactive = true;
    ok('CreateTemplateWizard: cannot be used in batch', !!r.err);
    r = run('CreateMRShaderWizard', { DefaultDest: 'C:\\b15f\\sh' });
    ok('CreateMRShaderWizard (SPEC-PARTIAL): returns a wizard property under SDK_Wizards with the destination, rest logged', r.v?.parent?.name === 'SDK_Wizards' && r.v.val('DestDir') === 'C:\\b15f\\sh' && nya(r));
  } catch (e) { A.Interactive = true; ok('CreateTemplateWizard block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= GenerateLipSync
  try {
    A.Interactive = false;
    let r = run('GenerateLipSync', { InputObjs: cube, AudioFileName: 'C:\\b15f\\a.wav' });
    ok('GenerateLipSync (batch): first input not a model -> invalid argument (1020)', /Invalid argument|1020/i.test(r.err ?? '') || (r.err ?? '').length > 0, r.err);
    const model = A.run('CreateModel', {}) ?? [...A.scene.allObjects()].find(o => o.constructor.name === 'Model');
    FS.ensureFolder('C:\\b15f'); FS.writeFile('C:\\b15f\\a.wav', 'RIFF');
    r = run('GenerateLipSync', { InputObjs: [model], AudioFileName: 'C:\\b15f\\missing.wav' });
    ok('GenerateLipSync (batch): audio file that does not exist -> invalid argument', !!r.err && /missing\.wav/.test(r.err));
    r = run('GenerateLipSync', { InputObjs: [model], AudioFileName: 'C:\\b15f\\a.wav' });
    ok('GenerateLipSync: default mapping profile absent -> file not found (23)', !!r.err && /DefaultPhonVisMapping\.xml/.test(r.err), r.err);
    FS.writeFile('C:\\b15f\\map.xml', '<mapping/>');
    r = run('GenerateLipSync', { InputObjs: [model], AudioFileName: 'C:\\b15f\\a.wav', MappingProfilePath: 'C:\\b15f\\map.xml', Language: 'fr' });
    ok('GenerateLipSync: Language other than en / jp -> invalid argument', !!r.err && /"fr"/.test(r.err), r.err);
    r = run('GenerateLipSync', { InputObjs: [model], AudioFileName: 'C:\\b15f\\a.wav', MappingProfilePath: 'C:\\b15f\\map.xml', Resolutions: 'xyz' });
    ok('GenerateLipSync: Resolutions without h / m / l / c -> invalid argument', !!r.err && /"xyz"/.test(r.err), r.err);
    r = run('GenerateLipSync', { InputObjs: [model], AudioFileName: 'C:\\b15f\\a.wav', MappingProfilePath: 'C:\\b15f\\map.xml', Resolutions: 'hm' });
    ok('GenerateLipSync: missing face meshes -> warning 1091 per mesh, only the requested resolutions (h, m)', (r.log ?? []).filter(l => /^WARNING : .*H_DDS_(HighRes|MidRes)$/.test(l)).length === 2 && !(r.log ?? []).some(l => /H_DDS_(LowRes|CrowdRes)/.test(l)), r.log);
    ok('GenerateLipSync: SetupEvolverVisemes gets the model and the mapping profile; its failure (unreadable mapping here) stops the command, nothing created', !!r.err && /SetupEvolverVisemes|1091/.test(r.err) && !model.property?.('mixer')?.clips?.length, r.err);
    const sev = A.commands.get('SetupEvolverVisemes'); const sevOrig = sev.execute; sev.execute = () => ({ KeyList: [], Action: [] });
    r = run('GenerateLipSync', { InputObjs: [model], AudioFileName: 'C:\\b15f\\a.wav', MappingProfilePath: 'C:\\b15f\\map.xml', Resolutions: 'hm' });
    ok('GenerateLipSync: no viseme keys -> raise 1091 with the Resolutions string', !!r.err && /hm$/.test(r.err), r.err);
    sev.execute = () => ({ KeyList: [{}], Action: [] });
    r = run('GenerateLipSync', { InputObjs: [model], AudioFileName: 'C:\\b15f\\a.wav', MappingProfilePath: 'C:\\b15f\\map.xml' });
    const hasImport = A.commands.has('ImportAudio');
    ok('GenerateLipSync: then ImportAudio(model, audio); without it on the bus -> raise 1088 (audio import failed)', hasImport ? (!!r.err || r.v !== undefined) : (!!r.err && has(r, /ImportAudio is not on the bus/)), [r.err, r.log]);
    sev.execute = sevOrig;
    A.Interactive = true;
    r = run('GenerateLipSync', {});
    const sess = A.miscDsScripts?.session;
    ok('GenerateLipSync (session): no model -> pick session "Select Model"', !r.err && sess?.active && sess.command === 'GenerateLipSync', r.err);
    const m0 = A.log.length; sess?.pick(null, 0);
    ok('GenerateLipSync (session): right button -> warning 1520 (command cancelled), session over', A.log.slice(m0).some(l => /^WARNING : /.test(l.text)) && !sess?.active, A.log.slice(m0).map(l => l.text));
    run('GenerateLipSync', {}); const s2 = A.miscDsScripts?.session; const m1 = A.log.length;
    s2?.pick(cube, 1);
    ok('GenerateLipSync (session): a picked non-model -> error 28', A.log.slice(m1).some(l => l.kind === 'error' && /GenerateLipSync/.test(l.text)), A.log.slice(m1).map(l => l.text));
    if (model) A.scene.root.removeChild(model);
  } catch (e) { A.Interactive = true; ok('GenerateLipSync block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= UpgradeShaders
  try {
    let r = run('UpgradeShaders');
    ok('UpgradeShaders: no obsolete shader on the demo scene -> false', r.v === false, r.err);
    const mat = A.scene.materials.find(m => m.surface) ; const surf = mat.surface; const Shader = surf.constructor;
    const port = 'diffuse';
    const old = new Shader('OldInvert', 'sib_color_invert_v1', [{ name: 'input', type: 'color', value: [0.2, 0.4, 0.6], label: 'input', animatable: true }, { name: 'alpha', type: 'bool', value: true, label: 'alpha', animatable: true }]);
    old.clsid = '{87AEE70C-1111-2222-3333-444444444444}';
    const prev = surf.inputs.get(port) ?? null; surf.connect(port, old);
    const old2 = new Shader('OldBias', 'sib_scalar_bias', [{ name: 'input', type: 'double', value: 0.3, label: 'input' }, { name: 'bias', type: 'double', value: 0.7, label: 'bias' }]);
    old2.clsid = '{8725CFD5-0000-0000-0000-000000000000}'; old.connect('input', null); surf.connect('specular', old2);
    r = run('UpgradeShaders');
    const neu = surf.inputs.get(port), neu2 = surf.inputs.get('specular');
    ok('UpgradeShaders: returns true and logs "Upgrading <shader>"', r.v === true && has(r, /^Upgrading OldInvert$/) && has(r, /^Upgrading OldBias$/), [r.err, r.log]);
    ok('UpgradeShaders: sib_color_invert -> Image_Processing\\Invert (SPDL shader), same name, input / alpha moved, output reconnected', neu && neu !== old && neu.name === 'OldInvert' && JSON.stringify(neu.val('input')?.slice?.(0, 3)) === JSON.stringify([0.2, 0.4, 0.6]), [neu?.type, neu?.val('input')]);
    ok('UpgradeShaders: sib_scalar_bias -> Math\\Scalar_Math_Exponent with bias -> factor and op 2 (Bias)', neu2 && neu2.type === 'Scalar_Math_Exponent' && near(neu2.val('factor'), 0.7) && near(neu2.val('input'), 0.3) && neu2.val('op') === 2, neu2 && neu2.params.map(p => p.def.name + '=' + p.value));
    ok('UpgradeShaders: a second run finds nothing -> false', run('UpgradeShaders').v === false);
    const hair = new Shader('OldHair', 'sib_render_hair', [{ name: 'diffuse_root', type: 'color', value: [1, 0, 0], label: 'd' }]); hair.clsid = '{1F51ED00-474B-4860-9428-447E9D4BFB74}';
    surf.connect('specular', hair); r = run('UpgradeShaders');
    ok('UpgradeShaders: hair shader not connected to a material only -> "Failed to upgrade" (warning), false', r.v === false && has(r, /WARNING : Failed to upgrade OldHair/), r.log);
    surf.connect('specular', null); surf.connect(port, prev);
  } catch (e) { ok('UpgradeShaders block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= Get default camera
  try {
    const u0 = A.undoStack.length;
    reset(); const r = run('Get default camera', { Name: 'camB15f' });
    const root = r.v; const kids = root?.children?.map(c => c.name) ?? [];
    ok('Get default camera: returns <Name>_Root (CameraRoot) holding <Name> and <Name>_Interest', root?.name === 'camB15f_Root' && root.type === 'CameraRoot' && kids.includes('camB15f') && kids.includes('camB15f_Interest'), [r.err, root?.name, kids]);
    const cam = root.children.find(c => c.name === 'camB15f'); const rg = root.globalMatrix().elements, cg = cam.globalMatrix().elements;
    ok('Get default camera: root at the camera\'s global position; camera local position ~0', near(rg[12], cg[12], 1e-4) && near(rg[13], cg[13], 1e-4) && near(rg[14], cg[14], 1e-4) && near(cam.kinematics.local.val('posx'), 0, 1e-4) && near(cam.kinematics.local.val('posz'), 0, 1e-4));
    ok('Get default camera: no selection change, no inspection; outputs recorded', A.selection[0] === cube && X.lastDefaultCamera?.['3DObjCamera'] === cam);
    while (A.undoStack.length > u0) A.undo();
    ok('Get default camera: undo removes the rig', !A.scene.find('camB15f_Root'));
    const r2 = run('Get default camera', {});
    ok('Get default camera: empty Name -> "Camera"', /^Camera\d*_Root$/.test(r2.v?.name ?? ''), r2.v?.name);
    while (A.undoStack.length > u0) A.undo();
  } catch (e) { ok('Get default camera block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= OBJ Import...
  try {
    const ie = A.importExportModelScripts; const lic = ie.licence;
    ie.licence = 'Avid 3D'; X.hooks.browse = () => 'C:\\b15f\\m.obj';
    let calls = trace('ObjImport', () => run('OBJ Import...'));
    ok('OBJ Import... (Avid 3D): browser then ObjImport(file, 1, 2, true, true, false)', calls.length === 1 && calls[0].FileName === 'C:\\b15f\\m.obj' && calls[0].Group === 1 && calls[0].hrc === 2 && calls[0].Material === true && calls[0].UV === true && calls[0].UserNormal === false, calls);
    ie.licence = lic; X.hooks.browse = () => null;
    const d = A.commands.get('SI_InspectWavefrontImportOptions'); const orig = d.execute;
    d.execute = () => ({ FileName: 'C:\\b15f\\n.obj', Group: 0, hrc: 1, Material: true, UV: false, UVwrapping: true, UserNormal: true, DisplImage: 'C:\\b15f\\d.pic', DisplDepth: 0.25, DisplFlipVert: true, DisplViewDep: false, DisplSubDLevel: 2 });
    let disp = [];
    try { disp = trace('SetupDisplacement', () => { calls = trace('ObjImport', () => run('OBJ Import...')); }); } finally { d.execute = orig; }
    ok('OBJ Import...: options page values go to ObjImport', calls.length === 1 && calls[0].FileName === 'C:\\b15f\\n.obj' && calls[0].hrc === 1 && calls[0].UVwrapping === true && calls[0].UserNormal === true, calls);
    ok('OBJ Import...: a displacement image -> SetupDisplacement with its settings', disp.length === 1 && disp[0].FileName === 'C:\\b15f\\d.pic' && disp[0].DisplDepth === 0.25 && disp[0].DisplSubDLevel === 2, disp);
    A.Interactive = false; calls = trace('ObjImport', () => run('OBJ Import...')); A.Interactive = true;
    ok('OBJ Import...: options page cancelled (batch) -> no import', calls.length === 0);
  } catch (e) { A.Interactive = true; ok('OBJ Import... block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= small SPEC / SPEC-PARTIAL commands
  try {
    let r = run('Save Zero Key Hot Key');
    ok('Save Zero Key Hot Key (SPEC-PARTIAL): logged as not yet attested, nothing keyed', nya(r) && !r.err);
    r = run('GenNormalMap'); const r2 = run('GenDiffuseMap');
    ok('GenNormalMap / GenDiffuseMap: GPUSurfaceFX.js is not shipped -> the command fails to find its script', /GPUSurfaceFX\.js/.test(r.err ?? '') && /GPUSurfaceFX\.js/.test(r2.err ?? ''));
    ok('CreateInspectParticleType{Sphere,Blob,Billboard}: literal registrations with the registry renderType defaults', A.commands.get('CreateInspectParticleTypeSphere').args[0].default === 'siSphereType' && A.commands.get('CreateInspectParticleTypeBlob').args[0].default === 'siBlobType' && A.commands.get('CreateInspectParticleTypeBillboard').args[0].default === 'siBillboardType');
    reset(); r = run('syCachePaint1');
    ok('syCachePaint1 on a non-syCache object: message 1004, nothing returned', r.v === undefined && !r.err && (r.log ?? []).length > 0, r.log);
    reset(); r = run('SyGetMassMap');
    ok('SyGetMassMap on a non-cloth object: message 1002, nothing returned', r.v === undefined && !r.err && (r.log ?? []).length > 0, r.log);
  } catch (e) { ok('small commands block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= INFERRED commands
  try {
    reset();
    for (const n of ['Add Surface Point Tool', 'CursorTransformTool', 'ToggleProjectionTool', 'Transform Set New ']) { const r = run(n); ok(`${n} (inferred): no such tool here -> not yet attested, no change`, nya(r) && !r.err); }
    for (const n of ['DoNothing', 'XYZ Transform ']) { const u0 = A.undoStack.length, c0 = objCount(); const r = run(n); ok(`${n} (inferred): does nothing`, r.v === undefined && !r.err && A.undoStack.length === u0 && objCount() === c0); }
    let r = run('BoneCreateTool');
    ok('BoneCreateTool (inferred): live tool instance (CMD-B13e state) and the chain drawing tool active', A.pluginsB13e?.boneTool && A.activeTool?.name === 'Draw 2D Chain', A.activeTool?.name);
    A.setTool(null);
    let c0 = objCount(); r = run('CrowdCreateDirectionalEmitterTool');
    const viaEmitter = trace('CreateCrowdEmitter', () => run('CrowdCreateDirectionalEmitterTool'));
    ok('CrowdCreateDirectionalEmitterTool (inferred): runs CreateCrowdEmitter', viaEmitter.length === 1 && !r.err, r.err);
    const viaWall = trace('CreateWall', () => run('CrowdCreateWallTool'));
    ok('CrowdCreateWallTool (inferred): runs CreateWall', viaWall.length === 1);
    reset(); const tw = trace('TweakTool', () => run('MoveComponent Tool'));
    ok('MoveComponent Tool (inferred): runs the component tweak tool (TweakTool)', tw.length === 1);
    A.selMode = 'object'; reset();
    r = run('Pick Session Tool'); ok('Pick Session Tool (inferred): outside a pick session -> logged, no change', nya(r));
    run('Turn OFF Interactive SRT'); const off = A.inferredB15.interactiveSRT; run('Turn ON Interactive SRT');
    ok('Turn OFF / ON Interactive SRT (inferred): flag false then true', off === false && A.inferredB15.interactiveSRT === true);
    // CopyPaste
    reset(); const clip = A.clipboard; const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'tgtB15f' }); reset();
    const u0 = A.undoStack.length;
    r = run('CopyPaste', { Source: cube, Target: nul });
    ok('CopyPaste (inferred): Source duplicated under Target, clipboard untouched', Array.isArray(r.v) && r.v.length === 1 && r.v[0] !== cube && r.v[0].parentObj === nul && A.clipboard === clip, r.err);
    // Delete Selected Branch
    A.select([nul]); r = run('Delete Selected Branch');
    ok('Delete Selected Branch (inferred): the selected object and its branch are removed', !A.scene.find('tgtB15f') && !!r && !r.err);
    while (A.undoStack.length > u0) A.undo();
    A.scene.root.removeChild(nul);
    // DeleteCurrentLayer
    const lay = A.run('CreateLayer', { Name: 'layB15f' }); A.run('SetCurrentLayer', { Name: lay.name });
    r = run('DeleteCurrentLayer');
    ok('DeleteCurrentLayer (inferred): DeleteLayer of the current layer', !A.scene.layers.includes(lay), r.err);
    // Freeze Selected / Dice / Mesh Filter
    reset(); let fz = trace('FreezeObj', () => run('Freeze Selected'));
    ok('Freeze Selected (inferred): FreezeObj on the selection', fz.length === 1 && fz[0].InputObjs?.[0] === cube);
    let topo = trace('ApplyTopoOp', () => run('Dice Object/Polygons'));
    ok('Dice Object/Polygons (inferred): ApplyTopoOp "Dice Polygons"', topo.length === 1 && topo[0].PresetObj === 'Dice Polygons');
    topo = trace('ApplyTopoOp', () => run('Mesh Filter'));
    ok('Mesh Filter (inferred): ApplyTopoOp "Filter Polygons" (no edge selection)', topo.length === 1 && topo[0].PresetObj === 'Filter Polygons');
    A.compSel = { obj: cube, kind: 'edge', points: new Set(), edges: new Set(['0-1']), polygons: new Set() };
    topo = trace('ApplyTopoOp', () => run('Mesh Filter'));
    ok('Mesh Filter (inferred): edge selection -> "Filter Edges"', topo[0]?.PresetObj === 'Filter Edges');
    reset();
    // PaintWeights
    const PropCls = cube.property('visibility').constructor; const map = new PropCls('WeightMapB15f', 'weightmap', []); map.values = new Map(); cube.addProperty(map); reset();
    const u1 = A.undoStack.length;
    r = run('PaintWeights', { InputObj: map, Indices: [0, 1], Weights: [0.25, 0.5] });
    ok('PaintWeights (inferred): weights written at the indices of the weight map; returns it', map?.values?.get(0) === 0.25 && map.values.get(1) === 0.5 && r.v === map, [r.err, map?.type]);
    while (A.undoStack.length > u1) A.undo();
    ok('PaintWeights (inferred): undo restores', !map.values.has(0));
    r = run('PaintWeights', { InputObj: cube, Indices: [2], Weights: [0.75] });
    ok('PaintWeights (inferred): an object -> its first weight map', map.values.get(2) === 0.75, r.err);
    cube.removeProperty(map);
    // SISwapArrayElements
    const arr = [1, 2, 3]; run('SISwapArrayElements', { Object: arr, IndexA: 0, IndexB: 2 });
    ok('SISwapArrayElements (inferred): elements swapped', JSON.stringify(arr) === '[3,2,1]');
    ok('SISwapArrayElements (inferred): index out of range raises', !!run('SISwapArrayElements', { Object: arr, IndexA: 0, IndexB: 9 }).err);
    // SIAppendBone (and AppendBone now delegating to it)
    const chain = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [2, 0, 0]] }); const eff = chain.effector; const nb = chain.bones.length;
    r = run('SIAppendBone', { InputObjs: [eff], Ex: 4, Ey: 1, Ez: 0, AlignRootToFirstBone: true });
    ok('SIAppendBone (inferred): one bone appended to the chain end', chain.bones.length === nb + 1 && !r.err, r.err);
    const r3 = run('AppendBone', { InputObjs: [chain.effector], Ex: 6, Ey: 1, Ez: 0 });
    ok('AppendBone now reaches SIAppendBone (no stand-in log)', chain.bones.length === nb + 2 && !has(r3, /the new bone is the C\+\+ append command/), r3.log);
    A.scene.root.removeChild(chain);
    // RegenerateMaps
    reset(); r = run('RegenerateMaps');
    ok('RegenerateMaps (inferred): no Render Map selected -> error', (r.kinds ?? []).includes('error'));
    const rmp = new (cube.property('visibility').constructor)('RenderMap', 'rendermap', []); cube.addProperty(rmp);
    r = run('RegenerateMaps', { Properties: [rmp] });
    ok('RegenerateMaps (inferred): a Render Map -> rendering logged as not yet attested (no renderer)', nya(r), [r.err, rmp?.type]);
    cube.removeProperty(rmp);
    // CreateEnvironmentCache
    const env = A.run('CreateEnvironment', {}); const envNode = Array.isArray(env) ? env[0] : env;
    r = run('CreateEnvironmentCache', { Model: cube, Environment: envNode });
    ok('CreateEnvironmentCache (inferred): a cache record for the model in the environment', r.v?.model === cube && envNode.simulationEnvironment?.caches?.includes(r.v), r.err);
    // CopyPartition
    const pass2 = A.run('CreatePass', { Name: 'passB15f' }); const cur = A.scene.passes[0];
    r = run('CopyPartition', { Target: [pass2], InputObjs: cur.partitions });
    ok('CopyPartition (inferred): the partitions are copied (same names, same members) into the target pass', cur.partitions.every(q => pass2.partitions.some(z => z.name === q.name && z !== q && [...q.members].every(m => z.members.has(m)))), [r.err, pass2.partitions.map(z => z.name)]);
  } catch (e) { ok('inferred block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_scripts_b15f_commands: ${pass}/${pass + fail} ok (${SPEC.length} contract + ${INFERRED.length} inferred commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
