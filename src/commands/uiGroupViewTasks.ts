// Ledger row CMD-B7a. Brief: docs/ghidra/cmd-b7a-uitasks-group-view-binary.md, "Wire contract" sections and
// "Shared facts". Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   siuitasks     SetUserKeyword SetUserTab GetUserKeyword GetUserTab ClearUserKeyword ClearUserTab
//                 RemoveUserKeyword RemoveUserTab AddUserKeyword AddUserTab SetParameterColor
//                 ClearParameterColor SetThumbnail SetThumbnailFromRegion ClearThumbnail
//   grouptask     AssignObjectGroup SetParTypeInstanceGroup SetInstanceGroup UnassignObjectGroup
//                 RemoveParTypeInstanceGroup RemoveInstanceGroup
//   (siviewtasks, siclustertasks, selectionmgr: uiGroupViewTasksViews.ts)
//
// How the contract is mapped onto this build:
//  * Persistable component attributes are own fields of the target (`userKeywords`, `userTabs`,
//    `parameterColor`, `thumbnail`); a removed attribute is a deleted field. Keywords and tabs are the
//    comma separated string of the contract.
//  * Task status codes that are not failures (0, 1, 0x562e80c7 "cancelled by user") are kept in
//    `app.uiGroupViewTasks.lastStatus`; failure statuses are thrown as SiStatusError.
//  * Message texts of the ids the note records are not resolved (Q1): errors and log lines carry the id.
//  * Modal dialogs: the command bus is synchronous, so a command that opens one returns a Promise that
//    settles when the dialog is done (the convention of alembicSeqCam.ts).
//  * Files live in the session's virtual host file system (src/core/sdkHelpersHostFs.ts).
//  * RePackArg: the final value is written back into the argument record of the call.
// Earlier inferred registrations of some of these names (viewEditProperty.ts, animateSurface.ts,
// selectionGroupLayer.ts, the FaceRobot host shell of AddUserKeyword) are replaced here.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Property, Group } from '../core/scene';
import { Parameter } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { sdkModal, sdkMsgBox } from '../ui/sdkHelpersModal';
import { SiStatusError, alembicState } from './alembicSeqCam';
import { unset, boolArg, findNode, paramsOf } from './viewEditPropertyHelpers';
import { registerUiGroupViewTasksViews } from './uiGroupViewTasksViews';

export const NOTE = 'docs/ghidra/cmd-b7a-uitasks-group-view-binary.md';
export const S_OK = 0;
export const S_NOTHING = 1;
export const S_CANCELLED = 0x562e80c7;
export const E_POINTER = 0x80004003;
export const E_FAIL = 0x80004005;
export const E_ACCESSDENIED = 0x80070005;
export const E_INVALIDARG = 0x80070057;
export const E_UNEXPECTED = 0x8000ffff;

/** Attribute GUIDs of the contract; the property-changed notification is named by the GUID text. */
export const ATTRIBUTE_GUID = {
  userKeywords: '{fd1a0da8-ae6f-4580-9367-b5bc1f112880}',
  userTabs: '{732ad5de-b58e-4468-9f13-60c2deccf1a1}',
  parameterColor: '{65703160-f700-4c49-a83e-cd2a3d23945f}',
  thumbnail: '{e7016efe-6e64-4977-bab1-ac08191bac4e}',
} as const;
export type AttributeName = keyof typeof ATTRIBUTE_GUID;
export const NO_THUMBNAIL = '__NOTHUMBNAIL__';

/** The thumbnail object stored as the thumbnail attribute. */
export interface Thumbnail { kind: 'thumbnail'; target: object; fileName: string; /** Q3: a thumbnail SetThumbnail must not replace. */ fixed?: boolean }

/** The object GetUserKeyword / GetUserTab return: each token is both key and value. */
export class KeywordCollection {
  readonly items: string[] = [];
  get Count(): number { return this.items.length; }
  Item(key: number | string): string | undefined {
    return typeof key === 'number' ? this.items[key] : this.items.find(t => t.toLowerCase() === String(key).toLowerCase());
  }
  /** Add a token unless it is already there (compared without case). */
  Add(token: string): boolean {
    if (this.items.some(t => t.toLowerCase() === token.toLowerCase())) return false;
    this.items.push(token); return true;
  }
  toString(): string { return this.items.join(','); }
  toJSON(): string[] { return [...this.items]; }
}

