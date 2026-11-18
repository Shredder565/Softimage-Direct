// Ledger rows CMD-B9f and CMD-B9g, 2D shape commands of fxcore.dll. Briefs:
// docs/ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md (Add2DShape, Add2DShapePoint, Add2DShapePointArray,
// Insert2DShapePoint, Move2DShape, Scale2DShape, Move2DShapePin, Set2DShapeRotation) and
// docs/ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md (Move2DShapePoint, Move2DShapeLHandle,
// Move2DShapeRHandle, Delete2DShapePoint, Key2DShapePoints). Original code written from those prose contracts only.
//
// The shapes are the stand-in classes of fxCoreTasksModel.ts. SetValue / SaveKey sub-tasks are `setValueTask` /
// `saveKeyTask`; keys are kept on the shape (`fxKeys`: parameter key -> time -> value), time being the current frame.
import { App, CommandDef } from '../core/commands';
import { NOTE_F, S_OK, E_INVALIDARG, FxShape, FxShapeList, stateOf, unset, text, fail, setStatus, logNya, isShape, objArg, uniqueName, setValueTask, saveKeyTask, shapeAutoKey } from './fxCoreTasksModel';

const MSG_SHAPE = 'Argument 1 must be a 2D shape';
function shapeArg(app: App, v: any): FxShape { const s = objArg(app, v); if (!isShape(s)) throw fail(E_INVALIDARG, MSG_SHAPE); return s; }
function numArg(C: string, name: string, v: any): number { const n = typeof v === 'number' ? v : unset(v) || typeof v === 'boolean' ? NaN : Number(v); if (!Number.isFinite(n)) throw fail(E_INVALIDARG, `${C}: ${name} is not a number`); return n; }
const now = (app: App) => app.anim.frame;

