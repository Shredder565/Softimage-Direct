// Ledger rows CMD-B9a / CMD-B9b / CMD-B9c: the stand-in 2D paint model the xsipaint.dll task commands work on.
// Briefs: docs/ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md (2.4 "Paint object model"),
// docs/ghidra/cmd-b9b-xsipaint-add-shapes-binary.md (2.1, 2.4 to 2.7), docs/ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md (2.2, 2.3).
// Original code written from those prose contracts only; no XSIBATCH golden exists for the rows.
//
// This build has no FX tree / paint clip yet, so the objects below are a small original stand-in that carries exactly
// what the contracts state: a paint engine with three store slots, foreground / background colours and a current brush;
// FxTree operators owning a paint clip and a raster; per-frame element lists; shapes with points (weight, selected bit,
// two handle offsets), shape keys, sub-shapes, strokes and a tag; simple commands (Clear / Invert Stencil).
// Everything the notes leave open is marked `// inferred` here or logged as "not yet attested" by the command.
import type { App } from '../core/commands';
import { SiStatusError } from './alembicSeqCam';

export const NOTE_A = 'docs/ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md';
export const NOTE_B = 'docs/ghidra/cmd-b9b-xsipaint-add-shapes-binary.md';
export const NOTE_C = 'docs/ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md';
export const S_OK = 0, S_FALSE = 1, S_NOTHING = 0x562e8005;
export const E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, E_UNEXPECTED = 0x8000ffff, E_OUTOFMEMORY = 0x8007000e, E_FILENOTFOUND = 0x80030002;
export const MSG_SHAPE = 'Argument 1 must be a 2D paint shape';
export const MSG_LIST = 'Argument 1 must be a paint shape list';
export const MSG_FXOP = 'Argument 1 must be an fxtree operator';

export type RGBA = [number, number, number, number];
export interface Rect { x0: number; y0: number; x1: number; y1: number } // inclusive pixel limits
export interface PaintPoint { x: number; y: number; lhx: number; lhy: number; rhx: number; rhy: number; weight: number; selected: boolean; color?: RGBA; type?: number }
export type ShapeClass = 'ColorShape' | 'SelShape' | 'MagicWand' | 'FloodFill' | 'StrokeShape' | 'WipeShape' | 'AlphaFloodFill' | 'BoundaryFill';
export const f32 = Math.fround;
const clonePt = (p: PaintPoint): PaintPoint => ({ ...p, color: p.color ? [...p.color] as RGBA : undefined });

/** FxPaintShapeKey: a child of a shape with a `Time` parameter and the point set of that key. */
export class PaintShapeKey { readonly kind = 'FxPaintShapeKey'; constructor(public Time: number, public points: PaintPoint[]) {} }

/** Any object answering the 2D paint shape interface. */
export class PaintShape {
  readonly kind = 'paintshape';
  curveType = 0;                 // 0 bezier with handles (ellipse), 2 straight segments (rectangle)
  closed = false;
  points: PaintPoint[] = [];     // per-point record (weight, selected bit) + the current point set
  keys: PaintShapeKey[] = [];
  subShapes: number[] = [];      // sub-shape start indices
  strokes: { start: number; count: number; pressures: number[] }[] = [];
  tag = -1;                      // the integer tag of note B 2.4 (meaning open)
  brushId = 0; color1: RGBA | null = null; color2: RGBA | null = null; settings: ToolSettings | null = null; // stroke shapes
  mask: { SelectionAction: number; AntiAliased: boolean; Feather: number } | null = null;                 // mask-shape properties
  shapeType: { kind: number; flag: boolean } | null = null;                                               // "set type" pair of the Matador import
  list: PaintShapeList | null = null;
  changes = 0;                   // change notifications
  constructor(public name: string, readonly cls: ShapeClass) {}
  /** "Belongs to the stencil / selection": shape category 2, set by the selection shape and the magic wand fill. */
  get stencil() { return this.cls === 'SelShape' || this.cls === 'MagicWand'; }
  notify() { this.changes++; }
}
/** FxPaintSimpleCommandObj: Command 0 = Clear Stencil, 1 = Invert Stencil. Always a stencil element. */
export class PaintSimpleCommand {
  readonly kind = 'simplecommand'; readonly stencil = true; list: PaintShapeList | null = null;
  constructor(public name: string, public Command: number) {}
}
export type PaintItem = PaintShape | PaintSimpleCommand;

