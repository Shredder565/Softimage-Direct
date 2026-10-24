// Walks every Animate-toolbar menu item (needs `vite preview` on :4173).
// Softimage PC leaf list: data/dump/animate-menu-leaves.json (345). Usage: node tools/walk_animate_menu.mjs
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
if (!CHROME) { console.error('No Chromium executable found; set PW_CHROME'); process.exit(2); }

const DUMP_LEAVES = [
  path.resolve(__dirname, '../data/dump/animate-menu-leaves.json'),
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/animate-menu-leaves.json',
].find(p => fs.existsSync(p));

const ITEM_MS = Number(process.env.ANIM_WALK_TIMEOUT_MS || 8000);

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1600, height: 950 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1200);
await page.evaluate(() => {
  window.prompt = (_msg, def) => (def == null ? '1' : String(def));
  window.confirm = () => true;
  window.alert = () => {};
});

const status = await page.evaluate(() => window.__menuStatus('Animate'));
const out = { ok: [], grey: [], fail: [], timeout: [], bySection: {}, leafCount: status.length };

const stubDialogs = async () => {
  await page.evaluate(() => {
    window.prompt = (_msg, def) => (def == null ? '1' : String(def));
    window.confirm = () => true;
    window.alert = () => {};
  });
};

const setupAndRun = async (it) => {
  await page.evaluate(({ path: menuPath, label }) => {
    const A = window.Application;
    A.anim.stop();
    A.run('NewScene');
    A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface' });
    A.run('Translate', { X: 3, Y: 0, Z: 0 });
    A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' });
    try { A.run('Create2DSkeleton', { Points: [[0, 0, 0], [0, 2, 0], [0, 4, 0]] }); } catch { /* */ }
    A.run('SelectObj', { InputObjs: 'cube' });
    const cube = A.scene.find('cube');
    if (cube) {
      A.anim.marked.clear();
      for (const ax of ['x', 'y', 'z']) { const prm = cube.kinematics.local.get('pos' + ax); if (prm) A.anim.marked.add(prm); }
      A.anim.setKey(cube.kinematics.local.get('posx'), 1, 0);
      A.anim.setKey(cube.kinematics.local.get('posx'), 20, 2);
      try { A.run('CreateCharacterKeySet', { Name: 'WalkKeySet' }); } catch { /* */ }
    }
    A.run('SelectObj', { InputObjs: 'cube,sphere' });
    // Interactive curve tools only need to arm; clear any prior tool first.
    try { A.setTool?.(null); } catch { /* */ }
    window.__runMenu('Animate', menuPath, label);
    try { A.setTool?.(null); A.anim.stop(); } catch { /* */ }
  }, { path: it.path, label: it.label });
};

for (let i = 0; i < status.length; i++) {
  const it = status[i];
  const top = (it.path.split(' > ')[0] || '?');
  const bucket = out.bySection[top] ??= { ok: 0, grey: 0, fail: 0, timeout: 0 };
  const tag = `${it.path} > ${it.label}`;
  if (!it.implemented) { out.grey.push({ path: it.path, label: it.label, cmd: it.cmd }); bucket.grey++; continue; }
  try {
    await Promise.race([
      setupAndRun(it),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ITEM_MS}ms`)), ITEM_MS)),
    ]);
    out.ok.push(tag); bucket.ok++;
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/timeout/i.test(msg)) { out.timeout.push(tag + (it.cmd ? ` [${it.cmd}]` : '')); bucket.timeout++; }
    else { out.fail.push(tag + ' — ' + msg + (it.cmd ? ` [${it.cmd}]` : '')); bucket.fail++; }
    // Aborting a hung evaluate requires a reload; otherwise later items also time out.
    try { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(600); await stubDialogs(); } catch { /* */ }
  }
  if ((i + 1) % 50 === 0) console.log('…', i + 1, '/', status.length, 'ok', out.ok.length, 'grey', out.grey.length, 'fail', out.fail.length, 'timeout', out.timeout.length);
}

let dumpNote = 'no Softimage PC leaf dump found';
if (DUMP_LEAVES) {
  const dump = JSON.parse(fs.readFileSync(DUMP_LEAVES, 'utf8'));
  const n = dump.meta?.leaf_count ?? dump.leaves?.length ?? 0;
  dumpNote = `PC dump leaf_count=${n}; Direct status leaves=${out.leafCount}`;
  if (n && n !== out.leafCount) console.log('LEAF COUNT MISMATCH', dumpNote);
}

console.log('ok', out.ok.length, 'grey', out.grey.length, 'fail', out.fail.length, 'timeout', out.timeout.length);
console.log('by section', JSON.stringify(out.bySection));
console.log('dump', dumpNote);
for (const f of out.fail.slice(0, 60)) console.log(' FAIL', f);
for (const t of out.timeout.slice(0, 40)) console.log(' TIMEOUT', t);
const greyCmds = {};
for (const g of out.grey) { const c = g.cmd || '(unmapped)'; greyCmds[c] = (greyCmds[c] || 0) + 1; }
console.log('grey by cmd', Object.entries(greyCmds).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}:${n}`).join(' | ') || '(none)');
for (const g of out.grey) console.log(' GREY', g.path, '>', g.label, g.cmd ? `→ ${g.cmd}` : '(unmapped)');
if (errs.length) console.log('page errors', errs.slice(0, 10));

const outPath = path.resolve(__dirname, '../docs/screenshots/animate-walk-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: out.ok.length, grey: out.grey.length, fail: out.fail.length, timeout: out.timeout.length, bySection: out.bySection, dump: dumpNote, greyItems: out.grey, failSample: out.fail.slice(0, 80), timeoutSample: out.timeout.slice(0, 40) }, null, 2));
console.log('wrote', outPath);
await b.close();
process.exit(out.fail.length || out.timeout.length ? 1 : 0);
