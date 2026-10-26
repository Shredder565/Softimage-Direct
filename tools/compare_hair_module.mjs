// Softimage Hair module shell vs PE MENU 297 dumps (MCP tops / SwitchToolbar Target=6 / ApplyHair* / Hair Panel xsivw).
// Dump-backed only. Hair Panel client GDI LOCK — shell from hairpanel.xsivw. Needs vite preview :4173.
// Usage: node tools/compare_hair_module.mjs
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

const topsPath = [
  path.resolve(__dirname, '../src/data/si/hair_module_mcp_tops.json'),
  path.resolve(__dirname, '../data/dump/si_hair_module_mcp_tops.json'),
].find(p => fs.existsSync(p));
if (!topsPath) {
  console.error('missing Hair dump JSON');
  process.exit(2);
}
const tops = JSON.parse(fs.readFileSync(topsPath, 'utf8'));

const chromePath = [
  path.resolve(__dirname, '../src/data/si/hair_view_chrome.json'),
  path.resolve(__dirname, '../data/dump/si_hair_view_chrome.json'),
].find(p => fs.existsSync(p));
if (!chromePath) {
  console.error('missing Hair Panel view chrome JSON');
  process.exit(2);
}
const chrome = JSON.parse(fs.readFileSync(chromePath, 'utf8'));

const diffs = [];
const notes = [];
notes.push(`loaded tops ${topsPath}`);
notes.push(`loaded chrome ${chromePath}`);

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const audit = await page.evaluate(() => window.__uiAudit?.());
if (!audit?.hairModule) diffs.push('__uiAudit.hairModule missing');
else {
  notes.push(`softimage ${audit.hairModule.softimage}`);
  if (!audit.modulesExtracted?.includes('Hair')) diffs.push('Hair not in modulesExtracted');
  else notes.push('Hair in modulesExtracted');
  if (!audit.hairModule.moduleInSelect) diffs.push('Hair missing from module-select');
  else notes.push('Hair in module-select');

  const wantTops = tops.tops;
  const gotTops = audit.hairModule.tops;
  if (JSON.stringify(wantTops) !== JSON.stringify(gotTops)) {
    diffs.push(`Hair tops mismatch want=${wantTops.join('|')} got=${(gotTops || []).join('|')}`);
  } else notes.push(`Hair tops OK: ${wantTops.join(', ')}`);

  for (const [g, btns] of Object.entries(tops.buttons || {})) {
    const got = audit.hairModule.buttons?.[g];
    if (JSON.stringify(btns) !== JSON.stringify(got)) {
      diffs.push(`Hair buttons[${g}] want=${btns.join('|')} got=${(got || []).join('|')}`);
    }
  }
  if (!diffs.some(d => d.startsWith('Hair buttons'))) notes.push('Hair MCP buttons match dump');

  // Softimage-absent float HWND (hair-panel-hwnd dump): xsivw + SwitchToolbar(7) MATCH; no invent float chrome.
  if (audit.hairModule.hairPanel !== 'MATCH') diffs.push(`Hair Panel status want=MATCH got=${audit.hairModule.hairPanel}`);
  else notes.push('Hair Panel xsivw MATCH (Softimage-absent float)');

  if (audit.hairModule.hairPanelClientGdi !== 'SOFTIMAGE_ABSENT_FLOAT') {
    diffs.push(`Hair Panel client GDI want=SOFTIMAGE_ABSENT_FLOAT got=${audit.hairModule.hairPanelClientGdi}`);
  } else notes.push('Hair Panel float HWND Softimage-absent');

  if (audit.hairModule.flyoutPixels !== 'LOCK') diffs.push('flyout pixels must stay LOCK');
  else notes.push('flyout pixels LOCK');

  const wantSz = chrome.views?.['Hair Panel']?.defaultsize;
  const gotSz = audit.hairModule.hairPanelDefaultSize;
  if (JSON.stringify(wantSz) !== JSON.stringify(gotSz)) {
    diffs.push(`Hair Panel defaultsize want=${wantSz} got=${gotSz}`);
  } else notes.push(`Hair Panel xsivw defaultsize ${wantSz?.join(',')}`);

  const wantOps = tops.apply_hair_ops?.length ?? 0;
  const gotOps = audit.hairModule.applyHairOpsCount ?? 0;
  if (gotOps < wantOps) diffs.push(`ApplyHair* wired ${gotOps}/${wantOps}`);
  else notes.push(`ApplyHair* ops wired ${gotOps}/${wantOps}`);

  if (!audit.hairModule.switchToolbar) diffs.push('SwitchToolbar not registered');
  else notes.push('SwitchToolbar present');
}