export interface ExplorerViewRecord {
  type: 'XSI Explorer'; win: any; scope: number; internalScope: number; showToolbar: boolean; reuse: boolean; reused: boolean;
  content: Node[]; viewer: { name: string; clsid: string } | null; title: string;
}
export interface TransientSession {
  result: Node[]; multiSelect: boolean; sort: boolean; expandLevel: number; filter: number; mask: number | null; roots: Node[]; win: any;
  /** A picking notification: "set" replaces, "add" appends, "remove" removes, "toggle" flips membership. */
  notify(kind: 'set' | 'add' | 'remove' | 'toggle', nodes: Node[]): void;
  /** TransientPickingSessionTerminated. */
  terminate(): void;
}
export interface UiGroupViewTasksState {
  lastStatus: { command: string; status: number } | null;
  quirks: {
    /** Q2, as read: SetUserTab pre-fills its dialog from, and clears on a blank string, the *keyword* attribute. */
    setUserTabSubTasksUseKeywords: boolean;
  };
  thumbnailFolder(): string;
  /** Id of the view that has a render region, null = none. Seam: this build's region is private to the viewports. */
  regionView: (() => string | null) | null;
  /** The region-capture task (another DLL, not read). Seam: writes the region image of a view to a file. */
  captureRegion: ((viewId: string, path: string) => void) | null;
  /** Attachment entries of a target as the three parallel strings (content not read). Seam. */
  attachmentEntries: ((target: Node) => [string, string, string] | null) | null;
  explorers: ExplorerViewRecord[];
  transient: TransientSession | null;
  attachmentsExplorer: { win: any; mode: 3 | 9; target: Node | null; width: number; height: number } | null;
  attachmentViewers: { name: string; strings: [string, string, string]; reused: boolean }[];
  ambient: Record<string, any>;
  selFilter: string | null;
  selectionToolActivations: number;
  /** Optional arguments the handlers read by name that are not in the registered list (CategoryID, HierarchyLevel, CheckObjectSelectability, GroupMode). */
  extra: Record<string, any> | null;
  /** Run a command with such unregistered by-name arguments. */
  runWith(name: string, args: Record<string, any>, extra: Record<string, any>): any;
}
export const stateOf = (app: App): UiGroupViewTasksState => (app as any).uiGroupViewTasks;

// ------------------------------------------------------------------ small helpers
export const interactive = (app: App) => (app as any).Interactive !== false;
export const text = (v: unknown): string => v === null || v === undefined ? '' : String(v);
export const hex = (n: number) => '0x' + (n >>> 0).toString(16);
/** A message id whose text was not resolved (Q1). */
export const msgId = (id: number) => `message ${id === 1000 ? id : hex(id)}; text not yet attested, Q1`;   // 1000 is written in decimal in the note
export function fail(status: number, what: string, id?: number): SiStatusError {
  return new SiStatusError(status, id === undefined ? what : `${what} (${msgId(id)})`);
}
export function setStatus(app: App, command: string, status: number): void { stateOf(app).lastStatus = { command, status }; }
export function logNya(app: App, command: string, what: string, question = ''): void {
  app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
}
/** Keep a returned Promise from raising an unhandled rejection when the caller ignores it. */
export function quiet<T>(p: Promise<T>): Promise<T> { p.catch(() => undefined); return p; }
/** Take the unregistered by-name arguments of the running call. */
export function takeExtra(app: App): Record<string, any> { const s = stateOf(app); const e = s.extra ?? {}; s.extra = null; return e; }

