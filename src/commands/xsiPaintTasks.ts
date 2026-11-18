// Ledger row CMD-B9a. Brief: docs/ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md, sections 2 "Shared facts" and
// 3 "Contracts". Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   shape keys     GetFirstPaintShapeKey GetPrevPaintShapeKey GetClosestPaintShapeKey GetNextPaintShapeKey GetLastPaintShapeKey
//   paint stores   SetPaintStore SetPaintMergeStore SetPaintMaskStore
//   raster         RectanglePaintRaster EllipsePaintRaster          (renderer unread: stand-in fill, logged)
//   shape points   IncPaintShapePointWeight DecPaintShapePointWeight AddPaintShapePoint
//   stencil        ClearPaintSelection InvertPaintStencil
//
// How the contract is mapped onto this build:
//  * The paint objects are the stand-in model of xsiPaintTasksModel.ts, hung on the app as `app.xsiPaint`. Object
//    arguments take such an object or its name.
//  * Task status codes that are not failures (0, 1, 0x562e8005) are kept in `app.xsiPaint.lastStatus`; failure statuses
//    are thrown as SiStatusError carrying the literal message of the note when it states one.
//  * Do / Undo / Redo follow each contract literally (`task` in the model file): e.g. AddPaintShapePoint's Undo leaves
//    the point in place, InvertPaintStencil's Redo creates a new entry.
// This file also holds the single entry main.ts calls; rows CMD-B9b and CMD-B9c are in the sibling files.
import { App, CommandDef } from '../core/commands';
import * as M from './xsiPaintTasksModel';
import { registerXsiPaintShapeCommands } from './xsiPaintTasksShapes';
import { registerXsiPaintMaskCommands } from './xsiPaintTasksMasks';

const { S_OK, S_FALSE, S_NOTHING, E_FAIL, E_INVALIDARG, fail, setStatus, logNya, stateOf, task } = M;
const EPS = 1e-6;

