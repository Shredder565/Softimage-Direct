// Batch 12 corrections to the wired CMD-B11a..g commands (digest docs/re/WIRE_CORRECTIONS_B12.md; the "Batch 12 answers"
// sections of docs/ghidra/cmd-b11*.md). No XSIBATCH golden exists: each corrected behaviour is checked as the note states it
// (values exact; plane / curve positions to 1e-6).
//   1. CopyExtFilesIntoProject (named by the SaveSceneAs answer, missing from the bus before) is registered with the
//      registry argument list (data/command_registry.json, return values left out);
//   2. the commands touched run with default arguments on the demo scene (cube selected) without an unexpected error;
//   3. one or more checks per correction item.
// Needs `vite preview` (SI_URL, default http://localhost:4173/?demo). Usage: node tools/compare_b12_b11_corrections.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NEW = ['CopyExtFilesIntoProject'];
// commands whose behaviour batch 12 changed (default runs)
const TOUCHED = ['FindObjects', 'SetCurrentParType', 'CacheObjectsIntoFile_Private', 'CollapseOp', 'SetDefaultKeyMap', 'UpdateExternalReference',
  'SetReferencePlane', 'GetNumberOfKnots', 'GetCurvePercentageAtKnotIndex', 'NavigateNode', 'Tag', 'Untag', 'MoveToFolder', 'SaveSceneAs',
  'GetUserPref', 'InspectExternalReference', 'SICreateRefPlane', 'EvaluateCurveAt', 'SILoadPreset', 'InspectBrowse', 'CreateConnectionMap',
  'CreateValueMap', 'GetMappingRule', 'SetMappingRule', 'AddMappingRule', 'GetStoreActionDefaults', 'AddPoseActionItems', 'LoadActionPreset',
  'CutClipInSpace', 'FreezeLipSync', 'CreateShapeGroup', 'ResetOffset', 'StoreViseme', 'SetupEvolverVisemes', 'PlotCamSeqShape', ...NEW];
