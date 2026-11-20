// Ledger row CMD-B15f (script-implemented commands: sdkui wizards, Evolver lip-sync, UpgradeShaders, default camera,
// OBJ import menu entry, zero-key hot key, GPUSurfaceFX). Note: docs/ghidra/cmd-b15f-misc-scripts.md ("Wire contract"
// of each command, including the `(inferred)` parts) and docs/re/WIRE_CORRECTIONS_B15.md items 38-39.
// Original code written from that prose only; no golden exists.
//
// Shared pieces of the row: session state (`app.miscScriptsB15f`), message boxes, the stand-in plug-in loader,
// small text helpers and the modal-inspection helper.
//
// How this build differs from a Softimage session, and why:
//  * Files go to the session's virtual host file system (`app.hostFs`, CMD-01b); nothing touches a disk.
//  * Message boxes (XSIUIToolkit.MsgBox): the command bus is synchronous, so a box is recorded in
//    `app.miscScriptsB15f.boxes` and logged as an info line. Yes/No boxes ask `state.yesNo(id, arg)`; without a
//    hook the answer is No (inferred: the safe answer).
//  * Modal inspection (the wizards' property pages): `state.inspect(prop, title)` when a test or UI supplies it;
//    otherwise an interactive session opens AfterImage's modal page and returns a Promise; a batch session treats
//    the inspection as Cancel and logs "not yet attested" (as CMD-04b does).
//  * Plug-in loading: a generated script plug-in cannot be executed here. `loadPlugin` is a small ORIGINAL stand-in:
//    it records the plug-in (`state.plugins`) and registers on the bus a command for each RegisterCommand line of
//    the source; that command only logs "<name>_Execute called" (what the generated body does).
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B15f)".
import { App, CommandDef } from '../core/commands';
import { Property } from '../core/scene';
import { siString } from '../ui/si';
import { hostFs, HOSTFS_SEP } from '../core/sdkHelpersHostFs';
import { sdkHelpersState } from './sdkHelpers';

export const B15F_NOTE = 'docs/ghidra/cmd-b15f-misc-scripts.md';
export const B15F_ROW = 'CMD-B15f';

export interface MsgBoxRecord { dict: string; id: number; text: string; args: string[]; yesNo: boolean; answer?: boolean }
export interface PluginRecord { name: string; file: string; commands: string[]; /** key assignment switched off in the source (stand-in heuristic: any command of the file) */ keyless: boolean }
export interface MiscB15fState {
  note: string;
  registered: string[]; replaced: string[];
  boxes: MsgBoxRecord[];
  /** Answer to a Yes/No box; absent = No. */
  yesNo: ((id: number, arg: string) => boolean) | null;
  /** Modal inspection hook; resolves true on OK. Absent = interactive page / batch Cancel. */
  inspect: ((prop: Property, title: string) => boolean | Promise<boolean>) | null;
  plugins: PluginRecord[];
  /** Commands the stand-in plug-in loader registered. */
  pluginCommands: string[];
  /** Make the stand-in loader fail (a "script registration error", message 7199). */
  failLoad: boolean;
  [k: string]: any;
}

