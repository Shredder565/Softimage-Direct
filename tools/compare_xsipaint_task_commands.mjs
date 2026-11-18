// CMD-B9a / CMD-B9b / CMD-B9c: the 45 task commands of xsipaint.dll on the command bus (src/commands/xsiPaintTasks.ts,
// xsiPaintTasksShapes.ts, xsiPaintTasksMasks.ts, model in xsiPaintTasksModel.ts). Checked against the "Shared facts" and
// "Contracts" sections of docs/ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md,
// docs/ghidra/cmd-b9b-xsipaint-add-shapes-binary.md and docs/ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md, and
// the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the rows, so this is a contract check: registration with the registry argument list, a
// run with default arguments on the sample scene (a contract-specified failure status is the expected result there),
// and the stated results (return values, list contents, undo / redo behaviour, status codes, log lines for the parts
// the notes leave open). The paint objects are the stand-in model of this build (`Application.xsiPaint`).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_xsipaint_task_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const B9A = ['GetFirstPaintShapeKey', 'GetPrevPaintShapeKey', 'GetClosestPaintShapeKey', 'GetNextPaintShapeKey', 'GetLastPaintShapeKey', 'SetPaintStore', 'SetPaintMergeStore', 'SetPaintMaskStore',
  'RectanglePaintRaster', 'EllipsePaintRaster', 'IncPaintShapePointWeight', 'DecPaintShapePointWeight', 'ClearPaintSelection', 'AddPaintShapePoint', 'InvertPaintStencil'];
const B9B = ['AddColorPaintShape', 'AddFxMaskShape', 'AddFloodFillPaintShape', 'AddAlphaFloodFillPaintShape', 'AddBoundaryFillPaintShape', 'AddBrushStroke', 'ClearImage', 'DeleteAllPaintShapes', 'AddClearImageShape',
  'DeletePaintShapePoints', 'AddRectanglePaintShape', 'AddEllipsePaintShape', 'TranslatePaintShapePoint', 'MovePaintShapeHandle', 'SetPaintShapeHandle'];
const B9C = ['RectangularPaintMask', 'EllipticalPaintMask', 'MagicWandPaintMask', 'AddPaintMaskShape', 'SetPaintColor', 'ResetPaintColor', 'SwapPaintColors', 'SelectPaintShapePoint', 'TogglePaintShapePointSelection',
  'AddToPaintShapePointSelection', 'FloodFillRaster', 'PaintRasterLine', 'ImportMatadorShapeList', 'InsertPaintShapePoint', 'SetPaintBrush'];
