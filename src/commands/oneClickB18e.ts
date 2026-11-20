// Ledger row CMD-B18e: the 19 OneClick "Send To Maya / 3ds Max / Mudbox" commands of iceflow.dll.
// Brief: docs/ghidra/cmd-b18e-iceflow-oneclick.md section 4 (Wire contract) and docs/re/WIRE_CORRECTIONS_B18.md
// items 13-18. Original code written from that prose only.
//
// There is no remote application in the browser. The Synergy link is modelled by a stand-in state object,
// `app.oneClickB18e` (see OneClickState): `link.app` is the connected remote app name (null = not connected,
// Softimage's "link state != 2"), `link.busy` the manager busy flag. A send that reaches the end builds a message
// record and, when a link exists, puts it in `outbox`; the Synergy encoding / socket send itself is not attested and
// logs so. The XSIPLUGINUI texts are not attested either: they are returned / shown as `[XSIPLUGINUI 0x....]`.
import { App } from '../core/commands';
import { Node, Property } from '../core/scene';
import { bool, int } from '../core/params';
import { siFullName, findByName, interactive } from './addonScriptsShared';

const ROW = 'CMD-B18e';
export const MAYA = 'Maya';
export const MAX = '3ds Max';
export const MUDBOX = 'Mudbox';

/** Placeholder for an XSIPLUGINUI dictionary text (ids from the note; the texts were not read). */
export const uiText = (id: number) => `[XSIPLUGINUI 0x${id.toString(16)}]`;
/** printf-style `%s` substitution for the prompt / error templates (the template text itself is a placeholder). */
const fmt = (id: number, s: string) => `${uiText(id)} ${s}`;

export interface OneClickMessage {
  kind: 'DCCToICE' | 'ICEToDCC' | 'DCCToMudbox';
  to: string; fbx: string; cacheFolder?: string; newScene: boolean; addToScene: boolean;
}
export interface OneClickState {
  /** Stand-in for the Synergy link: connected app name or null; busy = manager busy flag. */
  link: { app: string | null; busy: boolean };
  /** Manager status text (OneClickGetStatusText). */
  status: string;
  /** Selection.GetAsText() remembered at the start of the last PrepareToSend (process-wide). */
  savedSelection: string;
  /** Stand-in answer to the OK/Cancel prompt shown on an empty selection: 1 = OK, 2 = Cancel. */
  promptAnswer: 1 | 2;
  /** Stand-in for the ICE trees recorded by the (not read) SendBack gather steps. */
  sendBackIceTrees: Node[] | null;
  /** Folder for the temp FBX (GetTempPathA stand-in) and the manager-held workflow folder. */
  tempDir: string; workflowDir: string;
  /** Workflow data of the current send (CleanData resets it). */
  workflow: Record<string, any>;
  progress: { caption: string; value: number } | null;
  sceneFileName: string;
  /** Messages that would have been sent over the link; raised = remote windows raised. */
  outbox: OneClickMessage[]; raised: string[]; prompts: { text: string; title: string }[];
  inspected: Node[]; trace: string[];
  tempSeq: number;
}

export function oneClickStateOf(app: App): OneClickState {
  const A = app as any;
  return (A.oneClickB18e ??= {
    link: { app: null, busy: false }, status: '', savedSelection: '', promptAnswer: 1, sendBackIceTrees: null,
    tempDir: 'C:\\Temp\\', workflowDir: '', workflow: {}, progress: null, sceneFileName: '',
    outbox: [], raised: [], prompts: [], inspected: [], trace: [], tempSeq: 0,
  } satisfies OneClickState);
}

const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
const trace = (st: OneClickState, t: string) => { st.trace.push(t); if (st.trace.length > 200) st.trace.shift(); };
const connected = (st: OneClickState) => st.link.app != null;

// ------------------------------------------------------------------ selection text (Selection.GetAsText / SetAsText)

export function selectionAsText(app: App): string { return app.selection.map(n => siFullName(n)).join(','); }
export function setSelectionAsText(app: App, text: string) {
  const nodes = String(text ?? '').split(',').map(s => s.trim()).filter(Boolean).map(s => findByName(app, s)).filter((n): n is Node => n instanceof Node);
  app.select(nodes);
}

