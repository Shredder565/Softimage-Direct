// Ledger row CMD-B16c (tasks.dll): undo group / undo-redo, refresh, drop message, performance test, DeleteObj with
// DeleteCurrentLayer / DeleteCurrentPass, CopyPaste, Add3DObjectToScene, SetReference2.
// Brief: docs/ghidra/cmd-b16c-tasks-undo-refresh-delete.md ("Wire contract" per command) and items 22-28 of
// docs/re/WIRE_CORRECTIONS_B16.md. Original code written from those prose contracts only; no XSIBATCH golden exists.
//
// Where each command lives on the bus (fixed in place, not duplicated):
//   Undo / Redo / DeleteObj ......................... src/commands/index.ts (bodies here: undoSteps, deleteObjList)
//   BeginUndo / EndUndo ............................. src/commands/viewEditPropertyMore.ts
//   DelayedRefresh / ResetDirectX / SetDropMessage /
//   RunPerformanceTest .............................. src/commands/inferredB10Views.ts (body here: runPerformanceTest)
//   RefreshCustomPreferences ........................ src/commands/inferredB10Scene.ts
//   DeleteCurrentPass ............................... src/commands/moduleToolbar.ts
//   CopyPaste / DeleteCurrentLayer .................. src/commands/inferredB15.ts (body here: copyPaste)
//   Add3DObjectToScene / SetReference2 .............. registered below (not on the bus before this row)
//
// How the contracts are mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name, ends "(status 0x...)").
//  * Output arguments are not written back through `app.run`; they are kept in `app.tasksB16c.out[<command>]`
//    (Undo / Redo `Repetitions`), and the command also returns the value.
//  * The scene-invalid notifications of the DeleteObj worker are kept in `app.tasksB16c.notifications`.
//  * Parts the analyst could not read log "<command>: not yet attested: <what> (CMD-B16c)" and change nothing.
import { App, type UndoEntry } from '../core/commands';
import { Node, X3DObject, Cluster, Layer, Pass, Shader, Model } from '../core/scene';
import { Parameter } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { SiStatusError } from './alembicSeqCam';
import { isLocked } from './inferredB10Scene';
import { currentPass } from './duplicateRenderingSimulationScriptsShared';
import { resolvePort, resolveNode, getSource, setSourceRaw, type PortRef } from '../core/textureLayers';

export const ROW = 'CMD-B16c';
export const S_FALSE = 1, E_INVALIDARG = 0x80070057, E_UNEXPECTED = 0x8000ffff, E_ACCESSDENIED = 0x80070005, E_POINTER = 0x80004003;
/** 0x562E80D2: the DeleteObj list expansion found nothing to delete (inferred meaning). */
export const SI_NOTHING = 0x562e80d2;
export const LAYERS_CURRENT = '{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:Layers.Current';
export const PASSES_CURRENT = '{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:Passes.Current';
export const NO_NAME_OPERATION = 'No-name operation';

export interface TasksB16cState {
  /** Output arguments per command (Undo / Redo: { Repetitions }). */
  out: Record<string, Record<string, any>>;
  /** Scene notifications sent by the DeleteObj worker, in order. */
  notifications: string[];
  /** Last non-failure status per command (S_FALSE, SI_NOTHING). */
  status: Record<string, number>;
  /** Text of the drag-and-drop service (SetDropMessage). */
  dropMessage: string;
  /** True while Undo / Redo steps run (the undo manager's state query is then non-zero; inferred). */
  undoing: boolean;
  /** Last CopyPaste: the paste operation code used (8 / 4 / 2) and the mode asked. */
  lastPaste: { mode: number; operation: number } | null;
  /** SetReference2 references: port -> { value, time in seconds }. */
  lastReference: { port: PortRef; value: Node | null; seconds: number | null } | null;
  /** The host file system the performance report is appended to (inspection seam for tools/compare_tasks_b16c.mjs). */
  fs: typeof hostFs;
}
export function tasksB16c(app: App): TasksB16cState {
  return ((app as any).tasksB16c ??= { out: {}, notifications: [], status: {}, dropMessage: '', undoing: false, lastPaste: null, lastReference: null, fs: hostFs });
}
export const unset = (v: any) => v === undefined || v === null || v === '';
export const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
export const logNya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
/** Frames -> seconds at the scene frame rate (SIFramesToSeconds). */
export const framesToSeconds = (app: App, frames: number) => frames / (Number(app.anim.fps) || 30);