const NAMES = [...B9A, ...B9B, ...B9C];
// Registry argument list of a name, without the return value (flag 0x200): [name, default].
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SetPaintBrush') && !!window.Application?.xsiPaint && !!window.Application?.hostFs && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; const S = A.xsiPaint; A.autoInspect = false;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const mark = () => A.log.length;
  const logFrom = (i) => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}:${l.text}`);
  const run = (n, a = {}) => {
    S.lastStatus = null; const m = mark();
    try { const v = A.run(n, a); return { v, st: S.lastStatus?.command === n ? hex(S.lastStatus.status) : null, log: logFrom(m) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status), log: logFrom(m) }; }
  };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const e2 = (r) => [r.status ?? null, r.err ? r.err.replace(/ \(status 0x[0-9a-f]+\)$/, '') : null]; // [status, message]
  const st = (r) => r.err ? `err ${r.status}` : r.st;
  const pos = (s) => s.points.map(p => [p.x, p.y]);
  const full = (s) => s.points.map(p => [p.x, p.y, p.lhx, p.lhy, p.rhx, p.rhy]);
  const sel = (s) => s.points.flatMap((p, i) => p.selected ? [i] : []);
  const items = (l) => l.items.map(i => i.kind === 'simplecommand' ? `cmd${i.Command}:${i.name}` : `${i.cls}:${i.name}`);
  const lit = (r) => { let c = 0; for (let i = 3; i < r.data.length; i += 4) if (r.data[i] !== 0 || r.data[i - 1] !== 0 || r.data[i - 2] !== 0 || r.data[i - 3] !== 0) c++; return c; };
  const wipe = (r) => r.data.fill(0);
  const lastDamage = (op) => op.damage[op.damage.length - 1] ?? null;
  const mkShape = (name, pts, cls = 'ColorShape') => { const s = S.createShape(cls, name); for (const [x, y] of pts) A.run('AddPaintShapePoint', { Shape: s, x, y }); return s; };

  // ---- registration
  out.registered = Object.fromEntries(NAMES.map(n => { const d = A.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));

  // ---- default arguments on the sample scene (no paint store, no paint objects)
  out.defaults = {};
  for (const n of NAMES) { const r = run(n); out.defaults[n] = { status: r.status ?? null, msg: e2(r)[1], st: r.st ?? null, v: r.v === undefined ? '<unset>' : r.v }; }
  out.defaultColours = [S.foreground, S.background];
  A.run('ResetPaintColor');

  // ---- shape keys
  {
    const r = {}; const k = S.createShape('ColorShape', 'keyShape');
    const none = run('GetFirstPaintShapeKey', { Shape: k }); r.noKeys = [none.v, none.st, run('GetClosestPaintShapeKey', { Shape: k, Time: 3 }).v];
    S.addShapeKey(k, 10); S.addShapeKey(k, 5); S.addShapeKey(k, 20);
    const T = (n, t) => { const x = run(n, t === undefined ? { Shape: k } : { Shape: k, Time: t }); return x.err ? e2(x) : x.v?.Time ?? null; };
    r.firstLast = [T('GetFirstPaintShapeKey'), T('GetLastPaintShapeKey'), run('GetLastPaintShapeKey', { Shape: 'keyShape' }).v?.kind];
    r.prev = [10, 5, 3, 10.0000001, 100].map(t => T('GetPrevPaintShapeKey', t));
    r.next = [10, 20, 25, 4, 19.9999999].map(t => T('GetNextPaintShapeKey', t));
    r.closest = [12, 16, 15, 10, 1, 30, 7.4, 7.6].map(t => T('GetClosestPaintShapeKey', t));
    r.omittedTime = [A.anim.frame, T('GetPrevPaintShapeKey'), T('GetNextPaintShapeKey')];
    r.badTime = T('GetNextPaintShapeKey', 'abc');
    const d0 = A.undoStack.length; run('GetFirstPaintShapeKey', { Shape: k }); r.readOnly = A.undoStack.length - d0;
    out.keys = r;
  }

  // ---- paint stores
  const op1 = S.createOperator('paintOp', 32, 32); const op2 = S.createOperator('paintOp2', 32, 32);
  {
    const r = {}; const names = () => S.stores.map(o => o?.name ?? null);
    const a = run('SetPaintStore', { FxOp: op1 }); r.set = [a.err ?? null, a.st, names()];
    run('SetPaintMergeStore', { FxOp: op2 }); r.merge = names();
    A.undo(); r.undoEmptySlot = names(); A.redo(); r.redoMerge = names();
    run('SetPaintStore', { FxOp: op2 }); r.replace = names(); A.undo(); r.undoReplace = names(); A.redo(); r.redoReplace = names(); A.undo();
    run('SetPaintMaskStore', { FxOp: 'paintOp2' }); r.maskByName = names();
    r.wrongKind = e2(run('SetPaintStore', { FxOp: S.createShape('ColorShape', 'notAnOp') }));
    S.stores = [op1, null, null];
    out.stores = r;
  }

  // ---- raster rectangle / ellipse
  {
    const r = {}; const R = op1.raster; wipe(R);
    const d = run('RectanglePaintRaster'); r.defaults = [d.err ?? null, d.st, lit(R)]; const d2 = run('EllipsePaintRaster'); r.defaultsEllipse = [d2.err ?? null, d2.st, lit(R)];
    const a = run('RectanglePaintRaster', { X1: 4, Y1: 4, X2: 8, Y2: 8, FromCenter: false });
    r.rect = [a.err ?? null, a.st, lit(R), lastDamage(op1), R.get(5, 5), R.get(8, 8), nya(a)];
    const n0 = op1.damage.length; A.undo(); r.rectUndo = [lit(R), op1.damage.length - n0, lastDamage(op1)]; A.redo(); r.rectRedo = lit(R); A.undo();
    run('RectanglePaintRaster', { X1: 16, Y1: 16, X2: 18, Y2: 18 }); r.rectCenter = [lit(R), lastDamage(op1)]; A.undo();
    const e = run('EllipsePaintRaster', { X1: 16, Y1: 16, X2: 22, Y2: 20 }); r.ellipse = [e.err ?? null, e.st, lit(R), lastDamage(op1), nya(e)]; A.undo(); r.ellipseUndo = lit(R);
    run('EllipsePaintRaster', { X1: 10, Y1: 12, X2: 22, Y2: 20, FromCenter: false }); r.ellipseCorners = lastDamage(op1); A.undo();
    r.badArg = e2(run('RectanglePaintRaster', { X1: 'x' }));
    r.objects = [...S.objects.keys()].filter(k => /^(Rectangle|Ellipse)/.test(k)); // the temporary shape is never added anywhere
    out.raster = r;
  }

  // ---- AddPaintShapePoint, selection, weights
  {
    const r = {}; const w = S.createShape('ColorShape', 'wShape');
    const v = [0, 10, 20].map(x => run('AddPaintShapePoint', { Shape: w, x, y: 1 }));
    r.append = [v.map(x => x.v), v[0].st, pos(w), w.subShapes];
    const ins = run('AddPaintShapePoint', { Shape: 'wShape', InsertPosition: 1, x: 5, y: 2, lhx: -1, lhy: -2, rhx: 1, rhy: 2 }); r.insert = [ins.v, full(w)[1], pos(w).map(p => p[0])];
    r.beyond = [run('AddPaintShapePoint', { Shape: w, InsertPosition: 99, x: 30 }).v, w.points.length];
    A.undo(); r.undoKeepsPoint = w.points.length; A.redo(); r.redoAddsAgain = [w.points.length, pos(w).map(p => p[0])];
    const key = S.addShapeKey(w, 3); run('AddPaintShapePoint', { Shape: w, InsertPosition: 0, x: -5 }); r.intoKeys = [key.points.length, key.points[0].x, w.points.length]; w.keys.length = 0;
    r.subShapeShift = (() => { const s = S.createShape('ColorShape', 'subs'); for (let i = 0; i < 4; i++) A.run('AddPaintShapePoint', { Shape: s, x: i }); s.subShapes = [0, 2]; A.run('AddPaintShapePoint', { Shape: s, InsertPosition: 1, x: 9 }); const a = [...s.subShapes]; A.run('AddPaintShapePoint', { Shape: s, x: 9 }); return [a, s.subShapes]; })();
    r.badArg = e2(run('AddPaintShapePoint', { Shape: w, x: 'abc' }));
    out.addPoint = r;

    const q = {}; const s = mkShape('selShape', [[0, 0], [1, 0], [2, 0], [3, 0]]);
    const a = run('SelectPaintShapePoint', { Shape: s, Indices: [0, 2] }); q.select = [a.err ?? null, a.st, a.v === undefined, sel(s)];
    run('AddToPaintShapePointSelection', { Shape: s, Indices: [3] }); q.addTo = sel(s);
    run('TogglePaintShapePointSelection', { Shape: 'selShape', Indices: [0, 1] }); q.toggle = sel(s);
    A.undo(); q.undoToggle = sel(s); A.redo(); q.redoToggle = sel(s);
    const na = run('SelectPaintShapePoint', { Shape: s, Indices: 5 }); q.notArray = [na.err ?? null, sel(s)]; A.undo(); q.undoSelect = sel(s);
    run('AddToPaintShapePointSelection', { Shape: s, Indices: [0, 42, -1] }); q.outOfRange = sel(s); A.undo();
    q.badElement = e2(run('SelectPaintShapePoint', { Shape: s, Indices: ['x'] }))[0];
    out.select = q;

    const g = {}; const W = () => s.points.map(p => p.weight); // selection is [1, 2, 3]
    g.start = [sel(s), W()];
    const i1 = run('IncPaintShapePointWeight', { Shape: s }); g.inc = [i1.err ?? null, i1.st, W()];
    run('IncPaintShapePointWeight', { Shape: s }); run('IncPaintShapePointWeight', { Shape: s }); g.incCap = W();
    run('DecPaintShapePointWeight', { Shape: 'selShape' }); g.dec = W(); A.undo(); g.decUndo = W(); A.redo(); g.decRedo = W();
    run('DecPaintShapePointWeight', { Shape: s }); run('DecPaintShapePointWeight', { Shape: s }); run('DecPaintShapePointWeight', { Shape: s }); g.decFloor = W();
    A.run('SelectPaintShapePoint', { Shape: s, Indices: [] }); const em = run('IncPaintShapePointWeight', { Shape: s }); g.emptySelection = [em.err ?? null, em.st, W()];
    out.weights = g;
  }

  // ---- DeletePaintShapePoints / TranslatePaintShapePoint
  {
    const r = {}; const d = mkShape('delShape', [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]]); const xs = () => d.points.map(p => p.x);
    A.run('SelectPaintShapePoint', { Shape: d, Indices: [1, 3] });
    const a = run('DeletePaintShapePoints', { Shape: d }); r.selected = [a.err ?? null, a.st, a.v === undefined, xs(), sel(d)];
    A.undo(); r.undo = [xs(), sel(d)]; A.redo(); r.redo = [xs(), sel(d)];
    run('DeletePaintShapePoints', { Shape: 'delShape', index: 0 }); r.single = xs();
    run('DeletePaintShapePoints', { Shape: d, index: [0, 1] }); r.array = xs();
    r.emptyArray = e2(run('DeletePaintShapePoints', { Shape: d, index: [] }));
    out.del = r;

    const t = {}; const s = mkShape('trShape', [[0, 0], [10, 0], [20, 0]]); A.run('SelectPaintShapePoint', { Shape: s, Indices: [0, 2] });
    const m = run('TranslatePaintShapePoint', { Shape: s, x: 5, y: -2 }); t.move = [m.err ?? null, m.st, pos(s)];
    A.undo(); t.undo = pos(s); A.redo(); t.redo = pos(s);
    run('TranslatePaintShapePoint', { Shape: s, x: 1, y: 1, Delta: ':siAbsolute:siDeltaMode' }); t.absoluteIsRelative = pos(s);
    t.badScalar = e2(run('TranslatePaintShapePoint', { Shape: s, x: 'q' }))[0];
    out.translate = t;
  }

  // ---- Add family and list preparation
  {
    const r = {}; const L = S.createShapeList(0, 'listA');
    const a = run('AddColorPaintShape', { ShapeList: L }); r.first = [a.err ?? null, a.st, a.v?.cls, a.v?.tag, a.v?.list === L, items(L)];
    const b = run('AddColorPaintShape', { ShapeList: 'listA' }); r.second = [items(L).map(x => x.split(':')[0]), b.v === L.items[2], b.v?.tag];
    A.undo(); r.undo = items(L).map(x => x.split(':')[0]);
    A.redo(); r.redo = [items(L).map(x => x.split(':')[0]), L.items[2] !== b.v];
    A.undo(); r.undoAfterRedo = L.items.length; // the references are those of the first run only
    const L2 = S.createShapeList(0, 'listB'); const f = run('AddFloodFillPaintShape', { ShapeList: L2, SeedX: 3, SeedY: 4 }); r.flood = [f.err ?? null, f.v?.cls, pos(f.v), nya(f)];
    const al = run('AddAlphaFloodFillPaintShape', { ShapeList: S.createShapeList(0), SeedX: 1, SeedY: 2 }); r.alpha = [al.err ?? null, al.v?.cls, pos(al.v), nya(al)];
    const bo = run('AddBoundaryFillPaintShape', { ShapeList: S.createShapeList(0) }); r.boundary = [bo.err ?? null, bo.v?.cls, pos(bo.v), nya(bo)];
    const Lm = S.createShapeList(1, 'maskList');
    const m0 = run('AddFxMaskShape', { ShapeList: L2 }), m1 = run('AddFxMaskShape', { ShapeList: Lm }); r.fxMask = [e2(m0), e2(m1)[0], /must be/.test(m1.err ?? ''), nya(m0), Lm.items.length];
    const k1 = run('AddColorPaintShape', { ShapeList: Lm }); r.colorOnMaskList = [e2(k1)[0], /must be/.test(k1.err ?? '')];
    r.notAList = [e2(run('AddColorPaintShape', { ShapeList: op1 })), e2(run('AddFloodFillPaintShape', { ShapeList: L2, SeedX: 'x' }))];
    // list preparation, case B: a list whose last item is a Clear Stencil command gets no second one
    const Lc = S.createShapeList(0, 'listC'); run('AddColorPaintShape', { ShapeList: Lc }); Lc.append(S.createSimpleCommand(0, 'cs')); run('AddColorPaintShape', { ShapeList: Lc }); r.afterClearStencil = items(Lc).map(x => x.split(':')[0]);
    out.add = r;

    const g = {}; const G = S.createShapeList(0, 'geomList');
    const rc = run('AddRectanglePaintShape', { ShapeList: G, X1: 10, Y1: 10, X2: 14, Y2: 12 }); g.rectCenter = [rc.err ?? null, rc.st, rc.v?.cls, rc.v?.name, full(rc.v), rc.v?.curveType, rc.v?.closed, rc.v?.list === G];
    const rk = run('AddRectanglePaintShape', { ShapeList: G, X1: 1, Y1: 2, X2: 5, Y2: 6, FromCenter: false }); g.rectCorners = [pos(rk.v), items(G).map(x => x.split(':')[0])];
    A.undo(); g.rectUndo = items(G).map(x => x.split(':')[0]);
    const G2 = S.createShapeList(0, 'geomList2');
    const el = run('AddEllipsePaintShape', { ShapeList: G2, X1: 0, Y1: 0, X2: 20, Y2: 10, FromCenter: false }); g.ellipseCorners = [el.err ?? null, el.v?.name, full(el.v), el.v?.curveType, el.v?.closed];
    const ec = run('AddEllipsePaintShape', { ShapeList: S.createShapeList(0), X1: 10, Y1: 5, X2: 0, Y2: 0 }); g.ellipseCenter = pos(ec.v);
    const dflt = run('AddRectanglePaintShape', { ShapeList: S.createShapeList(0) }); g.defaultsWithList = [dflt.err ?? null, pos(dflt.v)];
    g.bad = [e2(run('AddEllipsePaintShape', { ShapeList: G2, X1: 'x' }))[0], e2(run('AddRectanglePaintShape', { ShapeList: 'nope' }))[0]];
    out.geom = g;
    out.ellipseShape = el.v?.name;
  }

  // ---- handles
  {
    const r = {}; const E = S.objects.get(out.ellipseShape); const h = (i) => { const p = E.points[i]; return [p.lhx, p.lhy, p.rhx, p.rhy]; };
    const before = h(1);
    const m = run('MovePaintShapeHandle', { Shape: E, Point: 1, Handle: 2, x: 3, y: 4, Mode: 0 }); r.move = [m.err ?? null, m.st, m.v === undefined, h(1).slice(2), JSON.stringify(h(1).slice(0, 2)) === JSON.stringify(before.slice(0, 2)), nya(m)];
    A.undo(); r.moveUndo = JSON.stringify(h(1)) === JSON.stringify(before); A.redo(); r.moveRedo = h(1).slice(2); A.undo();
    run('MovePaintShapeHandle', { Shape: E.name, Point: 0, Handle: 1, x: -7, y: 1, Mode: 3 }); r.moveLeft = h(0).slice(0, 2); A.undo();
    r.errors = [run('MovePaintShapeHandle', { Shape: E }), run('MovePaintShapeHandle', { Shape: E, Handle: 3 }), run('MovePaintShapeHandle', { Shape: E, Handle: 1, Mode: 4 }), run('MovePaintShapeHandle', { Shape: E, Handle: 1, Point: 4 }),
      run('MovePaintShapeHandle', { Shape: E, Handle: 1, Point: -1 }), run('MovePaintShapeHandle', { Shape: E, Handle: 2, x: 'q' })].map(e2);
    const rect = A.run('AddRectanglePaintShape', { ShapeList: S.createShapeList(0), X2: 2, Y2: 2 });
    r.notBezier = [e2(run('MovePaintShapeHandle', { Shape: rect, Handle: 1 })), e2(run('SetPaintShapeHandle', { Shape: rect }))];
    const s = run('SetPaintShapeHandle', { Shape: E, Point: 2, lhx: 1, lhy: 2, lrx: 3, lry: 4 }); r.set = [s.err ?? null, s.st, h(2)];
    A.undo(); r.setUndo = h(2); A.redo(); r.setRedo = h(2);
    r.setRange = e2(run('SetPaintShapeHandle', { Shape: E, Point: 4 }));
    out.handles = r;
  }

  // ---- DeleteAllPaintShapes / AddClearImageShape / ClearImage
  {
    const r = {}; const kinds = (l) => items(l).map(x => x.split(':')[0]);
    const L = S.createShapeList(0, 'delAll'); L.append(S.createShape('ColorShape', 'da1')); L.append(S.createShape('StrokeShape', 'da2'));
    const a = run('DeleteAllPaintShapes', { ShapeList: L }); r.deleteAll = [a.err ?? null, a.st, a.v === undefined, L.items.length, S.objects.has('da1')];
    A.undo(); r.undo = items(L); A.redo(); r.redo = L.items.length;
    const e = run('DeleteAllPaintShapes', { ShapeList: 'delAll' }); r.empty = [e.err ?? null, e.st];
    const W = S.createShapeList(0, 'wipeList'); W.append(S.createShape('ColorShape', 'w1')); W.append(S.createShape('ColorShape', 'w2'));
    const c = run('AddClearImageShape', { ShapeList: W }); r.clearShape = [c.err ?? null, c.st, c.v?.cls, c.v?.tag, kinds(W)];
    A.undo(); r.clearShapeUndo = items(W); A.redo(); r.clearShapeRedo = kinds(W); A.undo();
    const W2 = S.createShapeList(0, 'wipeKeep'); W2.append(S.createShape('ColorShape', 'k1')); W2.append(S.createShape('ColorShape', 'k2'));
    S.toolSettings.flag48 = true; run('AddClearImageShape', { ShapeList: W2 }); r.keepFlag = kinds(W2); S.toolSettings.flag48 = false;
    const Mk = S.createShapeList(1, 'wipeMask'); const t1 = S.createShape('SelShape', 'm1'); t1.tag = 3; const t2 = S.createShape('SelShape', 'm2'); t2.tag = 4; Mk.append(t1); Mk.append(t2);
    const k = run('AddClearImageShape', { ShapeList: Mk }); r.otherKind = [kinds(Mk), k.v?.tag];
    out.wipe = r;

    const q = {}; const R = op1.raster; wipe(R); A.run('RectanglePaintRaster', { X1: 4, Y1: 4, X2: 8, Y2: 8, FromCenter: false }); const n = lit(R);
    const ci = run('ClearImage'); q.clear = [ci.err ?? null, ci.st, n, lit(R), lastDamage(op1), nya(ci)];
    A.undo(); q.undo = lit(R); A.redo(); q.redo = lit(R); A.undo(); A.undo();
    out.clearImage = q;
  }

  // ---- AddBrushStroke
  {
    const r = {}; const kinds = (l) => items(l).map(x => x.split(':')[0]);
    const P = S.createShapeList(0, 'strokesPaint');
    const a = run('AddBrushStroke', { ShapeList: P, Points: [0, 0, 5, 5] }); const sa = a.v?.Value;
    r.created = [a.err ?? null, a.st, Object.keys(a.v ?? {}).filter(k => !/^\d+$/.test(k)), a.v?.index, sa?.cls, sa?.brushId, sa?.tag, pos(sa), sa?.strokes, a.v?.[0] === a.v?.index, a.v?.[1] === sa];
    run('AddBrushStroke', { ShapeList: P, Points: [1, 1, 2, 2] }); r.paintList = kinds(P);
    const Mk = S.createShapeList(1, 'strokesMask');
    const b = run('AddBrushStroke', { ShapeList: Mk, Points: [0, 0, 5, 5], Pressure: 0.5 }); const sb = b.v?.Value;
    const c = run('AddBrushStroke', { ShapeList: 'strokesMask', Points: new Float32Array([1, 1, 2, 2, 3, 3]), Pressure: [0.25, 0.5, 0.75] });
    r.reused = [c.err ?? null, c.v?.Value === sb, c.v?.index, kinds(Mk), sb?.points.length, sb?.strokes];
    A.undo(); r.undoReused = [kinds(Mk), sb?.points.length, sb?.strokes.length]; A.redo(); r.redoReused = [sb?.points.length, sb?.strokes.length]; A.undo();
    A.undo(); r.undoCreated = Mk.items.length; A.redo(); r.redoCreated = [kinds(Mk), Mk.items[0] !== sb];
    A.run('SetPaintColor', { Red: 1 }); run('AddBrushStroke', { ShapeList: Mk, Points: [9, 9, 8, 8] }); r.colourChanged = kinds(Mk); A.run('ResetPaintColor');
    r.errors = [run('AddBrushStroke', { ShapeList: Mk }), run('AddBrushStroke', { ShapeList: Mk, Points: [1, 2, 3] }), run('AddBrushStroke', { ShapeList: Mk, Points: [] }), run('AddBrushStroke', { ShapeList: Mk, Points: [1, 2], Pressure: [1, 1] }),
      run('AddBrushStroke', { ShapeList: Mk, Points: 'x' }), run('AddBrushStroke', { ShapeList: op1, Points: [1, 2] })].map(e2);
    out.stroke = r;
  }

  // ---- paint masks, ClearPaintSelection, InvertPaintStencil
  {
    const r = {}; const opM = S.createOperator('maskOp', 32, 32); S.stores = [opM, null, null]; const F = opM.clip.listAt(A.anim.frame); const kinds = () => items(F);
    F.append(S.createShape('ColorShape', 'paintStays'));
    const e0 = run('ClearPaintSelection'); r.nothingToClear = [e0.err ?? null, e0.st];
    const a = run('RectangularPaintMask', { X1: 2, Y1: 2, X2: 6, Y2: 4 }); const ra = a.v;
    r.rect = [a.err ?? null, a.st, ra?.cls, ra?.name, full(ra), ra?.mask, ra?.list === F, kinds()];
    const b = run('EllipticalPaintMask', { X1: 10, Y1: 10, X2: 14, Y2: 12 }); r.ellipseReplaces = [b.v?.name, pos(b.v), b.v?.mask, kinds()];
    A.undo(); r.ellipseUndo = kinds(); A.redo(); r.ellipseRedo = [kinds(), F.items[1] !== b.v];
    const c = run('RectangularPaintMask', { X1: 0, Y1: 0, X2: 2, Y2: 2, FromCenter: true, SelectionAction: 1, AntiAliased: true, Feather: 3 }); r.rectAdd = [pos(c.v), c.v?.mask, kinds()];
    const w = run('MagicWandPaintMask', { SeedX: 5, SeedY: 6, SelectionAction: 2 }); r.wand = [w.err ?? null, w.v?.cls, w.v?.name, pos(w.v), w.v?.mask, F.items.length];
    const l = run('AddPaintMaskShape', { SelectionAction: 3, AntiAliased: false }); r.lasso = [l.err ?? null, l.v?.cls, l.v?.name, l.v?.points.length, l.v?.mask, F.items.length];
    const i = run('InvertPaintStencil'); const inv = F.items[F.items.length - 1]; r.invert = [i.err ?? null, i.st, i.v === undefined, inv?.kind, inv?.name, inv?.Command, F.items.length];
    A.undo(); r.invertUndo = F.items.length; A.redo(); r.invertRedo = [F.items.length, F.items[F.items.length - 1]?.Command, F.items[F.items.length - 1] !== inv];
    const all = kinds();
    const cl = run('ClearPaintSelection'); r.clear = [cl.err ?? null, cl.st, cl.v === undefined, kinds()];
    A.undo(); r.clearUndo = JSON.stringify(kinds()) === JSON.stringify(all); A.redo(); r.clearRedo = kinds();
    A.undo();
    const cm = run('AddPaintMaskShape', { SelectionAction: 7 }); r.clamped = [cm.v?.mask?.SelectionAction, kinds()]; A.undo();
    const cn = run('AddPaintMaskShape', { SelectionAction: -1 }); r.negative = [cn.v?.mask?.SelectionAction, F.items.length]; A.undo();
    r.restoredAfterUndo = JSON.stringify(kinds()) === JSON.stringify(all);
    r.badArg = [e2(run('RectangularPaintMask', { X1: 'x' }))[0], e2(run('MagicWandPaintMask', { SeedY: 'x' }))[0], e2(run('AddPaintMaskShape', { Feather: 'x' }))[0]];
    S.stores = [new (opM.constructor)('noClip', null, null), null, null]; r.noClip = [e2(run('AddPaintMaskShape', { SelectionAction: 1 }))[0], e2(run('InvertPaintStencil'))[0], e2(run('ClearPaintSelection'))[0]];
    S.stores = [op1, null, null];
    out.masks = r;
  }

  // ---- colours and brush
  {
    const r = {}; const n0 = S.notifications.length; const C = () => [[...S.foreground], [...S.background]];
    const a = run('ResetPaintColor'); r.reset = [a.err ?? null, a.st, C()];
    const b = run('SetPaintColor', { Red: 0.25, Green: 0.5, Blue: 0.75, Alpha: 2 }); r.set = [b.err ?? null, b.st, b.v === undefined, C()];
    A.undo(); r.setUndo = C(); A.redo(); r.setRedo = C();
    const c = run('SwapPaintColors'); r.swap = [c.err ?? null, c.st, C()]; A.undo(); r.swapUndo = C(); A.redo();
    run('ResetPaintColor'); r.reset2 = C(); A.undo(); r.resetUndo = C();
    r.notifications = [S.notifications.length - n0, [...new Set(S.notifications)]];
    A.run('ResetPaintColor');
    S.brushes.set('Big', { id: 2, radius: 4 });
    const d = run('SetPaintBrush', { Brush: 'Big' }); r.brush = [d.err ?? null, d.st, S.currentBrush];
    A.undo(); r.brushUndo = S.currentBrush; S.lastStatus = null; A.redo(); r.brushRedo = [S.currentBrush, S.lastStatus?.status];
    const u = run('SetPaintBrush', { Brush: 'NoSuchBrush' }); r.unknown = [e2(u)[0], S.currentBrush];
    A.run('SetPaintBrush', { Brush: 'Default' }); r.back = S.currentBrush;
    out.colours = r;
  }

  // ---- PaintRasterLine / FloodFillRaster
  {
    const r = {}; const R = op1.raster; wipe(R);
    const a = run('PaintRasterLine', { x1: 10, y1: 10, p1: 1, x2: 20, y2: 10, p2: 1 }); r.line = [a.err ?? null, a.st, a.v === undefined, lit(R) > 0, lastDamage(op1), R.get(15, 10), R.get(15, 20), nya(a)];
    const n = lit(R); A.undo(); r.lineUndo = lit(R); A.redo(); r.lineRedo = lit(R) === n; A.undo();
    r.outside = e2(run('PaintRasterLine', { x1: 100, y1: 100, x2: 110, y2: 110 }))[0]; r.badArg = e2(run('PaintRasterLine', { p2: 'x' }))[0];
    const d = run('PaintRasterLine'); r.defaultsWithStore = [d.err ?? null, d.st, lit(R) > 0]; A.undo();
    const f = run('FloodFillRaster', { xSeed: 5, ySeed: 5 }); r.fillAll = [f.err ?? null, f.st, f.v === undefined, lit(R), lastDamage(op1), nya(f)];
    A.undo(); r.fillUndo = lit(R); A.redo(); r.fillRedo = lit(R); A.undo();
    A.run('RectanglePaintRaster', { X1: 4, Y1: 4, X2: 8, Y2: 8, FromCenter: false }); A.run('SetPaintColor', { Red: 1, Alpha: 1 });
    run('FloodFillRaster', { xSeed: 5.5, ySeed: 5.5 }); let red = 0; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const c = R.get(x, y); if (c[0] === 1 && c[1] === 0 && c[3] === 1) red++; }
    r.region = [red, lit(R), lastDamage(op1)]; A.undo(); A.undo(); A.undo();
    r.cleanAfterUndo = lit(R);
    r.seedOutside = e2(run('FloodFillRaster', { xSeed: -5, ySeed: -5 }))[0]; r.fillBadArg = e2(run('FloodFillRaster', { xSeed: 'x' }))[0];
    out.rasterC = r;
  }

  // ---- InsertPaintShapePoint
  {
    const r = {}; const rect = A.run('AddRectanglePaintShape', { ShapeList: S.createShapeList(0), X1: 0, Y1: 0, X2: 10, Y2: 4, FromCenter: false });
    const a = run('InsertPaintShapePoint', { Shape: rect, InsertPosition: 0.5 }); r.insert = [a.err ?? null, a.st, a.v, pos(rect), nya(a)];
    A.undo(); r.undo = pos(rect).length; A.redo(); r.redo = pos(rect).length; A.undo();
    const b = run('InsertPaintShapePoint', { Shape: rect.name, InsertPosition: 3.25 }); r.closing = [b.v, pos(rect)[4]]; A.undo();
    const c = run('InsertPaintShapePoint', { Shape: rect, Contour: 5 }); r.noContour = [c.err ?? null, c.v, pos(rect).length];
    r.badArg = e2(run('InsertPaintShapePoint', { Shape: rect, InsertPosition: 'x' }));
    out.insert = r;
  }

  // ---- ImportMatadorShapeList
  {
    const r = {}; const fsx = A.hostFs; fsx.ensureFolder('C:\\paint'); const P = (n) => 'C:\\paint\\' + n;
    fsx.writeFile(P('v6.sl'), '-6\n100 50\n1\n2 1\n10 20 1 0.5 0.25 -0.5 -0.25 1 0 0\n30 40 5 0 0 0 0 0 1 0\n0\n');
    fsx.writeFile(P('anim.sl'), '2302941 Matador animated shape list\n-7\n100 100\n3\n2\n1\n1\n1 3\n1 1 2 0 0 0 0 1 1 1\n0\n5\n1\n1 3\n2 2 2 0 0 0 0 1 1 1\n0\n');
    fsx.writeFile(P('v2.sl'), '-2\n1\n1 4\n5 6 2 255 0 51\n0\n');
    fsx.writeFile(P('v1.sl'), '-1\n1\n1 5\n5 6 9.5 3\n0\n');
    fsx.writeFile(P('v8.sl'), '-8\n10 10\n1\n1\n1 3\n7\nMy Shape\n1 2 1 0 0 0 0 0.5 0.5 0.5\n0\n');
    fsx.writeFile(P('text.sl'), 'hello\n'); fsx.writeFile(P('badcode.sl'), '-6\n10 10\n2\n1 1\n1 2 1 0 0 0 0 1 1 1\n1 9\n'); fsx.writeFile(P('short.sl'), '-6\n10 10\n1\n2 1\n1 2 1 0 0 0 0 1 1 1\n');
    const L = S.createShapeList(0, 'matador');
    const a = run('ImportMatadorShapeList', { ShapeList: L, FileName: P('v6.sl'), DestWidth: 200, DestHeight: 100 }); const s = L.items[0];
    r.v6 = [a.err ?? null, a.st, a.v === undefined, L.items.length, s?.cls, s && full(s), s?.points.map(p => [p.type, p.color]), s?.shapeType, s?.keys.length, nya(a)];
    const n0 = L.items.length; A.undo(); r.undoStub = L.items.length - n0; const m = A.log.length; A.redo(); r.redo = [L.items.length - n0, A.log.slice(m).some(l => /not yet attested/.test(l.text))];
    const L1 = S.createShapeList(0); run('ImportMatadorShapeList', { ShapeList: L1, FileName: P('v6.sl') }); r.noScale = pos(L1.items[0]);
    const L1b = S.createShapeList(0); run('ImportMatadorShapeList', { ShapeList: L1b, FileName: P('v6.sl'), DestWidth: 200 }); r.oneDestOnly = pos(L1b.items[0]);
    const L2 = S.createShapeList(0, 'matadorAnim'); const b = run('ImportMatadorShapeList', { ShapeList: 'matadorAnim', FileName: P('anim.sl') }); const s2 = L2.items[0];
    r.animated = [b.err ?? null, L2.items.length, s2?.shapeType, s2?.keys.map(k => [k.Time, k.points.map(p => [p.x, p.y])]), s2 && pos(s2)];
    r.keyNavigation = [A.run('GetFirstPaintShapeKey', { Shape: s2 })?.Time, A.run('GetNextPaintShapeKey', { Shape: s2, Time: 1 })?.Time];
    const L3 = S.createShapeList(0); const c = run('ImportMatadorShapeList', { ShapeList: L3, FileName: P('v2.sl') }); r.v2 = [c.err ?? null, L3.items[0]?.shapeType, L3.items[0]?.points.map(p => [p.x, p.y, p.type, p.color])];
    const L4 = S.createShapeList(0); const d = run('ImportMatadorShapeList', { ShapeList: L4, FileName: P('v1.sl') }); r.v1 = [d.err ?? null, L4.items[0]?.shapeType, L4.items[0]?.points.map(p => [p.x, p.y, p.type, p.color])];
    const L5 = S.createShapeList(0); const e = run('ImportMatadorShapeList', { ShapeList: L5, FileName: P('v8.sl') }); r.v8 = [e.err ?? null, L5.items[0]?.shapeType, pos(L5.items[0] ?? { points: [] }), L5.items[0]?.name === 'My Shape'];
    const L6 = S.createShapeList(0);
    r.errors = [run('ImportMatadorShapeList', { ShapeList: L6, FileName: P('missing.sl') }), run('ImportMatadorShapeList', { ShapeList: L6, FileName: P('text.sl') }), run('ImportMatadorShapeList', { ShapeList: L6, FileName: P('short.sl') }),
      run('ImportMatadorShapeList', { ShapeList: L6 }), run('ImportMatadorShapeList', { ShapeList: op1, FileName: P('v6.sl') })].map(e2);
    r.afterErrors = L6.items.length;
    const L7 = S.createShapeList(0); const g = run('ImportMatadorShapeList', { ShapeList: L7, FileName: P('badcode.sl') }); r.partial = [e2(g), L7.items.length];
    r.badDest = e2(run('ImportMatadorShapeList', { ShapeList: L7, FileName: P('v6.sl'), DestWidth: 'x' }))[0];
    out.matador = r;
  }
  return out;
}, { NAMES });
await browser.close();

// ------------------------------------------------------------------ checks
let checks = 0; const fails = [];
const eq = (label, g, want) => { checks++; const ok = JSON.stringify(g) === JSON.stringify(want); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${JSON.stringify(want)}\n       got  ${JSON.stringify(g)}`); } };
const S_NOTHING = '562e8005', E_FAIL = '80004005', E_INVALIDARG = '80070057', E_NOTFOUND = '80030002';
const MSG_SHAPE = 'Argument 1 must be a 2D paint shape', MSG_LIST = 'Argument 1 must be a paint shape list', MSG_FXOP = 'Argument 1 must be an fxtree operator';
const MSG_STROKE = 'Argument 1 must be a 2D paint shape list', MSG_BEZIER = 'Argument 1 must be a 2D bezier paint shape';
const f = Math.fround, K = 0.551915;

