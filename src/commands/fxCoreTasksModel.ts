// Ledger rows CMD-B9e, CMD-B9f, CMD-B9g: the stand-in FX Tree model the fxcore.dll task commands work on.
// Briefs: docs/ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md, cmd-b9f-fxcore-2dshape-connect-tracking-binary.md,
// cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md. Original code written from those prose contracts only.
//
// This build has no FX Tree. The classes below are a small original model that carries exactly what the contracts
// state: FX trees (a property of type `FxTree` under the scene root), operators with inputs / outputs / a node layout
// rectangle / parameters addressed by numeric index, connections, 2D shapes with point records and keys, shape lists,
// shape correspondences, paint clip frame maps, tracker rows and a clipboard. Nothing here evaluates an image.
// Everything the notes leave open (operator catalogue, connection name rules, default sizes) is marked `// inferred`.
import { App } from '../core/commands';
import { Node, Property } from '../core/scene';
import { num, int, bool, str } from '../core/params';
import { SiStatusError } from './alembicSeqCam';

export const NOTE_E = 'docs/ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md';
export const NOTE_F = 'docs/ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md';
export const NOTE_G = 'docs/ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md';
export const S_OK = 0, S_FALSE = 1;
export const E_NOTIMPL = 0x80004001, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_UNEXPECTED = 0x8000ffff, E_INVALIDARG = 0x80070057, DISP_E_MEMBERNOTFOUND = 0x80020003;
export const CLIPBOARD_FORMAT = 'Persisted Softimage|FX Operators';
export const CLSID_CLIPBOARD_TASK = '0322d097-8d58-411b-95ee-a3fb0707052a';
export const CLASS_FILE_OUTPUT = '9acb71ff-0e3e-41cc-bb6b-d050b9dacd41';
export const CLASS_FILE_INPUT = 'ca6f7760-1b1a-11d5-b93d-0800690c8bd0';
export const CLASS_WARP_A = '6a87f95f-ca69-4898-9434-09bc0224fe69', CLASS_WARP_B = 'bc0f7833-15b6-4ef4-8c22-ba7694c8b4e1';
export const CLASS_CLIP_A = '68cb0090-3ae7-4951-a12a-178d1d44d961', CLASS_CLIP_B = '4288036e-a57b-4c17-98f7-c4f394c5aaec';
export const GUID_TRACKING_SWITCH = '1569f817-8c17-4a80-a424-8b598cd4c9b9';

/** A parameter key of the SetValue / SaveKey sub-tasks: a numeric index (the `{0x402, n}` descriptor) or a per-point id. */
export type PKey = number | string;

/** Base of every stand-in FX object: values addressed by key, and keys (time -> value) per parameter key. */
export class FxNode extends Property {
  readonly indexed = new Map<PKey, any>();
  readonly fxKeys = new Map<PKey, Map<number, any>>();
  getIx(key: PKey): any { return this.indexed.get(key); }
  setIx(key: PKey, v: any) { if (v === undefined) this.indexed.delete(key); else this.indexed.set(key, v); }
  keysOf(key: PKey): Map<number, any> { let m = this.fxKeys.get(key); if (!m) this.fxKeys.set(key, m = new Map()); return m; }
}

