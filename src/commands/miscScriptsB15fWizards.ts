// CMD-B15f part 1: the sdkui wizard commands (note sections 2.1-2.2, 3.2-3.10):
//   CreateCommandWizard AddCommandToPlugin GenerateCommandPlugin CreatePluginWizard SIGeneratePlugin
//   CreateToolbarWizard SIGenerateToolbar CreateTemplateWizard CreateMRShaderWizard (SPEC-PARTIAL)
// Stand-ins (see miscScriptsB15fShared.ts): wizard properties are plain Property objects under the SDK_Wizards model
// with the parameters the note lists; the grid parameters (`Arguments`, `ParamList`) are kept as `grid` row arrays on
// the property; a toolbar "view" is a record in `app.miscScriptsB15f.toolbarViews`.
import { App, CommandDef } from '../core/commands';
import { Property, Model } from '../core/scene';
import { str, bool } from '../core/params';
import { sdkHelpersState } from './sdkHelpers';
import { WizardHelperObj, SimpleXMLDoc, addonDocWizardState } from './addonDocWizard';
import { generateCommandCode, generatePluginFile, HANDLERS, HANDLER_LABELS, CmdSpec, Lang } from './miscScriptsB15fGen';
import { hostFs, miscState, msgBox, regB15f, inspectModal, inspectLocked, pluginByName, errText, join, userPath, nya, warn, pluginUi } from './miscScriptsB15fShared';

const LANGS = ['C#', 'Cpp', 'JScript', 'Python', 'VBScript'];
const isWin = () => /^win/i.test(sdkHelpersState.platform);
const login = () => addonDocWizardState.login;
const guid = () => `{${(globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000').toUpperCase()}}`;
const spaces = (s: string, rep = '') => s.replace(/ /g, rep);

/** WizardHelper().CreateWizard(type[, reuse]) plus the parameters of the wizard type that the property lacks. */
function createWizard(app: App, type: string, reuse: boolean, defs: any[]): Property {
  const p = new WizardHelperObj(app).CreateWizard(type, reuse);
  for (const d of defs) if (!p.get(d.name)) p.add(d);
  return p;
}
function resolveWizard(app: App, x: any): Property | null {
  if (x instanceof Property) return x;
  if (x && typeof x === 'object' && x.Value instanceof Property) return x.Value;
  const n = String(x ?? '').replace(/^SDK_Wizards\./, '');
  const m = app.scene.root.children.find(c => c.name === 'SDK_Wizards') as Model | undefined;
  return m?.properties.find(p => p.name === n) ?? null;
}
const sval = (p: Property, n: string) => String(p.val(n) ?? '');
const defaultDir = (sub: string) => join(join(userPath(), 'Application'), sub);

// ------------------------------------------------------------------ CCmdWizard

const cmdWizardDefs = (scriptingName: string, append = false) => [
  bool('AppendMode', append), str('PluginName', `${scriptingName}Plugin`), str('Author', login()), str('ScriptLanguage', 'Python'), str('CompilerVersion', 'VS2012'),
  str('MenuID', 'None'), str('MenuLabel', ''), str('DestDir', ''), str('ScriptingName', scriptingName), str('Description', ''), str('ToolTip', ''),
  bool('SupportsKeyAssignment', true, undefined, { animatable: false }), bool('CannotBeUsedInBatch', false, undefined, { animatable: false }),
  bool('NotLogged', false, undefined, { animatable: false }), bool('ReturnValue', true, undefined, { animatable: false }), bool('UndoRedoSupport', false, undefined, { animatable: false }),
];
/** Base `NewCommand`: the largest numeric suffix of an existing command (Name or ScriptingName) + 1; an empty suffix counts as 0. */
export function uniqueCommandName(app: App): string {
  const names: string[] = []; for (const [k, d] of app.commands) { names.push(k); if (d.label) names.push(d.label); }
  let max = -1;
  for (const n of names) { const m = /^NewCommand(\d*)$/.exec(n); if (m) max = Math.max(max, m[1] === '' ? 0 : Number(m[1])); }
  return max < 0 ? 'NewCommand' : `NewCommand${max + 1}`;
}
export const gridOf = (p: Property): any[][] => ((p as any).grid ??= []);