// 1. registration
for (const n of NAMES) eq(`${n}: registered with the registry argument list (names, defaults; return value left out)`, got.registered[n], registry[n]);

// 2. default arguments on the sample scene: no paint store and no object arguments
const D = got.defaults;
const dflt = (names, status, msg, why) => { for (const n of names) eq(`${n} defaults: ${why}`, [D[n].status, msg === undefined ? null : D[n].msg], [status, msg === undefined ? null : msg]); };
dflt(['GetFirstPaintShapeKey', 'GetPrevPaintShapeKey', 'GetClosestPaintShapeKey', 'GetNextPaintShapeKey', 'GetLastPaintShapeKey', 'IncPaintShapePointWeight', 'DecPaintShapePointWeight', 'AddPaintShapePoint', 'DeletePaintShapePoints',
  'TranslatePaintShapePoint', 'SelectPaintShapePoint', 'TogglePaintShapePointSelection', 'AddToPaintShapePointSelection', 'InsertPaintShapePoint'], E_INVALIDARG, MSG_SHAPE, 'no Shape, 0x80070057 with the paint shape message');
dflt(['SetPaintStore', 'SetPaintMergeStore', 'SetPaintMaskStore'], E_INVALIDARG, MSG_FXOP, 'no FxOp, 0x80070057 with the fxtree operator message');
dflt(['AddColorPaintShape', 'AddFxMaskShape', 'AddFloodFillPaintShape', 'AddAlphaFloodFillPaintShape', 'AddBoundaryFillPaintShape', 'ImportMatadorShapeList'], E_INVALIDARG, MSG_LIST, 'no ShapeList, 0x80070057 with the paint shape list message');
dflt(['AddBrushStroke'], E_INVALIDARG, MSG_STROKE, 'no ShapeList, 0x80070057 with the 2D paint shape list message');
dflt(['MovePaintShapeHandle', 'SetPaintShapeHandle'], E_INVALIDARG, MSG_BEZIER, 'no Shape, 0x80070057 with the bezier paint shape message');
dflt(['DeleteAllPaintShapes', 'AddClearImageShape', 'AddRectanglePaintShape', 'AddEllipsePaintShape'], E_INVALIDARG, undefined, 'no ShapeList, 0x80070057 (no message)');
dflt(['RectanglePaintRaster', 'EllipsePaintRaster', 'ClearImage', 'FloodFillRaster', 'PaintRasterLine'], E_FAIL, undefined, 'no paint store / raster, 0x80004005');
dflt(['ClearPaintSelection', 'InvertPaintStencil'], E_FAIL, undefined, 'no current paint frame, 0x80004005');
dflt(['RectangularPaintMask', 'EllipticalPaintMask', 'MagicWandPaintMask', 'AddPaintMaskShape'], E_FAIL, undefined, 'SelectionAction 0 runs ClearPaintSelection first, which fails without a paint frame: 0x80004005');
dflt(['SetPaintBrush'], E_FAIL, undefined, 'empty brush name, 0x80004005');
eq('SetPaintColor / ResetPaintColor / SwapPaintColors defaults: succeed (status 0), no return value', ['SetPaintColor', 'ResetPaintColor', 'SwapPaintColors'].map(n => [D[n].status, D[n].st, D[n].v]), Array(3).fill([null, '0', '<unset>']));
eq('colour defaults in sequence: set (0, 0, 0, 0), reset, swap -> foreground (0, 0, 0, 0), background (1, 1, 1, 1)', got.defaultColours, [[0, 0, 0, 0], [1, 1, 1, 1]]);

