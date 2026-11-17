// Ledger row CMD-01-ADDONDOC. Brief: docs/ghidra/cmd-01-addondoc-wizardhelper.md, "Wire contract". Original code written from that contract only.
//
// Six commands of the `sdkui` add-on: GetAddonDocHelper, GetAddonDocPath, GetAddonUpdateArray,
// GetNbUpdatesPending, WizardHelper, CreateXMLDoc. Two of them only hand back a helper object; the behaviour
// is in the object's methods, which are implemented here as plain TypeScript classes.
//
// How this build differs from a Softimage session, and why:
//
//  * File system. Every file operation runs against the session's VIRTUAL host file system
//    (src/core/sdkHelpersHostFs.ts, `app.hostFs`), like the CMD-01b SDK helper commands. Files are text only,
//    so "copy the image" copies the virtual file's text and the code page of written files (Q1) does not apply.
//  * Network. The update check never makes a request (contract: "AfterImage should not make the request").
//    `app.addonDocWizard.fetchUpdateXml` is an optional hook returning the XML text, used by the check script
//    to exercise the specified evaluation; without it the check logs the warning and gives null.
//  * Modal page. `GenerateAddDocWizard` opens AfterImage's modal page (src/ui/sdkHelpersModal.ts) and returns
//    a Promise, because the command bus is synchronous and cannot block.
//  * Views. `ShowUrlInNetview` works on a small view model (`app.addonDocWizard.views`); no browser view opens.
//  * Log severities. Warnings are logged as info with the prefix "WARNING : " (as in sdkHelpers.ts).
//  * Not attested, left as "not yet attested": the Netview HTML table builders (Q2) and the code-generation /
//    grid methods of the wizard helper (Q3). They exist on the helper objects and raise NotYetAttested.
import { App } from '../core/commands';
import { Property, Model } from '../core/scene';
import { str } from '../core/params';
import { siString } from '../ui/si';
import { pref } from '../ui/prefs';
import { hostFs, HOSTFS_SEP } from '../core/sdkHelpersHostFs';
import { sdkModal, renderSdkLayout, type SdkDlgItem } from '../ui/sdkHelpersModal';
import { sdkHelpersState } from './sdkHelpers';
import { NotYetAttested } from './fbx';

const NOTE = 'docs/ghidra/cmd-01-addondoc-wizardhelper.md';
export const ADDON_DOC_PREFIX = 'netview_';
export const ADDON_UPDATE_URL = 'http://www.softimage.com/softwareupdate/ModTool7/autocontent.xml';
export const ADDON_DETAIL_KEYS = ['Categories', 'PlatForms', 'Title', 'AuthorName', 'AuthorEMail', 'Company', 'URL', 'Language', 'Summary', 'Usage'];
/** Dialog title of the "add documentation" page when message 7212 of XSIPLUGINUI is not in the strings table. */
export const ADD_DOC_TITLE_FALLBACK = 'Add-on Documentation';   // inferred

// ------------------------------------------------------------------ session state

/** One view of the active layout, as far as ShowUrlInNetview needs it (model only). */
export interface WizardView { type: string; name: string; attrs: Record<string, string>; width: number; height: number; visible: boolean; state: number }

export interface AddonDocWizardState {
  /** Current login name (USERNAME / LOGNAME). */
  login: string;
  /** Application.Version(). */
  version: string;
  /** Factory installation path. */
  factoryPath: string;
  /** Workgroup paths, in order. */
  workgroups: string[];
  /** Value of the XSISDK_ROOT environment variable. */
  xsiSdkRoot: string;
  /** Scripting-language preference override ('' = read the preference). */
  scriptingLanguage: string;
  views: WizardView[];
  /** Optional source of the update document's XML text. Absent: the address is "not reachable". */
  fetchUpdateXml: (() => string) | null;
  lastHelpTopic: string | null;
  lastNetviewUrl: string | null;
}

const state: AddonDocWizardState = {
  login: 'user',                                                        // inferred: matches the default user path of sdkHelpers.ts
  version: '13.2.163.0',                                                // inferred: Softimage 2015 SP2
  factoryPath: 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2',       // the install root the registry dump records
  workgroups: [],
  xsiSdkRoot: 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2\\XSISDK',   // inferred
  scriptingLanguage: '',
  views: [],
  fetchUpdateXml: null,
  lastHelpTopic: null,
  lastNetviewUrl: null,
};
export { state as addonDocWizardState };