/** The property page's callbacks, as plain functions (the page itself is drawn by the modal helper). */
export const cmdWizardOps = {
  add(p: Property) { const g = gridOf(p); g.push([`Arg${g.length}`, '', 0]); },
  remove(p: Property, rows: number[]) { const g = gridOf(p); (p as any).grid = g.filter((_, i) => !rows.includes(i)); },
  scriptingNameChanged(p: Property, typed: string) { const t = spaces(String(typed)); p.set('ScriptingName', t); p.set('PluginName', `${typed}Plugin`); p.set('MenuLabel', String(typed)); },
  languageChanged(app: App, p: Property) { app.logMsg('info', 'CCmdWizard_ScriptingLanguage_OnChanged'); const cpp = sval(p, 'ScriptLanguage') === 'Cpp'; (p as any).undoRedoEnabled = cpp; (p as any).compilerVisible = cpp; },
  menuChanged(p: Property) { (p as any).menuLabelEnabled = sval(p, 'MenuID') !== 'None'; },
  /** The Generate / Generate Code buttons. Returns the GenerateCommandPlugin outcome or undefined when stopped by a check. */
  generate(app: App, p: Property): any {
    const name = sval(p, 'ScriptingName');
    if (name === '') { msgBox(app, 7165); return undefined; }
    for (const [k, d] of app.commands) {
      if (k !== name && d.label !== name) continue;
      const own = miscState(app).plugins.find(pl => pl.commands.includes(k));
      if (own) msgBox(app, 7167, own.file); else msgBox(app, 7166);
      return undefined;
    }
    app.logMsg('info', 'Now generating the custom command plug-in file...');
    return app.run('GenerateCommandPlugin', { Wizard: p });
  },
};
const cmdWizardLayout = (append: boolean): any[] => {
  const cmd = { group: 'Command', items: [{ param: 'ScriptingName', label: 'Command Name' }, { param: 'Description' }, { param: 'ToolTip' }, { param: 'SupportsKeyAssignment', label: 'Supports Key Assignment' },
    { param: 'CannotBeUsedInBatch', label: 'Cannot Be Used In Batch' }, { param: 'NotLogged', label: 'Not Logged' }, { param: 'ReturnValue', label: 'Return Value' }, { param: 'UndoRedoSupport', label: 'Undo/Redo Callbacks (C++ only)' }] };
  if (append) return [cmd];
  return [{ group: 'Plug-in Definition', items: [{ param: 'ScriptingName', label: 'Command Name' }, { param: 'PluginName', label: 'Plug-in Name' }, { param: 'Author' }, { param: 'ScriptLanguage', label: 'Coding Language' },
    ...(isWin() ? [{ param: 'CompilerVersion', label: 'C++ Compiler Version' }] : []), { param: 'MenuID', label: 'Add to Menu' }, { param: 'MenuLabel', label: 'Menu Label' }] },
  { group: 'Output Directory', items: [{ param: 'DestDir', control: 'folder', opts: ['nolabel'] }] }, cmd];
};
function specOf(p: Property): CmdSpec {
  const g = gridOf(p);
  return {
    lang: sval(p, 'ScriptLanguage') as Lang, name: spaces(sval(p, 'ScriptingName')), pluginName: sval(p, 'PluginName'), author: sval(p, 'Author'), menuID: sval(p, 'MenuID'), menuLabel: sval(p, 'MenuLabel'),
    compiler: sval(p, 'CompilerVersion'), description: sval(p, 'Description'), tooltip: sval(p, 'ToolTip'), keyAssign: !!p.val('SupportsKeyAssignment'), noBatch: !!p.val('CannotBeUsedInBatch'),
    noLog: !!p.val('NotLogged'), returnValue: !!p.val('ReturnValue'), undoRedo: !!p.val('UndoRedoSupport'),
    args: g.map(r => ({ name: String(r[0]), def: String(r[1] ?? ''), handler: Number(r[2] ?? 0) })),
  };
}