// Switch Softimage Hair toolbar (MENU 297) and read live MCP chrome
const live = await page.evaluate(async () => {
  window.__switchModule?.('Hair');
  await new Promise(r => setTimeout(r, 80));
  const groups = [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim());
  const btns = [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim());
  const placeholder = !!document.querySelector('.toolbar-panel .view-placeholder');
  const label = document.querySelector('.module-select')?.value;
  // FROST must remain a separate module option
  const mods = [...document.querySelectorAll('.module-select option')].map(o => o.value);
  return { groups, btns, placeholder, label, mods, frost: mods.includes('FROST') };
});

if (live.label !== 'Hair' || live.placeholder) diffs.push(`switch Hair failed label=${live.label} placeholder=${live.placeholder}`);
else notes.push(`live Hair toolbar ${live.btns.length} buttons`);

if (JSON.stringify(live.groups) !== JSON.stringify(tops.tops)) {
  diffs.push(`live groups want=${tops.tops.join('|')} got=${live.groups.join('|')}`);
} else notes.push('live Hair groups match MENU 297 tops');

const flatBtns = Object.values(tops.buttons).flat();
for (const b of flatBtns) {
  if (!live.btns.includes(b)) diffs.push(`live missing button ${b}`);
}
if (!diffs.some(d => d.startsWith('live missing'))) notes.push('live Hair MCP buttons present');

if (!live.frost) diffs.push('FROST module missing (must stay parallel)');
else notes.push('FROST module still present');

// SwitchToolbar Target=6 → Hair
const sw = await page.evaluate(() => {
  window.__switchModule?.('Model');
  window.Application.run('SwitchToolbar', { Target: 6 });
  return { module: window.Application.module, select: document.querySelector('.module-select')?.value };
});
if (sw.module !== 'Hair' || sw.select !== 'Hair') diffs.push(`SwitchToolbar Target=6 → ${sw.module}/${sw.select}`);
else notes.push('SwitchToolbar Target=6 → Hair');

// ApplyHairOp smoke (selection → hair property)
const smoke = await page.evaluate(() => window.__hairApplySmoke?.());
if (!smoke?.ok) diffs.push(`ApplyHairOp smoke failed: ${smoke?.err || 'no result'}`);
else notes.push(`ApplyHairOp smoke OK (${smoke.name})`);

// Softimage OpenView("Hair Panel") — xsivw shell with dump size tokens (no invent client widgets)
const panel = await page.evaluate(() => {
  window.__openView?.('Hair Panel');
  const host = document.querySelector('.hair-panel');
  const win = [...document.querySelectorAll('.ppg-float')].find(el => el.querySelector('.ppg-float-title')?.textContent === 'Hair Panel');
  const inventWidgets = !!(host && (
    host.querySelector('.hair-panel-tool') ||
    host.querySelector('[data-invent]') ||
    [...host.querySelectorAll('button')].some(b => !b.closest('.ppg-float-titlebar'))
  ));
  return {
    host: !!host,
    category: host?.dataset.siCategory ?? null,
    defaultsize: host?.dataset.siDefaultsize ?? null,
    clsid: host?.dataset.siClsid ?? null,
    status: host?.dataset.siStatus ?? null,
    clientGdi: host?.dataset.siClientGdi ?? null,
    float: !!win,
    w: win ? Math.round(win.getBoundingClientRect().width) : 0,
    h: win ? Math.round(win.getBoundingClientRect().height) : 0,
    inventWidgets,
  };
});
if (!panel.host || !panel.float) diffs.push('OpenView Hair Panel did not open xsivw shell');
else notes.push(`Hair Panel shell open ${panel.w}x${panel.h}`);
if (panel.category !== 'General') diffs.push(`Hair Panel category=${panel.category}`);
else notes.push('Hair Panel category=General');
const wantDs = chrome.views['Hair Panel'].defaultsize.join(',');
if (panel.defaultsize !== wantDs) diffs.push(`host defaultsize ${panel.defaultsize} ≠ ${wantDs}`);
else notes.push(`host dataset defaultsize ${wantDs}`);
if (panel.clsid !== chrome.views['Hair Panel'].clsid) diffs.push(`clsid ${panel.clsid}`);
else notes.push('Hair Panel clsid matches xsivw');
if (panel.status !== 'SHELL') diffs.push(`host status=${panel.status}`);
if (panel.clientGdi !== 'LOCK') diffs.push(`host clientGdi=${panel.clientGdi}`);
if (panel.inventWidgets) diffs.push('Hair Panel invented client widgets — must stay LOCK');
else notes.push('no invented Hair Panel client widgets');
// Softimage defaultsize height is 115 — float should be thin (allow titlebar chrome)
if (panel.h > 200) diffs.push(`Hair Panel float height ${panel.h} too tall for xsivw 115 (+ chrome)`);
else notes.push(`Hair Panel float height ${panel.h} within thin panel budget`);

await b.close();

const out = {
  ok: diffs.length === 0,
  diffs,
  notes,
  softimage: tops.softimage,
  menu_id: tops.menu_id,
  tops: tops.tops,
  hair_panel: tops.hair_panel,
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'hair-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