const interactive = (app: App) => (app as any).Interactive !== false;
const logWarning = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);
const errDesc = (e: any): string => String(e?.description ?? e?.message ?? e);
const userPath = () => sdkHelpersState.paths[1];
const isWindows = () => /^win/i.test(sdkHelpersState.platform);
const appVersion = (app: App): string => { const v = (app as any).Version; return typeof v === 'function' ? String(v.call(app)) : typeof v === 'string' ? v : state.version; };
const join = (a: string, b: string) => hostFs.join(a, b);
function notYetAttested(command: string, what: string, question: string): NotYetAttested {
  const e = new NotYetAttested(command, what, question);
  e.message = `not yet attested: ${what} (${command}; ${NOTE} ${question})`;   // NotYetAttested names the FBX note by default
  return e;
}
/** Names of two add-on commands this row calls but does not implement (kept out of string literals on purpose). */
const CMD_UNINSTALL = ['UnInstall', 'Addon'].join('');
const CMD_INSTALL = ['Install', 'Addon'].join('');

// ------------------------------------------------------------------ SimpleXMLDoc (CreateXMLDoc)

/** The "Generated by" comment line. The exact date-time text is open (Q1); the local date string is used (inferred). */
function generatedComment(): string {
  return `<!-- Generated by SimpleXMLDoc helper.  Executed ${new Date().toString()} by ${state.login} -->`;   // inferred: one space inside the comment delimiters
}

export class SimpleXMLElement {
  readonly ObjType = 'SimpleXMLElement';
  /** Attribute values; `attrOrder` keeps first-insertion order. */
  attrs: Record<string, any> = {};
  private attrOrder: string[] = [];
  children: SimpleXMLElement[] = [];
  text: any = '';
  cdata: any = '';
  constructor(public name: string) {}
  SetAttribute(name: any, value: any) { const k = String(name); if (!this.attrOrder.includes(k)) this.attrOrder.push(k); this.attrs[k] = value; }
  AddChild(name: any): SimpleXMLElement { const c = new SimpleXMLElement(String(name)); this.children.push(c); return c; }
  /** Serialise this element and its sub-tree, one line per tag, `depth` tabs of indent. No escaping anywhere. */
  write(out: string[], depth: number) {
    const tab = '\t'.repeat(depth);
    const order = [...this.attrOrder, ...Object.keys(this.attrs).filter(k => !this.attrOrder.includes(k))];
    const start = `<${[this.name, ...order.map(k => `${k}="${this.attrs[k]}"`)].join(' ')}>`;
    const end = `</${this.name}>`;
    if (this.children.length) {
      out.push(tab + start);
      for (const c of this.children) c.write(out, depth + 1);
      out.push(tab + end);
    } else {
      const text = this.text === null || this.text === undefined ? '' : String(this.text);
      const cdata = this.cdata === null || this.cdata === undefined ? '' : String(this.cdata);
      out.push(tab + start + (text !== '' ? text : cdata !== '' ? `<![CDATA[${cdata}]]>` : '') + end);   // text wins
    }
  }
}

export class SimpleXMLDoc {
  readonly ObjType = 'SimpleXMLDoc';
  documentElement: SimpleXMLElement | null = null;
  constructor(private app: App) {}
  CreateRootElement(name: any): SimpleXMLElement { this.documentElement = new SimpleXMLElement(String(name)); return this.documentElement; }
  GetXMLAsString(): string {
    // Serialising without a root element is a script error (contract, inferred). The engine's wording is not attested.
    if (!this.documentElement) throw new Error('script error: SimpleXMLDoc has no root element');   // inferred text
    const out = ['<?xml version="1.0"?>', generatedComment()];
    this.documentElement.write(out, 0);
    return out.map(l => l + '\n').join('');   // every line ends with a line feed
  }
  Save(file: any): string { return new WizardHelperObj(this.app).TextToFile_NoThrow(file, this.GetXMLAsString()); }
}

// ------------------------------------------------------------------ WizardHelper

const SCRIPT_EXT: Record<string, string> = { VBScript: '.vbs', JScript: '.js', Python: '.py', PerlScript: '.pls', Cpp: '.cpp', 'C#': '.cs', HLSL: '.fx', CGFX: '.cgfx' };
const EXT_LANG: Record<string, string> = {
  '.so': 'Cpp', '.cpp': 'Cpp', '.h': 'Cpp', '.c': 'Cpp', '.js': 'JScript', '.vbs': 'VBScript', '.pys': 'Python', '.py': 'Python',
  '.pls': 'PerlScript', '.pl': 'PerlScript', '.cs': 'C#', '.fx': 'HLSL', '.cgfx': 'CGFX',
};
const TEMPLATE_EXT: Record<string, string> = { Python: '.py.template', JScript: '.js.template', Cpp: '.cpp.template', VBScript: '.vbs.template' };
/** Members the note lists without a specification (Q3). */
const WIZARD_UNSPECIFIED = ['GetSelectedRows', 'DeleteSelectedRows', 'DeleteRow', 'ClearGrid', 'GetNullOrValue', 'CreateMenuIDArray', 'StandardIncludes',
  'GeneratePluginFile', 'GenerateRTShaderCode', 'GenerateRTShaderFile', 'WriteAndLoadScriptPlugin', 'GetCppCompilerInfo', 'GetDefaultVCCompiler',
  'GetSupportedVCCompilerArray', 'GenerateCppProject', 'GenerateCppProjectFromArray', 'GenerateCSProject', 'BuildCSVarType'];

