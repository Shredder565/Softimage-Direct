// SDK helper commands (ledger row CMD-01b): the 17 commands Softimage ships as four script plug-ins.
// Brief: docs/ghidra/cmd-01b-sdk-helpers.md, "Wire contract". Original code written from that contract only.
//
//   SDKHelpers                      ShowFileForEdit, ShowFileInShaderCodeEditor, CreateAddonDirectories,
//                                   CreateWorkgroupDirectories, PackageAddon, PackageAddonUI, SpdlCheck, FindFilesInFolder
//   SDKVBHelpers                    XSIInputBox, StringSearch, TrimString, XSIRound
//   Global Script Variable Support  GetGlobal, SetGlobal, SetGlobalObject
//   SimplePropertiesPlugin          LargeMsgBox, PickFolder
//
// How this build differs from a Softimage session, and why:
//
//  * File system. The renderer has no file-system bridge, so every folder / file operation runs against the
//    session's VIRTUAL host file system (src/core/sdkHelpersHostFs.ts, attached as `app.hostFs`). Real disk
//    access is a later ledger row. Installation paths 1 (user) and 5 (user add-ons) are documented defaults
//    in `app.sdkHelpers.paths` (inferred).
//  * Processes. Nothing can be launched from the renderer. `app.sdkHelpers.launchProcess` is an optional hook
//    `(commandLine, blocking) => void`; without it the external editor of ShowFileForEdit fails the way the
//    contract describes a failed launch (warning, then the built-in editor), and SpdlCheck raises
//    NotYetAttested at its run step (Q3 / Q8).
//  * Interactive vs batch. `app.Interactive` (default true) stands for Application.Interactive. The batch
//    branches are synchronous and follow the contract exactly. The interactive branches of XSIInputBox,
//    LargeMsgBox, PickFolder and PackageAddonUI open a modal page (src/ui/sdkHelpersModal.ts) and therefore
//    return a Promise of the documented result, because the command bus is synchronous and cannot block.
//  * Editor views. The layout has no text / script / shader editor view with `files` / `filename` attributes,
//    so ShowFileForEdit and ShowFileInShaderCodeEditor run their steps over a small editor-view model
//    (`app.sdkHelpers.views`); a new view also opens a plain floating window showing the virtual file's text.
//    The `files` attribute format is open question Q6 (modelled as a `;` separated list, inferred).
//  * Log severities. The script log here knows 'info' and 'error'. Warnings are logged as info with the prefix
//    "WARNING : ". Verbose messages are kept in `app.sdkHelpers.verbose` and reach the log only when the
//    Scripting preference "Log Verbose Messages" (or `app.verboseLog`) is on.
//  * Not attested, left as "not yet attested": add-on detail / description files (Q10), dialog title id 1532
//    (Q2), the .xsiaddon content (SYS-13; a placeholder manifest text is written so file counts are testable).
import { App } from '../core/commands';
import { Property } from '../core/scene';
import { str, bool } from '../core/params';
import { siString } from '../ui/si';
import { siMsgBox } from '../ui/msgBox';
import { openFloating, type Floating } from '../ui/floating';
import { pref } from '../ui/prefs';
import { hostFs, HostFs, HOSTFS_SEP } from '../core/sdkHelpersHostFs';
import { sdkModal, sdkMsgBox, renderSdkLayout, type SdkDlgItem } from '../ui/sdkHelpersModal';
import { makeTextProp } from './simpleProperties';
import { NotYetAttested } from './fbx';

const NOTE = 'docs/ghidra/cmd-01b-sdk-helpers.md';

// ------------------------------------------------------------------ translated messages (XSISCRIPTS)
// The committed strings table lost some of these ids (ledger row TOOL-01), so the attested English text is the fallback.
const XSISCRIPTS_TEXT: Record<number, string> = {
  1190: 'This is a compiled C++ plug-in.\n\nTo edit this plug-in it is necessary to load \nthe original source code rather than the .dll or .so file.',
  1191: 'No addon directory specified',
  1192: 'Source Add-on Directory does not exist',
  1193: 'Source directory must be a directory within the Addons folder',
  1194: 'Spdlcheck only works on files with the .spdl extension',
};
export function sdkHelpersText(id: number): string { return siString('XSISCRIPTS', id) ?? XSISCRIPTS_TEXT[id] ?? ''; }
/** Id 1532 is not in the English dictionary (Q2). This title is a stand-in, not an attested string. */
export const PACKAGE_UI_TITLE_FALLBACK = 'Package Add-on';   // inferred

// ------------------------------------------------------------------ session state

