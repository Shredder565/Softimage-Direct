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
//
// Row CMD-B17j (docs/ghidra/cmd-b17j-tasks-pr195-answers.md §3 "Wire contract deltas", items 1-6 of the cmd-b17j
// section of docs/re/WIRE_CORRECTIONS_B17.md) revised: DeleteObj validation (camera guard, lock / non-scene drops and
// their report, Remove From Selection / Deactivate Elements before deleting), CopyPaste modes (move = copy + delete
// source, copy = duplicate + freeze, mode 3 = the source itself), RunPerformanceTest report layout (no Duration clamp),
// Add3DObjectToScene (unparented objects only, Visibility property), SetReference2 (reference filter, self reference),
// Undo / Redo Repetitions (0 = nothing; negative = conversion failure).
import { App, type UndoEntry } from '../core/commands';
import { Node, X3DObject, Cluster, Layer, Pass, Framebuffer, Shader, Model, Camera, Material, Primitive, Property, makeVisibility } from '../core/scene';
import { Parameter } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { SiStatusError } from './alembicSeqCam';
import { isLocked } from './inferredB10Scene';
import { currentPass } from './duplicateRenderingSimulationScriptsShared';
import { resolvePort, resolveNode, getSource, setSourceRaw, type PortRef } from '../core/textureLayers';

