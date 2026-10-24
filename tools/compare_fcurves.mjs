// Compare Softimage Direct fcurve key dump vs Softimage PC golden (si_anim_fcurve_golden.json).
// Needs `vite preview` on :4173. Usage: node tools/compare_fcurves.mjs
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
  return fc.dump();
}, gfc.keys);

const diffs = [];
if (got.key_count !== gfc.key_count) diffs.push(`key_count ${got.key_count} != ${gfc.key_count}`);
if (got.extrap !== gfc.extrap) diffs.push(`extrap ${got.extrap} != ${gfc.extrap}`);
for (let i = 0; i < Math.max(got.keys.length, gfc.keys.length); i++) {
  const a = got.keys[i], b = gfc.keys[i];
  if (!a || !b) { diffs.push(`key[${i}] missing`); continue; }
  if (a.time !== b.time || a.value !== b.value) diffs.push(`key[${i}] time/value ${a.time},${a.value} != ${b.time},${b.value}`);
  if ((a.interp ?? 3) !== (b.interp ?? 3)) diffs.push(`key[${i}] interp ${a.interp} != ${b.interp}`);
}

// Sample mid-frame evaluation (Softimage spline @ frame 5 between 0@1 and 5@10)
const mid = await page.evaluate(() => {
  const A = window.Application; const p = A.scene.find('null').kinematics.local.get('posx');
  A.anim.frame = 5; return { frame: 5, value: p.value };
});

console.log(diffs.length ? 'DIFF' : 'OK', 'fcurve vs Softimage golden');
console.log(' dump', JSON.stringify(got));
console.log(' golden', JSON.stringify({ extrap: gfc.extrap, key_count: gfc.key_count, keys: gfc.keys }));
console.log(' mid', mid);
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/fcurve-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, got, golden: gfc, mid }, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