/** One editor view of the active layout, as far as the two "show file" commands need it (model only, Q6). */
export class SdkEditorView {
  visible = false;
  /** View state; 0 = siNormal. */
  state = 0;
  attrs: Record<string, string> = {};
  window: Floating | null = null;
  constructor(public type: string, public name: string) {}
  /** `files` is modelled as a `;` separated list of the files open in the view (inferred, Q6). */
  getAttr(name: string): string { return this.attrs[name] ?? ''; }
  setAttr(name: string, value: any) {
    const v = String(value);
    this.attrs[name] = v;
    if (name === 'filename') {   // setting `filename` is what loads the file
      const files = this.attrs.files ? this.attrs.files.split(';') : [];
      if (!files.some(f => f.toLowerCase() === v.toLowerCase())) files.push(v);
      this.attrs.files = files.join(';'); this.attrs.activetab = v;
    }
  }
}

export interface SdkProgress { visible: boolean; caption: string; cancelEnabled: boolean; maximum: number; step: number; value: number; status: string[] }

export interface SdkHelpersState {
  /** GetGlobal / SetGlobal store. Lives for the session; New Scene does not touch it. */
  globals: Map<string, any>;
  /** Installation paths by Softimage id: 1 = user path, 5 = user add-on path. */
  paths: Record<number, string>;
  /** "Win64" | "Win32" | anything else (linux). */
  platform: string;
  views: SdkEditorView[];
  createView(type: string, name: string, visible?: boolean): SdkEditorView;
  /** Optional process launcher `(commandLine, blocking)`. Absent in this build: launching throws. */
  launchProcess: ((commandLine: string, blocking: boolean) => void) | null;
  lastLaunch: string | null;
  verbose: string[];
  progress: SdkProgress;
  /** PackageAddonUI's remembered "Directories to Exclude". */
  excludeDirs: string;
}

// inferred: the user path of a default Softimage 2015 SP2 install for a Windows user named "user".
const DEFAULT_USER_PATH = 'C:\\Users\\user\\Autodesk\\Softimage_2015_SP2';

const state: SdkHelpersState = {
  globals: new Map(),
  paths: { 1: DEFAULT_USER_PATH, 5: DEFAULT_USER_PATH + '\\Addons' },   // inferred
  platform: 'Win64',
  views: [],
  createView(type, name, visible = false) { const v = new SdkEditorView(type, name); v.visible = visible; state.views.push(v); return v; },
  launchProcess: null,
  lastLaunch: null,
  verbose: [],
  progress: { visible: false, caption: '', cancelEnabled: true, maximum: 100, step: 1, value: 0, status: [] },
  excludeDirs: 'src;Debug;Ship',
};
export { state as sdkHelpersState, hostFs };

const interactive = (app: App) => (app as any).Interactive !== false;
const logWarning = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);
function logVerbose(app: App, text: string) {
  state.verbose.push(text); if (state.verbose.length > 500) state.verbose.shift();
  let on = (app as any).verboseLog === true; try { on = on || pref('C3DPrefsScripting', 'msglogverbose') === true; } catch { /* prefs not built */ }
  if (on) app.logMsg('info', `VERBOSE : ${text}`);
}
const errDesc = (e: any): string => String(e?.description ?? e?.message ?? e);
function notYetAttested(command: string, what: string, question: string): NotYetAttested {
  const e = new NotYetAttested(command, what, question);
  e.message = `not yet attested: ${what} (${command}; ${NOTE} ${question})`;   // NotYetAttested names the FBX note by default
  return e;
}
function launch(commandLine: string, blocking: boolean) {
  state.lastLaunch = commandLine;
  if (!state.launchProcess) throw new Error('process launching is not available in this build');
  state.launchProcess(commandLine, blocking);
}

// ------------------------------------------------------------------ VBScript semantics (SDKVBHelpers)

/** VBScript string coercion of a command argument; null / undefined is Null. */
const vbStr = (v: any): string | null => v === null || v === undefined ? null : typeof v === 'boolean' ? (v ? 'True' : 'False') : String(v);

/** Round half to even, robust to binary floating point (VBScript Round / CLng). */
export function vbRound(x: number, decimals = 0): number {
  if (!Number.isFinite(x)) return x;
  const scale = Math.pow(10, decimals);
  const v = x * scale;
  if (!Number.isFinite(v)) return x;
  const lo = Math.floor(v);
  const frac = v - lo;
  let eps = 1e-9 * Math.max(1, Math.abs(v));   // binary noise allowance around the half-way point
  if (eps > 0.25) eps = 0;                     // numbers too large to carry a fraction
  let r: number;
  if (Math.abs(frac - 0.5) <= eps) r = lo % 2 === 0 ? lo : lo + 1;   // tie: the even neighbour
  else r = frac < 0.5 ? lo : lo + 1;
  const out = r / scale;
  return out === 0 ? 0 : Number(out.toPrecision(15));
}