// ------------------------------------------------------------------ trees and operators
export class FxTree extends Property {
  readonly isFxTree = true;
  readonly ops: FxOp[] = [];
  constructor(name: string) { super(name, 'FxTree', []); } // creation defaults of the FxTree property set are not read (note E, new ledger rows)
  explorerChildren(): Node[] { return [...this.ops]; }
}
export interface FxInput { name: string; source: FxOp | null; sourceOutput: number; hasSelect: boolean; hasInvert: boolean }
export interface FxOpSpec {
  type: string; classId?: string; name?: string;
  inputs?: (string | { name: string; select?: boolean; invert?: boolean })[];
  outputs?: string[]; params?: any[];
  paint?: boolean; tracker?: boolean; shapeLists?: string[];
}
export interface PaintFrame { modified: boolean; selected: boolean; raster: any }
/** State of the paint clip interface (note E 2.2): frame map, modified counter, two secondary caches, name / offset. */
export class PaintData {
  readonly frames = new Map<number, PaintFrame>();
  modifiedCount = 0;
  readonly cacheA = new Map<number, any>();
  readonly cacheB = new Map<number, any>();
  outputFile: string | null = null;
  startOffset = 0;
}
export class FxOp extends FxNode {
  readonly isFxOp = true;
  tree: FxTree | null = null;
  inputs: FxInput[] = [];
  outputs: string[] = ['Output'];
  /** Node layout record: left, top, right, bottom (FX Tree view units). */
  rect: [number, number, number, number] = [0, 0, 100, 25]; // inferred: default node size (the note gives only the minimums 60 / 25 and the fallback 100)
  positioned = false;
  classId = '';
  readonly guidParams = new Map<string, any>();
  paint: PaintData | null = null;
  tracker = false;
  shapeLists: FxShapeList[] = [];
  /** AddImageClipFxOp: the clip data bound to a clip operator. */
  boundClip: any = null;
  /** RenderFxOp: the frames rendered through this operator (file names), newest run last. */
  rendered: string[] = [];
  constructor(readonly spec: FxOpSpec, name: string) {
    super(name, spec.type, spec.params ?? []);
    this.classId = spec.classId ?? '';
    this.inputs = (spec.inputs ?? []).map(i => typeof i === 'string' ? { name: i, source: null, sourceOutput: 0, hasSelect: false, hasInvert: false } : { name: i.name, source: null, sourceOutput: 0, hasSelect: !!i.select, hasInvert: !!i.invert });
    this.outputs = spec.outputs ?? ['Output'];
    if (spec.paint) this.paint = new PaintData();
    this.tracker = !!spec.tracker;
    if (this.tracker) this.guidParams.set(GUID_TRACKING_SWITCH, false); // inferred in note F: the tracker's "tracking in progress" switch
    this.shapeLists = (spec.shapeLists ?? []).map(n => { const l = new FxShapeList(n); l.parent = this as any; return l; });
  }
  explorerChildren(): Node[] { return [...this.shapeLists]; }
}

// inferred: the operator catalogue. The tree method that maps a type name to an operator class was not read (note G,
// open question 1); these entries exist so that the class ids the three notes name can be created. The input layouts
// are stand-ins.
const FILE_OUT_PARAMS = () => [str('FileName', '', 'FileName'), int('StartFrame', 1, 'Start'), int('EndFrame', 1, 'End'), int('Step', 1, 'Step')]; // SPDL names (C3DFxFileOutOp.spdl); inferred: default values
const CLIP_PARAMS = () => [str('ClipName', '', 'Image Clip Name')];
export const FX_OP_CATALOGUE: Record<string, FxOpSpec> = {
  fileinput: { type: 'FileInputOp', classId: CLASS_FILE_INPUT, inputs: [] },
  fileoutput: { type: 'FileOutputOp', classId: CLASS_FILE_OUTPUT, inputs: ['Input'], params: FILE_OUT_PARAMS() },
  clipin: { type: 'ClipInOp', classId: CLASS_CLIP_A, inputs: [], params: CLIP_PARAMS() },
  clipout: { type: 'ClipOutOp', classId: CLASS_CLIP_B, inputs: ['Input'], params: CLIP_PARAMS() },
  paintclip: { type: 'FilePaintOp', inputs: [], paint: true },
  warp: { type: 'Warp', classId: CLASS_WARP_A, inputs: ['Input'], shapeLists: ['SourceShapes', 'SourceCorrespondences', 'DestinationShapes', 'DestinationCorrespondences'] },
  morph: { type: 'Morph', classId: CLASS_WARP_B, inputs: ['Input1', 'Input2'], shapeLists: ['SourceShapes', 'SourceCorrespondences', 'DestinationShapes', 'DestinationCorrespondences'] },
  tracker: { type: 'Tracker', inputs: ['Input'], tracker: true },
};
export function catalogueSpec(typeName: string): FxOpSpec | null {
  const k = typeName.split(/[\\/]/).pop()!.replace(/\.preset$/i, '').replace(/[\s_]/g, '').toLowerCase().replace(/op$/, '');
  const hit = FX_OP_CATALOGUE[k] ?? Object.values(FX_OP_CATALOGUE).find(s => s.type.toLowerCase() === k);
  return hit ? { ...hit, params: hit.params ? (hit.type === 'FileOutputOp' ? FILE_OUT_PARAMS() : CLIP_PARAMS()) : undefined } : null;
}