function genCommandPlugin(app: App, wizard: any): any {
  const p = resolveWizard(app, wizard);
  if (!p || p.type !== 'CCmdWizard') throw new Error('Bad Argument to GenerateCommandObj');
  const w = new WizardHelperObj(app); const spec = specOf(p); const lang = spec.lang;
  const scriptName = sval(p, 'ScriptingName').trim();
  if (spec.name === '') { msgBox(app, 7168); return; }
  if (scriptName === '') { msgBox(app, 7169); return; }
  if (spec.pluginName === '') { msgBox(app, 7170); return; }
  const dest = sval(p, 'DestDir');
  const build = () => { const code = generateCommandCode(spec); return generatePluginFile(w, lang, '', code.includes, spec.author, spec.pluginName, code.register, code.callbacks); };
  if (lang === 'Cpp' || lang === 'C#') {
    if (dest === '') { msgBox(app, 7172); return; }
    let src: string; try { src = build(); } catch (e) { msgBox(app, lang === 'Cpp' ? 7173 : 7174, errText(e)); return; }
    if (lang === 'Cpp') w.GenerateCppProject(dest, spec.name, src, spec.compiler); else w.GenerateCSProject(dest, spec.name, src);
    return;
  }
  try {
    const src = build();
    const ok = w.WriteAndLoadScriptPlugin(dest, spec.pluginName, lang, src, spec.pluginName);
    if (ok && app.commands.has(spec.name)) app.run(spec.name);   // runs the new command once (gets it into the command map)
  } catch (e) { msgBox(app, 7171, errText(e)); }
}

// ------------------------------------------------------------------ AddCommandToPlugin

function appendToEditor(app: App, view: any, p: Property) {
  const spec = specOf(p); const lang = spec.lang; const code = generateCommandCode(spec);
  const marker = new WizardHelperObj(app).GetRegInsertionComment(lang);
  let text = String(view.getAttr('text') ?? '');
  const i = text.indexOf(marker);
  const regLines = code.register.split('\n').map(l => '\t' + l).join('\n');
  if (i >= 0) { const before = text.slice(0, i).replace(/\t$/, ''); text = `${before}${regLines}\n\t${marker}${text.slice(i + marker.length)}`; }
  else if (lang === 'Cpp' || lang === 'C#') text += `\n${lang === 'C#' ? '// PUT THIS LINE IN YOUR XSIPlugin.Load IMPLEMENTATION:' : '// PUT THIS LINE IN YOUR XSILOADPLUGIN IMPLEMENTATION:'}\n${code.register}\n`;
  else { text = 'undefined'; nya(app, 'AddCommandToPlugin', `no registration insertion comment in the ${lang} text: the contract infers the editor text becomes "undefined" followed by the callbacks`); }
  view.setAttr('text', text + '\n' + code.callbacks);
}
function addCommandToPlugin(app: App, a: Record<string, any>): any {
  const view = a.ScriptEditView;
  const t = view && typeof view.getAttr === 'function' ? String(view.type ?? '') : '';
  if (t !== 'Text Editor' && t !== 'Script Editor') throw new Error('Bad argument - expect a Text Editor View');
  const p = createWizard(app, 'CCmdWizard', true, cmdWizardDefs(uniqueCommandName(app), true));
  p.set('AppendMode', true);
  p.set('ScriptLanguage', new WizardHelperObj(app).GetLangFromExtension(view.getAttr('filename')));
  const drop = () => { const m = app.scene.root.children.find(c => c.name === 'SDK_Wizards') as Model | undefined; m?.removeProperty(p); app.events.emit('scene'); };
  const after = (ok: boolean) => { try { if (ok) appendToEditor(app, view, p); } finally { drop(); } return false; };
  const r = inspectModal(app, 'AddCommandToPlugin', p, pluginUi(7213), cmdWizardLayout(true), true);
  return r instanceof Promise ? r.then(after, () => after(false)) : after(r);   // always false
}

// ------------------------------------------------------------------ plug-in / toolbar wizards

const pluginWizardDefs = () => [str('PluginName', 'New Plugin'), str('Author', login()), str('ScriptLanguage', 'Python'), str('CompilerVersion', 'VS2012'), str('DestDir', '')];
const toolbarWizardDefs = () => [str('ToolbarName', 'NewToolbar'), bool('AddCommands', true, undefined, { animatable: false }), str('DestDir', '')];