export function registerFxCoreShapeCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);

  // ---------------------------------------------------------------- shape transform (one class, four commands)
  const TRANSFORM: { name: string; label: string; keys: number[]; args: string[] }[] = [
    { name: 'Move2DShape', label: 'Move2DShape', keys: [3, 4], args: ['x', 'y'] },
    { name: 'Scale2DShape', label: 'Scale2DShape', keys: [5, 6], args: ['x', 'y'] },
    { name: 'Move2DShapePin', label: 'Move2DShapePin', keys: [7, 8], args: ['x', 'y'] },
    { name: 'Set2DShapeRotation', label: 'Rotate2DShape', keys: [9], args: ['angle'] },
  ];
  for (const t of TRANSFORM) reg({
    name: t.name, label: t.label, category: 'FxTree', description: 'Sets transform parameters of a 2D shape to the given (absolute) values.',
    args: [{ name: 'Shape', default: null }, ...t.args.map(n => ({ name: n, default: 0 }))],
    execute(app, a) {
      const shape = shapeArg(app, a.Shape);
      const values = t.args.map(n => numArg(t.name, n, a[n]));
      const autoKey = shapeAutoKey(app); const time = now(app);
      // per value: SetValue, then SaveKey when auto-key is on
      t.keys.forEach((key, i) => { setValueTask(app, shape, key, values[i]); if (autoKey) saveKeyTask(app, shape, key, time, values[i]); });
      setStatus(app, t.name, S_OK);
    },
  });

  // ---------------------------------------------------------------- add / insert point
  const addPoint = (C: string, a: Record<string, any>, position: number) => {
    const shape = shapeArg(app, a.Shape); const x = numArg(C, 'x', a.x), y = numArg(C, 'y', a.y);
    if (position !== -1 && (position < 0 || position > shape.pointCount)) logNya(app, C, `what the shape does with position ${position} outside 0..${shape.pointCount}; the point is appended`, NOTE_F);
    let index = -1;
    // Undo removes the point at the stored index; Redo repeats the add (the stored index is refreshed)
    app.record(C, () => { index = shape.addPoint(x, y, position); }, () => { shape.removePoint(index); });
    setStatus(app, C, S_OK);
    return index + 1; // Value = the index returned by the shape plus 1
  };
  reg({
    name: 'Add2DShapePoint', label: 'Add2DShapePoint', category: 'FxTree', description: 'Appends a point to a 2D shape; returns its index plus 1.',
    args: [{ name: 'Shape', default: null }, { name: 'x', default: 0 }, { name: 'y', default: 0 }],
    execute(_app, a) { return addPoint('Add2DShapePoint', a, -1); },
  });
  reg({
    name: 'Insert2DShapePoint', label: 'Insert2DShapePoint', category: 'FxTree', description: 'Inserts a point into a 2D shape at a position; returns its index plus 1.',
    args: [{ name: 'Shape', default: null }, { name: 'position', default: 0 }, { name: 'x', default: 0 }, { name: 'y', default: 0 }],
    execute(app, a) { const shape = shapeArg(app, a.Shape); return addPoint('Insert2DShapePoint', { ...a, Shape: shape }, Math.trunc(numArg('Insert2DShapePoint', 'position', a.position))); },
  });
  reg({
    name: 'Add2DShapePointArray', label: 'Add2DShapePointArray', category: 'FxTree', description: 'Appends several points (x0, y0, x1, y1, ...) to a 2D shape.',
    args: [{ name: 'Shape', default: null }, { name: 'points', default: null }],
    execute(app, a) {
      const C = 'Add2DShapePointArray'; const shape = shapeArg(app, a.Shape);
      const raw = Array.isArray(a.points) || ArrayBuffer.isView(a.points) ? Array.from(a.points as any) : null;
      if (!raw || !raw.length || raw.length % 2) throw fail(E_INVALIDARG, `${C}: points must be a non-empty array of even length`);
      const flat = raw.map((v, i) => numArg(C, `points[${i}]`, v));
      const first = shape.pointCount; const pairs = flat.length / 2;
      app.record(C, () => { for (let i = 0; i < pairs; i++) shape.addPoint(flat[2 * i], flat[2 * i + 1], -1); },
        () => { for (let i = 0; i < pairs; i++) shape.removePoint(first); }); // each time at the stored first-new-point index
      setStatus(app, C, S_OK); // no output in array mode
    },
  });

  // ---------------------------------------------------------------- Add2DShape
  reg({
    name: 'Add2DShape', label: 'Add2DShape', category: 'FxTree', description: 'Creates a 2D shape (Bezier, BSpline or Polygon) in a shape list, selects it and returns it.',
    args: [{ name: 'ShapeList', default: null }, { name: 'ShapeType', default: '' }],
    execute(app, a) {
      const C = 'Add2DShape'; const list = objArg(app, a.ShapeList);
      if (!(list instanceof FxShapeList)) throw fail(E_INVALIDARG, 'Argument 1 must be a 2D shape list');
      const kind = ['bez', 'bsp', 'pol'].indexOf(text(a.ShapeType).toLowerCase().slice(0, 3)); // only the first three characters are compared
      if (kind < 0) throw fail(E_INVALIDARG, 'Argument 2 must be "Bezier", "BSpline" or "Polygon" ');
      const st = stateOf(app); let shape: FxShape | null = null;
      // Undo deletes the new shape (the selection change is not reverted); Redo runs the Do steps again: a new shape object
      app.record(C, () => {
        const base = kind === 0 ? 'Bezier' : 'PointShape'; // inferred: default names (the property set names)
        shape = new FxShape(uniqueName(list.items.map(s => s.name), base), kind === 0 ? 'bezier' : 'point');
        shape.shapeId = st.nextShapeId++; // inferred: the id is a per-session counter
        if (kind !== 0) shape.set('Type', kind === 1 ? 0 : 2); // 0 Closed BSpline, 2 Closed Polygon (inferred in the note from the SPDL combo)
        list.addItem(shape);
        app.select([shape]); // inferred in the note: the SelectObj task makes the new shape the selection
      }, () => { if (shape) { list.removeItem(shape); app.selection = app.selection.filter(n => n !== shape); } });
      setStatus(app, C, S_OK);
      return shape as FxShape | null;
    },
  });

  // ---------------------------------------------------------------- move point / handles (one class, three commands)
  const COMPONENT: [string, number][] = [['Move2DShapePoint', 0], ['Move2DShapeLHandle', 1], ['Move2DShapeRHandle', 2]];
  for (const [name, component] of COMPONENT) reg({
    name, label: name, category: 'FxTree', description: 'Sets the (absolute) position of a point component of a 2D shape.',
    args: [{ name: 'Shape', default: null }, { name: 'index', default: 0 }, { name: 'x', default: 0 }, { name: 'y', default: 0 }],
    execute(app, a) {
      const shape = shapeArg(app, a.Shape);
      const index = Math.trunc(numArg(name, 'index', a.index)); const x = numArg(name, 'x', a.x), y = numArg(name, 'y', a.y);
      const autoKey = shapeAutoKey(app);
      const ids = shape.pointParamIds(index, component);
      // inferred: the status of the failed shape query (the note says only that the failure is returned)
      if (!ids) throw fail(E_INVALIDARG, `${name}: the shape has no such point component (index ${index})`);
      const time = now(app);
      // order: set x, key x, set y, key y
      setValueTask(app, shape, ids[0], x); if (autoKey) saveKeyTask(app, shape, ids[0], time, x);
      setValueTask(app, shape, ids[1], y); if (autoKey) saveKeyTask(app, shape, ids[1], time, y);
      setStatus(app, name, S_OK);
    },
  });

  // ---------------------------------------------------------------- Delete2DShapePoint
  reg({
    name: 'Delete2DShapePoint', label: 'Delete2DShapePoint', category: 'FxTree', description: 'Removes a point of a 2D shape.',
    args: [{ name: 'Shape', default: null }, { name: 'index', default: 0 }],
    execute(app, a) {
      const C = 'Delete2DShapePoint'; const shape = shapeArg(app, a.Shape);
      const index = Math.trunc(numArg(C, 'index', a.index));
      if (!(index >= 0 && index < shape.pointCount)) throw fail(E_INVALIDARG, `${C}: index ${index} is outside 0..${shape.pointCount - 1}`);
      const record = [...shape.points[index]]; // the raw record (7 or 2 doubles)
      // Undo inserts a point at the index and overwrites its record with the saved one (animation on the point is not handled)
      app.record(C, () => { shape.removePoint(index); }, () => { const i = shape.addPoint(0, 0, index); shape.points[i] = [...record]; });
      setStatus(app, C, S_OK);
    },
  });

  // ---------------------------------------------------------------- Key2DShapePoints
  reg({
    name: 'Key2DShapePoints', label: 'Key2DShapePoints', category: 'FxTree', description: 'Keys points of a 2D shape (all points when no index array is given) at the current time.',
    args: [{ name: 'Shape', default: null }, { name: 'index', default: null }],
    execute(app, a) {
      const C = 'Key2DShapePoints'; const shape = shapeArg(app, a.Shape);
      const arr = Array.isArray(a.index) || ArrayBuffer.isView(a.index) ? Array.from(a.index as any) : null;
      // a non-empty array selects points; missing, scalar or empty: all points
      const indices = arr && arr.length ? arr.map((v, i) => Math.trunc(numArg(C, `index[${i}]`, v)) | 0) : shape.points.map((_, i) => i);
      const time = now(app);
      for (const i of indices) {
        const components = shape.shapeKind === 0 ? [0, 1, 2] : [0]; // kind 0: the handles are keyed too (2 or 6 keys per point)
        if (!shape.pointParamIds(i, 0)) continue; // skipped silently
        for (const c of components) { const ids = shape.pointParamIds(i, c); if (!ids) continue; saveKeyTask(app, shape, ids[0], time); saveKeyTask(app, shape, ids[1], time); }
      }
      setStatus(app, C, S_OK);
    },
  });
}
