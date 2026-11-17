// Ledger row CMD-B6a, shared helpers. Brief: docs/ghidra/cmd-b6a-uixsi-keys-sources-materials.md. Original code.
import { App, type ArgDef, type CommandDef } from '../core/commands';
import { Node, X3DObject, Cluster } from '../core/scene';
import { siString } from '../ui/si';
import { sdkModal, sdkMsgBox } from '../ui/sdkHelpersModal';
import { unset } from './viewEditPropertyHelpers';

export const NOTE = 'docs/ghidra/cmd-b6a-uixsi-keys-sources-materials.md';

/** Session state of this row; also what the check script reads (`app.uixsiKeysSourcesMaterials`). */
export interface UixsiState {
  registered: string[];
  /** Delegated calls of the commands of this row, in order (command name, optionally with a detail in brackets). */
  calls: string[];
  /** In/out and output argument values of the last run of a command (the bus passes arguments by value). */
  out: Record<string, Record<string, any>>;
  lastInspect: { via: 'InspectObj' | 'AutoInspect'; nodes: Node[]; keywords?: string; title?: string; modal?: boolean } | null;
  /** The entries that were on the bus under the same scripting name before this row registered its script entries
   *  (the "native twins" of the note's shared facts). */
  native: Record<string, CommandDef | undefined>;
  /** inferred: the `Views` object is not modelled; its boolean parameters toggled by this row live here. */
  views: Record<string, any>;
  /** The key-assignable / dialog registry entries of names that have two entries (Align, ApplyPath, AssembleNurbsMesh). */
  ui: Record<string, (args?: Record<string, any>) => Promise<any>>;
  uiArgs: Record<string, ArgDef[]>;
}
export function stateOf(app: App): UixsiState {
  return ((app as any).uixsiKeysSourcesMaterials ??= { registered: [], calls: [], out: {}, lastInspect: null, native: {}, views: {}, ui: {}, uiArgs: {} });
}
export function trace(app: App, call: string) { const c = stateOf(app).calls; c.push(call); if (c.length > 400) c.shift(); }

// ------------------------------------------------------------------ translated texts (dictionary XSISCRIPTS)
const XSISCRIPTS_TEXT: Record<number, string> = {
  1008: 'Shapes only store deformations you applied while in a shape modeling construction mode.\n\nYou are not in a shape modeling mode. This suggest that you might have applied deformations in another node, causing your shape to contain no deformation.\n\nFor more information, look up \'construction modes\' in the online help.',
  1009: 'Muliple Selection. Please make a choice:\n\nYes : Delete all, used OR unused, %s\nNo : Delete unused %s only\nCancel : Do not delete any %s',
  1013: 'Please select at least 2 Objects first',
};
export const uixsiText = (id: number): string => siString('XSISCRIPTS', id) ?? XSISCRIPTS_TEXT[id] ?? '';

// ------------------------------------------------------------------ errors, logging
export class Cancelled extends Error {
  readonly siErrCancelled = true;
  constructor(command: string) { super(`${command} cancelled (siErrCancelled)`); this.name = 'siErrCancelled'; }
}
export const logNya = (app: App, command: string, what: string, question = '') => app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
export const logWarning = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);   // the log knows info / error only
export const interactive = (app: App) => (app as any).Interactive !== false;

/** A dialog path runs after the command returned: its failure is logged here, and the returned promise still rejects for callers that await it. */
export function handled<T>(app: App, command: string, p: Promise<T>): Promise<T> {
  p.catch((e: any) => app.logMsg('error', `${command}: ${e?.message ?? e}`));
  return p;
}

/** The note's message box helper: a modal box in a user session; without one, `<title>: <prompt>` is logged and the default answer (OK) returned. */
export function msgBox(app: App, text: string, title: string, okCancel: boolean): boolean | Promise<boolean> {
  if (!interactive(app)) { app.logMsg('info', `${title}: ${text}`); return true; }
  if (!okCancel) return sdkMsgBox(text, title).then(() => true);
  return sdkModal(title, (body) => {
    const msg = document.createElement('div'); msg.className = 'sdkh-msg-text'; msg.textContent = text; msg.style.cssText = 'white-space:pre-wrap;padding:6px';
    body.appendChild(msg);
  }, { w: 440, cls: 'uixsi-msgbox' });
}