// 3. shape keys
const Ky = got.keys;
eq('GetFirstPaintShapeKey / GetClosestPaintShapeKey without keys: null object, Do status 1', Ky.noKeys, [null, '1', null]);
eq('GetFirst / GetLastPaintShapeKey: keys sorted by time (10, 5, 20 -> 5 and 20); the Shape may be given by name', Ky.firstLast, [5, 20, 'FxPaintShapeKey']);
eq('GetPrevPaintShapeKey (10, 5, 3, 10.0000001, 100): last key earlier than Time - 1e-6, else the first key', Ky.prev, [5, 5, 5, 5, 20]);
eq('GetNextPaintShapeKey (10, 20, 25, 4, 19.9999999): first key later than Time + 1e-6, else the last key', Ky.next, [20, 20, 20, 5, 20]);
eq('GetClosestPaintShapeKey (12, 16, 15, 10, 1, 30, 7.4, 7.6): nearer of the two candidates, the later one on a tie', Ky.closest, [10, 20, 20, 10, 5, 20, 5, 10]);
eq('Get Prev / Next without Time: the current time is used (inferred)', Ky.omittedTime, [1, 5, 5]);
eq('GetNextPaintShapeKey with an unreadable Time: 0x80070057 with the paint shape message', Ky.badTime, [E_INVALIDARG, MSG_SHAPE]);
eq('shape key commands are read-only (no undo entry)', Ky.readOnly, 0);