const listOf = (arg: any): any[] => Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg];
/** A scene node named by one list item; also finds a property by name anywhere in the scene (particle types). */
export function nodeOf(app: App, x: any): Node | undefined {
  const n = findNode(app, x); if (n) return n;
  if (typeof x !== 'string' || !x) return undefined;
  const leaf = x.split('.').pop()!;
  for (const o of [app.scene.root, ...app.scene.allObjects()]) {
    const p = o.allProperties().find(k => k.fullName === x || k.name === x || k.name === leaf && x.startsWith(o.name + '.'));
    if (p) return p;
  }
  return undefined;
}
/** Object list argument. `selection`: what an argument that was not given stands for. */
export function nodeList(app: App, arg: any, selection: boolean): Node[] {
  // inferred: the Collection argument handler of the siuitasks commands supplies the selection when nothing is passed
  if (unset(arg)) return selection ? [...app.selection] : [];
  const out: Node[] = [];
  for (const x of listOf(arg)) { const n = nodeOf(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}

// ------------------------------------------------------------------ attributes
const has = (t: object, k: AttributeName) => Object.prototype.hasOwnProperty.call(t, k);
export function attribute(t: object, k: AttributeName): any { return has(t, k) ? (t as any)[k] : undefined; }
function put(t: object, k: AttributeName, v: any) { if (v === undefined) delete (t as any)[k]; else (t as any)[k] = v; }
function changed(app: App, k: AttributeName, targets: object[], notify: boolean) {
  // the owner is told it changed; keyword / tab / colour tasks also broadcast the attribute GUID
  if (notify && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('si-property-changed', { detail: { name: ATTRIBUTE_GUID[k], targets } }));
  app.events.emit('scene');
}
/** Write (or with `undefined` remove) an attribute on every target as one undoable step. */
export function writeAttribute(app: App, label: string, k: AttributeName, targets: object[], next: (t: object, i: number) => any, notify = true): void {
  const olds = targets.map(t => attribute(t, k)); const news = targets.map(next);
  app.record(label, () => { targets.forEach((t, i) => put(t, k, news[i])); }, () => { targets.forEach((t, i) => put(t, k, olds[i])); });
  changed(app, k, targets, notify);
}
/** Tokens of a comma separated string: no duplicates (case-insensitive), first-seen order. */
export function tokens(s: string): string[] {
  const c = new KeywordCollection(); for (const t of s.split(',')) if (t !== '') c.Add(t);
  return c.items;
}
function mergedKeywords(targets: object[], k: 'userKeywords' | 'userTabs'): KeywordCollection {
  const c = new KeywordCollection();
  for (const t of targets) for (const tok of tokens(text(attribute(t, k)))) c.Add(tok);
  return c;
}

// ------------------------------------------------------------------ dialogs
/** Dialog resource 0xca: "User Keyword(s)" with one text field. Resolves the typed text, null on Cancel. */
function keywordDialog(initial: string): Promise<string | null> {
  let field: HTMLInputElement;
  return sdkModal('User Keyword(s)', (body) => {
    const l = document.createElement('div'); l.className = 'ugv-keywords-prompt'; l.textContent = 'Please enter the User Keywords (comma separated)'; l.style.padding = '2px 0 6px';
    field = document.createElement('input'); field.type = 'text'; field.className = 'ugv-keywords-input'; field.value = initial; field.style.cssText = 'width:100%;box-sizing:border-box';
    body.append(l, field);
  }, { w: 380, cls: 'ugv-keywords' }).then(ok => ok ? field.value : null);
}
const bgrToCss = (v: number) => '#' + [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff].map(c => c.toString(16).padStart(2, '0')).join('');
const cssToBgr = (s: string) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s.trim()); return m ? parseInt(m[1], 16) | (parseInt(m[2], 16) << 8) | (parseInt(m[3], 16) << 16) : 0; };
/** The colour editor. Resolves 0x00BBGGRR, null on Cancel. */
function colorDialog(initial: number): Promise<number | null> {
  let field: HTMLInputElement;
  // inferred: the window title; the editor's own layout is not part of the contract
  return sdkModal('Color Editor', (body) => {
    body.dataset.initial = String(initial);
    field = document.createElement('input'); field.type = 'color'; field.className = 'ugv-color-input'; field.value = bgrToCss(initial);
    body.appendChild(field);
  }, { w: 260, cls: 'ugv-color' }).then(ok => ok ? cssToBgr(field.value) : null);
}
interface BrowseRequest { title: string; save: boolean; directory: string; name: string; filter: string }
/** File browser page over the virtual host file system. Resolves the full path, '' on Cancel. */
function fileBrowser(req: BrowseRequest): Promise<string> {
  let dir: HTMLInputElement, name: HTMLInputElement;
  return sdkModal(req.title, (body) => {
    body.dataset.mode = req.save ? 'save' : 'open'; body.dataset.filter = req.filter;
    const row = (cls: string, label: string, value: string) => {
      const r = document.createElement('div'); r.className = cls; r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0';
      const l = document.createElement('label'); l.textContent = label; l.style.cssText = 'flex:0 0 90px';
      const t = document.createElement('input'); t.type = 'text'; t.value = value; t.style.cssText = 'flex:1 1 auto;min-width:0';
      r.append(l, t); body.appendChild(r); return t;
    };
    dir = row('ugv-browse-dir', 'Look in', req.directory);
    name = row('ugv-browse-name', 'File name', req.name);
  }, { w: 460, cls: `ugv-filebrowser ugv-filebrowser-${req.save ? 'save' : 'open'}` }).then((ok) => {
    const n = name.value.trim();
    if (!ok || n === '') return '';
    return /^([A-Za-z]:|\\\\|\/\/)/.test(n) ? n : hostFs.join(dir.value.trim(), n);
  });
}

