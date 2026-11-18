// Ledger row CMD-B9c. Brief: docs/ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md, sections 2 "Shared facts" and
// 3 "Contracts". Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   paint masks      RectangularPaintMask EllipticalPaintMask MagicWandPaintMask AddPaintMaskShape
//   point selection  SelectPaintShapePoint AddToPaintShapePointSelection TogglePaintShapePointSelection
//   points           InsertPaintShapePoint                          (shape method unread: stand-in, logged)
//   colours / brush  SetPaintColor ResetPaintColor SwapPaintColors SetPaintBrush
//   raster           PaintRasterLine FloodFillRaster                (Matador stroke / fill renderer unread: stand-ins, logged)
//   import           ImportMatadorShapeList                         (file read from the session's virtual host file system)
//
// Mapping notes (see xsiPaintTasks.ts for the shared ones):
//  * The "current mask shape list" lookup is the element list of the current paint frame (store slot 0 -> clip -> frame).
//  * The paint colour holder and the current brush live on `app.xsiPaint`; every colour change pushes
//    `WSZ_FXPAINT_COLOR_CH` to `app.xsiPaint.notifications`.
import { App, CommandDef } from '../core/commands';
import { hostFs } from '../core/sdkHelpersHostFs';
import * as M from './xsiPaintTasksModel';

const { S_OK, S_FALSE, E_FAIL, E_INVALIDARG, E_FILENOTFOUND, fail, setStatus, logNya, stateOf, task } = M;
const COLOR_CH = 'WSZ_FXPAINT_COLOR_CH';

/** scanf-style reader over the text of a Matador shape list file. */
class Scan {
  i = 0;
  constructor(readonly s: string) {}
  private token(re: RegExp): number | null { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; const m = re.exec(this.s.slice(this.i, this.i + 64)); if (!m) return null; this.i += m[0].length; return Number(m[0]); }
  int() { return this.token(/^[+-]?\d+/); }
  float() { return this.token(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/); }
  /** The rest of the current line (at most `max` characters), consuming the line end. */
  line(max = 200): string { let e = this.s.indexOf('\n', this.i); if (e < 0) e = this.s.length; const t = this.s.slice(this.i, Math.min(e, this.i + max)); this.i = Math.min(this.s.length, e + 1); return t.replace(/\r$/, ''); }
}
const MATADOR_MAGIC = 2302941;

