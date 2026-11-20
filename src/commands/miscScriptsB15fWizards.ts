// Ledger row CMD-B15f, part 1: the sdkui wizard commands (Command / Plug-in / Toolbar / Template / mental ray shader wizards).
//   CreateCommandWizard GenerateCommandPlugin AddCommandToPlugin CreatePluginWizard SIGeneratePlugin CreateToolbarWizard
//   SIGenerateToolbar CreateTemplateWizard CreateMRShaderWizard
// Brief: docs/ghidra/cmd-b15f-misc-scripts.md ("Wire contract" of each command, sections 2.1, 2.2, 3.2-3.10) and
// docs/re/WIRE_CORRECTIONS_B15.md item 38. Original TypeScript written from that prose; no script text is reproduced
// (the generated plug-in sources below are this build's own wording of the described structure).
//
// Mapping onto this build:
//  * Files go to the session's virtual host file system (`hostFs`), like the CMD-01b / CMD-01-ADDONDOC helpers.
//  * "Loading" a generated script plug-in records it in `app.miscScriptsB15f.plugins` and puts the commands the
//    wizard defined on the command bus (their Execute callback logs "<name>_Execute called", as the generated code
//    does). C++ / C# projects are written only, never loaded (contract).
//  * Message boxes go through the CMD-B7c `msgBox` stand-in (recorded, logged, shown in a user session); the XSIPLUGINUI
//    texts come from the string table when it has them, else a bracketed "not yet attested" text (note Q5).
//  * Modal inspections: `hooks.inspect(command, prop)` answers OK / Cancel in scripts and checks; a user session opens
//    AfterImage's modal page and the command returns a Promise; without either the inspection counts as Cancel.
//  * Yes/No boxes (7197, 7200): `hooks.confirm(id, text)`; without a hook the answer is Yes (inferred, logged).
//  * Property-page callbacks are reachable as `app.miscScriptsB15f.ppg.<wizard>(prop, event)` and also run on the
//    genppg `_OnChanged` event of the property editor.
import { App } from '../core/commands';
import { Property, Node } from '../core/scene';
import { str, bool } from '../core/params';
import { hostFs, HOSTFS_SEP } from '../core/sdkHelpersHostFs';
import { sdkModal, renderSdkLayout, type SdkDlgItem } from '../ui/sdkHelpersModal';
import { sdkHelpersState } from './sdkHelpers';
import { WizardHelperObj, SimpleXMLDoc, addonDocWizardState } from './addonDocWizard';
import { addGrid, gridOf, layoutOf, enableParam, ensureParam, dictText, msgBox, inspect, type GridData } from './addonScriptsShared';

export const B15F_NOTE = 'docs/ghidra/cmd-b15f-misc-scripts.md';
export const B15F_ROW = 'CMD-B15f';

// ------------------------------------------------------------------ row state
export interface B15fPlugin { name: string; file: string; lang: string; commands: string[] }
export interface B15fState {
  /** Script plug-ins generated and "loaded" by the wizards (newest last). */
  plugins: B15fPlugin[];
  /** Message boxes shown: XSIPLUGINUI id and final text. */
  boxes: { id: number; text: string }[];
  /** Views opened from definition files (CreateViewFromDefinitionFile stand-in). */
  views: { file: string; name: string }[];
  /** Progress bar captions. */
  progress: string[];
  /** Help topics / files requested. */
  help: string[];
  hooks: {
    inspect?: (command: string, prop: Property) => boolean | undefined;
    confirm?: (id: number, text: string) => boolean | undefined;
    browse?: (command: string, title: string, initialDir: string, filter: string) => string | null | undefined;
  };
  [k: string]: any;
}
export function b15fState(app: App): B15fState {
  const a = app as any;
  return (a.miscScriptsB15f ??= { plugins: [], boxes: [], views: [], progress: [], help: [], hooks: {} });
}

export const interactive = (app: App) => (app as any).Interactive !== false;
export const logNya = (app: App, command: string, what: string, question = '') =>
  app.logMsg('info', `${command}: not yet attested: ${what} (${B15F_ROW}${question ? `, ${B15F_NOTE} ${question}` : ''})`);
const userPath = () => sdkHelpersState.paths[1];
const join = (a: string, b: string) => hostFs.join(a, b);
const login = () => addonDocWizardState.login;
const isWindows = () => /^win/i.test(String(sdkHelpersState.platform ?? 'Win64'));
const trimmed = (v: any) => String(v ?? '').trim();
const unset = (v: any) => v === undefined || v === null || v === '';

/** XSIPLUGINUI message box. `%s` in the text takes the argument; without a placeholder the argument is appended. */
export function box(app: App, id: number, arg?: string) {
  let t = dictText('XSIPLUGINUI', id);
  if (arg !== undefined) t = t.includes('%s') ? t.replace('%s', arg) : `${t} ${arg}`;
  b15fState(app).boxes.push({ id, text: t });
  msgBox(app, t);
}
function confirmBox(app: App, id: number, arg: string): boolean {
  let t = dictText('XSIPLUGINUI', id); t = t.includes('%s') ? t.replace('%s', arg) : `${t} ${arg}`;
  b15fState(app).boxes.push({ id, text: t });
  const hook = b15fState(app).hooks.confirm;
  const r = hook ? hook(id, t) : undefined;
  if (r === undefined) { logNya(app, 'WizardHelper', `the Yes/No answer to message ${id} (no dialog hook): Yes is assumed`); return true; }
  return !!r;
}
function showFileForEdit(app: App, file: string) {
  if (app.commands.has('ShowFileForEdit')) { try { app.run('ShowFileForEdit', { FileName: file }); return; } catch { /* fall through */ } }
  app.logMsg('info', `ShowFileForEdit ${file}`);
}
function newGuid(): string {
  const c = (globalThis as any).crypto;
  const u: string = c?.randomUUID ? c.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  return `{${u.toUpperCase()}}`;
}

/** Modal InspectObj: hook, else (user session) AfterImage's modal page as a Promise, else Cancel. */
function modalInspect(app: App, command: string, prop: Property, title: string, items: SdkDlgItem[]): boolean | Promise<boolean> {
  const hook = b15fState(app).hooks.inspect;
  const r = hook ? hook(command, prop) : undefined;
  if (r !== undefined) return !!r;
  if (!interactive(app) || typeof document === 'undefined') { logNya(app, command, 'a modal inspection without a user session; treated as Cancel'); return false; }
  return sdkModal(title, body => renderSdkLayout(body, prop, items));
}
const paramItems = (prop: Property): SdkDlgItem[] => prop.params.filter(p => p.def.inspectable !== false).map(p => ({ param: p.def.name, label: p.def.label ?? p.def.name, control: typeof p.value === 'boolean' ? 'bool' : 'string' }));

// ------------------------------------------------------------------ WizardHelper code generators (note 2.2)

type Lang = 'JScript' | 'VBScript' | 'Python' | 'Cpp' | 'C#' | string;
const SCRIPT_LANGS = ['JScript', 'Python', 'VBScript'];
const EXT: Record<string, string> = { VBScript: '.vbs', JScript: '.js', Python: '.py', PerlScript: '.pls', Cpp: '.cpp', 'C#': '.cs' };
const cmt = (lang: Lang) => (lang === 'VBScript' ? "'" : lang === 'Python' || lang === 'PerlScript' ? '#' : '//');
const q = (lang: Lang, s: string) => (lang === 'Cpp' ? `L"${s}"` : `"${s}"`);
const regInsertion = (app: App, lang: Lang) => new WizardHelperObj(app).GetRegInsertionComment(lang);
export const getDefaultVCCompiler = () => 'VS2012';
export const supportedVCCompilers = (): [string, string][] => [['Visual Studio 2010', 'VS2010'], ['Visual Studio 2012', 'VS2012']];

/** Menu anchor points: "None" (-1), then the siMenuAnchorPoints members of xsi_decl.h when the SDK header is found. */
export function menuIdArray(app: App): [string, any][] {
  const out: [string, any][] = [['None', -1]];
  const decl = new WizardHelperObj(app).GetXSIDeclPath();
  if (!decl) return out;
  const text = hostFs.readFile(decl);
  const m = /enum\s+siMenuAnchorPoints\s*\{([\s\S]*?)\}/.exec(text);
  if (!m) return out;
  for (const line of m[1].split(/[\n,]/)) {
    const e = /^\s*(si\w+ID)\s*=\s*(-?\d+)/.exec(line);
    if (e && e[1] !== 'siMenuUndefinedID' && !/obsolete/i.test(line)) out.push([e[1], Number(e[2])]);
  }
  return out;
}