/** FxPaintShapeList (ListType 0 Paint Shapes, 1 Mask Shapes, 2 Paint Selection). */
export class PaintShapeList {
  readonly kind = 'shapelist'; items: PaintItem[] = []; InvertShapes = false;
  constructor(public name: string, public ListType = 0) {}
  kind7() { return this.ListType; } // inferred: both kind queries (list slots 7 and 8) answer the ListType (note B open question 5)
  kind8() { return this.ListType; } // inferred, as above
  itemsAt(_time: number): PaintItem[] { return [...this.items]; } // inferred: a list of this stand-in holds one frame, so every item is "at the time"
  itemAt(_time: number): PaintItem | null { return this.items[this.items.length - 1] ?? null; } // inferred: the "item at this time" is the last item
  append(item: PaintItem) { item.list = this; this.items.push(item); }
}
/** Paint clip: element lists per frame. */
export class PaintClip {
  readonly kind = 'paintclip'; frames = new Map<number, PaintShapeList>();
  constructor(public name: string, private make: (name: string) => PaintShapeList) {}
  /** The element list of the frame at a time. inferred: frames are whole numbers and a frame's list exists on demand. */
  listAt(time: number): PaintShapeList { const f = Math.round(time); let l = this.frames.get(f); if (!l) { l = this.make(`${this.name}_frame${f}`); this.frames.set(f, l); } return l; }
}
export class PaintRaster {
  data: Float32Array; title = '';
  constructor(readonly width: number, readonly height: number) { this.data = new Float32Array(width * height * 4); }
  get limits(): Rect { return { x0: 0, y0: 0, x1: this.width - 1, y1: this.height - 1 }; }
  get(x: number, y: number): RGBA { const i = (y * this.width + x) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]; }
  set(x: number, y: number, c: RGBA) { this.data.set(c, (y * this.width + x) * 4); }
  clip(r: Rect): Rect | null { const c = { x0: Math.max(0, r.x0), y0: Math.max(0, r.y0), x1: Math.min(this.width - 1, r.x1), y1: Math.min(this.height - 1, r.y1) }; return c.x0 > c.x1 || c.y0 > c.y1 ? null : c; }
  /** Copy of a part ("ufoRasterAllocCopyPart"). */
  copyPart(r: Rect): RasterPart { const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1; const d = new Float32Array(w * h * 4); for (let y = 0; y < h; y++) d.set(this.data.subarray(((r.y0 + y) * this.width + r.x0) * 4, ((r.y0 + y) * this.width + r.x1 + 1) * 4), y * w * 4); return { rect: r, data: d, title: '', storage: d.byteLength <= 0x40000 ? 'memory' : 'file' }; }
  /** Copy a saved part back at its own limits. */
  restore(p: RasterPart) { const w = p.rect.x1 - p.rect.x0 + 1, h = p.rect.y1 - p.rect.y0 + 1; for (let y = 0; y < h; y++) this.data.set(p.data.subarray(y * w * 4, (y + 1) * w * 4), ((p.rect.y0 + y) * this.width + p.rect.x0) * 4); }
}
/** An undo raster copy; `storage` records where the contract keeps it (in memory up to 0x40000 bytes, else a temporary file). */
export interface RasterPart { rect: Rect; data: Float32Array; title: string; storage: 'memory' | 'file' }
/** An object answering the fxtree operator interface: owns a paint clip and a raster, and is told which rectangle changed. */
export class FxOperator {
  readonly kind = 'fxop'; damage: Rect[] = [];
  constructor(public name: string, public clip: PaintClip | null, public raster: PaintRaster | null) {}
  notifyRect(r: Rect) { this.damage.push({ ...r }); }
}
/** The fields of the paint tool settings block the commands compare (offsets 0x28 / 0x30, 0x24, 0x48, 0x49); meanings open. */
export interface ToolSettings { strokeSetting: [number, number]; drawSetting: number; flag48: boolean; flag49: boolean }

export interface XsiPaintState {
  lastStatus: { command: string; status: number } | null;
  /** Store slots: 0 paint store, 1 merge store, 2 mask store. */
  stores: (FxOperator | null)[];
  foreground: RGBA; background: RGBA;
  /** Brush name -> { id, radius } (the Matador brush table; a stand-in). */
  brushes: Map<string, { id: number; radius: number }>;
  currentBrush: number;
  toolSettings: ToolSettings;
  /** Notification strings sent (`WSZ_FXPAINT_COLOR_CH`). */
  notifications: string[];
  objects: Map<string, any>;
  uniqueName(base: string): string;
  setName(o: { name: string }, base: string): void;
  createOperator(name?: string, width?: number, height?: number, withClip?: boolean): FxOperator;
  createShapeList(listType?: number, name?: string): PaintShapeList;
  createShape(cls?: ShapeClass, name?: string): PaintShape;
  createSimpleCommand(command: number, name?: string): PaintSimpleCommand;
  addShapeKey(shape: PaintShape, time: number): PaintShapeKey;
}
export const stateOf = (app: App): XsiPaintState => (app as any).xsiPaint;

