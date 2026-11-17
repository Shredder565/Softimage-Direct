// Ledger row CMD-B6e, shared part. Brief: docs/ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md.
// Original code written from that contract only.
//
// Session state, the delegated-call trace, dialogs and argument helpers used by the three command files of the row.
import { App } from '../core/commands';
import { Node, X3DObject, Property, Pass, Partition, Framebuffer } from '../core/scene';
import type { Parameter, ParamSet } from '../core/params';
import { siString } from '../ui/si';
import { siMsgBox } from '../ui/msgBox';
import { sdkModal, renderSdkLayout, type SdkDlgItem } from '../ui/sdkHelpersModal';
import { findNode } from './viewEditPropertyHelpers';
import { findParam } from './index';

export const NOTE = 'docs/ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md';
export const SI_ERR_CANCELLED = 0x4c7;

/** The "command cancelled" script error (siErrCancelled): aborts the command without an error box. */
export class CommandCancelled extends Error {
  readonly cancelled = true; readonly siErrCancelled = SI_ERR_CANCELLED;
  constructor(command: string) { super(`${command} cancelled (siErrCancelled)`); this.name = 'CommandCancelled'; }
}

// ------------------------------------------------------------------ translated texts (dictionary XSISCRIPTS)
// The committed strings table lacks some ids; the attested English text of the note is the fallback. Ids the note
// lists as "not decoded" (1020, 1024, 1027, 1029, 1069, 1134) have no text here: a placeholder naming the id is shown.
const XSISCRIPTS_TEXT: Record<number, string> = {
  1021: 'You must select one clip and at least one object.',
  1022: 'Invalid IN frame. Current frame must be within the clip boundaries.',
  1023: 'Clip must have a scale of 1.',
  1025: '- Selected objects rotations: \n   Period: %s frames ==> Cycle frame: %s',
  1026: 'Click OK to Add Markers...',
  1030: "Multiple periods found: operation 'Add Markers' not possible...",
  1031: "Multiple periods found: operation 'Trim Clip' not possible...",
  1032: 'No period found to be greater than %s frames.',
  1068: 'Duplicate from Animation',
  1070: 'Input Keys',
  1133: 'Store environment cache in mixer',
  1135: 'Caching Options Dialog',
  1177: 'Shader Compound PPG Logic',
  1516: 'ICE Compound PPG Logic',
};
export function text(id: number, ...args: (string | number)[]): string {
  let s = siString('XSISCRIPTS', id) ?? XSISCRIPTS_TEXT[id] ?? `[XSISCRIPTS ${id}: text not yet attested]`;
  for (const a of args) s = s.replace('%s', String(a));
  return s;
}

// ------------------------------------------------------------------ session state
export interface DelegatedCall { name: string; args: unknown[]; via: 'bus' | 'stand-in' | 'not-attested' }
export interface DialogRequest { kind: 'property' | 'input' | 'msgbox'; command: string; title: string; prompt?: string; property?: Property }
export interface DrsState {
  /** Commands the scripts call, in call order, with the values the contract passes (append-only; clear it between runs). */
  calls: DelegatedCall[];
  /** Answer provider standing in for a user at a modal page, input box or message box. For 'property' return true (OK)
   *  or false (Cancel) after editing `property`; for 'input' return the typed text or null (Cancel). */
  dialog: ((req: DialogRequest) => boolean | string | null | undefined) | null;
  /** Stand-in for the preset browser of GetPass: (family, path) -> preset name, or null when nothing is chosen. */
  browsePreset: ((family: string, path: string) => string | null) | null;
  /** Clipboard written by the CopyAnimation stand-in. */
  animClipboard: { target: string; items: { param: string; keys: { time: number; value: number }[]; expr?: string }[] } | null;
  /** Values of in/out and output arguments after the last run of a command (the bus copies its argument record). */
  out: Record<string, Record<string, unknown>>;
  /** Key-assignable UI entries that share a scripting name with the registered scripted entry. */
  ui: Record<string, (args?: Record<string, any>) => any>;
  uiArgs: Record<string, { name: string; default?: any }[]>;
  /** All registry entries (display name + defaults) of the multi-entry commands, for menus. */
  entries: Record<string, { label: string; defaults: Record<string, unknown> }[]>;
  /** Stand-in for the C++ FindPeriods worker (not specified by the note). */
  findPeriods: (inputs: unknown, algorithm: number, start: number, end: number, minPeriod: number) => number[];
  /** Behaviour of the Caching_Options page (CacheObjectsIntoFileDialog), once the command has run. */
  cachingOptions: { property: Property; attributes: string[]; feedback(): string; outputPath(): string; press(button: string): void } | null;
  status: Record<string, 'full' | 'partial' | 'stand-in'>;
}
export function stateOf(app: App): DrsState {
  const a = app as any;
  return a.duplicateRenderingSimulationScripts ?? (a.duplicateRenderingSimulationScripts = {
    calls: [], dialog: null, browsePreset: null, animClipboard: null, out: {}, ui: {}, uiArgs: {}, entries: {}, findPeriods: () => [], cachingOptions: null, status: {},
  } as DrsState);
}