function standardIncludes(lang: Lang): string[] {
  if (lang === 'Cpp') return ['#include <xsi_application.h>', '#include <xsi_context.h>', '#include <xsi_pluginregistrar.h>', '#include <xsi_status.h>'];
  if (lang === 'C#') return ['using System;', 'using Softimage.XSIOM;', 'using Softimage.XSIMath;', 'using Softimage.XSIUtil;'];
  if (lang === 'Python') return ['import win32com.client', 'from win32com.client import constants', '', 'null = None', 'false = 0', 'true = 1'];
  return [];
}

/** GeneratePluginFile(lang, comment, includes, author, pluginName, registerCode, callbacks). */
export function generatePluginFile(app: App, lang: Lang, comment: string, includes: string, author: string, pluginName: string, registerCode: string, callbacks: string): string {
  for (const v of [lang, comment, includes, author, pluginName, registerCode, callbacks]) if (v === undefined || v === null) throw new Error('Invalid arg to GeneratePluginFile');
  const c = cmt(lang); const L: string[] = [];
  L.push(`${c} ${pluginName}`, `${c} Initial code generated by Softimage SDK Wizard`, `${c} Executed ${new Date().toString()} by ${author || login()}`, `${c} `);
  if (comment) L.push(...comment.split('\n').map(s => `${c} ${s}`));
  // the fixed standard header comment: its wording is not in the note (inferred short form)
  L.push(`${c} Tip: ${lang === 'Cpp' || lang === 'C#' ? 'build this project and load the resulting library' : 'this file is loaded by the plug-in manager'}.`, '');
  L.push(...standardIncludes(lang));
  if (includes) L.push(includes);
  if (lang === 'Cpp') L.push('using namespace XSI;');
  if (lang === 'C#') {
    const tpl = new WizardHelperObj(app).GetTemplateFolder() + 'base.cs.template';
    if (hostFs.isFile(tpl)) L.push(hostFs.readFile(tpl)); else logNya(app, 'GeneratePluginFile', `the sample Base class (template ${tpl} is not in the session file system)`);
  }
  L.push('');
  const tab = '\t'; const ins = regInsertion(app, lang);
  const reg = registerCode ? registerCode.split('\n').map(s => tab + s) : [];
  if (lang === 'VBScript') {
    L.push('Function XSILoadPlugin( in_reg )', `${tab}in_reg.Author = "${author}"`, `${tab}in_reg.Name = "${pluginName}"`, `${tab}in_reg.Major = 1`, `${tab}in_reg.Minor = 0`, '', ...reg, tab + ins, '', `${tab}XSILoadPlugin = true`, 'End Function', '',
      'Function XSIUnloadPlugin( in_reg )', `${tab}Application.LogMessage in_reg.Name & " has been unloaded.",siVerbose`, `${tab}XSIUnloadPlugin = true`, 'End Function');
  } else if (lang === 'Python') {
    L.push('def XSILoadPlugin( in_reg ):', `${tab}in_reg.Author = "${author}"`, `${tab}in_reg.Name = "${pluginName}"`, `${tab}in_reg.Major = 1`, `${tab}in_reg.Minor = 0`, '', ...reg, tab + ins, '', `${tab}return true`, '',
      'def XSIUnloadPlugin( in_reg ):', `${tab}Application.LogMessage(str(in_reg.Name) + str(" has been unloaded."),constants.siVerbose)`, `${tab}return true`);
  } else if (lang === 'Cpp') {
    L.push('SICALLBACK XSILoadPlugin( PluginRegistrar& in_reg )', '{', `${tab}in_reg.PutAuthor(L"${author}");`, `${tab}in_reg.PutName(L"${pluginName}");`, `${tab}in_reg.PutVersion(1,0);`, ...reg, tab + ins, '', `${tab}return CStatus::OK;`, '}', '',
      'SICALLBACK XSIUnloadPlugin( const PluginRegistrar& in_reg )', '{', `${tab}Application().LogMessage(in_reg.GetName() + L" has been unloaded.",siVerboseMsg);`, `${tab}return CStatus::OK;`, '}');
  } else if (lang === 'C#') {
    L.push('public class XSIPlugin : Base', '{', `${tab}public bool Load( PluginRegistrar in_reg )`, `${tab}{`, `${tab}${tab}in_reg.Author = "${author}";`, `${tab}${tab}in_reg.Name = "${pluginName}";`, `${tab}${tab}in_reg.Major = 1;`, `${tab}${tab}in_reg.Minor = 0;`,
      ...reg.map(s => tab + s), tab + tab + ins, `${tab}${tab}return true;`, `${tab}}`, '', `${tab}public bool Unload( PluginRegistrar in_reg )`, `${tab}{`, `${tab}${tab}Log(in_reg.Name + " has been unloaded.");`, `${tab}${tab}return true;`, `${tab}}`, '}');
  } else {
    L.push('function XSILoadPlugin( in_reg )', '{', `${tab}in_reg.Author = "${author}";`, `${tab}in_reg.Name = "${pluginName}";`, `${tab}in_reg.Major = 1;`, `${tab}in_reg.Minor = 0;`, '', ...reg, tab + ins, '', `${tab}return true;`, '}', '',
      'function XSIUnloadPlugin( in_reg )', '{', `${tab}Application.LogMessage(in_reg.Name + " has been unloaded.",siVerbose);`, `${tab}return true;`, '}');
  }
  L.push('');
  if (callbacks) L.push(callbacks);
  return L.join('\n');
}

/** WriteAndLoadScriptPlugin(dir, rootName, lang, source, pluginName) -> bool. `commands` are put on the bus on load. */
export function writeAndLoadScriptPlugin(app: App, dir: string, rootName: string, lang: Lang, source: string, pluginName: string, commands: () => string[] = () => []): boolean {
  const st = b15fState(app);
  try { hostFs.ensureFolder(dir); } catch (e: any) { box(app, 7176, String(e?.message ?? e)); return false; }
  const target = join(dir, rootName + (EXT[lang] ?? '.vbs'));
  const other = st.plugins.find(p => p.name === pluginName && hostFs.normalize(p.file).toLowerCase() !== hostFs.normalize(target).toLowerCase());
  if (other) { box(app, 7196, other.file); return false; }
  if (hostFs.isFile(target)) {
    if (!confirmBox(app, 7197, target)) return false;
    unloadPlugin(app, target);
  }
  try { hostFs.writeFile(target, source); } catch (e: any) { box(app, 7198, String(e?.message ?? e)); return false; }
  showFileForEdit(app, target);
  try { st.plugins.push({ name: pluginName, file: target, lang, commands: commands() }); }
  catch { box(app, 7199); }
  app.logMsg('info', `Loaded plug-in ${pluginName} (${target})`);
  return true;
}
function unloadPlugin(app: App, file: string) {
  const st = b15fState(app); const key = hostFs.normalize(file).toLowerCase();
  for (const p of st.plugins.filter(x => hostFs.normalize(x.file).toLowerCase() === key)) {
    for (const c of p.commands) app.commands.delete(c);
    st.plugins.splice(st.plugins.indexOf(p), 1);
  }
}