// ------------------------------------------------------------------ ICEFlowState / temp files / FBX export

export const ICEFLOWSTATE = 'ICEFlowState';
export const iceFlowStateOf = (app: App): Property | undefined => app.scene.root.properties.find(p => p.name === ICEFLOWSTATE || p.type === ICEFLOWSTATE);

function addIceFlowState(app: App, cmd: string): Property {
  // ICEFlowState_Define was not read: the two parameters the note names, with (inferred) defaults.
  const p = new Property(ICEFLOWSTATE, ICEFLOWSTATE, [int('CrowdExportType', 0, 'Crowd Export Type'), bool('ExportVisibilityAsShow', false, 'Export Visibility As Show')]);
  p.shared = false;
  app.scene.root.addProperty(p);
  app.events.emit('scene');
  nya(app, cmd, 'ICEFlowState_Define (other parameters, defaults and layout)');
  return p;
}

/** GetTempFileNameA(dir, prefix, 0) with the `.tmp` cut and `.fbx` appended (published Win32 API naming:
 *  <dir><prefix, up to 3 chars><hex unique>.TMP). */
function tempFbxName(st: OneClickState, dir: string, prefix: string): string {
  const d = dir || st.tempDir; if (!d) return '';
  const u = ((Date.now() + ++st.tempSeq) & 0xffff).toString(16).toUpperCase();
  const tmp = `${d.endsWith('\\') ? d : d + '\\'}${prefix.slice(0, 3)}${u}.tmp`;
  return tmp.slice(0, -4) + '.fbx';
}
/** mktemp-style `ITXXXXXX` folder under the workflow folder. */
function cacheFolderName(st: OneClickState): string {
  const base = st.workflowDir || st.tempDir; if (!base) return '';
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = ''; for (let i = 0; i < 6; i++) s += abc[(Date.now() + st.tempSeq * 7 + i * 13) % abc.length];
  return `${base.endsWith('\\') ? base : base + '\\'}IT${s}`;
}

/** Embedded VBScript OneClickExportFBX(fname, setName, exportSelection, remoteAppName). */
function oneClickExportFbx(app: App, cmd: string, fname: string, setName: string, exportSelection: boolean, remote: string): boolean {
  const root = app.scene.root;
  const old = root.properties.find(p => p.name === 'ExportFBXOptions');
  if (old) old.name = 'OneClickBackupFBXExportOptions';
  try {
    app.run('FBXExport', { FilePathName: 'options' });
    app.run('FBXExportSelection', { State: exportSelection });
    const opts = root.properties.find(p => p.name === 'ExportFBXOptions');
    opts?.set('ExportOneClickMode', true);
    opts?.set('GeometryCacheFile', false);
    if (setName) { opts?.set('GeometryCacheFile', true); app.run('FBXExportGroupAsCache', { Group: setName }); }   // (inferred) condition
    const vis = remote === MAYA ? !!iceFlowStateOf(app)?.get('ExportVisibilityAsShow')?.value : false;
    opts?.set('ExportVisibilityAsShow', vis);
    nya(app, cmd, `FBXExport "${fname}" (FBX file writing, SYS-03)`);
  } finally {
    const i = root.properties.findIndex(p => p.name === 'ExportFBXOptions');
    if (i >= 0) root.properties.splice(i, 1);
    if (old) old.name = 'ExportFBXOptions';
    app.events.emit('scene');
  }
  return true;
}

// ------------------------------------------------------------------ workflows

function begin(app: App, st: OneClickState) {
  st.status = uiText(0x1c6a);
  st.sceneFileName = String((app.scene as any).fileName ?? (app as any).sceneFileName ?? '');
  st.workflow = {};   // CleanData
  st.progress = { caption: uiText(0x1c63), value: 0 };
}
const step = (st: OneClickState) => { if (st.progress) st.progress.value++; };
function finish(st: OneClickState) { st.progress = null; st.workflow.shown = true; st.status = uiText(0x1c6c); }