// ------------------------------------------------------------------ 2D shapes
const SHAPE_PARAMS = () => [num('PosX', 0, 'PosX'), num('PosY', 0, 'PosY'), num('SclX', 1, 'SclX'), num('SclY', 1, 'SclY'), num('PinX', 0, 'PinX'), num('PinY', 0, 'PinY'), num('Rotate', 0, 'Rotate Angle'), bool('UsesWireColor', false, 'UsesWireColor')]; // SPDL names (C3DFxShape.param.spdl); inferred: default values
const SHAPE_IX: Record<number, string> = { 3: 'PosX', 4: 'PosY', 5: 'SclX', 6: 'SclY', 7: 'PinX', 8: 'PinY', 9: 'Rotate' }; // (inferred in note F from the property page order)
const FIELD: Record<string, number> = { x: 0, y: 1, lhx: 2, lhy: 3, rhx: 4, rhy: 5 }; // inferred: order of the doubles inside a point record
export type ShapeStorage = 'bezier' | 'point';
export class FxShape extends FxNode {
  readonly isFxShape = true;
  shapeId = 0;
  list: FxShapeList | null = null;
  /** Point records: 7 doubles (point plus handles) for the Bezier storage, 2 doubles for the point storage. */
  points: number[][] = [];
  wireUnsel: [number, number, number] = [0, 0, 0];
  wireSel: [number, number, number] = [0, 0, 0];
  constructor(name: string, readonly storage: ShapeStorage) {
    super(name, storage === 'bezier' ? 'Bezier' : 'PointShape', storage === 'bezier' ? SHAPE_PARAMS() : [...SHAPE_PARAMS(), int('Type', 0, 'Type')]);
  }
  /** Shape kind of the shape interface: 0 = points with handles. */
  get shapeKind(): number { return this.storage === 'bezier' ? 0 : 1; }
  get pointCount(): number { return this.points.length; }
  /** Add / insert a point. Position -1 appends. Returns the index of the new point. */
  addPoint(x: number, y: number, position: number): number {
    const rec = this.storage === 'bezier' ? [x, y, x, y, x, y, 0] : [x, y]; // inferred: new handles sit on the point
    // inferred: a position outside 0..count appends (what the shape does with it was not read, note F)
    const i = position < 0 || position > this.points.length ? this.points.length : Math.trunc(position);
    this.points.splice(i, 0, rec);
    return i;
  }
  removePoint(i: number) { this.points.splice(i, 1); }
  /** Parameter ids of (point index, component 0 point / 1 left handle / 2 right handle); null when the shape has none. */
  pointParamIds(index: number, component: number): [string, string] | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.points.length) return null;
    if (component === 0) return [`${index}.x`, `${index}.y`];
    if (this.storage !== 'bezier') return null;
    return component === 1 ? [`${index}.lhx`, `${index}.lhy`] : component === 2 ? [`${index}.rhx`, `${index}.rhy`] : null;
  }
  getIx(key: PKey): any {
    if (typeof key === 'number') return SHAPE_IX[key] ? this.val(SHAPE_IX[key]) : super.getIx(key);
    const [i, f] = key.split('.'); return this.points[Number(i)]?.[FIELD[f]];
  }
  setIx(key: PKey, v: any) {
    if (typeof key === 'number') { if (SHAPE_IX[key]) this.set(SHAPE_IX[key], v); else super.setIx(key, v); return; }
    const [i, f] = key.split('.'); const rec = this.points[Number(i)]; if (rec && f in FIELD) rec[FIELD[f]] = v;
  }
  duplicate(): FxShape {
    const c = new FxShape(this.name, this.storage); c.shapeId = this.shapeId; c.points = this.points.map(r => [...r]);
    for (const p of this.params) c.set(p.name, p.value);
    return c;
  }
}
/** Shape correspondence object (C3DFxShapeCorr). Its initialisation was not established (note E, MakeWarperShapePair missing (a)). */
export class FxShapeCorr extends FxNode {
  readonly isFxShapeCorr = true;
  constructor(name: string, readonly shapeId: number) { super(name, 'CorrespondenceVector', []); }
}
export class FxShapeList extends FxNode {
  readonly isFxShapeList = true;
  readonly items: (FxShape | FxShapeCorr)[] = [];
  constructor(name: string) { super(name, 'ShapeList', []); }
  get shapes(): FxShape[] { return this.items.filter((s): s is FxShape => s instanceof FxShape); }
  byId(id: number) { return this.items.find(s => s.shapeId === id) ?? null; }
  addItem(s: FxShape | FxShapeCorr, at = -1) { s.parent = this as any; if (s instanceof FxShape) s.list = this; if (at < 0) this.items.push(s); else this.items.splice(at, 0, s); }
  removeItem(s: FxShape | FxShapeCorr): number { const i = this.items.indexOf(s); if (i >= 0) { this.items.splice(i, 1); s.parent = null; if (s instanceof FxShape) s.list = null; } return i; }
  explorerChildren(): Node[] { return [...this.items]; }
}