/** GenerateCppProject(dir, projName, cppText, compiler): .cpp, .vcxproj, GNUmakefile. Nothing is compiled. */
export function generateCppProject(app: App, dir: string, proj: string, cppText: string, compiler: string): boolean {
  hostFs.ensureFolder(dir);
  const cpp = join(dir, proj + '.cpp');
  if (hostFs.isFile(cpp) && !confirmBox(app, 7200, cpp)) return false;
  app.logMsg('info', 'Writing C++ file...');
  hostFs.writeFile(cpp, cppText);
  app.logMsg('info', 'Writing Visual Studio .vcxproj file...');
  const h = new WizardHelperObj(app); const folder = h.GetTemplateFolder();
  const vcx = folder + (compiler === 'VS2010' ? 'Plugin.vcxproj.template' : 'Plugin.VS2012.vcxproj.template');
  const fromTemplate = (tpl: string, dest: string, tokens: string[], reps: string[]) => {
    if (hostFs.isFile(tpl)) h.GenerateFileFromTemplate(tpl, dest, tokens, reps);
    else logNya(app, 'GenerateCppProject', `the content of ${dest} (template ${tpl} is not in the session file system; the file is not written)`);
  };
  fromTemplate(vcx, join(dir, proj + '.vcxproj'), ['%%projname%%', '%%cpp_files%%'], [proj, `    <ClCompile Include="${proj}.cpp" />`]);
  fromTemplate(folder + 'GNUmakefile.template', join(dir, 'GNUmakefile'), ['%%projname%%', '%%cpp_files%%'], [proj, `${proj} \\`]);
  showFileForEdit(app, cpp);
  return true;
}
/** GenerateCSProject(dir, projName, csText): .cs, .csproj. */
export function generateCSProject(app: App, dir: string, proj: string, csText: string): boolean {
  hostFs.ensureFolder(dir);
  const cs = join(dir, proj + '.cs');
  if (hostFs.isFile(cs) && !confirmBox(app, 7200, cs)) return false;
  app.logMsg('info', 'Writing C# file...');
  hostFs.writeFile(cs, csText);
  app.logMsg('info', 'Writing Visual Studio .csproj file...');
  const h = new WizardHelperObj(app); const tpl = h.GetTemplateFolder() + 'Plugin.csproj.template';
  if (hostFs.isFile(tpl)) h.GenerateFileFromTemplate(tpl, join(dir, proj + '.csproj'), ['%%projname%%'], [proj]);
  else logNya(app, 'GenerateCSProject', `the content of ${proj}.csproj (template ${tpl} is not in the session file system; the file is not written)`);
  showFileForEdit(app, cs);
  return true;
}

// ------------------------------------------------------------------ CCmdWizard property (note 3.2)

export const HANDLERS: [string, string][] = [['None', ''], ['Animatable Marked Parameters', 'AnimatableParameters'], ['Collection/Selection', 'Collection'], ['SingleObj', 'SingleObj'],
  ['Frame', 'Frame'], ['Frame Rate', 'FrameRate'], ['Marked Parameters', 'MarkedParameters']];

function uniqueCommandName(app: App): string {
  const st = b15fState(app);
  st.progress.push('Finding unique command name');
  let best = -1;
  for (const d of app.commands.values()) for (const n of [d.name, d.label ?? '']) {
    const m = /^NewCommand(\d*)$/.exec(n); if (!m) continue;
    best = Math.max(best, m[1] === '' ? 0 : Number(m[1]));
  }
  return best < 0 ? 'NewCommand' : `NewCommand${best + 1}`;
}

export function createCmdWizard(app: App, reuse: boolean): Property {
  const prop = new WizardHelperObj(app).CreateWizard('CCmdWizard', reuse);
  if (!prop.get('ScriptingName')) {
    const name = uniqueCommandName(app);
    for (const d of [bool('AppendMode', false, 'AppendMode'), str('PluginName', `${name}Plugin`, 'Plug-in Name'), str('Author', login(), 'Author'), str('ScriptLanguage', 'Python', 'Coding Language'),
      str('CompilerVersion', getDefaultVCCompiler(), 'C++ Compiler Version'), str('MenuID', 'None', 'Add to Menu'), str('MenuLabel', '', 'Menu Label'), str('DestDir', '', 'DestDir'),
      str('ScriptingName', name, 'Command Name'), str('Description', '', 'Description'), str('ToolTip', '', 'ToolTip'),
      bool('SupportsKeyAssignment', true, 'Supports Key Assignment', { animatable: false }), bool('CannotBeUsedInBatch', false, 'Cannot Be Used In Batch', { animatable: false }),
      bool('NotLogged', false, 'Not Logged', { animatable: false }), bool('ReturnValue', false, 'Return Value', { animatable: false }),
      bool('UndoRedoSupport', false, 'Undo/Redo Callbacks (C++ only)', { animatable: false })]) ensureParam(prop, d);
    prop.set('ReturnValue', true);   // defined false, then set true
    addGrid(prop, 'Arguments', ['Name', 'Default Value', 'Handler']);
  }
  (prop as any).ppgLogic = (ev: { param?: string; button?: string }) => cmdWizardEvent(app, prop, ev);
  cmdWizardLayout(app, prop);
  return prop;
}

export function cmdWizardLayout(app: App, prop: Property) {
  const l = layoutOf(prop); l.Clear();
  l.SetAttribute('siUILabelMinPixels', 140); l.SetAttribute('siUILabelPercentage', 40);
  const append = !!prop.val('AppendMode'); const lang = String(prop.val('ScriptLanguage'));
  const langs: any[] = []; for (const x of ['C#', 'Cpp', 'JScript', 'Python', 'VBScript']) if (x !== 'C#' || isWindows()) langs.push(x, x);
  if (!append) {
    l.AddTab('Plug-in Definition');
    l.AddGroup('');
    l.AddItem('ScriptingName', 'Command Name'); l.AddItem('PluginName', 'Plug-in Name'); l.AddItem('Author');
    l.AddEnumControl('ScriptLanguage', langs, 'Coding Language', 'siControlCombo');
    if (isWindows()) l.AddEnumControl('CompilerVersion', supportedVCCompilers().flat(), 'C++ Compiler Version', 'siControlCombo');
    l.AddRow();
    const ids = menuIdArray(app).map(([n]) => n); const sorted = ['None', ...ids.filter(n => n !== 'None').sort()];
    l.AddEnumControl('MenuID', sorted.flatMap(n => [n, n]), 'Add to Menu', 'siControlCombo');
    l.AddButton('BtnHelpMenu', '?');
    l.EndRow();
    l.AddItem('MenuLabel', 'Menu Label');
    l.EndGroup();
    l.AddGroup('Output Directory'); l.AddItem('DestDir', '', 'siControlFolder').SetAttribute('siUINoLabel', true); l.EndGroup();
    l.AddButton('Generate', 'Generate Code');
    l.AddTab('Command Definition');
  }
  l.AddGroup('Command');
  l.AddItem('ScriptingName', 'Command Name'); l.AddItem('Description'); l.AddItem('ToolTip');
  l.AddItem('SupportsKeyAssignment', 'Supports Key Assignment'); l.AddItem('CannotBeUsedInBatch', 'Cannot Be Used In Batch'); l.AddItem('NotLogged', 'Not Logged');
  l.AddItem('ReturnValue', 'Return Value'); l.AddItem('UndoRedoSupport', 'Undo/Redo Callbacks (C++ only)');
  l.EndGroup();
  l.AddGroup('Arguments');
  l.AddRow(); l.AddButton('BtnAddArgument', 'Add'); l.AddButton('BtnRemoveArgument', 'Remove'); l.EndRow();
  const g = gridOf(prop, 'Arguments')!;
  if (g.RowCount) { const it = l.AddItem('Arguments', '', 'siControlGrid'); it.SetAttribute('siUINoLabel', true); it.SetAttribute('siUIGridColumnWidths', '25:80:125:100'); it.SetAttribute('siUIGridSelectionMode', 'siSelectionHeader'); it.SetAttribute('siUIGridColumn2ComboItems', HANDLERS.flatMap(([lab], i) => [lab, i])); }
  l.EndGroup();
  if (!append) l.AddButton('Generate2', 'Generate Code');
  enableParam(prop, 'UndoRedoSupport', lang === 'Cpp');
  (prop as any).hiddenParams = lang === 'Cpp' ? [] : ['CompilerVersion'];
  enableParam(prop, 'MenuLabel', String(prop.val('MenuID')) !== 'None');
}