/** The shared "inspect modally, generate, repeat" loop of CreatePluginWizard / CreateToolbarWizard. */
function wizardLoop(app: App, cmd: string, p: Property, title: string, layout: any[], generator: string): boolean | Promise<boolean> {
  let rounds = 0;
  const step = (): boolean | Promise<boolean> => {
    if (++rounds > 50) { nya(app, cmd, 'the wizard page was re-opened 50 times without a successful generation; stopping'); return false; }
    const r = inspectModal(app, cmd, p, title, layout, true);
    const next = (ok: boolean): boolean | Promise<boolean> => !ok ? false : app.run(generator, { in_Prop: p }) ? true : step();
    return r instanceof Promise ? r.then(next) : next(r);
  };
  return step();
}
function createPluginWizard(app: App, a: Record<string, any>) {
  const p = createWizard(app, 'PluginWizardProp', true, pluginWizardDefs());
  p.set('DestDir', a.in_dest ? String(a.in_dest) : defaultDir('Plugins'));
  const layout = [{ group: '', items: [{ param: 'PluginName', label: 'Plug-in Name' }, { param: 'Author' }, { param: 'ScriptLanguage', label: 'Language' }, ...(isWin() ? [{ param: 'CompilerVersion', label: 'C++ Compiler Version' }] : [])] },
    { group: 'Output Directory', items: [{ param: 'DestDir', control: 'folder', opts: ['nolabel'] }] }];
  return wizardLoop(app, 'CreatePluginWizard', p, pluginUi(7218), layout, 'SIGeneratePlugin');
}
function siGeneratePlugin(app: App, a: Record<string, any>): any {
  const p = resolveWizard(app, a.in_Prop); if (!p) throw new Error('SIGeneratePlugin: in_Prop is not a plug-in wizard property');
  const name = sval(p, 'PluginName').trim();
  if (name === '') { msgBox(app, 7194); return false; }
  const other = pluginByName(app, name);
  if (other) { msgBox(app, 7195, other.file); return false; }
  const dir = sval(p, 'DestDir').trim();
  if (dir === '') { msgBox(app, 7172); return undefined; }
  try { hostFs.ensureFolder(dir); } catch (e) { msgBox(app, 7176, errText(e)); return undefined; }
  const root = spaces(name, '_'); const lang = sval(p, 'ScriptLanguage'); const w = new WizardHelperObj(app);
  try {
    const src = generatePluginFile(w, lang, '', '', sval(p, 'Author'), name, '', '');   // an empty plug-in: nothing registered
    const ok = lang === 'Cpp' ? w.GenerateCppProject(dir, root, src, sval(p, 'CompilerVersion')) : lang === 'C#' ? w.GenerateCSProject(dir, root, src) : w.WriteAndLoadScriptPlugin(dir, root, lang, src, name);
    return !!ok;
  } catch (e) { msgBox(app, 7177, errText(e)); return false; }
}
function createToolbarWizard(app: App, a: Record<string, any>) {
  const p = createWizard(app, 'ToolbarWizardProp', true, toolbarWizardDefs());
  p.set('DestDir', a.in_dest ? String(a.in_dest) : defaultDir('toolbars'));
  const layout = [{ group: '', items: [{ param: 'ToolbarName', label: 'Toolbar Name' }, { param: 'AddCommands', label: 'Populate with Commands from this location' }] },
    { group: 'Output Directory', items: [{ param: 'DestDir', control: 'folder', opts: ['nolabel'] }] }];
  return wizardLoop(app, 'CreateToolbarWizard', p, pluginUi(7219), layout, 'SIGenerateToolbar');
}
function siGenerateToolbar(app: App, a: Record<string, any>): any {
  const p = resolveWizard(app, a.in_Prop); if (!p) throw new Error('SIGenerateToolbar: in_Prop is not a toolbar wizard property');
  const name = sval(p, 'ToolbarName').trim();
  if (name === '') { msgBox(app, 7201); return false; }
  const dir = sval(p, 'DestDir').trim();
  if (dir === '') { msgBox(app, 7172); return undefined; }
  try { hostFs.ensureFolder(dir); } catch (e) { msgBox(app, 7176, errText(e)); return undefined; }
  let file = join(dir, spaces(name, '_') + '.xsitb');
  try {
    const doc = new SimpleXMLDoc(app); const root = doc.CreateRootElement('xsi_file');
    root.SetAttribute('type', 'Shelf'); root.SetAttribute('xsi_version', addonDocWizardState.version); root.SetAttribute('syntax_version', '1.0');
    const view = root.AddChild('shelf_view'); view.SetAttribute('name', name); view.SetAttribute('clsid', guid());
    view.AddChild('properties').AddChild('showtabs').text = 'false';
    const def = view.AddChild('definition');
    for (const [k, v] of [['maxinstances', 10000], ['acceptfocus', 'true'], ['private', 'false'], ['defaultsize', '0,100,200,300'], ['cmdmap', '{00000000-0000-0000-0000-000000000000}'], ['supportedtypes', 6], ['category', '']] as const) def.SetAttribute(k, v);
    const tabs = view.AddChild('tabs'); tabs.SetAttribute('layout', 'top'); tabs.SetAttribute('active', 'DS Toolbar');
    const tab = tabs.AddChild('tab'); tab.SetAttribute('label', 'DS Toolbar'); tab.SetAttribute('type', 'toolbar');
    const props = tab.AddChild('properties'); props.SetAttribute('id', guid()); props.SetAttribute('name', ''); props.SetAttribute('display_preset_as_small', 'false'); props.SetAttribute('display_as_text_only', 'false');
    if (p.val('AddCommands')) {
      const m = /[\\/]Application[\\/]/i.exec(dir);
      if (m) {
        const base = dir.slice(0, m.index).toLowerCase();
        for (const pl of miscState(app).plugins) {
          if (!pl.file.toLowerCase().startsWith(base)) continue;
          for (const c of pl.commands) {
            const d = app.commands.get(c); if (!d || d.category !== 'Custom' || pl.keyless) continue;
            const it = tab.AddChild('item'); it.SetAttribute('type', 'script'); it.SetAttribute('name', c); it.SetAttribute('label', c);
            if (!c.includes(' ')) it.SetAttribute('userwidth', c.length > 10 ? 40 * Math.ceil(c.length / 5) : 80);
          }
        }
      } else nya(app, 'SIGenerateToolbar', 'AddCommands with an output directory outside an "Application" folder: no buttons are added (as the contract states)');
    }
    if (!/\.xsitb$/i.test(file)) file += '.xsitb';
    const err = doc.Save(file);
    if (err !== '') { msgBox(app, 7202, err); return false; }
  } catch (e) { msgBox(app, 7202, errText(e)); return false; }
  try { app.run('ShowFileForEdit', { FileName: file }); } catch { /* headless */ }
  const st = miscState(app); (st.toolbarViews ??= []).push({ name, file });   // CreateViewFromDefinitionFile(file, name) in the active layout
  return true;
}