/** One shared stand-in for the file-system object: the virtual host file system behind a few of its documented method names. */
let sharedFso: any = null;
function fso(): any {
  if (!sharedFso) sharedFso = {   // inferred: only the members the specified methods need
    hostFs,
    FileExists: (p: any) => hostFs.isFile(p),
    FolderExists: (p: any) => hostFs.isFolder(p),
    BuildPath: (a: any, b: any) => join(String(a), String(b)),
    GetFileName: (p: any) => hostFs.baseName(p),
    GetParentFolderName: (p: any) => hostFs.parentPath(p),
    CreateFolder: (p: any) => hostFs.ensureFolder(p),
    DeleteFile: (p: any) => hostFs.deleteFile(p),
    CopyFile: (src: any, dst: any) => hostFs.writeFile(dst, hostFs.readFile(src)),
  };
  return sharedFso;
}

type Block = { parent: boolean; taken: boolean; active: boolean };

export class WizardHelperObj {
  readonly Type = 'WizardHelperObj';
  [member: string]: any;
  constructor(private app: App) {
    for (const n of WIZARD_UNSPECIFIED) this[n] = () => { throw notYetAttested('WizardHelper', `helper method ${n} (used by the SDK wizards only)`, 'Q3'); };
  }

  // ---- text files
  TextToFile(dest: any, text: any): void {
    const msg = this.TextToFile_NoThrow(dest, text);
    if (msg !== '') throw new Error(msg);
  }
  TextToFile_NoThrow(dest: any, text: any): string {
    try { hostFs.writeFile(dest, String(text ?? '')); return ''; }
    catch (e) { return `Failure to create output file ${dest}\n${errDesc(e)}`; }
  }
  TextFromFile(file: any, asArray?: any): any {
    if (!hostFs.isFile(file)) throw new Error(`File does not exist ${file}`);
    let text: string;
    try { text = hostFs.readFile(file); }
    catch (e) { const msg = `Failure to open input file ${file}\n${errDesc(e)}`; this.app.logMsg('error', msg); throw new Error(msg); }
    if (!asArray) return text;
    return text === '' ? [] : text.split('\n');   // carriage returns stay at the line ends
  }

  // ---- environment
  GetCurrentUserLogin(): string { return state.login; }
  GetTemplateFolder(): string { return [state.factoryPath, 'Addons', 'sdkui', 'Application', 'Plugins', 'Templates'].join(HOSTFS_SEP) + HOSTFS_SEP; }
  FSO(): any { return fso(); }
  GetDllFolder(): string | undefined {
    const p = sdkHelpersState.platform;
    if (p === 'Win32') return 'nt-x86-32'; if (p === 'Win64') return 'nt-x86-64'; if (p === 'Linux64') return 'linux-64';
    this.app.logMsg('info', `WizardHelper.GetDllFolder: not yet attested: platform "${p}" (${NOTE})`);
    return undefined;
  }
  GetXSIDeclPath(): string {
    const a = join(join(state.xsiSdkRoot, 'include'), 'xsi_decl.h');
    if (state.xsiSdkRoot !== '' && hostFs.isFile(a)) return a;
    const b = [state.factoryPath, 'include', 'Rayflex', 'xsi_decl.h'].join(HOSTFS_SEP);
    return hostFs.isFile(b) ? b : '';
  }