// ====================================================================================================== Undo / Redo
/**
 * Undo / Redo `Repetitions` times. Every repetition asks for one step (the loop does not stop early); the steps that
 * found something are summed. With Repetitions 1 the entry name is logged ("Undo <name>"). When fewer steps were done,
 * the Repetitions output holds the count actually done. Returns that count.
 */
export function undoSteps(app: App, cmd: 'Undo' | 'Redo', repetitions: any): number {
  const st = tasksB16c(app);
  const num = unset(repetitions) ? 1 : Number(repetitions);
  if (!Number.isFinite(num)) throw fail(cmd, E_INVALIDARG, `Repetitions ${repetitions} is not an unsigned integer`);
  const n = Math.max(0, Math.floor(num));
  const from = cmd === 'Undo' ? app.undoStack : app.redoStack;
  const to = cmd === 'Undo' ? app.redoStack : app.undoStack;
  let count = 0; let name: string | null = null;
  st.undoing = true;
  try {
    for (let i = 0; i < n; i++) {
      const e: UndoEntry | undefined = from.pop(); if (!e) continue;
      if (cmd === 'Undo') e.undo(); else e.redo();
      to.push(e); count++; name = e.label;
    }
  } finally { st.undoing = false; }
  if (count) { app.events.emit('undo'); app.events.emit('scene'); app.events.emit('params'); }
  if (n === 1 && name !== null) app.logMsg('info', `${cmd} ${name}`); // inferred: the exec-context label
  st.out[cmd] = { Repetitions: count === n ? n : count };
  st.status[cmd] = S_FALSE;
  return count;
}

// ====================================================================================================== DeleteObj
/** The current layer (Layers.Current). */
export const currentLayer = (app: App): Layer | undefined => ((app as any).currentLayer as Layer | undefined) ?? app.scene.layers[0];
/** Strip the `{class guid}:` prefix of a registry default list string. */
const stripGuid = (s: string) => s.replace(/^\{[0-9a-f-]{36}\}:/i, '').trim();

/** Resolve a DeleteObj InputObj into the list of items (objects, clusters, layers, passes, other nodes). */
export function deleteList(app: App, v: any): any[] {
  if (unset(v)) {
    // inferred: an empty list argument is the selection (component clusters included)
    return [...app.selection];
  }
  const out: any[] = [];
  const add = (x: any) => { if (x && !out.includes(x)) out.push(x); };
  const one = (x: any) => {
    if (x === null || x === undefined || x === '') return;
    if (Array.isArray(x)) { x.forEach(one); return; }
    if (typeof x !== 'string') { add(x); return; }
    for (const part of x.split(',')) {
      const s = stripGuid(part); if (!s) continue;
      if (/^Layers\.Current$/i.test(s)) { add(currentLayer(app)); continue; }
      if (/^Passes\.Current$/i.test(s)) { add(currentPass(app)); continue; }
      const lm = /^Layers\.(.+)$/.exec(s); if (lm) { add(app.scene.layers.find(l => l.name === lm[1])); continue; }
      const pm = /^Passes\.(.+)$/.exec(s); if (pm) { add(app.scene.passes.find(p => p.name === pm[1])); continue; }
      const o = app.scene.find(s); if (o) { add(o); continue; }
      add(app.scene.layers.find(l => l.name === s) ?? app.scene.passes.find(p => p.name === s));
    }
  };
  one(v);
  return out;
}

/**
 * The DeleteObj worker (handler dd531990, mode 0): expands the list, sends SI3D_SCENE_INVALID_BEGIN, deletes every
 * item (undoable through app.record), sends SI3D_SCENE_INVALID_END. Nothing to delete -> SI_NOTHING, no change.
 */