// ------------------------------------------------------------------ state
export interface FxClipboard {
  format: string; count: number;
  /** One chunk per operator (chunk id = position in the copy set). */
  ops: { spec: FxOpSpec; name: string; values: Record<string, any>; indexed: [PKey, any][]; rect: number[]; positioned: boolean; paint: boolean }[];
  /** The `_xnc` chunk: handler GUID, then per operator and per input (source position or -1, source output index). */
  cnx: { guid: string; inputs: [number, number][][] };
}
export interface FxTrackingRun { mode: number; ops: FxOp[]; command: string; active: boolean; dispose: (() => void) | null }
export interface FxCoreState {
  lastStatus: { command: string; status: number } | null;
  /** Ambient values read by the shape commands (FXSH_AUTOKEY_PTS). */
  ambient: Record<string, any>;
  clipboard: FxClipboard | null;
  /** Notifications fired by the commands, in order (stand-in for the notification sinks). */
  notifications: { target: string; id: string | number }[];
  /** Files the paint clip writer reported as written (stand-in for the image files). */
  writtenFiles: string[];
  tracking: FxTrackingRun | null;
  nextShapeId: number;
  /** Shape lists made outside an operator through `newShapeList` (stand-in owners). */
  detached: FxShapeList[];
  // helpers for callers and checks (building blocks the commands themselves use)
  newOp(tree: FxTree, spec: FxOpSpec): FxOp;
  newShapeList(name?: string): FxShapeList;
  /** Stand-in for a paint stroke: frame `frame` of the clip gets paint data and is marked modified. */
  paintFrame(clip: FxOp, frame: number): void;
  endTracking(resetSwitch?: boolean): void;
  find(name: string): any;
}
export const stateOf = (app: App): FxCoreState => (app as any).fxCore;

// ------------------------------------------------------------------ small helpers
export const unset = (v: any) => v === undefined || v === null || v === '';
export const text = (v: any) => (unset(v) ? '' : typeof v === 'string' ? v : v instanceof Node ? v.name : String(v));
export function fail(status: number, what: string): SiStatusError { return new SiStatusError(status, what); }
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
export function logNya(app: App, command: string, what: string, where = '') { app.logMsg('info', `${command}: not yet attested: ${what}${where ? ` (${where})` : ''}`); }
export function notify(app: App, target: Node, id: string | number) { stateOf(app).notifications.push({ target: target.name, id }); app.events.emit('params'); }
export const isOp = (v: any): v is FxOp => v instanceof FxOp;
export const isTree = (v: any): v is FxTree => v instanceof FxTree;
export const isShape = (v: any): v is FxShape => v instanceof FxShape;
export const trees = (app: App): FxTree[] => app.scene.root.properties.filter(isTree);