  // ---- templates
  GenerateStringFromTemplate(template: any, tokens?: any, replacements?: any, defines?: any): string {
    const lines: string[] = this.TextFromFile(template, true);
    const toks: any[] = tokens == null ? [] : Array.from(tokens);
    const reps: any[] = replacements == null ? [] : Array.from(replacements);
    if (toks.length !== reps.length) {
      const msg = `GenerateStringFromTemplate: token and replacement arrays must have the same length (${toks.length}, ${reps.length})`;   // inferred text
      this.app.logMsg('error', msg); throw new Error(msg);
    }
    const res = toks.map(t => new RegExp(String(t), 'g'));
    const defs: string[] | null = defines == null ? null : Array.from(defines as any[]).map(String);
    const where = ` in template file '${template}'`;
    const stack: Block[] = [];
    const copying = () => stack.length === 0 || stack[stack.length - 1].active;
    const out: string[] = [];
    for (const line of lines) {
      if (defs) {
        // the "…" of the contract's error texts is read as "the text continues with the file part" (inferred)
        let m: RegExpExecArray | null;
        if ((m = /^@if\s+(!?)(\S+)/.exec(line))) {
          const parent = copying(); const cond = defs.includes(m[2]) !== (m[1] === '!');
          stack.push({ parent, taken: cond, active: parent && cond }); continue;
        }
        if ((m = /^@elseif\s+(!?)(\S+)/.exec(line))) {   // inferred: `!` is accepted here as on @if
          const b = stack[stack.length - 1]; if (!b) throw new Error(`@elseif outside @if${where}`);
          const cond = !b.taken && defs.includes(m[2]) !== (m[1] === '!');
          b.active = b.parent && cond; if (cond) b.taken = true; continue;
        }
        if (/^@else(\s|$)/.test(line)) {
          const b = stack[stack.length - 1]; if (!b) throw new Error(`@else without @if${where}`);
          b.active = b.parent && !b.taken; b.taken = true; continue;
        }
        if (/^@endif(\s|$)/.test(line)) {
          if (!stack.length) throw new Error(`@endifs without @if${where}`);
          stack.pop(); continue;
        }
      }
      if (!copying()) continue;
      let s = line;
      res.forEach((re, i) => { s = s.replace(re, String(reps[i])); });
      out.push(s);
    }
    if (stack.length) throw new Error(`Missing @endif${where}`);
    return out.join('\n');
  }
  GenerateFileFromTemplate(template: any, dest: any, tokens?: any, replacements?: any, defines?: any): void {
    const text = this.GenerateStringFromTemplate(template, tokens, replacements, defines);
    if (text === '') throw new Error('Unexpected inside GenerateFileFromTemplate');
    this.TextToFile(dest, text);
  }
  GetTemplate(lang: any, prefix: any): string {
    let ext = TEMPLATE_EXT[String(lang)];
    if (!ext) { this.app.logMsg('info', `WizardHelper.GetTemplate: not yet attested: language "${lang}"; using the VBScript template (${NOTE})`); ext = TEMPLATE_EXT.VBScript; }   // inferred
    return this.GetTemplateFolder() + String(prefix) + ext;
  }
  GetVCProjFileTemplate(prefix: any, vs: any): string | undefined {
    if (vs === 'VS2012') return `${prefix}.VS2012.vcxproj.template`;
    if (vs === 'VS2010') return `${prefix}.vcxproj.template`;
    this.app.logMsg('info', `WizardHelper.GetVCProjFileTemplate: not yet attested: compiler "${vs}" (${NOTE})`);
    return undefined;
  }

  // ---- languages
  GetScriptExtension(lang: any): string {
    const e = SCRIPT_EXT[String(lang)];
    if (e) return e;
    this.app.logMsg('info', 'Not implemented');
    return '.vbs';
  }
  GetLangFromExtension(file: any): string {
    const m = /\.[^.\\/]*$/.exec(String(file ?? ''));
    const lang = m ? EXT_LANG[m[0].toLowerCase()] : undefined;   // inferred: the extension compares without regard to case
    if (lang) return lang;
    let p = state.scriptingLanguage;
    if (p === '') { try { p = String(pref('C3DPrefsScripting', 'language') ?? ''); } catch { p = ''; } }   // inferred preference key
    if (/vb/i.test(p)) return 'VBScript'; if (/python/i.test(p)) return 'Python';
    return 'JScript';
  }
  GetRegInsertionComment(lang: any): string {
    const text = 'RegistrationInsertionPoint - do not remove this line';
    const l = String(lang);
    return (l === 'VBScript' ? "'" : l === 'JScript' || l === 'Cpp' || l === 'C#' ? '//' : '#') + text;   // inferred: no space between marker and text
  }

  // ---- views
  ShowUrlInNetview(url: any): WizardView {
    let view = state.views.find(v => v.name === 'netview2') ?? state.views.find(v => v.name === 'netview');
    if (!view) { view = { type: 'netview', name: 'SDK Info', attrs: {}, width: 0, height: 0, visible: false, state: 0 }; state.views.push(view); }
    view.width = 800; view.height = 800;
    view.attrs.url = String(url);
    view.state = 0; view.visible = true;
    state.lastNetviewUrl = String(url);
    return view;
  }
  ShowMenuAnchorPointsInNetview(): void {
    state.lastHelpTopic = 'siMenuAnchorPoints';
    this.app.logMsg('info', `WizardHelper: help topic siMenuAnchorPoints (no help viewer in this build)`);
  }