export function makeState(): XsiPaintState {
  const st: XsiPaintState = {
    lastStatus: null, stores: [null, null, null],
    foreground: [1, 1, 1, 1], background: [0, 0, 0, 0], // inferred: the session starts with the ResetPaintColor values
    brushes: new Map([['Default', { id: 1, radius: 2 }]]), currentBrush: 1, // inferred: stand-in brush table (Matador brush names are not in the notes)
    toolSettings: { strokeSetting: [0, 0], drawSetting: 0, flag48: false, flag49: false },
    notifications: [], objects: new Map(),
    uniqueName(base) { if (!st.objects.has(base)) return base; let i = 1; while (st.objects.has(base + i)) i++; return base + i; },
    setName(o, base) { if (st.objects.get(o.name) === o) st.objects.delete(o.name); o.name = st.uniqueName(base); st.objects.set(o.name, o); },
    createOperator(name = 'PaintClip', width = 64, height = 64, withClip = true) {
      const n = st.uniqueName(name); const op = new FxOperator(n, withClip ? new PaintClip(n + '_clip', nm => st.createShapeList(0, nm)) : null, new PaintRaster(width, height));
      st.objects.set(n, op); return op;
    },
    createShapeList(listType = 0, name = 'PaintShapes') { const l = new PaintShapeList(st.uniqueName(name), listType); st.objects.set(l.name, l); return l; },
    createShape(cls = 'ColorShape', name = cls) { const s = new PaintShape(st.uniqueName(name), cls); st.objects.set(s.name, s); return s; },
    createSimpleCommand(command, name = 'SimpleCommand') { const c = new PaintSimpleCommand(st.uniqueName(name), command); st.objects.set(c.name, c); return c; },
    addShapeKey(shape, time) { const k = new PaintShapeKey(time, shape.points.map(clonePt)); shape.keys.push(k); return k; },
  };
  return st;
}

// ------------------------------------------------------------------ command plumbing
export const unset = (v: any) => v === undefined || v === null || v === '';
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
export function logNya(app: App, command: string, what: string, where = '') { app.logMsg('info', `${command}: not yet attested: ${what}${where ? ` (${where})` : ''}`); }
/** A scalar argument as a number; NaN when it "cannot be fetched". */
export const num = (v: any): number => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
export const bool = (v: any): boolean => v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && /^(true|-?[1-9]\d*)$/i.test(v.trim()));
const resolve = (app: App, v: any) => (typeof v === 'string' ? stateOf(app).objects.get(v.trim()) : v);
export const asShape = (app: App, v: any): PaintShape | null => { const o = resolve(app, v); return o instanceof PaintShape ? o : null; };
export const asList = (app: App, v: any): PaintShapeList | null => { const o = resolve(app, v); return o instanceof PaintShapeList ? o : null; };
export const asFxOp = (app: App, v: any): FxOperator | null => { const o = resolve(app, v); return o instanceof FxOperator ? o : null; };
// inferred: an omitted Shape / ShapeList / FxOp argument is "not of the required kind" (the object argument handler is outside the DLL, note A open question 8)
export function needShape(app: App, v: any, message = MSG_SHAPE): PaintShape { const s = asShape(app, v); if (!s) throw fail(E_INVALIDARG, message); return s; }
/** An array-like argument (script array or typed array) as a plain array, else null. */
export const arrayOf = (v: any): any[] | null => (Array.isArray(v) ? v : ArrayBuffer.isView(v) && !(v instanceof DataView) ? Array.from(v as any) : null);
export const currentTime = (app: App): number => app.anim.frame;
/** A task: `run(true)` now, `undo` on Undo, `redo` (default `run(false)`) on Redo. */
export function task(app: App, label: string, run: (first: boolean) => void, undo: () => void, redo?: () => void) {
  let first = true;
  app.record(label, () => { if (first) { first = false; run(true); } else if (redo) redo(); else run(false); }, undo);
}
/** The element list of the current paint frame: store slot 0 -> its paint clip -> the frame at the current scene time. */
export function currentList(app: App): PaintShapeList | null { return stateOf(app).stores[0]?.clip?.listAt(currentTime(app)) ?? null; }