export function cmdWizardEvent(app: App, prop: Property, ev: { param?: string; button?: string; typed?: string }): any {
  const g = gridOf(prop, 'Arguments')!;
  if (ev.button === 'BtnAddArgument') { const r = g.addRow(); g.SetCell(0, r, `Arg${r}`); g.SetCell(1, r, ''); g.SetCell(2, r, 0); cmdWizardLayout(app, prop); return; }
  if (ev.button === 'BtnRemoveArgument') { for (const r of [...g.selectedRows].sort((a, b) => b - a)) g.removeRow(r); cmdWizardLayout(app, prop); return; }
  if (ev.button === 'BtnHelpMenu') { new WizardHelperObj(app).ShowMenuAnchorPointsInNetview(); b15fState(app).help.push('siMenuAnchorPoints'); return; }
  if (ev.button === 'Generate' || ev.button === 'Generate2') {
    const name = String(prop.val('ScriptingName') ?? '');
    if (name === '') { box(app, 7165); return; }
    const existing = [...app.commands.values()].find(d => d.name === name || d.label === name);
    if (existing) {
      const plugin = b15fState(app).plugins.find(p => p.commands.includes(existing.name));
      if (plugin) box(app, 7167, plugin.file); else box(app, 7166);
      return;
    }
    app.logMsg('info', 'Now generating the custom command plug-in file...');
    return app.run('GenerateCommandPlugin', { Wizard: prop });
  }
  if (ev.param === 'ScriptingName') {
    const typed = String(ev.typed ?? prop.val('ScriptingName') ?? '');
    prop.set('ScriptingName', typed.replace(/ /g, ''));
    prop.set('PluginName', `${typed}Plugin`); prop.set('MenuLabel', typed);
  } else if (ev.param === 'ScriptLanguage') {
    app.logMsg('info', 'CCmdWizard_ScriptingLanguage_OnChanged');
    cmdWizardLayout(app, prop);
  } else if (ev.param === 'MenuID') cmdWizardLayout(app, prop);
}

// ------------------------------------------------------------------ command plug-in code (note 3.3)

interface CmdSpec { lang: Lang; name: string; desc: string; tooltip: string; keyAssign: boolean; noBatch: boolean; noLog: boolean; ret: boolean; undo: boolean; menu: string; menuLabel: string; args: { name: string; def: string; handler: number }[] }
function specOf(app: App, prop: Property, lang: Lang): CmdSpec {
  const g = gridOf(prop, 'Arguments');
  const args = g ? g.rows.map(r => ({ name: String(r[0] ?? ''), def: r[1] === undefined || r[1] === null ? '' : String(r[1]), handler: Number(r[2]) || 0 })) : [];
  return {
    lang, name: new WizardHelperObj(app).RemoveSpaces(prop.val('ScriptingName')), desc: String(prop.val('Description') ?? ''), tooltip: String(prop.val('ToolTip') ?? ''),
    keyAssign: !!prop.val('SupportsKeyAssignment'), noBatch: !!prop.val('CannotBeUsedInBatch'), noLog: !!prop.val('NotLogged'), ret: !!prop.val('ReturnValue'),
    undo: !!prop.val('UndoRedoSupport'), menu: String(prop.val('MenuID') ?? 'None'), menuLabel: String(prop.val('MenuLabel') ?? ''), args,
  };
}
function quoteDefault(lang: Lang, d: string): string {
  if (d === '') return d;
  if (/^(true|false)$/i.test(d)) return d;
  if (/^-?\d+(\.\d+)?$/.test(d)) return lang === 'Cpp' && /^-?\d+$/.test(d) ? `${d}l` : d;
  if (/^".*"$/.test(d)) return d;
  return `"${d}"`;
}
function registerCode(s: CmdSpec): string {
  const L = s.lang; const semi = L === 'VBScript' || L === 'Python' ? '' : ';';
  const call = (f: string, args: string) => (L === 'VBScript' ? `in_reg.${f} ${args}` : `in_reg.${f}(${args})${semi}`);
  const out = [call('RegisterCommand', `${q(L, s.name)},${q(L, s.name)}`)];
  if (s.menu !== 'None') out.push(call('RegisterMenu', `${L === 'Python' ? 'constants.' : ''}${s.menu},${q(L, s.name + '_Menu')},${L === 'Python' ? 'false,false' : 'false,false'}`));
  return out.join('\n');
}
function callbacksCode(s: CmdSpec): string {
  const L = s.lang; const t = '\t'; const out: string[] = [];
  const argNames = s.args.map(a => a.name);
  const log = (text: string) => (L === 'VBScript' ? `${t}Application.LogMessage "${text}",siInfo` : L === 'Python' ? `${t}Application.LogMessage("${text}",constants.siInfo)` : L === 'Cpp' ? `${t}Application().LogMessage(L"${text}");` : L === 'C#' ? `${t}${t}Log("${text}");` : `${t}Application.LogMessage("${text}",siInfo);`);
  // Init
  const init: string[] = [];
  const st = (x: string) => init.push(L === 'C#' ? `${t}${t}${x};` : L === 'VBScript' || L === 'Python' ? `${t}${x}` : `${t}${x};`);
  if (L === 'Cpp') st('Context ctxt( in_ctxt );'), st('Command oCmd;'), st('oCmd = ctxt.GetSource();');
  else if (L === 'VBScript') st('Set oCmd = in_ctxt.Source'); else if (L === 'C#') st('Command oCmd = (Command)ctxt.Source'); else st(L === 'Python' ? 'oCmd = in_ctxt.Source' : 'var oCmd = in_ctxt.Source');
  st(L === 'Cpp' ? `oCmd.PutDescription(L"${s.desc}")` : `oCmd.Description = "${s.desc}"`);
  if (s.tooltip) st(L === 'Cpp' ? `oCmd.PutTooltip(L"${s.tooltip}")` : `oCmd.Tooltip = "${s.tooltip}"`);
  const flag = (f: string, v: boolean) => st(L === 'VBScript' ? `oCmd.SetFlag ${f},${v ? 'true' : 'false'}` : `oCmd.SetFlag(${L === 'Python' ? 'constants.' : ''}${f},${v ? 'true' : 'false'})`);
  if (!s.keyAssign) flag('siSupportsKeyAssignment', false);
  if (s.noBatch) flag('siCannotBeUsedInBatch', true);
  if (s.noLog) flag('siNoLogging', true);
  st(L === 'Cpp' ? `oCmd.EnableReturnValue(${s.ret ? 'true' : 'false'})` : `oCmd.ReturnValue = ${s.ret ? 'true' : 'false'}`);
  if (s.args.length) {
    st(L === 'Cpp' ? 'ArgumentArray oArgs;' : L === 'VBScript' ? 'Dim oArgs' : L === 'C#' ? 'ArgumentCollection oArgs' : L === 'Python' ? 'oArgs = None' : 'var oArgs');
    st(L === 'Cpp' ? 'oArgs = oCmd.GetArguments()' : L === 'VBScript' ? 'Set oArgs = oCmd.Arguments' : 'oArgs = oCmd.Arguments');
    for (const a of s.args) {
      const h = HANDLERS[a.handler]?.[1] ?? ''; const d = L === 'C#' ? 'null' : quoteDefault(L, a.def);
      const pieces = h ? [q(L, a.name), q(L, h), ...(d !== '' ? [d] : [])] : [q(L, a.name), ...(L === 'C#' ? ['siArgumentFlags.siArgumentInput', 'siEmpty'] : L === 'Cpp' ? [] : [`${L === 'Python' ? 'constants.' : ''}siArgumentInput`]), ...(d !== '' ? [d] : [])];
      const f = h ? 'AddWithHandler' : 'Add';
      st(L === 'VBScript' ? `oArgs.${f} ${pieces.join(',')}` : `oArgs.${f}(${pieces.join(',')})`);
    }
  }
  const ok = L === 'Cpp' ? 'return CStatus::OK;' : L === 'VBScript' ? '' : L === 'C#' ? 'return true;' : 'return true';
  if (L === 'VBScript') { out.push(`Function ${s.name}_Init( in_ctxt )`, ...init, `${t}${s.name}_Init = true`, 'End Function', ''); }
  else if (L === 'Python') { out.push(`def ${s.name}_Init( in_ctxt ):`, ...init, `${t}return true`, ''); }
  else if (L === 'Cpp') { out.push(`SICALLBACK ${s.name}_Init( CRef& in_ctxt )`, '{', ...init, `${t}${ok}`, '}', ''); }
  else if (L === 'C#') { out.push(`public class ${s.name}`, '{', `${t}public bool Init( Context ctxt )`, `${t}{`, ...init, `${t}${t}${ok}`, `${t}}`, ''); }
  else { out.push(`function ${s.name}_Init( in_ctxt )`, '{', ...init, `${t}${ok}`, '}', ''); }
  // Execute
  const todo = `${cmt(L)} TODO: Put your command implementation here.`;
  if (L === 'VBScript') {
    if (s.ret) out.push(`Function ${s.name}_Execute( ${argNames.join(', ')} )`, log(`${s.name}_Execute called`), `${t}${todo}`, `${t}${s.name}_Execute = true`, 'End Function', '');
    else out.push(`Sub ${s.name}_Execute( ${argNames.join(', ')} )`, log(`${s.name}_Execute called`), `${t}${todo}`, 'End Sub', '');
  } else if (L === 'Python') out.push(`def ${s.name}_Execute( ${argNames.join(', ')} ):`, '', log(`${s.name}_Execute called`), `${t}${todo}`, `${t}return true`, '');
  else if (L === 'Cpp') {
    out.push(`SICALLBACK ${s.name}_Execute( CRef& in_ctxt )`, '{', `${t}Context ctxt( in_ctxt );`, `${t}CValueArray args = ctxt.GetAttribute(L"Arguments");`, ...s.args.map((a, i) => `${t}CValue ${a.name} = args[${i}];`), '', log(`${s.name}_Execute called`), `${t}${todo}`);
    if (s.ret) out.push(`${t}${cmt(L)} Return a value by setting this attribute:`, `${t}ctxt.PutAttribute( L"ReturnValue", true );`, `${t}${cmt(L)} Return CStatus::Fail if you want to raise a script error`);
    if (s.undo) out.push(`${t}static LONG s_id = 0; s_id++;`, `${t}ctxt.PutAttribute( L"UndoRedoData", s_id );`, `${t}Application().LogMessage(L"UndoRedoData = " + CString(s_id));`);
    out.push(`${t}return CStatus::OK;`, '}', '');
  } else if (L === 'C#') out.push(`${t}public bool Execute( Context ctxt )`, `${t}{`, log(`${s.name}_Execute called`), `${t}${t}${todo}`, `${t}${t}return true;`, `${t}}`, '}', '');
  else out.push(`function ${s.name}_Execute( ${argNames.join(', ')} )`, '{', '', log(`${s.name}_Execute called`), `${t}${todo}`, `${t}return true;`, '}', '');
  // Menu
  if (s.menu !== 'None') {
    const label = s.menuLabel || s.name;
    if (L === 'VBScript') out.push(`Function ${s.name}_Menu_Init( in_ctxt )`, `${t}Dim oMenu`, `${t}Set oMenu = in_ctxt.Source`, `${t}oMenu.AddCommandItem "${label}","${s.name}"`, `${t}${s.name}_Menu_Init = true`, 'End Function', '');
    else if (L === 'Python') out.push(`def ${s.name}_Menu_Init( in_ctxt ):`, `${t}oMenu = in_ctxt.Source`, `${t}oMenu.AddCommandItem("${label}","${s.name}")`, `${t}return true`, '');
    else if (L === 'Cpp') out.push(`SICALLBACK ${s.name}_Menu_Init( CRef& in_ctxt )`, '{', `${t}Context ctxt( in_ctxt );`, `${t}Menu oMenu;`, `${t}oMenu = ctxt.GetSource();`, `${t}MenuItem oNewItem;`, `${t}oMenu.AddCommandItem(L"${label}",L"${s.name}",oNewItem);`, `${t}return CStatus::OK;`, '}', '');
    else if (L === 'C#') out.push(`public class ${s.name}_Menu`, '{', `${t}public bool Init( Context ctxt )`, `${t}{`, `${t}${t}Menu oMenu = (Menu)ctxt.Source;`, `${t}${t}oMenu.AddCommandItem("${label}","${s.name}");`, `${t}${t}return true;`, `${t}}`, '}', '');
    else out.push(`function ${s.name}_Menu_Init( in_ctxt )`, '{', `${t}var oMenu;`, `${t}oMenu = in_ctxt.Source;`, `${t}oMenu.AddCommandItem("${label}","${s.name}");`, `${t}return true;`, '}', '');
  }
  if (L === 'Cpp' && s.undo) for (const cb of ['Undo', 'Redo', 'TermUndoRedo']) out.push(`SICALLBACK ${s.name}_${cb}( CRef& in_ctxt )`, '{', `${t}Context ctxt( in_ctxt );`, `${t}Application().LogMessage(L"${s.name}_${cb} " + CString(ctxt.GetAttribute(L"UndoRedoData")));`, `${t}return CStatus::OK;`, '}', '');
  return out.join('\n');
}
function cppIncludes(s: CmdSpec): string { return ['#include <xsi_argument.h>', '#include <xsi_command.h>', ...(s.menu !== 'None' ? ['#include <xsi_menu.h>'] : [])].join('\n'); }