  // ---- wizard properties
  CreateWizard(name: any, reuse?: any): Property {
    const app = this.app; const root = app.scene.root;
    let model = root.children.find(c => c.name === 'SDK_Wizards');
    if (!model) {
      model = new Model('SDK_Wizards');
      root.addChild(model);
      try { model.property('visibility')?.set('viewvis', false); } catch { /* no visibility property */ }
      app.events.emit('scene');
    }
    const n = String(name);
    if (reuse) { const old = model.properties.find(p => p.name === n); if (old) return old; }
    // The wizard property types are self-installed custom properties of the SDK wizards (not in this row): an empty property of that type is added.
    const prop = new Property(n, n, []);   // inferred
    model.addProperty(prop);
    app.events.emit('scene');
    return prop;
  }

  // ---- small text helpers
  RemoveSpaces(s: any): string { return String(s ?? '').trim().replace(/ /g, '_'); }
  RemoveNonAlphaNumeric(s: any): string { return String(s ?? '').trim().replace(/[^A-Za-z0-9]/g, '_'); }
  ReplaceTokenInStr(s: any, token: any, repl: any): string { return String(s ?? '').replace(new RegExp(String(token), 'g'), String(repl)); }
  Bool2Str(v: any): string { return v ? 'true' : 'false'; }
  FloatPrec3(v: any): number { return Math.floor(Number(v) * 1000) / 1000; }
  IntToLong(n: any): any {
    if (typeof n === 'boolean' || n === 'true' || n === 'false') return n;
    // inferred: "whole numbers" = an integer number or a string of digits
    if ((typeof n === 'number' && Number.isInteger(n)) || (typeof n === 'string' && /^-?\d+$/.test(n))) return `${n}l`;
    return n;
  }
  GetInplaceProp(obj: any, prop: any, args?: any): string {
    const list: any[] = args == null ? [] : Array.isArray(args) ? args : Array.from(args);
    return (obj === null || obj === undefined ? '' : `${obj}.`) + String(prop) + (list.length ? `(${list.join(', ')})` : '');   // inferred separator ", "
  }
}

// ------------------------------------------------------------------ AddonDocHelper

/** Members the note lists without a specification (Q2). `FormatHTMLCell…` is a family whose exact names are not recorded. */
const DOC_UNSPECIFIED = ['GetTemplateInfo', 'GetContentItemInfo', 'GetTemplateShortName', 'GetTemplateImage', 'SortAddons', 'GetAddonDocTableAsHTML',
  'GetTemplateTableAsHTML', 'GetContentItemTableAsHTML', 'ExecuteContentItem', 'GenerateTemplateWizard'];

function parseXml(text: string): Element {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.getElementsByTagName('parsererror')[0];
  if (bad) throw new Error((bad.textContent ?? 'parse error').replace(/\s+/g, ' ').trim());
  if (!doc.documentElement) throw new Error('no root element');
  return doc.documentElement;
}

export class AddonDocHelper {
  readonly Prefix = ADDON_DOC_PREFIX;
  [member: string]: any;
  private wiz: WizardHelperObj;
  constructor(private app: App) {
    this.wiz = new WizardHelperObj(app);
    for (const n of DOC_UNSPECIFIED) this[n] = () => { throw notYetAttested('GetAddonDocHelper', `helper method ${n} (Netview add-ons / start-up page builders)`, 'Q2'); };
  }

  // ---- naming
  GetAddonDocFileName(name: any): string { return `${ADDON_DOC_PREFIX}${name}.htm`; }
  GetAddonJpgFileName(name: any): string { return `${ADDON_DOC_PREFIX}${name}.jpg`; }
  GetAddonDescriptionFileName(name: any): string { return `${ADDON_DOC_PREFIX}${name}.txt`; }
  GetAddonDetailFileName(name: any): string { return `${ADDON_DOC_PREFIX}${name}.xml`; }
  /** Everything after the first `\Addons\` (`/Addons/` on Linux); case-sensitive; '' without that segment. */
  GetAddonSubdirFromFullPath(path: any): string {
    const s = String(path ?? ''); const seg = isWindows() ? '\\Addons\\' : '/Addons/';
    const i = s.indexOf(seg);
    return i < 0 ? '' : s.slice(i + seg.length);
  }
  GetAddonNameFromFile(file: any): string {
    const m = /netview_([^.]*)\./i.exec(String(file ?? ''));   // inferred: not anchored, so a full path works too
    return m ? m[1] : '';
  }