/** VBScript `InStr(start, s1, s2, mode) - 1` for StringSearch. Returns null for Null. */
export function vbStringSearch(target: any, search: any, caseSensitive: any, startPos: any): number | null {
  if (startPos === null || startPos === undefined) throw new Error("Invalid use of Null: 'InStr'");
  const n = Number(startPos);
  if (!Number.isFinite(n)) throw new Error("Type mismatch: 'InStr'");
  const start = vbRound(n) + 1;                       // int4 argument, then InStr's 1-based start
  if (start < 1) throw new Error("Invalid procedure call or argument: 'InStr'");
  const s1 = vbStr(target), s2 = vbStr(search);
  if (s1 === null || s2 === null) return null;        // Null propagates
  if (s1.length === 0) return -1;
  if (start > s1.length) return -1;                   // inferred precedence: a start beyond the end wins over an empty SearchStr
  if (s2.length === 0) return start - 1;
  const binary = !(caseSensitive === false || caseSensitive === 0 || caseSensitive === 'False' || caseSensitive === 'false');
  const i = binary ? s1.indexOf(s2, start - 1) : s1.toLowerCase().indexOf(s2.toLowerCase(), start - 1);
  return i;                                           // indexOf already yields -1 for "not found"
}

/** VBScript LTrim / RTrim / Trim: space characters only. */
export function vbTrim(s: string, left: boolean, right: boolean): string {
  let a = 0, b = s.length;
  if (left) while (a < b && s.charCodeAt(a) === 32) a++;
  if (right) while (b > a && s.charCodeAt(b - 1) === 32) b--;
  return s.slice(a, b);
}
const truthy = (v: any) => !(v === false || v === 0 || v === null || v === undefined || v === '' || v === 'False' || v === 'false');

// ------------------------------------------------------------------ folder helpers (SDKHelpers)

const binFolder = () => state.platform === 'Win64' ? 'nt-x86-64' : state.platform === 'Win32' ? 'nt-x86' : 'linux';
/** The standard sub-folders of an add-on / workgroup, in creation order. */
export function sdkStandardSubFolders(): string[] {
  return [
    'Application/Plugins', 'Application/layouts', 'Application/toolbars', 'Application/views', 'Application/spdl',
    `Application/bin/${binFolder()}`,
    'Data/Scripts', 'Data/Preferences/Keymaps', 'Data/DSPresets/Operators',
    'Data/DSPresets/Shaders/Realtime', 'Data/DSPresets/Shaders/Texture', 'Data/DSPresets/Shaders/Geometry',
    'Data/DSPresets/Shaders/Light', 'Data/DSPresets/Shaders/Lens', 'Data/DSPresets/Shaders/Volume',
  ];
}
function createStandardTree(fs: HostFs, root: string): string {
  try { fs.ensureFolder(root); } catch (e) { return `Problem creating directory\n${root}\n${errDesc(e)}`; }
  for (const sub of sdkStandardSubFolders()) fs.ensureFolder(fs.join(root, sub));   // a failure here is not caught: command error
  return '';
}

// ------------------------------------------------------------------ PackageAddon

function packageAddon(app: App, a: Record<string, any>): string {
  const fs = hostFs;
  const fail = (msg: string) => { app.logMsg('error', msg); return msg; };
  const pb = state.progress;
  try {
    const t0 = Date.now();
    // 1. source
    let src = String(a.SrcDir ?? '');
    if (!fs.isFolder(src)) {
      src = fs.join(fs.join(state.paths[1], 'Addons'), src);
      if (!fs.isFolder(src)) return fail(`no such folder: ${src}`);
    }
    src = src.replace(/[\\/]+$/, '');
    const parent = fs.parentPath(src);
    if (fs.baseName(parent).toLowerCase() !== 'addons') return fail('Invalid Source Directory argument - must be a directory within the Addons folder');
    const subDir = fs.baseName(src);
    // 2. destination
    const given = String(a.DestinationPath ?? '');
    let dest: string;
    if (given === '') dest = parent + subDir;          // as the script reads: NO separator (…\AddonsMyTool). Q9.
    else if (fs.isFolder(given)) dest = fs.join(given, subDir);
    else dest = given;
    if (!/\.xsiaddon$/i.test(dest)) dest += '.xsiaddon';
    if (fs.exists(dest)) {
      if (truthy(a.Overwrite)) { try { fs.deleteFile(dest); } catch { return fail(`Failed to delete existing file ${dest}`); } }
      else return fail(`File already exists ${dest}`);
    } else {
      try { fs.ensureFolder(fs.parentPath(dest)); } catch (e) { return fail(`Unable to create destination directory - ${errDesc(e)}`); }
    }
    // 3. exclusions: folder NAMES, split on ';', no trimming, no wildcards, case ignored
    const ex = a.ExcludeDirs === null || a.ExcludeDirs === undefined || a.ExcludeDirs === '' ? [] : String(a.ExcludeDirs).split(';').map(s => s.toLowerCase());
    // 4. details: the detail / description file names come from the AddonDoc helper, which is not attested (Q10)
    logVerbose(app, `PackageAddon: not yet attested: add-on detail and description files are not read (${NOTE} Q10)`);
    // 5.
    app.logMsg('info', `Packaging: ${src}`);
    app.logMsg('info', `Destination: ${dest}`);
    // 6.
    Object.assign(pb, { visible: true, caption: 'Packaging Addon', cancelEnabled: false, maximum: 200000, step: 1, value: 0, status: [] });
    const status = (s: string) => { pb.status.push(s); pb.value += pb.step; };
    // 7. depth first: the files of a folder, then each sub-folder that is not excluded
    const items: { path: string; targetDir: string }[] = [];
    const walk = (dir: string, rel: string) => {
      for (const f of fs.listFiles(dir)) { const p = fs.join(dir, f); items.push({ path: p, targetDir: rel }); status(`\tadding: ${p}`); }
      for (const d of fs.listFolders(dir)) {
        const p = fs.join(dir, d);
        if (ex.includes(d.toLowerCase())) { status(`Skipping ${p}`); continue; }
        walk(p, rel + HOSTFS_SEP + d);
      }
    };
    walk(src, '');
    // 8.
    if (!items.length) return fail('No .xsiaddon file was created because no files were found to package');
    // 9. + 10. The real .xsiaddon content is produced by the application's add-on object (SYS-13). Until that
    // row is wired a placeholder manifest (plain text) is written so the result is observable.
    status('Compressing and saving to disk');
    try {
      const manifest = ['AfterImage placeholder .xsiaddon manifest (content format: SYS-13, not yet attested)',
        `DefaultInstallationPath=${state.paths[5]}`, `SubDirectory=${subDir}`, `Files=${items.length}`,
        ...items.map(i => `other\t${i.path}\t${i.targetDir}`)].join('\n');
      fs.writeFile(dest, manifest);
    } catch (e) { return fail(`Error saving addon - ${errDesc(e)}`); }
    // 11. (the number format of the seconds is not attested; plain seconds are used — inferred)
    app.logMsg('info', `Packaging of ${items.length} files complete (${(Date.now() - t0) / 1000} seconds)`);
    return '';
  } catch (e) {
    return `Unexpected error packaging addon - ${errDesc(e)}`;   // not logged
  } finally {
    pb.visible = false;
  }
}