/** Put the generated command on the bus (what loading the generated script plug-in does). */
function registerGenerated(app: App, s: CmdSpec, file: string) {
  app.register({
    name: s.name, label: s.name, category: 'Custom', description: s.desc, noLog: s.noLog,
    args: s.args.map(a => ({ name: a.name, default: a.def === '' ? null : a.def })),
    execute(app2: App) {
      if (s.noBatch && !interactive(app2)) throw new Error(`${s.name} cannot be used in batch mode`);
      app2.logMsg('info', `${s.name}_Execute called`);
      return s.ret ? true : undefined;
    },
  } as any);
  (app.commands.get(s.name) as any).b15fOrigin = { file, keyAssign: s.keyAssign, custom: true };
}

export function generateCommandPlugin(app: App, a: Record<string, any>): undefined {
  const prop = a.Wizard;
  if (!(prop instanceof Property) || prop.type !== 'CCmdWizard') throw new Error('Bad Argument to GenerateCommandObj');
  const lang = String(prop.val('ScriptLanguage')); const s = specOf(app, prop, lang);
  const raw = String(prop.val('ScriptingName') ?? ''); const plugin = String(prop.val('PluginName') ?? '');
  if (raw === '') { box(app, 7168); return undefined; }
  if (s.name === '') { box(app, 7169); return undefined; }
  if (plugin === '') { box(app, 7170); return undefined; }
  const dir = String(prop.val('DestDir') ?? ''); const author = String(prop.val('Author') ?? '');
  if (SCRIPT_LANGS.includes(lang)) {
    try {
      const src = generatePluginFile(app, lang, '', '', author, plugin, registerCode(s), callbacksCode(s));
      const file = join(dir, plugin + EXT[lang]);
      const ok = writeAndLoadScriptPlugin(app, dir, plugin, lang, src, plugin, () => { registerGenerated(app, s, file); return [s.name]; });
      if (ok && app.commands.has(s.name)) app.run(s.name, {});   // executed once, to get it into the command map
    } catch (e: any) { box(app, 7171, String(e?.message ?? e)); }
    return undefined;
  }
  if (lang === 'Cpp' || lang === 'C#') {
    if (trimmed(dir) === '') { box(app, 7172); return undefined; }
    let src: string;
    try { src = generatePluginFile(app, lang, '', lang === 'Cpp' ? cppIncludes(s) : '', author, plugin, registerCode(s), callbacksCode(s)); }
    catch (e: any) { box(app, lang === 'Cpp' ? 7173 : 7174, String(e?.message ?? e)); return undefined; }
    if (lang === 'Cpp') generateCppProject(app, dir, s.name, src, String(prop.val('CompilerVersion') ?? getDefaultVCCompiler()));
    else generateCSProject(app, dir, s.name, src);
    return undefined;
  }
  logNya(app, 'GenerateCommandPlugin', `coding language "${lang}"`);
  return undefined;
}

// ------------------------------------------------------------------ AddCommandToPlugin (note 3.4)

const viewType = (v: any) => String(v?.type ?? v?.Type ?? '');
const viewAttr = (v: any, n: string) => (typeof v?.GetAttribute === 'function' ? v.GetAttribute(n) : v?.attrs?.[n]);
const setViewAttr = (v: any, n: string, x: any) => { if (typeof v?.SetAttribute === 'function') v.SetAttribute(n, x); else (v.attrs ??= {})[n] = x; };