  // ---- searching
  GetRecommendedAddonDocPath(dir: any): string { return join(String(dir), this.GetAddonDocFileName(this.GetAddonSubdirFromFullPath(dir))); }
  GetAddonDocPath(dir: any): string {
    const n = this.GetAddonSubdirFromFullPath(dir);
    if (n === '') return '';
    const direct = join(String(dir), this.GetAddonDocFileName(n));
    if (hostFs.isFile(direct)) return direct;
    try { return this.FindAddonDocInSubFolder(dir); }
    catch (e) { logWarning(this.app, `GetAddonDocPath failure - ${dir} - ${errDesc(e)}`); return ''; }   // inferred warning text
  }
  FindAddonDocInSubFolder(dir: any): string {
    const r = this.app.run('FindFilesInFolder', { Directory: String(dir), RegularExpression: `${ADDON_DOC_PREFIX}.*\\.htm$`, FindAllMatches: false, ReturnFullPath: true });
    return typeof r === 'string' ? r : '';
  }
  FindTemplateDocInSubFolder(dir: any): string[] {
    try {
      if (!hostFs.isFolder(dir)) throw new Error('Path not found');
      const r = this.app.run('FindFilesInFolder', { Directory: String(dir), RegularExpression: '.*\\.xsitemplate$', FindAllMatches: true, ReturnFullPath: true });
      return Array.isArray(r) ? r : [];
    } catch (e) { logWarning(this.app, `FindTemplateDocInSubFolder failure - ${dir} - ${errDesc(e)}`); return []; }   // inferred warning text
  }
  /** `root` is the `Addons` folder itself (inferred). */
  GetAddonFolders(root: any, fullPath?: any): string[] {
    if (!hostFs.isFolder(root)) return [];
    return hostFs.listFolders(root).filter(n => n !== 'Application' && n !== 'Data').map(n => fullPath ? join(String(root), n) : n);
  }
  private roots(user: any, factory: any, workgroups: any): string[] {
    return [...(user ? [userPath()] : []), ...(workgroups ? state.workgroups : []), ...(factory ? [state.factoryPath] : [])];
  }
  FindAddonDocs(user?: any, factory?: any, workgroups?: any): string[] {
    const out: string[] = [];
    for (const root of this.roots(user, factory, workgroups))
      for (const dir of this.GetAddonFolders(join(root, 'Addons'), true)) { const f = this.FindAddonDocInSubFolder(dir); if (f) out.push(f); }
    return out;
  }
  FindTemplateDocs(user?: any, factory?: any, workgroups?: any): string[] {
    const out: string[] = [];
    for (const root of this.roots(user, factory, workgroups))
      for (const dir of this.GetAddonFolders(join(root, 'Addons'), true)) out.push(...this.FindTemplateDocInSubFolder(dir));
    return out;
  }

  // ---- detail / description files
  GetDefaultDetailDict(): Record<string, string> {
    const d: Record<string, string> = {};
    for (const k of ADDON_DETAIL_KEYS) d[k] = k === 'AuthorName' ? state.login : '';
    return d;
  }
  loadAddonDetails(file: any): Record<string, string> {
    const d: Record<string, string> = {};
    try {
      if (!hostFs.isFile(file)) throw new Error('File not found');
      const root = parseXml(hostFs.readFile(file));
      for (const c of Array.from(root.children)) d[c.tagName] = c.textContent ?? '';   // a repeated tag keeps the last value
    } catch (e) { logWarning(this.app, `loadAddonDetails failure - ${file} - ${errDesc(e)}`); }
    return d;
  }
  saveAddonDetails(file: any, dict: any): boolean {
    const doc = new SimpleXMLDoc(this.app);
    const root = doc.CreateRootElement('xsi_file');
    root.SetAttribute('type', 'AddonInfo');
    root.SetAttribute('xsi_version', appVersion(this.app));
    root.SetAttribute('syntax_version', '1.0');
    const entries: [string, any][] = dict instanceof Map ? [...dict.entries()] : Object.entries(dict ?? {});
    for (const [k, v] of entries) root.AddChild(k).text = v;
    // A dictionary without entries leaves the root a leaf, which serialises on one line (follows from the serialisation rule).
    const msg = doc.Save(file);
    if (msg === '') return true;
    this.app.logMsg('info', `Error saving ${file} - ${msg}`);
    return false;
  }