// ------------------------------------------------------------------ user keywords / tabs
type KwAttr = 'userKeywords' | 'userTabs';
function setKeywords(app: App, command: string, k: KwAttr, a: Record<string, any>): any {
  const targets = nodeList(app, a.InputObjs, true);
  if (!targets.length) { setStatus(app, command, S_NOTHING); return; }
  const subTaskAttr: KwAttr = stateOf(app).quirks.setUserTabSubTasksUseKeywords ? 'userKeywords' : k;   // Q2
  const apply = (typed: string) => {
    const final = typed.split(' ').join('');   // every space character is removed
    if (final === '') writeAttribute(app, command, subTaskAttr, targets, () => undefined);   // the internal ClearUserKeyword sub-task
    else writeAttribute(app, command, k, targets, () => final);   // replaced, not merged
    a.Keywords = final;   // RePackArg
    setStatus(app, command, S_OK);
  };
  const given = text(a.Keywords);
  if (given !== '') { apply(given); return; }
  if (!interactive(app)) throw fail(E_INVALIDARG, `${command}: no Keywords given and no user interface`, 0x3eb);
  return quiet(keywordDialog(mergedKeywords(targets, subTaskAttr).toString()).then((typed) => {
    if (typed === null || typed === '') {
      app.logMsg('info', `${command}: cancelled (${msgId(0x1e)})`);
      setStatus(app, command, S_CANCELLED); return;
    }
    apply(typed);
  }));
}
function getKeywords(app: App, command: string, k: KwAttr, a: Record<string, any>): KeywordCollection {
  const c = mergedKeywords(nodeList(app, a.InputObjs, true), k);
  a.Keywords = c;   // output argument
  setStatus(app, command, S_NOTHING);
  return c;
}
function clearAttribute(app: App, command: string, k: AttributeName, targets: object[], notify = true): void {
  if (!targets.length) { setStatus(app, command, S_NOTHING); return; }
  writeAttribute(app, command, k, targets, () => undefined, notify);
  setStatus(app, command, S_OK);
}
function modifyKeywords(app: App, command: string, k: KwAttr, mode: 'add' | 'remove', a: Record<string, any>): void {
  const targets = nodeList(app, a.InputObjs, true);
  const given = tokens(text(a.Keywords));   // spaces are not stripped here
  if (!targets.length || text(a.Keywords) === '') { setStatus(app, command, S_NOTHING); return; }
  writeAttribute(app, command, k, targets, (t) => {
    const cur = attribute(t, k);
    if (cur === undefined && mode === 'remove') return undefined;   // left untouched
    const list = new KeywordCollection(); for (const tok of tokens(text(cur))) list.Add(tok);
    // inferred: tokens are matched without case, like the duplicate test of the token list
    if (mode === 'add') for (const g of given) list.Add(g);
    else for (const g of given) { const i = list.items.findIndex(x => x.toLowerCase() === g.toLowerCase()); if (i >= 0) list.items.splice(i, 1); }
    return list.Count ? list.toString() : undefined;
  });
  setStatus(app, command, S_OK);
}