// ------------------------------------------------------------------ small helpers
export const unset = (v: unknown) => v === undefined || v === null || v === '';
export const truthy = (v: unknown) => v === true || (typeof v === 'number' && v !== 0 && !Number.isNaN(v)) || (typeof v === 'string' && /^(true|1|-1)$/i.test(v.trim()));
export const interactive = (app: App) => (app as any).Interactive !== false;
export const info = (app: App, msg: string) => app.logMsg('info', msg);
export const warning = (app: App, msg: string) => app.logMsg('info', `WARNING : ${msg}`);   // the log knows info / error only
export const logError = (app: App, msg: string) => app.logMsg('error', msg);
export const nya = (app: App, command: string, what: string, q = '') => info(app, `${command}: not yet attested: ${what}${q ? ` (${NOTE} ${q})` : ''}`);
export function cancel(command: string): never { throw new CommandCancelled(command); }

/** `:siName:siType` registry token, a bare `siName`, or a number. */
export function enumName(v: unknown): string | number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  const m = /:([A-Za-z0-9_]+):/.exec(s);
  if (m) return m[1];
  return s !== '' && Number.isFinite(Number(s)) ? Number(s) : s;
}

/** Record a delegated call. */
export function trace(app: App, name: string, args: unknown[], via: DelegatedCall['via']) {
  const show = (x: unknown): unknown => Array.isArray(x) ? x.map(show) : x instanceof Node ? siName(app, x) : x && typeof x === 'object' && 'fullName' in (x as any) ? (x as any).fullName : x;
  stateOf(app).calls.push({ name, args: args.map(show), via });
}
/** Run a delegated command that is on the bus (and trace it). */
export function busCall(app: App, name: string, named: Record<string, any>, shown: unknown[] = Object.values(named)): any {
  trace(app, name, shown, 'bus');
  return app.run(name, named);
}

/** Softimage-style name of a node: full name without the scene and scene-root prefix. */
export function siName(app: App, n: { fullName: string; name: string }): string {
  if (n instanceof Pass) return `Passes.${n.name}`;
  if (n instanceof Partition || n instanceof Framebuffer) { const p = (n as any).parent as Node | null; return p instanceof Pass ? `Passes.${p.name}.${n instanceof Partition ? 'Partitions.' : ''}${n.name}` : n.name; }
  const root = app.scene.root.fullName + '.';
  const f = n.fullName;
  return f.startsWith(root) ? f.slice(root.length) : f === app.scene.root.fullName ? app.scene.root.name : f;
}

