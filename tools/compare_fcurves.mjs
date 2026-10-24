// Compare Softimage Direct fcurve dump vs Softimage PC golden (si_anim_fcurve_golden.json)
// plus hermite/flat-tangent eval samples. Needs `vite preview` on :4173.
// Usage: node tools/compare_fcurves.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const GOLDEN = [
  path.resolve(__dirname, '../data/dump/si_anim_fcurve_golden.json'),
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_anim_fcurve_golden.json',
].find(p => fs.existsSync(p));
if (!GOLDEN) { console.error('No si_anim_fcurve_golden.json'); process.exit(2); }
const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
const gfc = golden.fcurve;

// Softimage default keys have Left==Right==Value → flat tangents → cubic hermite with m0=m1=0
// ≡ smoothstep between keys. Until PC eval dump lands, pin Direct hermite samples as regression golden.
function smoothstepHermite(t0, v0, t1, v1, frame) {
  const t = (frame - t0) / (t1 - t0);
  const s = t * t * (3 - 2 * t);
  return v0 + (v1 - v0) * s;
}
const EVAL_FRAMES = [1, 5, 10, 15, 20];
const EVAL_GOLDEN_PATHS = [
  path.resolve(__dirname, '../data/dump/si_anim_fcurve_eval_golden.json'),
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_anim_fcurve_eval_golden.json',
].filter(p => fs.existsSync(p));
let EVAL_EXPECTED = EVAL_FRAMES.map(f => {
  let v;
  if (f <= 1) v = 0;
  else if (f <= 10) v = smoothstepHermite(1, 0, 10, 5, f);
  else if (f <= 20) v = smoothstepHermite(10, 5, 20, 0, f);
  else v = 0;
  return { frame: f, value: v };
});
let evalSource = 'direct-hermite-pin';
if (EVAL_GOLDEN_PATHS[0]) {
  try {
    const eg = JSON.parse(fs.readFileSync(EVAL_GOLDEN_PATHS[0], 'utf8'));
    const samples = eg.samples || eg.eval || eg.flat_samples || [];
    if (Array.isArray(samples) && samples.length) {
      EVAL_EXPECTED = EVAL_FRAMES.map(f => {
        const row = samples.find(s => s.frame === f || s.time === f);
        return row ? { frame: f, value: Number(row.value) } : EVAL_EXPECTED.find(e => e.frame === f);
      }).filter(Boolean);
      evalSource = EVAL_GOLDEN_PATHS[0];
    }
  } catch { /* keep hermite pin */ }
}

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1000);
await page.evaluate(() => { window.prompt = (_m, d) => (d == null ? '' : String(d)); window.confirm = () => true; });

const got = await page.evaluate((keys) => {
  const A = window.Application;
  A.run('NewScene');
  A.run('GetPrim', { PresetObj: 'Null', Name: 'null' });
  const n = A.scene.find('null');
  const p = n.kinematics.local.get('posx');
  A.anim.startFrame = 1; A.anim.endFrame = 30;
  for (const k of keys) { p.value = k.value; A.anim.setKey(p, k.time, k.value); }
  const fc = A.anim.fcurve(p);
  return { dump: fc.dump(), samples: fc.sample(1, 20, 1) };
}, gfc.keys);

const diffs = [];
const dump = got.dump;
if (dump.key_count !== gfc.key_count) diffs.push(`key_count ${dump.key_count} != ${gfc.key_count}`);
if (dump.extrap !== gfc.extrap) diffs.push(`extrap ${dump.extrap} != ${gfc.extrap}`);
for (let i = 0; i < Math.max(dump.keys.length, gfc.keys.length); i++) {
  const a = dump.keys[i], b = gfc.keys[i];
  if (!a || !b) { diffs.push(`key[${i}] missing`); continue; }
  if (a.time !== b.time || a.value !== b.value) diffs.push(`key[${i}] time/value ${a.time},${a.value} != ${b.time},${b.value}`);
  if ((a.interp ?? 3) !== (b.interp ?? 3)) diffs.push(`key[${i}] interp ${a.interp} != ${b.interp}`);
  if ((a.left ?? a.value) !== (b.left ?? b.value) || (a.right ?? a.value) !== (b.right ?? b.value)) {
    diffs.push(`key[${i}] left/right ${a.left}/${a.right} != ${b.left}/${b.right}`);
  }
}

const TOL = 1e-9;
for (const exp of EVAL_EXPECTED) {
  const row = got.samples.find(s => s.frame === exp.frame);
  if (!row) { diffs.push(`eval frame ${exp.frame} missing`); continue; }
  if (Math.abs(row.value - exp.value) > TOL) diffs.push(`eval@${exp.frame} ${row.value} != ${exp.value}`);
}

// Non-flat tangent smoke: Left/Right handles should pull the mid value off smoothstep
const handled = await page.evaluate(() => {
  const A = window.Application;
  const p = A.scene.find('null').kinematics.local.get('posx');
  const fc = A.anim.fcurve(p, true);
  fc.keys = [
    { time: 1, value: 0, left: 0, right: 2, interp: 3 },
    { time: 10, value: 5, left: 3, right: 5, interp: 3 },
  ];
  A.anim.frame = 5;
  return { frame: 5, value: p.value, flatRef: (() => { const t = 4 / 9; return 0 + 5 * (t * t * (3 - 2 * t)); })() };
});
if (!(Math.abs(handled.value - handled.flatRef) > 1e-6)) diffs.push(`tangent handles did not change mid eval (${handled.value})`);

console.log(diffs.length ? 'DIFF' : 'OK', 'fcurve vs Softimage golden + hermite eval');
console.log(' evalSource', evalSource);
console.log(' dump', JSON.stringify(dump));
console.log(' eval', JSON.stringify(EVAL_EXPECTED.map(e => ({ ...e, got: got.samples.find(s => s.frame === e.frame)?.value }))));
console.log(' handled', handled);
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/fcurve-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, dump, evalSource, evalExpected: EVAL_EXPECTED, samples: got.samples, handled }, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