/** Empty selection: OK/Cancel prompt (stand-in answer); false = the user cancelled. */
function promptWholeScene(app: App, st: OneClickState, cmd: string, remote: string): boolean {
  st.prompts.push({ text: fmt(0x1c65, remote), title: uiText(0x1c69) });
  nya(app, cmd, `prompt text XSIPLUGINUI 0x1c65 / 0x1c69 (answered ${st.promptAnswer === 2 ? 'Cancel' : 'OK'} by the stand-in)`);
  return st.promptAnswer !== 2;
}

function raiseAndSend(app: App, st: OneClickState, cmd: string, msg: OneClickMessage, raise: boolean) {
  if (raise) {
    if (!connected(st)) { trace(st, 'Connection is not initiated, and cannot be started.'); app.logMsg('info', `${cmd}: Connection is not initiated, and cannot be started.`); return; }
    st.raised.push(msg.to);
  }
  if (!connected(st)) { trace(st, `${cmd}: no link, message to ${msg.to} not sent`); return; }
  st.outbox.push(msg);
  nya(app, cmd, `Synergy message encoding and send to "${msg.to}"`);
}

/** ICEWorkflow (Maya / 3ds Max): SendNewScene (1,0) / UpdateCurrentScene (0,0) / AddToCurrentScene (0,1). */
function iceSend(app: App, cmd: string, remote: string, newScene: boolean, addToScene: boolean): undefined {
  const st = oneClickStateOf(app);
  begin(app, st);
  st.savedSelection = selectionAsText(app); step(st);
  if (app.selection.length === 0) {
    if (!promptWholeScene(app, st, cmd, remote)) { st.progress = null; trace(st, 'Aborting the Send operation as user does not want to send the entire scene'); return undefined; }
    app.select([...app.scene.allObjects()]);   // VBScript OneClickSelectAll("")
  }
  st.workflow.timeSpan = [app.anim.startFrame, app.anim.endFrame]; step(st);
  nya(app, cmd, 'ICE gather step after the time span');
  const cache = cacheFolderName(st);
  if (!cache) { st.progress = null; trace(st, 'Cannot write cache files'); return undefined; }
  st.workflow.cacheFolder = cache;
  const fbx = tempFbxName(st, st.workflowDir, 'ICE');
  if (!fbx) { st.progress = null; trace(st, 'File name length is empty'); return undefined; }
  st.workflow.fbx = fbx; step(st);
  const crowd = Number(iceFlowStateOf(app)?.get('CrowdExportType')?.value ?? 0) || 0;
  if (app.commands.has('CrowdFBXPlot_ExportMode')) app.run('CrowdFBXPlot_ExportMode', { ExportAsGeometry: crowd });
  st.workflow.crowdExportType = crowd; step(st);
  nya(app, cmd, 'ICE gather / cache steps (which ICE trees and attributes; the group name passed to the FBX export)');
  oneClickExportFbx(app, cmd, fbx, String(st.workflow.groupName ?? ''), true, remote); step(st);
  st.workflow.cachedAttributes = 'PointVelocity,Age,AgeLimit,Orientation,AngularVelocity,Position,Id,Color,Size,Mass';
  nya(app, cmd, 'ICE cache file writing'); step(st);
  const msg: OneClickMessage = { kind: 'DCCToICE', to: remote, fbx, cacheFolder: cache, newScene, addToScene };
  finish(st);
  raiseAndSend(app, st, cmd, msg, true);
  return undefined;
}

/** ICEWorkflow::SendBack for "3ds Max" (OneClickSendToMax and OneClickSendTo "3ds Max"). */
function sendBack(app: App, cmd: string): undefined {
  const st = oneClickStateOf(app); const remote = MAX;
  begin(app, st);
  nya(app, cmd, 'SendBack gather / cache steps (time span etc.)');
  const failures = 0;
  const trees = st.sendBackIceTrees ?? [];
  st.workflow.iceTrees = trees;
  if (!failures && trees.length === 0) {
    st.prompts.push({ text: fmt(0x1c65, remote), title: uiText(0x1c55) });
    st.progress = null;
    trace(st, 'Aborting the Send operation as there are no ICE Tree to cache');
    app.logMsg('info', `${cmd}: Aborting the Send operation as there are no ICE Tree to cache`);
    return undefined;
  }
  nya(app, cmd, 'SendBack write steps');
  raiseAndSend(app, st, cmd, { kind: 'ICEToDCC', to: remote, fbx: '', newScene: false, addToScene: false }, false);
  st.progress = null; st.status = uiText(0x1c6c);
  return undefined;
}