// ------------------------------------------------------------------ parameter colour
function paramTargets(app: App, arg: any): Parameter[] {
  if (unset(arg)) return [...app.anim.marked];   // argument handler: the marked parameters
  const out: Parameter[] = [];
  for (const x of Array.isArray(arg) ? arg : [arg]) {
    if (x instanceof Parameter) { if (!out.includes(x)) out.push(x); continue; }
    for (const p of paramsOf(app, app.selectedObjects, x).found) if (!out.includes(p)) out.push(p);
  }
  return out;
}
/** The Value argument as a colour: an unsigned 32-bit integer with a zero top byte, else null. */
export function usableColor(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  // inferred: a numeric string converts like an integer variant
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*(0x[0-9a-f]+|\d+)\s*$/i.test(v) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 0x00ffffff) return null;   // floats are ignored
  return n;
}
function setParameterColor(app: App, a: Record<string, any>): any {
  const C = 'SetParameterColor';
  const targets = paramTargets(app, a.InputObjs);
  if (!targets.length) { setStatus(app, C, S_NOTHING); return; }
  const apply = (value: number) => {
    writeAttribute(app, C, 'parameterColor', targets, () => value);
    a.Value = value;   // RePackArg
    setStatus(app, C, S_OK);
  };
  const given = usableColor(a.Value);
  if (given !== null) { apply(given); return; }
  if (!interactive(app)) throw fail(E_INVALIDARG, `${C}: no usable Value and no user interface`, 0x3eb);
  const current = attribute(targets[0], 'parameterColor');
  return quiet(colorDialog(typeof current === 'number' ? current : 0xff).then((picked) => {
    if (picked === null) { app.logMsg('info', `${C}: cancelled (${msgId(0x1e)})`); setStatus(app, C, S_CANCELLED); return; }
    apply(picked);
  }));
}

// ------------------------------------------------------------------ thumbnails
const samePath = (x: string, y: string) => hostFs.normalize(x).toLowerCase() === hostFs.normalize(y).toLowerCase();
function thumbnailFolder(app: App): string {
  const dir = stateOf(app).thumbnailFolder();
  hostFs.ensureFolder(dir);   // created if missing
  return dir;
}
/** Steps 4 and 5 of SetThumbnail: path handling, then one thumbnail object per target. */
function applyThumbnail(app: App, command: string, targets: Node[], pathname: string, a: Record<string, any>, argName: string): void {
  const folder = thumbnailFolder(app);
  const dir = hostFs.parentPath(pathname); const file = hostFs.baseName(pathname);
  if (dir === '' || dir === '.') {
    if (!hostFs.isFile(hostFs.join(folder, file))) throw fail(E_FAIL, `${command}: "${file}" is not in the thumbnail folder`, 0x17);
  } else if (!samePath(dir, folder)) {
    if (!hostFs.isFile(pathname)) throw fail(E_FAIL, `${command}: "${pathname}" cannot be read`, 0x17);
    const dest = hostFs.join(folder, file);
    if (hostFs.exists(dest)) throw fail(E_ACCESSDENIED, `${command}: "${file}" already exists in the thumbnail folder`, 0x3b);
    hostFs.writeFile(dest, hostFs.readFile(pathname));   // copied, no overwrite
    app.logMsg('info', `${command}: copied "${pathname}" to "${dest}" (${msgId(0x26)})`);
  }
  a[argName] = pathname;   // RePackArg
  // inferred from two init calls: the object is initialised with the target and the file name
  writeAttribute(app, command, 'thumbnail', targets, (t): Thumbnail => ({ kind: 'thumbnail', target: t, fileName: file }), false);
  setStatus(app, command, S_OK);
}
/** Step 1 of SetThumbnail: the filtered copy of InputObjs. */
function thumbnailTargets(app: App, command: string, arg: any): Node[] {
  // inferred: every scene node of this build can carry a thumbnail (interface {9ee6ddb1-...} is not named in the note).
  // A thumbnail marked `fixed` stands for the kind that exposes {80802a4c-...} (Q3); this build never creates one.
  const targets = nodeList(app, arg, true).filter(n => n instanceof Node && !(attribute(n, 'thumbnail') as Thumbnail | undefined)?.fixed);
  if (!targets.length) throw fail(E_INVALIDARG, `${command}: no object that can take a thumbnail`, 0x6f);
  return targets;
}
function setThumbnail(app: App, a: Record<string, any>): any {
  const C = 'SetThumbnail';
  const targets = thumbnailTargets(app, C, a.InputObjs);
  const folder = thumbnailFolder(app);
  const given = text(a.Pathname);
  if (given !== '') { applyThumbnail(app, C, targets, given, a, 'Pathname'); return; }
  if (!interactive(app)) throw fail(E_FAIL, `${C}: no Pathname given and no user interface`, 0x17);
  // inferred: the image filters come from the registered image parsers, which this build does not list
  return quiet(fileBrowser({ title: 'Browse for Thumbnail', save: false, directory: folder, name: '', filter: 'Image Files (*.*)|*.*||' }).then((picked) => {
    if (picked === '') throw fail(E_FAIL, `${C}: cancelled`, 1000);
    applyThumbnail(app, C, targets, picked, a, 'Pathname');
  }));
}
function setThumbnailFromRegion(app: App, a: Record<string, any>): any {
  const C = 'SetThumbnailFromRegion';
  const S = stateOf(app);
  if (!S.regionView) logNya(app, C, 'which view has a render region (the region of this build is private to its viewports); taken as none');
  const view = S.regionView ? S.regionView() : null;
  if (view === null) { setStatus(app, C, S_NOTHING); return; }   // no region: nothing happens
  const folder = thumbnailFolder(app);
  const targets = nodeList(app, a.InputObjs, true);
  let overwrite = boolArg(a.Overwrite);
  const finish = (fileName: string) => {
    const path = hostFs.normalize(hostFs.join(folder, fileName));
    a.FileName = path;   // written back
    if (hostFs.exists(path) && !overwrite) throw fail(E_FAIL, `${C}: "${path}" exists and Overwrite is off`, 0x3b);
    if (S.captureRegion) S.captureRegion(view, path);
    else logNya(app, C, 'the region-capture task {8ab0e935-9a8d-4027-9d44-f78e8b0edfad} that writes the region image');
    if (!hostFs.isFile(path)) throw fail(E_FAIL, `${C}: "${path}" cannot be read after the capture`, 0x17);
    // the internal SetThumbnail task on (InputObjs, path)
    applyThumbnail(app, C, thumbnailTargets(app, C, targets), path, {}, 'Pathname');
  };
  const given = text(a.FileName);
  if (given !== '') { finish(hostFs.baseName(given)); return; }
  if (!interactive(app)) { app.logMsg('info', `${C}: no FileName given and no user interface (${msgId(0x3eb)})`); setStatus(app, C, S_NOTHING); return; }
  const defaultName = targets[0] ? `${targets[0].name}.jpg` : 'Thumbnail.jpg';
  const ask = async (): Promise<void> => {
    for (;;) {
      const picked = await fileBrowser({ title: 'Enter the Thumbnail filename', save: true, directory: folder, name: defaultName, filter: 'Image Files (*.*)|*.*||' });
      if (picked === '') { app.logMsg('info', `${C}: cancelled (${msgId(0x1e)})`); setStatus(app, C, S_CANCELLED); return; }
      if (!samePath(hostFs.parentPath(picked), folder)) {
        await sdkMsgBox("The thumbnail file MUST be saved in the 'Thumbnails' sub-folder of the current project.", C, true);
        continue;   // the browser reopens in the thumbnail folder
      }
      if (hostFs.exists(picked)) overwrite = true;
      finish(hostFs.baseName(picked)); return;
    }
  };
  return quiet(ask());
}
function clearThumbnail(app: App, a: Record<string, any>): void {
  const C = 'ClearThumbnail';
  const targets = nodeList(app, a.InputObjs, true);
  // the undo data is the previous file name, or the marker when there was none
  const previous = targets.map(t => (attribute(t, 'thumbnail') as Thumbnail | undefined)?.fileName ?? NO_THUMBNAIL);
  (stateOf(app) as any).lastClearThumbnailUndo = previous;
  clearAttribute(app, C, 'thumbnail', targets, false);
}

