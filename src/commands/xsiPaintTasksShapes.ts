// Ledger row CMD-B9b. Brief: docs/ghidra/cmd-b9b-xsipaint-add-shapes-binary.md, sections 2 "Shared facts" and
// 3 "Contracts". Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   add shapes     AddColorPaintShape AddFloodFillPaintShape AddAlphaFloodFillPaintShape AddBoundaryFillPaintShape
//                  AddFxMaskShape (as read: never passes UnPackArg) AddRectanglePaintShape AddEllipsePaintShape
//                  AddClearImageShape AddBrushStroke
//   delete / wipe  DeleteAllPaintShapes ClearImage                  (wipe renderer unread: stand-in fill, logged)
//   points         DeletePaintShapePoints TranslatePaintShapePoint MovePaintShapeHandle SetPaintShapeHandle
//
// Mapping notes (see xsiPaintTasks.ts for the shared ones):
//  * Every shape-creating command prepares the list first (note 2.4, `prepareList`) and keeps the undo references of
//    note 2.5 from the FIRST run only: Redo creates new objects and does not rewrite the references, so an Undo after a
//    Redo finds nothing left to delete. That is the behaviour as read, not a simplification.
//  * Commands with output arguments other than the return value hand them back as a list keyed by argument name.
import { App, CommandDef } from '../core/commands';
import { outputs } from './primTasksTexture';
import * as M from './xsiPaintTasksModel';

const { S_OK, S_NOTHING, E_FAIL, E_INVALIDARG, E_UNEXPECTED, fail, setStatus, logNya, stateOf, task } = M;
const MSG_STROKE = 'Argument 1 must be a 2D paint shape list';
const MSG_BEZIER = 'Argument 1 must be a 2D bezier paint shape';

interface Refs { shape: M.PaintShape; clear: M.PaintSimpleCommand | null; dups: M.PaintItem[] }
/** Undo of note 2.5: the new shape, then the automatic Clear Stencil command if it still resolves, then the duplicates. */
function undoRefs(app: App, r: Refs | null, deleteShape = true) {
  if (!r) return;
  if (deleteShape) M.deleteItems(app, [r.shape]);
  if (r.clear) M.deleteItems(app, [r.clear]);
  if (r.dups.length) M.deleteItems(app, r.dups);
}
/** The DeleteAllPaintShapes worker: the list's items at the current time go to the DeleteObj task. null = nothing to delete. */
function deleteAllWorker(app: App, list: M.PaintShapeList): M.Deleted | null {
  const items = list.itemsAt(M.currentTime(app)).filter(Boolean);
  return items.length ? M.deleteItems(app, items) : null;
}

