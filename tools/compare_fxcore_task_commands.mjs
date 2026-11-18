// CMD-B9e / CMD-B9f / CMD-B9g: the fxcore.dll task commands on the command bus (src/commands/fxCoreTasks*.ts).
// Checked against the contracts of docs/ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md,
// docs/ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md and
// docs/ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the rows, so this is a contract check: registration with the registry argument list
// (without the return value, flag 0x200), a run with default arguments (a contract-specified failure status is the
// expected result), and the stated results. The FX objects are this build's stand-in model (app.fxCore).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fxcore_task_commands.mjs
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

const B9E = ['SavePaintClip', 'SaveSelectedPaintClipFrames', 'RevertPaintClip', 'RevertPaintClipFrame', 'RevertSelectedPaintClipFrame', 'GotoSelectedPaintClipFrame', 'PrevModifiedPaintClipFrame',
  'NextModifiedPaintClipFrame', 'SelectPaintClipFrames', 'ClearPaintClipFrameSelection', 'CreateFxTree', 'DisconnectFxOp', 'RenderFxOp', 'SetFxOpPos', 'MakeWarperShapePair'];
const B9F = ['Add2DShape', 'Add2DShapePoint', 'Add2DShapePointArray', 'Insert2DShapePoint', 'Move2DShape', 'Move2DShapePin', 'Scale2DShape', 'Set2DShapeRotation', 'AddPassInputFxOp', 'ConnectFxOp',
  'SetFxOpAttrib', 'CurrentFxTracking', 'StartFxTracking', 'StepFxTracking'];
const B9G = ['AddFxOp', 'AddImageClipFxOp', 'SetFxOpCnxFlag', 'CutFxOp', 'CopyFxOp', 'PasteFxOp', 'Move2DShapePoint', 'Move2DShapeLHandle', 'Move2DShapeRHandle', 'Delete2DShapePoint', 'Key2DShapePoints',
  'SetFxTrackerTrackedPoint', 'SetFxTrackerTemplateArea', 'SetFxTrackerSearchArea'];