// ------------------------------------------------------------------ PackageAddonUI

/** The stand-alone `PackageLocationOptions` property and its layout (contract steps 2 and 3). */
export function makePackageLocationOptions(source: string, destination: string): Property {
  const p = new Property('PackageLocationOptions', 'CustomProperty', [
    str('Source', source), str('Destination', destination), bool('Overwrite', true, 'Overwrite', { animatable: false }),
    str('ExcludeDir', state.excludeDirs), str('Platforms', ''), str('AuthorName', ''), str('AuthorEmail', ''),
    str('Company', ''), str('URL', ''), str('Description', ''),
  ]);
  const layout: SdkDlgItem[] = [
    { text: 'Use this dialog to build an .xsiaddon file containing all the files\nat the Source directory, including subdirectories.' },
    { spacer: true },
    { group: 'Input', items: [{ param: 'Source', label: 'Source', control: 'folder' }, { param: 'ExcludeDir', label: 'Directories to Exclude' }] },
    { group: 'Output', items: [{ param: 'Destination', label: 'Destination', control: 'file', filter: 'xsiaddon (*.xsiaddon)|*.xsiaddon||' }, { param: 'Overwrite', label: 'Overwrite existing .xsiaddon' }] },
    { group: 'Author', items: [{ param: 'AuthorName', label: 'Name' }, { param: 'AuthorEmail', label: 'Email' }, { param: 'Company' }, { param: 'URL' }] },
    { group: 'Description', items: [{ param: 'Description', control: 'multiline', height: 200, opts: ['NoLabel'] }] },
  ];
  (p as any).sdkLayout = layout;
  (p as any).helpTopic = 'cus_addons_PackageLocation';
  return p;
}