/** Every stand-in FX object reachable from the scene. */
function* walk(app: App): Generator<Node> {
  const lists = (ls: FxShapeList[]) => ls.flatMap(l => [l as Node, ...l.items]);
  for (const t of trees(app)) { yield t; for (const o of t.ops) { yield o; yield* lists(o.shapeLists); } }
  yield* lists(stateOf(app).detached);
}
/** A name -> the FX object: full name, a dotted tail of it ("FxTree.Blur"), or a bare name. */
export function findFx(app: App, name: string): any {
  const n = name.trim(); if (!n) return null;
  let bare: Node | null = null;
  for (const x of walk(app)) { const f = x.fullName; if (f === n || f.endsWith('.' + n)) return x; if (!bare && x.name === n) bare = x; }
  return bare;
}
/** An object argument (object or name). */
export function objArg(app: App, v: any): any { return typeof v === 'string' ? (v.trim() ? findFx(app, v) : null) : v ?? null; }
/** An object list argument. An unset list stands for the selection only where the registry flags say so. */
export function listArg(app: App, v: any, selectionDefault: boolean): any[] {
  if (unset(v)) return selectionDefault ? [...app.selection] : [];
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v];
  return raw.map(x => objArg(app, x)).filter(x => x !== null && x !== undefined);
}
export function uniqueName(taken: Iterable<string>, base: string): string {
  const set = new Set(taken); if (!set.has(base)) return base;
  for (let i = 1; ; i++) if (!set.has(base + i)) return base + i; // inferred: numbering of duplicate names
}

// ------------------------------------------------------------------ sub-tasks (SetValue / SaveKey / DeleteObj)
/** The SetValue sub-task: writes the value of a parameter key, undoably. */
export function setValueTask(app: App, owner: FxNode, key: PKey, value: any) {
  const old = owner.getIx(key);
  app.record('SetValue', () => { owner.setIx(key, value); }, () => { owner.setIx(key, old); });
}
/** The SaveKey sub-task: keys a parameter key at a time, with the given value or the parameter's current value. */
export function saveKeyTask(app: App, owner: FxNode, key: PKey, time: number, value?: any) {
  const ks = owner.keysOf(key); const had = ks.has(time); const old = ks.get(time);
  app.record('SaveKey', () => { ks.set(time, value === undefined ? owner.getIx(key) : value); }, () => { if (had) ks.set(time, old); else ks.delete(time); });
}
/** Auto-key decision of the shape commands: the ambient value FXSH_AUTOKEY_PTS (a true boolean) or the preference animation.autokey. */
export function shapeAutoKey(app: App): boolean { return stateOf(app).ambient.FXSH_AUTOKEY_PTS === true || app.autoKey === true; }

