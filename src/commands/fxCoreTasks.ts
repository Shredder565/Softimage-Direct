// Ledger rows CMD-B9e (this file), CMD-B9f and CMD-B9g (fxCoreTasksShapes.ts, fxCoreTasksOps.ts): the task commands of
// fxcore.dll. Brief for this file: docs/ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md, sections 2 and 3.
// Original code written from that prose contract only; no XSIBATCH golden exists for the rows.
//
//   paint clip   SavePaintClip SaveSelectedPaintClipFrames RevertPaintClip RevertPaintClipFrame
//                RevertSelectedPaintClipFrame GotoSelectedPaintClipFrame PrevModifiedPaintClipFrame
//                NextModifiedPaintClipFrame SelectPaintClipFrames ClearPaintClipFrameSelection
//   FX tree      CreateFxTree DisconnectFxOp RenderFxOp SetFxOpPos MakeWarperShapePair
//
// How the contract is mapped onto this build:
//  * The FX objects are the stand-in model of fxCoreTasksModel.ts, kept under `app.fxCore` (self-contained: it does
//    not use the xsipaint model). An FX tree is a property of type `FxTree` under the scene root.
//  * Failure statuses are thrown as SiStatusError with the note's message text; statuses that are not failures
//    (0, 1) are kept in `app.fxCore.lastStatus`.
//  * Notifications (ids 0x14, 0xf, 0x3e9, FX_OP_ATTRIB_CHANGED, ...) are appended to `app.fxCore.notifications`.
//  * Image work (file parsers, rasters, rendering) is not modelled: those branches log "not yet attested".
import { App, CommandDef } from '../core/commands';
import {
  NOTE_E, S_OK, E_FAIL, E_UNEXPECTED, E_INVALIDARG, DISP_E_MEMBERNOTFOUND, CLASS_FILE_OUTPUT, CLASS_WARP_A, CLASS_WARP_B, CNX_NYA,
  FxTree, FxOp, FxShape, FxShapeCorr, FxShapeList, makeState, stateOf, unset, text, fail, setStatus, logNya, notify, isOp, isShape, objArg, listArg, uniqueName, connectionFromName,
} from './fxCoreTasksModel';
import { registerFxCoreShapeCommands } from './fxCoreTasksShapes';
import { registerFxCoreOpCommands } from './fxCoreTasksOps';

const MSG_NO_SELECTED = 'No paint clip frames are selected'; // XSIFXCORE 0x23
const MSG_NO_MODIFIED = 'There are no modified frames'; // XSIFXCORE 0x24

// ------------------------------------------------------------------ paint clip interface
const KEY_NYA = 'the mapping between a frame number and the paint clip frame key (clip start offset, time warp); the frame number is used as the key';
const frameKey = (time: number) => Math.trunc(time); // inferred: identity (note E open question 2)
function uiRefresh(app: App, clip: FxOp) { notify(app, clip, 0x14); notify(app, clip, 0xf); }
function collect(clip: FxOp, mode: 'selected' | 'modified'): number[] {
  return [...clip.paint!.frames].filter(([, f]) => f[mode]).map(([k]) => k).sort((a, b) => a - b);
}
/** inferred: the entry of the sequence file list for an image number (the list was not read): `name.<number>.ext`. */
function sequenceFile(file: string, index: number): string { const m = /^(.*?)(\.[^.\\/]+)?$/.exec(file)!; return `${m[1]}.${index}${m[2] ?? ''}`; }