function packageAddonUI(app: App, a: Record<string, any>): any {
  const fs = hostFs;
  // siCannotBeUsedInBatch. The wording of Softimage's refusal is not attested (inferred text).
  if (!interactive(app)) throw new Error('this command cannot be used in batch mode');
  const given = String(a.Source ?? '');
  let source: string, destination: string;
  if (given === '') source = destination = state.paths[5];
  else {
    if (!fs.isFolder(given)) { app.logMsg('error', `PackageAddonUI - Problem with path argument ${given} : Path not found`); return undefined; }   // description text inferred
    source = given;
    destination = fs.join(fs.parentPath(given), fs.baseName(given)) + '.xsiaddon';
  }
  const prop = makePackageLocationOptions(source, destination);
  // 4. pre-fill from the source folder. The detail / description file names are not attested (Q10): nothing is read.
  const prefill = () => {
    logVerbose(app, `PackageAddonUI: not yet attested: add-on detail and description files are not read (${NOTE} Q10)`);
    app.run('SetGlobal', { in_VariableName: 'PackageAddon_DetailDict', in_Value: null });
  };
  prefill();
  // 5. title: id 1532 is missing from the English dictionary (Q2)
  let title = siString('XSISCRIPTS', 1532);
  if (!title) { title = PACKAGE_UI_TITLE_FALLBACK; logVerbose(app, `PackageAddonUI: not yet attested: dialog title id 1532 (${NOTE} Q2); using "${title}"`); }
  return (async () => {
    for (;;) {
      const ok = await sdkModal(title!, (body) => renderSdkLayout(body, prop, (prop as any).sdkLayout, (n) => { if (n === 'Source') prefill(); }), { w: 520, cls: 'sdkh-ppg sdkh-PackageLocationOptions' });
      if (!ok) return false;
      const src = String(prop.val('Source') ?? ''), dst = String(prop.val('Destination') ?? '');
      state.excludeDirs = String(prop.val('ExcludeDir') ?? '');
      const overwrite = !!prop.val('Overwrite');
      let bad = 0;
      if (src === '') bad = 1191;
      else if (!fs.isFolder(src)) bad = 1192;
      else if (fs.baseName(fs.parentPath(src.replace(/[\\/]+$/, ''))).toLowerCase() !== 'addons') bad = 1193;
      if (bad) { await sdkMsgBox(sdkHelpersText(bad), 'AfterImage', true); continue; }
      // 6. remember the author fields in the add-on's detail file: file name and format not attested (Q10)
      logVerbose(app, `PackageAddonUI: not yet attested: add-on detail and description files are not written (${NOTE} Q10)`);
      // 7. through the command bus, so it is logged
      const res = app.run('PackageAddon', { SrcDir: src, DestinationPath: dst, Overwrite: overwrite, ExcludeDirs: state.excludeDirs });
      if (res) await sdkMsgBox(String(res), 'AfterImage', true);
      // 8.
      app.run('SetGlobal', { in_VariableName: 'PackageAddon_DetailDict', in_Value: null });
      // 9. the script never sets its result to true
      return false;
    }
  })();
}

// ------------------------------------------------------------------ ShowFileForEdit / ShowFileInShaderCodeEditor

function openFileInView(view: SdkEditorView, file: string, line: number, parser?: string) {
  if (parser) view.setAttr('parser', parser);
  view.setAttr('filename', file);
  if (line > 0) view.setAttr('errorlinenum', line);
  view.state = 0; view.visible = true;
}
/** A new floating editor view. The window is AfterImage's own minimal read-only text view of the virtual file. */
function newEditorView(app: App, type: string): SdkEditorView {
  const view = state.createView(type, type);
  if (interactive(app) && typeof document !== 'undefined') {
    view.window = openFloating(type, (body) => {
      body.classList.add('sdkh-editor');
      const t = document.createElement('textarea'); t.readOnly = true; t.spellcheck = false;
      t.style.cssText = 'box-sizing:border-box;width:100%;height:260px;resize:none;font-family:monospace';
      const refresh = () => { const f = view.getAttr('filename'); try { t.value = f ? hostFs.readFile(f) : ''; } catch (e) { t.value = `(${f}: ${errDesc(e)} in the session's virtual host file system)`; } };
      (view as any).refresh = refresh; body.appendChild(t);
    }, { w: 520, cls: 'sdkh-editor-window' });
    const close = view.window.close;
    view.window.close = () => { close(); view.visible = false; view.window = null; const i = state.views.indexOf(view); if (i >= 0) state.views.splice(i, 1); };
  }
  return view;
}
function showFile(app: App, file: string, line: number, types: string[], newType: string, parser?: string): any {
  // 4. views of the active layout, type by type
  const views = types.flatMap(t => state.views.filter(v => v.type === t));
  // 5. both sides: backslashes to forward slashes, lower case; the file name is then a regular-expression pattern
  const pattern = new RegExp(file.replace(/\\/g, '/').toLowerCase());
  let firstVisible: SdkEditorView | null = null;
  for (const v of views) {
    if (!firstVisible && v.visible) firstVisible = v;
    const files = v.getAttr('files').replace(/\\/g, '/').toLowerCase();
    if (files.search(pattern) >= 0) {
      if (line > 0) v.setAttr('errorlinenum', line);
      v.setAttr('activetab', file);
      v.visible = true; v.window?.focus(); (v as any).refresh?.();
      return null;
    }
  }
  // 6. an existing visible view is reused, without the parser
  if (firstVisible) { openFileInView(firstVisible, file, line); (firstVisible as any).refresh?.(); return null; }
  // 7.
  const view = newEditorView(app, newType);
  openFileInView(view, file, line, parser);
  (view as any).refresh?.();
  return view;
}