// 4. paint stores
const St = got.stores;
eq('SetPaintStore: slot 0', St.set, [null, '0', ['paintOp', null, null]]);
eq('SetPaintMergeStore: slot 1', St.merge, ['paintOp', 'paintOp2', null]);
eq('SetPaintMergeStore undo: a slot that was empty before is left as the command set it; redo sets it again', [St.undoEmptySlot, St.redoMerge], [['paintOp', 'paintOp2', null], ['paintOp', 'paintOp2', null]]);
eq('SetPaintStore over an occupied slot: undo puts the previous occupant back, redo sets it again', [St.replace, St.undoReplace, St.redoReplace], [['paintOp2', 'paintOp2', null], ['paintOp', 'paintOp2', null], ['paintOp2', 'paintOp2', null]]);
eq('SetPaintMaskStore: slot 2 (operator given by name)', St.maskByName, ['paintOp', 'paintOp2', 'paintOp2']);
eq('SetPaintStore with an object that is not an fxtree operator: 0x80070057 with the message', St.wrongKind, [E_INVALIDARG, MSG_FXOP]);

// 5. raster rectangle / ellipse
const Ra = got.raster; const white = [1, 1, 1, 1], clear = [0, 0, 0, 0];
eq('RectanglePaintRaster / EllipsePaintRaster defaults with a paint store: nothing drawn, status 1', [Ra.defaults, Ra.defaultsEllipse], [[null, '1', 0], [null, '1', 0]]);
eq('RectanglePaintRaster (corners): pixels written, changed rectangle notified to the store operator, status 0, renderer logged as not attested', Ra.rect, [null, '0', 16, { x0: 4, y0: 4, x1: 7, y1: 7 }, white, clear, 1]);
eq('RectanglePaintRaster undo: saved pixels copied back and the rectangle notified; redo paints again', [Ra.rectUndo, Ra.rectRedo], [[0, 1, { x0: 4, y0: 4, x1: 7, y1: 7 }], 16]);
eq('RectanglePaintRaster FromCenter: (X1, Y1) is the centre, (X2, Y2) one corner', Ra.rectCenter, [16, { x0: 14, y0: 14, x1: 17, y1: 17 }]);
eq('EllipsePaintRaster FromCenter: radii |X2 - cx|, |Y2 - cy| around (X1, Y1)', [Ra.ellipse[0], Ra.ellipse[1], Ra.ellipse[2] > 60 && Ra.ellipse[2] < 90, Ra.ellipse[3], Ra.ellipse[4], Ra.ellipseUndo], [null, '0', true, { x0: 10, y0: 12, x1: 21, y1: 19 }, 1, 0]);
eq('EllipsePaintRaster not from centre: the centre is the midpoint of the two points', Ra.ellipseCorners, { x0: 10, y0: 12, x1: 21, y1: 19 });
eq('RectanglePaintRaster: an argument that cannot be fetched is 0x80070057; the temporary shape is never added anywhere', [Ra.badArg[0], Ra.objects], [E_INVALIDARG, []]);