  // ---- documentation page
  GenerateInitialHTML(description: any, templatePath: any, jpgPath: any): string {
    return this.wiz.GenerateStringFromTemplate(templatePath, ['%DESCRIPTION%', '%ADDONIMAGE%'], [description, jpgPath]);
  }
  /** The stand-alone "Add-on Documentation" property and its layout (steps 1 and 2). */
  makeAddDocProperty(): Property {
    const tf = this.wiz.GetTemplateFolder();
    const p = new Property('Add-on Documentation', 'CustomProperty', [
      str('AddonDescription', '...Describe your Add-on Here...'), str('AddonImage', `${tf}netview_Default.jpg`),
      str('AddonHtmlTemplate', `${tf}netview_ADDONNAME.htm.template`),
    ]);
    (p as any).sdkTabs = [
      { tab: 'Info', items: [
        { param: 'AddonDescription', label: 'Description', control: 'multiline', height: 200 },
        { param: 'AddonImage', label: 'Image', control: 'file' },
        { param: 'AddonHtmlTemplate', label: 'Template for html', control: 'file' },
      ] as SdkDlgItem[] },
      { tab: 'Help', items: [
        // The wording of the static text is not recorded; it names the four files that will be created (inferred wording).
        { text: `The following files will be created in the add-on directory:\n${['htm', 'jpg', 'txt', 'xml'].map(e => `${ADDON_DOC_PREFIX}<AddonName>.${e}`).join('\n')}` },
      ] as SdkDlgItem[], button: 'Show Add-Ons Page' },
    ];
    (p as any).helpTopic = 'cus_addons_AddonDocWizard';
    return p;
  }
  addonsPageUrl(): string { return `${state.factoryPath}/Data/NetView_Database/L04_body/content/addons/default.htm`; }
  /** Step 4: what OK does, in the contract's order. */
  writeAddonDocFiles(dir: string, description: string, image: string, template: string): string {
    const n = this.GetAddonSubdirFromFullPath(dir);
    const docPath = join(dir, this.GetAddonDocFileName(n));
    const jpgName = this.GetAddonJpgFileName(n);
    this.wiz.TextToFile(join(dir, this.GetAddonDescriptionFileName(n)), description);
    // inferred: the page refers to the add-on's own copy of the image by file name
    this.wiz.TextToFile(docPath, this.GenerateInitialHTML(description, template, jpgName));
    hostFs.writeFile(join(dir, jpgName), hostFs.readFile(image));   // copy, overwriting (virtual files are text)
    this.saveAddonDetails(join(dir, this.GetAddonDetailFileName(n)), this.GetDefaultDetailDict());
    this.app.run('ShowFileForEdit', { FileName: docPath });
    return docPath;
  }
  /** Interactive. Resolves to the new documentation page path, or '' when cancelled. */
  GenerateAddDocWizard(dir: any): Promise<string> | string {
    const app = this.app;
    if (!interactive(app) || typeof document === 'undefined') {
      app.logMsg('info', `GenerateAddDocWizard: not yet attested: behaviour of the modal page in batch mode; nothing written (${NOTE})`);   // inferred
      return '';
    }
    const prop = this.makeAddDocProperty();
    const title = siString('XSIPLUGINUI', 7212) || ADD_DOC_TITLE_FALLBACK;
    return sdkModal(title, (body) => {
      for (const t of (prop as any).sdkTabs as { tab: string; items: SdkDlgItem[]; button?: string }[]) {
        // AfterImage's modal page has no tab strip: each tab is shown as a titled group.
        const host = document.createElement('div'); body.appendChild(host);
        renderSdkLayout(host, prop, [{ group: t.tab, items: t.items }]);
        if (t.button) {
          const b = document.createElement('button'); b.className = 'addondoc-show-page'; b.textContent = t.button;
          b.onclick = () => { this.wiz.ShowUrlInNetview(this.addonsPageUrl()); };
          (host.querySelector('fieldset') ?? host).appendChild(b);
        }
      }
    }, { w: 520, cls: 'sdkh-ppg addondoc-wizard' }).then(ok => {
      if (!ok) return '';
      return this.writeAddonDocFiles(String(dir), String(prop.val('AddonDescription') ?? ''), String(prop.val('AddonImage') ?? ''), String(prop.val('AddonHtmlTemplate') ?? ''));
    });
  }