// default run must fail with a message naming the command (required input without a default / no curve on the cube)
const DEFAULT_FAILS = new Set(['FindObjects', 'SetCurrentParType', 'UpdateExternalReference', 'SetReferencePlane', 'GetNumberOfKnots',
  'GetCurvePercentageAtKnotIndex', 'NavigateNode', 'Tag', 'Untag', 'GetUserPref', 'InspectExternalReference', 'SILoadPreset', 'GetMappingRule',
  'SetMappingRule', 'AddMappingRule', 'AddPoseActionItems', 'LoadActionPreset', 'CutClipInSpace', 'StoreViseme', 'SetupEvolverVisemes']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NEW.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const base = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(base.includes('?') ? base : base + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('CopyExtFilesIntoProject') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ TOUCHED, NEW, DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const lines = []; const off = A.events.on('log', () => { const l = A.log[A.log.length - 1]; if (l) lines.push(`${l.kind}:${l.text}`); }); try { return { v: A.run(n, a), log: lines }; } catch (e) { return { err: String(e?.message ?? e), log: lines }; } finally { off(); } };
  const status = (r) => { const m = /status 0x([0-9a-f]+)/.exec(r.err ?? ''); return m ? parseInt(m[1], 16) : null; };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const root = A.scene.root; const cube = A.scene.find('cube'); const sphere = A.scene.find('sphere');
  const reset = () => { A.setTool?.(null); A.select([cube]); A.compSel = null; A.anim.marked?.clear?.(); };
  const undoTo = (u0) => { while (A.undoStack.length > u0) A.undo(); };
  const near = (a, b, e = 1e-6) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= e);
  const fsx = A.hostFs;

  // 1. registration
  for (const n of NEW) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of TOUCHED) {
    reset(); const u0 = A.undoStack.length; const f0 = A.anim.frame;
    const r = run(n);
    undoTo(u0); A.anim.frame = f0;
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  const T11a = A.tasksB11a;

  // ================================================================ B11a
  { // FindObjects
    const PART = '3ee7b553-394f-11d3-8a80-00a024197c03'; const u0 = A.undoStack.length;
    const byName = run('FindObjects', { Type: 'Pass' });
    ok('FindObjects: a class name is not looked up: failed conversion -> S_FALSE, no list', !byName.err && byName.v === undefined && T11a.status.FindObjects === 1, byName);
    const both = run('FindObjects', { Path: 'x', Type: PART }); ok('FindObjects: both -> 0x80070057, literal text "Both path and type given" (severity 2)', status(both) === 0x80070057 && both.log.some(l => /^error:.*Both path and type given/.test(l)), both);
    const none = run('FindObjects', {}); ok('FindObjects: neither -> 0x80004001 (text = the empty Type)', status(none) === 0x80004001, none.err);
    const cloud = A.run('CreateParticleCloud', { InputObjs: 'cube' })[0]; const op = cloud.primitive.operators.find(o => o.type === 'ParticlesOp');
    const m = A.run('CreateModel', { InputObj: cloud.name, Name: 'B12Flags' }); const model = Array.isArray(m) ? m[0] : m;
    const in1 = run('FindObjects', { Type: `{${PART}}` }).v ?? [];
    model.flags = 8; const in2 = run('FindObjects', { Type: PART }).v ?? []; model.flags = 0x7; const in3 = run('FindObjects', { Type: PART }).v ?? []; delete model.flags;
    ok('FindObjects: an object whose owning model has flag bit 0x8 is skipped', op && in1.includes(op) && !in2.includes(op) && in3.includes(op), [!!op, in1.length, in2.length, in3.length]);
    undoTo(u0); reset();
  }
  { // SetCurrentParType
    const S = T11a; const ev0 = S.events.length; const lay = A.scene.layers[0];
    const r7 = run('SetCurrentParType', { Value: lay, Type: 7 }); const rn = run('SetCurrentParType', { Value: lay, Type: -1 });
    ok('SetCurrentParType Type 7 / -1: Value read, Do returns 0x8000FFFF, nothing changes', status(r7) === 0x8000ffff && status(rn) === 0x8000ffff && S.events.length === ev0, [r7.err, rn.err]);
    const u0 = A.undoStack.length; const planes = A.run('SICreateRefPlane', { InputObjs: 'cube' }); const pl = planes[0];
    const r2 = run('SetCurrentParType', { Value: pl, Type: 2 });
    ok('SetCurrentParType Type 2: the C3DReferencePlane (a15b3913) becomes the current item of the content sub-container, no events', !r2.err && S.currentContentItem === pl && S.events.length === ev0, r2);
    A.undo(); ok('SetCurrentParType Type 2 undo', S.currentContentItem !== pl);
    run('SetCurrentParType', { Value: lay, Type: 1 }); ok('SetCurrentParType Type 1 (layers) fires no event', S.events.length === ev0); A.undo();
    ok('SetCurrentParType Type 2 with a non-plane Value -> 0x80004005', status(run('SetCurrentParType', { Value: lay, Type: 2 })) === 0x80004005);
    undoTo(u0); reset();
  }
  { // CacheObjectsIntoFile_Private
    const C = 'CacheObjectsIntoFile_Private'; const S = T11a;
    ok(`${C}: PathID 6 -> 0x80070057 (no message)`, status(run(C, { ObjectsToCache: 'cube', PathID: 6, AlternativePath: 'C:\\b12' })) === 0x80070057);
    ok(`${C}: PathID -1 -> 0x80070057 (unsigned check)`, status(run(C, { ObjectsToCache: 'cube', PathID: -1 })) === 0x80070057);
    const e5 = run(C, { ObjectsToCache: 'cube', PathID: 5, AlternativePath: '' }); ok(`${C}: PathID 5 with an empty AlternativePath -> XSITASKS 0x41e (severity 2), 0x80070057`, status(e5) === 0x80070057 && e5.log.filter(l => /^error:/.test(l)).length >= 2, e5);
    const e2 = run(C, { ObjectsToCache: 'cube', PathID: 2 }); ok(`${C}: an empty path template (2 = patha) -> 0x80070057`, status(e2) === 0x80070057, e2.err);
    const two = run(C, { ObjectsToCache: 'cube,sphere', PathID: 5, AlternativePath: 'C:\\b12cache\\[object]', Type: 1, FrameSet: [3], Attributes: ' PointPosition , Color ', TargetCacheObjects: 'tA,tB' });
    const p = S.cachePlans.slice(-2);
    ok(`${C}: ResolvedPath = the per-object files joined with "," (no trailing comma)`, two.v === 'C:\\b12cache\\cube\\cube_A_3.icecache,C:\\b12cache\\sphere\\sphere_A_3.icecache', two);
    ok(`${C}: Attributes / TargetCacheObjects item i goes with object i (trimmed)`, p.length === 2 && p[0].attributes.join() === 'PointPosition' && p[1].attributes.join() === 'Color' && p[0].target === 'tA' && p[1].target === 'tB', p);
    ok(`${C}: the resolved file's folder is created`, fsx.isFolder('C:\\b12cache\\cube') && fsx.isFolder('C:\\b12cache\\sphere'));
    cube.cacheSubsteps = 2; const sub = run(C, { ObjectsToCache: 'cube', PathID: 5, AlternativePath: 'C:\\b12cache', FirstFrame: 1, LastFrame: 2 }); delete cube.cacheSubsteps;
    ok(`${C}: samples per frame 2 -> one sample every half frame`, S.cachePlans[S.cachePlans.length - 1].frames.join() === '1,1.5,2' && sub.v === 'C:\\b12cache\\cube_A_1.icecache', [sub, S.cachePlans[S.cachePlans.length - 1]]);
    const d1 = run(C, { ObjectsToCache: 'cube', PathID: 5, AlternativePath: 'C:\\b12cache', FirstFrame: 1, LastFrame: 2 });
    ok(`${C}: default samples per frame 1 -> the frames`, S.cachePlans[S.cachePlans.length - 1].frames.join() === '1,2' && !d1.err);
    ok(`${C}: Datamanagement_CachingToFiles back to 0`, S.ambient.Datamanagement_CachingToFiles === 0);
  }
  { // CollapseOp
    reset(); const u0 = A.undoStack.length; const prim = cube.primitive; const n0 = prim.operators.length; const c0 = cube.clusters.length;
    A.select([cube]); A.run('ApplyOp', { PresetObj: 'Twist' }); const tw = A.selection[0]; // angle 90 by default
    prim.dirty = true; const before = Array.from(prim.mesh().positions);
    const r = run('CollapseOp', { InputObjs: [tw], Relative: true }); const key = r.v?.[0]; const cl = cube.clusters[cube.clusters.length - 1];
    prim.dirty = true; const after = Array.from(prim.mesh().positions);
    ok('CollapseOp: the operator is replaced by a shape combiner; the geometry is unchanged', key && !prim.operators.includes(tw) && prim.operators.length === n0 + 1 && prim.operators.some(o => o.type === 'shapblend') && near(before, after, 1e-4), [r.err, prim.operators.map(o => o.type)]);
    ok('CollapseOp: a whole-object point cluster holds a shape key named Offsets, reference mode 1 (Relative)', key && key.name === 'Offsets' && key.val('refmode') === 1 && cl && cube.clusters.length === c0 + 1 && cl.compKind === 'pnt' && cl.elements.size === before.length / 3 && cl.properties.includes(key), key && key.name);
    const base = JSON.parse(cl.properties.find(p => p.type === 'shapebase').val('data')); const shp = JSON.parse(key.val('data'));
    prim.operators.splice(prim.operators.indexOf(prim.operators.find(o => o.type === 'shapblend')), 1); prim.dirty = true; const inputB = Array.from(prim.mesh().positions);
    ok('CollapseOp: offsets = operator output - last input', near(shp.map((x, i) => x - base[i]), after.map((x, i) => x - inputB[i]), 1e-4) && near(base, inputB, 1e-4));
    undoTo(u0); prim.dirty = true;
    ok('CollapseOp undo restores the operator', prim.operators.length === n0 && cube.clusters.length === c0, prim.operators.map(o => o.type));
    A.select([cube]); A.run('ApplyOp', { PresetObj: 'Bend' }); const bd = A.selection[0];
    const r2 = run('CollapseOp', { InputObjs: [bd], Relative: false }); ok('CollapseOp Relative false: reference mode 2', r2.v?.[0]?.val('refmode') === 2, r2.err);
    undoTo(u0); reset();
  }
  { // SetDefaultKeyMap
    const u0 = A.undoStack.length; const r = run('SetDefaultKeyMap', { Name: 'NoSuchKeyMap_B12' });
    ok('SetDefaultKeyMap: unknown name gives no error, returns 1, saves Interaction.defaultkeymap', !r.err && r.v === 1 && A.prefValues?.['Interaction.defaultkeymap'] === 'NoSuchKeyMap_B12', r);
    A.undo(); ok('SetDefaultKeyMap undo restores the preference', A.prefValues?.['Interaction.defaultkeymap'] === undefined, A.prefValues); undoTo(u0);
  }

  // ================================================================ B11b / B11d
  const T11b = A.tasksB11b; const st11b = () => T11b.lastStatus?.status;
  { // UpdateExternalReference
    const M = root.constructor; const m = new M('b12Ref'); m.ref = { file: 'x', resolution: 0, resolutions: ['x', 'y'] }; root.addChild(m);
    ok('UpdateExternalReference: NULL Target -> 0x80004003', status(run('UpdateExternalReference', { InputObjs: 'cube' })) === 0x80004003);
    let r = run('UpdateExternalReference', { Target: m, InputObjs: 'cube' }); ok('UpdateExternalReference: path count != resolution count -> 1, no change', !r.err && st11b() === 1 && m.ref.resolutions.join() === 'x,y', r);
    r = run('UpdateExternalReference', { Target: m, InputObjs: 'cube,not_an_element' }); ok('UpdateExternalReference: a path that is no scene element is invalid', !!r.err && r.log.includes('error:Invalid reference [not_an_element]'), r.log);
    m.externalRefSubObject = {}; r = run('UpdateExternalReference', { Target: m, InputObjs: 'cube,sphere' }); delete m.externalRefSubObject;
    ok('UpdateExternalReference: sub-object found -> XSITASKS 0x42f severity 4, S_OK, no change', !r.err && st11b() === 0 && r.log.some(l => /^info:WARNING : /.test(l)) && m.ref.resolutions.join() === 'x,y', r);
    r = run('UpdateExternalReference', { Target: m, InputObjs: 'cube,sphere' }); ok('UpdateExternalReference: equal counts set path i on resolution i', !r.err && m.ref.resolutions.join() === 'cube,sphere', r); A.undo();
    m.ref.resolutions = []; r = run('UpdateExternalReference', { Target: m, InputObjs: 'cube' }); ok('UpdateExternalReference: resolution count 0 -> success, no change', !r.err && st11b() === 0, r);
    root.removeChild(m);
  }
  { // SetReferencePlane
    const C = 'SetReferencePlane'; const U = A.uixsiClipsDisplayAddons; const u0 = A.undoStack.length;
    ok(`${C}: NULL Target -> 0x80070057`, status(run(C, { InputObj: cube })) === 0x80070057);
    run(C, { Target: 'RefPlanes.Transform', InputObj: cube }); const tp = U.transientPlane;
    const P = cube.primitive.mesh().positions; let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity; for (let i = 0; i < P.length; i += 3) { mnx = Math.min(mnx, P[i]); mxx = Math.max(mxx, P[i]); mnz = Math.min(mnz, P[i + 2]); mxz = Math.max(mxz, P[i + 2]); }
    ok(`${C}: object (kind 2): sizes = half X / Z extents, minimum 2.0`, tp && Math.abs(tp.sizeU - Math.max(2, (mxx - mnx) / 2)) < 1e-9 && Math.abs(tp.sizeV - Math.max(2, (mxz - mnz) / 2)) < 1e-9, [tp?.sizeU, tp?.sizeV, mxx - mnx]);
    const r6 = run(C, { Target: 'RefPlanes.Transform', InputObj: 'cube.pnt[0,1,2,3]' }); const m6 = U.transientPlane.matrix;
    const g = cube.globalMatrix().elements; const det = (m) => m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    ok(`${C}: component (kind 6): plane = component frame x global (orthonormal axes, origin at the components)`, !r6.err && Math.abs(Math.abs(det(m6)) - Math.abs(det(g))) < 1e-6 && nya(r6) === 0, [r6.err, m6]);
    A.compSel = { obj: cube, kind: 'point', points: new Set([0, 1, 2, 3]), edges: new Set(), polygons: new Set() }; const clu = A.run('CreateCluster', { Name: 'B12Pts' }); A.compSel = null;
    const r7 = run(C, { Target: 'RefPlanes.Transform', InputObj: clu }); ok(`${C}: cluster sub-element (kind 7) gives the same plane as its components`, !r7.err && near(U.transientPlane.matrix, m6), [r7.err, clu?.name]);
    const before = U.transientPlane; const r0 = run(C, { Target: 'RefPlanes.Transform', InputObj: 'not_an_element' });
    ok(`${C}: another element kind -> 1, no change`, !r0.err && st11b() === 1 && U.transientPlane === before, r0);
    undoTo(u0);
  }
  { // knots over all sub-curves
    const u0 = A.undoStack.length; const crv = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' }) ?? A.selectedObjects[0]; const o = Array.isArray(crv) ? crv[0] : crv;
    const c = o.primitive.curve(); const one = run('GetNumberOfKnots', { InputObj: o }).v.NbItems;
    const orig = o.primitive.curve; o.primitive.curve = () => ({ ...c, subcurves: [c] });
    const both = run('GetNumberOfKnots', { InputObj: o }).v.NbItems;
    const pFirst2 = run('GetCurvePercentageAtKnotIndex', { InputObj: o, Index: one }).v.Percentage, pLast2 = run('GetCurvePercentageAtKnotIndex', { InputObj: o, Index: 2 * one - 1 }).v.Percentage;
    const oor = run('GetCurvePercentageAtKnotIndex', { InputObj: o, Index: 2 * one });
    o.primitive.curve = orig;
    ok('GetNumberOfKnots / GetCurvePercentageAtKnotIndex: the knot index runs over all sub-curves', both === 2 * one && Math.abs(pFirst2) < 1e-9 && Math.abs(pLast2 - 100) < 1e-6, [one, both, pFirst2, pLast2]);
    ok('GetCurvePercentageAtKnotIndex: out of range -> 0.0, success', !oor.err && oor.v.Percentage === 0, oor);
    undoTo(u0); reset();
  }
  { // NavigateNode
    const nav = (a) => { const r = run('NavigateNode', a); return r.err ? 'ERR' : r.v?.name; };
    const leaves = []; const w = (o) => { if (o !== root && !o.children.length) leaves.push(o); o.children.forEach(w); }; w(root);
    const i = leaves.indexOf(cube);
    ok('NavigateNode 3 = next leaf, 4 = previous leaf (polarity confirmed)', nav({ Source: 'cube', NavDirection: 3 }) === (leaves[i + 1] ?? cube).name && nav({ Source: 'cube', NavDirection: 4 }) === (leaves[i - 1] ?? cube).name, leaves.map(o => o.name));
    ok('NavigateNode NavLoop wraps over the whole tree', nav({ Source: leaves[0], NavDirection: 4, NavLoop: true }) === leaves[leaves.length - 1].name && nav({ Source: leaves[0], NavDirection: 4 }) === leaves[0].name);
    ok('NavigateNode below the root: NavFilter / NavSubFilter do not filter the leaf step', nav({ Source: 'cube', NavDirection: 3, NavFilter: 10 }) === nav({ Source: 'cube', NavDirection: 3 }));
  }
  { // Tag / Untag
    const p = cube.kinematics.local.get('posz'); const R = (A.lockRecordsB11 ??= new Map()); const u0 = A.undoStack.length;
    run('Tag', { InputObjs: 'cube.kine.local.posz', Level: 0x10003 }); const rec = R.get(p)?.[0];
    ok('Tag: lock-info record {id, lockLevel 0, tagLevel (16 bit), type 2}', rec && rec.type === 2 && rec.lockLevel === 0 && rec.tagLevel === 3 && rec.id > 0, rec);
    const w = run('Untag', { InputObjs: 'cube' }); ok('Untag on an object: XSITASKS 1069 (0x42d) at severity 4 (warning), skipped', w.log.some(l => /^info:WARNING : .*1069/.test(l)), w.log);
    undoTo(u0); ok('Tag undo', !R.has(p));
  }
  { // MoveToFolder
    const r = run('MoveToFolder', { InputObjs: 'sphere' }); ok('MoveToFolder: NULL folder returns 1, no change', !r.err && A.inferredB10.status?.MoveToFolder === 1, r);
  }

  // ================================================================ B11c
  const T11c = A.tasksB11c;
  { // SaveSceneAs / CopyExtFiles
    const r = run('SaveSceneAs', {}); const file = r.v;
    ok('SaveSceneAs with an empty SceneFileName saves to the current scene path (normalised name returned / written back)', !r.err && typeof file === 'string' && /\.scn$/i.test(file) && fsx.isFile(file) && T11c.savedScenes.includes(file), r);
    const k0 = (T11c.copyExtCalls ?? []).length;
    run('SaveSceneAs', { SceneFileName: 'C:\\B12\\s1.scn', CopyExtFiles: 1 }); run('SaveSceneAs', { SceneFileName: 'C:\\B12\\s2.scn', CopyExtFiles: 2 }); run('SaveSceneAs', { SceneFileName: 'C:\\B12\\s3.scn', CopyExtFiles: 0 });
    const k = (T11c.copyExtCalls ?? []).slice(k0);
    ok('SaveSceneAs CopyExtFiles 1 / 2 run CopyExtFilesIntoProject (Models "", UpdateSourcePaths true; 2 = files under the project only); 0 does not', k.length === 2 && k[0].SceneFileName === 'C:\\B12\\s1.scn' && k[0].Models === '' && k[0].UpdateSourcePaths === true && k[0].ConsiderOnlyFilesUnderProject === false && k[1].ConsiderOnlyFilesUnderProject === true && k[0].Overwrite === false, k);
    const rel = run('SaveSceneAs', { SceneFileName: 'C:/B12//s4.scn' }); ok('SaveSceneAs: the name is normalised by the path object', rel.v === 'C:\\B12\\s4.scn' && fsx.isFile('C:\\B12\\s4.scn'), rel);
  }
  { // GetUserPref (remapped name for the CPM fallback)
    const r = run('GetUserPref', { Target: 'OperationMode' }); ok('GetUserPref: the CPM fallback answers OperationMode', !r.err && (r.v === 0 || r.v === 1), r);
  }
  { // InspectExternalReference
    const u0 = A.undoStack.length; cube.externalReferences = ['a.pic', 'b.pic']; const r = run('InspectExternalReference', { Target: cube });
    ok('InspectExternalReference joins the names with "," (no space)', r.v === 'a.pic,b.pic', r); delete cube.externalReferences;
    const p = cube.kinematics.local.get('posy'); A.anim.setExpression(p, 'sphere.kine.local.posx * 2', (n) => window.Application.scene.find(n.split('.')[0])?.kinematics.local.get(n.split('.').pop()));
    cube.externalReferences = ['z.pic'];
    const r2 = run('InspectExternalReference', { Target: cube }); ok('InspectExternalReference: the expression holder is asked first', r2.v === 'sphere', r2);
    delete cube.externalReferences; A.anim.removeAnimation(p); undoTo(u0);
  }
  { // SICreateRefPlane
    const u0 = A.undoStack.length; const r = run('SICreateRefPlane', { InputObjs: 'cube,sphere' }); const [p1, p2] = r.v ?? [];
    ok('SICreateRefPlane: one C3DReferencePlane per item in the C3DRefPlaneFolder', p1 && p2 && p1.siClass === 'C3DReferencePlane' && (A.uixsiClipsDisplayAddons?.refPlanes ?? T11c.refPlanes).className === 'C3DRefPlaneFolder', r.err);
    ok('SICreateRefPlane runs SetReferencePlane per plane (plane on the item\'s global transform, sizes >= 2)', p1 && near(p1.matrix, cube.globalMatrix().toArray()) && near(p2.matrix, sphere.globalMatrix().toArray()) && p1.sizeU >= 2 && p1.planeInputs?.[0] === 'cube', p1 && [p1.matrix, p1.sizeU]);
    undoTo(u0); ok('SICreateRefPlane undo', !(A.uixsiClipsDisplayAddons?.refPlanes ?? T11c.refPlanes).includes(p1));
    A.select([]); const e = run('SICreateRefPlane', { InputObjs: [] }); reset(); ok('SICreateRefPlane with an empty list (nothing selected) creates nothing', !e.err && (e.v ?? []).length === 0, e);
  }
  { // EvaluateCurveAt
    const u0 = A.undoStack.length; const crv = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' }); const o = Array.isArray(crv) ? crv[0] : crv;
    const L = A.run('GetCurveLength', { InputObj: o }).Length;
    const a = run('EvaluateCurveAt', { InputObj: o, Value: 0.25, Local: true }).v; const b = run('EvaluateCurveAt', { InputObj: o, Value: 0.25 * L, Local: false }).v;
    ok('EvaluateCurveAt: Local = 0..1 ratio, not Local = arc length / total length (same point)', a && b && near([a.PosX, a.PosY, a.PosZ], [b.PosX, b.PosY, b.PosZ], 1e-6), [a, b, L]);
    const z = run('EvaluateCurveAt', { InputObj: 'cube', Value: 0.5 }); ok('EvaluateCurveAt without a curve: nine zero outputs, success', !z.err && Object.values(z.v).length === 9 && Object.values(z.v).every(v => v === 0), z);
    undoTo(u0); reset();
  }
  { // SILoadPreset
    const u0 = A.undoStack.length; const prop = cube.kinematics.local;
    const sp = run('SavePreset', { InputObj: prop, PresetName: 'B12Kine', PresetLocation: 2 }); const file = sp.v?.file;
    const r1 = run('SILoadPreset', { FileName: file.replace(/\.Preset$/, ''), InputObj: prop });
    ok('SILoadPreset appends .Preset to a name without extension', !r1.err && T11c.lastStatus?.status === 0, [sp.err, r1.err]);
    const r2 = run('SILoadPreset', { FileName: 'C:\\nowhere_b12\\B12Kine', InputObj: prop });
    ok('SILoadPreset falls back to SIFindPresetPath when the file does not exist', !r2.err, r2.err);
    undoTo(u0);
  }
  { // InspectBrowse
    const r = run('InspectBrowse', { Mode: 3, Length: -5 }); ok('InspectBrowse modes 3 / 4 ignore Length', !r.err, r.err);
  }

  // ================================================================ B11e
  const T11e = A.actionB11e;
  {
    reset(); const u0 = A.undoStack.length;
    const m1 = A.run('CreateModel', { InputObj: 'cube', Name: 'B12Src' }); const M1 = Array.isArray(m1) ? m1[0] : m1;
    const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'b12Null' }); const N = Array.isArray(nul) ? nul[0] : nul;
    const m2 = A.run('CreateModel', { InputObj: N.name, Name: 'B12Dst' }); const M2 = Array.isArray(m2) ? m2[0] : m2;
    N.kinematics.local.set('posx', 2); cube.kinematics.local.set('posx', 5);
    const cm = run('CreateConnectionMap', { Obj1: M1, Obj2: M2 }).v; const rr = cm?.rules ?? [];
    ok('CreateConnectionMap: model first, From = Obj2 object, To = Obj1 object', rr.length === 2 && rr[0].from === M2.fullName && rr[0].to === M1.fullName && rr[1].from === N.fullName && rr[1].to === cube.fullName, rr);
    const vm = run('CreateValueMap', { Obj1: M1, Obj2: M2, Mode: 3, Scope: 2 }).v; const vr = vm?.rules ?? [];
    const cx = vr.find(r => r.from === `${cube.fullName}.kine.local.posx`);
    ok('CreateValueMap: difference = Obj1 - Obj2, From = <Obj1 object>.<channel>, To = this + %lf', cx && cx.to === `this + ${(5 - 2).toFixed(6)}`, vr);
    ok('CreateValueMap: global channels before local (per pair)', vr.length === 12 && /kine\.global\./.test(vr[0].from) && /kine\.local\./.test(vr[3].from) && /kine\.global\./.test(vr[6].from), vr.map(r => r.from));
    const un = run('CreateValueMap', { Obj1: M1, Obj2: M2, Mode: 3, Scope: 1, UseNames: true }).v;
    ok('CreateValueMap UseNames: Obj2 names remapped through the existing connection map of the mixer (inferred), then matched by substring', un && un.count() === 6 && un.rules[3].from === `${cube.fullName}.kine.local.posx` && un.rules[3].to === 'this + 3.000000', un?.rules);
    const N2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'cu' }); const NN = Array.isArray(N2) ? N2[0] : N2; M2.addChild(NN); M1.addChild(A.run('GetPrim', { PresetObj: 'Null', Name: 'pad' }));
    const un3 = run('CreateValueMap', { Obj1: M1, Obj2: M2, Mode: 3, Scope: 1, UseNames: true }).v;
    ok('CreateValueMap UseNames: an unmapped name "cu" pairs with the first Obj1 object whose full name contains it (cube)', un3 && un3.count() === 9 && un3.rules.slice(6).every(r => r.from.startsWith(cube.fullName + '.')) && un3.rules[6].to === 'this + 5.000000', un3?.rules);
    NN.name = 'zz_nomatch'; const un4 = run('CreateValueMap', { Obj1: M1, Obj2: M2, Mode: 3, Scope: 1, UseNames: true }).v; NN.name = 'cu';
    ok('CreateValueMap UseNames: no partner -> no rule', un4 && un4.count() === 6, un4?.rules);
    M2.addChild(A.run('GetPrim', { PresetObj: 'Null', Name: 'extra' }));
    const t0 = (M1.property('mixer')?.mappingTemplatesB11e ?? []).length;
    const mm = run('CreateValueMap', { Obj1: M1, Obj2: M2 }); ok('CreateValueMap: unequal lists -> 0x8000FFFF, no map', status(mm) === 0x8000ffff && (M1.property('mixer')?.mappingTemplatesB11e ?? []).length === t0, mm.err);
    const mc = run('CreateConnectionMap', { Obj1: M1, Obj2: M2 }); ok('CreateConnectionMap: unequal lists -> silent success, no output, nothing created', !mc.err && mc.v === undefined && (M1.property('mixer')?.mappingTemplatesB11e ?? []).length === t0, mc);
    // rules
    const t = A.run('CreateEmptyConnectionMap', { Obj1: M1 });
    A.run('AddMappingRule', { MappingTemplate: t, From: 'a', To: 'A' });
    ok('AddMappingRule: a new rule has the template default flags', t.rules[0].active === true && t.rules[0].poseOffset === false);
    const g = run('GetMappingRule', { MappingTemplate: t, Index: 1 }); ok('GetMappingRule returns 1 (S_FALSE) on success, with the outputs', g.v?.From === 'a' && T11e.lastStatus.GetMappingRule === 1, g);
    const gc = run('GetMappingRule', { MappingTemplate: t, Index: 1 }); const gx = run('GetMappingRule', { MappingTemplate: t, Index: 2 });
    ok('GetMappingRule Index = count accepted; past the end -> 1, no outputs', gc.v?.From === 'a' && !gx.err && gx.v === undefined && T11e.lastStatus.GetMappingRule === 1, gx);
    const sn = run('SetMappingRule', { MappingTemplate: t, Index: 1, From: null, To: 'X' }); ok('SetMappingRule: a NULL string is rejected (0x80004003), nothing changes', status(sn) === 0x80004003 && t.rules[0].to === 'A', sn.err);
    run('SetMappingRule', { MappingTemplate: t, Index: 1, From: '', To: 'B', Active: 0 }); ok('SetMappingRule: an empty (non-NULL) string is written; flags set', t.rules[0].from === '' && t.rules[0].to === 'B' && t.rules[0].active === false, t.rules[0]);
    const sp = run('SetMappingRule', { MappingTemplate: t, Index: 9, From: 'q', To: 'Q' }); ok('SetMappingRule past the end (clamped to the count): fails, nothing changes', !!sp.err && t.count() === 1, sp.err);
    undoTo(u0); cube.kinematics.local.set('posx', 0); reset();
  }
  { // GetStoreActionDefaults
    const u0 = A.undoStack.length; const p = cube.kinematics.local.get('posy');
    A.anim.setExpression(p, 'Fc', () => undefined);
    const q = run('GetStoreActionDefaults', { InputObj: 'cube', Mode: 3 }).v; ok('GetStoreActionDefaults Mode 3 (expressions): scene span, one item', q && q.Size === 1 && q.From === A.anim.startFrame && q.To === A.anim.endFrame, q);
    A.anim.removeAnimation(p);
    A.select([cube, sphere]); A.run('ApplyCns', { Preset: 'Position' }); A.select([cube]);
    const qc = run('GetStoreActionDefaults', { InputObj: 'cube', Mode: 4 }).v; const ncns = cube.properties.filter(x => Array.isArray(x.targets)).length;
    ok('GetStoreActionDefaults Mode 4 (constraints): 3 items each, scene span', ncns > 0 && (qc && qc.Size === 3 * ncns && qc.From === A.anim.startFrame), [qc, ncns]);
    undoTo(u0);
  }
  { // AddPoseActionItems / LoadActionPreset
    const u0 = A.undoStack.length; A.select([cube]);
    const src = A.run('StoreAction', { InputObj: 'cube', Mode: 4, Name: 'B12Pose' });
    const r1 = run('AddPoseActionItems', { InputObjs: [src], Name: 'ROOT' }); const d = JSON.parse(src.val('data'));
    ok('AddPoseActionItems: <Name>.kine.local.{scl,rot,pos}{x,y,z} = 1,1,1,0,0,0,0,0,0', r1.v === 1 && d['ROOT.kine.local.sclx'] === 1 && d['ROOT.kine.local.rotz'] === 0 && d['ROOT.kine.local.posz'] === 0 && nya(r1) === 0, d);
    const r2 = run('AddPoseActionItems', { InputObjs: [src], Name: 'OTHER' }); ok('AddPoseActionItems: a source that already has pose items is skipped silently', r2.v === 0 && !('OTHER.kine.local.sclx' in JSON.parse(src.val('data'))) && !r2.err, r2);
    const ev = A.actionB11e.fileEvents; const e0 = ev.length;
    const l1 = run('LoadActionPreset', { Model: 'Scene_Root', FileName: 'C:\\B12Act\\walk.EANI' });
    ok('LoadActionPreset: case-insensitive extension; .eani fires 0x20510015 before and 0x20510016 after the load', !l1.err && ev.slice(e0).map(e => e.id.toString(16)).join() === '20510015,20510016', [l1.err, ev.slice(e0)]);
    const l2 = run('LoadActionPreset', { Model: 'Scene_Root', FileName: 'run.Preset' });
    ok('LoadActionPreset: folder + "\\" + file', !l2.err && l2.v?.val('filename') === '' && A.actionB11e.registry['Nle\\animmix\\action'] === 'C:\\B12Act', [l2.err, A.actionB11e.registry]);
    undoTo(u0); reset();
  }

  // ================================================================ B11f / B11g
  const T11f = A.actionB11f;
  { // CutClipInSpace
    reset(); const u0 = A.undoStack.length;
    A.run('StoreAction', { InputObj: 'cube', Mode: 4, Name: 'B12Cut', AddClip: true, ClipOffset: 1 });
    const mix = root.property('mixer'); const clip = mix.clips.find(c => /^B12Cut/.test(c.source ?? '') || /^B12Cut/.test(c.name)); const s0 = T11f.subtasks.length;
    const r = run('CutClipInSpace', { Model: 'Scene_Root', InputObjs: 'cube', Clip: clip.name }); const nc = r.v?.clip;
    const subs = T11f.subtasks.slice(s0).map(t => t.task);
    ok('CutClipInSpace: duplicate the source, AddTrack (animation track at the end), CopyClipToTrack at the clip start', nc && subs.join() === 'AddTrack,CopyClipToTrack' && nc.start === clip.start && nc.track > Math.max(...mix.clips.filter(c => c !== nc).map(c => Number(c.track ?? 0))) - 1 && nc.source !== clip.source && nya(r) === 0, [r.err, subs, nc]);
    undoTo(u0); reset();
  }
  { // FreezeLipSync
    reset(); const u0 = A.undoStack.length; cube.frTag = 'JawControl';
    const s = A.run('CreateSpeechAction', { Face: 'cube', Name: 'B12Talk' });
    const rx = cube.kinematics.local.get('rotx'); s.speechKeys = { 'cube.kine.local.rotx': [{ time: 1, value: 0 }, { time: 10, value: 30 }, { time: 20, value: 0 }] };
    A.anim.setKey(rx, 3, 7); const s0 = T11f.subtasks.length;
    const f = run('FreezeLipSync', { Model: 'Scene_Root' });
    const fc = A.anim.fcurves.get(rx); const subs = T11f.subtasks.slice(s0);
    ok('FreezeLipSync: the speech item fills the new fcurve', fc && fc.keys.map(k => `${k.time}:${k.value}`).join() === '1:0,10:30,20:0', fc?.keys);
    ok('FreezeLipSync: the existing fcurve is deleted (DeleteObj 0x10), AddFCurve connects the new one, the source is deleted', subs.some(t => t.task === 'DeleteObj' && /rotx/.test(t.detail) && /0x10/.test(t.detail)) && subs.some(t => t.task === 'AddFCurve') && subs.some(t => t.task === 'DeleteObj' && /^B12Talk/.test(t.detail)) && !root.properties.includes(s), subs);
    undoTo(u0); delete cube.frTag; reset();
  }
  { // CreateShapeGroup
    reset(); const u0 = A.undoStack.length;
    A.select([cube]); const k1 = A.run('StoreShapeKey', { InputObj: 'cube', Name: 'B12K1' }); const k2 = A.run('StoreShapeKey', { InputObj: 'cube', Name: 'B12K2' });
    const K1 = Array.isArray(k1) ? k1[0] : k1, K2 = Array.isArray(k2) ? k2[0] : k2;
    const n = run('CreateShapeGroup', { InputObj: [K1, 'cube'], Name: 'G' }); ok('CreateShapeGroup: an item that is not a shape key -> 0x80070057', status(n) === 0x80070057 && !K1.shapeGroup, n.err);
    const e = run('CreateShapeGroup', { InputObj: [K1], Name: '' }); ok('CreateShapeGroup: empty Name sets no name', !e.err && e.v === '' && !K1.shapeGroup, e);
    run('CreateShapeGroup', { InputObj: [K1], Name: 'Lips' }); const t2 = run('CreateShapeGroup', { InputObj: [K2], Name: 'Lips' });
    ok('CreateShapeGroup: a name used by a key of the owner is made unique', K1.shapeGroup === 'Lips' && t2.v === 'Lips1' && K2.shapeGroup === 'Lips1', [K1.shapeGroup, t2.v]);
    A.compSel = { obj: cube, kind: 'point', points: new Set([0, 1]), edges: new Set(), polygons: new Set() }; const oc = A.run('CreateCluster', { Name: 'B12Two' }); A.compSel = null;
    const K3 = new K1.constructor('B12K3', 'shapekey', []); oc.addProperty(K3);
    const mixd = run('CreateShapeGroup', { InputObj: [K1, K3], Name: 'Mix' }); ok('CreateShapeGroup: keys of different owners -> 0x80070057', status(mixd) === 0x80070057, mixd.err);
    oc.removeProperty(K3); const K4 = new K1.constructor('B12K4', 'shapekey', []);
    const no = run('CreateShapeGroup', { InputObj: [K4], Name: 'X' }); ok('CreateShapeGroup: a key without owner -> 0x80004003', status(no) === 0x80004003, no.err);
    undoTo(u0); reset();
  }
  { // StoreViseme capability bit 0x2 + attribute 0x10
    const u0 = A.undoStack.length; const gp = cube.kinematics.global.get('posx');
    gp.attributes = { 0x10: 0 }; const a = run('StoreViseme', { InputObj: 'cube.kine.global.posx', Name: 'B12V' });
    gp.attributes = { 0x10: 2 }; const b = run('StoreViseme', { InputObj: 'cube.kine.global.posx', Name: 'B12W' }); delete gp.attributes;
    ok('StoreViseme: read-only parameter stored when attribute 0x10 has bit 0x2 clear, skipped when set', a.v && Object.keys(JSON.parse(a.v.val('data'))).some(k => /global\.posx$/.test(k)) && b.v === null, [a.err, b.v]);
    undoTo(u0);
  }
  { // Evolver mapping file
    const u0 = A.undoStack.length; T11f.evolverParser = null;
    const xml = '<Root><PhonemeVisemeMappingProfile><Phoneme><Unicode>0041</Unicode><FonixCode>AA</FonixCode><PhonemeType>5</PhonemeType><Shape name="cube.kine.local.posx" weight="0.8"/><Shape name="cube.kine.local.posx" weight="0.5"/></Phoneme><phoneme><unicode>zz</unicode><FonixCode>BAD</FonixCode></phoneme></PhonemeVisemeMappingProfile></Root>';
    fsx.ensureFolder('C:\\B12Ev'); fsx.writeFile('C:\\B12Ev\\map.xml', xml); fsx.writeFile('C:\\B12Ev\\noprof.xml', '<Root><Other/></Root>'); fsx.writeFile('C:\\B12Ev\\bad.xml', '<Root><');
    const r = run('SetupEvolverVisemes', { Model: 'Scene_Root', ClipList: [], FileName: 'C:\\B12Ev\\map.xml' }); const act = r.v?.Action ?? [];
    const d = act[0] ? JSON.parse(act[0].val('data')) : {};
    ok('Evolver mapping: one viseme per hex Unicode entry, name <Unicode>_<FonixCode>, PhonemeType clamped to 2, later Shape pairs overwrite', act.length === 1 && act[0].name === '0041_AA' && d.PhonemeType === 2 && d['cube.kine.local.posx'] === 0.5, [r.err, act.map(s => s.name), d]);
    const np = run('SetupEvolverVisemes', { Model: 'Scene_Root', ClipList: [], FileName: 'C:\\B12Ev\\noprof.xml' }); const bd = run('SetupEvolverVisemes', { Model: 'Scene_Root', ClipList: [], FileName: 'C:\\B12Ev\\bad.xml' });
    ok('Evolver mapping: missing profile 0x8000FFFF, load failure 0x80004005 (both logged as 0x444)', status(np) === 0x8000ffff && status(bd) === 0x80004005 && np.log.some(l => /0x444/.test(l)), [np.err, bd.err]);
    undoTo(u0);
  }
  { // PlotCamSeqShape
    reset(); const u0 = A.undoStack.length; const cam = [...A.scene.allObjects()].find(o => o.type === 'camera');
    A.run('AddShotClip', { Name: 'B12S', Parent: cam.name, Frame: 1, StartFrame: 10, EndFrame: 12 });
    const s0 = (A.inferredB10.subtasks ?? []).length;
    const p1 = run('PlotCamSeqShape', { InputObjs: 'cube', StartFrame: 1, EndFrame: 3, PlotWithoutGaps: true });
    const mix = root.property('mixer'); const cpd = mix.compounds.find(c => c.name === p1.v?.ClipList?.[0] && false) ?? mix.compounds.find(c => c.type === 'ShapeActionCompoundClip');
    const subs = (A.inferredB10.subtasks ?? []).slice(s0).map(t => t.task);
    ok('PlotCamSeqShape: default name SQ_PlotShape, compound at frame 1 on a new shape track, Mode set', cpd && cpd.name === 'SQ_PlotShape' && cpd.start === 1 && cpd.mode === 4 && p1.v.KeyList.length === 3 && p1.v.KeyList.every(k => /^SQ_PlotShape/.test(k.name)), [p1.err, cpd]);
    ok('PlotCamSeqShape ApplyKeys: one clip per key from StartFrame in 1-frame steps, then StripDeformOperators', p1.v.ClipList.length === 3 && p1.v.ClipList.map(c => c.start).join() === '1,2,3' && subs.join() === 'AddTrack,CreateCompound,StoreShapeKey,StoreShapeKey,StoreShapeKey,StripDeformOperators', subs);
    const clips1 = [...p1.v.ClipList];
    const p2 = run('PlotCamSeqShape', { StartFrame: 1, EndFrame: 3, PlotWithoutGaps: true, Name: 'Again' });
    ok('PlotCamSeqShape, empty InputObjs: re-plots the objects already driven by shape clips; their old clips are deleted', p2.v?.KeyList?.length === 3 && p2.v.KeyList.every(k => cube.properties.includes(k)) && clips1.every(c => !mix.clips.includes(c)) && !mix.compounds.some(c => c.name === 'SQ_PlotShape'), [p2.err, mix.clips.map(c => c.name)]);
    A.undo();
    const p3 = run('PlotCamSeqShape', { InputObjs: 'cube', StartFrame: 1, EndFrame: 3, PlotWithoutGaps: true, ApplyKeys: false, Name: 'KeysOnly' });
    ok('PlotCamSeqShape ApplyKeys false: keys only, no clips, old clips kept', p3.v?.KeyList?.length === 3 && p3.v.ClipList === null && clips1.every(c => mix.clips.includes(c)), [p3.err, p3.v?.ClipList]);
    undoTo(u0); reset();
  }
  return out;
}, { TOUCHED, NEW, DF: [...DEFAULT_FAILS] });

await browser.close();

let failed = 0, total = 0;
const report = (name, cond, detail = '') => { total++; if (!cond) failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' ' + detail}`); };
for (const n of NEW) report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
for (const n of TOUCHED) report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
for (const [n, c, d] of got.checks) report(n, c, d);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_b12_b11_corrections: ${total - failed}/${total} ok`);
process.exit(failed ? 1 : 0);