// ------------------------------------------------------------------ DeleteObj on paint elements
export interface Deleted { undo(): void; redo(): void }
/** The DeleteObj task object run on a list of paint elements (flags 0x10): each is taken out of its list. Items in no list are skipped. */
export function deleteItems(app: App, items: (PaintItem | null | undefined)[]): Deleted {
  const st = stateOf(app); const rec: { item: PaintItem; list: PaintShapeList; index: number }[] = [];
  const redo = () => {
    rec.length = 0;
    for (const item of items) { const list = item?.list; if (!item || !list) continue; const index = list.items.indexOf(item); if (index < 0) continue; rec.push({ item, list, index }); list.items.splice(index, 1); item.list = null; if (st.objects.get(item.name) === item) st.objects.delete(item.name); }
  };
  const undo = () => { for (const r of [...rec].reverse()) { r.list.items.splice(Math.min(r.index, r.list.items.length), 0, r.item); r.item.list = r.list; if (!st.objects.has(r.item.name)) st.objects.set(r.item.name, r.item); } rec.length = 0; };
  redo();
  return { undo, redo };
}
/** SIDuplicate of a paint element. */
function duplicateItem(app: App, item: PaintItem): PaintItem {
  const st = stateOf(app);
  if (item instanceof PaintSimpleCommand) return st.createSimpleCommand(item.Command, item.name);
  const d = st.createShape(item.cls, item.name);
  Object.assign(d, { curveType: item.curveType, closed: item.closed, tag: item.tag, brushId: item.brushId, points: item.points.map(clonePt), subShapes: [...item.subShapes],
    strokes: item.strokes.map(s => ({ ...s, pressures: [...s.pressures] })), keys: item.keys.map(k => new PaintShapeKey(k.Time, k.points.map(clonePt))),
    color1: item.color1 && [...item.color1], color2: item.color2 && [...item.color2], settings: item.settings && { ...item.settings, strokeSetting: [...item.settings.strokeSetting] }, mask: item.mask && { ...item.mask } });
  return d;
}

// ------------------------------------------------------------------ note B 2.4: preparing a list before a shape is appended
export interface Prepared { tag: number; clearCmd: PaintSimpleCommand | null; dups: PaintItem[] }
const tagOf = (it: PaintItem | null): number => (it instanceof PaintShape ? it.tag : -1); // inferred: an element that is not a shape carries no tag (-1)
export function prepareList(app: App, list: PaintShapeList, time: number): Prepared {
  const st = stateOf(app); const out: Prepared = { tag: -1, clearCmd: null, dups: [] };
  const items = list.itemsAt(time); const last = items[items.length - 1] ?? null;
  if (list.kind8() === 0 && items.length >= 1 && !(last instanceof PaintSimpleCommand && last.Command === 0)) {
    // case A: an automatic Clear Stencil entry, tag -1
    const c = st.createSimpleCommand(0, 'ClearStencil'); // inferred: the object's name (the note states only the command value)
    list.append(c); out.clearCmd = c; return out;
  }
  // case B: duplicate every item after the last one carrying the reference item's tag
  const ref = list.itemAt(time); const refTag = tagOf(ref);
  let match = -1;
  if (ref) for (let i = items.length - 1; i >= 0; i--) if (tagOf(items[i]) === refTag) { match = i; break; }
  for (const it of items.slice(match + 1)) { const d = duplicateItem(app, it); list.append(d); out.dups.push(d); }
  out.tag = tagOf(list.items[list.items.length - 1] ?? null);
  return out;
}