// 6. AddPaintShapePoint
const Ap = got.addPoint;
eq('AddPaintShapePoint: appended (InsertPosition -1), Value = old point count, first sub-shape at 0, status 0', Ap.append, [[0, 1, 2], '0', [[0, 1], [10, 1], [20, 1]], [0]]);
eq('AddPaintShapePoint: insertion at an index, both handles stored', Ap.insert, [1, [5, 2, -1, -2, 1, 2], [0, 5, 10, 20]]);
eq('AddPaintShapePoint: a position beyond the point count appends', Ap.beyond, [4, 5]);
eq('AddPaintShapePoint: Undo does not remove the point; Redo inserts the same point again', [Ap.undoKeepsPoint, Ap.redoAddsAgain], [5, [6, [0, 5, 10, 20, 30, 30]]]);
eq('AddPaintShapePoint: with shape keys the point goes into every key at the same index', Ap.intoKeys, [7, -5, 7]);
eq('AddPaintShapePoint: a true insertion shifts the sub-shape starts at or after the index; an append does not', Ap.subShapeShift, [[0, 3], [0, 3]]);
eq('AddPaintShapePoint: an argument that cannot be fetched is 0x80070057 with the paint shape message', Ap.badArg, [E_INVALIDARG, MSG_SHAPE]);

// 7. point selection
const Se = got.select;
eq('SelectPaintShapePoint: replaces the selection (mode 0), no return value', Se.select, [null, '0', true, [0, 2]]);
eq('AddToPaintShapePointSelection: adds (mode 2)', Se.addTo, [0, 2, 3]);
eq('TogglePaintShapePointSelection: toggles the listed points (mode 1); undo restores the snapshot, redo repeats', [Se.toggle, Se.undoToggle, Se.redoToggle], [[1, 2, 3], [0, 2, 3], [1, 2, 3]]);
eq('SelectPaintShapePoint with Indices that is not an array: empty list, still succeeds; undo', [Se.notArray, Se.undoSelect], [[null, []], [1, 2, 3]]);
eq('selection: out-of-range indices are left to the shape (ignored here); an element that cannot be converted is 0x80070057', [Se.outOfRange, Se.badElement], [[0, 1, 2, 3], E_INVALIDARG]);

// 8. point weights
const We = got.weights;
eq('IncPaintShapePointWeight: selected points +1', [We.start, We.inc], [[[1, 2, 3], [1, 1, 1, 1]], [null, '0', [1, 2, 2, 2]]]);
eq('IncPaintShapePointWeight: capped at 3', We.incCap, [1, 3, 3, 3]);
eq('DecPaintShapePointWeight: -1; undo writes the saved weights back; redo', [We.dec, We.decUndo, We.decRedo], [[1, 2, 2, 2], [1, 3, 3, 3], [1, 2, 2, 2]]);
eq('DecPaintShapePointWeight: floor at 1', We.decFloor, [1, 1, 1, 1]);
eq('Inc with an empty selection: nothing changes, status 0', We.emptySelection, [null, '0', [1, 1, 1, 1]]);

// 9. DeletePaintShapePoints / TranslatePaintShapePoint
const De = got.del;
eq('DeletePaintShapePoints without index: the selected points, selection cleared, status 0, no return value', De.selected, [null, '0', true, [0, 20, 40], []]);
eq('DeletePaintShapePoints undo: points restored from the blob and the selection restored; redo', [De.undo, De.redo], [[[0, 10, 20, 30, 40], [1, 3]], [[0, 20, 40], []]]);
eq('DeletePaintShapePoints: a single index, an index array', [De.single, De.array], [[20, 40], []]);
eq('DeletePaintShapePoints: an empty array is 0x80070057 with the paint shape message', De.emptyArray, [E_INVALIDARG, MSG_SHAPE]);
const Tr = got.translate;
eq('TranslatePaintShapePoint: the selected points move by (x, y); undo, redo', [Tr.move, Tr.undo, Tr.redo], [[null, '0', [[5, -2], [10, 0], [25, -2]]], [[0, 0], [10, 0], [20, 0]], [[5, -2], [10, 0], [25, -2]]]);
eq('TranslatePaintShapePoint: Delta = siAbsolute behaves like siRelative (the worker never reads it)', Tr.absoluteIsRelative, [[6, -1], [10, 0], [26, -1]]);
eq('TranslatePaintShapePoint: an unreadable scalar is 0x80070057', Tr.badScalar, E_INVALIDARG);

// 10. Add family
const Ad = got.add;
eq('AddColorPaintShape on an empty list: a ColorShape appended, tag -1, returned as Value', Ad.first.slice(0, 5).concat([Ad.first[5].length]), [null, '0', 'ColorShape', -1, true, 1]);
eq('AddColorPaintShape on a paint list with items: an automatic Clear Stencil command is appended first (list preparation, case A)', Ad.second, [['ColorShape', 'cmd0', 'ColorShape'], true, -1]);
eq('Add family undo: the new shape and the automatic Clear Stencil command are deleted', Ad.undo, ['ColorShape']);
eq('Add family redo: the worker runs again and creates new objects', Ad.redo, [['ColorShape', 'cmd0', 'ColorShape'], true]);
eq('Add family undo after redo: the references are those of the first run, nothing left to delete (as read)', Ad.undoAfterRedo, 3);
eq('AddFloodFillPaintShape: a FloodFill shape with the seed as its one point', Ad.flood, [null, 'FloodFill', [[3, 4]], 0]);
eq('AddAlphaFloodFillPaintShape / AddBoundaryFillPaintShape: same steps, placeholder class logged as not attested, the seed is always inserted', [Ad.alpha, Ad.boundary], [[null, 'AlphaFloodFill', [[1, 2]], 1], [null, 'BoundaryFill', [[0, 0]], 1]]);
eq('AddFxMaskShape: kind 0 list -> "must be a mask shape list"; kind 1 list -> 0x80070057 without that message; never reaches Do', Ad.fxMask, [[E_INVALIDARG, 'Argument 1 must be a mask shape list'], E_INVALIDARG, false, 1, 0]);
eq('AddColorPaintShape on a list of another kind: 0x80070057 without a message', Ad.colorOnMaskList, [E_INVALIDARG, false]);
eq('Add family: not a list / unreadable seed -> 0x80070057 with the paint shape list message', Ad.notAList, [[E_INVALIDARG, MSG_LIST], [E_INVALIDARG, MSG_LIST]]);
eq('list preparation: no second Clear Stencil command when the last item already is one (case B)', Ad.afterClearStencil, ['ColorShape', 'cmd0', 'ColorShape']);
const Ge = got.geom;
eq('AddRectanglePaintShape FromCenter (default): corners (X1 - dx, Y1 - dy), (X1 + dx, Y1 + dy); four points, no handles, spline type 2, closed, named Rectangle',
  Ge.rectCenter, [null, '0', 'ColorShape', 'Rectangle', [[6, 8, 0, 0, 0, 0], [14, 8, 0, 0, 0, 0], [14, 12, 0, 0, 0, 0], [6, 12, 0, 0, 0, 0]], 2, true, true]);
