// Softimage ICE module shell vs PE MENU 303 dumps (MCP tops / SwitchToolbar / ICE Tree xsivw).
// Dump-backed only. Anchor-to-Delete compounds LOCK. Needs vite preview :4173.
// Usage: node tools/compare_ice_module.mjs
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
  path.resolve(__dirname, '../src/data/si/ice_module_mcp_tops.json'),
  path.resolve(__dirname, '../data/dump/si_ice_module_mcp_tops.json'),
].find(p => fs.existsSync(p));
const chromePath = path.resolve(__dirname, '../src/data/si/ice_view_chrome.json');
if (!topsPath || !fs.existsSync(chromePath)) {
  console.error('missing ICE dump JSON');
  process.exit(2);
}
const tops = JSON.parse(fs.readFileSync(topsPath, 'utf8'));
const chrome = JSON.parse(fs.readFileSync(chromePath, 'utf8'));

const diffs = [];
const notes = [];
notes.push(`loaded tops ${topsPath}`);

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const audit = await page.evaluate(() => window.__uiAudit?.());
if (!audit?.iceModule) diffs.push('__uiAudit.iceModule missing');
else {
  notes.push(`softimage ${audit.iceModule.softimage}`);
  if (!audit.modulesExtracted?.includes('ICE')) diffs.push('ICE not in modulesExtracted');
  else notes.push('ICE in modulesExtracted');
  if (!audit.iceModule.moduleInSelect) diffs.push('ICE missing from module-select');
  else notes.push('ICE in module-select');

  const wantTops = tops.tops;
  const gotTops = audit.iceModule.tops;
  if (JSON.stringify(wantTops) !== JSON.stringify(gotTops)) {
    diffs.push(`ICE tops mismatch want=${wantTops.join('|')} got=${(gotTops || []).join('|')}`);
  } else notes.push(`ICE tops OK: ${wantTops.join(', ')}`);

  for (const [g, btns] of Object.entries(tops.buttons || {})) {
    const got = audit.iceModule.buttons?.[g];
    if (JSON.stringify(btns) !== JSON.stringify(got)) {
      diffs.push(`ICE buttons[${g}] want=${btns.join('|')} got=${(got || []).join('|')}`);
    }
  }
  if (!diffs.some(d => d.startsWith('ICE buttons'))) notes.push('ICE MCP buttons match dump');

  if (audit.iceModule.runtimeAnchors !== 'LOCK') diffs.push('runtime Anchors must stay LOCK');
  else notes.push('Anchor-to-Delete LOCK');

  if (!audit.iceModule.openICETreeView) diffs.push('OpenICETreeView not registered');
  else notes.push('OpenICETreeView wired');

  const wantSz = chrome.views?.['ICE Tree']?.defaultsize;
  const gotSz = audit.iceModule.iceTreeDefaultSize;
  if (JSON.stringify(wantSz) !== JSON.stringify(gotSz)) {
    diffs.push(`ICE Tree defaultsize want=${wantSz} got=${gotSz}`);
  } else notes.push(`ICE Tree xsivw defaultsize ${wantSz?.join(',')}`);
}

// Switch Softimage ICE toolbar (MENU 303) and read live MCP chrome
const live = await page.evaluate(async () => {
  window.__switchModule?.('ICE');
  await new Promise(r => setTimeout(r, 80));
  const groups = [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim());
  const btns = [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim());
  const placeholder = !!document.querySelector('.toolbar-panel .view-placeholder');
  const label = document.querySelector('.module-select')?.value;
  // CrowdFX > Crowd > Anchor-to-Delete must not fire RenderRegion (id 41646 collision)
  const status = window.__menuStatus?.('ICE') ?? [];
  const anchors = status.filter(x => x.label === 'Anchor-to-Delete');
  const crowd = anchors.find(x => x.path.includes('CrowdFX') && x.path.includes('Crowd'));
  return { groups, btns, placeholder, label, anchorCount: anchors.length, crowdCmd: crowd?.cmd ?? null, crowdImpl: crowd?.implemented ?? false };
});

if (live.label !== 'ICE' || live.placeholder) diffs.push(`switch ICE failed label=${live.label} placeholder=${live.placeholder}`);
else notes.push(`live ICE toolbar ${live.btns.length} buttons`);

if (JSON.stringify(live.groups) !== JSON.stringify(tops.tops)) {
  diffs.push(`live groups want=${tops.tops.join('|')} got=${live.groups.join('|')}`);
} else notes.push('live ICE groups match MENU 303 tops');

const flatBtns = Object.values(tops.buttons).flat();
for (const b of flatBtns) {
  if (!live.btns.includes(b)) diffs.push(`live missing button ${b}`);
}
if (!diffs.some(d => d.startsWith('live missing'))) notes.push('live ICE MCP buttons present');

if (live.crowdCmd !== null || live.crowdImpl) {
  diffs.push(`CrowdFX Anchor must not map cmd (got cmd=${live.crowdCmd} impl=${live.crowdImpl})`);
} else notes.push(`Anchor-to-Delete unbound (${live.anchorCount} slots)`);

// SwitchToolbar Target=4
const sw = await page.evaluate(() => {
  window.__switchModule?.('Model');
  window.Application.run('SwitchToolbar', { Target: 4 });
  return { module: window.Application.module, select: document.querySelector('.module-select')?.value };
});
if (sw.module !== 'ICE' || sw.select !== 'ICE') diffs.push(`SwitchToolbar Target=4 → ${sw.module}/${sw.select}`);
else notes.push('SwitchToolbar Target=4 → ICE');

// OpenICETreeView opens floating ICE Tree with xsivw size tokens on host
const tree = await page.evaluate(() => {
  window.Application.run('OpenICETreeView');
  const host = document.querySelector('.rtree.icetree');
  const win = [...document.querySelectorAll('.ppg-float')].find(el => el.querySelector('.ppg-float-title')?.textContent === 'ICE Tree');
  return {
    host: !!host,
    category: host?.dataset.siCategory ?? null,
    defaultsize: host?.dataset.siDefaultsize ?? null,
    float: !!win,
    w: win ? Math.round(win.getBoundingClientRect().width) : 0,
    h: win ? Math.round(win.getBoundingClientRect().height) : 0,
  };
});
if (!tree.host || !tree.float) diffs.push('OpenICETreeView did not open ICE Tree shell');
else notes.push(`ICE Tree shell open ${tree.w}x${tree.h}`);
if (tree.category !== 'ICE') diffs.push(`ICE Tree category=${tree.category}`);
else notes.push('ICE Tree category=ICE');
const wantDs = chrome.views['ICE Tree'].defaultsize.join(',');
if (tree.defaultsize !== wantDs) diffs.push(`host defaultsize ${tree.defaultsize} ≠ ${wantDs}`);
else notes.push(`host dataset defaultsize ${wantDs}`);

await b.close();

const out = {
  ok: diffs.length === 0,
  diffs,
  notes,
  softimage: tops.softimage,
  menu_id: tops.menu_id,
  tops: tops.tops,
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'ice-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