export function addCommandToPlugin(app: App, a: Record<string, any>): false | Promise<false> {
  const view = a.ScriptEditView;
  if (!view || typeof view !== 'object' || !/^(Text Editor|Script Editor)$/.test(viewType(view))) throw new Error('Bad argument - expect a Text Editor View');
  const prop = createCmdWizard(app, true);
  prop.set('AppendMode', true);
  const lang = new WizardHelperObj(app).GetLangFromExtension(viewAttr(view, 'filename'));
  prop.set('ScriptLanguage', lang);
  cmdWizardLayout(app, prop);
  const finish = (ok: boolean): false => {
    if (ok) {
      const s = specOf(app, prop, lang); const reg = registerCode(s); const ins = regInsertion(app, lang);
      const text = String(viewAttr(view, 'text') ?? '');
      let out: string | undefined;
      const at = text.indexOf(ins);
      if (at >= 0) out = text.slice(0, at) + reg.split('\n').join('\n\t') + '\n\t' + text.slice(at);
      else if (lang === 'Cpp' || lang === 'C#') out = `${text}\n${cmt(lang)} PUT THIS LINE IN YOUR ${lang === 'C#' ? 'XSIPlugin.Load' : 'XSILOADPLUGIN'} IMPLEMENTATION:\n${cmt(lang)} ${reg}\n`;
      // script languages without the marker: the text variable is left unset (note: inferred "undefined" + callbacks)
      setViewAttr(view, 'text', (out === undefined ? 'undefined' : out) + '\n' + callbacksCode(s));
    }
    deleteWizard(app, prop);
    return false;
  };
  const r = modalInspect(app, 'AddCommandToPlugin', prop, dictText('XSIPLUGINUI', 7213), paramItems(prop));
  return typeof r === 'boolean' ? finish(r) : r.then(finish);
}
function deleteWizard(app: App, prop: Property) {
  const owner = (prop as any).parent as Node | undefined;
  if (owner && typeof (owner as any).removeProperty === 'function') (owner as any).removeProperty(prop);
  app.events.emit('scene');
}

// ------------------------------------------------------------------ Plug-in wizard (notes 3.5, 3.6)

function pluginWizardProp(app: App): Property {
  const prop = new WizardHelperObj(app).CreateWizard('PluginWizardProp', true);
  for (const d of [str('PluginName', 'New Plugin', 'Plug-in Name'), str('Author', login(), 'Author'), str('ScriptLanguage', 'Python', 'Language'), str('CompilerVersion', getDefaultVCCompiler(), 'C++ Compiler Version'), str('DestDir', '', 'DestDir')]) ensureParam(prop, d);
  const l = layoutOf(prop); l.Clear(); l.SetAttribute('siUILabelMinPixels', 140); l.SetAttribute('siUILabelPercentage', 50);
  l.AddGroup('');
  l.AddItem('PluginName', 'Plug-in Name'); l.AddItem('Author');
  l.AddEnumControl('ScriptLanguage', ['C#', 'Cpp', 'JScript', 'Python', 'VBScript'].filter(x => x !== 'C#' || isWindows()).flatMap(x => [x, x]), 'Language', 'siControlCombo');
  if (isWindows()) l.AddEnumControl('CompilerVersion', supportedVCCompilers().flat(), 'C++ Compiler Version', 'siControlCombo');
  l.AddItem('Url'); l.AddItem('Email', 'Author Email');   // parameters not defined on the property (note Q6): they show nothing here
  l.EndGroup();
  l.AddGroup('Output Directory'); l.AddItem('DestDir', '', 'siControlFolder').SetAttribute('siUINoLabel', true); l.EndGroup();
  (prop as any).hiddenParams = String(prop.val('ScriptLanguage')) === 'Cpp' ? [] : ['CompilerVersion'];
  (prop as any).ppgLogic = (ev: { param?: string }) => { if (ev.param === 'ScriptLanguage') (prop as any).hiddenParams = String(prop.val('ScriptLanguage')) === 'Cpp' ? [] : ['CompilerVersion']; };
  return prop;
}

export function siGeneratePlugin(app: App, a: Record<string, any>): any {
  const prop = a.in_Prop as Property;
  if (!(prop instanceof Node)) throw new Error('SIGeneratePlugin: in_Prop must be a plug-in wizard property');   // inferred text
  const name = trimmed(prop.val('PluginName'));
  if (name === '') { box(app, 7194); return false; }
  const loaded = b15fState(app).plugins.find(p => p.name === name);
  if (loaded) { box(app, 7195, loaded.file); return false; }
  const dir = trimmed(prop.val('DestDir'));
  if (dir === '') { box(app, 7172); return undefined; }
  try { hostFs.ensureFolder(dir); } catch (e: any) { box(app, 7176, String(e?.message ?? e)); return undefined; }
  try {
    const root = name.replace(/ /g, '_'); const lang = String(prop.val('ScriptLanguage'));
    const src = generatePluginFile(app, lang, '', '', String(prop.val('Author') ?? ''), name, '', '');
    let ok: boolean;
    if (lang === 'Cpp') ok = generateCppProject(app, dir, root, src, String(prop.val('CompilerVersion') ?? getDefaultVCCompiler()));
    else if (lang === 'C#') ok = generateCSProject(app, dir, root, src);
    else ok = writeAndLoadScriptPlugin(app, dir, root, lang, src, name);
    if (!ok) return false;
  } catch (e: any) { box(app, 7177, String(e?.message ?? e)); return false; }
  return true;
}

/** CreatePluginWizard / CreateToolbarWizard loop: show modal, generate, show again until a truthy result or Cancel. */
function wizardLoop(app: App, command: string, prop: Property, title: string, gen: string): boolean | Promise<boolean> {
  if (!interactive(app)) throw new Error(`${command} cannot be used in batch mode`);   // siCannotBeUsedInBatch; wording inferred
  const items = paramItems(prop);
  let rounds = 0;
  const step = (ok: boolean): boolean | Promise<boolean> => {
    if (!ok) return false;
    if (app.run(gen, { in_Prop: prop })) return true;
    // a scripted OK that never generates would loop for ever: stop after 32 rounds (this build only)
    if (++rounds >= 32) { logNya(app, command, 'more than 32 dialog rounds without a generated result; treated as Cancel'); return false; }
    const again = modalInspect(app, command, prop, title, items);
    return typeof again === 'boolean' ? step(again) : again.then(step);
  };
  const first = modalInspect(app, command, prop, title, items);
  return typeof first === 'boolean' ? step(first) : first.then(step);
}

export function createPluginWizard(app: App, a: Record<string, any>) {
  const prop = pluginWizardProp(app);
  prop.set('DestDir', unset(a.in_dest) ? join(userPath(), 'Application\\Plugins') : String(a.in_dest));
  return wizardLoop(app, 'CreatePluginWizard', prop, dictText('XSIPLUGINUI', 7218), 'SIGeneratePlugin');
}

// ------------------------------------------------------------------ Toolbar wizard (notes 3.7, 3.8)

function toolbarWizardProp(app: App): Property {
  const prop = new WizardHelperObj(app).CreateWizard('ToolbarWizardProp', true);
  for (const d of [str('ToolbarName', 'NewToolbar', 'Toolbar Name'), bool('AddCommands', true, 'Populate with Commands from this location', { animatable: false }), str('DestDir', '', 'DestDir')]) ensureParam(prop, d);
  const l = layoutOf(prop); l.Clear(); l.SetAttribute('siUILabelMinPixels', 140); l.SetAttribute('siUILabelPercentage', 50);
  l.SetAttribute('siUIHelpFile', `${addonDocWizardState.factoryPath}/Doc/en/xsidocs.chm::/userprefs527.htm`);   // <DocLangPref> taken as "en" (inferred)
  l.AddGroup(''); l.AddItem('ToolbarName', 'Toolbar Name'); l.AddItem('AddCommands', 'Populate with Commands from this location'); l.EndGroup();
  l.AddGroup('Output Directory'); l.AddItem('DestDir', '', 'siControlFolder').SetAttribute('siUINoLabel', true); l.EndGroup();
  return prop;
}
export function createToolbarWizard(app: App, a: Record<string, any>) {
  const prop = toolbarWizardProp(app);
  prop.set('DestDir', unset(a.in_dest) ? join(userPath(), 'Application\\toolbars') : String(a.in_dest));
  return wizardLoop(app, 'CreateToolbarWizard', prop, dictText('XSIPLUGINUI', 7219), 'SIGenerateToolbar');
}