export function deleteObjList(app: App, cmd: string, input: any): number {
  const st = tasksB16c(app);
  const items = deleteList(app, input);
  const sc = app.scene;
  const doable: (() => boolean)[] = [];
  let objectsGone = false;
  for (const n of items) {
    if (n instanceof Cluster) {
      const o = n.obj; if (!o) continue;
      doable.push(() => { app.record('Delete ' + n.name, () => o.removeCluster(n), () => o.addCluster(n)); return true; });
      objectsGone = true;
    } else if (n instanceof Layer) {
      const ls = sc.layers;
      if (!ls.includes(n)) continue;
      if (ls.length < 2) { logNya(app, cmd, `deleting the last layer (${n.name})`); continue; } // inferred: the default layer stays
      doable.push(() => {
        const def = ls.find(x => x !== n)!; const idx = ls.indexOf(n); const members = [...n.members]; const wasCur = (app as any).currentLayer;
        // inferred: the members of a deleted layer move to the remaining (default) layer
        app.record('Delete ' + n.name, () => { ls.splice(ls.indexOf(n), 1); for (const o of members) { (o as any).layer = def; def.members.add(o); } if ((app as any).currentLayer === n) (app as any).currentLayer = def; },
          () => { ls.splice(idx, 0, n); for (const o of members) { def.members.delete(o); (o as any).layer = n; n.members.add(o); } (app as any).currentLayer = wasCur; });
        return true;
      });
    } else if (n instanceof Pass) {
      const ps = sc.passes;
      if (!ps.includes(n)) continue;
      if (ps.length < 2) { logNya(app, cmd, `deleting the last pass (${n.name})`); continue; } // inferred: a scene keeps one pass
      doable.push(() => {
        const S = sc as any; const idx = ps.indexOf(n); const before = S.currentPass;
        app.record('Delete ' + n.name, () => { ps.splice(ps.indexOf(n), 1); if (S.currentPass === n) S.currentPass = ps[ps.length - 1]; },
          () => { ps.splice(idx, 0, n); S.currentPass = before; });
        return true;
      });
    } else if (n instanceof X3DObject) {
      if (n === sc.root || !n.parentObj) continue;
      const p = n.parentObj; const o = n;
      doable.push(() => {
        if (o.parentObj !== p) return false; // already removed with an ancestor in this list
        const idx = p.children.indexOf(o);
        app.record('Delete ' + o.name, () => p.removeChild(o), () => { p.addChild(o); p.children.splice(p.children.indexOf(o), 1); p.children.splice(idx, 0, o); });
        return true;
      });
      objectsGone = true;
    } else if (n instanceof Node || n instanceof Parameter) {
      logNya(app, cmd, `deleting ${(n as any).fullName ?? (n as any).name ?? 'this item'} (list expansion rules of DeleteObj for this kind)`);
    }
  }
  if (!doable.length) { st.status[cmd] = SI_NOTHING; return 0; }
  st.notifications.push('SI3D_SCENE_INVALID_BEGIN');
  let n = 0;
  try { for (const d of doable) if (d()) n++; } finally { st.notifications.push('SI3D_SCENE_INVALID_END'); }
  if (objectsGone) app.select([]);
  app.events.emit('scene');
  st.status[cmd] = S_FALSE;
  return n;
}

// ====================================================================================================== CopyPaste
/** Mode -> paste operation code: 1 -> 8, 2 -> 4, 3 -> 2, 0 -> the service default. */
export const PASTE_OPERATION: Record<number, number> = { 1: 8, 2: 4, 3: 2 };
const isObjArg = (v: any) => v !== null && typeof v === 'object';
function nodeOf(app: App, v: any): any {
  if (unset(v)) return null;
  if (Array.isArray(v)) return v.length ? nodeOf(app, v[0]) : null;
  if (v instanceof Node || v instanceof Parameter) return v;
  if (typeof v === 'string') return app.scene.find(v.trim()) ?? resolveNode(app.scene, v.trim());
  return v;
}