function showFileForEdit(app: App, a: Record<string, any>): any {
  const file = String(a.FileName ?? '');
  const line = Number(a.LineNumber ?? -1);
  // 1.
  if (file === '') { app.logMsg('error', 'No file specified in call to ShowFileForEdit'); return undefined; }
  // 2. lower case only: ".DLL" passes
  if (file.endsWith('.dll') || file.endsWith('.so')) {
    const text = sdkHelpersText(1190);
    if (interactive(app) && typeof document !== 'undefined') siMsgBox(text); else app.logMsg('info', text);   // inferred: a batch message box goes to the log
    return null;
  }
  // 3. external editor
  let editor = ''; try { editor = String(pref('C3DPrefsScripting', 'externaleditor') ?? ''); } catch { /* prefs not built */ }
  const over = (app as any).prefValues?.['preferences.scripting.externaleditor']; if (over !== undefined) editor = String(over ?? '');
  editor = String(app.run('TrimString', { StringToTrim: editor }) ?? '');
  if (editor !== '') {
    let cmd: string;
    if (editor.includes('%s')) {
      cmd = editor.replace('%s', () => file);
      if (cmd.includes('%l')) cmd = cmd.replace('%l', () => String(line <= 0 ? 1 : line));
    } else cmd = `${editor} "${file}"`;
    try {
      logVerbose(app, `Launching ${cmd}`);
      launch(cmd, false);
      return null;
    } catch (e) { logWarning(app, `Problem launching external editor: ${errDesc(e)}`); }
  }
  return showFile(app, file, line, ['Script Editor', 'Text Editor'], 'Text Editor');
}

function showFileInShaderCodeEditor(app: App, a: Record<string, any>): any {
  const file = String(a.FileName ?? '');
  if (file === '') { app.logMsg('error', 'No file specified in call to ShowFileInShaderCodeEditor'); return undefined; }
  // inferred: the .dll / .so check of ShowFileForEdit is listed as shared ("same as ... with these differences")
  if (file.endsWith('.dll') || file.endsWith('.so')) {
    const text = sdkHelpersText(1190);
    if (interactive(app) && typeof document !== 'undefined') siMsgBox(text); else app.logMsg('info', text);
    return null;
  }
  return showFile(app, file, Number(a.LineNumber ?? -1), ['Shader Code Editor'], 'Shader Code Editor', String(a.Parser ?? ''));
}

// ------------------------------------------------------------------ registration

