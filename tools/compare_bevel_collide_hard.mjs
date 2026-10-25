// Softimage Direct vs PC hard-mesh Bevel managecollisions dump (si_bevel_collide_hard.json).
// Attested DIFF: grid_r08 only (OFF 288/285, ON 96/109). Other pairs stay mesh_equal.
// Needs vite preview on :4173. Usage: node tools/compare_bevel_collide_hard.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/local/bin/google-chrome',
  '/opt/google/chrome/chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const DUMP_PATHS = [
  path.resolve(__dirname, '../data/dump/si_bevel_collide_hard.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/model/si_bevel_collide_hard.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/model/si_bevel_collide_hard.json',
];
const DUMP = DUMP_PATHS.find(p => fs.existsSync(p));
if (!DUMP) { console.error('si_bevel_collide_hard.json not found'); process.exit(2); }
const pc = JSON.parse(fs.readFileSync(DUMP, 'utf8'));

const diffs = [];
const notes = [`loaded ${DUMP}`, `softimage ${pc.meta?.softimage}`, `script ${pc.meta?.script}`, `purpose ${pc.meta?.purpose}`];

if (pc.errors?.length) diffs.push(`PC errors: ${pc.errors.join('; ')}`);
if (pc.any_mesh_diff !== true) diffs.push(`PC any_mesh_diff=${pc.any_mesh_diff} (want true)`);

const PAIR = {
  thin_r09: ['thin_off_r09', 'thin_on_r09'],
  dense_r095: ['dense_off_r095', 'dense_on_r095'],
  cube_abs2: ['cube_off_abs2', 'cube_on_abs2'],
  grid_r08: ['grid_off_r08', 'grid_on_r08'],
  cube_r10: ['cube_off_r10', 'cube_on_r10'],
};

const ds = pc.diff_summary || {};
for (const [name, s] of Object.entries(ds)) {
  const wantDiff = name === 'grid_r08';
  if (wantDiff) {
    if (s.mesh_equal !== false) diffs.push(`PC ${name} mesh_equal=${s.mesh_equal} (want false)`);
    if (s.npts_off !== 288 || s.npts_on !== 96) diffs.push(`PC ${name} npts ${s.npts_off}/${s.npts_on}`);
    if (s.npolys_off !== 285 || s.npolys_on !== 109) diffs.push(`PC ${name} npolys ${s.npolys_off}/${s.npolys_on}`);
    notes.push(`PC ${name}: DIFF npts ${s.npts_off}/${s.npts_on} npolys ${s.npolys_off}/${s.npolys_on}`);
  } else {
    if (s.mesh_equal !== true) diffs.push(`PC ${name} mesh_equal=${s.mesh_equal} (want true)`);
    else notes.push(`PC ${name}: mesh_equal npts ${s.npts_off}/${s.npts_on}`);
  }
  if (s.managecollisions_off !== false || s.managecollisions_on !== true) {
    diffs.push(`PC ${name} managecollisions off=${s.managecollisions_off} on=${s.managecollisions_on}`);
  }
}

for (const [pair, [a, b]] of Object.entries(PAIR)) {
  for (const name of [a, b]) {
    const c = pc.cases?.[name];
    if (!c) { diffs.push(`missing case ${name}`); continue; }
    if (c.error) { diffs.push(`${name} error ${c.error}`); continue; }
    if (!(c.npts > 0 && Array.isArray(c.pts) && c.pts.length === c.npts)) diffs.push(`${name} pts length`);
    if (!(c.npolys > 0 && Array.isArray(c.polys) && c.polys.length === c.npolys)) diffs.push(`${name} polys length`);
    if (c.op_type !== 'bevelop') diffs.push(`${name} op_type=${c.op_type}`);
    const mc = c.params?.managecollisions ?? c.managecollisions;
    notes.push(`${name}: npts=${c.npts} npolys=${c.npolys} mc=${mc} ratio=${c.ratio} units=${c.units}`);
  }
  const A = pc.cases[a], B = pc.cases[b];
  if (!A?.pts || !B?.pts) continue;
  const eq = JSON.stringify(A.pts) === JSON.stringify(B.pts) && JSON.stringify(A.polys) === JSON.stringify(B.polys);
  if (pair === 'grid_r08') {
    if (eq) diffs.push(`PC ${pair} unexpectedly bit-identical`);
  } else if (!eq) {
    diffs.push(`PC ${pair} not bit-identical (want mesh_equal)`);
  }
}

const b = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1000);