export function copyPaste(app: App, a: Record<string, any>): any {
  const C = 'CopyPaste'; const st = tasksB16c(app);
  // UnPackArg 1-2: _Source (an object) wins over Source; exactly one of Source / FileName.
  const source = isObjArg(a._Source) ? a._Source : nodeOf(app, a.Source);
  const file = unset(a.FileName) ? '' : String(a.FileName);
  if (!source && !file) throw fail(C, E_INVALIDARG, 'neither Source nor FileName is given');
  if (source && file) throw fail(C, E_UNEXPECTED, 'both Source and FileName are given');
  // 3. _Target likewise, else Target
  const target = isObjArg(a._Target) ? a._Target : nodeOf(app, a.Target);
  // 4. Mode: unsigned, < 4
  const mode = unset(a.Mode) ? 0 : Number(a.Mode);
  if (!Number.isInteger(mode) || mode < 0 || mode >= 4) throw fail(C, E_INVALIDARG, `Mode ${a.Mode} is not 0..3`);
  if (file) { logNya(app, C, `loading the source from ${file} (clipboard / drag-and-drop service slot 15)`); return undefined; }
  // Worker: needs both source and target, else nothing done.
  if (!target) { app.logMsg('info', `${C}: no Target; nothing pasted`); st.status[C] = S_FALSE; return undefined; }
  // Paste capabilities of source on target (service slot 12). inferred: an object onto an object allows connect (2),
  // copy (4) and move (8), the default being copy; other source / target kinds are not attested.
  if (!(source instanceof X3DObject) || !(target instanceof X3DObject)) {
    logNya(app, C, `pasting ${source?.constructor?.name ?? typeof source} onto ${target?.constructor?.name ?? typeof target} (paste capabilities of the service)`);
    return undefined;
  }
  const allowed = 2 | 4 | 8; const def = 4; // inferred
  let op = mode === 0 ? def : PASTE_OPERATION[mode];
  if (!(allowed & op)) op = def;
  st.lastPaste = { mode, operation: op };
  if (op === 4) { // inferred: copy; the user clipboard is left alone
    const clip = (app as any).clipboard;
    const made: X3DObject[] = app.run('Duplicate', { InputObjs: [source] }) ?? [];
    (app as any).clipboard = clip;
    for (const c of made) { const old = c.parentObj!; if (old !== target) app.record('Parent', () => target.addChild(c), () => old.addChild(c)); }
    st.status[C] = S_FALSE;
    return made[0] ?? null;
  }
  if (op === 8) { // inferred: move; the source itself goes under the target
    if (source === target || isAncestor(source, target)) throw fail(C, E_INVALIDARG, 'the target is the source or below it'); // inferred
    const old = source.parentObj; if (!old) return undefined;
    if (old !== target) app.record('Parent', () => target.addChild(source), () => old.addChild(source));
    st.status[C] = S_FALSE;
    return source;
  }
  logNya(app, C, `paste operation ${op} (mode ${mode}; inferred: connect)`);
  return undefined;
}
const isAncestor = (anc: X3DObject, o: X3DObject) => { for (let x = o.parentObj; x; x = x.parentObj) if (x === anc) return true; return false; };

