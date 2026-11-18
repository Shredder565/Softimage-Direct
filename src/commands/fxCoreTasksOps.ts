// Ledger rows CMD-B9f and CMD-B9g, FX operator commands of fxcore.dll. Briefs:
// docs/ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md (ConnectFxOp, SetFxOpAttrib, AddPassInputFxOp,
// StartFxTracking, CurrentFxTracking, StepFxTracking) and
// docs/ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md (AddFxOp, AddImageClipFxOp, SetFxOpCnxFlag, CutFxOp,
// CopyFxOp, PasteFxOp, SetFxTrackerTrackedPoint, SetFxTrackerTemplateArea, SetFxTrackerSearchArea).
// Original code written from those prose contracts only; no XSIBATCH golden exists for the rows.
//
// The operators are the stand-in classes of fxCoreTasksModel.ts. The Windows clipboard is `app.fxCore.clipboard`
// (format name, operator chunks and the `_xnc` connection chunk as the note lays them out, as plain data).
import { App, CommandDef } from '../core/commands';
import { Pass } from '../core/scene';
import { isImageClip, imageClips } from '../core/textureLayers';
import {
  NOTE_F, NOTE_G, S_OK, S_FALSE, E_POINTER, E_FAIL, E_UNEXPECTED, E_INVALIDARG, CLIPBOARD_FORMAT, CLSID_CLIPBOARD_TASK, CLASS_FILE_INPUT, GUID_TRACKING_SWITCH, CNX_NYA, FX_OP_CATALOGUE,
  FxOp, FxOpSpec, FxClipboard, stateOf, unset, text, fail, setStatus, logNya, notify, isOp, isTree, objArg, listArg, uniqueName,
  setValueTask, saveKeyTask, addOp, makeOp, deleteOpsTask, connectionFromName, connectRaw, catalogueSpec,
} from './fxCoreTasksModel';

const MSG_IMAGE_OP = 'Argument must be an image operator';
const MSG_TREE_1 = 'Argument 1 must be an EffectsTree object';
const MSG_TRACKER = 'Argument must be a tracker operator';

/** Adds a new operator to a tree, undoably. Redo creates a new object (the Do steps run again). */
function createOpTask(app: App, label: string, tree: any, spec: FxOpSpec, init?: (op: FxOp) => void): () => FxOp {
  let op: FxOp | null = null;
  app.record(label, () => { op = makeOp(tree, spec); addOp(tree, op); init?.(op); }, () => { if (op) deleteNow(op); });
  return () => op!;
}
/** DeleteObj on one freshly created operator (no undo data of its own: it is the undo of a creation). */
function deleteNow(op: FxOp) {
  const t = op.tree; if (!t) return;
  for (const o of t.ops) for (const i of o.inputs) if (i.source === op) { i.source = null; i.sourceOutput = 0; }
  t.ops.splice(t.ops.indexOf(op), 1); op.tree = null; op.parent = null;
}

// inferred from the parameter order of Tracking_IllFx.spdl (four trackers): the row blocks of the tracker interface.
// Rows Tracker + 0 template area, + 8 search area, + 12 and + 20 tracked point are the note's; the names are not attested.
const TRACK_BLOCKS: [string, string[]][] = [
  ['Template', ['Left', 'Bottom', 'Right', 'Top']], ['TemplatePos', ['posx', 'posy']], ['SearchArea', ['Left', 'Bottom', 'Right', 'Top']],
  ['TrackPos', ['posx', 'posy']], ['TrackSrc', ['posx', 'posy']], ['TrackFullPos', ['posx', 'posy']],
];
/** Tracker interface: (row, component) -> parameter id; null for a component the operator does not have. */
function trackerParam(row: number, component: number): string | null {
  if (!Number.isInteger(row) || row < 0) return null;
  const block = TRACK_BLOCKS[Math.floor(row / 4)]; const comp = block?.[1][component];
  return block && comp ? `${block[0]}${(row % 4) + 1}.${comp}` : null;
}

function snapshot(ops: FxOp[]): FxClipboard {
  return {
    format: CLIPBOARD_FORMAT, count: ops.length,
    ops: ops.map(o => ({ spec: o.spec, name: o.name, values: Object.fromEntries(o.params.map(p => [p.name, p.value])), indexed: [...o.indexed], rect: [...o.rect], positioned: o.positioned, paint: !!o.paint })),
    // per input: position (in this copy set) of the operator feeding it or -1, and the source-side index
    cnx: { guid: CLSID_CLIPBOARD_TASK, inputs: ops.map(o => o.inputs.map(i => [i.source ? ops.indexOf(i.source) : -1, i.sourceOutput] as [number, number])) },
  };
}