const direct = await page.evaluate(() => {
  const A = window.Application;
  const meshInfo = (o) => {
    const m = o.primitive.mesh();
    return { npts: m.positions.length / 3, npolys: m.polygons.length, pts: Array.from(m.positions), polys: m.polygons.map(f => [...f]) };
  };
  const allEdges = (o) => {
    const m = o.primitive.mesh();
    const all = []; const seen = new Set();
    for (const f of m.polygons) for (let i = 0; i < f.length; i++) {
      const a = f[i], b2 = f[(i + 1) % f.length];
      const ek = Math.min(a, b2) + '-' + Math.max(a, b2);
      if (!seen.has(ek)) { seen.add(ek); all.push(ek); }
    }
    return all;
  };
  const runCube = (subdiv, ratio, units, manage) => {
    A.run('NewScene');
    const o = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const g = o.primitive.operators[0];
    g.set('subdivu', subdiv); g.set('subdivv', subdiv); g.set('subdivbase', subdiv);
    A.selectComponents(o, 'edge', allEdges(o));
    A.run('ApplyTopoOp', { PresetObj: 'Bevel' });
    const op = A.selection[0];
    if (op?.get?.('managecollisions')) op.set('managecollisions', manage);
    if (op?.get?.('ratio')) op.set('ratio', ratio);
    if (op?.get?.('units')) op.set('units', units);
    o.primitive.dirty = true;
    const info = meshInfo(o);
    return { ...info, manage: op?.get?.('managecollisions') ? !!op.val('managecollisions') : null, hasParam: !!(op && op.get && op.get('managecollisions')) };
  };
  const runGrid = (manage) => {
    A.run('NewScene');
    const o = A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface' });
    const g = o.primitive.operators[0];
    // Softimage dump: ulength=4, vlength=4, subdiv 8 → cell 0.5, bbox [-2,2]
    if (g.get('ulength')) g.set('ulength', 4);
    if (g.get('vlength')) g.set('vlength', 4);
    if (g.get('subdivu')) g.set('subdivu', 8);
    if (g.get('subdivv')) g.set('subdivv', 8);
    o.primitive.dirty = true;
    A.selectComponents(o, 'edge', allEdges(o));
    A.run('ApplyTopoOp', { PresetObj: 'Bevel' });
    const op = A.selection[0];
    if (op?.get?.('managecollisions')) op.set('managecollisions', manage);
    if (op?.get?.('ratio')) op.set('ratio', 0.8);
    if (op?.get?.('units')) op.set('units', 0);
    o.primitive.dirty = true;
    const info = meshInfo(o);
    return { ...info, manage: op?.get?.('managecollisions') ? !!op.val('managecollisions') : null, hasParam: !!(op && op.get && op.get('managecollisions')) };
  };
  const equalMesh = (a, b) => a.npts === b.npts && a.npolys === b.npolys
    && a.pts.length === b.pts.length && a.pts.every((v, i) => v === b.pts[i])
    && JSON.stringify(a.polys) === JSON.stringify(b.polys);

  const gridOff = runGrid(false), gridOn = runGrid(true);
  const pairs = {
    thin_r09: { off: runCube(4, 0.9, 0, false), on: runCube(4, 0.9, 0, true) },
    dense_r095: { off: runCube(6, 0.95, 0, false), on: runCube(6, 0.95, 0, true) },
    cube_abs2: { off: runCube(3, 2.0, 1, false), on: runCube(3, 2.0, 1, true) },
    cube_r10: { off: runCube(4, 1.0, 0, false), on: runCube(4, 1.0, 0, true) },
    grid_r08: { off: gridOff, on: gridOn },
  };
  const summary = {};
  for (const [k, { off, on }] of Object.entries(pairs)) {
    summary[k] = {
      npts_off: off.npts, npts_on: on.npts, npolys_off: off.npolys, npolys_on: on.npolys,
      mesh_equal: equalMesh(off, on), manageOff: off.manage, manageOn: on.manage, hasParam: off.hasParam,
    };
  }
  return summary;
});

for (const [name, s] of Object.entries(direct)) {
  notes.push(`Direct ${name}: npts ${s.npts_off}/${s.npts_on} npolys ${s.npolys_off}/${s.npolys_on} mesh_equal=${s.mesh_equal} mc=${s.manageOff}/${s.manageOn}`);
  if (!s.hasParam) diffs.push(`Direct ${name}: managecollisions param missing`);
  if (name === 'grid_r08') {
    if (s.mesh_equal) diffs.push('Direct grid_r08 mesh_equal — Softimage attests DIFF');
    if (s.npts_off !== 288 || s.npolys_off !== 285) diffs.push(`Direct grid_r08 OFF npts/npolys ${s.npts_off}/${s.npolys_off} want 288/285`);
    if (s.npts_on !== 96 || s.npolys_on !== 109) diffs.push(`Direct grid_r08 ON npts/npolys ${s.npts_on}/${s.npolys_on} want 96/109`);
  } else if (!s.mesh_equal) {
    diffs.push(`Direct ${name} on/off meshes differ — Softimage hard dump mesh_equal`);
  }
}

console.log(diffs.length ? 'DIFF' : 'OK', 'bevel collide hard dump harness');
for (const n of notes) console.log(' ', n);
for (const d of diffs) console.log('  DIFF', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/bevel-collide-hard-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  ok: diffs.length === 0, diffs, notes, dump: DUMP, meta: pc.meta, diff_summary: pc.diff_summary, direct,
}, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