export function registerXsiPaintMaskCommands(app: App) {
  const st = stateOf(app); const reg = (def: CommandDef) => app.register(def);

  // ---------------------------------------------------------------- paint masks
  type Variant = 'rect' | 'ellipse' | 'wand' | 'lasso';
  const tail = (anti: boolean) => [{ name: 'SelectionAction', default: 0 }, { name: 'AntiAliased', default: anti }, { name: 'Feather', default: 0 }];
  const maskCommand = (name: string, label: string, variant: Variant, fromCenter: boolean, anti: boolean) => reg({
    name, label, category: 'Paint', description: 'Creates one mask (selection) shape in the current paint frame and returns it.',
    args: variant === 'rect' || variant === 'ellipse' ? [{ name: 'X1', default: 0 }, { name: 'Y1', default: 0 }, { name: 'X2', default: 0 }, { name: 'Y2', default: 0 }, { name: 'FromCenter', default: fromCenter }, ...tail(anti)]
      : variant === 'wand' ? [{ name: 'SeedX', default: 0 }, { name: 'SeedY', default: 0 }, ...tail(anti)] : tail(anti),
    execute(app, a) {
      const bad = () => fail(E_INVALIDARG, `${name}: invalid argument`);
      let g: [number, number, number, number, boolean] = [0, 0, 0, 0, false];
      if (variant === 'rect' || variant === 'ellipse') g = M.rectArgs(name, a);
      else if (variant === 'wand') { const sx = M.num(a.SeedX), sy = M.num(a.SeedY); if (Number.isNaN(sx) || Number.isNaN(sy)) throw bad(); g = [M.f32(sx), M.f32(sy), 0, 0, false]; }
      const rawAction = M.num(a.SelectionAction), feather = M.num(a.Feather); if (Number.isNaN(rawAction) || Number.isNaN(feather)) throw bad();
      const action = (Math.trunc(rawAction) >>> 0) > 3 ? 0 : Math.trunc(rawAction); // unsigned compare: negatives become 0 too
      const antiAliased = M.bool(a.AntiAliased);
      let ref: M.PaintShape | null = null; let sub: M.Deleted | null = null;
      // Redo runs the worker again as a first run: a new shape, referenced again, and the selection cleared again.
      const run = () => {
        sub = null;
        if (action === 0) { const r = M.clearSelectionWorker(app); if (r.status === S_OK) sub = r.deleted; } // attached as a sub-task only on exactly S_OK; a failure aborts
        const s = st.createShape(variant === 'wand' ? 'MagicWand' : 'SelShape');
        const list = M.currentList(app); if (!list) throw fail(E_FAIL, `${name}: no current mask shape list`);
        list.append(s); ref = s;
        if (variant === 'rect') { M.setRectangle(s, g[0], g[1], g[2], g[3], g[4]); st.setName(s, 'RectSelect'); }
        else if (variant === 'ellipse') { M.setEllipse(s, g[0], g[1], g[2], g[3], g[4]); st.setName(s, 'EllipseSelect'); }
        else if (variant === 'wand') { M.insertPoint(s, -1, g[0], g[1]); st.setName(s, 'MagicWand'); }
        else st.setName(s, 'Lasso'); // no geometry: an empty shape to be filled by the point commands
        s.mask = { SelectionAction: action, AntiAliased: antiAliased, Feather: Math.trunc(feather) };
      };
      task(app, label, run, () => { M.deleteItems(app, [ref]); sub?.undo(); sub = null; }, run);
      setStatus(app, name, S_OK);
      return ref;
    },
  });
  maskCommand('RectangularPaintMask', 'Rectangular Paint Mask', 'rect', false, false);
  maskCommand('EllipticalPaintMask', 'Elliptical Paint Mask', 'ellipse', true, true);
  maskCommand('MagicWandPaintMask', 'Magic Wand Paint Mask', 'wand', false, true);
  maskCommand('AddPaintMaskShape', 'Add Paint Mask Shape', 'lasso', false, true);

  // ---------------------------------------------------------------- point selection
  const selectCommand = (name: string, label: string, mode: 0 | 1 | 2) => reg({
    name, label, category: 'Paint', description: 'Changes which points of a 2D paint shape are selected.',
    args: [{ name: 'Shape', default: null }, { name: 'Indices', default: null }],
    execute(app, a) {
      const shape = M.needShape(app, a.Shape);
      const arr = M.arrayOf(a.Indices); // not an array: the index list stays empty and the command still succeeds
      const indices = (arr ?? []).map(v => Math.trunc(M.num(v))); if (indices.some(Number.isNaN)) throw fail(E_INVALIDARG, `${name}: invalid argument`);
      let snap: number[] = [];
      task(app, label, first => { if (first) snap = M.selectedIndices(shape); M.setSelection(shape, indices, mode); }, () => M.setSelection(shape, snap, 0));
      setStatus(app, name, S_OK);
    },
  });
  selectCommand('SelectPaintShapePoint', 'Select Paint Shape Point', 0);
  selectCommand('TogglePaintShapePointSelection', 'Toggle Paint Shape Point Selection', 1);
  selectCommand('AddToPaintShapePointSelection', 'Add To Paint Shape Point Selection', 2);

  // ---------------------------------------------------------------- InsertPaintShapePoint
  reg({
    name: 'InsertPaintShapePoint', label: 'Insert Paint Shape Point', category: 'Paint', description: 'Inserts one point into a contour of a 2D paint shape and returns its index.',
    args: [{ name: 'Shape', default: null }, { name: 'InsertPosition', default: 0 }, { name: 'Contour', default: 0 }],
    execute(app, a) {
      const C = 'InsertPaintShapePoint'; const shape = M.needShape(app, a.Shape);
      const pos = M.num(a.InsertPosition), contour = M.num(a.Contour); if (Number.isNaN(pos) || Number.isNaN(contour)) throw fail(E_INVALIDARG, M.MSG_SHAPE);
      let record: M.PointBlob | null = null; let value = -1;
      // inferred: stand-in for the shape's "insert point" method (not read). InsertPosition is parametric along the contour:
      // integer part = segment, fraction = position inside it; the new point is placed on the straight line between the
      // segment's two points and gets no handles; a contour or segment that does not exist inserts nothing and returns -1.
      const insert = (): number => {
        record = null;
        const starts = shape.subShapes.length ? shape.subShapes : [0]; const c = Math.trunc(contour);
        if (c < 0 || c >= starts.length) return -1;
        const start = starts[c], end = c + 1 < starts.length ? starts[c + 1] : shape.points.length, n = end - start;
        const seg = Math.floor(pos), t = pos - seg; const spans = shape.closed ? n : n - 1;
        if (n < 1 || seg < 0 || seg >= Math.max(spans, 0)) return -1;
        const p = shape.points[start + seg], q = shape.points[start + ((seg + 1) % n)];
        const blob: M.PointBlob = { points: shape.points.map(x => ({ ...x })), keys: shape.keys.map(k => k.points.map(x => ({ ...x }))), subShapes: [...shape.subShapes], strokes: shape.strokes.map(k => ({ ...k, pressures: [...k.pressures] })) };
        const at = start + seg + 1; const appended = at >= shape.points.length;
        const index = M.insertPoint(shape, appended ? -1 : at, p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
        record = blob;
        return index;
      };
      task(app, 'Insert Paint Shape Point', first => {
        const i = insert(); // any undo record of an earlier run is discarded
        if (first) { value = i; logNya(app, C, 'the shape\'s "insert point" method and the unit of InsertPosition; the stand-in reads it as segment + fraction and interpolates linearly', `${M.NOTE_C} open question 5`); }
      }, () => { if (record) M.restorePoints(shape, record); }); // "undo insert" only when an undo record exists
      setStatus(app, C, S_OK);
      return value;
    },
  });

  // ---------------------------------------------------------------- paint colours
  const changed = () => { st.notifications.push(COLOR_CH); };
  const colorCommand = (name: string, label: string, mode: 0 | 1 | 2) => reg({
    name, label, category: 'Paint', description: mode === 0 ? 'Sets the foreground paint colour.' : mode === 1 ? 'Resets the paint colours (white opaque foreground, black transparent background).' : 'Exchanges the foreground and background paint colours.',
    args: mode === 0 ? [{ name: 'Red', default: 0 }, { name: 'Green', default: 0 }, { name: 'Blue', default: 0 }, { name: 'Alpha', default: 0 }] : [],
    execute(app, a) {
      let fg: M.RGBA = [0, 0, 0, 0], bg: M.RGBA = [0, 0, 0, 0];
      if (mode === 0) {
        const c = [a.Red, a.Green, a.Blue, a.Alpha].map(v => M.f32(M.num(v))) as M.RGBA; if (c.some(Number.isNaN)) throw fail(E_INVALIDARG, `${name}: invalid argument`); // inferred: an unreadable colour component fails like the other scalar reads
        task(app, label, first => { if (first) fg = [...st.foreground]; st.foreground = [...c]; changed(); }, () => { st.foreground = [...fg]; changed(); }); // no clamping; the background is untouched
      } else if (mode === 1) {
        task(app, label, first => { if (first) { fg = [...st.foreground]; bg = [...st.background]; } st.foreground = [1, 1, 1, 1]; st.background = [0, 0, 0, 0]; changed(); },
          () => { st.foreground = [...fg]; st.background = [...bg]; changed(); }); // inferred: Undo restores both saved colours
      } else {
        const swap = () => { [st.foreground, st.background] = [st.background, st.foreground]; changed(); };
        task(app, label, swap, swap);
      }
      setStatus(app, name, S_OK);
    },
  });
  colorCommand('SetPaintColor', 'Set Paint Color', 0);
  colorCommand('ResetPaintColor', 'Reset Paint Color', 1);
  colorCommand('SwapPaintColors', 'Swap Paint Colors', 2);

  // ---------------------------------------------------------------- SetPaintBrush
  reg({
    name: 'SetPaintBrush', label: 'Set Paint Brush', category: 'Paint', description: 'Makes the named brush the current paint brush.',
    args: [{ name: 'Brush', default: '' }],
    execute(app, a) {
      const C = 'SetPaintBrush'; const brush = M.unset(a.Brush) ? '' : String(a.Brush);
      let saved = 0;
      task(app, 'Set Paint Brush', first => {
        if (first) saved = st.currentBrush;
        const id = st.brushes.get(brush)?.id ?? 0;
        if (id < 1) throw fail(E_FAIL, `${C}: unknown brush "${brush}"`); // unknown or empty name; no message in Softimage
        st.currentBrush = id;
        setStatus(app, C, first ? S_OK : S_FALSE); // Redo returns status 1 instead of 0
      }, () => { st.currentBrush = saved; });
    },
  });

  // ---------------------------------------------------------------- raster line / flood fill
  /** Paint target (raster owner) and destination raster of the paint manager; either missing is 0x80004005. */
  const target = (C: string): { op: M.FxOperator; raster: M.PaintRaster } => { const op = st.stores[0]; if (!op || !op.raster) throw fail(E_FAIL, `${C}: no current paint target or raster`); return { op, raster: op.raster }; };
  const undoRaster = (saved: M.RasterPart | null) => { const op = st.stores[0]; if (saved && op?.raster) { op.raster.restore(saved); op.notifyRect(saved.rect); } };
  reg({
    name: 'PaintRasterLine', label: 'Paint Raster Line', category: 'Paint', description: 'Paints one straight brush stroke segment into the current paint raster.',
    args: ['x1', 'y1', 'p1', 'x2', 'y2', 'p2'].map(name => ({ name, default: 0 })),
    execute(app, a) {
      const C = 'PaintRasterLine'; const [x1, y1, , x2, y2] = ['x1', 'y1', 'p1', 'x2', 'y2', 'p2'].map(k => { const v = M.f32(M.num(a[k])); if (Number.isNaN(v)) throw fail(E_INVALIDARG, `${C}: invalid argument`); return v; });
      let saved: M.RasterPart | null = null;
      task(app, 'Paint Raster Line', first => {
        const { op, raster } = target(C);
        // inferred: stand-in for the stroke rectangle helper and matador's PubPaintLine: a round footprint of the current
        // brush's radius along the segment, written in the foreground colour; the two pressure values are not used.
        const radius = [...st.brushes.values()].find(b => b.id === st.currentBrush)?.radius ?? 1;
        const rect = raster.clip({ x0: Math.floor(Math.min(x1, x2) - radius), y0: Math.floor(Math.min(y1, y2) - radius), x1: Math.ceil(Math.max(x1, x2) + radius), y1: Math.ceil(Math.max(y1, y2) + radius) });
        if (!rect) throw fail(E_FAIL, `${C}: the stroke touches no pixel`);
        if (first) { saved = raster.copyPart(rect); saved.title = 'PaintRasterLine Undo'; logNya(app, C, 'the stroke rectangle helper and matador.dll PubPaintLine (brush stamping, spacing, pressure mapping); the stand-in draws a round footprint in the foreground colour', `${M.NOTE_C} open question 4`); }
        const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
        M.paintPixels(raster, rect, (px, py) => { const cx = px + 0.5 - x1, cy = py + 0.5 - y1; const t = len2 ? Math.max(0, Math.min(1, (cx * dx + cy * dy) / len2)) : 0; return Math.hypot(cx - t * dx, cy - t * dy) <= radius; }, st.foreground, false);
        op.notifyRect(rect);
      }, () => undoRaster(saved));
      setStatus(app, C, S_OK);
    },
  });
  reg({
    name: 'FloodFillRaster', label: 'Flood Fill Raster', category: 'Paint', description: 'Flood fills the current paint raster from a seed point.',
    args: [{ name: 'xSeed', default: 0 }, { name: 'ySeed', default: 0 }],
    execute(app, a) {
      const C = 'FloodFillRaster'; const sx = M.f32(M.num(a.xSeed)), sy = M.f32(M.num(a.ySeed)); if (Number.isNaN(sx) || Number.isNaN(sy)) throw fail(E_INVALIDARG, `${C}: invalid argument`);
      let saved: M.RasterPart | null = null;
      task(app, 'Flood Fill Raster', first => {
        const { op, raster } = target(C);
        const tmp = new M.PaintShape('FloodFill', 'FloodFill'); M.insertPoint(tmp, -1, sx, sy); // temporary shape with exactly one point, never added to a list
        if (first) logNya(app, C, 'the fill rule of the shape renderer (tolerance, colour / opacity written, connectivity, anti-aliasing, mask); the stand-in replaces the 4-connected region of the seed pixel\'s exact colour with the foreground colour', `${M.NOTE_C} open question 3`);
        // inferred: stand-in renderer; a seed outside the raster is a renderer failure
        const x0 = Math.floor(tmp.points[0].x), y0 = Math.floor(tmp.points[0].y);
        if (x0 < 0 || y0 < 0 || x0 >= raster.width || y0 >= raster.height) throw fail(E_FAIL, `${C}: the renderer failed (seed outside the raster)`);
        const from = raster.get(x0, y0); const same = (c: M.RGBA, d: M.RGBA) => c.every((v, i) => v === d[i]);
        const region = new Set<number>();
        if (!same(from, st.foreground.map(M.f32) as M.RGBA)) {
          const stack = [[x0, y0]];
          while (stack.length) { const [x, y] = stack.pop()!; const key = y * raster.width + x; if (x < 0 || y < 0 || x >= raster.width || y >= raster.height || region.has(key) || !same(raster.get(x, y), from)) continue; region.add(key); stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
        }
        const res = M.paintPixels(raster, raster.limits, (x, y) => region.has(y * raster.width + x), st.foreground, first);
        if (first) saved = res.saved;
        if (res.rect) op.notifyRect(res.rect);
      }, () => undoRaster(saved));
      setStatus(app, C, S_OK);
    },
  });

  // ---------------------------------------------------------------- ImportMatadorShapeList
  reg({
    name: 'ImportMatadorShapeList', label: 'Import Matador Shape List', category: 'Paint', description: 'Reads a Matador .sl shape list file and appends its shapes to a paint shape list.',
    args: [{ name: 'ShapeList', default: null }, { name: 'FileName', default: null }, { name: 'DestWidth', default: 0 }, { name: 'DestHeight', default: 0 }],
    execute(app, a) {
      const C = 'ImportMatadorShapeList';
      const list = M.asList(app, a.ShapeList); if (!list) throw fail(E_INVALIDARG, M.MSG_LIST);
      const file = M.unset(a.FileName) ? '' : String(a.FileName); if (!file) throw fail(E_INVALIDARG, 'Argument 2 a file name');
      const dw = M.num(a.DestWidth), dh = M.num(a.DestHeight); if (Number.isNaN(dw) || Number.isNaN(dh)) throw fail(E_INVALIDARG, `${C}: invalid argument`);
      const readError = () => fail(E_FAIL, `Error reading Matador shape list file "${file}"`);
      const need = (v: number | null): number => { if (v === null) throw readError(); return v; };
      // The shapes are appended directly (not as undoable steps): shapes appended before an error stay in the list, and Undo is a stub.
      const importFile = () => {
        let text: string; try { text = hostFs.readFile(file); } catch { throw fail(E_FILENOTFOUND, `Matador shape list file "${file}" not found`); }
        const sc = new Scan(text);
        let field = sc.int(); let animated = false;
        if (field === MATADOR_MAGIC) { animated = true; sc.line(200); field = sc.int(); }
        if (field === null) throw fail(E_FAIL, `File "${file}" is not a Matador shape list file`);
        const version = -field;
        let scaleX = 1, scaleY = 1;
        if (version >= 5) { const w = need(sc.int()), h = need(sc.int()); if (dw !== 0 && dh !== 0) { scaleX = dw / w; scaleY = dh / h; } }
        const kindSwitch = version >= 7 ? need(sc.int()) === 3 : false;
        const keyCount = animated ? need(sc.int()) : 1; if (keyCount < 1) throw readError();
        const shapes: M.PaintShape[] = [];
        for (let k = 0; k < keyCount; k++) {
          const frame = animated ? need(sc.int()) : 0;
          const shapeCount = need(sc.int());
          for (let i = 0; i < shapeCount; i++) {
            const pointCount = need(sc.int()), code = need(sc.int());
            if (![1, 3, 4, 5].includes(code)) throw readError();
            const kind = code === 1 || code === 5 ? 2 : kindSwitch ? 0 : 1, flag = code === 1 || code === 3;
            if (version >= 8) { sc.line(); need(sc.int()); sc.line(); const parsed = sc.line().trim() || `Shape${i}`; void parsed; } // inferred: line handling; the parsed name is not applied to the shape
            const pts: M.PaintPoint[] = [];
            for (let p = 0; p < pointCount; p++) {
              const x = need(sc.float()), y = need(sc.float()); if (version < 2) need(sc.float());
              let type = need(sc.int()); if (type < 1 || type > 3) type = 1;
              let t = [0, 0, 0, 0], rgb = [1, 1, 1];
              if (version >= 6) { t = [need(sc.float()), need(sc.float()), need(sc.float()), need(sc.float())]; rgb = [need(sc.float()), need(sc.float()), need(sc.float())]; }
              else if (version >= 3) rgb = [need(sc.float()), need(sc.float()), need(sc.float())];
              else if (version === 2) rgb = [need(sc.int()) / 255, need(sc.int()) / 255, need(sc.int()) / 255];
              // inferred: tangent pair 1 / 2 are the left / right handle; the point type (1..3) is also the point weight
              pts.push({ x: M.f32(x * scaleX), y: M.f32(y * scaleY), lhx: M.f32(t[0]), lhy: M.f32(t[1]), rhx: M.f32(t[2]), rhy: M.f32(t[3]), weight: type, selected: false, color: [M.f32(rgb[0]), M.f32(rgb[1]), M.f32(rgb[2]), 1], type });
            }
            if (k === 0) shapes.push(st.createShape('ColorShape')); // created once, while the first key is read
            const s = shapes[i]; if (!s) throw readError(); // inferred: a later key with more shapes than the first is a read error
            s.shapeType = { kind, flag }; s.curveType = kind; s.closed = flag; // inferred: the "set type" pair is the curve type and the closed flag
            s.points = pts; if (!s.subShapes.length && pts.length) s.subShapes = [0];
            if (animated) st.addShapeKey(s, frame); // inferred: a key on the shape at that key's frame
            if (k === 0) list.append(s);
            s.notify();
          }
          need(sc.int()); // one more integer after the shapes of a key, ignored
        }
      };
      importFile();
      logNya(app, C, 'the meaning of the shape kind / flag pair and of the point type values 1..3; they are kept on the shape as read (kind as curve type, flag as closed)', `${M.NOTE_C} open question 6`);
      task(app, 'Import Matador Shape List', () => { /* done above */ }, () => { /* stub: returns success without removing anything */ },
        () => logNya(app, C, 'Redo (it resolves a shape-list reference the command never stores); nothing is imported again', `${M.NOTE_C} open question 6`));
      setStatus(app, C, S_OK);
    },
  });
}