// ------------------------------------------------------------------ shape methods
const newPoint = (x: number, y: number, lhx = 0, lhy = 0, rhx = 0, rhy = 0): PaintPoint => ({ x: f32(x), y: f32(y), lhx: f32(lhx), lhy: f32(lhy), rhx: f32(rhx), rhy: f32(rhy), weight: 1, selected: false }); // inferred: a new point has weight 1 and is not selected
export const selectedIndices = (s: PaintShape): number[] => s.points.flatMap((p, i) => (p.selected ? [i] : []));
/** "Set point selection": mode 0 replace, 1 toggle, 2 add. inferred: indices outside the shape are ignored. */
export function setSelection(s: PaintShape, indices: number[], mode: 0 | 1 | 2) {
  if (mode === 0) for (const p of s.points) p.selected = false;
  for (const i of indices) { const p = s.points[i]; if (p) p.selected = mode === 1 ? !p.selected : true; }
  s.notify();
}
/** The insert-points method with one point (note A, AddPaintShapePoint). Returns the effective index. */
export function insertPoint(s: PaintShape, at: number, x: number, y: number, lhx = 0, lhy = 0, rhx = 0, rhy = 0): number {
  const n = s.points.length; const append = at < 0 || at > n; const index = append ? n : at;
  const p = newPoint(x, y, lhx, lhy, rhx, rhy);
  // With shape keys the point goes into every key at the same index; the record array always gets the new entry
  // (this stand-in keeps the record and the current point set in one array, so it is inserted there in both cases).
  for (const k of s.keys) k.points.splice(Math.min(index, k.points.length), 0, clonePt(p));
  s.points.splice(index, 0, p);
  if (n === 0 && !s.subShapes.length) s.subShapes.push(0);
  else if (!append) s.subShapes = s.subShapes.map(start => (start >= index ? start + 1 : start));
  if (!append) for (const k of s.strokes) { if (k.start >= index) k.start++; else if (index < k.start + k.count) k.count++; } // inferred: strokes follow the same shift
  s.notify();
  return index;
}
/** Everything a point deletion needs to be undone (the "undo blob"). */
export interface PointBlob { points: PaintPoint[]; keys: PaintPoint[][]; subShapes: number[]; strokes: PaintShape['strokes'] }
const snapshot = (s: PaintShape): PointBlob => ({ points: s.points.map(clonePt), keys: s.keys.map(k => k.points.map(clonePt)), subShapes: [...s.subShapes], strokes: s.strokes.map(k => ({ ...k, pressures: [...k.pressures] })) });
/** Delete points; returns the undo blob. inferred: indices outside the shape are ignored; sub-shape and stroke ranges shrink around the removed points. */
export function deletePoints(s: PaintShape, indices: number[]): PointBlob {
  const blob = snapshot(s); const gone = new Set(indices.filter(i => i >= 0 && i < s.points.length));
  const before = (i: number) => { let c = 0; for (const g of gone) if (g < i) c++; return c; };
  s.subShapes = [...new Set(s.subShapes.map(start => start - before(start)))];
  s.strokes = s.strokes.map(k => { const inside = [...gone].filter(g => g >= k.start && g < k.start + k.count); return { start: k.start - before(k.start), count: k.count - inside.length, pressures: k.pressures.length === k.count ? k.pressures.filter((_, j) => !gone.has(k.start + j)) : k.pressures }; }).filter(k => k.count > 0);
  s.points = s.points.filter((_, i) => !gone.has(i));
  for (const k of s.keys) k.points = k.points.filter((_, i) => !gone.has(i));
  s.notify();
  return blob;
}
export function restorePoints(s: PaintShape, b: PointBlob) {
  s.points = b.points.map(clonePt); s.keys.forEach((k, i) => { if (b.keys[i]) k.points = b.keys[i].map(clonePt); });
  s.subShapes = [...b.subShapes]; s.strokes = b.strokes.map(k => ({ ...k, pressures: [...k.pressures] })); s.notify();
}
/** "Set rectangle" (shape slot 12): four straight points, curve type 2, closed. */
export function setRectangle(s: PaintShape, X1: number, Y1: number, X2: number, Y2: number, fromCenter: boolean) {
  let xa = X1, ya = Y1; const xb = X2, yb = Y2;
  if (fromCenter) { xa = X1 - (X2 - X1); ya = Y1 - (Y2 - Y1); } // (X1, Y1) is the centre, (X2, Y2) one corner
  s.curveType = 2; s.points = [newPoint(xa, ya), newPoint(xb, ya), newPoint(xb, yb), newPoint(xa, yb)]; s.closed = true; s.notify();
}
export const ELLIPSE_K = 0.551915;
/** "Set ellipse" (shape slot 13): four bezier points with handle offsets of k times the radius, curve type 0, closed. */
export function setEllipse(s: PaintShape, X1: number, Y1: number, X2: number, Y2: number, fromCenter: boolean) {
  const cx = fromCenter ? X1 : (X1 + X2) / 2, cy = fromCenter ? Y1 : (Y1 + Y2) / 2;
  const rx = Math.abs(X2 - cx), ry = Math.abs(Y2 - cy), k = ELLIPSE_K;
  s.curveType = 0;
  s.points = [newPoint(cx, cy - ry, -k * rx, 0, k * rx, 0), newPoint(cx + rx, cy, 0, -k * ry, 0, k * ry), newPoint(cx, cy + ry, k * rx, 0, -k * rx, 0), newPoint(cx - rx, cy, 0, k * ry, 0, -k * ry)];
  s.closed = true; s.notify();
}
/** Append one sub-stroke (shape slot 54) and set its pressures (slot 55); returns the sub-stroke index. */
export function appendStroke(s: PaintShape, xy: number[], pressures: number[]): number {
  const start = s.points.length; const count = xy.length / 2;
  for (let i = 0; i < count; i++) { const p = newPoint(xy[2 * i], xy[2 * i + 1]); s.points.push(p); for (const k of s.keys) k.points.push(clonePt(p)); }
  s.strokes.push({ start, count, pressures: [...pressures] }); s.notify();
  return s.strokes.length - 1;
}