/** MudboxWorkflow: SendNewScene (1,0) / UpdateCurrentScene (0,0) / AddToCurrentScene (0,1). */
function mudboxSend(app: App, cmd: string, newScene: boolean, addToScene: boolean): undefined {
  const st = oneClickStateOf(app); const remote = MUDBOX;
  begin(app, st);
  st.workflow.timeSpan = [app.anim.startFrame, app.anim.endFrame]; step(st);
  st.savedSelection = selectionAsText(app);
  let exportSelection = true;
  if (app.selection.length === 0) {
    if (!promptWholeScene(app, st, cmd, remote)) { st.progress = null; trace(st, 'Aborting the Send operation as user does not want to send the entire scene'); return undefined; }
    exportSelection = false;
  }
  const fbx = tempFbxName(st, st.tempDir, 'MBX');
  if (!fbx) { st.progress = null; trace(st, 'File name length is empty'); return undefined; }
  st.workflow.fbx = fbx; st.workflow.exportSelection = exportSelection; step(st);
  oneClickExportFbx(app, cmd, fbx, '', exportSelection, remote); step(st);
  finish(st);
  raiseAndSend(app, st, cmd, { kind: 'DCCToMudbox', to: remote, fbx, newScene, addToScene }, true);
  return undefined;
}

function restoreSelection(app: App): undefined { setSelectionAsText(app, oneClickStateOf(app).savedSelection); return undefined; }

// ------------------------------------------------------------------ registration

export function registerOneClickB18eCommands(app: App) {
  const reg = (name: string, execute: (app: App, a: any) => unknown, args: { name: string; default: unknown }[] = []) =>
    app.register({ name, label: name, category: 'Custom', args, undoable: false, noLog: true, execute });
  oneClickStateOf(app);

  reg('OneClickSetup', (app) => {
    const st = oneClickStateOf(app);
    const p = iceFlowStateOf(app) ?? addIceFlowState(app, 'OneClickSetup');
    st.inspected.push(p);
    if (interactive(app)) app.events.emit('inspect', p);
    return undefined;
  });
  reg('OneClickGetState', (app) => {
    const st = oneClickStateOf(app);
    if (!connected(st)) return '';
    return uiText(st.link.busy ? 0x1c6e : 0x1c6d);
  });
  reg('OneClickGetStatusText', (app) => oneClickStateOf(app).status);
  reg('OneClickGetRemoteAppName', (app) => oneClickStateOf(app).link.app ?? '');   // (inferred) name lookup 0x18003a310 not read

  for (const n of ['OneClickSelectObjects', 'OneClickSendToMayaSelectPreviousObjects', 'OneClickSendTo3dsMaxSelectPreviousObjects', 'OneClickSendToMudboxSelectPreviousObjects'])
    reg(n, restoreSelection);

  const FLAGS = { SendAsNewScene: [true, false], UpdateCurrentScene: [false, false], AddToCurrentScene: [false, true] } as const;
  for (const [suffix, [ns, add]] of Object.entries(FLAGS)) {
    reg(`OneClickSendToMaya${suffix}`, (app) => iceSend(app, `OneClickSendToMaya${suffix}`, MAYA, ns, add));
    reg(`OneClickSendTo3dsMax${suffix}`, (app) => iceSend(app, `OneClickSendTo3dsMax${suffix}`, MAX, ns, add));
    reg(`OneClickSendToMudbox${suffix}`, (app) => mudboxSend(app, `OneClickSendToMudbox${suffix}`, ns, add));
  }
  reg('OneClickSendToMax', (app) => sendBack(app, 'OneClickSendToMax'));
  reg('OneClickSendTo', (app, a) => {
    const name = a.RemoteApp == null ? '' : String(a.RemoteApp);
    if (name === MUDBOX) return mudboxSend(app, 'OneClickSendTo', false, false);
    if (name === MAX) return sendBack(app, 'OneClickSendTo');
    return iceSend(app, 'OneClickSendTo', name, false, false);
  }, [{ name: 'RemoteApp', default: null }]);
}