export const currentPass = (app: App): Pass | undefined => ((app.scene as any).currentPass as Pass | undefined) ?? app.scene.passes[app.scene.passes.length - 1];
/** A pass argument: a Pass, a name, `Passes.<name>`, or `Passes.Current` / empty for the current pass. */
export function passOf(app: App, x: unknown): Pass | undefined {
  if (x instanceof Pass) return x;
  if (Array.isArray(x)) return passOf(app, x[0]);
  const s = String(x ?? '').trim();
  if (s === '' || /^Passes\.Current$/i.test(s)) return currentPass(app);
  const name = s.replace(/^Passes\.(List\.)?/i, '');
  return app.scene.passes.find(p => p.name === name);
}
/** One element of a collection argument: scene nodes, passes, partitions, framebuffers. */
export function nodeOf(app: App, x: unknown): Node | undefined {
  if (x instanceof Node) return x;
  if (typeof x !== 'string') return undefined;
  const s = x.trim(); if (!s) return undefined;
  const found = findNode(app, s); if (found) return found;
  if (/^Passes\./i.test(s) || app.scene.passes.some(p => p.name === s)) {
    const parts = s.replace(/^Passes\.(List\.)?/i, '').split('.');
    const pass = /^Current$/i.test(parts[0]) ? currentPass(app) : app.scene.passes.find(p => p.name === parts[0]);
    if (!pass) return undefined;
    if (parts.length === 1) return pass;
    const leaf = parts[parts.length - 1];
    return pass.partitions.find(p => p.name === leaf) ?? pass.framebuffers.find(f => f.name === leaf);
  }
  if (s === app.scene.root.name) return app.scene.root;
  return undefined;
}
/** A Collection argument (selection when empty). `null` when the value is not a collection at all. */
export function collection(app: App, arg: unknown): Node[] | null {
  if (unset(arg)) return [...app.selection];
  const list = Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',') : arg instanceof Node ? [arg] : null;
  if (!list) return null;
  const out: Node[] = [];
  for (const x of list) { const n = nodeOf(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
export function ownerObject(n: unknown): X3DObject | null { let x: any = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null; }
export function paramOf(app: App, x: unknown): Parameter | undefined {
  if (x && typeof x === 'object' && 'def' in (x as any) && 'owner' in (x as any)) return x as Parameter;
  if (typeof x !== 'string' || !x.trim()) return undefined;
  const s = x.trim();
  try { const p = findParam(app, s); if (p) return p as Parameter; } catch { /* fall through */ }
  for (const p of app.anim.fcurves.keys()) if (p.fullName === s) return p;
  for (const p of app.anim.marked) if (p.fullName === s) return p;
  return undefined;
}
export function keepSelection<T>(app: App, f: () => T): T {
  const sel = [...app.selection]; const comp = app.compSel; const mode = app.selMode;
  try { return f(); } finally { app.selection = sel; app.compSel = comp; app.selMode = mode; app.events.emit('selection'); }
}

// ------------------------------------------------------------------ dialogs
type MaybePromise<T> = T | Promise<T>;
/** Continue after a value that is either at hand or a Promise. A cancelled interactive command rejects with
 *  CommandCancelled; the rejection is marked handled so a menu click does not surface it as an unhandled error. */
export function after<T, R>(v: MaybePromise<T>, f: (v: T) => R): MaybePromise<R> {
  if (!(v instanceof Promise)) return f(v);
  const p = v.then(f);
  p.catch(() => { /* handled: siErrCancelled has no error box */ });
  return p;
}
/** Modal property page ("wizard dialog"). OK = true. A hook answers at once; in batch mode the inspect call fails,
 *  which counts as Cancel (note, "Enable conditions and errors", inferred there). */
export function modalPage(app: App, command: string, title: string, prop: Property, build: (body: HTMLElement) => void): MaybePromise<boolean> {
  const hook = stateOf(app).dialog;
  if (hook) return hook({ kind: 'property', command, title, property: prop }) === true;
  if (!interactive(app)) return false;
  return sdkModal(title, build, { cls: 'drs-modal' });
}
export const layoutBuilder = (set: ParamSet, items: SdkDlgItem[]) => (body: HTMLElement) => renderSdkLayout(body, set, items);
/** Text input box: the typed text, or null when cancelled. */
export function inputBox(app: App, command: string, prompt: string, title: string): MaybePromise<string | null> {
  const hook = stateOf(app).dialog;
  if (hook) { const r = hook({ kind: 'input', command, title, prompt }); return typeof r === 'string' ? r : null; }
  if (!interactive(app)) return null;
  let field: HTMLInputElement | null = null;
  return sdkModal(title, (body) => {
    const l = document.createElement('div'); l.textContent = prompt; l.style.cssText = 'white-space:pre-wrap;padding:2px 0 6px';
    field = document.createElement('input'); field.type = 'text'; field.className = 'drs-input'; field.style.cssText = 'box-sizing:border-box;width:100%';
    body.append(l, field);
  }, { cls: 'drs-modal drs-inputbox' }).then(ok => (ok ? field?.value ?? '' : null));
}
/** The shared message box helper: in batch mode it logs `<title>: <prompt>` and answers OK. */
export function msgBox(app: App, command: string, prompt: string, title: string) {
  const hook = stateOf(app).dialog;
  if (hook) { hook({ kind: 'msgbox', command, title, prompt }); return; }
  if (!interactive(app)) { info(app, `${title}: ${prompt}`); return; }
  siMsgBox(prompt, title);
}
/** A temporary property on the scene root (added and removed directly: the page is not part of the undo history). */
export function withRootProperty(app: App, prop: Property) {
  app.scene.root.addProperty(prop);
  return () => { app.scene.root.removeProperty(prop); app.events.emit('scene'); };
}