export function registerSdkHelperCommands(app: App) {
  (app as any).hostFs = hostFs;
  (app as any).sdkHelpers = state;
  if ((app as any).Interactive === undefined) (app as any).Interactive = true;
  // The two installation folders exist in a fresh session (inferred).
  try { hostFs.ensureFolder(state.paths[5]); } catch { /* ignore */ }

  const CAT = 'SDK Helpers';

  // ---- Global Script Variable Support
  // siUndoable is cleared on GetGlobal / SetGlobal and left at its default on SetGlobalObject; none is logged.
  const needName = (v: any, cmd: string): string => { if (v === null || v === undefined || v === '') throw new Error(`Invalid argument to ${cmd}`); return String(v); };
  app.register({
    name: 'GetGlobal', label: 'GetGlobal', category: CAT, description: 'Read the value of a global variable',
    args: [{ name: 'in_VariableName', default: '' }], undoable: false, noLog: true,
    execute(_app, a) { const k = needName(a.in_VariableName, 'GetGlobal'); return state.globals.has(k) ? state.globals.get(k) ?? null : null; },
  });
  const setGlobal = (a: Record<string, any>) => { const k = needName(a.in_VariableName, 'SetGlobal'); state.globals.set(k, a.in_Value === undefined ? null : a.in_Value); };
  app.register({
    name: 'SetGlobal', label: 'SetGlobal', category: CAT, description: 'Set value of a Global variable',
    args: [{ name: 'in_VariableName', default: '' }, { name: 'in_Value', default: null }], undoable: false, noLog: true,
    execute(_app, a) { setGlobal(a); },
  });
  app.register({
    // The registry dump gives in_Value a null default (the script declares 0 as an object reference).
    name: 'SetGlobalObject', label: 'SetGlobalObject', category: CAT, description: 'Store a script based object as a Global variable',
    args: [{ name: 'in_VariableName', default: '' }, { name: 'in_Value', default: null }], noLog: true,
    execute(_app, a) { setGlobal(a); },
  });

  // ---- SDKVBHelpers
  app.register({
    name: 'XSIInputBox', label: 'XSIInputBox', category: CAT, description: 'Make VBScript InputBox available to other scripting languages',
    args: [{ name: 'Prompt', default: '' }, { name: 'Title', default: '' }, { name: 'Default', default: '' }], noLog: true,
    execute(app2, a) {
      if (!interactive(app2)) return a.Default;                       // batch: no UI, the default unchanged
      const set = new Property('InputBox', 'CustomProperty', [str('Value', String(a.Default ?? ''))]);
      // Interactive: a modal input box. Returns a Promise of the typed string; Cancel gives "".
      return sdkModal(String(a.Title ?? ''), (body) => renderSdkLayout(body, set, [{ text: String(a.Prompt ?? '') }, { param: 'Value', opts: ['NoLabel'] }]), { w: 360, cls: 'sdkh-inputbox' })
        .then(ok => ok ? String(set.val('Value') ?? '') : '');
    },
  });
  app.register({
    name: 'StringSearch', label: 'StringSearch', category: CAT, description: 'Expose straightforward string search functionality, based on vbscript InStr',
    args: [{ name: 'SearchTarget', default: null }, { name: 'SearchStr', default: null }, { name: 'CaseSensitive', default: true }, { name: 'StartPos', default: 0 }], noLog: true,
    execute(_app, a) { return vbStringSearch(a.SearchTarget, a.SearchStr, a.CaseSensitive, a.StartPos); },
  });
  app.register({
    name: 'TrimString', label: 'TrimString', category: CAT, description: 'Expose VBScript LTrim, RTrim, Trim',
    args: [{ name: 'StringToTrim', default: null }, { name: 'TrimLeft', default: true }, { name: 'TrimRight', default: true }], noLog: true,
    execute(app2, a) {
      const l = truthy(a.TrimLeft), r = truthy(a.TrimRight);
      if (!l && !r) { logWarning(app2, 'TrimString has no effect when both TrimLeft,TrimRight are false'); return a.StringToTrim; }
      const s = vbStr(a.StringToTrim);
      return s === null ? null : vbTrim(s, l, r);                     // Trim(Null) is Null
    },
  });
  app.register({
    name: 'XSIRound', label: 'XSIRound', category: CAT, description: 'Expose the VBScript Round function',
    args: [{ name: 'in_Expression', default: null }, { name: 'in_NumDecimals', default: 0 }], noLog: true,
    execute(_app, a) {
      if (a.in_Expression === null || a.in_Expression === undefined) return null;   // Round(Null) is Null
      const x = typeof a.in_Expression === 'boolean' ? (a.in_Expression ? -1 : 0) : Number(a.in_Expression);
      if (Number.isNaN(x) || a.in_Expression === '') throw new Error("Type mismatch: 'Round'");
      const n = vbRound(Number(a.in_NumDecimals ?? 0));
      if (!Number.isFinite(n) || n < 0) throw new Error("Invalid procedure call or argument: 'Round'");
      return vbRound(x, n);
    },
  });

  // ---- SimplePropertiesPlugin
  app.register({
    name: 'LargeMsgBox', label: 'LargeMsgBox', category: CAT, description: 'Show large text results to user',
    args: [{ name: 'Text', default: null }, { name: 'Title', default: 'Info' }], noLog: true,
    execute(app2, a) {
      if (!interactive(app2)) return true;                            // batch: nothing happens
      // Whether the temporary property reaches the undo stack is open (Q4): it is added and removed without undo entries (inferred).
      const root = app2.scene.root;
      const prop = makeTextProp('Text');
      root.addProperty(prop);
      prop.set('Text', String(a.Text ?? ''));
      app2.events.emit('scene');
      // Returns a Promise: true when the page is closed with OK, false when cancelled.
      return sdkModal(String(a.Title ?? ''), (body) => renderSdkLayout(body, prop, prop.layout as SdkDlgItem[]), { w: 520, cls: 'sdkh-ppg sdkh-TextProp' })
        .then(ok => { root.removeProperty(prop); app2.events.emit('scene'); return ok; });
    },
  });
  app.register({
    name: 'PickFolder', label: 'PickFolder', category: CAT, description: 'Choose a folder',
    args: [{ name: 'Title', default: '' }, { name: 'HelpText', default: '' }, { name: 'DefaultValue', default: '' }], noLog: true,
    execute(app2, a) {
      // Batch: the script's batch branch reads a variable that does not exist, which is a runtime error.
      // "Errors in batch" is the behaviour until a golden says otherwise (Q5); the engine's own wording is not attested.
      if (!interactive(app2)) throw new Error(`script error in batch mode: the batch branch reads an undefined variable (${NOTE} Q5)`);
      const root = app2.scene.root;
      const prop = new Property('PickFolder', 'CustomProperty', []);
      root.addProperty(prop);
      prop.add(str('Directory', '', 'Directory'));
      prop.set('Directory', String(a.DefaultValue ?? ''));
      const layout: SdkDlgItem[] = [{ group: '', items: [{ text: String(a.HelpText ?? '') }, { param: 'Directory', control: 'folder', opts: ['NoLabel'] }] }];
      (prop as any).sdkLayout = layout;
      app2.events.emit('scene');
      // Returns a Promise: the Directory value on OK, "" on cancel.
      return sdkModal(String(a.Title ?? ''), (body) => renderSdkLayout(body, prop, layout), { w: 420, cls: 'sdkh-ppg sdkh-PickFolder' })
        .then(ok => { const res = ok ? String(prop.val('Directory') ?? '') : ''; root.removeProperty(prop); app2.events.emit('scene'); return res; });
    },
  });

  // ---- SDKHelpers
  app.register({
    name: 'ShowFileForEdit', label: 'ShowFileForEdit', category: CAT, description: 'Show contents of a script or other text file inside a text editor',
    args: [{ name: 'FileName', default: '' }, { name: 'LineNumber', default: -1 }], noLog: true,
    execute: showFileForEdit,
  });
  app.register({
    name: 'ShowFileInShaderCodeEditor', label: 'ShowFileInShaderCodeEditor', category: CAT, description: 'Show contents of a shader file inside the shader code editor',
    args: [{ name: 'FileName', default: '' }, { name: 'Parser', default: '' }, { name: 'LineNumber', default: -1 }], noLog: true,
    execute: showFileInShaderCodeEditor,
  });
  app.register({
    name: 'CreateAddonDirectories', label: 'CreateAddonDirectories', category: CAT, description: 'Create the directory structure for an addon',
    args: [{ name: 'RootPath', default: null }, { name: 'AddonName', default: null }],
    execute(_app, a) {
      const rootPath = String(a.RootPath ?? ''), name = String(a.AddonName ?? '');
      // ends in "Addons" (any case); a trailing separator defeats the test
      const root = /addons$/i.test(rootPath) ? hostFs.join(rootPath, name) : hostFs.join(hostFs.join(rootPath, 'Addons'), name);
      return createStandardTree(hostFs, root);
    },
  });
  app.register({
    name: 'CreateWorkgroupDirectories', label: 'CreateWorkgroupDirectories', category: CAT, description: 'Create the directory structure for an workgroup',
    args: [{ name: 'WorkgroupPath', default: null }],
    execute(_app, a) { return createStandardTree(hostFs, String(a.WorkgroupPath ?? '')); },
  });
  app.register({
    name: 'FindFilesInFolder', label: 'FindFilesInFolder', category: CAT, description: 'Search for files with a particular pattern in a directory',
    args: [{ name: 'Directory', default: '' }, { name: 'RegularExpression', default: '.*' }, { name: 'FindAllMatches', default: false }, { name: 'ReturnFullPath', default: true }], noLog: true,
    execute(app2, a) {
      const all = truthy(a.FindAllMatches), full = truthy(a.ReturnFullPath);
      const dir = String(a.Directory ?? '');
      const out: string[] = [];
      let names: string[];
      try { names = hostFs.listFiles(dir); }
      catch (e) { app2.logMsg('error', `FindFilesInFolder - problem with argument ${dir} : ${errDesc(e)}`); return all ? [] : ''; }
      const re = new RegExp(String(a.RegularExpression ?? ''), 'i');   // case-insensitive, as the (Windows) file system is
      for (const n of names) {
        if (n.search(re) !== 0) continue;                             // must match starting at the first character
        out.push(full ? hostFs.join(dir, n) : n);
        if (!all) break;
      }
      return all ? out : (out[0] ?? '');
    },
  });
  app.register({
    name: 'SpdlCheck', label: 'SpdlCheck', category: CAT, description: 'Launch spdlcheck utility',
    args: [{ name: 'strFilePath', default: null }, { name: 'in_WithUI', default: true }],
    execute(app2, a) {
      const file = a.strFilePath;
      const ui = truthy(a.in_WithUI);
      // 1.
      if (file === null || file === undefined || file === '') { app2.logMsg('error', 'Invalid empty path argument to SpdlCheck'); return undefined; }
      // 2.
      if (!/\.spdl$/i.test(String(file))) {
        if (ui) { const text = sdkHelpersText(1194); if (interactive(app2) && typeof document !== 'undefined') siMsgBox(text); else app2.logMsg('info', text); }   // inferred: a batch message box goes to the log
        return 'Failure: Not a SPDL File';
      }
      // 3. run and wait
      const tmp = hostFs.join(state.paths[1], 'spdlcheckoutput.tmp');
      const cmd = `spdlcheck -nologo -noverbose -out "${tmp}" "${file}"`;
      state.lastLaunch = cmd;
      if (!state.launchProcess) throw notYetAttested('SpdlCheck', `running "${cmd}": spdlcheck cannot be launched in this build and its output format is not examined`, 'Q3, Q8');
      launch(cmd, true);
      // 4. a missing temp file is not handled: command error
      const text = hostFs.readFile(tmp);
      hostFs.deleteFile(tmp);
      // 5.
      if (ui) app2.run('LargeMsgBox', { Text: text, Title: 'SPDLCheck Results' });
      // 6.
      return text;
    },
  });
  app.register({
    name: 'PackageAddon', label: 'PackageAddon', category: CAT, description: '',
    args: [{ name: 'SrcDir', default: null }, { name: 'DestinationPath', default: '' }, { name: 'Overwrite', default: true }, { name: 'ExcludeDirs', default: '' }],
    execute: packageAddon,
  });
  app.register({
    name: 'PackageAddonUI', label: 'PackageAddonUI', category: CAT, description: 'Interactive version of PackageAddon command',
    args: [{ name: 'Source', default: '' }], noLog: true,
    execute: packageAddonUI,
  });
}
