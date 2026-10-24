// Walks every Model-toolbar menu item (needs `vite preview` on :4173).
// Timed per-item (like walk_animate_menu) — stock single-evaluate hangs in this env.
// Usage: node tools/walk_model_menu.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/local/bin/google-chrome',
  '/opt/google/chrome/chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium executable found; set PW_CHROME'); process.exit(2); }

const ITEM_MS = Number(process.env.MODEL_WALK_TIMEOUT_MS || 5000);
const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1600, height: 950 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1200);
await page.evaluate(() => {
  window.prompt = (_msg, def) => (def == null ? 'Softimage' : String(def));
  window.confirm = () => true;
  window.alert = () => {};
});

const status = await page.evaluate(() => window.__menuStatus('Model'));
const out = { ok: [], grey: [], fail: [], timeout: [], leafCount: status.length };

const stubDialogs = async () => {
  await page.evaluate(() => {
    window.prompt = (_msg, def) => (def == null ? 'Softimage' : String(def));
    window.confirm = () => true;
    window.alert = () => {};
  });
};

const setupAndRun = async (it) => {
  await page.evaluate(({ path: menuPath, label }) => {
    const A = window.Application;
    A.run('NewScene');
    const c = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    try { c.primitive.operators[0].set('subdivu', 3); c.primitive.operators[0].set('subdivv', 3); c.primitive.operators[0].set('subdivbase', 3); } catch { /* */ }
    A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface' });
    A.run('Translate', { X: 3, Y: 0, Z: 0 });
    A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' });
    A.run('SelectObj', { InputObjs: 'cube' });
    try { A.setTool?.(null); } catch { /* */ }
    window.__runMenu('Model', menuPath, label);
    try { A.setTool?.(null); } catch { /* */ }
  }, { path: it.path, label: it.label });
};

for (let i = 0; i < status.length; i++) {
  const it = status[i];
  const tag = `${it.path} > ${it.label}`;
  if (!it.implemented) { out.grey.push(tag); continue; }
  try {
    await Promise.race([
      setupAndRun(it),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ITEM_MS}ms`)), ITEM_MS)),
    ]);
    out.ok.push(tag);
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/timeout/i.test(msg)) out.timeout.push(tag + (it.cmd ? ` [${it.cmd}]` : ''));
    else out.fail.push(tag + ' — ' + msg);
    try { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500); await stubDialogs(); } catch { /* */ }
  }
  if ((i + 1) % 50 === 0) console.log('…', i + 1, '/', status.length, 'ok', out.ok.length, 'grey', out.grey.length, 'fail', out.fail.length, 'timeout', out.timeout.length);
}

console.log('ok', out.ok.length, 'grey', out.grey.length, 'fail', out.fail.length, 'timeout', out.timeout.length, 'leaves', out.leafCount);
for (const f of out.fail.slice(0, 40)) console.log(' FAIL', f);
for (const t of out.timeout.slice(0, 40)) console.log(' TIMEOUT', t);
if (errs.length) console.log('page errors', errs.slice(0, 10));
await b.close();
process.exit(out.fail.length || out.timeout.length ? 1 : 0);