/** The file writer (note E, SavePaintClip steps 1 to 6) for the given frame keys of one clip. */
function writeFrames(app: App, C: string, clip: FxOp, keys: number[]) {
  const p = clip.paint!; const st = stateOf(app);
  if (!p.outputFile) { app.logMsg('error', `${clip.name} : Can't Write Files, Output File Name is Not Set`); return; } // message 0x25
  if (!/\.[A-Za-z0-9]+$/.test(p.outputFile)) { app.logMsg('error', 'Unsupported Image Format'); return; } // message 0x1f. inferred: a name without an extension has no parser
  logNya(app, C, 'the file parser and the image encoding (raster to DS image, image track); the frames are recorded in app.fxCore.writtenFiles instead of being encoded', NOTE_E);
  app.logMsg('info', `Writing Paint Clip ${clip.name}`); // progress bar title
  for (const key of keys) {
    const f = p.frames.get(key);
    if (!f || !f.modified) continue; // only frames that exist and are modified are written
    const file = sequenceFile(p.outputFile, key - p.startOffset);
    st.writtenFiles.push(file);
    f.modified = false; p.modifiedCount--;
    app.logMsg('info', `Wrote File ${file}`); // message 0x22
  }
  uiRefresh(app, clip);
}
function save(app: App, C: string, clip: FxOp, mode: 'selected' | 'modified') {
  const keys = collect(clip, mode);
  if (!keys.length) return; // nothing happens for this clip
  writeFrames(app, C, clip, keys);
  notify(app, clip, 0x3e9);
}
function revertFrame(app: App, clip: FxOp, time: number) {
  const p = clip.paint!; const key = frameKey(time); const f = p.frames.get(key);
  if (f) {
    if (f.modified) { p.modifiedCount--; uiRefresh(app, clip); }
    f.raster = null; p.frames.delete(key);
    notify(app, clip, 0x3e9);
  }
  p.cacheA.delete(key); p.cacheB.delete(key);
}
function clearSelection(app: App, clip: FxOp) {
  let cleared = 0; for (const f of clip.paint!.frames.values()) if (f.selected) { f.selected = false; cleared++; }
  if (cleared) uiRefresh(app, clip);
}
/** A `Frames` variant -> 32-bit integers; null when it cannot be turned into an array. */
function intArray(v: any): number[] | null {
  if (!Array.isArray(v) && !ArrayBuffer.isView(v)) return null;
  const out: number[] = [];
  for (const x of Array.from(v as any)) { const n = typeof x === 'boolean' ? NaN : Number(x); if (x === null || x === '' || !Number.isFinite(n)) return null; out.push(Math.trunc(n) | 0); }
  return out;
}

interface PaintMode { name: string; label: string; mode: number; needSel: boolean; needMod: boolean; arg: string; extra?: { name: string; default?: any }[] }
const PAINT_MODES: PaintMode[] = [
  { name: 'SavePaintClip', label: 'Save Paint Clip', mode: 0, needSel: false, needMod: false, arg: 'InputObj' },
  { name: 'SaveSelectedPaintClipFrames', label: 'Save Selected Paint Clip Frames', mode: 1, needSel: true, needMod: false, arg: 'PaintClip' },
  { name: 'RevertSelectedPaintClipFrame', label: 'Revert Selected Paint Clip Frame', mode: 2, needSel: true, needMod: true, arg: 'PaintClip' },
  { name: 'RevertPaintClipFrame', label: 'Revert Paint Clip Frame', mode: 3, needSel: false, needMod: true, arg: 'PaintClip', extra: [{ name: 'Time', default: null }] },
  { name: 'RevertPaintClip', label: 'Revert Paint Clip', mode: 4, needSel: false, needMod: true, arg: 'PaintClip' },
  { name: 'GotoSelectedPaintClipFrame', label: 'Goto Selected Paint Clip Frame', mode: 5, needSel: true, needMod: true, arg: 'PaintClip' },
  { name: 'PrevModifiedPaintClipFrame', label: 'Previous Modified Paint Clip Frame', mode: 6, needSel: true, needMod: true, arg: 'PaintClip' },
  { name: 'NextModifiedPaintClipFrame', label: 'Next Modified Paint Clip Frame', mode: 7, needSel: true, needMod: true, arg: 'PaintClip' },
  { name: 'SelectPaintClipFrames', label: 'Select Paint Clip Frames', mode: 8, needSel: false, needMod: true, arg: 'PaintClip', extra: [{ name: 'Frames', default: null }] },
  { name: 'ClearPaintClipFrameSelection', label: 'Clear Paint Clip Frames Selection', mode: 9, needSel: false, needMod: true, arg: 'PaintClip' },
];

