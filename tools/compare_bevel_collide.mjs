// Softimage Direct vs PC Bevel managecollisions dump (si_bevel_collide.json).
// Dump-backed only: no invent collide algorithm.
//
// PC dump (2026-10-25, fixed lastOp):
// - Bevel Op (bevelop) with managecollisions false/true + ratio attested.
// - collide on/off pairs remain bit-identical for these edge selections —
//   Softimage collide path is a no-op for these cases (attested, not invented).
//
// Harness locks PC attestations + asserts Direct true/false managecollisions
// stay mesh-identical (must not invent a collide delta Softimage did not show).
// Needs vite preview on :4173. Usage: node tools/compare_bevel_collide.mjs
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
  path.resolve(__dirname, '../data/dump/si_bevel_collide.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/model/si_bevel_collide.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/model/si_bevel_collide.json',
];
const DUMP = DUMP_PATHS.find(p => fs.existsSync(p));
if (!DUMP) { console.error('si_bevel_collide.json not found'); process.exit(2); }
const pc = JSON.parse(fs.readFileSync(DUMP, 'utf8'));

const diffs = [];
const notes = [`loaded ${DUMP}`, `softimage ${pc.meta?.softimage}`, `script ${pc.meta?.script}`, `purpose ${pc.meta?.purpose}`];

if (pc.errors?.length) notes.push(`PC errors: ${pc.errors.join('; ')}`);

const ds = pc.diff_summary || {};
for (const [name, s] of Object.entries(ds)) {
  if (s.mesh_equal !== true) diffs.push(`PC ${name} mesh_equal=${s.mesh_equal}`);
  else notes.push(`PC ${name}: mesh_equal npts ${s.npts_off}/${s.npts_on}`);
  if (s.managecollisions_off === false && s.managecollisions_on === true) {
    notes.push(`PC ${name}: managecollisions off/on attested false/true (meshes still equal)`);
  } else if (s.managecollisions_off != null || s.managecollisions_on != null) {
    notes.push(`PC ${name} managecollisions off=${s.managecollisions_off} on=${s.managecollisions_on}`);
  } else {
    diffs.push(`PC ${name}: managecollisions not attested (expected fixed lastOp dump)`);
  }
  if (s.op_off && s.op_off !== 'bevelop') diffs.push(`PC ${name} op_off=${s.op_off}`);
  if (s.op_on && s.op_on !== 'bevelop') diffs.push(`PC ${name} op_on=${s.op_on}`);
}

const need = ['collide_off_ratio08', 'collide_on_ratio08', 'collide_off_many_ratio06', 'collide_on_many_ratio06', 'collide_on_abs_ratio05'];
for (const name of need) {
  const c = pc.cases?.[name];
  if (!c) { diffs.push(`missing case ${name}`); continue; }
  if (c.error) { diffs.push(`${name} error ${c.error}`); continue; }
  if (!(c.npts > 0 && Array.isArray(c.pts) && c.pts.length === c.npts)) diffs.push(`${name} pts length`);
  if (!(c.npolys > 0 && Array.isArray(c.polys) && c.polys.length === c.npolys)) diffs.push(`${name} polys length`);
  if (c.op_type !== 'bevelop') diffs.push(`${name} op_type=${c.op_type} (want bevelop)`);
  const mc = c.params?.managecollisions ?? c.managecollisions;
  const ratio = c.params?.ratio;
  notes.push(`${name}: npts=${c.npts} npolys=${c.npolys} op=${c.op_type} managecollisions=${mc} ratio=${ratio}`);
  if (name.includes('collide_off') && mc !== false) diffs.push(`${name} managecollisions want false got ${mc}`);
  if (name.includes('collide_on') && mc !== true) diffs.push(`${name} managecollisions want true got ${mc}`);
}

for (const [a, b] of [['collide_off_ratio08', 'collide_on_ratio08'], ['collide_off_many_ratio06', 'collide_on_many_ratio06']]) {
  const A = pc.cases[a], B = pc.cases[b];
  if (!A?.pts || !B?.pts) continue;
  const eq = JSON.stringify(A.pts) === JSON.stringify(B.pts) && JSON.stringify(A.polys) === JSON.stringify(B.polys);
  if (!eq) diffs.push(`PC ${a} vs ${b} not bit-identical (collide delta — reopen Direct collide wire)`);
  else notes.push(`PC ${a} === ${b} bit-identical (Softimage collide no-op for case)`);
}

const b = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1000);

const pair = await page.evaluate(() => {
  const run = (manage) => {
    const A = window.Application;
    A.run('NewScene');
    const o = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const g = o.primitive.operators[0];
    g.set('subdivu', 3); g.set('subdivv', 3); g.set('subdivbase', 3);
    const m = o.primitive.mesh();
    const all = []; const seen = new Set();
    for (const f of m.polygons) for (let i = 0; i < f.length; i++) {
      const a = f[i], b2 = f[(i + 1) % f.length];
      const ek = Math.min(a, b2) + '-' + Math.max(a, b2);
      if (!seen.has(ek)) { seen.add(ek); all.push(ek); }
    }
    A.selectComponents(o, 'edge', all.slice(0, 6));
    A.run('ApplyTopoOp', { PresetObj: 'Bevel' });
    const op = A.selection[0];
    if (op?.get?.('managecollisions')) op.set('managecollisions', manage);
    if (op?.get?.('ratio')) op.set('ratio', 0.8);
    o.primitive.dirty = true;
    const out = o.primitive.mesh();
    return {
      pts: Array.from(out.positions),
      polys: out.polygons.map(f => f.length),
      hasParam: !!(op && op.get && op.get('managecollisions')),
      manage: op?.get?.('managecollisions') ? !!op.val('managecollisions') : null,
    };
  };
  const off = run(false), on = run(true);
  const equal = off.pts.length === on.pts.length
    && off.pts.every((v, i) => v === on.pts[i])
    && JSON.stringify(off.polys) === JSON.stringify(on.polys);
  return { equal, npts: off.pts.length / 3, hasParam: off.hasParam, manageOff: off.manage, manageOn: on.manage };
});

notes.push(`Direct managecollisions param present=${pair.hasParam} off=${pair.manageOff} on=${pair.manageOn}`);
notes.push(`Direct false/true mesh_equal=${pair.equal} npts=${pair.npts}`);
if (!pair.equal) {
  diffs.push('Direct managecollisions true/false meshes differ — Softimage dump shows no collide delta for these cases');
}

console.log(diffs.length ? 'DIFF' : 'OK', 'bevel collide dump harness');
for (const n of notes) console.log(' ', n);
for (const d of diffs) console.log('  DIFF', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/bevel-collide-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  ok: diffs.length === 0, diffs, notes, dump: DUMP, meta: pc.meta, diff_summary: pc.diff_summary, direct: pair,
}, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
