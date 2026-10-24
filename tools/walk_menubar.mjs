// Walk Softimage File/Edit/View/Display/Window/Help menubar leaves (PE + insertion points).
// Reports wired vs silent (grey / would log "not implemented"). See docs ui-documented-gaps.
// Needs vite preview on :4173 (or UI_SMOKE_URL). Usage: node tools/walk_menubar.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.UI_SMOKE_URL ?? 'http://localhost:4173/?demo';
const CHROME_CANDIDATES = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const b = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
p.on('pageerror', e => pageErrors.push(String(e.message || e)));
await p.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(1200);

const status = await p.evaluate(() => window.__menubarStatus?.() ?? null);
await b.close();

if (!status) {
  console.error('__menubarStatus missing');
  process.exit(1);
}

const wired = status.filter(x => x.wired);
const silent = status.filter(x => !x.wired);
const byTop = {};
for (const it of status) {
  const top = it.path.split(' > ')[0] || '(root)';
  byTop[top] ??= { wired: 0, silent: 0 };
  byTop[top][it.wired ? 'wired' : 'silent']++;
}

const out = {
  leaves: status.length,
  wired: wired.length,
  silent: silent.length,
  byTop,
  silentSample: silent.slice(0, 40).map(x => `${x.path} > ${x.label}`),
  pageErrors: pageErrors.slice(0, 5),
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve('docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'menubar-walk-last.json'), JSON.stringify({ ...out, silentAll: silent.map(x => `${x.path} > ${x.label}`) }, null, 2));
// Inventory harness: always exit 0 unless the hook is missing — silent leaves are documented gaps.
process.exit(pageErrors.length ? 1 : 0);
