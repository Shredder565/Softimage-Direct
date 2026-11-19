// CMD-B11d / B11g / B11h / B11i: the CMD-B10 commands (PR #180, wired by inference) corrected to the analyst's
// binary-read wire contracts, plus the new ExportImageClip (B11h) and AddToTOC (B11c). Notes:
//   docs/ghidra/cmd-b11d-tasks-b10-confirmations-binary.md            (tasks.dll)
//   docs/ghidra/cmd-b11g-action-camseq-b10-confirmations-binary.md    (action.dll)
//   docs/ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md (vm.dll)
//   docs/ghidra/cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md (transformmanager.dll)
//   docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md   (AddToTOC)
//   digest docs/re/WIRE_CORRECTIONS_B11.md
// No XSIBATCH golden exists: this checks the contract statements per command.
//   1. registered with the registry argument list (data/command_registry.json, first entry, return values left out);
//   2. default run on the demo scene (cube selected): no unexpected error; required inputs fail with a message naming the command;
//   3. the corrected behaviour of each command (values exact; view positions to 1e-6, pixel offsets to 1e-3 px).
// Needs `vite preview` (SI_URL, default http://localhost:4173/?demo). Usage: node tools/compare_b11_b10_corrections.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const ROWS = {
  'CMD-B11d': ['CreateFolder', 'GetSize', 'MoveComponent', 'MoveToFolder', 'NavigateNode', 'PinAllUVComponents', 'PinUVComponents', 'RemoveFromFolder', 'SelectNeighborObj', 'Tag', 'UnPinAllUVComponents', 'UnPinUVComponents', 'Untag'],
  'CMD-B11g': ['AddToTOC', 'GetSceneFrameSetFromCamSeq', 'PlotCamSeqShape', 'PlotCamSeqToActions'],
  'CMD-B11h': ['AlignViewCamera', 'CameraRedo', 'CameraUndo', 'ExportImageClip', 'Frame Contextual', 'GetViewIndex', 'Hide Back Facing Polygons', 'LoadFastPlaybackCache', 'ResetAllViews', 'SaveFastPlaybackCache', 'SetViewCamera', 'Show3DContextMenu', 'StartTimedPlayback', 'ToggleMuteSolo', 'ViewNudgeDown', 'ViewNudgeLeft', 'ViewNudgeRight', 'ViewNudgeUp', 'ViewTranslate'],
  'CMD-B11i': ['MoveComponent', 'RotateUVW', 'ScaleUVW', 'TranslatePivot', 'TranslateUVW'],
};
const NAMES = [...new Set(Object.values(ROWS).flat())];
// batch 12: MoveToFolder with a NULL folder returns 1 (no failure)
const DEFAULT_FAILS = new Set(['CreateFolder', 'RemoveFromFolder', 'NavigateNode', 'PinUVComponents', 'UnPinUVComponents', 'PinAllUVComponents',
  'UnPinAllUVComponents', 'Tag', 'Untag', 'GetSize', 'SetViewCamera', 'ExportImageClip']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ExportImageClip') && !!window.Application?.scene?.find('cube') && !!window.__vm, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => `${l.kind}:${l.text}`) }; } catch (e) { return { err: String(e?.message ?? e), status: e?.status, log: A.log.slice(m).map(l => `${l.kind}:${l.text}`) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const st = () => A.inferredB10.status;
  const cube = A.scene.find('cube'), root = A.scene.root; const vm = window.__vm; const vps = vm.viewports();
  try { A.hostFs.ensureFolder('C:\\Users\\Public'); } catch { /* */ }
  const reset = () => { A.setTool(null); window.__navTool?.set(null); A.select([cube]); A.compSel = null; };
  const act = () => vps.indexOf(vm.active());
  const V = (v) => [v.x, v.y, v.z];
  const near = (a, b, e = 1e-6) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= e);

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const f0 = A.anim.frame; const u0 = A.undoStack.length; const cams = vps.map(v => [v.camera.position.clone(), v.camera.up.clone(), v.name]);
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    vps.forEach((v, i) => { v.camera.position.copy(cams[i][0]); v.camera.up.copy(cams[i][1]); });
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
    A.anim.frame = f0;
  }
  reset(); run('ResetAllViews');

  // ================================================================ CMD-B11d
  {
    const kids = root.children.map(o => o.name).join(' ');
    out.kids = kids;
    const nav = (a) => { const r = run('NavigateNode', a); return r.err ? 'ERR ' + (r.status ?? '') : r.v?.name; };
    const sameNext = (src, s, loop) => { const k = root.children; const i = k.indexOf(src); for (let j = 1; j < k.length; j++) { const x = i + s * j; if (!loop && (x < 0 || x >= k.length)) return src; const e = k[(x % k.length + k.length) % k.length]; if (e.type === src.type) return e; } return src; };
    ok('NavigateNode default (1) = parent', nav({ Source: 'cube' }) === root.name);
    ok('NavigateNode 2 = first child; none = Source itself', nav({ Source: root, NavDirection: 2 }) === root.children[0].name && nav({ Source: 'cube', NavDirection: 2 }) === 'cube');
    // batch 12 (B11d Q1): below the root a leaf steps to the next / previous leaf (depth first), an element with children to
    // the next / previous element at the same depth; NavLoop wraps; flag 0x8 repeats the step; the filter applies at the root
    const dfs = []; const walkT = (o, d) => { dfs.push([o, d]); o.children.forEach(c => walkT(c, d + 1)); }; walkT(root, 0);
    const leaves = dfs.filter(([o]) => o !== root && !o.children.length).map(([o]) => o);
    const li = leaves.indexOf(cube);
    ok('NavigateNode 3 = next leaf (depth first)', nav({ Source: 'cube', NavDirection: 3 }) === (leaves[li + 1] ?? cube).name, [nav({ Source: 'cube', NavDirection: 3 }), leaves.map(o => o.name)]);
    ok('NavigateNode 4 = previous leaf', nav({ Source: 'cube', NavDirection: 4 }) === (leaves[li - 1] ?? cube).name);
    const lastLeaf = leaves[leaves.length - 1];
    ok('NavigateNode 3 on the last leaf: not found = Source; NavLoop wraps to the first leaf', nav({ Source: lastLeaf, NavDirection: 3 }) === lastLeaf.name && nav({ Source: lastLeaf, NavDirection: 3, NavLoop: true }) === leaves[0].name);
    if (leaves[li + 1] && leaves[li + 2]) { leaves[li + 1].navFlags = 8; ok('NavigateNode: element flag 0x8 repeats the step', nav({ Source: 'cube', NavDirection: 3 }) === leaves[li + 2].name); delete leaves[li + 1].navFlags; }
    { const P = run('GetPrim', { PresetObj: 'Null', Name: 'b12NavP' }).v, Q = run('GetPrim', { PresetObj: 'Null', Name: 'b12NavQ' }).v, k1 = run('GetPrim', { PresetObj: 'Null', Name: 'b12NavK1' }).v, k2 = run('GetPrim', { PresetObj: 'Null', Name: 'b12NavK2' }).v;
      P.addChild(k1); Q.addChild(k2);
      const d1 = []; const w2 = (o, d) => { d1.push([o, d]); o.children.forEach(c => w2(c, d + 1)); }; w2(root, 0);
      const same = d1.filter(([o, d]) => o !== root && d === 1).map(([o]) => o); const pi = same.indexOf(P);
      ok('NavigateNode 3 from an element with children = next element at the same depth', nav({ Source: P, NavDirection: 3 }) === (same[pi + 1] ?? P).name, [nav({ Source: P, NavDirection: 3 }), same.map(o => o.name)]);
      root.removeChild(P); root.removeChild(Q); root.removeChild(k1); root.removeChild(k2); }
    const polys = root.children.filter(o => o.type === cube.type);
    ok('NavigateNode 5 / 6 = first / last sibling of the same type', nav({ Source: 'cube', NavDirection: 5 }) === (polys[0] === cube ? cube : polys[0]).name && nav({ Source: 'cube', NavDirection: 6 }) === (polys[polys.length - 1] === cube ? cube : polys[polys.length - 1]).name, [nav({ Source: 'cube', NavDirection: 5 }), nav({ Source: 'cube', NavDirection: 6 })]);
    ok('NavigateNode on the hierarchy root: pre-order walk (3 = first element, 4 = last element with NavFilter 10)', nav({ Source: root, NavDirection: 3, NavFilter: 10 }) === root.children[0].name && nav({ Source: root, NavDirection: 4, NavFilter: 10 }) === (() => { let o = root; while (o.children.length) o = o.children[o.children.length - 1]; return o.name; })());
    ok('NavigateNode on the root with the default filter: no other element of its type = the root', nav({ Source: root, NavDirection: 3 }) === root.name);
    const bad = [nav({ Source: 'cube', NavDirection: 0 }), nav({ Source: 'cube', NavDirection: 7 }), nav({ Source: 'cube', NavFilter: 12 }), nav({ Source: 'cube', NavFilter: 0 }), nav({}), nav({ Source: 'nothing' })];
    ok('NavigateNode NavDirection 0 / 7, NavFilter 0 / 12, missing or invalid Source = E_INVALIDARG', bad.every(x => x === 'ERR ' + 0x80070057), bad);
    ok('NavigateNode NavFilter 1..9 flags the type-code numbering', nya(run('NavigateNode', { Source: 'cube', NavFilter: 3 })) === 1);
    ok('NavigateNode changes nothing (not undoable)', (() => { const u = A.undoStack.length; run('NavigateNode', { Source: 'cube', NavDirection: 3 }); return A.undoStack.length === u; })());
  }
  {
    const r0 = run('CreateFolder', {}); ok('CreateFolder: Target required (E_INVALIDARG)', r0.status === 0x80070057 && /CreateFolder/.test(r0.err), r0);
    const prop = cube.properties[0]; const r1 = run('CreateFolder', { Target: prop }); ok('CreateFolder: a Target without the insert interface fails', r1.status === 0x80004002, r1);
    const a = run('CreateFolder', { Target: 'cube', Name: 'Fold' }).v, b = run('CreateFolder', { Target: 'cube', Name: 'Fold' }).v, c = run('CreateFolder', { Target: 'cube', Name: '' }).v;
    ok('CreateFolder: Name verbatim, no suffixing; empty Name = class default', a.name === 'Fold' && b.name === 'Fold' && c.name === 'Folder' && cube.folders.includes(a) && cube.folders.includes(b), [a.name, b.name, c.name]);
    const sphere = A.scene.find('sphere');
    const mv = run('MoveToFolder', { Target: a, InputObjs: 'sphere' }); ok('MoveToFolder adds the member, no return value', mv.v === undefined && a.members.includes(sphere), mv);
    const mv2 = run('MoveToFolder', { Target: b, InputObjs: 'sphere' }); ok('MoveToFolder from another folder: taken out, flagged (unread worker)', !a.members.includes(sphere) && b.members.includes(sphere) && nya(mv2) === 1, mv2.log);
    A.undo(); ok('MoveToFolder undo', a.members.includes(sphere) && !b.members.includes(sphere));
    const n0 = a.members.length; const bad = run('MoveToFolder', { Target: 'cube', InputObjs: 'sphere' });
    { const nf = run('MoveToFolder', { InputObjs: 'sphere' }); ok('MoveToFolder: NULL folder returns 1, no change (batch 12)', !nf.err && st().MoveToFolder === 1 && a.members.length === n0, nf); }
    ok('MoveToFolder: non-folder Target fails, nothing changed', /MoveToFolder: Target is not a folder/.test(bad.err) && a.members.length === n0, bad);
    const rm = run('RemoveFromFolder', { Target: a, InputObjs: 'sphere' }); ok('RemoveFromFolder removes, no return value', rm.v === undefined && !a.members.includes(sphere), rm);
    const rmBad = run('RemoveFromFolder', { Target: 'cube', InputObjs: 'sphere' }); ok('RemoveFromFolder: non-folder Target fails', /RemoveFromFolder: Target is not a folder/.test(rmBad.err), rmBad);
    A.undo(); ok('RemoveFromFolder undo', a.members.includes(sphere));
    for (let k = 0; k < 6; k++) A.undo();
    ok('CreateFolder undo', !cube.folders.includes(a) && !cube.folders.includes(b) && !cube.folders.includes(c), cube.folders.map(f => f.name));
  }
  {
    reset(); try { A.run('CreateTextureProj', { InputObjs: [cube], ProjectionName: 'B11Proj' }); } catch { /* */ }
    const proj = cube.property('uvprojection');
    if (!proj) ok('a texture projection on the cube for the pin checks', false);
    else {
      const bits = () => [...proj.pinnedSamples].sort((x, y) => x - y).join();
      const e1 = run('PinUVComponents', { UVProp: 'cube', UVComponents: '' }); const e2 = run('UnPinUVComponents', { UVProp: 'cube' });
      ok('Pin / UnPinUVComponents: empty UVComponents = E_INVALIDARG', e1.status === 0x80070057 && e2.status === 0x80070057, [e1, e2]);
      const p1 = run('PinUVComponents', { UVProp: 'cube', UVComponents: '0,2-3' }); ok('PinUVComponents ORs the bits, no return value', p1.v === undefined && bits() === '0,2,3' && proj.pinnedBits[0] === 0b1101, [bits(), p1]);
      const total = proj.pinnedBits.length * 8;
      const oor = run('PinUVComponents', { UVProp: 'cube', UVComponents: [1, 100000] }); ok('PinUVComponents: one index out of range fails the whole command', oor.status === 0x80070057 && bits() === '0,2,3', oor);
      const neg = run('UnPinUVComponents', { UVProp: 'cube', UVComponents: [-1] }); ok('UnPinUVComponents: negative index fails', neg.status === 0x80070057);
      run('UnPinUVComponents', { UVProp: 'cube', UVComponents: [2] }); ok('UnPinUVComponents clears the bits', bits() === '0,3');
      run('PinAllUVComponents', { UVProp: 'cube' }); const all = proj.pinnedSamples.size; ok('PinAllUVComponents sets every bit', all >= total - 7 && all > 3, [all, total]);
      run('UnPinAllUVComponents', { UVProp: 'cube' }); ok('UnPinAllUVComponents clears every bit', proj.pinnedSamples.size === 0); A.undo(); ok('UnPinAll undo', proj.pinnedSamples.size === all);
      A.lockRecordsB11.set(proj, [{ id: 0, lockLevel: 0xffff, tagLevel: 0, type: 0 }]);
      const lk = run('PinUVComponents', { UVProp: 'cube', UVComponents: [1] }); ok('PinUVComponents on a locked UVProp = lock error 0x80070005', lk.status === 0x80070005, lk);
      A.lockRecordsB11.delete(proj);
      const nu = run('PinAllUVComponents', {}); ok('PinAllUVComponents: UVProp required', nu.status === 0x80070057);
    }
  }
  {
    const big = 18446744073709552000;
    const g1 = run('GetSize', { InputObjs: 'cube' }).v; ok('GetSize, one object: static / dynamic / total', g1.StaticSize > 0 && g1.Value === g1.StaticSize + g1.DynamicSize && g1.Value < 1e12, g1);
    const g2 = run('GetSize', { InputObjs: 'cube,sphere' }).v; ok('GetSize, two objects: all outputs 2^64-1', g2.StaticSize === big && g2.DynamicSize === big && g2.Value === big && g2.Value === 1.8446744073709552e19, g2);
    const g0 = run('GetSize', { InputObjs: [] }).v; ok('GetSize, empty list: all outputs 2^64-1', g0.Value === big && g0.StaticSize === big, g0);
    ok('GetSize flags the traverser size definitions', nya(run('GetSize', { InputObjs: 'cube' })) === 1);
  }
  {
    const p = cube.kinematics.local.get('posy'); const R = A.lockRecordsB11; const lv = () => R.get(p)?.find(r => r.type === 2)?.tagLevel ?? 0; // batch 12: record {id, lockLevel, tagLevel, type}
    const t0 = run('Tag', { InputObjs: 'cube.kine.local.posy', Level: 0 }); ok('Tag Level 0 = E_INVALIDARG, XSITASKS 1073', t0.status === 0x80070057 && /The tag level 0 is invalid/.test(t0.err), t0);
    run('Tag', { InputObjs: 'cube.kine.local.posy', Level: 5 }); ok('Tag stores a type-2 lock record with the Level bits', lv() === 5 && R.get(p).length === 1);
    run('Tag', { InputObjs: 'cube.kine.local.posy', Level: 'siTag2' }); ok('Tag ORs further bits (siTag2 = 2)', lv() === 7);
    run('Untag', { InputObjs: 'cube.kine.local.posy', Level: 4 }); ok('Untag removes only the given bits', lv() === 3);
    run('Tag', { InputObjs: 'cube.kine.local.posy', Level: 1, SubType: 4 }); ok('Tag with SubType 4 untags', lv() === 2);
    const obj = run('Tag', { InputObjs: 'cube' }); ok('Tag record layout {id, lockLevel 0, tagLevel, type 2}', (() => { const r = R.get(p)?.find(x => x.type === 2); return r && r.lockLevel === 0 && r.id > 0; })());
    ok('Tag on an object (no component id): warning 1069 (severity 4), skipped, S_FALSE', obj.log.some(l => /^info:WARNING : .*XSITASKS 1069/.test(l)) && st().Tag === 1 && !R.has(cube), obj.log);
    const lockSub = run('Tag', { InputObjs: 'cube.kine.local.posy', SubType: 0 }); ok('Tag SubType 0 (lock path) flagged not yet attested', nya(lockSub) === 1 && lv() === 2);
    run('Untag', { InputObjs: 'cube.kine.local.posy' }); ok('Untag siTagAll (1023) removes the record', !R.has(p)); A.undo(); ok('Untag undo', lv() === 2);
    ok('Tag / Untag: InputObjs required', run('Untag', {}).status === 0x80070057);
    for (let k = 0; k < 5; k++) A.undo(); ok('Tag undo', !R.has(p), R.get(p));
  }
  {
    const sel = A.commands.get('SelectNeighborObj'); ok('SelectNeighborObj stays the 0-based selection command (not NavigateNode encoding)', sel && !A.inferredB10.registered.includes('SelectNeighborObj') && sel.args[1].name === 'NavigDirection' && sel.args[1].default === 0);
    reset(); const sn = run('SelectNeighborObj', { InputObjs: 'cube', NavigDirection: 3 }); ok('SelectNeighborObj 3 = next sibling (0-based registry encoding)', !sn.err && A.selectedObjects[0] === (A.scene.root.children[A.scene.root.children.indexOf(cube) + 1] ?? cube), [sn.err, A.selectedObjects.map(o => o.name)]); reset();
  }
  { reset(); const prim = cube.primitive; const n0 = prim.operators.length; const r = run('MoveComponent', { InputObjs: 'cube.pnt[0]' }); ok('MoveComponent (inferred, Q12 open) still adds a Move Component operator', r.v.CreatedObjs.length === 1 && prim.operators.length === n0 + 1); A.undo(); }

  // ================================================================ CMD-B11g
  {
    const tracks = () => A.scene.root.cameraSequencer?.tracks ?? [];
    const u0 = A.undoStack.length; const m = A.log.length;
    const e = run('GetSceneFrameSetFromCamSeq', { StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true });
    ok('GetSceneFrameSetFromCamSeq, empty: an empty array, no message, not undoable', Array.isArray(e.v) && e.v.length === 0 && A.log.slice(m).every(l => l.kind === 'cmd') && A.undoStack.length === u0, e);
    const pe = run('PlotCamSeqToActions', { InputObjs: 'cube.kine.local.posx', StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true });
    ok('PlotCamSeqToActions, empty frame set: XSIMSGCAT 463 error, status 0x562e80c7, nothing created', pe.v === undefined && !pe.err && pe.log.some(l => l === 'error:PlotCamSeqToActions: Unable to plot Camera Sequencer unless there are shot clips.') && st().PlotCamSeqToActions === 0x562e80c7 && !root.properties.some(p => p.type === 'actionsource'), pe);
    const se = run('PlotCamSeqShape', { InputObjs: 'cube', StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true });
    ok('PlotCamSeqShape, empty frame set: 463 error, 0x562e80c7', se.v === undefined && se.log.some(l => /^error:PlotCamSeqShape: Unable to plot/.test(l)) && st().PlotCamSeqShape === 0x562e80c7, se);
    const cam = [...A.scene.allObjects()].find(o => o.type === 'camera');
    run('AddShotClip', { Name: 'S1', Parent: cam.name, Frame: 1, StartFrame: 10, EndFrame: 14 }); run('AddShotClip', { Name: 'S2', Frame: 8, StartFrame: 50, EndFrame: 51 });
    ok('GetSceneFrameSetFromCamSeq returns the frame list unchanged (gap rule inferred)', JSON.stringify(run('GetSceneFrameSetFromCamSeq', { StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true }).v) === '[10,11,12,13,14,50,51]');
    const px = cube.kinematics.local.get('posx'); A.anim.setKey(px, 10, 1); A.anim.setKey(px, 60, 6);
    // an old driving clip on the scene root mixer
    A.select([cube]); const stored = A.run('StoreAction', { InputObj: 'cube', Name: 'OldAct', Mode: 1, AddClip: true }); const mix = root.property('mixer');
    const clips0 = mix?.clips?.length ?? 0;
    const pa = run('PlotCamSeqToActions', { StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true });
    const src = pa.v?.[0]; const fc = A.anim.fcurve(px);
    ok('PlotCamSeqToActions, no InputObjs: animated parameters under the root, one action source returned', Array.isArray(pa.v) && pa.v.length === 1 && src.type === 'actionsource' && root.properties.includes(src) && Object.keys(JSON.parse(src.val('fcurves'))).some(k => /cube\.Kinematics\.Local\.posx$/.test(k)), [pa.err, pa.v?.length]);
    ok('PlotCamSeqToActions Apply: the action is applied (keys from StartFrame, one per frame-set entry)', fc && fc.keys.length === 7 && fc.keys[0].time === 1 && fc.keys[6].time === 7 && Math.abs(fc.keys[0].value - px.value * 0 - fc.eval(1)) < 1e-9, fc?.keys.map(k => k.time));
    ok('PlotCamSeqToActions Apply, no InputObjs: every clip of the scene clip container deleted', clips0 > 0 && mix.clips.length === 0, [clips0, mix?.clips?.length]);
    A.undo(); ok('PlotCamSeqToActions undo: source, keys and clips restored', !root.properties.includes(src) && A.anim.fcurve(px).keys.length === 2 && mix.clips.length === clips0, [A.anim.fcurve(px).keys.length, mix.clips.length]);
    const pd = run('PlotCamSeqToActions', { InputObjs: 'cube.kine.local.posx', StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true, Delete: true });
    ok('PlotCamSeqToActions Delete (inside Apply): applied, then the source deleted', pd.v?.length === 1 && !root.properties.includes(pd.v[0]) && A.anim.fcurve(px).keys.length === 7, pd.err);
    A.undo();
    const pn = run('PlotCamSeqToActions', { InputObjs: 'cube.kine.local.posx', StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true, Apply: false, Delete: true });
    ok('PlotCamSeqToActions Apply false: source kept (Delete ignored), nothing applied, clips kept', root.properties.includes(pn.v[0]) && A.anim.fcurve(px).keys.length === 2 && mix.clips.length === clips0, [pn.err]);
    A.undo();
    const ps = run('PlotCamSeqShape', { InputObjs: 'cube', StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true, Name: 'PS' });
    const kl = ps.v?.KeyList, cl = ps.v?.ClipList;
    // batch 12: ApplyKeys -> one shape clip per key at StartFrame + i, inside a compound named Name on a new shape track
    const cpd = root.property('mixer')?.compounds?.find(c => c.name === 'PS');
    ok('PlotCamSeqShape: KeyList (one key per frame) and ClipList (one shape clip per key from StartFrame), no Value', kl?.length === 7 && kl.every(k => k.type === 'shapekey' && cube.properties.includes(k)) && cl?.length === 7 && cl.every((c, i) => c.type === 'mixershapeclip' && c.start === 1 + i && c.timectrl.clipin === 1 + i) && cpd && cpd.clips.length === 7 && !('Value' in ps.v), [ps.err, kl?.length, cl?.[0], cpd]);
    ok('PlotCamSeqShape flags the unread helpers', nya(ps) === 1);
    A.undo(); ok('PlotCamSeqShape undo', !cube.properties.some(p => p.type === 'shapekey' && /^PS_/.test(p.name)));
    A.select([]); const pz = run('PlotCamSeqShape', { StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true });
    ok('PlotCamSeqShape, empty input list: warning XSIACTION2 0x446, nothing made', pz.log.some(l => /0x446/.test(l)) && pz.v?.KeyList === null, pz);
    A.undo(); A.undo(); A.undo(); A.anim.removeAnimation?.(px); reset();
    ok('Camera Sequencer test data undone', !tracks().length, tracks().length);
  }
  {
    const n = A.run('GetPrim', { PresetObj: 'Null', Name: 'TocNull' }); const parent = n.parentObj;
    const r = run('AddToTOC', { Source: 'TocNull' });
    ok('AddToTOC: detached from its owner and put in the TransientObjectContainer', !parent.children.includes(n) && A.scene.transientObjectContainer.includes(n) && !A.scene.find('TocNull'), r);
    A.undo(); ok('AddToTOC undo: back under its owner, out of the container', parent.children.includes(n) && !A.scene.transientObjectContainer.includes(n));
    const r0 = run('AddToTOC', {}); ok('AddToTOC: null Source = nothing', !r0.err && A.scene.transientObjectContainer.length === 0);
    A.undo();
  }

  // ================================================================ CMD-B11h
  reset(); run('ResetAllViews');
  {
    const i = act(); const vp = vps[i]; const p0 = V(vp.camera.position);
    const dir = () => V(vp.camera.getWorldDirection(new vp.camera.position.constructor()));
    run('AlignViewCamera', { Axis: 1 }); ok('AlignViewCamera Axis 1 = X: looks down -X (Right)', near(dir(), [-1, 0, 0], 1e-9), dir());
    run('AlignViewCamera', { Axis: 1, NegativeAxis: true }); ok('AlignViewCamera Axis 1 + NegativeAxis: looks down +X (Left)', near(dir(), [1, 0, 0], 1e-9), dir());
    run('AlignViewCamera', { Axis: 2 }); ok('AlignViewCamera Axis 2 = Y: looks down -Y (Top)', near(dir(), [0, -1, 0], 1e-9), dir());
    run('AlignViewCamera', { Axis: 3 }); ok('AlignViewCamera Axis 3 = Z: looks down -Z (Front)', near(dir(), [0, 0, -1], 1e-9), dir());
    ok('AlignViewCamera alignment state (X 1, Y 2, Z 4) and direction code (+Z 2)', vp.x.alignState === 4 && vp.x.alignDirection === 2);
    const bad = run('AlignViewCamera', { Axis: 4 }); ok('AlignViewCamera Axis 4 = E_FAIL', bad.status === 0x80004005, bad);
    run('CameraUndo'); ok('CameraUndo steps the view camera history back (Axis 2 alignment)', near(dir(), [0, -1, 0], 1e-9), dir());
    run('CameraRedo'); ok('CameraRedo', near(dir(), [0, 0, -1], 1e-9), dir());
    run('AlignViewCamera', { Axis: 0 }); ok('AlignViewCamera Axis 0 restores the camera saved before the first alignment', near(V(vp.camera.position), p0) && vp.x.alignState === 0 && !vp.x.alignSaved, [V(vp.camera.position), p0]);
    const ry = cube.kinematics.local.get('roty'); A.setParam(ry, 90); A.select([cube]);
    run('AlignViewCamera', { Axis: 3, AlignSelected: true }); ok('AlignViewCamera AlignSelected: the first selected object\'s axes (cube +Z rotated 90 deg about Y = world +X)', near(dir(), [-1, 0, 0], 1e-6), dir());
    run('AlignViewCamera', { Axis: 0 }); A.undo(); ok('roty undo', ry.value === 0);
    ok('AlignViewCamera: no view = nothing', !run('AlignViewCamera', { Axis: 1, View: 9 }).err);
  }
  {
    const i = act(); const vp = vps[i];
    const t = run('SetViewCamera', { CameraName: 'TOP' }); ok('SetViewCamera keyword "top" (any case) = the Top system camera', !t.err && vp.name === 'Top' && Math.abs(vp.camera.position.y - 100) < 1e-6, [t.err, vp.name]);
    run('SetViewCamera', { CameraName: 'front' }); ok('SetViewCamera keyword "front"', vp.name === 'Front');
    const before = V(vp.camera.position); const u = run('SetViewCamera', { CameraName: 'left' });
    ok('SetViewCamera unknown name (no "left" keyword) = E_FAIL, view unchanged', u.status === 0x80004005 && vp.name === 'Front' && near(V(vp.camera.position), before), u);
    const cam = [...A.scene.allObjects()].find(o => o.type === 'camera'); const lab = A.inferredB10.camLabels.length;
    run('SetViewCamera', { CameraName: cam.name });
    const M = () => cam.globalMatrix().elements;
    ok('SetViewCamera camera object: the view looks through it, labelled "Set Camera"', vp.viewCamera === cam.name && vp.name === cam.name && near(V(vp.camera.position), [M()[12], M()[13], M()[14]]) && A.inferredB10.camLabels[lab]?.label === 'Set Camera');
    const px = cam.kinematics.local.get('posx'); A.setParam(px, px.value + 3); A.events.emit('params', px);
    ok('SetViewCamera: the view follows the camera when it moves', near(V(vp.camera.position), [M()[12], M()[13], M()[14]]), [V(vp.camera.position), M()[12]]);
    A.undo(); A.events.emit('params');
    ok('SetViewCamera "render pass" = the current pass camera', !run('SetViewCamera', { CameraName: 'render pass' }).err && vp.viewCamera === (A.scene.passes.at(-1)?.val('Camera') ?? vp.viewCamera));
    ok('SetViewCamera: no view = silent success', !run('SetViewCamera', { CameraName: 'nope', View: 9 }).err);
    run('SetViewCamera', { CameraName: 'user' }); ok('SetViewCamera keyword "user" detaches the camera', !vp.x.viewCamera && vp.name === 'User');
  }
  {
    run('ResetAllViews');
    const v0 = vps[0]; const home0 = V(v0.camera.position); v0.camera.position.set(5, 6, 7); const v2 = vps[2]; const home2 = V(v2.camera.position); v2.camera.position.set(1, 2, 3);
    const u0 = A.undoStack.length; run('ResetAllViews', { AllViews: false, View: 0 });
    ok('ResetAllViews AllViews false: only that view goes home', near(V(v0.camera.position), home0) && near(V(v2.camera.position), [1, 2, 3]));
    A.undo(); ok('ResetAllViews is undoable (restores the saved camera)', near(V(v0.camera.position), [5, 6, 7]) && A.undoStack.length === u0);
    run('ResetAllViews'); ok('ResetAllViews: every view', near(V(v0.camera.position), home0) && near(V(v2.camera.position), home2)); A.undo(); A.redo();
    ok('ResetAllViews redo', near(V(v2.camera.position), home2));
  }
  {
    reset(); run('ResetAllViews'); const before = vps.map(v => V(v.camera.position)); const i = act();
    run('Frame Contextual'); const moved = vps.map((v, k) => !near(V(v.camera.position), before[k]));
    ok('Frame Contextual, AllViews false: frames the selection in that view only', moved[i] && moved.filter(Boolean).length === 1, moved);
    run('ResetAllViews'); run('Frame Contextual', { AllViews: true }); ok('Frame Contextual, AllViews true: every view', vps.every((v, k) => !near(V(v.camera.position), before[k]) || v.kind === 'persp'));
    run('ResetAllViews');
  }
  {
    ok('GetViewIndex = the 0-based active view', run('GetViewIndex').v === act());
    const keep = window.__vm; window.__vm = undefined; const r = run('GetViewIndex'); window.__vm = keep;
    ok('GetViewIndex without an active view = error', r.status === 0x80004005, r);
  }
  { const f0 = !!vm.active().flags['Hide Back Facing Polygons']; run('Hide Back Facing Polygons'); ok('Hide Back Facing Polygons toggles the active view flag', !!vm.active().flags['Hide Back Facing Polygons'] === !f0); run('Hide Back Facing Polygons'); }
  {
    const i = act(); vps.forEach(v => { if (v.x) { v.x.muted = false; v.x.solo = false; } });
    run('ToggleMuteSolo', { Target: 4, Mode: 0 }); ok('ToggleMuteSolo Target 4 = the active view', vps[i].x.muted === true);
    const snap = JSON.stringify(vps.map(v => [!!v.x?.muted, !!v.x?.solo])); run('ToggleMuteSolo', { Target: 5, Mode: 0 }); run('ToggleMuteSolo', { Target: 9, Mode: 1 });
    ok('ToggleMuteSolo Target > 4 = nothing', JSON.stringify(vps.map(v => [!!v.x?.muted, !!v.x?.solo])) === snap);
    run('ToggleMuteSolo', { Target: 2, Mode: 1 }); ok('ToggleMuteSolo Target 2 Mode 1 = solo view C', vps[2].x.solo === true);
    run('ToggleMuteSolo', { Target: 4, Mode: 0 }); run('ToggleMuteSolo', { Target: 2, Mode: 1 });
  }
  {
    reset(); const i = act(); const vp = vps[i]; const cam = vp.camera; const el = vp.el; const w = el.clientWidth, h = el.clientHeight;
    const centre = () => { const b = new cam.position.constructor(); const pos = cube.primitive.mesh().positions; const M = cube.globalMatrix(); const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let k = 0; k < pos.length; k += 3) { const v = new cam.position.constructor(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(M); [v.x, v.y, v.z].forEach((x, j) => { mn[j] = Math.min(mn[j], x); mx[j] = Math.max(mx[j], x); }); } return b.set((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2); };
    const px = () => { const c = centre().project(cam); return [c.x * (w - 1) / 2, c.y * (h - 1) / 2]; };
    const p0 = px(); const l0 = cube.kinematics.local; const pos0 = [l0.val('posx'), l0.val('posy'), l0.val('posz')];
    run('ViewTranslate', { X: 10, Y: -4 }); const p1 = px();
    ok('ViewTranslate: the projected selection centre moves by X / Y window pixels', Math.abs(p1[0] - p0[0] - 10) < 1e-3 && Math.abs(p1[1] - p0[1] + 4) < 1e-3, [p1[0] - p0[0], p1[1] - p0[1]]);
    A.undo(); ok('ViewTranslate undo (through Translate)', near([l0.val('posx'), l0.val('posy'), l0.val('posz')], pos0, 1e-9));
    for (const [n, dx, dy] of [['ViewNudgeLeft', -1, 0], ['ViewNudgeRight', 1, 0], ['ViewNudgeUp', 0, 1], ['ViewNudgeDown', 0, -1]]) {
      const q0 = px(); run(n); const q1 = px(); ok(`${n}: one pixel (no half-pixel factor)`, Math.abs(q1[0] - q0[0] - dx) < 1e-3 && Math.abs(q1[1] - q0[1] - dy) < 1e-3, [q1[0] - q0[0], q1[1] - q0[1]]); A.undo();
    }
    const nv = run('ViewTranslate', { X: 1, View: 9 }); ok('ViewTranslate without a view = E_INVALIDARG', nv.status === 0x80070057, nv);
    A.select([]); const u0 = A.undoStack.length; const es = run('ViewNudgeUp'); ok('ViewNudge with an empty selection: nothing', !es.err && A.undoStack.length === u0); reset();
  }
  {
    const f = 'C:\\Users\\Public\\b11.cache'; const s = run('SaveFastPlaybackCache', { FileName: f });
    ok('SaveFastPlaybackCache: success = S_FALSE, no return value, cache layout flagged', s.v === undefined && st().SaveFastPlaybackCache === 1 && A.hostFs.exists(f) && nya(s) === 1, s);
    const l = run('LoadFastPlaybackCache', { FileName: f }); ok('LoadFastPlaybackCache: S_FALSE', !l.err && st().LoadFastPlaybackCache === 1);
    const miss = run('LoadFastPlaybackCache', { FileName: 'C:\\Users\\Public\\none.cache' }); ok('LoadFastPlaybackCache: failure = E_FAIL', miss.status === 0x80004005, miss);
    const e = run('SaveFastPlaybackCache', { FileName: '' }); ok('Save / LoadFastPlaybackCache, empty FileName: the file browser (flagged, cancelled), no error', !e.err && e.log.some(l => /not yet attested: the modal file browser "Save Fast Playback Cache"/.test(l)), e.log);
  }
  { let n = 0; const h = () => n++; vm.active().el.addEventListener('contextmenu', h); const r = run('Show3DContextMenu'); vm.active().el.removeEventListener('contextmenu', h); ok('Show3DContextMenu opens the 3D view context menu', !r.err && n === 1); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); document.querySelectorAll('.si-menu, .ctx-menu').forEach(m => m.remove()); }
  {
    const f0 = A.anim.frame; const r = run('StartTimedPlayback', { Target: 1 });
    ok('StartTimedPlayback: logs the elapsed time in ms, no return value, restores the frame', r.v === undefined && r.log.some(l => /^info:StartTimedPlayback: \d+ ms$/.test(l)) && A.anim.frame === f0, r.log);
  }
  {
    const clip = A.run('CreateImageClip', { FileName: 'C:\\Users\\Public\\tex.pic', Name: 'B11Clip' }) ?? A.scene.root.properties.find(p => p.type === 'imageclip');
    const e1 = run('ExportImageClip', { Clip: null, FileName: 'C:\\Users\\Public\\o.pic' }); const e2 = run('ExportImageClip', { Clip: clip, FileName: '' }); const e3 = run('ExportImageClip', { Clip: clip, FileName: 'C:\\Users\\Public\\o.txt' });
    ok('ExportImageClip argument errors (E_INVALIDARG)', e1.status === 0x80070057 && /Argument 1 must be an image clip/.test(e1.err) && e2.status === 0x80070057 && /Argument 2 must specify a image file name/.test(e2.err) && /Argument 2/.test(e3.err ?? ''), [e1.err, e2.err, e3.err]);
    const r = run('ExportImageClip', { Clip: clip, FileName: 'C:\\Users\\Public\\o.pic', StartFrame: 1, EndFrame: 5, StepFrame: 1 }); const name = 'C:\\Users\\Public\\o.[1..5].pic';
    ok('ExportImageClip 1..5: sequence token before the first ".", "Writting" and one " Frame n" per frame', !r.err && A.hostFs.exists(name) && r.log.includes(`info:Writting ${name}`) && r.log.filter(l => /^info: Frame \d$/.test(l)).join() === 'info: Frame 1,info: Frame 2,info: Frame 3,info: Frame 4,info: Frame 5' && JSON.parse(A.hostFs.readFile(name)).frames.join() === '1,2,3,4,5', r);
    const sw = run('ExportImageClip', { Clip: clip, FileName: 'C:\\Users\\Public\\s.pic', StartFrame: 5, EndFrame: 1, StepFrame: 2 }); const sn = 'C:\\Users\\Public\\s.[1..5].pic';
    ok('ExportImageClip: positive step with End < Start swaps; frames by Step; count |(E-S+1)/Step| = 2', !sw.err && JSON.parse(A.hostFs.readFile(sn)).frames.join() === '1,3,5', sw);
    const ng = run('ExportImageClip', { Clip: clip, FileName: 'C:\\Users\\Public\\n.pic', StartFrame: 1, EndFrame: 5, StepFrame: -1 });
    ok('ExportImageClip: negative step with Start < End swaps to Start > End: nothing written', !ng.err && !ng.log.some(l => /Frame/.test(l)) && !A.hostFs.exists('C:\\Users\\Public\\n.[5..1].pic') && !A.hostFs.exists('C:\\Users\\Public\\n.pic'), ng);
    const one = run('ExportImageClip', { Clip: clip.name, FileName: 'C:\\Users\\Public\\one.pic', StepFrame: 0 });
    ok('ExportImageClip: one frame, StepFrame 0 = 1, no token, no " Frame" line', !one.err && A.hostFs.exists('C:\\Users\\Public\\one.pic') && !one.log.some(l => /Frame/.test(l)), one);
    const mv = run('ExportImageClip', { Clip: clip, FileName: 'C:\\Users\\Public\\m.avi', StartFrame: 1, EndFrame: 3 });
    ok('ExportImageClip: movie file = no sequence token', !mv.err && A.hostFs.exists('C:\\Users\\Public\\m.avi'), mv);
    ok('ExportImageClip flags the pixel data', nya(r) === 1);
  }

  // ================================================================ CMD-B11i
  {
    reset(); const proj = cube.property('uvprojection');
    if (proj) {
      const base = (() => { A.run('TranslateUVW', { InputObjs: 'cube', X: 0 }); const u = Float32Array.from(proj.uvs); A.undo(); return u; })();
      const tr = (a) => { run('TranslateUVW', { InputObjs: 'cube.sample[0]', X: 0.5, Y: 0.25, ...a }); const u = [proj.uvs[0] - base[0], proj.uvs[1] - base[1]]; A.undo(); return u.map(x => Math.round(x * 1e6) / 1e6); };
      ok('TranslateUVW AxesFilter numeric bits: 1 = U, 2 = V, 3 = UV, 5 = UW', JSON.stringify([tr({ AxesFilter: 1 }), tr({ AxesFilter: 2 }), tr({ AxesFilter: 3 }), tr({ AxesFilter: 5 })]) === '[[0.5,0],[0,0.25],[0.5,0.25],[0.5,0]]', [tr({ AxesFilter: 1 }), tr({ AxesFilter: 2 }), tr({ AxesFilter: 3 }), tr({ AxesFilter: 5 })]);
      ok('TranslateUVW named filters still work (siV)', JSON.stringify(tr({ AxesFilter: 'siV' })) === '[0,0.25]');
      run('TranslateUVW', { InputObjs: 'cube.sample[0]', X: 0.5, Y: 0.25, Delta: 0 }); const absU = [proj.uvs[0], proj.uvs[1]]; A.undo();
      ok('TranslateUVW Delta 0 = siAbsolute (sets the UV)', Math.abs(absU[0] - 0.5) < 1e-6 && Math.abs(absU[1] - 0.25) < 1e-6, absU);
      const zr = run('TranslateUVW', { InputObjs: 'cube.sample[0]', Z: 1 }); A.undo(); ok('TranslateUVW non-zero W: flagged, not an error', !zr.err && nya(zr) === 1);
      run('ScaleUVW', { InputObjs: 'cube', X: 0, Y: 1, Pivot: true, PivotU: 0, PivotV: 0 }); const sz = Float32Array.from(proj.uvs); A.undo();
      ok('ScaleUVW factor 0 clamped to 1e-12 (U flattened onto the pivot, not singular)', [...sz].every((x, k) => k % 2 ? Math.abs(x - base[k]) < 1e-6 : Math.abs(x) < 1e-9), [sz[0], sz[2]]);
      run('ScaleUVW', { InputObjs: 'cube', X: 2, Y: 5, AxesFilter: 1, Pivot: true }); const sf = Float32Array.from(proj.uvs); A.undo();
      ok('ScaleUVW: a filtered-out axis keeps factor 1 (Y ignored with AxesFilter 1)', [...sf].every((x, k) => Math.abs(x - (k % 2 ? base[k] : 2 * base[k])) < 1e-5));
      run('RotateUVW', { InputObjs: 'cube.sample[0,1]', Z: 90, AspectRatio: 3 }); const ra = Float32Array.from(proj.uvs.slice(0, 4)); A.undo();
      run('RotateUVW', { InputObjs: 'cube.sample[0,1]', Z: 90 }); const r1 = Float32Array.from(proj.uvs.slice(0, 4)); A.undo();
      ok('RotateUVW: AspectRatio applies only with a TextureProjection (else 1.0)', [...ra].every((x, k) => Math.abs(x - r1[k]) < 1e-6), [ra, r1]);
      const ro = run('RotateUVW', { InputObjs: 'cube.sample[0]', X: 30 }); A.undo(); ok('RotateUVW X / Y (out of plane): flagged', nya(ro) === 1);
    } else ok('a texture projection on the cube for the UVW checks', false);
    const p = cube.kinematics.local; run('TranslatePivot', { InputObjs: 'cube', X: 1 }); ok('TranslatePivot (inferred, not in transformmanager.dll) still adds to the pivot', p.val('pposx') === 1); A.undo();
  }
  reset(); run('ResetAllViews');
  return out;
}, { NAMES, DF: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
for (const [row, names] of Object.entries(ROWS)) console.log(`${row}: ${names.length} commands`);
console.log(`compare_b11_b10_corrections: ${pass + fail} checks, ${fail} failed (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
