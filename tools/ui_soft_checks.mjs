// Soft prefs + keymap inventory (in-tree Softimage data). Needs vite preview :4173.
// Usage: node tools/ui_soft_checks.mjs
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

const EXPECTED_KEYMAPS = ['Softimage Key Map', 'Maya Compatible Key Map', '3ds Max Compatible Key Map', 'SI|3D Key Map'];
const MIN_PREF_PAGES = 10; // Softimage ships many C3DPrefs*; Face Robot filtered

const b = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(1200);

const soft = await p.evaluate(() => window.__softUiChecks?.() ?? null);
await b.close();

const fail = [];
const ok = [];
if (!soft) fail.push('__softUiChecks missing');
else {
  if (soft.keymapsExpectedOk) ok.push(`keymaps: ${EXPECTED_KEYMAPS.join(', ')}`);
  else fail.push(`missing expected keymaps; have ${(soft.keymapStats || []).map(k => k.name).join(', ')}`);
  for (const k of soft.keymapStats || []) {
    if ((k.bindings || 0) < 1) fail.push(`keymap ${k.name} has 0 bindings`);
    else ok.push(`${k.name}: ${k.bindings} bindings / ${k.contexts} contexts`);
  }
  if ((soft.prefsPageCount || 0) >= MIN_PREF_PAGES) ok.push(`prefs pages: ${soft.prefsPageCount}`);
  else fail.push(`prefs pages ${soft.prefsPageCount} < ${MIN_PREF_PAGES}`);
  ok.push(`menubar wired ${soft.menubarWired} / silent ${soft.menubarSilent} (silent = documented gap)`);
}

const out = { ok: ok.length, fail: fail.length, okItems: ok, failItems: fail, soft };
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve('docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'ui-soft-checks-last.json'), JSON.stringify(out, null, 2));
process.exit(fail.length ? 1 : 0);