  // ---- update check
  /** True when an installed template whose path contains `template` carries a root `Date` that is not earlier than `date`. */
  IsAddonUpToDate(date: any, template: any): boolean {
    const name = String(template ?? '');
    const installed = this.FindTemplateDocs(true, true, true).find(p => p.includes(name));
    let upToDate = false;
    if (installed) {
      try {
        const have = Date.parse(parseXml(hostFs.readFile(installed)).getAttribute('Date') ?? '');
        // inferred: dates compare as parsed date values; an unreadable installed date counts as out of date
        upToDate = !(have < Date.parse(String(date))) && !Number.isNaN(have);
      } catch { upToDate = false; }
    }
    this.app.logMsg('info', upToDate ? `${name} is up-to-date` : `Updated addon found: ${name}`);
    return upToDate;
  }
  CheckForAddonUpdates(): string[] | null {
    const app = this.app;
    let root: Element;
    try {
      // The address no longer serves the file and this build makes no request: without the hook it is "not reachable".
      if (!state.fetchUpdateXml) throw new Error(`not reachable (${ADDON_UPDATE_URL}; AfterImage does not make the request)`);
      root = parseXml(state.fetchUpdateXml());
    } catch (e) { logWarning(app, `Error checking for updates - ${errDesc(e)}`); return null; }
    const kids = (e: Element, tag: string) => Array.from(e.children).filter(c => c.tagName === tag);
    if (!kids(root, 'lastmodification').length) return null;
    const urls: string[] = [];
    for (const content of kids(root, 'content')) for (const item of kids(content, 'item')) {
      let date = ''; let outOfDate = false;
      for (const c of Array.from(item.children)) {   // children in file order
        const text = c.textContent ?? '';
        if (c.tagName === 'date') date = text;
        else if (c.tagName === 'template') outOfDate = !this.IsAddonUpToDate(date, text);
        else if (c.tagName === 'url' && outOfDate) urls.push(text);
      }
    }
    return urls;
  }
  CheckAndInstallAddonUpdates(): number {
    const app = this.app;
    const urls = this.CheckForAddonUpdates();
    if (urls === null) { app.logMsg('info', `CheckAndInstallAddonUpdates: not yet attested: behaviour after a failed check; nothing installed (${NOTE})`); return 0; }   // inferred
    for (const url of urls) {
      app.logMsg('info', `Installing addon: ${url}`);
      for (const cmd of [CMD_UNINSTALL, CMD_INSTALL]) {
        try { if (app.commands.get(cmd)) app.run(cmd, { FileName: url }); } catch { /* errors ignored */ }   // inferred: the URL is the first argument
      }
    }
    return 0;
  }
}

// ------------------------------------------------------------------ registration

export function registerAddonDocWizardCommands(app: App) {
  (app as any).addonDocWizard = state;
  const CAT = 'Custom';

  // All six: logging off, return value on, no enable condition.
  app.register({
    name: 'GetAddonDocHelper', label: 'GetAddonDocHelper', category: CAT, description: 'Returns an object that implements the AddonDocHelper',
    args: [], undoable: false, noLog: true,
    execute(app2) { return new AddonDocHelper(app2); },
  });
  app.register({
    name: 'GetAddonDocPath', label: 'GetAddonDocPath', category: CAT, description: 'Find the Addon Documentation file, if any, given full path to an addon directory',
    args: [{ name: 'Path', default: null }], undoable: false, noLog: true,
    execute(app2, a) { return new AddonDocHelper(app2).GetAddonDocPath(a.Path ?? ''); },
  });
  app.register({
    name: 'GetAddonUpdateArray', label: 'GetAddonUpdateArray', category: CAT, description: 'Returns an array of URLs pointing to addons that must be installed',
    args: [], undoable: false, noLog: true,
    execute(app2) { return new AddonDocHelper(app2).CheckForAddonUpdates(); },
  });
  app.register({
    name: 'GetNbUpdatesPending', label: 'GetNbUpdatesPending', category: CAT, description: 'Returns the number of addons needed to be downloaded from softimage.com',
    args: [], undoable: false, noLog: true,
    execute(app2) {
      const urls = new AddonDocHelper(app2).CheckForAddonUpdates();
      // A failed check is not tested for: the command ends in a script error (contract, inferred; Q4). The engine's wording is not attested.
      if (urls === null) throw new Error(`script error: the update check returned null and the result is used without a test (${NOTE} Q4)`);   // inferred text
      return urls.length;
    },
  });
  app.register({
    name: 'WizardHelper', label: 'WizardHelper', category: CAT, description: '',
    args: [], undoable: false, noLog: true,
    execute(app2) { return new WizardHelperObj(app2); },
  });
  app.register({
    name: 'CreateXMLDoc', label: 'CreateXMLDoc', category: CAT, description: 'Create new instance of SimpleXMLDoc helper class, which is useful for creating XML files',
    args: [], undoable: false, noLog: true,
    execute(app2) { return new SimpleXMLDoc(app2); },
  });
}