/** One task class serves the ten commands (note E 2.3): UnPackArg prechecks, then Do over the whole list. */
function paintTask(app: App, m: PaintMode, a: Record<string, any>) {
  const C = m.name; let time = 0; let frames: number[] = [];
  if (m.mode === 3) {
    time = unset(a.Time) ? app.anim.frame : Number(a.Time); // inferred: an omitted Time is the current frame (argument handler outside fxcore.dll)
    if (!Number.isFinite(time)) throw fail(E_INVALIDARG, `${C}: Time is not a number`);
    time = Math.trunc(time);
  }
  if (m.mode === 8) { const arr = intArray(a.Frames); if (!arr) throw fail(E_INVALIDARG, `${C}: Frames is not an array of integers`); frames = arr; }
  const list = listArg(app, a[m.arg], m.arg === 'InputObj'); // inferred in the note: InputObj defaults to the selection
  if (!list.length) throw fail(E_INVALIDARG, `${C}: no input object`);
  const first = list[0];
  if (!isOp(first) || !first.paint) throw fail(E_INVALIDARG, `${C}: the first object is not a paint clip`);
  if (m.needSel && ![...first.paint.frames.values()].some(f => f.selected)) throw fail(E_INVALIDARG, MSG_NO_SELECTED);
  else if (m.needMod && !(first.paint.modifiedCount > 0)) throw fail(E_INVALIDARG, MSG_NO_MODIFIED);
  // Do: every object of the list that is a paint clip; the value returned by the clip method is discarded
  let clips = 0;
  for (const o of list) {
    if (!isOp(o) || !o.paint) continue; clips++;
    switch (m.mode) {
      case 0: save(app, C, o, 'modified'); break;
      case 1: save(app, C, o, 'selected'); break;
      case 2: for (const key of collect(o, 'selected')) revertFrame(app, o, key); break; // key -> time -> key (inferred identity)
      case 3: logNya(app, C, KEY_NYA, `${NOTE_E} open question 2`); revertFrame(app, o, time); break;
      case 4: {
        // inferred: "discard everything" resets all painted frames, the modified counter, the selection and the caches (the routine was not opened)
        logNya(app, C, 'which maps, counters and flags the "discard everything" routine resets; all painted frames, the modified counter, the frame selection and the cached buffers are cleared', `${NOTE_E} open question 1`);
        o.paint.frames.clear(); o.paint.modifiedCount = 0; o.paint.cacheA.clear(); o.paint.cacheB.clear();
        uiRefresh(app, o); notify(app, o, 0x3e9); break;
      }
      case 5: case 6: case 7: break; // the three interface slots are the shared "return 0" stub: no effect
      case 8:
        clearSelection(app, o);
        if (!frames.length) break;
        logNya(app, C, KEY_NYA, `${NOTE_E} open question 2`);
        for (const fr of frames) { const f = o.paint.frames.get(frameKey(fr)); if (f) f.selected = true; } // frames without paint data are ignored
        uiRefresh(app, o); break;
      case 9: clearSelection(app, o); break;
    }
  }
  if (!clips) throw fail(E_INVALIDARG, `${C}: no paint clip in the input`);
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ registration
export function registerFxCoreB9eCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);

  for (const m of PAINT_MODES) reg({
    name: m.name, label: m.label, category: 'FxTree', undoable: false, // Undo / Redo return 0x80004005: not undoable
    args: [{ name: m.arg, default: null }, ...(m.extra ?? [])],
    execute(app, a) { paintTask(app, m, a); },
  });

  reg({
    name: 'CreateFxTree', label: 'CreateFxTree', category: 'FxTree', description: 'Creates an FxTree object under the scene root and returns it.',
    args: [], // `Value` is output only and is not read
    execute(app) {
      const root = app.scene.root; let tree: FxTree | null = null;
      // Undo deletes the object; Redo runs Do again, which creates a fresh FxTree object
      app.record('CreateFxTree', () => { tree = new FxTree(uniqueName(root.properties.map(p => p.name), 'FxTree')); root.addProperty(tree); }, // inferred: class default name "FxTree"
        () => { if (tree) root.removeProperty(tree); });
      setStatus(app, 'CreateFxTree', S_OK);
      return tree as FxTree | null;
    },
  });

  reg({
    name: 'DisconnectFxOp', label: 'DisconnectFxOp', category: 'FxTree', description: 'Disconnects one input of an FX operator.',
    args: [{ name: 'Op', default: null }, { name: 'Connection', default: '' }],
    execute(app, a) {
      const C = 'DisconnectFxOp'; const op = objArg(app, a.Op);
      // as shipped: the text raised for a wrong Op is the connection text
      if (!isOp(op)) throw fail(E_INVALIDARG, 'Argument 2 is not a valid connection name or number');
      const name = text(a.Connection);
      if (/^allinputs$/i.test(name) || /^all$/i.test(name)) {
        // as shipped: the worker returns success without disconnecting anything in these two modes
        logNya(app, C, `whether the "${name}" mode is handled by the script wrapper outside fxcore.dll; the fxcore.dll worker does nothing in this mode and nothing is disconnected`, `${NOTE_E} open question 4`);
        setStatus(app, C, S_OK); return;
      }
      logNya(app, C, CNX_NYA, `${NOTE_E} open question 3`);
      const cnx = connectionFromName(op, name);
      if (!cnx || cnx.isOutput) throw fail(E_INVALIDARG, `${C}: the connection does not designate an input`);
      const input = op.inputs[cnx.index];
      if (!input.source) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: the input is not connected`);
      const source = input.source, out = input.sourceOutput;
      app.record(C, () => { input.source = null; input.sourceOutput = 0; }, () => { input.source = source; input.sourceOutput = out; });
      setStatus(app, C, S_OK);
    },
  });

  reg({
    name: 'RenderFxOp', label: 'RenderFxOp', category: 'FxTree', description: 'Renders the frame range of a File Output operator.', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'Interactive', default: false }],
    execute(app, a) {
      const C = 'RenderFxOp';
      const op = unset(a.InputObj) ? app.selection[0] : Array.isArray(a.InputObj) ? objArg(app, a.InputObj[0]) : objArg(app, a.InputObj); // inferred in the note: InputObj defaults to the selection
      if (!isOp(op) || op.classId !== CLASS_FILE_OUTPUT) throw fail(E_INVALIDARG, `${C}: the argument is not a File Output operator`);
      const interactive = a.Interactive === true; // only a boolean is honoured
      logNya(app, C, 'the render progress dialog (start / end / step fields, result image, cancel); the status texts are logged as when the application runs without UI', `${NOTE_E} open question 9`);
      if (interactive) logNya(app, C, 'the Interactive wait for the user in the progress dialog; rendering starts at once', `${NOTE_E} open question 9`);
      // render interface: begin. inferred: an operator outside a tree refuses to begin
      if (!op.tree) throw fail(E_FAIL, `${C}: the operator refused to begin rendering`);
      const start = Math.trunc(Number(op.val('StartFrame'))), end = Math.trunc(Number(op.val('EndFrame')));
      let step = Math.trunc(Number(op.val('Step')));
      if (!(step >= 1)) { logNya(app, C, `a frame step of ${step} (the loop would not advance); a step of 1 is used`); step = 1; } // inferred
      const file = text(op.val('FileName')); const outName = file || '** Output File Name Not Set ***';
      logNya(app, C, 'the image evaluation of the operator graph and the file writing; each frame is recorded on the operator (rendered) instead', NOTE_E);
      app.logMsg('info', 'Rendering Images');
      const t0 = performance.now(); let done = 0; const total = end >= start ? Math.floor((end - start) / step) + 1 : 0; op.rendered = [];
      for (let frame = start; frame <= end; frame += step) {
        const f0 = performance.now();
        const name = file ? sequenceFile(file, frame) : outName; // inferred: per-frame file name
        app.logMsg('info', `Rendering ${name}`);
        op.rendered.push(name); done++;
        const last = (performance.now() - f0) / 1000, sum = (performance.now() - t0) / 1000, avg = sum / done;
        app.logMsg('info', `Last Frame ${last.toFixed(2)}   Average ${avg.toFixed(2)}   Total ${sum.toFixed(2)}   Estimated Left ${(avg * (total - done)).toFixed(2)}`);
      }
      if (done) app.logMsg('info', `Done Rendering Fx Op.  Total Render Time ${((performance.now() - t0) / 1000).toFixed(6)}`);
      setStatus(app, C, S_OK); // 0 for a completed, cancelled or frame-failed render
    },
  });

  reg({
    name: 'SetFxOpPos', label: 'SetFxOpPos', category: 'FxTree', description: 'Moves an FX operator node so that its centre is (x, y).',
    args: [{ name: 'FxOp', default: null }, { name: 'x', default: 0 }, { name: 'y', default: 0 }],
    execute(app, a) {
      const C = 'SetFxOpPos'; const op = objArg(app, a.FxOp);
      if (!isOp(op)) throw fail(E_INVALIDARG, 'Argument must be an image operator');
      const x = Math.fround(Number(a.x)), y = Math.fround(Number(a.y));
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw fail(E_INVALIDARG, `${C}: x / y is not a number`);
      if (!op.tree) throw fail(E_INVALIDARG, `${C}: the operator has no node layout record`); // the layout record comes from the node's owner
      const before = [...op.rect] as [number, number, number, number];
      const w = before[2] - before[0], h = before[3] - before[1];
      const move = (cx: number, cy: number) => { op.rect = [cx - w / 2, cy - h / 2, cx - w / 2 + w, cy - h / 2 + h]; op.positioned = true; notify(app, op, 'FX_OP_ATTRIB_CHANGED'); };
      // Undo is the same worker with the remembered centre (the "explicitly positioned" flag stays set)
      app.record(C, () => move(x, y), () => move((before[0] + before[2]) / 2, (before[1] + before[3]) / 2));
      setStatus(app, C, S_OK);
    },
  });

  reg({
    name: 'MakeWarperShapePair', label: 'Make Warper Shape Pair', category: 'FxTree', description: 'Pairs 2D shapes of a Warp / Morph operator (source and destination) and styles them.',
    undoable: false, // the Undo and Redo slots are no-ops (as shipped)
    args: [{ name: 'FxOp', default: null }, { name: 'InputObj', default: null }],
    execute(app, a) {
      const C = 'MakeWarperShapePair'; const op = objArg(app, a.FxOp);
      if (!isOp(op) || (op.classId !== CLASS_WARP_A && op.classId !== CLASS_WARP_B) || op.shapeLists.length < 4) throw fail(E_INVALIDARG, 'Argument 1 must be a Warp or Morth operator');
      const list = listArg(app, a.InputObj, true); // F3DCmdGetInputObjects. inferred: the selection when omitted
      const L = (n: number): FxShapeList => op.shapeLists[n - 1];
      let processed = 0;
      for (const shape of list) {
        if (!isShape(shape)) break; // the walk stops at the first item that is not a 2D shape
        pairShape(app, C, L, shape); processed++;
      }
      if (!processed) throw fail(E_INVALIDARG, `${C}: no 2D shape in the input`);
      setStatus(app, C, S_OK);
    },
  });
}

const STYLE_SOURCE = [0.8, 0, 0.8, 1, 0, 1], STYLE_DEST = [0, 0.5, 0.5, 0, 1, 1];
function style(s: FxShape, v: number[]) {
  // inferred in the note: the boolean is UsesWireColor and the six doubles are WireframeUnselColor / WireframeSelColor (names behind the GUIDs not resolved)
  s.set('UsesWireColor', true); s.wireUnsel = [v[0], v[1], v[2]]; s.wireSel = [v[3], v[4], v[5]];
}
/** The per-shape step of MakeWarperShapePair. Lists: 1 source shapes, 3 destination shapes, 2 and 4 correspondences. */
function pairShape(app: App, C: string, L: (n: number) => FxShapeList, shape: FxShape) {
  let partnerList: FxShapeList; let isSource: boolean;
  if (L(1).byId(shape.shapeId) === shape) { isSource = true; partnerList = L(3); }
  else {
    const found = L(3).byId(shape.shapeId);
    if (!found) throw fail(E_INVALIDARG, `${C}: the shape is in neither the source nor the destination list`);
    if (found !== shape) throw fail(E_UNEXPECTED, `${C}: another shape with the same id is in the list`);
    isSource = false; partnerList = L(1);
  }
  let partner = partnerList.byId(shape.shapeId) as FxShape | null;
  if (!partner) { partner = shape.duplicate(); partnerList.addItem(partner); } // scene duplication helper; the copy keeps the shape id
  style(isSource ? shape : partner, STYLE_SOURCE);
  style(isSource ? partner : shape, STYLE_DEST);
  for (const n of [2, 4]) {
    if (L(n).byId(shape.shapeId)) continue;
    L(n).addItem(new FxShapeCorr(shape.name, shape.shapeId));
    logNya(app, C, `the initialisation of the correspondence object (its five default values); an empty correspondence for shape id ${shape.shapeId} is added to list ${n}`, `${NOTE_E} MakeWarperShapePair missing (a)`);
  }
}

/** Rows CMD-B9e, CMD-B9f, CMD-B9g: the task commands of fxcore.dll (the single entry main.ts calls). */
export function registerFxCoreTaskCommands(app: App) {
  (app as any).fxCore = makeState(app);
  registerFxCoreB9eCommands(app);
  registerFxCoreShapeCommands(app);
  registerFxCoreOpCommands(app);
}