// ------------------------------------------------------------------ delegation
/** Run a delegated command of another row. `done` is false when it is not on the bus, or when the bus only has a
 *  placeholder for it (a stub that returns { command, args } and has no behaviour). */
export function delegate(app: App, name: string, args: Record<string, any>): { done: boolean; result?: any } {
  if (!app.commands.has(name)) return { done: false };
  trace(app, name);
  const result = app.run(name, args);
  if (isStub(name, result)) return { done: false };
  return { done: true, result };
}
const isStub = (name: string, r: any) => !!r && typeof r === 'object' && r.command === name && 'args' in r;
/** Run the native twin of a script entry (the entry this row replaced on the bus), with its own defaults. */
export function runNative(app: App, name: string, args: Record<string, any>, question = 'Q9'): { done: boolean; result?: any } {
  const def = stateOf(app).native[name];
  if (!def) { logNya(app, name, `the native ${name} command is not on the bus`, question); return { done: false }; }
  const full: Record<string, any> = {};
  for (const a of def.args) full[a.name] = args[a.name] !== undefined && args[a.name] !== null ? args[a.name] : a.default;
  trace(app, `native ${name}`);
  const result = def.execute(app, full);
  if (isStub(name, result)) { logNya(app, name, `the native ${name} command has no behaviour in this build`, question); return { done: false, result }; }
  return { done: true, result };
}

// ------------------------------------------------------------------ time, preferences
/** inferred: this build's play control has no separate key marker; the current frame stands in unless `anim.keyMarker` is set. */
export function keyTime(app: App): number { const anim = app.anim as any; return Number(anim.keyMarker ?? anim.key ?? app.anim.frame); }
/** The shared "incoming Time differs from the key time" step: write the key time back and move the current frame. */
export function syncTime(app: App, command: string, incoming: any, T: number, before?: () => void) {
  const out = (stateOf(app).out[command] ??= {});
  out.Time = unset(incoming) ? incoming ?? null : Number(incoming);
  if (unset(incoming) || Number(incoming) !== T) { out.Time = T; before?.(); if (app.anim.frame !== T) app.anim.frame = T; }
}
/** A preference value by its scripting path; values live in `app.prefValues` (same bag as the SDK helper row). */
export function pref(app: App, key: string, fallback: any): any {
  const bag = (app as any).prefValues ?? {};
  const hit = Object.keys(bag).find(k => k.toLowerCase() === key.toLowerCase());
  return hit !== undefined ? bag[hit] : fallback;
}

// ------------------------------------------------------------------ inspection, selection
export function inspectObj(app: App, list: Node[], keywords?: string, title?: string, modal = false) {
  trace(app, 'InspectObj');
  stateOf(app).lastInspect = { via: 'InspectObj', nodes: [...list], keywords, title, modal };
  if (list.length && !modal) app.events.emit('inspect', list[0]);   // inferred: the editor opens on the first element
}
export function autoInspect(app: App, list: Node[]) {
  trace(app, 'AutoInspect');
  stateOf(app).lastInspect = { via: 'AutoInspect', nodes: [...list] };
  if (app.autoInspect && list.length) app.events.emit('inspect', list[0]);   // inferred: the editor opens on the first element
}
export const ownerObject = (n: any): X3DObject | null => {
  if (n instanceof Cluster) return n.obj ?? null;
  let x = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null;
};
/** Fill a registry argument list with the caller's values (what `app.run` does for commands on the bus). */
export function fill(defs: ArgDef[], args: Record<string, any> = {}): Record<string, any> {
  const full: Record<string, any> = {};
  for (const a of defs) full[a.name] = args[a.name] !== undefined ? args[a.name] : a.default;
  return full;
}