// ------------------------------------------------------------------ grouptask: group containers
/** An object with indexed group slots. Slot 0 is the `instanceGroup` field the earlier hair commands used. */
interface Container { owner: any; index: number }
const isHair = (o: X3DObject) => o.type === 'hair' || o.properties.some(p => p.type === 'hair') || /hair/i.test(o.name);
const isParType = (n: any): n is Property => n instanceof Property && n.type === 'ParType';
// inferred: the group containers of this build are hair objects and particle types (the two instance-group users
// the registry descriptions name); interface {35c3e1e5-...} is not named in the note.
const isContainer = (n: any) => (n instanceof X3DObject && isHair(n)) || isParType(n);
function nestedContainer(n: any): any {
  if (!(n instanceof X3DObject)) return null;
  for (const p of n.properties) { if (isParType(p)) return p; const t = (p as any).parType; if (isParType(t)) return t; }
  return null;
}
const slots = (owner: any): (Group | null)[] => (owner.groupSlots ??= []);
const groupAt = (c: Container): Group | null => (c.index === 0 ? c.owner.instanceGroup : slots(c.owner)[c.index]) ?? null;
function setGroupAt(c: Container, g: Group | null) { if (c.index === 0) c.owner.instanceGroup = g; else slots(c.owner)[c.index] = g; }
// inferred: slot 0 is the only slot of this build's containers and it is always usable
const usable = (c: Container) => c.index === 0;

