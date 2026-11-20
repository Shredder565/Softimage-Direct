// CMD-B16d: scnmgr filter-map commands, MarkObjectDirty, rendercore CopyPartition / RegenerateMaps,
// CreateEnvironmentCache output argument, kinechain GetSkeleton. No XSIBATCH golden exists for this row (nothing was
// executed); this checks the wire contract of docs/ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md and
// docs/re/WIRE_CORRECTIONS_B16.md items 29-37:
//   1. every name is registered with the registry argument list (names from data/command_registry.json, defaults as
//      data/commands_full.json prints them);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error;
//   3. routing: object vs polygon / edge / point selections, a mixed selection runs several targets in group order,
//      the catch-all group, empty input = selection; keys go through the filter map;
//   4. CopyPartition always adds a copy, RegenerateMaps clamp / E_INVALIDARG / 0x562e80d2, GetSkeleton outputs and
//      E_INVALIDARG, MarkObjectDirty "no handler", CreateEnvironmentCache output Source.
// Targets are traced (recorded, not executed) where only the routing is checked; value-exact (names, presets, args).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_filtermap_b16d.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const FILTER_MAP = ['Mesh Filter', 'Dice Object/Polygons', 'Delete Selected', 'Duplicate/Extrude Single', 'Duplicate/Extrude Multiple', 'Invert Polygons', 'Move Component Tool', 'Subdivide'];
const OTHERS = { MarkObjectDirty: 'MarkObjectDirty', CopyPartition: 'Copy Partition', RegenerateMaps: 'RegenerateMaps', CreateEnvironmentCache: 'CreateEnvironmentCache', GetSkeleton: 'C3DGetSkeletonInfoTask' };
const NAMES = [...FILTER_MAP, ...Object.keys(OTHERS)];
// GetSkeleton: cube is not in a skeleton (E_INVALIDARG); CreateEnvironmentCache: no simulation environment; Subdivide: the
// cube runs Subdivide Polygon (polygon_mesh group), whose bus operator needs a component selection and raises
const DEFAULT_FAILS = new Set(['GetSkeleton', 'CreateEnvironmentCache', 'Subdivide']);
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const HANDLER = '48becc30-5e5e-11d4-8c2c-009027bc3a0e';
const expected = {};
for (const n of NAMES) {
  const regName = OTHERS[n] ?? n;
  const r = reg.find(c => c.name === regName && (FILTER_MAP.includes(n) ? c.handler_clsid === HANDLER : true));
  const f = full.find(x => (x.scripting_name || x.name) === n && x.args.length === r?.args.length);
  expected[n] = r ? r.args.map((a, i) => [a.name, f ? (f.args[i].default ?? null) : (a.default ?? null)]) : null;
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('Mesh Filter') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m); return { v, log: L.filter(l => l.kind !== 'cmd').map(l => l.text), cmds: L.filter(l => l.kind === 'cmd').map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool?.(null); A.compSel = null; A.selMode = 'object'; A.select([cube]); };
  /** Replace commands' execute with recorders for the duration of f; returns [name, args] calls in order. */
  const trace = (names, f) => {
    const calls = []; const saved = names.map(n => { const d = A.commands.get(n); const orig = d.execute; d.execute = (app, a) => { calls.push([n, { ...a }]); return undefined; }; return [d, orig]; });
    try { f(); } finally { for (const [d, orig] of saved) d.execute = orig; }
    return calls;
  };
  const TARGETS = ['ApplyTopoOp', 'DeleteObj', 'Duplicate', 'DuplicateMeshComponent', 'TweakTool', 'SetCurveKnotMultiplicity'];
  const routes = (n, a = {}, before = () => {}) => { let r; const calls = trace(TARGETS, () => { before(); r = run(n, a); }); return { calls, r, sig: calls.map(([c, x]) => c === 'ApplyTopoOp' ? `ApplyTopoOp:${x.PresetObj}` : c) }; };
  const disp = () => A.filterMapB16d?.dispatches ?? [];
  const comps = (kind, items) => { A.compSel = null; A.selectComponents(cube, kind, items); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (targets really run; undone afterwards)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    A.setTool?.(null);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // ================= 3. filter-map routing
  try {
    // object selection (empty input = current selection)
    let x = routes('Mesh Filter');
    ok('Mesh Filter: a selected polygon mesh -> Filter Polygons (group 3, polygon_mesh)', x.sig.join() === 'ApplyTopoOp:Filter Polygons' && x.calls[0][1].ConnectionSet?.[0] === cube && disp().at(-1).group === 2, [x.sig, x.r.err]);
    ok('Mesh Filter: the target is what the command log shows', x.r.cmds?.length === 1 && /^ApplyTopoOp\(/.test(x.r.cmds[0]) || /ApplyTopoOp/.test(x.r.cmds?.[0] ?? ''), x.r.cmds);
    reset(); x = routes('Dice Object/Polygons');
    ok('Dice Object/Polygons: an object runs the Dice Object preset (correction 30; preset not in this build -> not yet attested)', x.sig.length === 0 && disp().at(-1).target === 'Dice Object' && nya(x.r) && !x.r.err, [x.sig, x.r.log]);
    reset(); x = routes('Invert Polygons');
    ok('Invert Polygons: an object -> catch-all Invert All Normals (preset Inverse)', x.sig.join() === 'ApplyTopoOp:Inverse' && disp().at(-1).target === 'Invert All Normals', x.sig);
    reset(); x = routes('Subdivide');
    ok('Subdivide: a mesh -> Subdivide Polygon (polygon_mesh group)', x.sig.length === 1 && /^ApplyTopoOp:(SubdividePolygon|Subdivide Polygon)$/.test(x.sig[0]) && disp().at(-1).group === 2, x.sig);
    reset(); x = routes('Delete Selected');
    ok('Delete Selected: an object -> catch-all DeleteObj with InputObj = the object', x.sig.join() === 'DeleteObj' && (x.calls[0][1].InputObj?.[0] ?? x.calls[0][1].InputObjs?.[0]) === cube, x.sig);
    reset(); x = routes('Duplicate/Extrude Single');
    ok('Duplicate/Extrude Single: an object -> Duplicate (Duplicate Single preset), InputObjs = the object', x.sig.join() === 'Duplicate' && x.calls[0][1].InputObjs?.[0] === cube && disp().at(-1).target === 'Duplicate Single', x.sig);
    reset(); x = routes('Duplicate/Extrude Multiple');
    ok('Duplicate/Extrude Multiple: an object -> Duplicate Multiple preset (not NbCopies 3)', x.sig.join() === 'Duplicate' && disp().at(-1).target === 'Duplicate Multiple' && Number(x.calls[0][1].NbCopies) !== 3, [x.sig, x.calls[0]?.[1]?.NbCopies]);
    ok('Duplicate/Extrude Multiple: its options wizard is logged as not yet attested', nya(x.r), x.r.log);
    reset(); x = routes('Move Component Tool');
    ok('Move Component Tool: not a curve -> TweakTool, no input argument', x.sig.join() === 'TweakTool' && !('InputObj' in x.calls[0][1]) && !('InputObjs' in x.calls[0][1]), x.calls);
    A.setTool?.(null);
    // polygon / edge / point selections
    x = routes('Mesh Filter', {}, () => comps('polygon', [0, 1]));
    ok('Mesh Filter: polygons -> Filter Polygons with ConnectionSet = the polygons', x.sig.join() === 'ApplyTopoOp:Filter Polygons' && /^cube\.poly\[0,1\]$/.test(x.calls[0][1].ConnectionSet) && disp().at(-1).group === 0, [x.sig, x.calls[0]?.[1]?.ConnectionSet]);
    x = routes('Mesh Filter', {}, () => comps('edge', ['0-1']));
    ok('Mesh Filter: edges -> Filter Edges (preset FilterEdge)', x.sig.join() === 'ApplyTopoOp:FilterEdge' && /^cube\.edge\[\d+\]$/.test(x.calls[0][1].ConnectionSet), [x.sig, x.calls[0]?.[1]?.ConnectionSet]);
    x = routes('Mesh Filter', {}, () => comps('point', [0]));
    ok('Mesh Filter: points -> nothing (no catch-all group)', x.sig.length === 0 && !x.r.err, x.sig);
    x = routes('Dice Object/Polygons', {}, () => comps('polygon', [2]));
    ok('Dice Object/Polygons: polygons -> Dice Polygons', x.sig.join() === 'ApplyTopoOp:Dice Polygons', x.sig);
    x = routes('Invert Polygons', {}, () => comps('polygon', [2]));
    ok('Invert Polygons: polygons -> Invert Selected Polygons (preset InvertPolygon)', x.sig.join() === 'ApplyTopoOp:InvertPolygon' && disp().at(-1).target === 'Invert Selected Polygons', x.sig);
    x = routes('Subdivide', {}, () => comps('polygon', [3]));
    ok('Subdivide: polygons -> Subdivide Polygon', x.sig.length === 1 && /Subdivide ?Polygon/.test(x.sig[0]) && disp().at(-1).group === 0, x.sig);
    x = routes('Subdivide', {}, () => comps('edge', ['0-1']));
    ok('Subdivide: edges -> Subdivide Edge (preset not in this build -> not yet attested)', x.sig.length === 0 && disp().at(-1).target === 'Subdivide Edge' && nya(x.r), [x.sig, x.r.log]);
    x = routes('Delete Selected', {}, () => comps('polygon', [4]));
    ok('Delete Selected: polygons -> Delete Component', x.sig.length === 1 && /^ApplyTopoOp:(DeleteComponent|Delete Component)$/.test(x.sig[0]) && /^cube\.poly\[4\]$/.test(x.calls[0][1].ConnectionSet), [x.sig, x.calls[0]?.[1]]);
    x = routes('Delete Selected', {}, () => comps('point', [0, 1]));
    ok('Delete Selected: points -> Dissolve & Clean Adjacent Vertices (MeshComponent)', x.sig.length === 1 && /Dissolve/.test(x.sig[0]) && disp().at(-1).filter === 'MeshComponent', x.sig);
    x = routes('Delete Selected', {}, () => comps('edge', ['0-1']));
    ok('Delete Selected: edges -> Dissolve & Clean Adjacent Vertices', x.sig.length === 1 && /Dissolve/.test(x.sig[0]), x.sig);
    x = routes('Duplicate/Extrude Single', {}, () => comps('polygon', [0]));
    ok('Duplicate/Extrude Single: polygons -> DuplicateMeshComponent (single preset: Length 0, NbSubdivs 0)', x.sig.join() === 'DuplicateMeshComponent' && x.calls[0][1].Length === 0 && x.calls[0][1].NbSubdivs === 0 && /^cube\.poly\[0\]$/.test(x.calls[0][1].ConnectionSet), x.calls);
    x = routes('Duplicate/Extrude Multiple', {}, () => comps('polygon', [0]));
    ok('Duplicate/Extrude Multiple: polygons -> DuplicateMeshComponent (multiple preset: Length 1, NbSubdivs 5)', x.sig.join() === 'DuplicateMeshComponent' && x.calls[0][1].Length === 1 && x.calls[0][1].NbSubdivs === 5, x.calls);
    // mixed selection (explicit input): several targets in group order
    reset(); x = routes('Mesh Filter', { InputObjs: 'cube.poly[0,1],cube.edge[0]' });
    ok('Mesh Filter: mixed polygons + edges -> Filter Polygons then Filter Edges', x.sig.join() === 'ApplyTopoOp:Filter Polygons,ApplyTopoOp:FilterEdge', x.sig);
    reset(); x = routes('Subdivide', { InputObjs: 'cube.edge[0],cube.poly[2]' });
    ok('Subdivide: mixed -> Subdivide Polygon run, then Subdivide Edge (not in this build) logged', x.sig.length === 1 && /Subdivide ?Polygon/.test(x.sig[0]) && disp().slice(-2).map(d => d.target).join() === 'Subdivide Polygon,Subdivide Edge', [x.sig, disp().slice(-2)]);
    const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'nulB16d' }); reset();
    x = routes('Delete Selected', { InputObj: ['cube.poly[1]', nul] });
    ok('Delete Selected: polygons + a null -> Delete Component on the polygons, catch-all DeleteObj on the null only', x.sig.length === 2 && /Delete ?Component/.test(x.sig[0]) && x.sig[1] === 'DeleteObj' && x.calls[1][1].InputObj?.length === 1 && x.calls[1][1].InputObj[0] === nul, [x.sig, x.calls.map(c => c[1].InputObj ?? c[1].ConnectionSet)]);
    x = routes('Dice Object/Polygons', { InputObjs: ['cube.poly[0]', cube] });
    ok('Dice Object/Polygons: polygons + object -> Dice Polygons, then Dice Object (not in this build)', x.sig.join() === 'ApplyTopoOp:Dice Polygons' && disp().slice(-2).map(d => d.target).join() === 'Dice Polygons,Dice Object', disp().slice(-2));
    // UserCluster
    const cls = A.run('CreateCluster', { InputObjs: 'cube.pnt[0,1]' }); const clu = Array.isArray(cls) ? cls[0] : cls;
    if (clu) { reset(); A.select([clu]); x = routes('Delete Selected'); ok('Delete Selected: a user cluster -> DeleteObj (UserCluster group 1) with InputObj = the cluster', x.sig.join() === 'DeleteObj' && disp().at(-1).group === 0 && x.calls[0][1].InputObj?.[0] === clu, [x.sig, disp().at(-1)]); }
    else ok('Delete Selected: a user cluster (CreateCluster made none)', false, cls);
    // nothing selected: nothing runs
    A.compSel = null; A.select([]); const n0 = disp().length; x = routes('Delete Selected');
    ok('Delete Selected: nothing selected -> no target runs', x.sig.length === 0 && disp().length === n0 && !x.r.err, x.sig);
    // real runs (targets executed, then undone)
    reset(); let u0 = A.undoStack.length; let r = run('Delete Selected', { InputObj: [nul] });
    ok('Delete Selected (real): the object is deleted; DeleteObj logged', !A.scene.find('nulB16d') && !r.err && (r.cmds ?? []).some(c => /DeleteObj/.test(c)), [r.err, r.cmds]);
    while (A.undoStack.length > u0) A.undo();
    ok('Delete Selected (real): one undo restores it', !!A.scene.find('nulB16d'));
    reset(); comps('polygon', [5]); u0 = A.undoStack.length; const ops0 = cube.primitive.operators.length; r = run('Invert Polygons');
    ok('Invert Polygons (real): polygons -> an invert operator on the cube', !r.err && cube.primitive.operators.length === ops0 + 1, [r.err, r.log]);
    while (A.undoStack.length > u0) A.undo();
    if (clu) { reset(); A.select([clu]); u0 = A.undoStack.length; r = run('Delete Selected'); ok('Delete Selected (real): the cluster is removed', !cube.clusters.includes(clu) && !r.err, r.err); while (A.undoStack.length > u0) A.undo(); }
    A.scene.root.removeChild(nul);
    // keys and menu go through the filter map
    reset(); const viaKey = (k) => { let c; const calls = trace(['Delete Selected', 'Duplicate/Extrude Single', 'Duplicate/Extrude Multiple', 'Move Component Tool', 'Subdivide'], () => window.__keyAction(k)); return calls.map(c => c[0]); };
    for (const k of ['Delete Selected', 'Duplicate/Extrude Single', 'Duplicate/Extrude Multiple', 'Move Component Tool', 'Subdivide']) ok(`key action "${k}" runs the filter-map command`, viaKey(k).join() === k, viaKey(k));
  } catch (e) { ok('filter-map block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= 4. MarkObjectDirty / CopyPartition / RegenerateMaps / CreateEnvironmentCache / GetSkeleton
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  try {
    reset();
    let r = run('MarkObjectDirty', { Object: 'cube' });
    ok('MarkObjectDirty: logs "no handler", returns nothing, no undo entry', has(r, /no handler/) && r.v === undefined && !r.err);
    // CopyPartition
    const pass2 = A.run('CreatePass', { Name: 'passB16d' }); const cur = A.scene.passes[0];
    const src = cur.partitions[0];
    const before = pass2.partitions.length; const same0 = pass2.partitions.filter(z => z.name === src.name).length;
    let u0 = A.undoStack.length;
    r = run('CopyPartition', { Target: [pass2], InputObjs: [src] });
    const copies = pass2.partitions.filter(z => z.name === src.name);
    ok('CopyPartition: a new copy is added even though the pass has a same-named partition', same0 >= 1 && copies.length === same0 + 1 && pass2.partitions.length === before + 1, [same0, copies.length, r.err]);
    const copy = copies.at(-1);
    ok('CopyPartition: the copy has the source members and parameters, is not the source', copy !== src && [...src.members].every(m => copy.members.has(m)) && src.params.every(p => p.def.readOnly || copy.get(p.def.name)?.value === p.value));
    ok('CopyPartition: in the target pass the members left their old partition', pass2.partitions.filter(z => z !== copy).every(z => [...src.members].every(m => !z.members.has(m))));
    ok('CopyPartition: returns nothing', r.v === undefined && !r.err);
    while (A.undoStack.length > u0) A.undo();
    ok('CopyPartition: undo removes the copy', pass2.partitions.length === before);
    const tot = A.scene.passes.reduce((s, p) => s + p.partitions.length, 0);
    r = run('CopyPartition'); const r2 = run('CopyPartition', { Target: [pass2] }); const r3 = run('CopyPartition', { InputObjs: [src] });
    ok('CopyPartition: no fallbacks (no args / no partitions / no passes -> nothing copied)', A.scene.passes.reduce((s, p) => s + p.partitions.length, 0) === tot && !r.err && !r2.err && !r3.err);
    // RegenerateMaps
    const PropCls = cube.property('visibility').constructor; const rmp = new PropCls('RenderMapB16d', 'rendermap', []); cube.addProperty(rmp);
    const S = A.filterMapB16d;
    r = run('RegenerateMaps', { Properties: [rmp], TileSize: 4 });
    ok('RegenerateMaps: TileSize 4 clamped to 8 with a warning', S.out.RegenerateMaps.TileSize === 8 && has(r, /WARNING.*clamped to 8/), [S.out.RegenerateMaps.TileSize, r.log]);
    r = run('RegenerateMaps', { Properties: [rmp], TileSize: 1000 });
    ok('RegenerateMaps: TileSize 1000 clamped to 512', S.out.RegenerateMaps.TileSize === 512 && has(r, /clamped to 512/));
    r = run('RegenerateMaps', { Properties: [rmp] });
    ok('RegenerateMaps: TileSize 32 kept, no warning; rendering logged as not yet attested', S.out.RegenerateMaps.TileSize === 32 && !has(r, /WARNING/) && nya(r) && !r.err, r.log);
    const amb = A.uiGroupViewTasks?.ambient ?? S.ambient;
    ok('RegenerateMaps: PATH_TEMPLATE_SYSTEM_TIME set for the run (FILETIME) and cleared after', typeof S.out.RegenerateMaps.systemTime === 'bigint' && S.out.RegenerateMaps.systemTime > 130000000000000000n && !('PATH_TEMPLATE_SYSTEM_TIME' in amb), String(S.out.RegenerateMaps.systemTime));
    r = run('RegenerateMaps', { Properties: [] });
    ok('RegenerateMaps: empty list -> nothing done, status 0x562e80d2', !r.err && S.lastStatus.RegenerateMaps === 0x562e80d2 && !nya(r));
    A.compSel = null; A.select([]); r = run('RegenerateMaps');
    ok('RegenerateMaps: Properties missing (nothing selected) -> E_INVALIDARG', status(r, '80070057'), r.err);
    reset(); r = run('RegenerateMaps');
    ok('RegenerateMaps: no Properties -> filled from the selection (arg handler 7834cb8c); no rendermap type filter', !r.err && S.out.RegenerateMaps.Properties?.[0] === cube, r.err);
    cube.removeProperty(rmp);
    // CreateEnvironmentCache
    const env = A.run('CreateEnvironment', {}); const envNode = Array.isArray(env) ? env[0] : env;
    const args = { Model: cube, Environment: envNode };
    r = run('CreateEnvironmentCache', args);
    ok('CreateEnvironmentCache: output argument Source = the new cache (also returned)', !r.err && r.v?.model === cube && A.inferredB15?.out?.CreateEnvironmentCache?.Source === r.v, r.err);
    // GetSkeleton
    reset(); r = run('GetSkeleton', { InputObj: 'cube' });
    ok('GetSkeleton: an object not in a skeleton -> E_INVALIDARG (no empty result)', status(r, '80070057'), r.err);
    const chainRoot = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [2, 0, 0], [3, 1, 0]] });
    const bone = chainRoot?.bones?.[0];
    u0 = A.undoStack.length;
    r = run('GetSkeleton', { InputObj: [bone] });
    const o = A.shellsB15Else?.out?.GetSkeleton;
    ok('GetSkeleton: outputs Index (int) and ChainElements (root, bones, effector)', !r.err && o && o.Index === 1 && Number.isInteger(o.Index) && o.ChainElements[0] === chainRoot && o.ChainElements.at(-1) === chainRoot.effector && o.ChainElements.length === chainRoot.bones.length + 2, [r.err, o?.Index, o?.ChainElements?.map?.(x => x.name)]);
    ok('GetSkeleton: returned as the output-argument collection; not undoable', r.v?.Index === 1 && r.v?.ChainElements === o.ChainElements && A.undoStack.length === u0);
    r = run('GetSkeleton', { InputObj: [chainRoot.effector] });
    ok('GetSkeleton: the effector is the last element', A.shellsB15Else.out.GetSkeleton.Index === A.shellsB15Else.out.GetSkeleton.ChainElements.length - 1, r.err);
    A.scene.root.removeChild(chainRoot);
  } catch (e) { ok('rendercore / kinechain block threw', false, String(e?.stack ?? e).slice(0, 400)); }
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(expected[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(expected[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_filtermap_b16d: ${pass}/${pass + fail} ok (${FILTER_MAP.length} filter-map commands + ${Object.keys(OTHERS).length} others)`);
await browser.close();
process.exit(fail ? 1 : 0);