export function freshMiscState(): MiscB15fState {
  return { note: B15F_NOTE, registered: [], replaced: [], boxes: [], yesNo: null, inspect: null, plugins: [], pluginCommands: [], failLoad: false };
}
/** The session state; created on first use (the wizard-helper generators can run before the commands are registered). */
export const miscState = (app: App): MiscB15fState => (app as any).miscScriptsB15f ??= freshMiscState();
export const interactive = (app: App) => (app as any).Interactive !== false;
export const errText = (e: any): string => String(e?.description ?? e?.message ?? e);
export const userPath = (): string => sdkHelpersState.paths[1];
export const join = (a: string, b: string) => hostFs.join(a, b);
export const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${B15F_ROW})`);
export const warn = (app: App, t: string) => app.logMsg('info', `WARNING : ${t}`);

/** Dictionary texts of XSIPLUGINUI used by the wizards (the dictionary itself is open question Q5): constant-name meaning, inferred. */
const PLUGINUI_FALLBACK: Record<number, string> = {
  7165: 'Please specify a command name', 7166: 'The command name is already used by a built-in command', 7167: 'The command name is already used by the user command in %s',
  7168: 'No command name specified', 7169: 'No script name specified', 7170: 'No plug-in name specified', 7171: 'Command wizard error: %s',
  7172: 'Please specify a destination', 7173: 'C++ code generation error: %s', 7174: 'C# code generation error: %s', 7176: 'Failed to create the output directory: %s',
  7177: 'Source generation error: %s', 7194: 'Please specify a plug-in name', 7195: 'A plug-in with that name already exists: %s',
  7196: 'A plug-in with that name exists in another file: %s', 7197: 'The file %s exists. Overwrite?', 7198: 'Script generation error: %s', 7199: 'Script registration error',
  7200: 'The file %s exists. Overwrite?', 7201: 'Please specify a toolbar name', 7202: 'Toolbar generation error: %s', 7213: 'Custom Command Wizard',
  7218: 'Plug-in Wizard', 7219: 'Toolbar Wizard', 7220: 'Select a template file', 7221: 'Template Files (*.xsitemplate)|*.xsitemplate',
};
export const pluginUi = (id: number): string => siString('XSIPLUGINUI', id) ?? PLUGINUI_FALLBACK[id] ?? `XSIPLUGINUI ${id}`;

/** XSIUIToolkit.MsgBox: recorded and logged. `yesNo` boxes return the answer of `state.yesNo` (default No). */
export function msgBox(app: App, id: number, arg = '', yesNo = false): boolean {
  const st = miscState(app);
  const text = pluginUi(id).replace('%s', () => arg);
  const rec: MsgBoxRecord = { dict: 'XSIPLUGINUI', id, text, args: arg === '' ? [] : [arg], yesNo };
  if (yesNo) rec.answer = st.yesNo ? !!st.yesNo(id, arg) : false;
  st.boxes.push(rec);
  app.logMsg('info', `MsgBox ${id}: ${text}`);
  return rec.answer ?? true;
}

/** Register a command, noting a replacement of an earlier registration of the same name. */
export function regB15f(app: App, def: CommandDef) {
  const st = miscState(app);
  if (app.commands.has(def.name)) st.replaced.push(def.name);
  app.register(def); st.registered.push(def.name);
}

/** Inspect a wizard / option property. Interactive: Promise of OK; batch: Cancel (false) with a "not yet attested" line. */
export function inspectModal(app: App, cmd: string, prop: Property, title: string, layout: any[], modal: boolean): boolean | Promise<boolean> {
  const st = miscState(app);
  if (st.inspect) return st.inspect(prop, title);
  if (!interactive(app) || typeof document === 'undefined') { nya(app, cmd, `batch mode: the ${modal ? 'modal ' : ''}inspection of "${title}" is treated as Cancel`); return false; }
  return import('../ui/sdkHelpersModal').then(({ sdkModal, renderSdkLayout }) =>
    sdkModal(title, body => renderSdkLayout(body, prop as any, layout), { w: 460, cls: 'sdkh-ppg b15f-wizard' }));
}

/** Non-modal inspection (siLock): the property is selected and shown; nothing blocks. */
export function inspectLocked(app: App, prop: Property, title: string) {
  const st = miscState(app);
  (st.inspected ??= []).push({ name: prop.name, title });
  try { app.run('InspectObj', { InputObjs: [prop], Title: title, Mode: 'siLock' }); } catch { /* the property page is optional here */ }
}

/** Stand-in plug-in loader (see header). Returns false when the stand-in is told to fail. */
export function loadPlugin(app: App, file: string, source: string, pluginName: string): boolean {
  const st = miscState(app);
  if (st.failLoad) return false;
  const old = st.plugins.findIndex(p => p.file.toLowerCase() === file.toLowerCase());
  if (old >= 0) st.plugins.splice(old, 1);
  const commands: string[] = [];
  const re = /RegisterCommand\s*\(\s*["']([^"']+)["']/g; let m: RegExpExecArray | null;
  while ((m = re.exec(source))) commands.push(m[1]);
  for (const name of commands) {
    if (app.commands.has(name) && !st.pluginCommands.includes(name)) continue;   // never shadow a command of this build
    st.pluginCommands.push(name);
    app.commands.set(name, { name, label: name, category: 'Custom', description: `Generated by the SDK wizard (${file})`, args: [], undoable: false,
      execute(a2: App) { a2.logMsg('info', `${name}_Execute called`); } });
  }
  st.plugins.push({ name: pluginName, file, commands, keyless: /SetFlag\(\s*(constants\.)?siSupportsKeyAssignment\s*,\s*(false|0)/i.test(source) });
  return true;
}
export const pluginByName = (app: App, name: string): PluginRecord | undefined => miscState(app).plugins.find(p => p.name.toLowerCase() === name.toLowerCase());

export { hostFs, HOSTFS_SEP };