// ------------------------------------------------------------------ template wizard

const templateDefs = () => [str('TemplateShortName', 'MyTemplate'), str('TemplateLongName', 'My New Template'), str('TemplateDescription', ''), str('TemplateType', 'Addon', undefined, { animatable: false }),
  str('TemplateImage', ''), str('Template_DestDir', ''), str('ParamTitle', 'Content Title'), str('ParamDesc', ''), str('ParamScript', ''), str('ParamImage', ''), bool('ParamMenu', true, undefined, { animatable: false })];
const tlog = (app: App, t: string, err = false) => app.logMsg(err ? 'error' : 'info', `TemplateWizard: ${t}`);
/** Property-page callbacks of the template wizard. Rows are [Name, Desc, Script, Image, Menu]. */
export const templateOps = {
  addUpdate(p: Property) {
    const g = gridOf(p); const title = sval(p, 'ParamTitle'); const row = [title, sval(p, 'ParamDesc'), sval(p, 'ParamScript'), sval(p, 'ParamImage'), p.val('ParamMenu') ? '1' : '0'];
    const i = g.findIndex(r => r[0] === title);
    if (i >= 0) { g[i] = row; return; }
    g.push(row);
    const m = /(\d+)$/.exec(title); p.set('ParamTitle', m ? title.replace(/\d+$/, String(Number(m[1]) + 1)) : title + '1');
  },
  edit(app: App, p: Property, rows: number[]) {
    if (rows.length === 0) { warn(app, 'TemplateWizard: Nothing selected.'); return; }
    if (rows.length > 1) { warn(app, 'TemplateWizard: Multiple items selected.'); return; }
    const r = gridOf(p)[rows[0]]; if (!r) return;
    p.set('ParamTitle', String(r[0])); p.set('ParamDesc', String(r[1])); p.set('ParamScript', String(r[2])); p.set('ParamImage', String(r[3])); p.set('ParamMenu', String(r[4] === '' ? '0' : r[4]) !== '0');
  },
  remove(p: Property, rows: number[]) { (p as any).grid = gridOf(p).filter((_, i) => !rows.includes(i)); },
  /** `file` is the chosen .xsitemplate; cancel (empty) does nothing. */
  load(app: App, p: Property, file: string) {
    if (file === '') return;
    p.set('Template_DestDir', hostFs.parentPath(file));
    let text: string; try { text = hostFs.readFile(file); } catch (e) { throw new Error(`load failed${errText(e)}`); }
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error(`load failed${doc.querySelector('parsererror')!.textContent}`);
    const root = doc.documentElement; if (!root || root.nodeName !== 'xsi_template') throw new Error('load failed: this is not a xsitemplate file.');
    const kid = (el: Element, n: string) => Array.from(el.children).find(c => c.nodeName === n)?.textContent ?? '';
    p.set('TemplateShortName', kid(root, 'ShortName')); p.set('TemplateLongName', kid(root, 'LongName')); p.set('TemplateDescription', kid(root, 'Description')); p.set('TemplateImage', kid(root, 'Image'));
    const content = Array.from(root.children).find(c => c.nodeName === 'Content');
    (p as any).grid = Array.from(content?.children ?? []).filter(c => c.nodeName === 'Item').map(it => [kid(it, 'Name'), kid(it, 'Description'), kid(it, 'Script'), kid(it, 'Image'), kid(it, 'Menu') || '0']);
  },
  generate(app: App, p: Property): boolean {
    const dir = sval(p, 'Template_DestDir'); const short = sval(p, 'TemplateShortName');
    if (short === '') { tlog(app, 'Template name is empty', true); return false; }
    if (gridOf(p).length === 0) { tlog(app, 'No content items defined.', true); return false; }
    if (dir === '') { tlog(app, 'No output directory specified.', true); return false; }
    try { hostFs.ensureFolder(dir); } catch { tlog(app, `Unable to create an output folder in '${dir}'`, true); return false; }
    tlog(app, `Generating template files in '${dir}'...`);
    const doc = new SimpleXMLDoc(app); const root = doc.CreateRootElement('xsi_template');
    root.SetAttribute('xsi_version', addonDocWizardState.version); root.SetAttribute('syntax_version', '1.0'); root.SetAttribute('Date', new Date().toLocaleDateString());
    root.AddChild('ShortName').text = short; root.AddChild('LongName').text = sval(p, 'TemplateLongName'); root.AddChild('Description').text = sval(p, 'TemplateDescription');
    root.AddChild('Image').text = sval(p, 'TemplateImage'); root.AddChild('Type').text = sval(p, 'TemplateType');
    const content = root.AddChild('Content');
    for (const r of gridOf(p)) { const it = content.AddChild('Item'); ['Name', 'Description', 'Script', 'Image', 'Menu'].forEach((k, i) => { it.AddChild(k).text = String(r[i] ?? ''); }); }
    const file = join(dir, `${short}.xsitemplate`); const err = doc.Save(file);
    if (err !== '') { tlog(app, err, true); return false; }
    try { app.run('ShowFileForEdit', { FileName: file }); } catch { /* headless */ }
    tlog(app, 'Done.');
    return true;
  },
};
const sdkWizardsModel = (app: App): Model => {
  let m = app.scene.root.children.find(c => c.name === 'SDK_Wizards') as Model | undefined;
  if (!m) { m = new Model('SDK_Wizards'); app.scene.root.addChild(m); try { m.property('visibility')?.set('viewvis', false); } catch { /* no visibility */ } app.events.emit('scene'); }
  return m;
};
function createTemplateWizard(app: App, a: Record<string, any>) {
  const m = sdkWizardsModel(app);
  const p = new Property('TemplateWizard', 'TemplateWizard', templateDefs()); m.addProperty(p); app.events.emit('scene');   // always new
  p.set('Template_DestDir', a.DefaultDest ? String(a.DefaultDest) : userPath());
  inspectLocked(app, p, 'Template Wizard');
  return p;
}
function createMRShaderWizard(app: App, a: Record<string, any>) {
  const m = sdkWizardsModel(app);
  const p = new Property('MRShaderWizard', 'MRShaderWizard', [str('DestDir', a.DefaultDest ? String(a.DefaultDest) : defaultDir('Plugins'))]); m.addProperty(p); app.events.emit('scene');   // inferred
  nya(app, 'CreateMRShaderWizard', 'the property parameters, page layout and generated files (SPDL, C++ source, project) of ShaderWizard.js; only the output directory exists (note Q1)');
  inspectLocked(app, p, 'mental ray Shader Wizard');
  return p;
}