function containerArg(app: App, command: string, arg: any, nested: boolean): Container {
  const list = nodeList(app, arg, false);
  if (!list.length) throw fail(E_UNEXPECTED, `${command}: the Object list is empty`);
  const item = list[0];
  // inferred: a component descriptor (type 0x402) carrying another index is not produced by this build; index 0
  if (isContainer(item)) return { owner: item, index: 0 };
  const inner = nested ? nestedContainer(item) : null;
  if (inner) return { owner: inner, index: 0 };
  throw fail(E_INVALIDARG, `${command}: ${item.name} is not a group container`);
}
function assignGroup(app: App, command: string, objectArg: any, groupArg: any): void {
  const c = containerArg(app, command, objectArg, true);
  const g = nodeList(app, groupArg, false)[0];
  // inferred: group type 3 is what this build's Group nodes are; anything else is refused with message 0x6f
  if (!(g instanceof Group)) throw fail(g ? E_FAIL : E_INVALIDARG, `${command}: ${g ? `${g.name} is not a group of the required type` : 'the Group list is empty'}`, g ? 0x6f : undefined);
  if (!usable(c)) { setStatus(app, command, S_NOTHING); return; }
  const prev = groupAt(c);
  app.record(command, () => setGroupAt(c, g), () => setGroupAt(c, prev));   // undo: the remembered group, or a cleared slot
  setStatus(app, command, S_OK);
  app.logMsg('info', `${command}: ${c.owner.name} instance group = ${g.name}; not yet attested: instantiation of the group's models on the ${isParType(c.owner) ? 'particles' : 'strands'}`);
}
function unassignGroup(app: App, command: string, objectArg: any): void {
  const c = containerArg(app, command, objectArg, false);
  const prev = usable(c) ? groupAt(c) : null;
  if (!prev) { setStatus(app, command, S_NOTHING); return; }
  app.record(command, () => setGroupAt(c, null), () => setGroupAt(c, prev));
  setStatus(app, command, S_OK);
}