export function siGenerateToolbar(app: App, a: Record<string, any>): any {
  const prop = a.in_Prop as Property;
  if (!(prop instanceof Node)) throw new Error('SIGenerateToolbar: in_Prop must be a toolbar wizard property');   // inferred text
  const name = trimmed(prop.val('ToolbarName'));
  if (name === '') { box(app, 7201); return false; }
  const dir = trimmed(prop.val('DestDir'));
  if (dir === '') { box(app, 7172); return undefined; }
  try { hostFs.ensureFolder(dir); } catch (e: any) { box(app, 7176, String(e?.message ?? e)); return undefined; }
  let file = join(dir, name.replace(/ /g, '_') + '.xsitb');
  const doc = new SimpleXMLDoc(app);
  const root = doc.CreateRootElement('xsi_file');
  root.SetAttribute('type', 'Shelf'); root.SetAttribute('xsi_version', addonDocWizardState.version); root.SetAttribute('syntax_version', '1.0');
  const shelf = root.AddChild('shelf_view'); shelf.SetAttribute('name', name); shelf.SetAttribute('clsid', newGuid());
  shelf.AddChild('properties').AddChild('showtabs').text = 'false';
  const def = shelf.AddChild('definition');
  for (const [k, v] of [['maxinstances', '10000'], ['acceptfocus', 'true'], ['private', 'false'], ['defaultsize', '0,100,200,300'], ['cmdmap', '{00000000-0000-0000-0000-000000000000}'], ['supportedtypes', '6'], ['category', '']]) def.SetAttribute(k, v);
  const tabs = shelf.AddChild('tabs'); tabs.SetAttribute('layout', 'top'); tabs.SetAttribute('active', 'DS Toolbar');
  const tab = tabs.AddChild('tab'); tab.SetAttribute('label', 'DS Toolbar'); tab.SetAttribute('type', 'toolbar');
  const tp = tab.AddChild('properties');
  for (const [k, v] of [['id', newGuid()], ['name', ''], ['display_preset_as_small', 'false'], ['display_as_text_only', 'false']]) tp.SetAttribute(k, v);
  let buttons = 0;
  if (prop.val('AddCommands')) {
    const m = /[\\/]Application[\\/]/i.exec(dir + HOSTFS_SEP);
    if (m) {
      const rootPath = (dir + HOSTFS_SEP).slice(0, m.index).toLowerCase();
      for (const d of app.commands.values()) {
        const o = (d as any).b15fOrigin as { file: string; keyAssign: boolean; custom: boolean } | undefined;
        if (!o || !o.custom || (d.category ?? '') !== 'Custom' || !o.keyAssign) continue;
        if (!o.file.toLowerCase().startsWith(rootPath)) continue;
        const it = tab.AddChild('item'); it.SetAttribute('type', 'script'); it.SetAttribute('name', d.name); it.SetAttribute('label', d.name);
        if (!d.name.includes(' ')) it.SetAttribute('userwidth', String(d.name.length > 10 ? 40 * Math.ceil(d.name.length / 5) : 80));
        buttons++;
      }
    }
  }
  if (!/\.xsitb$/i.test(file)) file += '.xsitb';
  const err = doc.Save(file);
  if (err) { box(app, 7202, err); return false; }
  showFileForEdit(app, file);
  b15fState(app).views.push({ file, name });   // CreateViewFromDefinitionFile(file, ToolbarName) in the active layout
  b15fState(app).lastToolbar = { file, buttons };
  return true;
}

// ------------------------------------------------------------------ Template wizard (note 3.9)

const TEMPLATE_COLS = ['Name', 'Desc', 'Script', 'Image', 'Menu'];
export function createTemplateWizard(app: App, a: Record<string, any>): Property {
  const prop = new WizardHelperObj(app).CreateWizard('TemplateWizard', false);   // always a new property under SDK_Wizards
  for (const d of [str('TemplateShortName', 'MyTemplate', 'Short Name'), str('TemplateLongName', 'My New Template', 'Long Name'), str('TemplateDescription', '', 'Description'),
    str('TemplateType', 'Addon', 'Type', { animatable: false }), str('TemplateImage', '', 'Image'), str('Template_DestDir', '', 'Output Directory'),
    str('ParamTitle', 'Content Title', 'Name'), str('ParamDesc', '', 'Description'), str('ParamScript', '', 'Script'), str('ParamImage', '', 'Image'),
    bool('ParamMenu', true, 'Create Menu Item', { animatable: false })]) ensureParam(prop, d);
  addGrid(prop, 'ParamList', TEMPLATE_COLS);
  prop.set('Template_DestDir', unset(a.DefaultDest) ? userPath() : String(a.DefaultDest));
  (prop as any).ppgLogic = (ev: { button?: string }) => templateWizardEvent(app, prop, ev);
  templateLayout(prop);
  inspect(app, prop, 'Template Wizard');   // siLock
  return prop;
}
function templateLayout(prop: Property) {
  const l = layoutOf(prop); l.Clear(); l.SetAttribute('siUILabelMinPixels', 140); l.SetAttribute('siUILabelPercentage', 50);
  const g = gridOf(prop, 'ParamList')!;
  l.AddTab('Template Information');
  l.AddGroup('Template Name'); l.AddButton('LoadExisting', 'Load Existing'); l.AddItem('TemplateShortName', 'Short Name'); l.AddItem('TemplateLongName', 'Long Name');
  l.AddItem('TemplateDescription', 'Description', 'siControlTextEditor').SetAttribute('siUIHeight', 200);
  const img = l.AddItem('TemplateImage', 'Image', 'siControlFilePath'); img.SetAttribute('siUIOpenFile', true); img.SetAttribute('siUIImageFile', true); img.SetAttribute('siUIFileMustExist', true);
  l.EndGroup();
  l.AddGroup('Template Type'); l.AddEnumControl('TemplateType', ['Addon', 'addon', 'Training', 'training'], 'Type', 'siControlCombo'); l.EndGroup();
  l.AddGroup('Template Generation'); l.AddItem('Template_DestDir', 'Output Directory', 'siControlFolder'); l.AddButton('Generate', 'Generate Template'); l.EndGroup();
  l.AddTab('Add Content Item');
  l.AddGroup('Content Item'); l.AddItem('ParamTitle', 'Name'); l.AddItem('ParamDesc', 'Description', 'siControlTextEditor').SetAttribute('siUIHeight', 150); l.AddSpacer();
  l.AddItem('ParamScript', 'Script', 'siControlTextEditor').SetAttribute('siUIHeight', 150); l.AddSpacer();
  const pi = l.AddItem('ParamImage', 'Image', 'siControlFilePath'); pi.SetAttribute('siUIOpenFile', true); pi.SetAttribute('siUIImageFile', true); pi.SetAttribute('siUIFileMustExist', true);
  l.AddItem('ParamMenu', 'Create Menu Item'); l.EndGroup();
  const title = String(prop.val('ParamTitle') ?? '');
  l.AddButton('AddUpdateParam', g.rows.some(r => r[0] === title) ? 'Update Content Item' : 'Add Content Item');
  l.AddGroup('Content Item List');
  if (!g.RowCount) l.AddStaticText('No content defined.');
  else {
    const it = l.AddItem('ParamList', '', 'siControlGrid'); it.SetAttribute('siUINoLabel', true); it.SetAttribute('siUIGridSelectionMode', 'siSelectionHeader'); it.SetAttribute('siUIGridReadOnlyColumns', '1:0:0:1:1');
    l.AddRow(); l.AddButton('EditParam', 'Edit Selected'); l.AddButton('RemoveParam', 'Delete Selected'); l.EndRow();
  }
  l.EndGroup();
}
function nextTitle(t: string): string { const m = /^(.*?)(\d+)$/.exec(t); return m ? m[1] + String(Number(m[2]) + 1) : t + '1'; }
export function templateWizardEvent(app: App, prop: Property, ev: { button?: string }): any {
  const g = gridOf(prop, 'ParamList') as GridData; const v = (n: string) => prop.val(n);
  const warn = (t: string) => app.logMsg('info', `WARNING : TemplateWizard: ${t}`);
  switch (ev.button) {
    case 'AddUpdateParam': {
      const title = String(v('ParamTitle') ?? '');
      let r = g.rows.findIndex(x => x[0] === title); const fresh = r < 0;
      if (fresh) r = g.addRow('  ');
      [v('ParamTitle'), v('ParamDesc'), v('ParamScript'), v('ParamImage'), v('ParamMenu') ? '1' : '0'].forEach((x, i) => g.SetCell(i, r, x));
      if (fresh) prop.set('ParamTitle', nextTitle(title));
      break;
    }
    case 'EditParam': {
      if (!g.selectedRows.length) { warn('Nothing selected.'); return; }
      if (g.selectedRows.length > 1) { warn('Multiple items selected.'); return; }
      const r = g.selectedRows[0]; const cell = (i: number) => g.GetCell(i, r);
      prop.set('ParamTitle', cell(0) ?? ''); prop.set('ParamDesc', cell(1) ?? ''); prop.set('ParamScript', cell(2) ?? ''); prop.set('ParamImage', cell(3) ?? '');
      prop.set('ParamMenu', (String(cell(4) ?? '') || '0') !== '0');   // an empty Menu cell reads as "0"
      break;
    }
    case 'RemoveParam': for (const r of [...g.selectedRows].sort((a, b) => b - a)) g.removeRow(r); break;
    case 'LoadExisting': {
      const hook = b15fState(app).hooks.browse;
      const file = hook ? hook('CreateTemplateWizard', dictText('XSIPLUGINUI', 7220), String(v('Template_DestDir') ?? ''), dictText('XSIPLUGINUI', 7221)) : undefined;
      if (file === undefined) logNya(app, 'CreateTemplateWizard', 'the Load Existing file browser without a browse hook; treated as Cancel');
      if (!file) break;
      prop.set('Template_DestDir', hostFs.parentPath(file));
      let doc: Document;
      try { doc = new DOMParser().parseFromString(hostFs.readFile(file), 'application/xml'); } catch (e: any) { throw new Error(`load failed${e?.message ?? e}`); }
      const perr = doc.getElementsByTagName('parsererror')[0];
      if (perr) throw new Error(`load failed${perr.textContent ?? ''}`);
      const root = doc.documentElement;
      if (!root) throw new Error('load failed: this is not a xsitemplate file.');
      const child = (e: Element, n: string) => Array.from(e.children).find(c => c.tagName === n)?.textContent ?? '';
      prop.set('TemplateShortName', child(root, 'ShortName')); prop.set('TemplateLongName', child(root, 'LongName'));
      prop.set('TemplateDescription', child(root, 'Description')); prop.set('TemplateImage', child(root, 'Image'));
      g.clear();
      const content = Array.from(root.children).find(c => c.tagName === 'Content');
      for (const it of content ? Array.from(content.children).filter(c => c.tagName === 'Item') : []) {
        const r = g.addRow('  ');
        [child(it, 'Name'), child(it, 'Description'), child(it, 'Script'), child(it, 'Image'), child(it, 'Menu') || '0'].forEach((x, i) => g.SetCell(i, r, x));
      }
      break;
    }
    case 'Generate': return generateTemplate(app, prop);
    default: return;
  }
  templateLayout(prop);
}
function generateTemplate(app: App, prop: Property): string | undefined {
  const g = gridOf(prop, 'ParamList') as GridData; const v = (n: string) => String(prop.val(n) ?? '');
  const err = (t: string) => { app.logMsg('error', `TemplateWizard: ${t}`); return undefined; };
  if (v('TemplateShortName') === '') return err('Template name is empty');
  if (!g.RowCount) return err('No content items defined.');
  const dir = v('Template_DestDir');
  if (dir === '') return err('No output directory specified.');
  try { hostFs.ensureFolder(dir); } catch { return err(`Unable to create an output folder in '${dir}'`); }
  app.logMsg('info', `Generating template files in '${dir}'...`);
  const doc = new SimpleXMLDoc(app); const root = doc.CreateRootElement('xsi_template');
  root.SetAttribute('xsi_version', addonDocWizardState.version); root.SetAttribute('syntax_version', '1.0'); root.SetAttribute('Date', new Date().toLocaleDateString());
  for (const [tag, p] of [['ShortName', 'TemplateShortName'], ['LongName', 'TemplateLongName'], ['Description', 'TemplateDescription'], ['Image', 'TemplateImage'], ['Type', 'TemplateType']]) root.AddChild(tag).text = v(p);
  const content = root.AddChild('Content');
  for (const r of g.rows) { const it = content.AddChild('Item'); ['Name', 'Description', 'Script', 'Image', 'Menu'].forEach((t, i) => { it.AddChild(t).text = r[i] ?? ''; }); }
  const file = join(dir, v('TemplateShortName') + '.xsitemplate');
  const e = doc.Save(file);
  if (e) return err(e);
  showFileForEdit(app, file);
  app.logMsg('info', 'TemplateWizard: Done.');
  return file;
}