// ------------------------------------------------------------------ registration

export function registerMiscB15fWizardCommands(app: App) {
  const reg = (def: CommandDef) => regB15f(app, def);
  reg({
    name: 'CreateCommandWizard', label: 'CreateCommandWizard', category: 'Custom', description: 'Create and show the custom command wizard', args: [{ name: 'DestinationDir', default: '' }], undoable: false,
    execute(app2, a) {
      const p = createWizard(app2, 'CCmdWizard', false, cmdWizardDefs(uniqueCommandName(app2)));   // always a new property
      p.set('DestDir', a.DestinationDir ? String(a.DestinationDir) : defaultDir('Plugins'));
      inspectLocked(app2, p, 'Custom Command Wizard');
      return p;
    },
  });
  reg({ name: 'AddCommandToPlugin', label: 'AddCommandToPlugin', category: 'Custom', description: 'Add a custom command to the plug-in in a script editor', args: [{ name: 'ScriptEditView', default: null }], undoable: false, noLog: true,
    execute: (app2, a) => addCommandToPlugin(app2, a) });
  reg({ name: 'GenerateCommandPlugin', label: 'GenerateCommandPlugin', category: 'Custom', description: 'Generate the custom command plug-in described by a wizard property', args: [{ name: 'Wizard', default: null }], undoable: false,
    execute: (app2, a) => { genCommandPlugin(app2, a.Wizard); } });
  reg({ name: 'CreatePluginWizard', label: 'CreatePluginWizard', category: 'Custom', description: 'Create and show the plug-in wizard', args: [{ name: 'in_dest', default: null }], undoable: false, noLog: true,
    execute: (app2, a) => createPluginWizard(app2, a) });
  reg({ name: 'SIGeneratePlugin', label: 'SIGeneratePlugin', category: 'Custom', description: 'Generate an empty plug-in from a plug-in wizard property', args: [{ name: 'in_Prop', default: null }], undoable: false, noLog: true,
    execute: (app2, a) => siGeneratePlugin(app2, a) });
  reg({ name: 'CreateToolbarWizard', label: 'CreateToolbarWizard', category: 'Custom', description: 'Create and show the toolbar wizard', args: [{ name: 'in_dest', default: null }], undoable: false, noLog: true,
    execute: (app2, a) => createToolbarWizard(app2, a) });
  reg({ name: 'SIGenerateToolbar', label: 'SIGenerateToolbar', category: 'Custom', description: 'Generate a toolbar file from a toolbar wizard property', args: [{ name: 'in_Prop', default: null }], undoable: false, noLog: true,
    execute: (app2, a) => siGenerateToolbar(app2, a) });
  reg({ name: 'CreateTemplateWizard', label: 'CreateTemplateWizard', category: 'Custom', description: 'Create and show the template wizard', args: [{ name: 'DefaultDest', default: '' }], undoable: false, noLog: true,
    execute: (app2, a) => createTemplateWizard(app2, a) });
  reg({ name: 'CreateMRShaderWizard', label: 'CreateMRShaderWizard', category: 'Custom', description: 'Create and show the mental ray shader wizard', args: [{ name: 'DefaultDest', default: '' }], undoable: false,
    execute: (app2, a) => createMRShaderWizard(app2, a) });
  Object.assign(miscState(app), { cmdWizardOps, templateOps, handlerLabels: HANDLER_LABELS, handlers: HANDLERS, languages: LANGS });
}