// ------------------------------------------------------------------ registration
export function registerUiGroupViewTaskCommands(app: App) {
  const state: UiGroupViewTasksState = {
    lastStatus: null,
    quirks: { setUserTabSubTasksUseKeywords: true },
    // inferred: path kind 0x17 is the "Thumbnails" sub-folder of the current project (the dialog text names it)
    thumbnailFolder: () => hostFs.join(alembicState.projectPath, 'Thumbnails'),
    regionView: null, captureRegion: null, attachmentEntries: null,
    explorers: [], transient: null, attachmentsExplorer: null, attachmentViewers: [],
    ambient: {}, selFilter: null, selectionToolActivations: 0,
    extra: null,
    runWith(name, args, extra) { state.extra = { ...extra }; try { return app.run(name, args); } finally { state.extra = null; } },
  };
  (app as any).uiGroupViewTasks = state;
  const reg = (def: CommandDef) => app.register(def);
  const IN = { name: 'InputObjs', default: null };

  // Scripting names written out literally (the ledger's static scan reads them; WIRE_CORRECTIONS_B15 item 26).
  const KW_COMMANDS = [
    { W: 'Keyword', k: 'userKeywords', noun: 'user keyword', set: 'SetUserKeyword', get: 'GetUserKeyword', clear: 'ClearUserKeyword', remove: 'RemoveUserKeyword', add: 'AddUserKeyword' },
    { W: 'Tab', k: 'userTabs', noun: 'User Tab', set: 'SetUserTab', get: 'GetUserTab', clear: 'ClearUserTab', remove: 'RemoveUserTab', add: 'AddUserTab' },
  ] as const;
  for (const { W, k, noun, set, get, clear, remove, add } of KW_COMMANDS) {
    reg({
      name: set, label: `Set User ${W}`, category: 'Viewing|Property', description: `Sets the ${noun}(s) on the input object(s)`,
      args: [IN, { name: 'Keywords', default: '' }],
      execute: (app, a) => setKeywords(app, set, k, a),
    });
    reg({
      name: get, label: `Get User ${W}`, category: 'Viewing|Property', description: `Gets the ${noun.toLowerCase()}(s) on the input object(s)`, undoable: false,
      args: [IN, { name: 'Keywords', default: null }],
      execute: (app, a) => getKeywords(app, get, k, a),
    });
    reg({
      name: clear, label: `Clear User ${W}`, category: 'Viewing|Property', description: `Clears the ${noun.toLowerCase()}(s) on given object(s)`,
      args: [IN],
      execute: (app, a) => clearAttribute(app, clear, k, nodeList(app, a.InputObjs, true)),
    });
    for (const mode of ['remove', 'add'] as const) {
      const name = mode === 'add' ? add : remove;
      reg({
        name, label: `${mode === 'add' ? 'Add' : 'Remove'} User ${W}`, category: 'Viewing|Property', description: '',
        args: [IN, { name: 'Keywords', default: '' }],
        execute: (app, a) => modifyKeywords(app, name, k, mode, a),
      });
    }
  }

  reg({
    name: 'SetParameterColor', label: 'Set Parameter Color', category: 'Animation|Property', description: 'Sets the parameter color on the input parameter(s)',
    args: [IN, { name: 'Value', default: null }],
    execute: (app, a) => setParameterColor(app, a),
  });
  reg({
    name: 'ClearParameterColor', label: 'Clear Parameter Color', category: 'Animation|Property', description: 'Clears the parameter color on given parameter(s)',
    args: [IN],
    execute: (app, a) => clearAttribute(app, 'ClearParameterColor', 'parameterColor', paramTargets(app, a.InputObjs)),
  });
  reg({
    name: 'SetThumbnail', label: 'Set Thumbnail', category: 'Viewing', description: 'Set a thumbnail (from image on disk) on given object(s)',
    args: [IN, { name: 'Pathname', default: '' }],
    execute: (app, a) => setThumbnail(app, a),
  });
  reg({
    name: 'SetThumbnailFromRegion', label: 'Set Thumbnail From Region', category: 'Viewing', description: 'Set a thumbnail (using the region) on given object(s)',
    args: [IN, { name: 'FileName', default: '' }, { name: 'Overwrite', default: false }],
    execute: (app, a) => setThumbnailFromRegion(app, a),
  });
  reg({
    name: 'ClearThumbnail', label: 'Clear Thumbnail', category: 'Viewing', description: 'Clears the thumbnail on given object(s)',
    args: [IN],
    execute: (app, a) => clearThumbnail(app, a),
  });

  // ---- grouptask
  const GROUP = { name: 'Group', default: null };
  const assign = (name: string, category: string, first: 'Object' | 'ParType', description: string) => reg({
    name, label: name, category, description, args: [{ name: first, default: null }, GROUP],
    execute(app, a) {
      // Q4: the handler asks for "Object"; how the registered "ParType" reaches it is not established.
      // inferred: the first registered argument is taken, whatever its name
      if (first === 'ParType') logNya(app, name, 'how the ParType argument reaches the handler, which asks for "Object"; the first argument is used', 'Q4');
      assignGroup(app, name, a[first], a.Group);
    },
  });
  const unassign = (name: string, category: string, first: 'Object' | 'ParType', description: string) => reg({
    name, label: name, category, description, args: [{ name: first, default: null }],
    execute(app, a) {
      if (first === 'ParType') logNya(app, name, 'how the ParType argument reaches the handler, which asks for "Object"; the first argument is used', 'Q4');
      unassignGroup(app, name, a[first]);
    },
  });
  assign('AssignObjectGroup', 'Group', 'Object', 'Assign a group of models to the group container object or parameter.');
  assign('SetInstanceGroup', 'Group', 'Object', 'Set the instance group on a hair object. The group contains models that will be instantiated on the individual strands of the hair object.');
  assign('SetParTypeInstanceGroup', 'Simulation', 'ParType', 'Set the instane group on a particle type. The group contains models that will be instanced on the particles of that type.');
  unassign('UnassignObjectGroup', 'Group', 'Object', 'Unassign the model group from the group container object or parameter.');
  unassign('RemoveInstanceGroup', 'Group', 'Object', 'Clear the instance group from the instantiating object.');
  unassign('RemoveParTypeInstanceGroup', 'Simulation', 'ParType', 'Set the instane group on a particle type. The group contains models that will be instanced on the particles of that type.');

  registerUiGroupViewTasksViews(app);
}