export const ROW = 'CMD-B16c';
export const S_FALSE = 1, E_INVALIDARG = 0x80070057, E_UNEXPECTED = 0x8000ffff, E_ACCESSDENIED = 0x80070005, E_POINTER = 0x80004003;
/** DISP_E_OVERFLOW (public COM VariantChangeType status): a negative number converted to VT_UI4. */
export const DISP_E_OVERFLOW = 0x8002000a;
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
const ROW17 = 'CMD-B17j';
const nya17 = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW17})`);
/** Severity 4 message (the log knows info / error only). */
const warn = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);
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
  // CMD-B17j Q22: Repetitions is VT_UI4. inferred: the argument layer refuses a negative value (overflow), nothing undone.
  if (num < 0) throw fail(cmd, DISP_E_OVERFLOW, `Repetitions ${repetitions} cannot be converted to an unsigned integer`);
  const n = Math.floor(num); // 0: the loop runs zero times and Repetitions stays 0
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
// a list entry may carry a GUID prefix and a selection-scope prefix (B: branch, N: node; the delete of an object always
// takes its branch here), CMD-B17b DeleteModelFromObj passes "B:<name>"
const stripGuid = (s: string) => s.replace(/^\{[0-9a-f-]{36}\}:/i, '').trim().replace(/^[BN]:/, '');

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

const isCamObj = (o: any): o is X3DObject => o instanceof X3DObject && (o instanceof Camera || o.type === 'camera');
/** A referenced model (root). */
const isRefRoot = (o: any) => o instanceof Model && !!(o as any).referencedModel;
/** inferred: "referenced-locked" = inside a referenced model (below its root). */
const refLocked = (o: X3DObject) => { for (let x = o.parentObj; x; x = x.parentObj) if (isRefRoot(x)) return true; return false; };
const nameOf = (n: any) => String(n?.fullName ?? n?.name ?? n);
/** The 3D object that owns a selected item (itself, a cluster's / property's / primitive's object). */
function ownerObject(n: any): X3DObject | null {
  for (let x = n; x; x = x instanceof X3DObject ? null : (x.parent ?? null)) if (x instanceof X3DObject) return x;
  return null;
}

/**
 * The DeleteObj worker (handler dd531990). CMD-B17j Q17 validation first (mode without 0x8 / 0x10):
 *  1. camera guard: when the items and their children hold every scene camera that is not referenced-locked, a warning
 *     (XSITASKS 0x436) is logged and nothing is deleted (status 0x562E80D2, the command succeeds);
 *  2. locked items (level 1) that are not a reference root raise the lock error and are dropped; items that are not
 *     scene objects (parameters) are dropped silently;
 *  4. report: nothing kept -> E_INVALIDARG with message 0x13a and the dropped names joined by ","; some kept -> warning
 *     0x13a with the names, the rest is deleted.
 * Then Remove From Selection on the deleted selected items and Deactivate Elements on deleted active components (both
 * undoable), SI3D_SCENE_INVALID_BEGIN, the deletions (undoable through app.record), SI3D_SCENE_INVALID_END. The undo
 * runs inside the same pair of notifications. Nothing to delete -> SI_NOTHING, no change.
 */
export function deleteObjList(app: App, cmd: string, input: any, mode = 0): number {
  const st = tasksB16c(app);
  const items = deleteList(app, input);
  const sc = app.scene;
  if (!items.length) { st.status[cmd] = SI_NOTHING; return 0; }
  // 1. camera guard
  if (!(mode & 0x18)) {
    const found = new Set<X3DObject>();
    const scan = (o: X3DObject) => { if (refLocked(o)) return; if (isCamObj(o)) found.add(o); for (const c of o.children) scan(c); };
    for (const n of items) if (n instanceof X3DObject) scan(n);
    const sceneCams = [...sc.allObjects()].filter(o => isCamObj(o) && !refLocked(o));
    if (found.size > 0 && found.size === sceneCams.length) { // inferred: an empty scene camera list does not block deletions
      warn(app, `${cmd}: the last camera of the scene cannot be deleted (XSITASKS 0x436, inferred text); nothing deleted`);
      st.status[cmd] = SI_NOTHING; return 0;
    }
  }
  // 2. per item
  const kept: any[] = []; const dropped: any[] = [];
  for (const n of items) {
    if (n instanceof Parameter || !(n instanceof Node)) { dropped.push(n); continue; } // not a scene object
    if (!(mode & 0x10) && isLocked(app, n, 1) && !isRefRoot(n)) { app.logMsg('error', `${cmd}: ${nameOf(n)} is locked`); dropped.push(n); continue; }
    kept.push(n);
  }
  // 3. referenced models
  for (const n of kept) if (isRefRoot(n)) nya17(app, cmd, `releasing the loaded reference / delta of the referenced model ${nameOf(n)} before it is deleted (reference-model slot 0x148)`);
  // 4. report
  if (dropped.length) {
    const names = dropped.map(nameOf).join(',');
    if (!kept.length) throw fail(cmd, E_INVALIDARG, `nothing can be deleted: ${names} (XSITASKS 0x13a)`);
    warn(app, `${cmd}: not deleted: ${names} (XSITASKS 0x13a)`);
  }
  const doable: (() => boolean)[] = [];
  const goneObjs = new Set<X3DObject>(); const goneOther = new Set<any>();
  for (const n of kept) {
    if (n instanceof Cluster) {
      const o = n.obj; if (!o) continue;
      doable.push(() => { app.record('Delete ' + n.name, () => o.removeCluster(n), () => o.addCluster(n)); return true; });
      goneOther.add(n);
    } else if (n instanceof Layer) {
      const ls = sc.layers;
      if (!ls.includes(n)) continue;
      if (ls.length < 2) { logNya(app, cmd, `deleting the last layer (${n.name})`); continue; } // inferred: the default layer stays (the traverser's rule is open)
      doable.push(() => {
        const def = ls.find(x => x !== n)!; const idx = ls.indexOf(n); const members = [...n.members]; const wasCur = (app as any).currentLayer;
        // inferred: the members of a deleted layer move to the remaining (default) layer
        app.record('Delete ' + n.name, () => { ls.splice(ls.indexOf(n), 1); for (const o of members) { (o as any).layer = def; def.members.add(o); } if ((app as any).currentLayer === n) (app as any).currentLayer = def; },
          () => { ls.splice(idx, 0, n); for (const o of members) { def.members.delete(o); (o as any).layer = n; n.members.add(o); } (app as any).currentLayer = wasCur; });
        return true;
      });
      goneOther.add(n);
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
      goneOther.add(n);
    } else if (n instanceof Framebuffer) {
      // inferred (CMD-B19a RemoveRenderChannel): a framebuffer is removed from its pass's framebuffer list
      const pass = sc.passes.find(p => p.framebuffers.includes(n));
      if (!pass) continue;
      doable.push(() => {
        const list = pass.framebuffers as Framebuffer[]; const idx = list.indexOf(n);
        if (idx < 0) return false;
        app.record('Delete ' + n.name, () => { const k = list.indexOf(n); if (k >= 0) list.splice(k, 1); }, () => { if (!list.includes(n)) list.splice(Math.min(idx, list.length), 0, n); });
        return true;
      });
      goneOther.add(n);
    } else if (n instanceof X3DObject) {
      if (n === sc.root || !n.parentObj) continue;
      const p = n.parentObj; const o = n;
      doable.push(() => {
        if (o.parentObj !== p) return false; // already removed with an ancestor in this list
        const idx = p.children.indexOf(o);
        app.record('Delete ' + o.name, () => p.removeChild(o), () => { p.addChild(o); p.children.splice(p.children.indexOf(o), 1); p.children.splice(idx, 0, o); });
        return true;
      });
      const all = (x: X3DObject) => { goneObjs.add(x); x.children.forEach(all); }; all(o);
    } else {
      logNya(app, cmd, `deleting ${nameOf(n)} (per-kind deletion rules of C3DDeleteSelectedTraverser, corehelper.dll)`);
    }
  }
  if (!doable.length) { st.status[cmd] = SI_NOTHING; return 0; }
  // Remove From Selection (38eddd02) / Deactivate Elements (9dcec2b3), before the traverser, undoable
  const gone = (x: any) => goneOther.has(x) || (() => { const o = ownerObject(x); return !!o && goneObjs.has(o); })();
  const sel = [...app.selection]; const remaining = sel.filter(x => !gone(x));
  if (remaining.length !== sel.length) app.record('Remove From Selection', () => app.select(remaining), () => app.select(sel));
  const cs = app.compSel;
  if (cs && goneObjs.has(cs.obj)) app.record('Deactivate Elements', () => { app.compSel = null; app.events.emit('selection'); }, () => { app.compSel = cs; app.events.emit('selection'); });
  const push = (e: string) => st.notifications.push(e);
  app.record('SI3D_SCENE_INVALID_BEGIN', () => push('SI3D_SCENE_INVALID_BEGIN'), () => push('SI3D_SCENE_INVALID_END'));
  let n = 0;
  try { for (const d of doable) if (d()) n++; } finally { app.record('SI3D_SCENE_INVALID_END', () => push('SI3D_SCENE_INVALID_END'), () => push('SI3D_SCENE_INVALID_BEGIN')); }
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
  const allowed = 2 | 4 | 8; const def = 4; // inferred: an object onto an object allows all three, default copy
  let op = mode === 0 ? def : PASTE_OPERATION[mode];
  if (!(allowed & op)) op = def;
  st.lastPaste = { mode, operation: op };
  if ((op === 8 || op === 2) && (source === target || isAncestor(source, target))) throw fail(C, E_INVALIDARG, 'the target is the source or below it'); // inferred
  /** Duplicate the source (the user clipboard is left alone), paste the copy under Target, freeze it (FreezeObj sub-task). */
  const pasteCopy = (): X3DObject | null => {
    const clip = (app as any).clipboard;
    const made: X3DObject[] = app.run('Duplicate', { InputObjs: [source] }) ?? [];
    (app as any).clipboard = clip;
    for (const c of made) { const old = c.parentObj!; if (old !== target) app.record('Parent', () => target.addChild(c), () => old.addChild(c)); }
    const copy = made[0] ?? null;
    if (copy && app.commands.has('FreezeObj')) app.run('FreezeObj', { InputObjs: [copy] }); // at the current time: the copy keeps no operator stack of its own
    return copy;
  };
  if (op === 4) { const c = pasteCopy(); st.status[C] = S_FALSE; return c; } // copy
  if (op === 8) { // move = copy, then a DeleteObj sub-task (mode 0x400) deletes the original source
    const c = pasteCopy();
    if (c) deleteObjList(app, C, [source], 0x400);
    st.status[C] = S_FALSE;
    return c;
  }
  // 2: the source itself is handed to the paste (inferred: a reference / connect paste puts the object under Target)
  const old = source.parentObj; if (!old) return undefined;
  if (old !== target) app.record('Parent', () => target.addChild(source), () => old.addChild(source));
  st.status[C] = S_FALSE;
  return source;
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
/** One active 3D view as the report lists it (CMD-B17j Q20; field mapping of the format strings inferred). */
export interface PerfView {
  letter: string; index: number; width: number; height: number;
  /** VIEWPOINT, MONITOR, SCENE, SPOTLIGHT or Unknown. */
  cameraKind: string; cameraName: string;
  /** WIREFRAME, SHADE, SURFACE_LINES, TEXTURE, BBOX, HIDDEN_LINE, CONSTANT, AUTO, TEXTURE DECAL, REALTIME SHADERS. */
  display: string;
  /** FULL, COARSE or MEDIUM. */
  quality: string;
  frustumCull: number; xray: number; transp: number;
}
/** What the test needs from the views (supplied by src/commands/inferredB10Views.ts). */
export interface PerfEnv {
  /** Redraw the active views once. */
  draw(): void;
  /** Set the play time (frames) and update the scene. */
  setTime(frame: number): void;
  /** The active views that have a 3D view object; null = the views list failed (no test). */
  views(): PerfView[] | null;
  gl(): { version: string; vendor: string; renderer: string } | null;
}
/** printf %.Nf of a double, with C's text for the non-finite values (inferred: glibc spelling). */
const fixed = (v: number, d: number) => Number.isFinite(v) ? v.toFixed(d) : Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf';

/**
 * RunPerformanceTest (tasks.dll 0ed17cf6, CMD-B16c with the CMD-B17j Q20 report layout). The report is appended to
 * FileName: header; DumpSystemInfo text (not attested: not written); scene block (when the scene name and path are both
 * known); views block (GL strings, active views); then the playback (Types 0/2: In..Out repeatedly, elapsed time checked
 * every 16 frames and at the end of each pass, time restored) or drawing (Types 1/3: redraws in batches of 16) test until
 * at least Duration seconds elapsed (no clamp; Duration <= 0 = zero frames); results block. No per-frame lines.
 */
export function runPerformanceTest(app: App, a: Record<string, any>, env: PerfEnv): PerfResult | null {
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
  const dur = Number.isFinite(duration) ? duration : 0;
  const lines: string[] = ['\n\n==========\n', `TEST ${type}: [${label}]\n`, `   Date    : ${asctime(new Date())}`, `   Duration: >= ${dur.toFixed(1)} sec\n`];
  const flush = () => { try { hostFs.writeFile(file, text + lines.join('')); } catch { /* the file was opened above */ } };
  if (!(type in PERF_LABELS)) { flush(); st.status[C] = S_FALSE; return null; }
  // 2. system information (CSIStatManager::DumpSystemInfo, sigeneral.dll): its text is not in the note
  logNya(app, C, 'the system information block (CSIStatManager::DumpSystemInfo text); not written');
  // 3. scene block, only when both lookups succeed (name = the scene's full name, path = its file; inferred which is which)
  const sceneName = String(app.scene?.name ?? ''); const scenePath = String((app as any).scenePath ?? '');
  if (sceneName && scenePath) lines.push('\nXSI SCENE INFO:\n', `   Scene: '${sceneName}'\n`, `   Path : ${scenePath}\n`);
  // 4. views block
  const views = env.views();
  if (!views) { flush(); app.logMsg('info', `${C}: the list of 3D views failed; no test is run`); st.status[C] = S_FALSE; return null; }
  const gl = env.gl();
  lines.push(`\nGL version: ${gl?.version ?? ''}`, `\nGL vendor: ${gl?.vendor ?? ''}`, `\nGL renderer: ${gl?.renderer ?? ''}\n`);
  lines.push(`   ${views.length} Active OGL view(s)\n`);
  for (const v of views) {
    lines.push(`      Active view: ${v.letter} [${v.index}] (${v.width}x${v.height}) `, ` ${v.cameraKind.padStart(9)}: '${v.cameraName}' (${v.display} ${v.quality})\n`);
    lines.push(`         FrustumCull: ${v.frustumCull | 0}, XRayShade: ${v.xray | 0}, TranspShade: ${v.transp | 0}\n`);
  }
  // 5. progress bar (not written to the file)
  app.logMsg('info', `TEST ${type} [${label}] running for ${dur.toFixed(1)} seconds...`);
  const instrumented = type === 0 || type === 1; const playback = type === 0 || type === 2;
  if (instrumented) logNya(app, C, 'per-view draw statistics (instrumentation): this build has no per-view counters; the instrumented result lines are not written');
  // 6. the test
  const A = app.anim; const saved = A.frame; const t0 = performance.now(); let n = 0;
  const elapsed = () => (performance.now() - t0) / 1000;
  if (playback) {
    const inF = Math.floor(Number(A.startFrame) + 1e-4), outF = Math.floor(Number(A.endFrame) + 1e-4);
    outer: while (elapsed() < dur) {
      for (let f = inF; f <= outF; f++) { env.setTime(f); env.draw(); n++; if (n % 16 === 0 && elapsed() >= dur) break outer; }
      if (outF < inF) break; // inferred: an empty range draws nothing
    }
    env.setTime(saved);
  } else {
    while (elapsed() < dur) for (let k = 0; k < 16; k++) { env.draw(); n++; }
  }
  const s = elapsed();
  // 7. results
  const fps = n / s; const ms = (s * 1000) / n;
  lines.push('\nRESULTS:\n', `   Time elapsed to draw ${n} frames: ${s.toFixed(2)} seconds.\n`, `   Average of ${fixed(fps, 1)} frames/second or ${fixed(ms, 1)}ms per refresh.\n`);
  if (!instrumented) {
    lines.push('   Instrumentation data was not requested.\n\n');
    logNya(app, C, 'the three lines inviting a comparison of instrumented and non-instrumented time per frame (text not in the note)');
  } else if (playback) logNya(app, C, 'the NOTES paragraph on instrumentation overhead (text not in the note)');
  flush();
  st.status[C] = S_FALSE;
  return { type, label, frames: n, seconds: s, fps, file };
}

// ====================================================================================================== SetReference2 filter
/** siShaderReferenceFilterType values 1..7 (CMD-B17j Q24); other values = no filtering. */
export const REFERENCE_FILTERS = ['', 'siObjectReferenceFilter', 'siCameraReferenceFilter', 'siLightReferenceFilter', 'siMaterialReferenceFilter',
  'siShaderReferenceFilter', 'siGeometryReferenceFilter', 'siUserDataBlobReferenceFilter'] as const;
/** The port's reference filter: the `referenceFilter` attribute of its parameter (number 1..7 or the si* name), else 0.
 *  This build's shader definitions carry no filter attribute yet, so ports are unfiltered unless one is set. */
export function referenceFilterOf(port: PortRef): number {
  const p: any = (port.owner as any).get?.(port.name);
  const f = p?.referenceFilter ?? p?.def?.referenceFilter;
  if (typeof f === 'number') return f >= 1 && f <= 7 ? f : 0;
  const i = typeof f === 'string' ? (REFERENCE_FILTERS as readonly string[]).indexOf(f) : -1;
  return i > 0 ? i : 0;
}
/** Class test of a filter: 1 X3DObject, 2 camera primitive, 3 light primitive, 4 material, 5 shader, 6 geometry primitive
 *  (inferred: an object with geometry), 7 user data blob (inferred). */
export function satisfiesFilter(v: Node, filter: number): boolean {
  const o: any = v;
  switch (filter) {
    case 1: return v instanceof X3DObject;
    case 2: return v instanceof X3DObject && (v instanceof Camera || o.primitive?.type === 'camera');
    case 3: return v instanceof X3DObject && (o.type === 'light' || o.primitive?.type === 'light');
    case 4: return v instanceof Material;
    case 5: return v instanceof Shader;
    case 6: return v instanceof X3DObject && !!o.primitive && !['camera', 'light', 'null'].includes(String(o.primitive.type ?? o.type));
    case 7: return v instanceof Property && /^userdatablob$/i.test(String(o.type));
    default: return true;
  }
}
const isInReferencedModel = (n: any) => { const o = ownerObject(n); if (!o) return false; for (let x: X3DObject | null = o; x; x = x.parentObj) if (isRefRoot(x)) return true; return false; };

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
      // 1. lock test at level 1: locked and not a referenced-model root -> access denied (message 0x57 with the path)
      if (parent && isLocked(app2, parent, 1)) {
        if (isRefRoot(parent)) {
          nya17(app2, C, `the owner-property test that keeps the locked referenced model ${parent.fullName} as parent; the current scene model is used`);
          parent = null;
        } else { app2.logMsg('error', `${C}: ${parent.fullName} is locked (XSITASKS 0x57)`); throw fail(C, E_ACCESSDENIED, `${parent.fullName} is locked`); }
      }
      // 3. no Parent -> the current scene model
      const target: X3DObject = parent ?? app2.scene.root;
      const objs: X3DObject[] = [];
      const add = (x: any) => { if (Array.isArray(x)) return x.forEach(add); if (typeof x === 'string') return x.split(',').forEach(s => add(app2.scene.find(s.trim()))); if (x instanceof X3DObject && !objs.includes(x)) objs.push(x); };
      add(a.InputObjs);
      // expansion (CMD-B17j Q23): only objects without a parent are kept; one under another parent is skipped, not moved
      const kept = objs.filter(o => !o.parentObj && o !== app2.scene.root && o !== target && !isAncestor(o, target));
      if (!kept.length) return undefined;
      // 4. Parent.AddChild for each object; undo disposes it from the scene again
      for (const o of kept) app2.record('Add ' + o.name, () => target.addChild(o), () => target.removeChild(o));
      // 5. SIAddProp (propagation mode 2) of the missing Visibility property; ParticleDisplay for particle clouds
      for (const o of kept) {
        if (!o.properties.some(p => p.type === 'visibility')) { const v = makeVisibility(); app2.record('SIAddProp', () => { o.addProperty(v); }, () => { o.removeProperty(v); }); }
        if (/cloud|particle/i.test(o.type) && !o.properties.some(p => /particledisplay/i.test(p.type))) nya17(app2, C, `adding the ParticleDisplay property to ${o.name} (no C3DParticleDisplayProp preset in this build)`);
      }
      // 6. final sub-task 03ef9f91 (kinematics under the new parent at the current time): its role is open
      nya17(app2, C, 'the final kinematics sub-task 03ef9f91 (re-evaluating / compensating the children under the parent); local transforms are kept');
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
      let value: Node | null = unset(a.Value) ? null : (a.Value instanceof Node ? a.Value : resolveNode(app2.scene, a.Value));
      if (!unset(a.Value) && !value) throw fail(C, E_INVALIDARG, `Value ${a.Value} not found`); // inferred
      // CMD-B17j Q24: a sub-object is replaced by its owning 3D object; a self reference is dropped; a Value that does not
      // satisfy the port's reference filter is replaced by null (the port is then just disconnected)
      if (value instanceof Cluster || value instanceof Primitive) value = value instanceof Cluster ? value.obj : ownerObject(value);
      if (value && value === port.owner) value = null;
      const filter = referenceFilterOf(port);
      if (value && filter && !satisfiesFilter(value, filter)) value = null;
      const seconds = unset(a.Time) ? null : framesToSeconds(app2, Number(a.Time));
      const old = getSource(port);
      st.lastReference = { port, value, seconds };
      if (old === value) return undefined; // a value equal to the current one is a no-op
      if (isInReferencedModel(port.owner)) nya17(app2, C, 'the reference-model delta sub-task d8b3c0e0 (modeltasks.dll) for a port owned inside a referenced model');
      app2.record(C, () => setSourceRaw(port, value), () => setSourceRaw(port, old));
      app2.events.emit('params');
      return undefined;
    },
  });
}