export function registerFxCoreOpCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  const st = stateOf(app);

  // ---------------------------------------------------------------- AddFxOp
  reg({
    name: 'AddFxOp', label: 'AddFxOp', category: 'FxTree', description: 'Creates an FX operator of a named type in an FX tree and returns it.',
    args: [{ name: 'FxTree', default: null }, { name: 'PresetName', default: '' }],
    execute(app, a) {
      const C = 'AddFxOp'; const tree = objArg(app, a.FxTree);
      if (!isTree(tree)) throw fail(E_INVALIDARG, MSG_TREE_1);
      if (a.PresetName !== null && a.PresetName !== undefined && typeof a.PresetName === 'object') throw fail(E_INVALIDARG, 'Argument 2 must be an image operator type name (ex : "blur"');
      const name = text(a.PresetName);
      logNya(app, C, 'the tree method that maps a type name to an operator class (valid names, preset files, default node position, the error for an unknown name)', `${NOTE_G} open question 1`);
      // inferred: an empty type name is refused by the tree with 0x80070057
      if (!name.trim()) throw fail(E_INVALIDARG, `${C}: no operator type name`);
      let spec = catalogueSpec(name);
      if (!spec) {
        // inferred: a name outside the stand-in catalogue gives a generic one-input operator of that type
        const type = name.split(/[\\/]/).pop()!.replace(/\.preset$/i, '').trim();
        spec = { type, inputs: ['Input'] };
        logNya(app, C, `the operator class of type "${name}"; a generic one-input operator of that type is created`, `${NOTE_G} open question 1`);
      }
      const get = createOpTask(app, C, tree, spec);
      setStatus(app, C, S_OK);
      return get();
    },
  });

  // ---------------------------------------------------------------- AddImageClipFxOp
  reg({
    name: 'AddImageClipFxOp', label: 'AddImageClipFxOp', category: 'FxTree', description: 'Brings an image clip into an FX tree as a pair of clip operators; returns the first.',
    args: [{ name: 'FxTree', default: null }, { name: 'ImageClip', default: null }],
    execute(app, a) {
      const C = 'AddImageClipFxOp'; const tree = objArg(app, a.FxTree);
      if (!isTree(tree)) throw fail(E_INVALIDARG, MSG_TREE_1);
      const clip = typeof a.ImageClip === 'string' ? imageClips(app.scene).find(c => c.name === a.ImageClip || c.fullName === a.ImageClip) : a.ImageClip;
      if (!isImageClip(clip)) throw fail(E_INVALIDARG, 'Argument 2 must be an image clip');
      // inferred: operator A (class 68cb0090-...) is the ClipIn operator and B (class 4288036e-...) the ClipOut operator (note G open question 2)
      logNya(app, C, 'which of the two created classes is the ClipIn and which the ClipOut operator, the clip companion object (property 0x27 element reference) and the helper calls that attach it to A and B', `${NOTE_G} open question 2`);
      const clipName = clip.name;
      const getA = createOpTask(app, C, tree, FX_OP_CATALOGUE.clipin, op => { op.boundClip = { role: 'companion', clip }; op.set('ClipName', clipName); }); // inferred: the companion is the clip's image source
      const getB = createOpTask(app, C, tree, FX_OP_CATALOGUE.clipout, op => { op.boundClip = { role: 'clip', clip }; op.set('ClipName', clipName); connectRaw(getA(), op, 0); });
      logNya(app, C, 'clip property 0x1c and clip parameter 1ed647ee-1f72-11d3-826f-00a0c9ed6e30 (set to 0 when the property is non-zero); the clip is left unchanged', `${NOTE_G} open question 2`);
      void getB;
      setStatus(app, C, S_OK);
      return getA();
    },
  });

  // ---------------------------------------------------------------- AddPassInputFxOp
  reg({
    name: 'AddPassInputFxOp', label: 'AddPassInputFxOp', category: 'FxTree', description: 'Adds to an FX tree an input operator reading the rendered sequence of a render pass framebuffer.',
    args: [{ name: 'FxTree', default: null }, { name: 'RenderPass', default: null }, { name: 'Framebuffer', default: '' }],
    execute(app, a) {
      const C = 'AddPassInputFxOp'; const tree = objArg(app, a.FxTree);
      const pass = typeof a.RenderPass === 'string' ? app.scene.passes.find(p => p.name === a.RenderPass || p.fullName === a.RenderPass) : a.RenderPass;
      // inferred: the status of a wrong FxTree / RenderPass (the HRESULT of fx_cmd::GetArgUnknownFromIdx was not read); no message text
      if (!isTree(tree)) throw fail(E_INVALIDARG, `${C}: FxTree is not an FX tree`);
      if (!(pass instanceof Pass)) throw fail(E_INVALIDARG, `${C}: RenderPass is not a render pass`);
      // inferred: the render range block (two integers and a kind, 1 = sequence) read as this build reads a pass's frame range
      const src = Number(pass.val('FrameRangeSource')) === 3 ? app.scene.renderOptions : pass; const mode = Number(src.val('FrameRangeSource'));
      const sequence = mode !== 1;
      const range = mode === 2 ? [app.anim.startFrame, app.anim.endFrame] : [Number(src.val('FrameStart')), Number(src.val('FrameEnd'))];
      logNya(app, C, 'the layout of the pass render range block and the meaning of its two integers (taken as start and end frame)', `${NOTE_F} open question 5`);
      if (!sequence) { app.logMsg('info', 'Only passes set to render sequences can be added as input clips.'); setStatus(app, C, S_FALSE); return null; } // message 0x2d, status 1
      const wanted = (text(a.Framebuffer) || 'Main').toLowerCase();
      const fb = pass.framebuffers.find(f => f.name.toLowerCase() === wanted);
      if (!fb) throw fail(E_INVALIDARG, `${C}: the pass has no framebuffer "${text(a.Framebuffer) || 'Main'}"`);
      const file = text(fb.val('ResolvedFilename')) || text(fb.val('Filename')); // inferred in the note: the framebuffer's resolved output file name
      logNya(app, C, 'what the framebuffer returns for the "undefined" time, and the names of File Input operator parameters 2, 4, 5 (set by numeric id)', `${NOTE_F} open question 5`);
      const get = createOpTask(app, C, tree, { type: 'FileInputOp', classId: CLASS_FILE_INPUT, inputs: [] }, op => { op.setIx(2, file); op.setIx(4, Math.trunc(range[0])); op.setIx(5, Math.trunc(range[1])); });
      setStatus(app, C, S_OK);
      return get();
    },
  });

  // ---------------------------------------------------------------- ConnectFxOp
  reg({
    name: 'ConnectFxOp', label: 'ConnectFxOp', category: 'FxTree', description: 'Connects the output of Op1 to an input of Op2.',
    args: [{ name: 'Op1', default: null }, { name: 'Op2', default: null }, { name: 'Connection', default: '' }],
    execute(app, a) {
      const C = 'ConnectFxOp'; const op1 = objArg(app, a.Op1), op2 = objArg(app, a.Op2);
      if (!isOp(op1) || !isOp(op2)) throw fail(E_INVALIDARG, MSG_IMAGE_OP);
      const name = text(a.Connection);
      if (/^allinputs$/i.test(name)) {
        logNya(app, C, 'why "AllInputs" is accepted: the worker does nothing in this mode and nothing is connected', `${NOTE_F} open question 3`);
        setStatus(app, C, S_OK); return;
      }
      logNya(app, C, CNX_NYA, `${NOTE_F} open question 2`);
      const cnx = connectionFromName(op2, name);
      if (!cnx) throw fail(E_INVALIDARG, 'Argument 3 is not a valid connection name or number');
      if (cnx.isOutput) throw fail(E_INVALIDARG, 'Argument 3 must be an input port');
      if (!op1.tree || !op2.tree) throw fail(E_UNEXPECTED, `${C}: an operator has no graph node`); // inferred: an operator outside a tree has no graph node
      const i = cnx.index; const input = op2.inputs[i];
      // step 2. inferred: the per-input query of slot 10 answers false, so an existing source is remembered and disconnected
      const prev = input.source ? { source: input.source, out: input.sourceOutput } : null;
      let ok = true;
      app.record(C, () => { input.source = null; input.sourceOutput = 0; ok = connectRaw(op1, op2, i); },
        () => { input.source = prev?.source ?? null; input.sourceOutput = prev?.out ?? 0; });
      if (!ok) throw fail(E_INVALIDARG, `${C}: the connect helper failed`);
      // step 5. inferred: the on/off parameter of the input is its Select flag (numeric index i + 5, note G SetFxOpCnxFlag)
      if (input.hasSelect && op2.getIx(i + 5) !== true) {
        logNya(app, C, 'the per-input queries that pick the boolean parameter switched on by a connection (taken to be the Select flag of the input)', `${NOTE_F} open question 3`);
        setValueTask(app, op2, i + 5, true);
      }
      setStatus(app, C, S_OK);
    },
  });

  // ---------------------------------------------------------------- SetFxOpCnxFlag
  reg({
    name: 'SetFxOpCnxFlag', label: 'SetFxOpCnxFlag', category: 'FxTree', description: 'Switches the Select or Invert flag of one input connection of an FX operator.',
    args: [{ name: 'FxOp', default: null }, { name: 'Connection', default: '' }, { name: 'FlagName', default: '' }, { name: 'Value', default: true }],
    execute(app, a) {
      const C = 'SetFxOpCnxFlag'; const op = objArg(app, a.FxOp);
      if (!isOp(op)) throw fail(E_INVALIDARG, MSG_IMAGE_OP);
      logNya(app, C, CNX_NYA, `${NOTE_G} new ledger rows`);
      const cnx = connectionFromName(op, text(a.Connection));
      if (!cnx || cnx.isOutput) throw fail(E_INVALIDARG, 'Argument 2 is not a valid connection name or number');
      const flag = text(a.FlagName).toLowerCase().slice(0, 3); // only the first three characters are compared
      if (flag !== 'sel' && flag !== 'inv') throw fail(E_INVALIDARG, 'Argument 3 must the known flags "Select" or "Invert"');
      const value = typeof a.Value === 'boolean' ? a.Value : true; // anything that is not a boolean counts as true
      const n = cnx.index; const input = op.inputs[n];
      if (!(flag === 'sel' ? input.hasSelect : input.hasInvert)) throw fail(E_INVALIDARG, `${C}: input ${n} has no ${flag === 'sel' ? 'Select' : 'Invert'} flag`);
      setValueTask(app, op, flag === 'sel' ? n + 5 : n + 13, value);
      setStatus(app, C, S_OK);
    },
  });

  // ---------------------------------------------------------------- SetFxOpAttrib
  const ATTRIB: Record<string, number> = { rect: 1, showthumbnail: 2, list: 0, help: 0, '?': 0 };
  reg({
    name: 'SetFxOpAttrib', label: 'SetFxOpAttrib', category: 'FxTree', description: 'Sets a UI attribute of FX operator(s); only Rect has an effect.',
    args: [{ name: 'Op', default: null }, { name: 'Attrib', default: '' }, { name: 'Value', default: null }],
    execute(app, a) {
      const C = 'SetFxOpAttrib'; const ops = listArg(app, a.Op, false);
      if (!ops.length) throw fail(E_INVALIDARG, 'Argument 1 must be one or more fx operator');
      const id = ATTRIB[text(a.Attrib).toLowerCase()];
      if (!id) throw fail(E_INVALIDARG, 'Argument 2 must be an attribute name');
      const arr = Array.isArray(a.Value) || ArrayBuffer.isView(a.Value) ? Array.from(a.Value as any) : null;
      if (!arr || arr.length !== 4 * ops.length) throw fail(E_INVALIDARG, `${C}: Value must be an array of 4 x ${ops.length} elements`);
      for (const op of ops) {
        if (!isOp(op) || !op.tree) throw fail(E_INVALIDARG, `${C}: an operator has no owning FX tree`);
        if (id === 2) continue; // ShowThumbnail: the lookups run but nothing is written
        if (arr.length !== 4) throw fail(E_INVALIDARG, `${C}: Rect takes exactly 4 values`);
        const r = arr.map(v => (typeof v === 'boolean' || v === null || v === '' ? NaN : Math.fround(Number(v))));
        if (r.some(v => !Number.isFinite(v))) throw fail(E_INVALIDARG, `${C}: a Rect value is not a number`);
        if (r[3] < r[1]) [r[1], r[3]] = [r[3], r[1]];
        if (r[2] < r[0]) [r[0], r[2]] = [r[2], r[0]];
        if (r[3] - r[1] < 25) r[3] = r[1] + 25;
        if (r[2] - r[0] < 60) r[3] = r[1] + 100; // as coded: the width test changes r3
        const before = [...op.rect] as [number, number, number, number];
        logNya(app, C, 'whether Undo / Redo work (the Do releases the operator list they use), and the order of the four Rect numbers (taken as the layout record order left, top, right, bottom); undo restores the previous four values', `${NOTE_F} open question 4`);
        const write = (v: number[]) => { op.rect = [v[0], v[1], v[2], v[3]]; notify(app, op, 'FX_FXTOBJ_VISUALCHG'); };
        app.record(C, () => write(r), () => write(before));
      }
      if (id === 2) logNya(app, C, 'ShowThumbnail (no effect in fxcore.dll; handled elsewhere or not at all)', `${NOTE_F} open question 4`);
      setStatus(app, C, S_OK);
    },
  });

  // ---------------------------------------------------------------- CutFxOp / CopyFxOp / PasteFxOp
  for (const [name, label, cut] of [['CutFxOp', 'Cut Fx Operators To Clipboard', true], ['CopyFxOp', 'Copy Fx Operators To Clipboard', false]] as [string, string, boolean][]) reg({
    name, label, category: 'FxTree', description: cut ? 'Copies the FX operators to the clipboard and deletes them.' : 'Copies the FX operators to the clipboard.',
    args: [{ name: 'InputObj', default: null }],
    execute(app, a) {
      const ops = listArg(app, a.InputObj, true).filter(isOp); // F3DCmdGetInputObjects. inferred in the note: the selection when omitted
      if (!ops.length) throw fail(E_INVALIDARG, a.InputObj === null || a.InputObj === undefined ? 'Argument must be a list of Fx Operators' : `${name}: no FX operator in the list`);
      st.clipboard = snapshot(ops); // the clipboard is not restored by undo
      if (cut) deleteOpsTask(app, ops);
      setStatus(app, name, S_OK);
    },
  });
  reg({
    name: 'PasteFxOp', label: 'Paste Fx Operators From Clipboard', category: 'FxTree', description: 'Pastes the FX operators of the clipboard into an FX tree.',
    args: [{ name: 'FxTree', default: null }],
    execute(app, a) {
      const C = 'PasteFxOp'; const tree = objArg(app, a.FxTree);
      if (!isTree(tree)) throw fail(E_INVALIDARG, 'Argument must be a FxTree object');
      const cb = st.clipboard;
      if (!cb || cb.format !== CLIPBOARD_FORMAT || !cb.count) throw fail(E_FAIL, `${C}: no FX operators on the clipboard`);
      const taken = tree.ops.map(o => o.name);
      const pasted = cb.ops.map(c => {
        const op = new FxOp(c.spec, uniqueName(taken, c.name)); taken.push(op.name); // inferred: a pasted operator gets a unique name in the target tree
        for (const [k, v] of Object.entries(c.values)) if (k !== 'Name') op.set(k, v);
        for (const [k, v] of c.indexed) op.indexed.set(k, v);
        op.rect = [c.rect[0] + 64, c.rect[1] + 32, c.rect[2] + 64, c.rect[3] + 32]; op.positioned = true; // offset +64 / +32, explicitly positioned
        return op;
      });
      // the saved connections are replayed only when the chunk GUID is the handler CLSID; sources outside the copy set are dropped
      if (cb.cnx.guid === CLSID_CLIPBOARD_TASK) cb.cnx.inputs.forEach((ins, k) => ins.forEach(([pos, out], n) => { const src = pasted[pos]; const input = pasted[k].inputs[n]; if (pos >= 0 && src && input) { input.source = src; input.sourceOutput = out; } }));
      // Undo deletes the pasted operators; Redo brings the same operators back
      app.record(C, () => { for (const op of pasted) addOp(tree, op); }, () => { for (const op of pasted) { tree.ops.splice(tree.ops.indexOf(op), 1); op.tree = null; op.parent = null; } });
      setStatus(app, C, S_OK);
    },
  });

  // ---------------------------------------------------------------- tracker areas (one class, three commands)
  const AREAS: { name: string; rows: number[]; args: string[] }[] = [
    { name: 'SetFxTrackerTrackedPoint', rows: [20, 12], args: ['x', 'y'] }, // row 20 first, then 12
    { name: 'SetFxTrackerTemplateArea', rows: [0], args: ['x1', 'y1', 'x2', 'y2'] },
    { name: 'SetFxTrackerSearchArea', rows: [8], args: ['x1', 'y1', 'x2', 'y2'] },
  ];
  for (const m of AREAS) reg({
    name: m.name, label: m.name, category: 'FxTree', description: 'Sets and keys tracker values of a tracker operator at a time.',
    args: [{ name: 'FxOp', default: null }, { name: 'Time', default: null }, { name: 'Tracker', default: 0 }, ...m.args.map(n => ({ name: n, default: 0 }))],
    execute(app, a) {
      const C = m.name; const op = objArg(app, a.FxOp);
      if (!isOp(op)) throw fail(E_INVALIDARG, MSG_TRACKER);
      const time = unset(a.Time) ? app.anim.frame : Number(a.Time); // inferred: an omitted Time is the current frame (time argument handler)
      const tracker = Math.trunc(Number(a.Tracker)) | 0; const values = m.args.map(n => Math.fround(Number(a[n])));
      if (!Number.isFinite(time) || values.some(v => !Number.isFinite(v))) throw fail(E_INVALIDARG, `${C}: an argument is not a number`);
      // inferred: the missing tracker interface is not checked before use in the DLL; here it is reported as a null pointer
      if (!op.tracker) { logNya(app, C, 'the result for an FX operator that is not a tracker (the tracker interface is used unchecked)', NOTE_G); throw fail(E_POINTER, `${C}: the operator has no tracker interface`); }
      logNya(app, C, 'the names of the tracker rows (taken from the Tracking_IllFx.spdl parameter order) and the undo effect of recording only the SaveKey sub-task; Time is kept in frames', `${NOTE_G} open questions 5 and 6`);
      for (const base of m.rows) values.forEach((v, k) => {
        const id = trackerParam(tracker + base, k); if (!id) return; // components the operator does not have are skipped
        op.setIx(id, v); // SetValue at Time (this task is not recorded as a sub-task)
        saveKeyTask(app, op, id, time, v); // SaveKey at Time with that value (recorded)
      });
      notify(app, op, 'tracker data changed');
      setStatus(app, C, S_OK);
    },
  });

  // ---------------------------------------------------------------- tracking transport (one class, three commands)
  const TRANSPORT: [string, string, string][] = [['StartFxTracking', 'Track From Start', 'PlayForwardsFromStart'], ['CurrentFxTracking', 'Track From Current', 'PlayForwards'], ['StepFxTracking', 'Track Step', 'NextFrame']];
  TRANSPORT.forEach(([name, label, transport], mode) => reg({
    name, label, category: 'FxTree', description: 'Runs the FX tracker of the inspected tracker operator(s) by driving the transport.', undoable: false, // Undo / Redo: 0x80004001
    args: [{ name: 'InspectedObjectsArray', default: null }],
    execute(app, a) {
      const v = a.InspectedObjectsArray;
      // an array: every object element goes into the list; an empty array or a non-array leaves the task without a list
      if (!Array.isArray(v) || !v.length) throw fail(E_POINTER, `${name}: no operator list`);
      const list = v.filter(x => x !== null && typeof x === 'object');
      st.endTracking(false); // a new run replaces the earlier list reference and listeners
      const ops = list.filter(isOp);
      for (const op of ops) if (op.guidParams.has(GUID_TRACKING_SWITCH)) { op.guidParams.set(GUID_TRACKING_SWITCH, true); notify(app, op, GUID_TRACKING_SWITCH); }
      logNya(app, name, 'the tracking computation (it happens in the tracker operator during playback), the name of parameter 1569f817-8c17-4a80-a424-8b598cd4c9b9 and the events behind the two listener masks; the switch is set, the transport command runs and the run ends at the first frame notification that arrives while playback is stopped', `${NOTE_F} open question 6`);
      const run = st.tracking = { mode, ops, command: transport, active: true, dispose: null as (() => void) | null };
      app.run(transport, {});
      // inferred: the service notification that ends tracking is the end of playback
      const off = app.anim.onFrame(() => { if (run.active && !app.anim.playing && st.tracking === run) st.endTracking(true); });
      run.dispose = () => { off(); };
      setStatus(app, name, S_FALSE); // status 1 (success, not S_OK)
    },
  }));
}