eq('AddRectanglePaintShape not from centre: opposite corners as given; second shape after an automatic Clear Stencil', Ge.rectCorners, [[[1, 2], [5, 2], [5, 6], [1, 6]], ['ColorShape', 'cmd0', 'ColorShape']]);
eq('AddRectanglePaintShape undo', Ge.rectUndo, ['ColorShape']);
const kx = f(K * 10), ky = f(K * 5), nkx = f(-K * 10), nky = f(-K * 5);
eq('AddEllipsePaintShape not from centre: centre = midpoint, four bezier points with handle offsets k = 0.551915 times the radius, spline type 0, closed, named Ellipse',
  Ge.ellipseCorners, [null, 'Ellipse', [[10, 0, nkx, 0, kx, 0], [20, 5, 0, nky, 0, ky], [10, 10, kx, 0, nkx, 0], [0, 5, 0, ky, 0, nky]], 0, true]);
eq('AddEllipsePaintShape FromCenter: centre (X1, Y1), radii |X2 - cx|, |Y2 - cy|', Ge.ellipseCenter, [[10, 0], [20, 5], [10, 10], [0, 5]]);
eq('AddRectanglePaintShape with only a list: a degenerate rectangle at the origin', Ge.defaultsWithList, [null, [[0, 0], [0, 0], [0, 0], [0, 0]]]);
eq('AddEllipsePaintShape / AddRectanglePaintShape: unreadable argument or unknown list -> 0x80070057', Ge.bad, [E_INVALIDARG, E_INVALIDARG]);

// 11. handles
const Ha = got.handles;
eq('MovePaintShapeHandle: the chosen handle of the point changes, the other stays, status 0, Mode semantics logged as not attested', Ha.move, [null, '0', true, [3, 4], true, 1]);
eq('MovePaintShapeHandle: undo restores both saved handle values, redo repeats; Handle 1 is the left handle', [Ha.moveUndo, Ha.moveRedo, Ha.moveLeft], [true, [3, 4], [-7, 1]]);
eq('MovePaintShapeHandle errors (0x80070057): Handle not 1 / 2, Invalid mode, Point index out of range (also for an unreadable scalar)', Ha.errors,
  [[E_INVALIDARG, 'Handle must be 1 for left or 2 for right'], [E_INVALIDARG, 'Handle must be 1 for left or 2 for right'], [E_INVALIDARG, 'Invalid mode'], [E_INVALIDARG, 'Point index out of range'], [E_INVALIDARG, 'Point index out of range'], [E_INVALIDARG, 'Point index out of range']]);
eq('Move / SetPaintShapeHandle on a shape that is not bezier (rectangle): 0x80070057 with the bezier message', Ha.notBezier, [[E_INVALIDARG, MSG_BEZIER], [E_INVALIDARG, MSG_BEZIER]]);
eq('SetPaintShapeHandle: left = (lhx, lhy), right = (lrx, lry); undo, redo', [Ha.set, Ha.setUndo, Ha.setRedo], [[null, '0', [1, 2, 3, 4]], [kx, 0, nkx, 0], [1, 2, 3, 4]]);
eq('SetPaintShapeHandle: Point outside 0 <= Point < count', Ha.setRange, [E_INVALIDARG, 'Point index out of range']);

// 12. DeleteAllPaintShapes / AddClearImageShape / ClearImage
const Wi = got.wipe;
eq('DeleteAllPaintShapes: every item deleted, status 0, no return value', Wi.deleteAll, [null, '0', true, 0, false]);
eq('DeleteAllPaintShapes: undo brings the items back in order, redo deletes again', [Wi.undo, Wi.redo], [['ColorShape:da1', 'StrokeShape:da2'], 0]);
eq('DeleteAllPaintShapes on an empty list: positive status 0x562e8005, nothing deleted', Wi.empty, [null, S_NOTHING]);
eq('AddClearImageShape on a paint list (kind 0, tool flag false): all shapes deleted first, then a WipeShape appended and returned', Wi.clearShape, [null, '0', 'WipeShape', -1, ['WipeShape']]);
eq('AddClearImageShape undo: the WipeShape is deleted and the nested delete is undone; redo runs the worker again', [Wi.clearShapeUndo, Wi.clearShapeRedo], [['ColorShape:w1', 'ColorShape:w2'], ['WipeShape']]);
eq('AddClearImageShape with the tool settings flag set: shapes kept (list prepared as usual)', Wi.keepFlag, ['ColorShape', 'ColorShape', 'cmd0', 'WipeShape']);
eq('AddClearImageShape on a list of another kind: no delete, the new shape takes the tag of the last item', Wi.otherKind, [['SelShape', 'SelShape', 'WipeShape'], 4]);
const Ci = got.clearImage; const fullRect = { x0: 0, y0: 0, x1: 31, y1: 31 };
eq('ClearImage: the whole raster wiped, the changed rectangle refreshed, status 0, WipeShape defaults logged as not attested', Ci.clear, [null, '0', 16, 0, fullRect, 1]);
eq('ClearImage: undo copies the snapshot back, redo wipes again', [Ci.undo, Ci.redo], [16, 0]);

// 13. AddBrushStroke
const Bs = got.stroke;
eq('AddBrushStroke: a StrokeShape is created with the current brush id; outputs index (sub-stroke) and Value; default pressure one value 1.0',
  Bs.created, [null, '0', ['index', 'Value'], 0, 'StrokeShape', 1, -1, [[0, 0], [5, 5]], [{ start: 0, count: 2, pressures: [1] }], true, true]);
eq('AddBrushStroke on a paint list with items: Clear Stencil appended first, so a new stroke shape', Bs.paintList, ['StrokeShape', 'cmd0', 'StrokeShape']);
eq('AddBrushStroke: the stroke shape at the current time is reused when brush, colours and settings match; a new sub-stroke with N pressures',
  Bs.reused, [null, true, 1, ['StrokeShape'], 5, [{ start: 0, count: 2, pressures: [0.5] }, { start: 2, count: 3, pressures: [0.25, 0.5, 0.75] }]]);
eq('AddBrushStroke undo on a reused shape: only the points of the added sub-stroke are removed; redo appends again', [Bs.undoReused, Bs.redoReused], [[['StrokeShape'], 2, 1], [5, 2]]);
eq('AddBrushStroke undo on a created shape: the shape is deleted; redo creates a new one', [Bs.undoCreated, Bs.redoCreated], [0, [['StrokeShape'], true]]);
eq('AddBrushStroke: a changed paint colour stops the reuse', Bs.colourChanged, ['StrokeShape', 'StrokeShape']);
eq('AddBrushStroke errors: no / odd / empty Points, Pressure array of the wrong length, not a list -> 0x80070057 with the 2D paint shape list message', Bs.errors, Array(6).fill([E_INVALIDARG, MSG_STROKE]));

// 14. paint masks, ClearPaintSelection, InvertPaintStencil
const Ma = got.masks;
eq('ClearPaintSelection with no stencil element: positive status 0x562e8005', Ma.nothingToClear, [null, S_NOTHING]);
eq('RectangularPaintMask: a selection shape named RectSelect in the current paint frame, corners as given (FromCenter default False), properties (0, False, 0)',
  Ma.rect, [null, '0', 'SelShape', 'RectSelect', [[2, 2, 0, 0, 0, 0], [6, 2, 0, 0, 0, 0], [6, 4, 0, 0, 0, 0], [2, 4, 0, 0, 0, 0]], { SelectionAction: 0, AntiAliased: false, Feather: 0 }, true, ['ColorShape:paintStays', 'SelShape:RectSelect']]);
eq('EllipticalPaintMask (SelectionAction 0): the existing selection is cleared first; FromCenter and AntiAliased default True; named EllipseSelect',
  Ma.ellipseReplaces, ['EllipseSelect', [[10, 8], [14, 10], [10, 12], [6, 10]], { SelectionAction: 0, AntiAliased: true, Feather: 0 }, ['ColorShape:paintStays', 'SelShape:EllipseSelect']]);
eq('mask undo: the shape is deleted and the cleared selection comes back; redo runs as a first run (new shape)', [Ma.ellipseUndo, Ma.ellipseRedo], [['ColorShape:paintStays', 'SelShape:RectSelect'], [['ColorShape:paintStays', 'SelShape:EllipseSelect'], true]]);
eq('RectangularPaintMask SelectionAction 1: the existing mask is kept; properties applied', Ma.rectAdd, [[[-2, -2], [2, -2], [2, 2], [-2, 2]], { SelectionAction: 1, AntiAliased: true, Feather: 3 }, ['ColorShape:paintStays', 'SelShape:EllipseSelect', 'SelShape:RectSelect']]);
eq('MagicWandPaintMask: magic wand shape named MagicWand with exactly one point, the seed', Ma.wand, [null, 'MagicWand', 'MagicWand', [[5, 6]], { SelectionAction: 2, AntiAliased: true, Feather: 0 }, 4]);
eq('AddPaintMaskShape: an empty selection shape named Lasso', Ma.lasso, [null, 'SelShape', 'Lasso', 0, { SelectionAction: 3, AntiAliased: false, Feather: 0 }, 5]);
eq('InvertPaintStencil: a simple command "InvertStencil" with Command 1 appended to the current paint frame, status 0', Ma.invert, [null, '0', true, 'simplecommand', 'InvertStencil', 1, 6]);
eq('InvertPaintStencil: undo deletes it; redo runs Do again (a new object)', [Ma.invertUndo, Ma.invertRedo], [5, [6, 1, true]]);
eq('ClearPaintSelection: selection shapes, magic wand fills and simple commands deleted; colour shapes never touched; status 0', Ma.clear, [null, '0', true, ['ColorShape:paintStays']]);
eq('ClearPaintSelection: undo brings the elements back, redo deletes them again', [Ma.clearUndo, Ma.clearRedo], [true, ['ColorShape:paintStays']]);
eq('mask SelectionAction above 3 or negative becomes 0 (and so clears first)', [Ma.clamped, Ma.negative, Ma.restoredAfterUndo], [[0, ['ColorShape:paintStays', 'SelShape:Lasso']], [0, 2], true]);
eq('mask commands: an argument that cannot be read is 0x80070057', Ma.badArg, [E_INVALIDARG, E_INVALIDARG, E_INVALIDARG]);
eq('mask (action 1) / InvertPaintStencil / ClearPaintSelection with a paint store that has no clip: 0x80004005', Ma.noClip, [E_FAIL, E_FAIL, E_FAIL]);