const NAMES = [...B9E, ...B9F, ...B9G];
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n);
  return [n, c ? { label: c.name, args: c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) } : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SetFxTrackerSearchArea') && !!window.Application?.fxCore && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const A = window.Application; const S = A.fxCore; A.autoInspect = false;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const logFrom = (i) => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}:${l.text}`);
  const run = (n, a = {}) => {
    S.lastStatus = null; const m = A.log.length;
    try { const v = A.run(n, a); return { v, st: S.lastStatus?.command === n ? hex(S.lastStatus.status) : null, log: logFrom(m) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status) ?? 'THROW', log: logFrom(m) }; }
  };
  const ok = (r) => r.err ? `ERR ${r.status}` : r.st;           // '0' / '1' on success
  const bad = (r) => r.err ? r.status : `no error (${r.st})`;   // failure status as hex
  const msg = (r, t) => !!r.err && r.err.includes(t);
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, t) => r.log.some(l => l.includes(t));
  const undoLen = () => A.undoStack.length;
  const noteFrom = (i) => S.notifications.slice(i).map(x => x.id);
  const srcs = (op) => op.inputs.map(i => i.source?.name ?? null);
  const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));

  // ---- registration
  out.registered = Object.fromEntries(NAMES.map(n => { const d = A.commands.get(n); return [n, d ? { label: d.label, args: d.args.map(a => [a.name, a.default ?? null]) } : null]; }));

  // ---- default arguments, nothing selected
  out.defaults = {};
  for (const n of NAMES) { A.select([]); const r = run(n); out.defaults[n] = r.err ? r.status : `ok ${r.st}`; if (A.anim.playing) A.anim.stop(); }

  // ---- CreateFxTree (the default run above created one)
  let tree;
  {
    const r = {}; const root = A.scene.root; const mine = () => root.properties.filter(p => p.type === 'FxTree');
    const first = mine()[0]; r.made = [mine().length, first?.name, first?.type, first?.parent === root, first?.isFxTree === true];
    A.undo(); r.undo = mine().length;
    A.redo(); r.redo = [mine().length, mine()[0] !== first, mine()[0]?.name];
    tree = mine()[0];
    const b = run('CreateFxTree'); r.second = [ok(b), b.v?.name, b.v === mine()[1]];
    out.tree = r;
  }
  const add = (type, t = tree) => A.run('AddFxOp', { FxTree: t, PresetName: type });

  // ---- AddFxOp
  let blur, fin;
  {
    const r = {};
    const a = run('AddFxOp', { FxTree: tree, PresetName: 'Blur' }); blur = a.v;
    r.blur = [ok(a), blur?.name, blur?.type, blur?.tree === tree, tree.ops.includes(blur), blur?.inputs.length, nya(a) > 0];
    const b = run('AddFxOp', { FxTree: 'FxTree', PresetName: 'FileOutput' }); r.byName = [ok(b), b.v?.type, b.v?.classId, b.v?.tree === tree];
    const n0 = tree.ops.length; A.undo(); r.undo = [tree.ops.length - n0, tree.ops.includes(b.v)];
    A.redo(); r.redo = [tree.ops.length - n0, tree.ops.includes(b.v), tree.ops[tree.ops.length - 1]?.type];
    A.undo();
    const c = run('AddFxOp', { FxTree: tree, PresetName: '' }); r.empty = [bad(c), nya(c) > 0];
    const d = run('AddFxOp', { FxTree: blur, PresetName: 'Blur' }); r.notTree = [bad(d), msg(d, 'Argument 1 must be an EffectsTree object')];
    fin = add('FileInput'); r.fileInput = [fin.type, fin.inputs.length, fin.classId];
    out.addOp = r;
  }

  // ---- SetFxOpPos
  {
    const r = {}; r.rect0 = [...blur.rect]; const n0 = S.notifications.length;
    const a = run('SetFxOpPos', { FxOp: blur, x: 200, y: 80 }); r.moved = [ok(a), [...blur.rect], blur.positioned, noteFrom(n0)];
    A.undo(); r.undo = [...blur.rect];
    A.redo(); r.redo = [...blur.rect];
    const b = run('SetFxOpPos', { FxOp: 'FxTree.Blur', x: 50, y: 12.5 }); r.byName = [ok(b), [...blur.rect]];
    const c = run('SetFxOpPos', { FxOp: tree, x: 1, y: 1 }); r.notOp = [bad(c), msg(c, 'Argument must be an image operator')];
    out.pos = r;
  }

  // ---- ConnectFxOp / SetFxOpCnxFlag / DisconnectFxOp
  let comp;
  {
    const r = {}; const fin2 = add('FileInput');
    const a = run('ConnectFxOp', { Op1: fin, Op2: blur, Connection: '1' }); r.number = [ok(a), srcs(blur), blur.inputs[0].source === fin, nya(a) > 0];
    const b = run('ConnectFxOp', { Op1: fin2, Op2: blur, Connection: 'input' }); r.nameReplaces = [ok(b), blur.inputs[0].source === fin2];
    A.undo(); r.undoRestoresPrevious = blur.inputs[0].source === fin;
    A.redo(); r.redo = blur.inputs[0].source === fin2; A.undo();
    const c = run('ConnectFxOp', { Op1: fin2, Op2: blur, Connection: 'ALLINPUTS' }); r.allInputs = [ok(c), blur.inputs[0].source === fin, nya(c) > 0];
    const d = run('ConnectFxOp', { Op1: fin2, Op2: blur }); r.empty = [bad(d), msg(d, 'Argument 3 is not a valid connection name or number')];
    const e = run('ConnectFxOp', { Op1: fin2, Op2: blur, Connection: 'Output' }); r.output = [bad(e), msg(e, 'Argument 3 must be an input port')];
    const f = run('ConnectFxOp', { Op1: tree, Op2: blur, Connection: '1' }); r.notOp = [bad(f), msg(f, 'Argument must be an image operator')];
    comp = S.newOp(tree, { type: 'Comp', inputs: [{ name: 'Mask', select: true, invert: true }, 'Bg'] });
    const g = run('ConnectFxOp', { Op1: fin, Op2: comp, Connection: 'Mask' }); r.selectOn = [ok(g), comp.inputs[0].source === fin, comp.indexed.get(5)];
    A.undo(); r.selectUndo = [comp.inputs[0].source, comp.indexed.get(5) ?? null];
    out.connect = r;

    const q = {};
    const h = run('SetFxOpCnxFlag', { FxOp: comp, Connection: '1', FlagName: 'Invert', Value: false }); q.invert = [ok(h), comp.indexed.get(13)];
    A.undo(); q.invertUndo = comp.indexed.get(13) ?? null;
    const i = run('SetFxOpCnxFlag', { FxOp: comp, Connection: 'mask', FlagName: 'SELxyz', Value: 'yes' }); q.select = [ok(i), comp.indexed.get(5)];
    const j = run('SetFxOpCnxFlag', { FxOp: comp, Connection: '2', FlagName: 'Select' }); q.noFlag = bad(j);
    const k = run('SetFxOpCnxFlag', { FxOp: comp, Connection: '1', FlagName: 'foo' }); q.badFlag = [bad(k), msg(k, 'Argument 3 must the known flags "Select" or "Invert"')];
    const l = run('SetFxOpCnxFlag', { FxOp: comp, Connection: 'zzz', FlagName: 'Select' }); q.badCnx = [bad(l), msg(l, 'Argument 2 is not a valid connection name or number')];
    const m = run('SetFxOpCnxFlag', { FxOp: tree, Connection: '1', FlagName: 'Select' }); q.notOp = [bad(m), msg(m, 'Argument must be an image operator')];
    out.cnxFlag = q;

    const s = {};
    const n = run('DisconnectFxOp', { Op: blur, Connection: 'All' }); s.all = [ok(n), blur.inputs[0].source === fin, nya(n) > 0];
    const o = run('DisconnectFxOp', { Op: blur, Connection: 'allinputs' }); s.allInputs = [ok(o), blur.inputs[0].source === fin];
    const p = run('DisconnectFxOp', { Op: blur, Connection: '1' }); s.one = [ok(p), blur.inputs[0].source];
    A.undo(); s.undo = blur.inputs[0].source === fin; A.redo(); s.redo = blur.inputs[0].source;
    const t = run('DisconnectFxOp', { Op: blur, Connection: '1' }); s.notConnected = bad(t);
    const u = run('DisconnectFxOp', { Op: tree, Connection: '1' }); s.notOp = [bad(u), msg(u, 'Argument 2 is not a valid connection name or number')];
    const v = run('DisconnectFxOp', { Op: blur, Connection: 'Output' }); s.output = bad(v);
    out.disconnect = s;
  }

  // ---- SetFxOpAttrib
  {
    const r = {}; const n0 = S.notifications.length;
    const a = run('SetFxOpAttrib', { Op: blur, Attrib: 'rect', Value: [10, 20, 200, 90] }); r.rect = [ok(a), [...blur.rect], noteFrom(n0)];
    const b = run('SetFxOpAttrib', { Op: [blur], Attrib: 'Rect', Value: [300, 190, 110, 120] }); r.swapped = [ok(b), [...blur.rect]];
    A.undo(); r.undo = [...blur.rect];
    const c = run('SetFxOpAttrib', { Op: blur, Attrib: 'Rect', Value: [0, 0, 30, 10] }); r.minimums = [ok(c), [...blur.rect]];
    const d = run('SetFxOpAttrib', { Op: blur, Attrib: 'ShowThumbnail', Value: [1, 2, 3, 4] }); r.thumbnail = [ok(d), [...blur.rect], nya(d) > 0];
    const e = run('SetFxOpAttrib', { Op: [blur, comp], Attrib: 'ShowThumbnail', Value: [1, 2, 3, 4, 5, 6, 7, 8] }); r.thumbnailTwo = ok(e);
    const f = run('SetFxOpAttrib', { Op: [blur, comp], Attrib: 'Rect', Value: [1, 2, 3, 4, 5, 6, 7, 8] }); r.rectTwo = bad(f);
    const g = run('SetFxOpAttrib', { Op: blur, Attrib: 'Rect', Value: [1, 2, 3] }); r.count = bad(g);
    const h = run('SetFxOpAttrib', { Op: blur, Attrib: 'Rect', Value: 5 }); r.notArray = bad(h);
    r.rejectedNames = ['List', 'Help', '?', 'Colour', ''].map(n => { const x = run('SetFxOpAttrib', { Op: blur, Attrib: n, Value: [1, 2, 3, 4] }); return [bad(x), msg(x, 'Argument 2 must be an attribute name')]; });
    const i = run('SetFxOpAttrib', { Attrib: 'Rect', Value: [1, 2, 3, 4] }); r.noOp = [bad(i), msg(i, 'Argument 1 must be one or more fx operator')];
    out.attrib = r;
  }

  // ---- CutFxOp / CopyFxOp / PasteFxOp
  {
    const r = {}; const t3 = A.run('CreateFxTree'); const x = add('FileInput', t3), y = add('Blur', t3), z = add('Glow', t3);
    A.run('ConnectFxOp', { Op1: x, Op2: y, Connection: '1' }); A.run('ConnectFxOp', { Op1: y, Op2: z, Connection: '1' });
    A.run('SetFxOpPos', { FxOp: z, x: 300, y: 100 });
    S.clipboard = null; const e0 = run('PasteFxOp', { FxTree: t3 }); r.emptyClipboard = bad(e0);
    const u0 = undoLen(); const a = run('CopyFxOp', { InputObj: [y, z, t3] }); const cb = S.clipboard;
    r.copy = [ok(a), cb?.format, cb?.count, cb?.ops.map(o => o.name), cb?.cnx.guid, cb?.cnx.inputs, t3.ops.length, undoLen() - u0];
    const b = run('PasteFxOp', { FxTree: t3 }); const p = t3.ops.slice(3);
    r.paste = [ok(b), p.map(o => o.name), p.map(o => o.type), p[1]?.inputs[0].source === p[0], p[0]?.inputs[0].source, p.map(o => o.positioned),
      p.map((o, i) => [0, 1, 2, 3].map(k => o.rect[k] - [y, z][i].rect[k]))];
    A.undo(); r.pasteUndo = [t3.ops.length, p[0].tree];
    A.redo(); r.pasteRedo = [t3.ops.length, t3.ops[3] === p[0], t3.ops[4] === p[1], p[1].inputs[0].source === p[0]];
    A.undo();
    const c = run('CutFxOp', { InputObj: [y] }); r.cut = [ok(c), t3.ops.map(o => o.name), z.inputs[0].source, S.clipboard?.count, S.clipboard?.cnx.inputs];
    A.undo(); r.cutUndo = [t3.ops.map(o => o.name), z.inputs[0].source === y, y.inputs[0].source === x, y.tree === t3, S.clipboard?.count];
    A.redo(); r.cutRedo = t3.ops.map(o => o.name); A.undo();
    const d = run('CopyFxOp', { InputObj: [t3] }); r.noOps = bad(d);
    A.select([z]); const e = run('CopyFxOp'); r.selection = [ok(e), S.clipboard?.ops.map(o => o.name)]; A.select([]);
    const f = run('PasteFxOp', { FxTree: y }); r.notTree = [bad(f), msg(f, 'Argument must be a FxTree object')];
    const g = run('CopyFxOp'); r.nothing = [bad(g), msg(g, 'Argument must be a list of Fx Operators')];
    out.clip = r;
  }

  // ---- AddPassInputFxOp
  {
    const r = {}; const pass = A.scene.passes[0]; const fb = pass.framebuffers.find(f => f.name === 'Main');
    const want = String(fb.val('ResolvedFilename') || fb.val('Filename'));
    const a = run('AddPassInputFxOp', { FxTree: tree, RenderPass: pass }); const o = a.v;
    r.made = [ok(a), o?.type, o?.classId, o?.tree === tree, o?.indexed.get(2) === want, want.length > 0, Number.isInteger(o?.indexed.get(4)), Number.isInteger(o?.indexed.get(5)), o?.indexed.get(4) <= o?.indexed.get(5), nya(a) > 0];
    A.undo(); r.undo = tree.ops.includes(o);
    const b = run('AddPassInputFxOp', { FxTree: tree, RenderPass: pass.name, Framebuffer: 'MAIN' }); r.byName = [ok(b), b.v?.type]; A.undo();
    const c = run('AddPassInputFxOp', { FxTree: tree, RenderPass: pass, Framebuffer: 'nope' }); r.noFramebuffer = bad(c);
    const src = Number(pass.val('FrameRangeSource')) === 3 ? A.scene.renderOptions : pass; const old = src.val('FrameRangeSource'); src.set('FrameRangeSource', 1);
    const n0 = tree.ops.length; const d = run('AddPassInputFxOp', { FxTree: tree, RenderPass: pass }); src.set('FrameRangeSource', old);
    r.notSequence = [ok(d), d.v ?? null, tree.ops.length - n0, has(d, 'Only passes set to render sequences can be added as input clips.')];
    const e = run('AddPassInputFxOp', { FxTree: tree, RenderPass: tree }); r.notPass = bad(e);
    out.passInput = r;
  }

  // ---- AddImageClipFxOp
  {
    const r = {}; const clip = A.run('CreateImageClip', { FileName: 'C:\\pics\\wood.pic', Name: 'woodClip' }); A.select([]);
    const n0 = tree.ops.length; const a = run('AddImageClipFxOp', { FxTree: tree, ImageClip: clip }); const A1 = a.v; const B1 = tree.ops[tree.ops.length - 1];
    r.made = [ok(a), tree.ops.length - n0, A1?.classId, B1?.classId, A1?.val('ClipName'), B1?.val('ClipName'), B1?.inputs[0].source === A1, A1?.boundClip?.clip === clip, B1?.boundClip?.clip === clip, nya(a) > 0];
    A.undo(); r.undo = tree.ops.length - n0;
    const b = run('AddImageClipFxOp', { FxTree: tree, ImageClip: 'woodClip' }); r.byName = [ok(b), b.v?.val('ClipName')]; A.undo();
    const c = run('AddImageClipFxOp', { FxTree: tree, ImageClip: blur }); r.notClip = [bad(c), msg(c, 'Argument 2 must be an image clip')];
    const d = run('AddImageClipFxOp', { FxTree: clip, ImageClip: clip }); r.notTree = [bad(d), msg(d, 'Argument 1 must be an EffectsTree object')];
    out.imageClip = r;
  }

  // ---- paint clip commands
  {
    const r = {}; const clip = add('PaintClip'); const P = clip.paint; const u0 = undoLen();
    const state = () => [...P.frames].sort((a, b) => a[0] - b[0]).map(([k, f]) => `${k}${f.modified ? 'm' : ''}${f.selected ? 's' : ''}`).join(' ');
    r.isClip = [clip.type, !!P];
    const a = run('SavePaintClip', { InputObj: [clip] }); r.saveNothing = [ok(a), S.writtenFiles.length];
    r.noModified = ['RevertPaintClip', 'RevertPaintClipFrame', 'SelectPaintClipFrames', 'ClearPaintClipFrameSelection'].map(n => { const x = run(n, { PaintClip: clip, Frames: [1] }); return [bad(x), msg(x, 'There are no modified frames')]; });
    r.noSelected = ['SaveSelectedPaintClipFrames', 'RevertSelectedPaintClipFrame', 'GotoSelectedPaintClipFrame', 'PrevModifiedPaintClipFrame', 'NextModifiedPaintClipFrame'].map(n => { const x = run(n, { PaintClip: clip }); return [bad(x), msg(x, 'No paint clip frames are selected')]; });
    for (const f of [3, 5, 8]) S.paintFrame(clip, f);
    r.painted = [state(), P.modifiedCount];
    let n0 = S.notifications.length; const b = run('SelectPaintClipFrames', { PaintClip: clip, Frames: [5, 8.7, '99'] }); r.select = [ok(b), state(), noteFrom(n0)];
    const fr = A.anim.frame; r.gotoPrevNext = ['GotoSelectedPaintClipFrame', 'PrevModifiedPaintClipFrame', 'NextModifiedPaintClipFrame'].map(n => ok(run(n, { PaintClip: clip }))); r.gotoNoEffect = [state(), A.anim.frame === fr];
    const c = run('SaveSelectedPaintClipFrames', { PaintClip: clip }); r.noFileName = [ok(c), P.modifiedCount, has(c, `${clip.name} : Can't Write Files, Output File Name is Not Set`), S.writtenFiles.length];
    P.outputFile = 'C:\\out\\paint'; const c2 = run('SaveSelectedPaintClipFrames', { PaintClip: clip }); r.noFormat = [ok(c2), has(c2, 'Unsupported Image Format'), P.modifiedCount];
    P.outputFile = 'C:\\out\\paint.pic'; P.startOffset = 1; n0 = S.notifications.length;
    const d = run('SaveSelectedPaintClipFrames', { PaintClip: clip });
    r.saveSelected = [ok(d), [...S.writtenFiles], state(), P.modifiedCount, has(d, 'Writing Paint Clip ' + clip.name), has(d, 'Wrote File C:\\out\\paint.4.pic'), noteFrom(n0), nya(d) > 0];
    const d2 = run('SaveSelectedPaintClipFrames', { PaintClip: clip }); r.saveSelectedAgain = [ok(d2), S.writtenFiles.length];
    A.select([clip]); const e = run('SavePaintClip'); A.select([]); r.saveBySelection = [ok(e), S.writtenFiles.slice(2), state(), P.modifiedCount];
    S.paintFrame(clip, 3); P.cacheA.set(3, 1); P.cacheB.set(3, 1); n0 = S.notifications.length;
    const f = run('RevertPaintClipFrame', { PaintClip: clip, Time: 3.9 }); r.revertFrame = [ok(f), state(), P.modifiedCount, P.cacheA.size + P.cacheB.size, noteFrom(n0)];
    S.paintFrame(clip, A.anim.frame); S.paintFrame(clip, 40); const g = run('RevertPaintClipFrame', { PaintClip: clip }); r.revertCurrent = [ok(g), P.frames.has(Math.trunc(A.anim.frame)), P.modifiedCount];
    const g2 = run('RevertPaintClipFrame', { PaintClip: clip, Time: 77 }); r.revertAbsent = [ok(g2), P.modifiedCount];
    S.paintFrame(clip, 5); const h = run('RevertSelectedPaintClipFrame', { PaintClip: clip }); r.revertSelected = [ok(h), state(), P.modifiedCount];
    A.run('SelectPaintClipFrames', { PaintClip: clip, Frames: [40] }); n0 = S.notifications.length;
    const i = run('ClearPaintClipFrameSelection', { PaintClip: clip }); const n1 = S.notifications.length; const i2 = run('ClearPaintClipFrameSelection', { PaintClip: clip });
    r.clear = [ok(i), state(), noteFrom(n0).slice(0, n1 - n0), ok(i2), S.notifications.length - n1];
    A.run('SelectPaintClipFrames', { PaintClip: clip, Frames: [40] }); const j = run('SelectPaintClipFrames', { PaintClip: clip, Frames: [] }); r.selectEmpty = [ok(j), state()];
    r.badFrames = [bad(run('SelectPaintClipFrames', { PaintClip: clip, Frames: 'abc' })), bad(run('SelectPaintClipFrames', { PaintClip: clip, Frames: ['x'] })), bad(run('SelectPaintClipFrames', { PaintClip: clip }))];
    r.firstNotClip = bad(run('RevertPaintClip', { PaintClip: [tree, clip] }));
    P.cacheA.set(40, 1); n0 = S.notifications.length; const k = run('RevertPaintClip', { PaintClip: [clip, tree] }); r.revertAll = [ok(k), P.frames.size, P.modifiedCount, P.cacheA.size, noteFrom(n0), nya(k) > 0];
    r.notUndoable = undoLen() - u0;
    out.paint = r;
  }

  // ---- RenderFxOp
  {
    const r = {}; const fo = add('FileOutput'); fo.set('StartFrame', 2); fo.set('EndFrame', 6); fo.set('Step', 2); fo.set('FileName', 'C:\\r\\out.pic'); const u0 = undoLen();
    const a = run('RenderFxOp', { InputObj: fo }); r.render = [ok(a), [...fo.rendered], has(a, 'Rendering Images'), has(a, 'Rendering C:\\r\\out.4.pic'), a.log.filter(l => /Last Frame .* Average .* Total .* Estimated Left /.test(l)).length, has(a, 'Done Rendering Fx Op.  Total Render Time '), nya(a) > 0];
    fo.set('FileName', ''); fo.set('EndFrame', 2); A.select([fo]); const b = run('RenderFxOp', { Interactive: true }); A.select([]); r.noName = [ok(b), [...fo.rendered], nya(b) > nya(a)];
    fo.set('EndFrame', 1); const c = run('RenderFxOp', { InputObj: fo }); r.emptyRange = [ok(c), fo.rendered.length, has(c, 'Done Rendering')];
    const d = run('RenderFxOp', { InputObj: blur }); r.notFileOutput = bad(d);
    r.notUndoable = undoLen() - u0;
    out.render = r;
  }

  // ---- 2D shapes
  let bez, poly;
  {
    const r = {}; const list = S.newShapeList('Shapes');
    const a = run('Add2DShape', { ShapeList: list, ShapeType: 'Bezier' }); bez = a.v;
    r.bezier = [ok(a), bez?.type, bez?.storage, bez?.shapeKind, list.items.includes(bez), A.selection.length === 1 && A.selection[0] === bez, bez?.shapeId > 0];
    A.undo(); r.undo = [list.items.length, A.selection.includes(bez)];
    A.redo(); r.redo = [list.items.length, list.items[0] !== bez, list.items[0]?.type]; bez = list.items[0];
    const b = run('Add2DShape', { ShapeList: list, ShapeType: 'bsplineXYZ' }); r.bspline = [ok(b), b.v?.type, b.v?.val('Type'), b.v?.shapeKind];
    const c = run('Add2DShape', { ShapeList: 'Shapes', ShapeType: 'POLYGON' }); poly = c.v; r.polygon = [ok(c), poly?.type, poly?.val('Type'), poly?.shapeId !== bez.shapeId];
    r.badType = ['', 'circle', 'be'].map(t => { const x = run('Add2DShape', { ShapeList: list, ShapeType: t }); return [bad(x), msg(x, 'Argument 2 must be "Bezier", "BSpline" or "Polygon" ')]; });
    const d = run('Add2DShape', { ShapeList: bez, ShapeType: 'Bezier' }); r.notList = [bad(d), msg(d, 'Argument 1 must be a 2D shape list')];
    A.select([]);
    out.addShape = r;

    const q = {}; const xy = (s) => s.points.map(p => [p[0], p[1]]);
    const e = run('Add2DShapePoint', { Shape: bez, x: 1, y: 2 }); const f = run('Add2DShapePoint', { Shape: bez, x: 3, y: 4 }); q.add = [ok(e), e.v, f.v, xy(bez), bez.points[0].length];
    const g = run('Insert2DShapePoint', { Shape: bez, position: 1, x: 9, y: 9 }); q.insert = [ok(g), g.v, xy(bez)];
    A.undo(); q.insertUndo = xy(bez); A.redo(); q.insertRedo = xy(bez);
    const h = run('Insert2DShapePoint', { Shape: bez }); q.insertDefault = [h.v, xy(bez)[0]]; A.undo();
    const h2 = A.ExecuteCommand('Add2DShapePoint', [bez, 7, 8]); q.positional = [h2, xy(bez)[3]]; A.undo();
    const i = run('Add2DShapePointArray', { Shape: poly, points: [0, 0, 1, 0, '1', 1] }); q.array = [ok(i), i.v ?? null, xy(poly), poly.points[0].length];
    const i2 = run('Add2DShapePointArray', { Shape: poly, points: [5, 5, 6, 6] }); q.arrayMore = xy(poly).length; A.undo(); q.arrayUndo = xy(poly); void i2;
    q.badArrays = [[1, 2, 3], [], ['a', 1], 5, null].map(p => bad(run('Add2DShapePointArray', { Shape: poly, points: p })));
    q.notShape = ['Add2DShapePoint', 'Insert2DShapePoint', 'Add2DShapePointArray', 'Move2DShape', 'Scale2DShape', 'Move2DShapePin', 'Set2DShapeRotation', 'Move2DShapePoint', 'Move2DShapeLHandle', 'Move2DShapeRHandle', 'Delete2DShapePoint', 'Key2DShapePoints']
      .map(n => { const x = run(n, { Shape: tree, points: [1, 2] }); return [bad(x), msg(x, 'Argument 1 must be a 2D shape')]; });
    q.badNumber = bad(run('Add2DShapePoint', { Shape: bez, x: 'abc', y: 1 }));
    out.points = q;

    const t = {}; const tr = (s) => ['PosX', 'PosY', 'SclX', 'SclY', 'PinX', 'PinY', 'Rotate'].map(n => s.val(n)); const keyCount = (s) => [...s.fxKeys.values()].reduce((n, m) => n + m.size, 0);
    A.autoKey = false; S.ambient = {};
    const j = [run('Move2DShape', { Shape: bez, x: 5, y: 6 }), run('Scale2DShape', { Shape: bez, x: 2, y: 3 }), run('Move2DShapePin', { Shape: bez, x: 7, y: 8 }), run('Set2DShapeRotation', { Shape: bez, angle: 45 })];
    t.set = [j.map(ok), tr(bez), keyCount(bez)];
    A.undo(); A.undo(); t.undo = tr(bez); A.redo(); A.redo();
    const fr = A.anim.frame; S.ambient = { FXSH_AUTOKEY_PTS: true }; run('Move2DShape', { Shape: bez, x: 1, y: -1 }); S.ambient = { FXSH_AUTOKEY_PTS: 1 };
    t.ambientKey = [tr(bez).slice(0, 2), bez.fxKeys.get(3)?.get(fr), bez.fxKeys.get(4)?.get(fr), keyCount(bez)];
    A.undo(); t.ambientUndo = [tr(bez).slice(0, 2), keyCount(bez)];
    run('Scale2DShape', { Shape: bez, x: 4, y: 4 }); t.ambientNotBoolean = keyCount(bez); A.undo(); S.ambient = {};
    A.autoKey = true; run('Set2DShapeRotation', { Shape: bez, angle: 30 }); A.autoKey = false; t.prefKey = [bez.val('Rotate'), bez.fxKeys.get(9)?.get(fr), keyCount(bez)]; A.undo();
    const k = run('Move2DShape', { Shape: bez }); t.defaults = [ok(k), tr(bez).slice(0, 2)]; A.undo();
    out.transform = t;

    const m = {};
    const l = [run('Move2DShapePoint', { Shape: bez, index: 1, x: 20, y: 21 }), run('Move2DShapeLHandle', { Shape: bez, index: 1, x: 18, y: 19 }), run('Move2DShapeRHandle', { Shape: bez, index: 1, x: 22, y: 23 })];
    m.move = [l.map(ok), bez.points[1].slice(0, 6), keyCount(bez)];
    A.undo(); m.undo = bez.points[1].slice(4, 6);
    S.ambient = { FXSH_AUTOKEY_PTS: true }; run('Move2DShapePoint', { Shape: bez, index: 0, x: 11, y: 12 }); S.ambient = {};
    m.keyed = [bez.fxKeys.get('0.x')?.get(fr), bez.fxKeys.get('0.y')?.get(fr), keyCount(bez)]; A.undo();
    m.badIndex = [bad(run('Move2DShapePoint', { Shape: bez, index: 99, x: 1, y: 1 })), bad(run('Move2DShapePoint', { Shape: bez, index: -1 })), bad(run('Move2DShapeLHandle', { Shape: poly, index: 0, x: 1, y: 1 }))];
    const before = bez.points.map(p => [...p]); const n = run('Delete2DShapePoint', { Shape: bez, index: 1 }); m.del = [ok(n), xy(bez)];
    A.undo(); m.delUndo = JSON.stringify(bez.points) === JSON.stringify(before); A.redo(); m.delRedo = bez.points.length; A.undo();
    m.delBad = [bad(run('Delete2DShapePoint', { Shape: bez, index: 3 })), bad(run('Delete2DShapePoint', { Shape: bez, index: -1 }))];
    const o = run('Delete2DShapePoint', { Shape: poly }); m.delDefault = [ok(o), xy(poly)]; A.undo();
    const p = run('Key2DShapePoints', { Shape: bez }); m.keyAll = [ok(p), keyCount(bez), bez.fxKeys.get('1.lhx')?.get(fr), bez.fxKeys.get('2.y')?.get(fr)];
    A.undo(); m.keyUndo = keyCount(bez);
    const s = run('Key2DShapePoints', { Shape: poly, index: [0, 2, 77] }); m.keySome = [ok(s), keyCount(poly), [...poly.fxKeys.keys()].sort(), poly.fxKeys.get('2.x')?.get(fr)];
    const s2 = run('Key2DShapePoints', { Shape: poly, index: [] }); m.keyEmptyArray = [ok(s2), keyCount(poly)];
    const s3 = run('Key2DShapePoints', { Shape: poly, index: 1 }); m.keyScalar = [ok(s3), keyCount(poly)];
    m.keyBad = bad(run('Key2DShapePoints', { Shape: poly, index: ['x'] }));
    out.pointEdit = m;
  }

  // ---- MakeWarperShapePair
  {
    const r = {}; const warp = add('Warp'); const L = warp.shapeLists;
    const src = A.run('Add2DShape', { ShapeList: L[0], ShapeType: 'Bezier' }); A.run('Add2DShapePointArray', { Shape: src, points: [0, 0, 4, 0, 4, 4] }); A.select([]);
    const u0 = undoLen(); const a = run('MakeWarperShapePair', { FxOp: warp, InputObj: [src] }); const dst = L[2].items[0];
    r.pair = [ok(a), L.map(l => l.items.length), dst !== src, dst?.shapeId === src.shapeId, JSON.stringify(dst?.points) === JSON.stringify(src.points), dst?.points !== src.points,
      [src.val('UsesWireColor'), src.wireUnsel, src.wireSel], [dst?.val('UsesWireColor'), dst?.wireUnsel, dst?.wireSel], L[1].items[0]?.shapeId === src.shapeId, L[1].items[0]?.type, nya(a), undoLen() - u0];
    A.select([dst]); const b = run('MakeWarperShapePair', { FxOp: warp }); A.select([]); r.fromDestination = [ok(b), L.map(l => l.items.length), src.wireUnsel, dst.wireUnsel, nya(b)];
    const dstOnly = A.run('Add2DShape', { ShapeList: L[2], ShapeType: 'Polygon' }); A.select([]); const c = run('MakeWarperShapePair', { FxOp: warp, InputObj: [dstOnly, tree, src] });
    r.destinationFirst = [ok(c), L.map(l => l.items.length), L[0].items[1]?.shapeId === dstOnly.shapeId, L[0].items[1]?.wireSel, dstOnly.wireSel];
    r.elsewhere = bad(run('MakeWarperShapePair', { FxOp: warp, InputObj: [bez] }));
    r.stopsAtFirstNonShape = bad(run('MakeWarperShapePair', { FxOp: warp, InputObj: [tree, src] }));
    const d = run('MakeWarperShapePair', { FxOp: blur, InputObj: [src] }); r.notWarp = [bad(d), msg(d, 'Argument 1 must be a Warp or Morth operator')];
    const mo = add('Morph'); r.morph = [mo.classId, mo.shapeLists.length];
    out.warp = r;
  }

  // ---- tracker areas and tracking transport
  {
    const r = {}; const trk = add('Tracker'); const ix = (k) => trk.indexed.get(k); const kv = (k, t) => trk.fxKeys.get(k)?.get(t); let n0 = S.notifications.length;
    const a = run('SetFxTrackerTemplateArea', { FxOp: trk, Time: 10, Tracker: 1, x1: 1, y1: 2, x2: 3, y2: 4 });
    r.template = [ok(a), ['Left', 'Bottom', 'Right', 'Top'].map(c => ix('Template2.' + c)), ['Left', 'Bottom', 'Right', 'Top'].map(c => kv('Template2.' + c, 10)), noteFrom(n0), nya(a) > 0];
    const b = run('SetFxTrackerSearchArea', { FxOp: trk, Time: 12, x1: 5, y1: 6, x2: 7, y2: 8.1 });
    r.search = [ok(b), ['Left', 'Bottom', 'Right', 'Top'].map(c => ix('SearchArea1.' + c)), kv('SearchArea1.Top', 12) === Math.fround(8.1)];
    const c = run('SetFxTrackerTrackedPoint', { FxOp: trk, Time: 5, Tracker: 2, x: 1.5, y: 2.5 });
    r.point = [ok(c), [ix('TrackFullPos3.posx'), ix('TrackFullPos3.posy'), ix('TrackPos3.posx'), ix('TrackPos3.posy')], kv('TrackPos3.posy', 5), [...trk.indexed.keys()].filter(k => /^Track/.test(k))];
    A.undo(); r.pointUndo = [kv('TrackPos3.posy', 5) ?? null, kv('TrackFullPos3.posx', 5) ?? null];
    const fr = A.anim.frame; const d = run('SetFxTrackerTrackedPoint', { FxOp: trk, x: 9, y: 9 }); r.currentTime = [ok(d), kv('TrackPos1.posx', fr)];
    const size = trk.indexed.size; const e = run('SetFxTrackerTemplateArea', { FxOp: trk, Time: 1, Tracker: 99, x1: 1 }); r.noSuchRow = [ok(e), trk.indexed.size - size];
    const f = run('SetFxTrackerSearchArea', { FxOp: tree, Time: 1 }); r.notOp = [bad(f), msg(f, 'Argument must be a tracker operator')];
    const g = run('SetFxTrackerSearchArea', { FxOp: blur, Time: 1 }); r.notTracker = [bad(g), nya(g) > 0];
    out.tracker = r;

    const t = {}; const SW = '1569f817-8c17-4a80-a424-8b598cd4c9b9'; const u0 = undoLen(); const sw = () => trk.guidParams.get(SW);
    t.switch0 = sw();
    A.anim.frame = 7; const h = run('StartFxTracking', { InspectedObjectsArray: [trk, 5, 'x'] });
    t.start = [ok(h), sw(), S.tracking?.active, S.tracking?.command, S.tracking?.mode, S.tracking?.ops.length, A.anim.playing, A.anim.frame === A.anim.startFrame || A.anim.frame >= A.anim.startFrame, nya(h) > 0];
    A.anim.stop(); A.anim.frame = 20; t.startEnd = [sw(), S.tracking?.active];
    const i = run('CurrentFxTracking', { InspectedObjectsArray: [trk] }); t.current = [ok(i), sw(), S.tracking?.command, A.anim.playing];
    await tick(); A.anim.stop(); A.anim.frame = 30; t.currentEnd = [sw(), S.tracking?.active];
    const j = run('StepFxTracking', { InspectedObjectsArray: [trk] }); t.step = [ok(j), sw(), S.tracking?.command, A.anim.frame, A.anim.playing];
    A.anim.frame = 32; t.stepEnd = [sw(), S.tracking?.active];
    const k = run('StepFxTracking', { InspectedObjectsArray: [5] }); t.noObjects = [ok(k), S.tracking?.ops.length]; S.endTracking();
    t.noList = [bad(run('StartFxTracking', { InspectedObjectsArray: [] })), bad(run('CurrentFxTracking', { InspectedObjectsArray: trk })), bad(run('StepFxTracking'))];
    t.notUndoable = undoLen() - u0;
    out.tracking = t;
  }
  return out;
}, { NAMES });
await browser.close();