export function addOp(tree: FxTree, op: FxOp, at = -1) { op.tree = tree; op.parent = tree as any; if (at < 0) tree.ops.push(op); else tree.ops.splice(at, 0, op); }
export function makeOp(tree: FxTree, spec: FxOpSpec): FxOp {
  const base = spec.name ?? spec.type.replace(/Op$/, ''); // inferred: default operator names
  return new FxOp(spec, uniqueName(tree.ops.map(o => o.name), base));
}
/** The DeleteObj task on FX operators: removes them from their trees and drops the connections they feed; undoable. */
export function deleteOpsTask(app: App, ops: FxOp[]) {
  const set = new Set(ops);
  const where = ops.filter(o => o.tree).map(o => ({ op: o, tree: o.tree!, at: o.tree!.ops.indexOf(o) })).sort((a, b) => a.at - b.at);
  const fed: { input: FxInput; source: FxOp; out: number }[] = [];
  for (const w of where) for (const o of w.tree.ops) if (!set.has(o)) for (const i of o.inputs) if (i.source && set.has(i.source) && !fed.some(f => f.input === i)) fed.push({ input: i, source: i.source, out: i.sourceOutput });
  app.record('DeleteObj', () => {
    for (const f of fed) { f.input.source = null; f.input.sourceOutput = 0; }
    for (const w of where) { const i = w.tree.ops.indexOf(w.op); if (i >= 0) w.tree.ops.splice(i, 1); w.op.tree = null; w.op.parent = null; }
    app.selection = app.selection.filter(n => !set.has(n as any));
  }, () => {
    for (const w of where) addOp(w.tree, w.op, Math.min(w.at, w.tree.ops.length));
    for (const f of fed) { f.input.source = f.source; f.input.sourceOutput = f.out; }
  });
}

// ------------------------------------------------------------------ fx_cmd::GetConnectionFromName (stand-in)
/** Resolves a connection name or number on an operator. The helper lives in FxCoreHelper.dll and was not opened
 *  (notes E / F / G, open questions), so the rules here are a stand-in:
 *  inferred: a decimal number is a 1-based input number; a name matches an input, else an output, without case;
 *  inferred: an empty string does not resolve. Returns null when nothing matches. */
export function connectionFromName(op: FxOp, name: string): { index: number; isOutput: boolean } | null {
  const n = name.trim(); if (!n) return null;
  if (/^\d+$/.test(n)) { const i = Number(n) - 1; return i >= 0 && i < op.inputs.length ? { index: i, isOutput: false } : null; }
  const i = op.inputs.findIndex(x => x.name.toLowerCase() === n.toLowerCase()); if (i >= 0) return { index: i, isOutput: false };
  const o = op.outputs.findIndex(x => x.toLowerCase() === n.toLowerCase()); return o >= 0 ? { index: o, isOutput: true } : null;
}
export const CNX_NYA = 'the connection name / number rules of FxCoreHelper.dll fx_cmd::GetConnectionFromName (stand-in: 1-based input number or input / output name; an empty string does not resolve)';
/** The internal connect routine: source output of `from` (inferred: its first output; the lookup was not opened) -> input `i` of `to`. */
export function connectRaw(from: FxOp, to: FxOp, i: number): boolean {
  if (!from.outputs.length || !to.inputs[i]) return false;
  to.inputs[i].source = from; to.inputs[i].sourceOutput = 0; return true;
}

// ------------------------------------------------------------------ state construction
export function makeState(app: App): FxCoreState {
  const st: FxCoreState = {
    lastStatus: null, ambient: {}, clipboard: null, notifications: [], writtenFiles: [], tracking: null, nextShapeId: 1, detached: [],
    newOp(tree, spec) { const o = makeOp(tree, spec); addOp(tree, o); return o; },
    newShapeList(name = 'ShapeList') { const l = new FxShapeList(uniqueName(st.detached.map(x => x.name), name)); st.detached.push(l); return l; },
    paintFrame(clip, frame) {
      const p = clip.paint; if (!p) return; const key = Math.trunc(frame); // inferred: frame key = frame number
      const f = p.frames.get(key);
      if (!f) { p.frames.set(key, { modified: true, selected: false, raster: { frame: key } }); p.modifiedCount++; } else if (!f.modified) { f.modified = true; p.modifiedCount++; }
    },
    endTracking(resetSwitch = true) {
      const t = st.tracking; if (!t || !t.active) return;
      if (resetSwitch) for (const o of t.ops) if (o.guidParams.has(GUID_TRACKING_SWITCH)) { o.guidParams.set(GUID_TRACKING_SWITCH, false); notify(app, o, GUID_TRACKING_SWITCH); }
      t.dispose?.(); t.dispose = null; t.active = false;
    },
    find: (name) => findFx(app, name),
  };
  return st;
}