// ------------------------------------------------------------------ raster stand-ins (the Softimage renderers were not read)
/** The outline of a shape as a polygon: straight segments, or flattened bezier spans built from the handle offsets. */
export function outline(s: PaintShape, steps = 16): [number, number][] {
  const P = s.points; if (s.curveType !== 0) return P.map(p => [p.x, p.y]);
  const out: [number, number][] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length]; if (i === P.length - 1 && !s.closed) { out.push([a.x, a.y]); break; }
    const c1 = [a.x + a.rhx, a.y + a.rhy], c2 = [b.x + b.lhx, b.y + b.lhy];
    for (let j = 0; j < steps; j++) { const t = j / steps, u = 1 - t; out.push([u * u * u * a.x + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b.x, u * u * u * a.y + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b.y]); }
  }
  return out;
}
export interface Painted { rect: Rect | null; saved: RasterPart | null }
/** Write `color` to every pixel accepted by `inside` within `bounds`, capturing the overwritten part. */
export function paintPixels(r: PaintRaster, bounds: Rect, inside: (x: number, y: number) => boolean, color: RGBA, capture: boolean): Painted {
  const b = r.clip(bounds); if (!b) return { rect: null, saved: null };
  const hit: [number, number][] = []; let rect: Rect | null = null;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (inside(x, y)) { hit.push([x, y]); rect = rect ? { x0: Math.min(rect.x0, x), y0: Math.min(rect.y0, y), x1: Math.max(rect.x1, x), y1: Math.max(rect.y1, y) } : { x0: x, y0: y, x1: x, y1: y }; }
  if (!rect) return { rect: null, saved: null };
  const saved = capture ? r.copyPart(rect) : null;
  for (const [x, y] of hit) r.set(x, y, color);
  return { rect, saved };
}
/** Fill a polygon (even-odd rule, pixel centres). */
export function fillPolygon(r: PaintRaster, poly: [number, number][], color: RGBA, capture: boolean): Painted {
  if (poly.length < 3) return { rect: null, saved: null };
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const inside = (px: number, py: number) => { const x = px + 0.5, y = py + 0.5; let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  return paintPixels(r, { x0: Math.floor(Math.min(...xs)), y0: Math.floor(Math.min(...ys)), x1: Math.ceil(Math.max(...xs)), y1: Math.ceil(Math.max(...ys)) }, inside, color, capture);
}

// ------------------------------------------------------------------ shared workers
/** The ClearPaintSelection worker (also run as a nested task by the mask commands). Throws 0x80004005 without a paint frame. */
export function clearSelectionWorker(app: App): { status: number; deleted: Deleted | null } {
  const list = currentList(app); if (!list) throw fail(E_FAIL, 'ClearPaintSelection: no current paint frame');
  const stencil = list.items.filter(it => it.stencil);
  if (!stencil.length) return { status: S_NOTHING, deleted: null };
  return { status: S_OK, deleted: deleteItems(app, stencil) };
}

/** The four numbers and the flag of the raster / mask rectangle commands; a value that cannot be fetched is 0x80070057. */
export function rectArgs(C: string, a: Record<string, any>): [number, number, number, number, boolean] {
  const v = [a.X1, a.Y1, a.X2, a.Y2].map(num); if (v.some(Number.isNaN)) throw fail(E_INVALIDARG, `${C}: invalid argument`);
  return [f32(v[0]), f32(v[1]), f32(v[2]), f32(v[3]), bool(a.FromCenter)];
}