// 15. colours and brush
const Co = got.colours; const col = [0.25, 0.5, 0.75, 2];
eq('ResetPaintColor: foreground (1, 1, 1, 1), background (0, 0, 0, 0)', Co.reset, [null, '0', [white, clear]]);
eq('SetPaintColor: foreground set, no clamping, background untouched; undo restores, redo repeats', [Co.set, Co.setUndo, Co.setRedo], [[null, '0', true, [col, clear]], [white, clear], [col, clear]]);
eq('SwapPaintColors: exchanged; undo swaps again', [Co.swap, Co.swapUndo], [[null, '0', [clear, col]], [col, clear]]);
eq('ResetPaintColor undo restores both saved colours', [Co.reset2, Co.resetUndo], [[white, clear], [clear, col]]);
eq('colour commands: WSZ_FXPAINT_COLOR_CH after every Do / Undo / Redo', Co.notifications, [9, ['WSZ_FXPAINT_COLOR_CH']]);
eq('SetPaintBrush: the named brush becomes current; undo restores the saved id; redo sets it again with status 1', [Co.brush, Co.brushUndo, Co.brushRedo], [[null, '0', 2], 1, [2, 1]]);
eq('SetPaintBrush: an unknown name is 0x80004005 and changes nothing', [Co.unknown, Co.back], [[E_FAIL, 2], 1]);

// 16. PaintRasterLine / FloodFillRaster
const Rc = got.rasterC;
eq('PaintRasterLine: pixels painted along the segment, the stroke rectangle notified, status 0, Matador stroke logged as not attested', Rc.line, [null, '0', true, true, { x0: 8, y0: 8, x1: 22, y1: 12 }, white, clear, 1]);
eq('PaintRasterLine: undo copies the saved part back; redo paints again', [Rc.lineUndo, Rc.lineRedo], [0, true]);
eq('PaintRasterLine: a stroke that touches no pixel is 0x80004005; an unreadable argument 0x80070057; defaults with a store paint at the origin', [Rc.outside, Rc.badArg, Rc.defaultsWithStore], [E_FAIL, E_INVALIDARG, [null, '0', true]]);
eq('FloodFillRaster: fill burnt into the raster from the seed, modified rectangle notified, status 0, fill rule logged as not attested', Rc.fillAll, [null, '0', true, 1024, fullRect, 1]);
eq('FloodFillRaster: undo copies the saved part back; redo fills again', [Rc.fillUndo, Rc.fillRedo], [0, 1024]);
eq('FloodFillRaster (stand-in rule): only the region of the seed is filled', [Rc.region, Rc.cleanAfterUndo], [[16, 16, { x0: 4, y0: 4, x1: 7, y1: 7 }], 0]);
eq('FloodFillRaster: renderer failure 0x80004005, unreadable argument 0x80070057', [Rc.seedOutside, Rc.fillBadArg], [E_FAIL, E_INVALIDARG]);

// 17. InsertPaintShapePoint
const In = got.insert;
eq('InsertPaintShapePoint: Value = the new point index; shape method logged as not attested (stand-in: segment + fraction)', In.insert, [null, '0', 1, [[0, 0], [5, 0], [10, 0], [10, 4], [0, 4]], 1]);
eq('InsertPaintShapePoint: undo removes the point (undo record), redo inserts again', [In.undo, In.redo], [4, 5]);
eq('InsertPaintShapePoint (stand-in): the closing segment of a closed contour', In.closing, [4, [0, 3]]);
eq('InsertPaintShapePoint (stand-in): a contour that does not exist inserts nothing', In.noContour, [null, -1, 4]);
eq('InsertPaintShapePoint: an unreadable scalar is 0x80070057 with the paint shape message', In.badArg, [E_INVALIDARG, MSG_SHAPE]);

// 18. ImportMatadorShapeList
const Mt = got.matador;
eq('ImportMatadorShapeList version 6, single key: one colour shape appended; x, y scaled by Dest / source size, tangents as read; point type outside 1..3 becomes 1; colours with alpha 1; kind / flag from the type code',
  Mt.v6, [null, '0', true, 1, 'ColorShape', [[20, 40, 0.5, 0.25, -0.5, -0.25], [60, 80, 0, 0, 0, 0]], [[1, [1, 0, 0, 1]], [1, [0, 1, 0, 1]]], { kind: 2, flag: true }, 0, 1]);
eq('ImportMatadorShapeList: Undo is a stub (nothing removed); Redo is logged as not attested and imports nothing', [Mt.undoStub, Mt.redo], [0, [0, true]]);
eq('ImportMatadorShapeList: no scaling unless DestWidth and DestHeight are both non-zero', [Mt.noScale, Mt.oneDestOnly], [[[10, 20], [30, 40]], [[10, 20], [30, 40]]]);
eq('ImportMatadorShapeList animated layout (magic 2302941, version 7, kind switch 3): shapes created once, a key per key frame',
  Mt.animated, [null, 1, { kind: 0, flag: true }, [[1, [[1, 1]]], [5, [[2, 2]]]], [[2, 2]]]);
eq('imported shape keys answer the key navigation commands', Mt.keyNavigation, [1, 5]);
eq('ImportMatadorShapeList version 2: integer colours divided by 255, type code 4 -> kind 1, flag off', Mt.v2, [null, { kind: 1, flag: false }, [[5, 6, 2, [1, 0, f(0.2), 1]]]]);
eq('ImportMatadorShapeList version 1: extra float skipped, colour (1, 1, 1), type code 5 -> kind 2, flag off', Mt.v1, [null, { kind: 2, flag: false }, [[5, 6, 3, [1, 1, 1, 1]]]]);
eq('ImportMatadorShapeList version 8: the two extra lines are read and the parsed name is not applied', Mt.v8, [null, { kind: 1, flag: true }, [[1, 2]], false]);
eq('ImportMatadorShapeList errors: not found 0x80030002, not a shape list / read error 0x80004005, no file name / not a list 0x80070057, with the literal messages', Mt.errors, [
  [E_NOTFOUND, 'Matador shape list file "C:\\paint\\missing.sl" not found'], [E_FAIL, 'File "C:\\paint\\text.sl" is not a Matador shape list file'], [E_FAIL, 'Error reading Matador shape list file "C:\\paint\\short.sl"'],
  [E_INVALIDARG, 'Argument 2 a file name'], [E_INVALIDARG, MSG_LIST]]);
eq('ImportMatadorShapeList: shapes appended before an error stay in the list (unknown type code on the second shape)', [Mt.afterErrors, Mt.partial], [0, [[E_FAIL, 'Error reading Matador shape list file "C:\\paint\\badcode.sl"'], 1]]);
eq('ImportMatadorShapeList: an unreadable DestWidth is 0x80070057', Mt.badDest, E_INVALIDARG);

eq('page errors', pageErrors, []);

if (fails.length) {
  console.error(`FAIL CMD-B9a/b/c xsipaint task commands: ${fails.length} of ${checks} checks`);
  for (const x of fails) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B9a/b/c xsipaint task commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden; paint objects are a stand-in model)`);
console.log('   fully wired (command layer): shape key navigation (5), paint stores (3), Inc / DecPaintShapePointWeight, AddPaintShapePoint, ClearPaintSelection, InvertPaintStencil, AddColorPaintShape, AddFloodFillPaintShape,');
console.log('     AddRectangle / AddEllipsePaintShape, AddClearImageShape, DeleteAllPaintShapes, AddBrushStroke, DeletePaintShapePoints, TranslatePaintShapePoint, SetPaintShapeHandle, the four paint mask commands,');
console.log('     the three point selection commands, Set / Reset / SwapPaintColors, SetPaintBrush (brush table is a stand-in)');
console.log('   partly wired (log "not yet attested"): RectanglePaintRaster, EllipsePaintRaster, ClearImage, PaintRasterLine, FloodFillRaster (pixel renderers are stand-ins), MovePaintShapeHandle (Mode), InsertPaintShapePoint (shape method),');
console.log('     AddAlphaFloodFillPaintShape, AddBoundaryFillPaintShape (placeholder class), AddFxMaskShape (as read never passes UnPackArg), ImportMatadorShapeList (kind / flag meaning, Redo)');