function registerB9a(app: App) {
  const st = stateOf(app); const reg = (def: CommandDef) => app.register(def);

  // ---------------------------------------------------------------- shape key navigation (read-only)
  const keyCommand = (name: string, label: string, mode: 0 | 1 | 2 | 3 | 4) => reg({
    name, label, category: 'Paint', undoable: false,
    description: 'Returns a shape key of a 2D paint shape.',
    args: mode === 0 || mode === 4 ? [{ name: 'Shape', default: null }] : [{ name: 'Shape', default: null }, { name: 'Time', default: null }],
    execute(app, a) {
      const shape = M.needShape(app, a.Shape);
      const keys = [...shape.keys].sort((x, y) => x.Time - y.Time); const n = keys.length;
      let t = 0;
      if (mode >= 1 && mode <= 3) {
        t = M.unset(a.Time) ? M.currentTime(app) : M.num(a.Time); // inferred: an omitted Time is the current time (the Time argument handler is outside the DLL); frames, compared as raw numbers
        if (Number.isNaN(t)) throw fail(E_INVALIDARG, M.MSG_SHAPE); // same text when the Time argument cannot be fetched
      }
      setStatus(app, name, S_FALSE); // Do returns status 1 (success, non-zero)
      if (!n) return null;
      const lastBefore = (limit: number) => { let k = -1; keys.forEach((x, i) => { if (x.Time < limit) k = i; }); return k; };
      const firstAfter = (limit: number) => keys.findIndex(x => x.Time > limit);
      if (mode === 0) return keys[0];
      if (mode === 4) return keys[n - 1];
      if (mode === 1) { const i = lastBefore(t - EPS); return keys[i < 0 ? 0 : i]; }
      if (mode === 3) { const i = firstAfter(t + EPS); return keys[i < 0 ? n - 1 : i]; }
      const ia = lastBefore(t + EPS), ib = firstAfter(t - EPS);
      const A = keys[ia < 0 ? 0 : ia], B = keys[ib < 0 ? n - 1 : ib];
      return Math.abs(A.Time - t) < Math.abs(B.Time - t) ? A : B; // on a tie the later one
    },
  });
  keyCommand('GetFirstPaintShapeKey', 'Get First Paint Shape Key', 0);
  keyCommand('GetPrevPaintShapeKey', 'Get Previous Paint Shape Key', 1);
  keyCommand('GetClosestPaintShapeKey', 'Get Closest Paint Shape Key', 2);
  keyCommand('GetNextPaintShapeKey', 'Get Next Paint Shape Key', 3);
  keyCommand('GetLastPaintShapeKey', 'Get Last Paint Shape Key', 4);

  // ---------------------------------------------------------------- paint stores
  const storeCommand = (name: string, label: string, slot: 0 | 1 | 2) => reg({
    name, label, category: 'Paint', description: 'Makes an FxTree operator a store of the paint engine.',
    args: [{ name: 'FxOp', default: null }],
    execute(app, a) {
      const op = M.asFxOp(app, a.FxOp); if (!op) throw fail(E_INVALIDARG, M.MSG_FXOP);
      let before: (M.FxOperator | null)[] = [];
      task(app, label, first => { if (first) before = [...st.stores]; st.stores[slot] = op; },
        () => { before.forEach((p, i) => { if (p) st.stores[i] = p; }); }); // a slot that was empty before is left as the command set it
      setStatus(app, name, S_OK);
    },
  });
  storeCommand('SetPaintStore', 'Set Paint Store', 0);
  storeCommand('SetPaintMergeStore', 'Set Paint Merge Store', 1);
  storeCommand('SetPaintMaskStore', 'Set Paint Mask Store', 2);

  // ---------------------------------------------------------------- raster rectangle / ellipse
  const rasterCommand = (name: string, label: string, ellipse: boolean) => reg({
    name, label, category: 'Paint', description: `Rasterises a filled ${ellipse ? 'ellipse' : 'rectangle'} into the raster of the current paint store.`,
    args: [{ name: 'X1', default: 0 }, { name: 'Y1', default: 0 }, { name: 'X2', default: 0 }, { name: 'Y2', default: 0 }, { name: 'FromCenter', default: true }],
    execute(app, a) {
      const [x1, y1, x2, y2, fromCenter] = M.rectArgs(name, a);
      let saved: M.RasterPart | null = null; let status = S_OK;
      task(app, label, first => {
        const op = st.stores[0]; if (!op) throw fail(E_FAIL, `${name}: no paint store`);
        const tmp = new M.PaintShape(ellipse ? 'Ellipse' : 'Rectangle', 'ColorShape'); // temporary, never added to the clip
        (ellipse ? M.setEllipse : M.setRectangle)(tmp, x1, y1, x2, y2, fromCenter);
        if (!op.raster) throw fail(E_FAIL, `${name}: the paint store has no raster`); // inferred: a store without a raster is a render failure
        // inferred: stand-in renderer. Coordinates are raster pixels and the outline is filled with the foreground colour, replacing the pixels.
        if (first) logNya(app, name, 'the pixel renderer (fill colour, opacity, fill style, edge blur, merge / mask stores, stencil) and the coordinate space of X1..Y2; the stand-in fills the outline with the foreground colour in raster pixels', `${M.NOTE_A} open questions 2, 3`);
        const res = M.fillPolygon(op.raster, M.outline(tmp), st.foreground, first);
        if (first) { saved = res.saved; status = res.saved ? S_OK : S_FALSE; } // status 1: the render produced no captured raster (nothing drawn)
        if (res.rect) op.notifyRect(res.rect);
      }, () => { const op = st.stores[0]; if (saved && op?.raster) { op.raster.restore(saved); op.notifyRect(saved.rect); } });
      setStatus(app, name, status);
    },
  });
  rasterCommand('RectanglePaintRaster', 'Rectangle Paint Raster', false);
  rasterCommand('EllipsePaintRaster', 'Ellipse Paint Raster', true);

  // ---------------------------------------------------------------- point weights
  const weightCommand = (name: string, label: string, inc: boolean) => reg({
    name, label, category: 'Paint', description: 'Steps the weight of the selected points of a paint shape by one (kept inside 1..3).',
    args: [{ name: 'Shape', default: null }],
    execute(app, a) {
      const shape = M.needShape(app, a.Shape);
      const indices = M.selectedIndices(shape); // the snapshot the command acts on
      let old: number[] = [];
      task(app, label, first => {
        if (first) old = indices.map(i => shape.points[i]?.weight ?? 0);
        for (const i of indices) { const p = shape.points[i]; if (!p) continue; if (inc ? p.weight < 3 : p.weight > 1) { p.weight += inc ? 1 : -1; shape.notify(); } }
      }, () => { indices.forEach((i, k) => { const p = shape.points[i]; if (p) p.weight = old[k]; }); shape.notify(); });
      setStatus(app, name, S_OK);
    },
  });
  weightCommand('IncPaintShapePointWeight', 'Increase Paint Shape Point Weight', true);
  weightCommand('DecPaintShapePointWeight', 'Decrease Paint Shape Point Weight', false);

  // ---------------------------------------------------------------- AddPaintShapePoint
  reg({
    name: 'AddPaintShapePoint', label: 'Add Paint Shape Point', category: 'Paint', description: 'Inserts one point into a 2D paint shape and returns its index.',
    args: [{ name: 'Shape', default: null }, { name: 'InsertPosition', default: -1 }, { name: 'x', default: 0 }, { name: 'y', default: 0 }, { name: 'lhx', default: 0 }, { name: 'lhy', default: 0 }, { name: 'rhx', default: 0 }, { name: 'rhy', default: 0 }],
    execute(app, a) {
      const shape = M.needShape(app, a.Shape);
      const v = [a.InsertPosition, a.x, a.y, a.lhx, a.lhy, a.rhx, a.rhy].map(M.num); if (v.some(Number.isNaN)) throw fail(E_INVALIDARG, M.MSG_SHAPE);
      const at = Math.trunc(v[0]); let value = 0;
      // Undo does not remove the point (it only resolves the shape); Redo inserts the same point again.
      task(app, 'Add Paint Shape Point', first => { const i = M.insertPoint(shape, at, v[1], v[2], v[3], v[4], v[5], v[6]); if (first) value = i; }, () => { /* nothing, as read */ });
      setStatus(app, 'AddPaintShapePoint', S_OK);
      return value;
    },
  });

  // ---------------------------------------------------------------- stencil
  reg({
    name: 'ClearPaintSelection', label: 'Clear Paint Selection', category: 'Paint', description: 'Deletes every stencil / selection element of the current paint frame.', args: [],
    execute(app) {
      let del: M.Deleted | null = null; let status = S_OK;
      task(app, 'Clear Paint Selection', first => { if (!first) { del?.redo(); return; } const r = M.clearSelectionWorker(app); status = r.status; del = r.deleted; }, () => { del?.undo(); });
      setStatus(app, 'ClearPaintSelection', status);
    },
  });
  reg({
    name: 'InvertPaintStencil', label: 'Invert Paint Stencil', category: 'Paint', description: 'Appends an "Invert Stencil" entry to the current paint frame.', args: [],
    execute(app) {
      let ref: M.PaintSimpleCommand | null = null;
      // Redo runs Do again: a new simple command object, and the reference is stored again.
      const run = () => {
        const list = M.currentList(app); if (!list) throw fail(E_FAIL, 'InvertPaintStencil: no current paint frame');
        const c = st.createSimpleCommand(1, 'InvertStencil');
        list.append(c); // inferred: at the end of the element list
        ref = c;
      };
      task(app, 'Invert Paint Stencil', run, () => { M.deleteItems(app, [ref]); }, run);
      setStatus(app, 'InvertPaintStencil', S_OK);
    },
  });
}

/** Rows CMD-B9a, CMD-B9b and CMD-B9c: the task commands of xsipaint.dll (the single entry main.ts calls). */
export function registerXsiPaintTaskCommands(app: App) {
  (app as any).xsiPaint = M.makeState();
  registerB9a(app);
  registerXsiPaintShapeCommands(app);
  registerXsiPaintMaskCommands(app);
}