// ------------------------------------------------------------------ registration

export function registerB15fWizardCommands(app: App) {
  const st = b15fState(app);
  st.ppg = { cmdWizard: (p: Property, ev: any) => cmdWizardEvent(app, p, ev), templateWizard: (p: Property, ev: any) => templateWizardEvent(app, p, ev) };
  st.generatePluginFile = (...x: any[]) => (generatePluginFile as any)(app, ...x);
  st.menuIdArray = () => menuIdArray(app);
  // genppg _OnChanged of a wizard property runs its page logic
  app.events.on('ppg', (ev: any) => { if (ev?.event === '_OnChanged' && typeof ev.node?.ppgLogic === 'function') ev.node.ppgLogic({ param: ev.param }); });
  const CUSTOM = 'Custom';

  app.register({
    name: 'CreateCommandWizard', label: 'CreateCommandWizard', category: CUSTOM, undoable: false,
    args: [{ name: 'DestinationDir', default: '' }],
    execute(app2, a) {
      const prop = createCmdWizard(app2, false);
      prop.set('DestDir', unset(a.DestinationDir) ? join(userPath(), 'Application\\Plugins') : String(a.DestinationDir));
      inspect(app2, prop, 'Custom Command Wizard');   // siLock
      return prop;
    },
  });
  app.register({
    name: 'GenerateCommandPlugin', label: 'GenerateCommandPlugin', category: CUSTOM, undoable: false,
    args: [{ name: 'Wizard', default: null }],
    execute: (app2, a) => generateCommandPlugin(app2, a),
  });
  app.register({
    name: 'AddCommandToPlugin', label: 'AddCommandToPlugin', category: CUSTOM, undoable: false, noLog: true,
    args: [{ name: 'ScriptEditView', default: null }],
    execute: (app2, a) => addCommandToPlugin(app2, a),
  });
  app.register({
    name: 'CreatePluginWizard', label: 'CreatePluginWizard', category: CUSTOM, description: 'Launch the Plug-in Wizard', undoable: false, noLog: true,
    args: [{ name: 'in_dest', default: null }],
    execute: (app2, a) => createPluginWizard(app2, a),
  });
  app.register({
    name: 'SIGeneratePlugin', label: 'SIGeneratePlugin', category: CUSTOM, description: 'Low-level command for generating code from the plug-in wizard', undoable: false, noLog: true,
    args: [{ name: 'in_Prop', default: null }],
    execute: (app2, a) => siGeneratePlugin(app2, a),
  });
  app.register({
    name: 'CreateToolbarWizard', label: 'CreateToolbarWizard', category: CUSTOM, description: 'Launch the Toolbar Wizard', undoable: false, noLog: true,
    args: [{ name: 'in_dest', default: null }],
    execute: (app2, a) => createToolbarWizard(app2, a),
  });
  app.register({
    name: 'SIGenerateToolbar', label: 'SIGenerateToolbar', category: CUSTOM, description: 'Low-level command for generating code from the Toolbar wizard', undoable: false, noLog: true,
    args: [{ name: 'in_Prop', default: null }],
    execute: (app2, a) => siGenerateToolbar(app2, a),
  });
  app.register({
    name: 'CreateTemplateWizard', label: 'CreateTemplateWizard', category: CUSTOM, undoable: false, noLog: true,
    args: [{ name: 'DefaultDest', default: '' }],
    execute(app2, a) {
      if (!interactive(app2)) throw new Error('CreateTemplateWizard cannot be used in batch mode');   // siCannotBeUsedInBatch; wording inferred
      return createTemplateWizard(app2, a);
    },
  });
  // SPEC-PARTIAL (note 3.10, Q1): ShaderWizard.js was not read. Only the sibling-wizard shape is wired.
  app.register({
    name: 'CreateMRShaderWizard', label: 'CreateMRShaderWizard', category: CUSTOM, undoable: false,
    args: [{ name: 'DefaultDest', default: '' }],
    execute(app2, a) {
      const prop = new WizardHelperObj(app2).CreateWizard('ShaderWizard', false);   // inferred property name
      ensureParam(prop, str('DestDir', '', 'Output Directory'));
      prop.set('DestDir', unset(a.DefaultDest) ? join(userPath(), 'Application\\Plugins') : String(a.DefaultDest));   // inferred default
      logNya(app2, 'CreateMRShaderWizard', 'the mental ray shader wizard property, its page and the files it generates (ShaderWizard.js unread)', 'Q1');
      inspect(app2, prop, 'Shader Wizard');
      return prop;
    },
  });
}