let checks = 0; const fails = [];
const eq = (label, g, want) => { checks++; const ok = JSON.stringify(g) === JSON.stringify(want); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${JSON.stringify(want)}\n       got  ${JSON.stringify(g)}`); } };
const E_POINTER = '80004003', E_FAIL = '80004005', E_INVALIDARG = '80070057', NOT_CONNECTED = '80020003';
const T = true, F = false;

// 1. registration: registry names, labels and argument lists (return value excluded)
for (const n of NAMES) eq(`${n}: registered with the registry label and argument names / defaults`, got.registered[n], registry[n]);

// 2. default arguments
const DEF = { CreateFxTree: 'ok 0', StartFxTracking: E_POINTER, CurrentFxTracking: E_POINTER, StepFxTracking: E_POINTER };
for (const n of NAMES) eq(`${n}: default arguments, nothing selected -> ${DEF[n] ?? E_INVALIDARG}`, got.defaults[n], DEF[n] ?? E_INVALIDARG);

// 3. CreateFxTree
const C = got.tree;
eq('CreateFxTree: an object named FxTree of type FxTree under the scene root', C.made, [1, 'FxTree', 'FxTree', T, T]);
eq('CreateFxTree: undo deletes it; redo runs Do again (a fresh object)', [C.undo, C.redo], [0, [1, T, 'FxTree']]);
eq('CreateFxTree: returns the new object', C.second, ['0', 'FxTree1', T]);

// 4. AddFxOp
const O = got.addOp;
eq('AddFxOp: creates the operator in the tree and returns it; the type-name mapping is logged as not attested', O.blur, ['0', 'Blur', 'Blur', T, T, 1, T]);
eq('AddFxOp: tree by name; File Output class id', O.byName, ['0', 'FileOutputOp', '9acb71ff-0e3e-41cc-bb6b-d050b9dacd41', T]);
eq('AddFxOp: undo deletes the operator; redo creates a new object', [O.undo, O.redo], [[-1, F], [0, F, 'FileOutputOp']]);
eq('AddFxOp: empty type name refused (inferred status), wrong tree -> "Argument 1 must be an EffectsTree object"', [O.empty, O.notTree], [[E_INVALIDARG, T], [E_INVALIDARG, T]]);
eq('AddFxOp: File Input stand-in', O.fileInput, ['FileInputOp', 0, 'ca6f7760-1b1a-11d5-b93d-0800690c8bd0']);

// 5. SetFxOpPos
const P = got.pos;
eq('SetFxOpPos: the node centre becomes (x, y), size kept, explicitly positioned, FX_OP_ATTRIB_CHANGED', [P.rect0, P.moved], [[0, 0, 100, 25], ['0', [150, 67.5, 250, 92.5], T, ['FX_OP_ATTRIB_CHANGED']]]);
eq('SetFxOpPos: undo = the remembered centre, redo = (x, y)', [P.undo, P.redo], [[0, 0, 100, 25], [150, 67.5, 250, 92.5]]);
eq('SetFxOpPos: operator by name; not an operator -> "Argument must be an image operator"', [P.byName, P.notOp], [['0', [0, 0, 100, 25]], [E_INVALIDARG, T]]);

// 6. ConnectFxOp
const N = got.connect;
eq('ConnectFxOp: Op1 output -> the input of Op2 named by number', N.number, ['0', ['FileInput'], T, T]);
eq('ConnectFxOp: by input name; an existing source is replaced, undo restores it, redo reconnects', [N.nameReplaces, N.undoRestoresPrevious, N.redo], [['0', T], T, T]);
eq('ConnectFxOp: "AllInputs" (any case) does nothing and succeeds', N.allInputs, ['0', T, T]);
eq('ConnectFxOp: unresolved name / output port / not an operator -> 0x80070057 with the contract texts', [N.empty, N.output, N.notOp], [[E_INVALIDARG, T], [E_INVALIDARG, T], [E_INVALIDARG, T]]);
eq('ConnectFxOp: an input with an on/off parameter gets it set to True (SetValue sub-task, undone with the command)', [N.selectOn, N.selectUndo], [['0', T, T], [null, null]]);

// 7. SetFxOpCnxFlag
const G = got.cnxFlag;
eq('SetFxOpCnxFlag: Invert writes parameter index n + 13; undo replays the SetValue', [G.invert, G.invertUndo], [['0', F], null]);
eq('SetFxOpCnxFlag: first three characters of the flag name, any case; a non-boolean Value counts as true; Select = index n + 5', G.select, ['0', T]);
eq('SetFxOpCnxFlag: input without the flag -> 0x80070057', G.noFlag, E_INVALIDARG);
eq('SetFxOpCnxFlag: error texts', [G.badFlag, G.badCnx, G.notOp], [[E_INVALIDARG, T], [E_INVALIDARG, T], [E_INVALIDARG, T]]);

// 8. DisconnectFxOp
const D = got.disconnect;
eq('DisconnectFxOp: "All" / "AllInputs" succeed without disconnecting anything (as shipped)', [D.all, D.allInputs], [['0', T, T], ['0', T]]);
eq('DisconnectFxOp: single connection; undo reconnects the remembered source; redo disconnects', [D.one, D.undo, D.redo], [['0', null], T, null]);
eq('DisconnectFxOp: input not connected -> 0x80020003', D.notConnected, NOT_CONNECTED);
eq('DisconnectFxOp: wrong Op raises the connection text; an output name -> 0x80070057', [D.notOp, D.output], [[E_INVALIDARG, T], E_INVALIDARG]);

// 9. SetFxOpAttrib
const AT = got.attrib;
eq('SetFxOpAttrib Rect: the four numbers are written to the node rectangle, FX_FXTOBJ_VISUALCHG fired', AT.rect, ['0', [10, 20, 200, 90], ['FX_FXTOBJ_VISUALCHG']]);
eq('SetFxOpAttrib Rect: r1/r3 and r0/r2 swapped into order; undo restores the previous values', [AT.swapped, AT.undo], [['0', [110, 120, 300, 190]], [10, 20, 200, 90]]);
eq('SetFxOpAttrib Rect: height below 25 -> r3 = r1 + 25; width below 60 -> r3 = r1 + 100 (as coded)', AT.minimums, ['0', [0, 0, 30, 100]]);
eq('SetFxOpAttrib ShowThumbnail: accepted, nothing written (also for two operators with 8 values)', [AT.thumbnail, AT.thumbnailTwo], [['0', [0, 0, 30, 100], T], '0']);
eq('SetFxOpAttrib: Rect for two operators, wrong element count, not an array -> 0x80070057', [AT.rectTwo, AT.count, AT.notArray], [E_INVALIDARG, E_INVALIDARG, E_INVALIDARG]);
eq('SetFxOpAttrib: List / Help / ? / unknown names rejected with "Argument 2 must be an attribute name"', AT.rejectedNames, Array(5).fill([E_INVALIDARG, T]));
eq('SetFxOpAttrib: no operator -> "Argument 1 must be one or more fx operator"', AT.noOp, [E_INVALIDARG, T]);

// 10. clipboard
const K = got.clip; const GUID = '0322d097-8d58-411b-95ee-a3fb0707052a';
eq('PasteFxOp: nothing on the clipboard -> 0x80004005', K.emptyClipboard, E_FAIL);
eq('CopyFxOp: format name, operator count, one chunk per FX operator, _xnc chunk (GUID; per input: source position or -1, source output); tree untouched; nothing to undo',
  K.copy, ['0', 'Persisted Softimage|FX Operators', 2, ['Blur', 'Glow'], GUID, [[[-1, 0]], [[0, 0]]], 3, 0]);
eq('PasteFxOp: operators added to the tree, internal connections replayed, outside sources dropped, layout offset +64 / +32 and explicitly positioned',
  K.paste, ['0', ['Blur1', 'Glow1'], ['Blur', 'Glow'], T, null, [T, T], [[64, 32, 64, 32], [64, 32, 64, 32]]]);
eq('PasteFxOp: undo deletes the pasted operators; redo brings the same operators back', [K.pasteUndo, K.pasteRedo], [[3, null], [5, T, T, T]]);
eq('CutFxOp: copies, then deletes the operators (connections they feed are dropped)', K.cut, ['0', ['FileInput', 'Glow'], null, 1, [[[-1, 0]]]]);
eq('CutFxOp: undo brings the operators and their connections back, the clipboard is not restored; redo deletes again', [K.cutUndo, K.cutRedo], [[['FileInput', 'Blur', 'Glow'], T, T, T, 1], ['FileInput', 'Glow']]);
eq('CopyFxOp: no FX operator in the list -> 0x80070057; omitted list = the selection', [K.noOps, K.selection, K.nothing], [E_INVALIDARG, ['0', ['Glow']], [E_INVALIDARG, T]]);
eq('PasteFxOp: wrong tree -> "Argument must be a FxTree object"', K.notTree, [E_INVALIDARG, T]);

// 11. AddPassInputFxOp
const PI = got.passInput;
eq('AddPassInputFxOp: File Input operator in the tree; parameter 2 = framebuffer file name, 4 / 5 = the range integers; returned', PI.made, ['0', 'FileInputOp', 'ca6f7760-1b1a-11d5-b93d-0800690c8bd0', T, T, T, T, T, T, T]);
eq('AddPassInputFxOp: undo deletes the operator; pass by name, framebuffer name without case', [PI.undo, PI.byName], [F, ['0', 'FileInputOp']]);
eq('AddPassInputFxOp: no matching framebuffer -> 0x80070057; not a pass -> failure', [PI.noFramebuffer, PI.notPass], [E_INVALIDARG, E_INVALIDARG]);
eq('AddPassInputFxOp: pass not set to render a sequence -> message 0x2d, status 1, no operator', PI.notSequence, ['1', null, 0, T]);

// 12. AddImageClipFxOp
const IC = got.imageClip;
eq('AddImageClipFxOp: two clip operators (class ids A, B), A connected to B, ClipName on both, clip bound; A returned', IC.made,
  ['0', 2, '68cb0090-3ae7-4951-a12a-178d1d44d961', '4288036e-a57b-4c17-98f7-c4f394c5aaec', 'woodClip', 'woodClip', T, T, T, T]);
eq('AddImageClipFxOp: undo deletes both; clip by name', [IC.undo, IC.byName], [0, ['0', 'woodClip']]);
eq('AddImageClipFxOp: error texts', [IC.notClip, IC.notTree], [[E_INVALIDARG, T], [E_INVALIDARG, T]]);

// 13. paint clip commands
const PC = got.paint;
eq('paint clip stand-in operator', PC.isClip, ['FilePaintOp', T]);
eq('SavePaintClip: no frame precheck; an empty frame set does nothing', PC.saveNothing, ['0', 0]);
eq('Revert* / Select / Clear: no modified frame on the first clip -> "There are no modified frames"', PC.noModified, Array(4).fill([E_INVALIDARG, T]));
eq('SaveSelected / RevertSelected / Goto / Prev / Next: no selected frame -> "No paint clip frames are selected" (checked first)', PC.noSelected, Array(5).fill([E_INVALIDARG, T]));
eq('stand-in paint: three modified frames', PC.painted, ['3m 5m 8m', 3]);
eq('SelectPaintClipFrames: replaces the selection, values coerced to integers, frames without paint data ignored, UI refresh (0x14, 0xf)', PC.select, ['0', '3m 5ms 8ms', [0x14, 0xf]]);
eq('Goto / Prev / Next: validate and succeed without any effect', [PC.gotoPrevNext, PC.gotoNoEffect], [['0', '0', '0'], ['3m 5ms 8ms', T]]);
eq('SaveSelectedPaintClipFrames: no output file name -> message 0x25 logged, nothing written, command succeeds', PC.noFileName, ['0', 3, T, 0]);
eq('SaveSelectedPaintClipFrames: no parser for the name -> "Unsupported Image Format" (inferred trigger)', PC.noFormat, ['0', T, 3]);
eq('SaveSelectedPaintClipFrames: selected + modified frames written in ascending order as image number key - start offset; modified flag cleared, counter decremented, "Wrote File", refresh then 0x3e9',
  PC.saveSelected, ['0', ['C:\\out\\paint.4.pic', 'C:\\out\\paint.7.pic'], '3m 5s 8s', 1, T, T, [0x14, 0xf, 0x3e9], T]);
eq('SaveSelectedPaintClipFrames: selected frames that are not modified are skipped', PC.saveSelectedAgain, ['0', 2]);
eq('SavePaintClip: InputObj omitted = the selection; all modified frames', PC.saveBySelection, ['0', ['C:\\out\\paint.2.pic'], '3 5s 8s', 0]);
eq('RevertPaintClipFrame: Time truncated; frame entry and the two cached buffers removed, counter decremented, refresh + 0x3e9', PC.revertFrame, ['0', '5s 8s', 0, 0, [0x14, 0xf, 0x3e9]]);
eq('RevertPaintClipFrame: omitted Time = current frame (inferred); a frame not in the map is not an error', [PC.revertCurrent, PC.revertAbsent], [['0', F, 1], ['0', 1]]);
eq('RevertSelectedPaintClipFrame: every selected frame reverted (their selection goes with them)', PC.revertSelected, ['0', '40m', 1]);
eq('ClearPaintClipFrameSelection: flags cleared, refresh only when something was cleared', PC.clear, ['0', '40m', [0x14, 0xf], '0', 0]);
eq('SelectPaintClipFrames: an empty array only clears', PC.selectEmpty, ['0', '40m']);
eq('SelectPaintClipFrames: Frames not an array of numbers -> 0x80070057', PC.badFrames, [E_INVALIDARG, E_INVALIDARG, E_INVALIDARG]);
eq('paint clip task: the first object must be a paint clip', PC.firstNotClip, E_INVALIDARG);
eq('RevertPaintClip: everything discarded (logged as not attested), refresh + 0x3e9; other list items ignored', PC.revertAll, ['0', 0, 0, 0, [0x14, 0xf, 0x3e9], T]);
eq('paint clip commands are not undoable', PC.notUndoable, 0);

// 14. RenderFxOp
const R = got.render;
eq('RenderFxOp: frames start..end by step, "Rendering Images", "Rendering <name>", timing line per frame, "Done Rendering Fx Op.  Total Render Time"; dialog and image evaluation logged as not attested',
  R.render, ['0', ['C:\\r\\out.2.pic', 'C:\\r\\out.4.pic', 'C:\\r\\out.6.pic'], T, T, 3, T, T]);
eq('RenderFxOp: InputObj omitted = the selection; no file name -> "** Output File Name Not Set ***"; Interactive wait logged as not attested', R.noName, ['0', ['** Output File Name Not Set ***'], T]);
eq('RenderFxOp: empty range renders nothing and succeeds', R.emptyRange, ['0', 0, F]);
eq('RenderFxOp: not a File Output operator -> 0x80070057; not undoable', [R.notFileOutput, R.notUndoable], [E_INVALIDARG, 0]);

// 15. Add2DShape
const SH = got.addShape;
eq('Add2DShape Bezier: Bezier shape added to the list, selected, returned', SH.bezier, ['0', 'Bezier', 'bezier', 0, T, T, T]);
eq('Add2DShape: undo deletes the shape; redo creates a new shape object', [SH.undo, SH.redo], [[0, F], [1, T, 'Bezier']]);
eq('Add2DShape: "bsp..." -> point shape type 0, "pol..." -> point shape type 2 (first three characters, any case)', [SH.bspline, SH.polygon], [['0', 'PointShape', 0, 1], ['0', 'PointShape', 2, T]]);
eq('Add2DShape: other type strings (and the default "") -> the type error text', SH.badType, Array(3).fill([E_INVALIDARG, T]));
eq('Add2DShape: not a shape list -> "Argument 1 must be a 2D shape list"', SH.notList, [E_INVALIDARG, T]);

// 16. points
const PT = got.points;
eq('Add2DShapePoint: appends; Value = index + 1; Bezier records hold 7 doubles', PT.add, ['0', 1, 2, [[1, 2], [3, 4]], 7]);
eq('Insert2DShapePoint: inserts at the position; Value = index + 1; undo removes, redo re-adds', [PT.insert, PT.insertUndo, PT.insertRedo], [['0', 2, [[1, 2], [9, 9], [3, 4]]], [[1, 2], [3, 4]], [[1, 2], [9, 9], [3, 4]]]);
eq('Insert2DShapePoint defaults (position 0, x 0, y 0); Add2DShapePoint by position', [PT.insertDefault, PT.positional], [[1, [0, 0]], [4, [7, 8]]]);
eq('Add2DShapePointArray: pairs appended, elements converted to numbers, no output; point-shape records hold 2 doubles', PT.array, ['0', null, [[0, 0], [1, 0], [1, 1]], 2]);
eq('Add2DShapePointArray: undo removes the appended points', [PT.arrayMore, PT.arrayUndo], [5, [[0, 0], [1, 0], [1, 1]]]);
eq('Add2DShapePointArray: odd, empty, non-numeric, scalar or missing array -> 0x80070057', PT.badArrays, Array(5).fill(E_INVALIDARG));
eq('2D shape commands: not a shape -> "Argument 1 must be a 2D shape"', PT.notShape, Array(12).fill([E_INVALIDARG, T]));
eq('Add2DShapePoint: a value that is not a number -> 0x80070057', PT.badNumber, E_INVALIDARG);

// 17. transform
const TR = got.transform;
eq('Move2DShape / Scale2DShape / Move2DShapePin / Set2DShapeRotation: absolute values into PosX PosY / SclX SclY / PinX PinY / Rotate; no key without auto-key', TR.set, [['0', '0', '0', '0'], [5, 6, 2, 3, 7, 8, 45], 0]);
eq('shape transform: undo replays the SetValue sub-tasks', TR.undo, [5, 6, 2, 3, 0, 0, 0]);
eq('shape transform: ambient FXSH_AUTOKEY_PTS true -> SaveKey at the current time for each value; undone with the command', [TR.ambientKey, TR.ambientUndo], [[[1, -1], 1, -1, 2], [[5, 6], 0]]);
eq('shape transform: a non-boolean ambient value does not key; preference animation.autokey keys', [TR.ambientNotBoolean, TR.prefKey], [0, [30, 30, 1]]);
eq('Move2DShape defaults: x 0, y 0', TR.defaults, ['0', [0, 0]]);

// 18. point editing
const PE = got.pointEdit;
eq('Move2DShapePoint / LHandle / RHandle: absolute x, y of the component', PE.move, [['0', '0', '0'], [20, 21, 18, 19, 22, 23], 0]);
eq('Move2DShape*: undo replays the sub-tasks; auto-key keys x and y', [PE.undo, PE.keyed], [[9, 9], [11, 12, 2]]);
eq('Move2DShape*: bad index / a handle on a shape without handles -> failure (inferred status)', PE.badIndex, [E_INVALIDARG, E_INVALIDARG, E_INVALIDARG]);
eq('Delete2DShapePoint: removes the point; undo re-inserts it with its saved record; redo removes again', [PE.del, PE.delUndo, PE.delRedo], [['0', [[1, 2], [3, 4]]], T, 2]);
eq('Delete2DShapePoint: index outside 0..count-1 -> 0x80070057; default index 0', [PE.delBad, PE.delDefault], [[E_INVALIDARG, E_INVALIDARG], ['0', [[1, 0], [1, 1]]]]);
eq('Key2DShapePoints: all points, 6 keys per point for a shape with handles, current values; undo removes the keys', [PE.keyAll, PE.keyUndo], [['0', 18, 18, 4], 0]);
eq('Key2DShapePoints: index array (unknown points skipped), 2 keys per point without handles', PE.keySome, ['0', 4, ['0.x', '0.y', '2.x', '2.y'], 1]);
eq('Key2DShapePoints: empty array or scalar -> all points; non-numeric element -> 0x80070057', [PE.keyEmptyArray, PE.keyScalar, PE.keyBad], [['0', 6], ['0', 6], E_INVALIDARG]);

// 19. MakeWarperShapePair
const W = got.warp;
eq('MakeWarperShapePair: source shape duplicated into the destination list (same id), both styled (source 0.8,0,0.8 / 1,0,1; destination 0,0.5,0.5 / 0,1,1), correspondence in lists 2 and 4 (initialisation logged), no undo entry',
  W.pair, ['0', [1, 1, 1, 1], T, T, T, T, [T, [0.8, 0, 0.8], [1, 0, 1]], [T, [0, 0.5, 0.5], [0, 1, 1]], T, 'CorrespondenceVector', 2, 0]);
eq('MakeWarperShapePair: from the destination shape (selection as input): nothing new (the correspondences of that shape id exist), styles by list', W.fromDestination, ['0', [1, 1, 1, 1], [0.8, 0, 0.8], [0, 0.5, 0.5], 0]);
eq('MakeWarperShapePair: a destination-only shape gets a source partner; the walk stops at the first non-shape', W.destinationFirst, ['0', [2, 2, 2, 2], T, [1, 0, 1], [0, 1, 1]]);
eq('MakeWarperShapePair: shape in neither list / list starting with a non-shape -> 0x80070057', [W.elsewhere, W.stopsAtFirstNonShape], [E_INVALIDARG, E_INVALIDARG]);
eq('MakeWarperShapePair: not a Warp / Morph operator -> "Argument 1 must be a Warp or Morth operator"', W.notWarp, [E_INVALIDARG, T]);
eq('Morph stand-in: second accepted class id, four shape lists', W.morph, ['bc0f7833-15b6-4ef4-8c22-ba7694c8b4e1', 4]);

// 20. tracker areas
const TK = got.tracker;
eq('SetFxTrackerTemplateArea: four values to row Tracker + 0, keyed at Time, "tracker data changed"', TK.template, ['0', [1, 2, 3, 4], [1, 2, 3, 4], ['tracker data changed'], T]);
eq('SetFxTrackerSearchArea: row Tracker + 8, values converted to 32-bit floats', TK.search, ['0', [5, 6, 7, Math.fround(8.1)], T]);
eq('SetFxTrackerTrackedPoint: the same x, y written to row Tracker + 20, then Tracker + 12', TK.point, ['0', [1.5, 2.5, 1.5, 2.5], 2.5, ['TrackFullPos3.posx', 'TrackFullPos3.posy', 'TrackPos3.posx', 'TrackPos3.posy']]);
eq('tracker areas: undo replays the SaveKey sub-tasks; omitted Time = current frame (inferred); rows the operator does not have are skipped', [TK.pointUndo, TK.currentTime, TK.noSuchRow], [[null, null], ['0', 9], ['0', 0]]);
eq('tracker areas: not an FX operator -> "Argument must be a tracker operator"; an FX operator without the tracker interface -> failure, logged (inferred)', [TK.notOp, TK.notTracker], [[E_INVALIDARG, T], [E_POINTER, T]]);

// 21. tracking transport
const TG = got.tracking;
eq('StartFxTracking: switch parameter set to True, PlayForwardsFromStart run, status 1; non-object array elements ignored', [TG.switch0, TG.start], [F, ['1', T, T, 'PlayForwardsFromStart', 0, 1, T, T, T]]);
eq('tracking: the end-of-playback notification sets the switch back to False and removes the listeners (inferred event)', TG.startEnd, [F, F]);
eq('CurrentFxTracking: PlayForwards, status 1; ends the same way', [TG.current, TG.currentEnd], [['1', T, 'PlayForwards', T], [F, F]]);
eq('StepFxTracking: NextFrame (one frame), status 1; ends the same way', [TG.step, TG.stepEnd], [['1', T, 'NextFrame', 31, F], [F, F]]);
eq('tracking: an array without objects still gives a list; an empty array or a non-array -> 0x80004003', [TG.noObjects, TG.noList], [['1', 0], [E_POINTER, E_POINTER, E_POINTER]]);
eq('tracking commands are not undoable', TG.notUndoable, 0);

eq('page errors', pageErrors, []);

if (fails.length) {
  console.error(`FAIL CMD-B9e/f/g fxcore task commands: ${fails.length} of ${checks} checks`);
  for (const x of fails) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B9e/f/g fxcore task commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden; stand-in FX Tree model)`);
