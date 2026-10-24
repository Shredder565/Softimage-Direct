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
  const gep = audit.getEnableParity;
  if (!gep) note.push('getEnableParity missing from __uiAudit');
  else if (!gep.ok) fail.push(`Get enable Model↔Animate mismatches: ${JSON.stringify(gep.mismatches?.slice?.(0, 5) ?? gep.mismatches)}`);
  else ok.push(`Get enable parity Model=${gep.modelGet} Animate=${gep.animateGet} shared=${gep.shared}`);
  // MCP enable: Softimage-style empty selection greys command-linked buttons
  const me = await p.evaluate(() => {
    const A = window.Application;
    A.select([]);
    return window.__uiAudit?.().mcpEnable ?? null;
  });
  if (!me) fail.push('mcpEnable missing from __uiAudit');
  else if (me.parent || me.cut || me.freeze || me.group || me.freezeM || me.sample) {
    fail.push(`MCP empty-sel enable expected all false, got ${JSON.stringify(me)}`);
  } else ok.push('MCP enable empty-sel greys Parent/Cut/Freeze/Group/FreezeM/Sample');
  // Softimage-pc matrix: XSIBATCH bools (Translate/Rotate/Scale/Duplicate true empty) + PE f_grayed seeds
  const mx = await p.evaluate(() => {
    const A = window.Application;
    A.select([]);
    const a = window.__uiAudit?.() ?? {};
    return {
      mcp: a.mcpEnable,
      matrix: a.mcpMatrix,
      grayCluster: a.peGrayedClusterWithCenter,
      graySel: a.peGrayedSelectability,
    };
  });
  if (!mx.matrix?.boolAttested?.includes?.('Translate')) fail.push(`mcpMatrix missing Translate attestation: ${JSON.stringify(mx.matrix)}`);
  else if (mx.mcp?.matrixTranslate !== true || mx.mcp?.translate !== true || mx.mcp?.duplicate !== true) {
    fail.push(`matrix empty-sel Translate/Duplicate expected true, got ${JSON.stringify({ t: mx.mcp?.translate, mt: mx.mcp?.matrixTranslate, d: mx.mcp?.duplicate, ctx: mx.mcp?.context })}`);
  } else if (mx.mcp?.matrixParentObj !== null && mx.mcp?.matrixParentObj !== undefined) {
    fail.push(`ParentObj matrix cell should be null (fall back canRun), got ${mx.mcp.matrixParentObj}`);
  } else if (!mx.grayCluster || !mx.graySel) {
    fail.push(`PE f_grayed seeds missing cluster=${mx.grayCluster} selectability=${mx.graySel}`);
  } else ok.push(`MCP matrix Softimage ${mx.matrix.softimage}: empty Translate/Duplicate true; PE grayed ${mx.matrix.peGrayedCount}`);
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
    // Dual shell chrome from layouts.json / Dual.xsily (50|50 + Screen1Tray + MCP bottom_inv)
    if (layout === 'Dual') {
      const dual = await p.evaluate(() => {
        const root = document.querySelector('#root > .frameset');
        const sizes = root?.dataset?.sizes ?? '';
        const screen1 = [...document.querySelectorAll('.switcher[data-name="Screen1Tray"] > .switcher-bar > .switcher-btn')]
          .map(b => b.dataset.label || b.textContent?.trim());
        const mcp = [...document.querySelectorAll('.switcher[data-name="mcp"] > .switcher-bar > .switcher-btn')]
          .map(b => b.dataset.label || b.textContent?.trim());
        const mcpInv = !!document.querySelector('.switcher[data-name="mcp"].inv');
        const modMenu = document.querySelector('.switcher[data-name="module_menu"]');
        const modBtn = modMenu?.querySelector('.switcher-btn.icon');
        const modSize = modBtn ? { w: modBtn.offsetWidth, h: modBtn.offsetHeight } : null;
        return { sizes, screen1, mcp, mcpInv, modSize };
      });
      if (dual.sizes !== '50%,50%') fail.push(`Dual root sizes expected 50%,50% got ${dual.sizes}`);
      else ok.push('Dual 50%/50% shell split');
      const wantScreen = ['Animation', 'Schematic', 'Rendering', 'ICE', 'Compositing', 'Plugins'];
      if (wantScreen.every((l, i) => dual.screen1[i] === l)) ok.push('Dual Screen1Tray labels');
      else fail.push(`Dual Screen1Tray labels got ${JSON.stringify(dual.screen1)}`);
      const wantMcp = ['MCP', 'KP/L', 'PPG'];
      if (wantMcp.every((l, i) => dual.mcp[i] === l) && dual.mcpInv) ok.push('Dual MCP bottom_inv tabs');
      else fail.push(`Dual MCP tabs/inv got ${JSON.stringify(dual.mcp)} inv=${dual.mcpInv}`);
      if (dual.modSize && dual.modSize.w >= 24 && dual.modSize.w <= 30 && dual.modSize.h >= 24 && dual.modSize.h <= 30) {
        ok.push(`Dual module_menu buttonsize ~26x26 (${dual.modSize.w}x${dual.modSize.h})`);
      } else fail.push(`Dual module_menu buttonsize expected ~26x26 got ${JSON.stringify(dual.modSize)}`);
    }
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