export function registerXsiPaintShapeCommands(app: App) {
  const st = stateOf(app); const reg = (def: CommandDef) => app.register(def);

  // ---------------------------------------------------------------- Add family (one class, the shape class is chosen by the command)
  const addCommand = (name: string, label: string, cls: M.ShapeClass | null, seed: boolean) => reg({
    name, label, category: 'Paint', description: 'Appends a new shape to a paint shape list and returns it.',
    args: seed ? [{ name: 'ShapeList', default: null }, { name: 'SeedX', default: 0 }, { name: 'SeedY', default: 0 }] : [{ name: 'ShapeList', default: null }],
    execute(app, a) {
      const list = M.asList(app, a.ShapeList); if (!list) throw fail(E_INVALIDARG, M.MSG_LIST);
      if (name === 'AddFxMaskShape') {
        logNya(app, name, 'what the list kind query answers per ListType and the class behind the command GUID; as read no list kind lets this command reach Do', `${M.NOTE_B} open question 2`);
        if (list.kind7() !== 1) throw fail(E_INVALIDARG, 'Argument 1 must be a mask shape list');
      }
      if (list.kind7() !== 0) throw fail(E_INVALIDARG, `${name}: invalid argument`); // no message
      let sx = 0, sy = 0;
      if (seed) { sx = M.num(a.SeedX); sy = M.num(a.SeedY); if (Number.isNaN(sx) || Number.isNaN(sy)) throw fail(E_INVALIDARG, M.MSG_LIST); }
      let refs: Refs | null = null;
      task(app, label, first => {
        const prep = M.prepareList(app, list, M.currentTime(app));
        if (first && (cls === 'AlphaFloodFill' || cls === 'BoundaryFill')) logNya(app, name, `the shape class created for this command (its CLSID is not served by xsipaint.dll); a placeholder "${cls}" shape is appended`, `${M.NOTE_B} open question 4`);
        const s = st.createShape(cls!); list.append(s); s.tag = prep.tag;
        if (first) refs = { shape: s, clear: prep.clearCmd, dups: prep.dups };
        if (seed) M.insertPoint(s, -1, sx, sy); // one point at the end, no handles
      }, () => undoRefs(app, refs));
      setStatus(app, name, S_OK);
      return refs!.shape;
    },
  });
  addCommand('AddColorPaintShape', 'Add Color Paint Shape', 'ColorShape', false);
  addCommand('AddFxMaskShape', 'Add Fx Mask Shape', null, false);
  addCommand('AddFloodFillPaintShape', 'Add Flood Fill Paint Shape', 'FloodFill', true);
  addCommand('AddAlphaFloodFillPaintShape', 'Add Alpha Flood Fill Paint Shape', 'AlphaFloodFill', true);
  addCommand('AddBoundaryFillPaintShape', 'Add Boundary Fill Paint Shape', 'BoundaryFill', true);

  // ---------------------------------------------------------------- rectangle / ellipse shapes
  const geomCommand = (name: string, label: string, ellipse: boolean) => reg({
    name, label, category: 'Paint', description: `Appends a ${ellipse ? 'bezier ellipse' : 'rectangle'} colour shape to a paint shape list and returns it.`,
    args: [{ name: 'ShapeList', default: null }, { name: 'X1', default: 0 }, { name: 'Y1', default: 0 }, { name: 'X2', default: 0 }, { name: 'Y2', default: 0 }, { name: 'FromCenter', default: true }],
    execute(app, a) {
      const list = M.asList(app, a.ShapeList); if (!list) throw fail(E_INVALIDARG, `${name}: invalid argument`); // no message
      const v = [a.X1, a.Y1, a.X2, a.Y2].map(M.num); if (v.some(Number.isNaN)) throw fail(E_INVALIDARG, `${name}: invalid argument`);
      const fromCenter = M.bool(a.FromCenter);
      let refs: Refs | null = null;
      task(app, label, first => {
        const prep = M.prepareList(app, list, M.currentTime(app));
        const s = st.createShape('ColorShape'); list.append(s); s.tag = prep.tag;
        if (first) refs = { shape: s, clear: prep.clearCmd, dups: prep.dups };
        (ellipse ? M.setEllipse : M.setRectangle)(s, M.f32(v[0]), M.f32(v[1]), M.f32(v[2]), M.f32(v[3]), fromCenter);
        st.setName(s, ellipse ? 'Ellipse' : 'Rectangle');
      }, () => undoRefs(app, refs));
      setStatus(app, name, S_OK);
      return refs!.shape;
    },
  });
  geomCommand('AddRectanglePaintShape', 'Add Rectangle Paint Shape', false);
  geomCommand('AddEllipsePaintShape', 'Add Ellipse Paint Shape', true);

  // ---------------------------------------------------------------- ClearImage family
  reg({
    name: 'DeleteAllPaintShapes', label: 'Delete All Paint Shapes', category: 'Paint', description: 'Deletes every shape of a paint shape list at the current time.',
    args: [{ name: 'ShapeList', default: null }],
    execute(app, a) {
      const list = M.asList(app, a.ShapeList); if (!list) throw fail(E_INVALIDARG, 'DeleteAllPaintShapes: invalid argument'); // no message
      let del: M.Deleted | null = null;
      task(app, 'Delete All Paint Shapes', first => { if (first) del = deleteAllWorker(app, list); else del?.redo(); }, () => del?.undo());
      setStatus(app, 'DeleteAllPaintShapes', del ? S_OK : S_NOTHING);
    },
  });
  reg({
    name: 'AddClearImageShape', label: 'Add Clear Image Shape', category: 'Paint', description: 'Appends a wipe (clear image) shape to a paint shape list and returns it.',
    args: [{ name: 'ShapeList', default: null }],
    execute(app, a) {
      const list = M.asList(app, a.ShapeList); if (!list) throw fail(E_INVALIDARG, 'AddClearImageShape: invalid argument'); // no message
      if (!(list instanceof M.PaintShapeList)) throw fail(E_UNEXPECTED, 'AddClearImageShape: not a shape list'); // the worker's own check (unreachable after UnPackArg here)
      let refs: Refs | null = null; let nested: M.Deleted | null = null;
      task(app, 'Add Clear Image Shape', first => {
        nested = null; // Redo clears the nested tasks and runs the worker again
        if (list.kind8() === 0 && !st.toolSettings.flag48) nested = deleteAllWorker(app, list); // "nothing to delete" is accepted
        const prep = M.prepareList(app, list, M.currentTime(app));
        const s = st.createShape('WipeShape'); list.append(s); s.tag = prep.tag;
        if (first) refs = { shape: s, clear: prep.clearCmd, dups: prep.dups };
      }, () => { undoRefs(app, refs); nested?.undo(); nested = null; });
      setStatus(app, 'AddClearImageShape', S_OK);
      return refs!.shape;
    },
  });
  reg({
    name: 'ClearImage', label: 'Clear Image', category: 'Paint', description: 'Wipes the current paint raster.', args: [],
    execute(app) {
      let snap: M.RasterPart | null = null;
      task(app, 'Clear Image', first => {
        // inferred: the session's current view target and current paint raster are the paint store operator (slot 0) and its raster
        const op = st.stores[0]; const raster = op?.raster; if (!op || !raster) throw fail(E_FAIL, 'ClearImage: no current view target or paint raster');
        if (first) { snap = raster.copyPart(raster.limits); snap.storage = 'file'; } // the whole raster, written to a temp file (prefix SRHUNDO_) when possible
        // inferred: stand-in for rendering a WipeShape with its class defaults: every pixel becomes transparent black
        if (first) logNya(app, 'ClearImage', 'the WipeShape class defaults (Color RGBA, MaskSource) and its renderer, with the session mask / stencil source; the stand-in writes (0, 0, 0, 0) to the whole raster', `${M.NOTE_B} open question 5`);
        const res = M.paintPixels(raster, raster.limits, () => true, [0, 0, 0, 0], false);
        if (res.rect) op.notifyRect(res.rect);
      }, () => { const op = st.stores[0]; if (snap && op?.raster) { op.raster.restore(snap); op.notifyRect(snap.rect); } });
      setStatus(app, 'ClearImage', S_OK);
    },
  });

  // ---------------------------------------------------------------- AddBrushStroke
  reg({
    name: 'AddBrushStroke', label: 'Add Brush Stroke', category: 'Paint', description: 'Appends a brush stroke to the stroke shape of a paint shape list (reused when the brush state matches, else created).',
    args: [{ name: 'ShapeList', default: null }, { name: 'Points', default: null }, { name: 'Pressure', default: null }, { name: 'index', default: 0 }],
    execute(app, a) {
      const bad = () => fail(E_INVALIDARG, MSG_STROKE);
      const list = M.asList(app, a.ShapeList); if (!list) throw bad();
      const raw = M.arrayOf(a.Points); if (!raw || !raw.length || raw.length % 2) throw bad();
      const xy = raw.map(v => M.f32(M.num(v))); if (xy.some(Number.isNaN)) throw bad();
      let pressures: number[];
      if (M.unset(a.Pressure)) pressures = [1];
      else if (typeof a.Pressure === 'number') pressures = [M.f32(a.Pressure)];
      else { const p = M.arrayOf(a.Pressure); if (!p || p.length !== xy.length / 2) throw bad(); pressures = p.map(v => M.f32(M.num(v))); if (pressures.some(Number.isNaN)) throw bad(); }
      const same = (x: M.RGBA | null, y: M.RGBA) => !!x && x.every((c, i) => c === y[i]);
      let refs: Refs | null = null; let created = false; let subIndex = 0;
      task(app, 'Add Brush Stroke', first => {
        const time = M.currentTime(app); const ts = st.toolSettings;
        const prep = M.prepareList(app, list, time);
        const cand = list.itemAt(time);
        // inferred: the session's colour 1 / colour 2 are the foreground / background colours
        const reuse = cand instanceof M.PaintShape && cand.cls === 'StrokeShape' && cand.brushId === st.currentBrush && same(cand.color1, st.foreground) && same(cand.color2, st.background)
          && !!cand.settings && cand.settings.strokeSetting[0] === ts.strokeSetting[0] && cand.settings.strokeSetting[1] === ts.strokeSetting[1] && cand.settings.drawSetting === ts.drawSetting && cand.settings.flag48 === ts.flag48 && cand.settings.flag49 === ts.flag49;
        let s: M.PaintShape;
        if (reuse) s = cand as M.PaintShape;
        else {
          s = st.createShape('StrokeShape'); list.append(s); s.brushId = st.currentBrush; s.tag = prep.tag;
          // inferred: the stroke shape's initialisation takes the colours and stroke / draw settings the reuse test later compares
          s.color1 = [...st.foreground]; s.color2 = [...st.background]; s.settings = { ...ts, strokeSetting: [...ts.strokeSetting] };
        }
        if (first) { created = !reuse; refs = { shape: s, clear: prep.clearCmd, dups: prep.dups }; }
        const i = M.appendStroke(s, xy, pressures); if (first) subIndex = i;
      }, () => {
        if (!refs) return;
        if (created) M.deleteItems(app, [refs.shape]);
        else { const k = refs.shape.strokes[subIndex]; if (k) M.deletePoints(refs.shape, Array.from({ length: k.count }, (_, j) => k.start + j)); } // the DeletePaintShapePoints task on the sub-stroke's consecutive indices
        undoRefs(app, refs, false);
      });
      setStatus(app, 'AddBrushStroke', S_OK);
      return outputs({ index: subIndex, Value: refs!.shape });
    },
  });

  // ---------------------------------------------------------------- point edits
  reg({
    name: 'DeletePaintShapePoints', label: 'Delete Paint Shape Points', category: 'Paint', description: 'Deletes points of a 2D paint shape (the selected points when no index is given).',
    args: [{ name: 'Shape', default: null }, { name: 'index', default: null }],
    execute(app, a) {
      const shape = M.needShape(app, a.Shape);
      let indices: number[];
      if (M.unset(a.index)) indices = M.selectedIndices(shape);
      else if (typeof a.index === 'number') indices = [Math.trunc(a.index)];
      else { const arr = M.arrayOf(a.index); if (!arr || !arr.length) throw fail(E_INVALIDARG, M.MSG_SHAPE); indices = arr.map(v => Math.trunc(M.num(v))); if (indices.some(Number.isNaN)) throw fail(E_INVALIDARG, M.MSG_SHAPE); }
      let blob: M.PointBlob | null = null; let selection: number[] = [];
      task(app, 'Delete Paint Shape Points', () => { selection = M.selectedIndices(shape); M.setSelection(shape, [], 0); blob = M.deletePoints(shape, indices); },
        () => { if (blob) M.restorePoints(shape, blob); M.setSelection(shape, selection, 0); });
      setStatus(app, 'DeletePaintShapePoints', S_OK);
    },
  });
  reg({
    name: 'TranslatePaintShapePoint', label: 'Translate Paint Shape Point', category: 'Paint', description: 'Moves the selected points of a 2D paint shape by (x, y).',
    args: [{ name: 'Shape', default: null }, { name: 'x', default: 0 }, { name: 'y', default: 0 }, { name: 'Delta', default: ':siRelative:siDeltaMode' }],
    execute(app, a) {
      const shape = M.needShape(app, a.Shape);
      const dx = M.f32(M.num(a.x)), dy = M.f32(M.num(a.y)); if (Number.isNaN(dx) || Number.isNaN(dy)) throw fail(E_INVALIDARG, 'TranslatePaintShapePoint: invalid argument'); // no message
      // `Delta` is stored and never read by the worker: the move is always a relative translation (siAbsolute behaves like siRelative).
      const indices = M.selectedIndices(shape); let old: [number, number][] = [];
      task(app, 'Translate Paint Shape Point', first => {
        if (first) old = indices.map(i => [shape.points[i]?.x ?? 0, shape.points[i]?.y ?? 0]);
        for (const i of indices) { const p = shape.points[i]; if (p) { p.x = M.f32(p.x + dx); p.y = M.f32(p.y + dy); } }
        shape.notify();
      }, () => { indices.forEach((i, k) => { const p = shape.points[i]; if (p) [p.x, p.y] = old[k]; }); shape.notify(); }); // inferred: Undo restores the old positions
      setStatus(app, 'TranslatePaintShapePoint', S_OK);
    },
  });

  /** Shared UnPackArg of the two handle commands: a bezier shape (kind 0), then the per-variant checks, then the point range. */
  const bezierShape = (app: App, v: any): M.PaintShape => {
    const s = M.asShape(app, v);
    if (!s || s.curveType !== 0) throw fail(E_INVALIDARG, MSG_BEZIER); // inferred: the shape kind the handle commands test is the curve type field (0 = bezier)
    return s;
  };
  const pointIndex = (s: M.PaintShape, v: any, others: number[]): number => {
    const i = M.num(v); if (Number.isNaN(i) || others.some(Number.isNaN) || !(Math.trunc(i) >= 0 && Math.trunc(i) < s.points.length)) throw fail(E_INVALIDARG, 'Point index out of range');
    return Math.trunc(i);
  };
  type Handles = [number, number, number, number];
  const handles = (p: M.PaintPoint): Handles => [p.lhx, p.lhy, p.rhx, p.rhy];
  const setHandles = (s: M.PaintShape, i: number, h: Handles) => { const p = s.points[i]; if (p) { [p.lhx, p.lhy, p.rhx, p.rhy] = h; s.notify(); } };
  reg({
    name: 'MovePaintShapeHandle', label: 'Move Paint Shape Handle', category: 'Paint', description: 'Moves the left (1) or right (2) handle of one point of a bezier paint shape.',
    args: [{ name: 'Shape', default: null }, { name: 'Point', default: 0 }, { name: 'Handle', default: 0 }, { name: 'x', default: 0 }, { name: 'y', default: 0 }, { name: 'Mode', default: 0 }],
    execute(app, a) {
      const C = 'MovePaintShapeHandle'; const shape = bezierShape(app, a.Shape);
      const handle = M.num(a.Handle); if (handle !== 1 && handle !== 2) throw fail(E_INVALIDARG, 'Handle must be 1 for left or 2 for right');
      const mode = M.num(a.Mode); if (![0, 1, 2, 3].includes(mode)) throw fail(E_INVALIDARG, 'Invalid mode');
      const x = M.f32(M.num(a.x)), y = M.f32(M.num(a.y));
      const point = pointIndex(shape, a.Point, [x, y]);
      let old: Handles = [0, 0, 0, 0];
      task(app, 'Move Paint Shape Handle', first => {
        const p = shape.points[point]; if (!p) throw fail(E_INVALIDARG, `${C}: invalid argument`); // the worker re-validates
        if (first) { old = handles(p); logNya(app, C, `the effect of Mode ${mode} (0..3) and whether x, y are absolute or relative; the stand-in sets the chosen handle offset to (x, y) and leaves the other handle`, `${M.NOTE_B} open question 3`); }
        // inferred: stand-in for the shape's "move one handle with a mode" method
        if (handle === 1) { p.lhx = x; p.lhy = y; } else { p.rhx = x; p.rhy = y; }
        shape.notify();
      }, () => setHandles(shape, point, old));
      setStatus(app, C, S_OK);
    },
  });
  reg({
    name: 'SetPaintShapeHandle', label: 'Set Paint Shape Handle', category: 'Paint', description: 'Sets both handles of one point of a bezier paint shape.',
    args: [{ name: 'Shape', default: null }, { name: 'Point', default: 0 }, { name: 'lhx', default: 0 }, { name: 'lhy', default: 0 }, { name: 'lrx', default: 0 }, { name: 'lry', default: 0 }],
    execute(app, a) {
      const C = 'SetPaintShapeHandle'; const shape = bezierShape(app, a.Shape);
      const h = [a.lhx, a.lhy, a.lrx, a.lry].map(v => M.f32(M.num(v))) as Handles;
      const point = pointIndex(shape, a.Point, h);
      let old: Handles = [0, 0, 0, 0];
      task(app, 'Set Paint Shape Handle', first => {
        const p = shape.points[point]; if (!p) throw fail(E_INVALIDARG, `${C}: invalid argument`);
        if (first) old = handles(p);
        setHandles(shape, point, h); // left then right, relative flag false: the values are stored in the shape's handle convention (offsets in this stand-in, open question 6)
      }, () => setHandles(shape, point, old));
      setStatus(app, C, S_OK);
    },
  });
}
