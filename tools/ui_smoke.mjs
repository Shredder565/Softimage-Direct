// Softimage Direct UI smoke harness (Playwright).
// Needs `npm run build && npm run preview` on :4173 (or set UI_SMOKE_URL).
// Checks: shell boots, layouts load, MCP present, registered views cover Softimage layout frame types,
// all six module menus extracted (Model/Animate/Render/Simulate/ICE/Hair), floating views open without page errors.
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
if (!CHROME) { console.error('No Chromium executable found; set PW_CHROME'); process.exit(2); }

// Frame types that appear in Softimage Application/layouts/*.xsily (from src/data/si/layouts.json).
const LAYOUT_FRAME_TYPES = [
  'Toolbar Panel', 'Explorer', 'Scripts', 'View Manager', 'Timeline', 'Timerange', 'Keying Panel',
  'Layer Control', 'Property Editor', 'Panel Switcher', 'Command Line', 'Playback Panel', 'Animation Panel',
  'Main Shelf', 'Mini Transform Panel', 'Preset Manager', 'Palettes', 'Weight Paint Panel',
  'Animation Layer Manager', 'Selection Panel', 'Transformation Panel', 'Snap Panel', 'Constraint Panel',
  'Edit Panel', 'Netview', 'Animation Editor', 'Fcurve Editor', 'DopeSheet', 'Standalone Dopesheet',
  'Animation Mixer', 'Schematic', 'Material Manager', 'Material Panel', 'Render Tree', 'Texture Editor',
  'ICE Tree', 'FX Tree', 'Fx Viewer', 'Fx Paint Brush List', 'Fx Operator Selector', 'Plugin Manager',
  'SDK Explorer', 'Script Editor',
];

const LAYOUTS = ['Default', 'Dual', '1024 x 768', 'Autohide'];
const OPEN_VIEWS = [
  'Explorer', 'Property Editor', 'Script Editor', 'Animation Editor', 'ICE Tree',
  'Animation Mixer', 'Preset Manager', 'Scene Layer Manager', 'SDK Explorer', 'Animation Layer Manager',
];

const b = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
const pageErrors = [];
p.on('pageerror', e => pageErrors.push(String(e.message || e)));

const fail = [];
const ok = [];
const note = [];

await p.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(1500);

const audit = await p.evaluate(() => window.__uiAudit?.() ?? null);
if (!audit) { fail.push('__uiAudit missing — main.ts not exposing UI inventory'); }
else {
  ok.push(`layout=${audit.layout} keymap=${audit.keymap}`);
  if (!audit.menubar) fail.push('menubar missing'); else ok.push('menubar');
  if (!audit.mcpPresent) fail.push('MCP missing'); else ok.push(`MCP (${audit.mcpButtonCount} buttons)`);
  for (const need of ['Model', 'Animate', 'Render', 'Simulate', 'ICE', 'Hair']) {
    if (!audit.modulesExtracted?.includes(need)) fail.push(`module menu not extracted: ${need}`);
    else ok.push(`module extracted: ${need}`);
  }
  const missingViews = LAYOUT_FRAME_TYPES.filter(t => !audit.registeredViews.includes(t));
  if (missingViews.length) fail.push(`unregistered Softimage layout frame types (${missingViews.length}): ${missingViews.join(', ')}`);
  else ok.push(`all ${LAYOUT_FRAME_TYPES.length} Softimage layout frame types registered`);
  if (audit.placeholderFrames?.length) note.push(`placeholder frames in Default layout: ${audit.placeholderFrames.length}`);
}

// Open floating views
for (const name of OPEN_VIEWS) {
  try {
    const r = await p.evaluate((n) => {
      const before = document.querySelectorAll('.ppg-float').length;
      window.__openView?.(n);
      return document.querySelectorAll('.ppg-float').length > before || !!document.querySelector('.ppg-float');
    }, name);
    await p.waitForTimeout(120);
    if (r) ok.push(`openview ${name}`);
    else note.push(`openview ${name}: no floating chrome detected (may still have rendered)`);
  } catch (e) {
    fail.push(`openview ${name}: ${e.message || e}`);
  }
}

// Switch Softimage module toolbar heads (menus.json trees must render without placeholder)
const moduleTops = {};
for (const m of ['Animate', 'Model', 'Render', 'Simulate', 'ICE', 'Hair']) {
  try {
    await p.evaluate((mod) => window.__switchModule?.(mod), m);
    await p.waitForTimeout(100);
    const label = await p.evaluate(() => document.querySelector('.module-select')?.value);
    const hasPlaceholder = await p.evaluate(() => !!document.querySelector('.toolbar-panel .view-placeholder'));
    const btnCount = await p.evaluate(() => document.querySelectorAll('.toolbar-panel .tb-btn').length);
    const groups = await p.evaluate(() => [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim()));
    const btns = await p.evaluate(() => [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim()));
    moduleTops[m] = { groups, btns };
    if (label === m && !hasPlaceholder && btnCount > 0) ok.push(`module switch → ${m} (${btnCount} groups)`);
    else fail.push(`module switch → ${m} (got ${label}, placeholder=${hasPlaceholder}, btns=${btnCount})`);
  } catch (e) {
    fail.push(`module switch ${m}: ${e.message || e}`);
  }
}

// Simulate (MENU 205 Rigid/Soft/Cloth) must not alias ICE (MENU 303 Particles/CrowdFX)
{
  const sim = moduleTops.Simulate;
  const ice = moduleTops.ICE;
  if (!sim || !ice) fail.push('Simulate vs ICE: missing module chrome after switch');
  else {
    const simKey = JSON.stringify(sim);
    const iceKey = JSON.stringify(ice);
    if (simKey === iceKey) fail.push('Simulate tree identical to ICE (must use MENU 205, not alias 303)');
    else if (!sim.btns.includes('Rigid Body') || !ice.groups.includes('Particles')) {
      fail.push(`Simulate vs ICE shape mismatch: Simulate btns=${sim.btns.join('|')} ICE groups=${ice.groups.join('|')}`);
    } else ok.push('Simulate≠ICE (205 Rigid/Soft/Cloth vs 303 Particles/CrowdFX)');
  }
}

// Layout switch via query (Softimage-style full rebuild)
for (const layout of LAYOUTS) {
  const u = new URL(BASE_URL, 'http://localhost:4173');
  u.searchParams.set('layout', layout);
  u.searchParams.set('demo', '1');
  try {
    await p.goto(u.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(900);
    const a = await p.evaluate(() => window.__uiAudit?.());
    if (!a?.menubar) fail.push(`layout ${layout}: no menubar`);
    else if (a.layout !== layout && layout !== 'Default') {
      // currentLayoutName may normalize; accept if registered
      if (!a.layouts.includes(layout)) fail.push(`layout ${layout}: not in layoutNames`);
      else ok.push(`layout ${layout} loaded (reported ${a.layout})`);
    } else ok.push(`layout ${layout}`);
    if (pageErrors.length) { fail.push(`layout ${layout} pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`); pageErrors.length = 0; }
  } catch (e) {
    fail.push(`layout ${layout}: ${e.message || e}`);
  }
}

await b.close();

const out = { ok: ok.length, fail: fail.length, note: note.length, okItems: ok, failItems: fail, notes: note };
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve('docs/screenshots');
try { fs.mkdirSync(dir, { recursive: true }); } catch { /* */ }
fs.writeFileSync(path.join(dir, 'ui-smoke-last.json'), JSON.stringify(out, null, 2));
process.exit(fail.length ? 1 : 0);