// ====================================================================================================== RunPerformanceTest
export const PERF_LABELS: Record<number, string> = {
  0: 'PLAYBACK (incl. UPDATE) performance',
  1: 'DRAWING performance',
  2: 'PLAYBACK (incl. UPDATE) performance -- NO INSTRUMENTATION',
  3: 'DRAWING performance -- NO INSTRUMENTATION',
};
/** C asctime(): "Www Mmm dd hh:mm:ss yyyy\n". */
export function asctime(d: Date): string {
  const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${W[d.getDay()]} ${M[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}\n`;
}
export interface PerfResult { type: number; label: string; frames: number; seconds: number; fps: number; file: string }

/** Append the report header to FileName and run the playback (0/2) or drawing (1/3) test. No usable file = no test. */
export function runPerformanceTest(app: App, a: Record<string, any>, draw: () => void): PerfResult | null {
  const C = 'RunPerformanceTest'; const st = tasksB16c(app);
  const type = unset(a.Type) ? 0 : Math.trunc(Number(a.Type));
  const duration = unset(a.Duration) ? 5 : Number(a.Duration);
  if (unset(a.FileName)) { app.logMsg('info', `${C}: no FileName; no test is run`); st.status[C] = S_FALSE; return null; }
  const file = String(a.FileName);
  // fopen(FileName, "a"): an existing file is kept and appended to; a missing folder means the file cannot be opened.
  let text: string;
  try { text = hostFs.isFile(file) ? hostFs.readFile(file) : ''; hostFs.writeFile(file, text); }
  catch { app.logMsg('info', `${C}: ${file} cannot be opened; no test is run`); st.status[C] = S_FALSE; return null; }
  const label = PERF_LABELS[type] ?? 'unknown';
  const lines: string[] = ['\n\n==========\n', `TEST ${type}: [${label}]\n`, `   Date    : ${asctime(new Date())}`, `   Duration: >= ${(Number.isFinite(duration) ? duration : 0).toFixed(1)} sec\n`];
  logNya(app, C, 'the system information block (CSIStatManager::DumpSystemInfo) and the scene block of the report');
  const flush = () => { try { hostFs.writeFile(file, text + lines.join('')); } catch { /* the file was opened above */ } };
  if (!(type in PERF_LABELS)) { flush(); st.status[C] = S_FALSE; return null; }
  logNya(app, C, 'the list of views written to the report');
  app.logMsg('info', `TEST ${type} [${label}] running for ${duration} seconds...`); // the progress bar caption
  // inferred: the measuring loops; the per-frame lines they write are not attested (none written).
  logNya(app, C, `what the ${type === 0 || type === 2 ? 'playback' : 'drawing'} test writes per frame`);
  const dur = Math.max(0, Math.min(Number.isFinite(duration) ? duration : 0, 60)); // inferred cap: the browser tab must stay responsive
  const A = app.anim; const saved = A.frame; const t0 = performance.now(); let n = 0; let f = A.startFrame;
  do {
    if (type === 0 || type === 2) { A.frame = f; for (const o of app.scene.allObjects()) o.primitive?.geom(); f = f >= A.endFrame ? A.startFrame : f + 1; }
    else draw();
    n++;
  } while ((performance.now() - t0) / 1000 < dur && n < 1e6);
  A.frame = saved;
  const s = (performance.now() - t0) / 1000;
  flush();
  st.status[C] = S_FALSE;
  return { type, label, frames: n, seconds: s, fps: s > 0 ? n / s : n, file };
}

// ====================================================================================================== registration
export function registerTasksB16cCommands(app: App) {
  tasksB16c(app);
  // ---------------------------------------------------------------- Add3DObjectToScene
  app.register({
    name: 'Add3DObjectToScene', label: 'Add3DObjectToScene', category: '', description: '',
    args: [{ name: 'InputObjs', default: null }, { name: 'Parent', default: null }],
    execute(app2, a) {
      const C = 'Add3DObjectToScene';
      let parent: X3DObject | null = null;
      if (!unset(a.Parent)) { const p = nodeOf(app2, a.Parent); if (!(p instanceof X3DObject)) throw fail(C, E_INVALIDARG, `Parent ${a.Parent} is not a 3D object`); parent = p; }
      // 1. locked parent: access denied (message 0x57 with the parent's path); a referenced model is dropped instead
      if (parent && isLocked(app2, parent, 0xffff)) {
        if (parent instanceof Model && (parent as any).referencedModel) parent = null;
        else { app2.logMsg('error', `${C}: ${parent.fullName} is locked (XSITASKS 0x57)`); throw fail(C, E_ACCESSDENIED, `${parent.fullName} is locked`); }
      }
      // 3. no Parent -> the current scene model
      const target: X3DObject = parent ?? app2.scene.root;
      const objs: X3DObject[] = [];
      const add = (x: any) => { if (Array.isArray(x)) return x.forEach(add); if (typeof x === 'string') return x.split(',').forEach(s => add(app2.scene.find(s.trim()))); if (x instanceof X3DObject && !objs.includes(x)) objs.push(x); };
      add(a.InputObjs);
      if (!objs.length) return undefined;
      // 4. parent.AddChild for each object
      for (const o of objs) {
        if (o === target || o === app2.scene.root || isAncestor(o, target)) continue; // inferred: no cycles
        const old = o.parentObj;
        if (old === target) continue;
        app2.record('Add ' + o.name, () => target.addChild(o), () => { if (old) old.addChild(o); else target.removeChild(o); });
      }
      // 5-6. extra container sub-tasks and the final evaluation sub-task
      logNya(app2, C, 'the extra scene containers the objects are registered in (container sub-tasks) and the final evaluation sub-task');
      app2.events.emit('scene');
      return undefined;
    },
  });

  // ---------------------------------------------------------------- SetReference2
  app.register({
    name: 'SetReference2', label: 'Set Reference 2', category: 'Edit', description: '',
    args: [{ name: 'Target', default: null }, { name: 'Value', default: null }, { name: 'Time', default: null }],
    execute(app2, a) {
      const C = 'SetReference2'; const st = tasksB16c(app2);
      const port = resolvePort(app2.scene, a.Target);
      if (!port) throw fail(C, E_INVALIDARG, `Target ${a.Target ?? ''} is not a port`);
      const value: Node | null = unset(a.Value) ? null : (a.Value instanceof Node ? a.Value : resolveNode(app2.scene, a.Value));
      if (!unset(a.Value) && !value) throw fail(C, E_INVALIDARG, `Value ${a.Value} not found`); // inferred
      const seconds = unset(a.Time) ? null : framesToSeconds(app2, Number(a.Time));
      const old = getSource(port);
      st.lastReference = { port, value, seconds };
      if (old === value) return undefined; // a value equal to the current one is a no-op
      if (value instanceof Shader) logNya(app2, C, 'the shader data-type specific sub-task (7-way type switch)');
      app2.record(C, () => setSourceRaw(port, value), () => setSourceRaw(port, old));
      app2.events.emit('params');
      return undefined;
    },
  });
}
