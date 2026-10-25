// Softimage Simulate module shell vs PE MENU 205 dumps (MCP tops / SwitchToolbar / prefs.simulation).
// Cloth PPG: C3DClothProp/C3DClothOp SPDL chrome. Flyout pixels + Syflex client GDI LOCK. FROST untouched.
// Needs vite preview :4173. Usage: node tools/compare_simulate_module.mjs
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
  path.resolve(__dirname, '../src/data/si/simulate_module_mcp_tops.json'),
  path.resolve(__dirname, '../data/dump/si_simulate_module_mcp_tops.json'),
].find(p => fs.existsSync(p));
if (!topsPath) {
  console.error('missing Simulate dump JSON');
  process.exit(2);
}
const tops = JSON.parse(fs.readFileSync(topsPath, 'utf8'));

const clothChromePath = [
  path.resolve(__dirname, '../src/data/si/cloth_ppg_chrome.json'),
  path.resolve(__dirname, '../data/dump/si_cloth_ppg_chrome.json'),
].find(p => fs.existsSync(p));
const viewChromePath = [
  path.resolve(__dirname, '../src/data/si/simulate_view_chrome.json'),
  path.resolve(__dirname, '../data/dump/si_simulate_view_chrome.json'),
].find(p => fs.existsSync(p));
if (!clothChromePath) { console.error('missing cloth_ppg_chrome.json'); process.exit(2); }
if (!viewChromePath) { console.error('missing simulate_view_chrome.json'); process.exit(2); }
const clothChrome = JSON.parse(fs.readFileSync(clothChromePath, 'utf8'));
const viewChrome = JSON.parse(fs.readFileSync(viewChromePath, 'utf8'));

const diffs = [];
const notes = [];
notes.push(`loaded tops ${topsPath}`);

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const audit = await page.evaluate(() => window.__uiAudit?.());
if (!audit?.simulateModule) diffs.push('__uiAudit.simulateModule missing');
else {
  notes.push(`softimage ${audit.simulateModule.softimage}`);
  if (!audit.modulesExtracted?.includes('Simulate')) diffs.push('Simulate not in modulesExtracted');
  else notes.push('Simulate in modulesExtracted');
  if (!audit.simulateModule.moduleInSelect) diffs.push('Simulate missing from module-select');
  else notes.push('Simulate in module-select');

  const wantTops = tops.tops;
  const gotTops = audit.simulateModule.tops;
  if (JSON.stringify(wantTops) !== JSON.stringify(gotTops)) {
    diffs.push(`Simulate tops mismatch want=${wantTops.join('|')} got=${(gotTops || []).join('|')}`);
  } else notes.push(`Simulate tops OK: ${wantTops.join(', ')}`);

  for (const [g, btns] of Object.entries(tops.buttons || {})) {
    const got = audit.simulateModule.buttons?.[g];
    if (JSON.stringify(btns) !== JSON.stringify(got)) {
      diffs.push(`Simulate buttons[${g}] want=${btns.join('|')} got=${(got || []).join('|')}`);
    }
  }
  if (!diffs.some(d => d.startsWith('Simulate buttons'))) notes.push('Simulate MCP buttons match dump');

  if (audit.simulateModule.flyoutPixels !== 'LOCK') diffs.push('flyout pixels must stay LOCK');
  else notes.push('flyout pixels LOCK');
  if (audit.simulateModule.syflexClientGdi !== 'LOCK') diffs.push('Syflex client GDI must stay LOCK');
  else notes.push('Syflex client GDI LOCK');

  if (audit.simulateModule.clothPpg !== 'SPDL') diffs.push(`cloth PPG status want=SPDL got=${audit.simulateModule.clothPpg}`);
  else notes.push('cloth PPG SPDL');
  const wantPropTabs = (clothChrome.propsets?.C3DClothProp?.layout || []).map(t => t.tab).filter(Boolean);
  const gotPropTabs = audit.simulateModule.clothPpgAudit?.clothPropTabs || [];
  if (JSON.stringify(wantPropTabs) !== JSON.stringify(gotPropTabs)) {
    diffs.push(`cloth prop tabs want=${wantPropTabs.join('|')} got=${gotPropTabs.join('|')}`);
  } else notes.push(`C3DClothProp tabs ${wantPropTabs.join(', ')}`);
  const wantOpTabs = (clothChrome.propsets?.C3DClothOp?.layout || []).map(t => t.tab).filter(Boolean);
  const gotOpTabs = audit.simulateModule.clothPpgAudit?.clothOpTabs || [];
  if (JSON.stringify(wantOpTabs) !== JSON.stringify(gotOpTabs)) {
    diffs.push(`cloth op tabs want=${wantOpTabs.join('|')} got=${gotOpTabs.join('|')}`);
  } else notes.push(`C3DClothOp tabs ${wantOpTabs.join(', ')}`);
  const wantMass = clothChrome.propsets?.C3DClothProp?.params?.find(p => p.sn === 'Mass');
  if (wantMass && !audit.simulateModule.clothPpgAudit?.clothPropParamSns?.includes('Mass')) {
    diffs.push('cloth prop missing Mass sn');
  } else notes.push('C3DClothProp Mass attested');
  const peSz = viewChrome.property_editor?.defaultsize;
  const gotPe = audit.simulateModule.simulateViewChrome?.propertyEditorDefaultsize;
  if (peSz && JSON.stringify(peSz) !== JSON.stringify(gotPe)) {
    diffs.push(`PE defaultsize want=${peSz} got=${gotPe}`);
  } else notes.push(`Property Editor defaultsize ${gotPe?.join?.(',') ?? gotPe}`);

  if (!audit.simulateModule.syCreateCloth) diffs.push('SyCreateCloth not registered');
  else notes.push('SyCreateCloth wired');
  if (!audit.simulateModule.applyCloth) diffs.push('ApplyCloth not registered');
  else notes.push('ApplyCloth wired');
  if (!audit.simulateModule.createActiveRigidBody) diffs.push('CreateActiveRigidBody not registered');
  else notes.push('CreateActiveRigidBody wired');
  if (!audit.simulateModule.applySoftBody) diffs.push('ApplySoftBody not registered');
  else notes.push('ApplySoftBody wired');

  const wantCache = tops.preferences?.simulation?.params?.cachefiletypestring;
  const liveCache = audit.simulateModule.prefsLive?.cachefiletypestring
    ?? audit.simulateModule.simulationPrefs?.cachefiletypestring;
  if (wantCache != null && liveCache !== wantCache) {
    diffs.push(`prefs cachefiletypestring want=${wantCache} got=${liveCache}`);
  } else notes.push(`preferences.simulation cachefiletypestring=${liveCache}`);

  const wantRbd = tops.preferences?.simulation?.params?.rbdengine;
  const liveRbd = audit.simulateModule.prefsLive?.rbdengine
    ?? audit.simulateModule.simulationPrefs?.rbdengine;
  if (wantRbd != null && Number(liveRbd) !== Number(wantRbd)) {
    diffs.push(`prefs rbdengine want=${wantRbd} got=${liveRbd}`);
  } else notes.push(`preferences.simulation rbdengine=${liveRbd}`);

  if (!audit.simulateModule.frostUntouched) diffs.push('FROST must remain untouched');
  else notes.push('FROST cloth stays');
}

// Switch Softimage Simulate toolbar (MENU 205) and read live MCP chrome
const live = await page.evaluate(async () => {
  window.__switchModule?.('Simulate');
  await new Promise(r => setTimeout(r, 80));
  const groups = [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim());
  const btns = [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim());
  const placeholder = !!document.querySelector('.toolbar-panel .view-placeholder');
  const label = document.querySelector('.module-select')?.value;
  return { groups, btns, placeholder, label };
});

if (live.label !== 'Simulate' || live.placeholder) {
  diffs.push(`switch Simulate failed label=${live.label} placeholder=${live.placeholder}`);
} else notes.push(`live Simulate toolbar ${live.btns.length} buttons`);

if (JSON.stringify(live.groups) !== JSON.stringify(tops.tops)) {
  diffs.push(`live groups want=${tops.tops.join('|')} got=${live.groups.join('|')}`);
} else notes.push('live Simulate groups match MENU 205 tops');

const flatBtns = Object.values(tops.buttons).flat();
for (const b of flatBtns) {
  if (!live.btns.includes(b)) diffs.push(`live missing button ${b}`);
}
if (!diffs.some(d => d.startsWith('live missing'))) notes.push('live Simulate MCP buttons present');

// Must not alias ICE (MENU 303 Particles/CrowdFX)
const vsIce = await page.evaluate(async () => {
  window.__switchModule?.('ICE');
  await new Promise(r => setTimeout(r, 40));
  const iceGroups = [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim());
  const iceBtns = [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim());
  window.__switchModule?.('Simulate');
  await new Promise(r => setTimeout(r, 40));
  const simGroups = [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim());
  const simBtns = [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim());
  return { iceGroups, iceBtns, simGroups, simBtns };
});
if (JSON.stringify(vsIce.simGroups) === JSON.stringify(vsIce.iceGroups)) {
  diffs.push('Simulate tree identical to ICE (must use MENU 205, not alias 303)');
} else if (!vsIce.simBtns.includes('Rigid Body') || !vsIce.iceGroups.includes('Particles')) {
  diffs.push(`Simulate vs ICE shape mismatch sim=${vsIce.simBtns.join('|')} ice=${vsIce.iceGroups.join('|')}`);
} else notes.push('Simulate≠ICE (205 Rigid/Soft/Cloth vs 303 Particles/CrowdFX)');

// SwitchToolbar Target=5
const sw = await page.evaluate(() => {
  window.__switchModule?.('Model');
  window.Application.run('SwitchToolbar', { Target: 5 });
  return { module: window.Application.module, select: document.querySelector('.module-select')?.value };
});
if (sw.module !== 'Simulate' || sw.select !== 'Simulate') {
  diffs.push(`SwitchToolbar Target=5 → ${sw.module}/${sw.select}`);
} else notes.push('SwitchToolbar Target=5 → Simulate');

// SyCreateCloth → ApplyCloth: C3DClothProp params + C3DClothOp stack chrome (no Syflex GDI)
const cloth = await page.evaluate(() => {
  window.Application.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface' });
  const grid = window.Application.selectedObjects?.[0];
  window.Application.run('SyCreateCloth', {});
  const sel = window.Application.selection || [];
  const clothProp = [...sel].find?.(x => x?.type === 'cloth')
    || grid?.properties?.find?.(p => p.type === 'cloth')
    || window.Application.selectedObjects?.[0]?.properties?.find?.(p => p.type === 'cloth');
  const host = clothProp?.parent || grid || window.Application.selectedObjects?.[0];
  const clothOp = host?.primitive?.operators?.find?.(op => op.type === 'clothop');
  const propSns = (clothProp?.params || []).map(p => p.name);
  const opSns = (clothOp?.params || []).map(p => p.name);
  const propTabs = (clothProp?.layout || []).map(t => t.tab).filter(Boolean);
  const opTabs = (clothOp?.layout || []).map(t => t.tab).filter(Boolean);
  return {
    hasSy: window.Application.commands.has('SyCreateCloth'),
    hasApply: window.Application.commands.has('ApplyCloth'),
    clothProp: !!clothProp,
    clothOp: !!clothOp,
    propSns,
    opSns,
    propTabs,
    opTabs,
    hasMass: propSns.includes('Mass'),
    hasShear: propSns.includes('Shear'),
    hasSimMute: opSns.includes('SimMute'),
  };
});
if (!cloth.hasSy || !cloth.hasApply) diffs.push(`cloth cmds Sy=${cloth.hasSy} Apply=${cloth.hasApply}`);
else notes.push('SyCreateCloth + ApplyCloth present');
if (!cloth.clothProp) diffs.push('SyCreateCloth did not create cloth property');
else notes.push('SyCreateCloth → C3DClothProp via ApplyCloth');
if (!cloth.clothOp) diffs.push('ApplyCloth missing clothop stack chrome');
else notes.push('ApplyCloth → C3DClothOp on stack');
if (!cloth.hasMass || !cloth.hasShear) diffs.push(`cloth prop sns Mass=${cloth.hasMass} Shear=${cloth.hasShear}`);
else notes.push('cloth prop Mass/Shear dump sns');
if (!cloth.hasSimMute) diffs.push('cloth op missing SimMute');
else notes.push('cloth op SimMute dump sn');
const wantPropTabsLive = (clothChrome.propsets?.C3DClothProp?.layout || []).map(t => t.tab).filter(Boolean);
if (JSON.stringify(cloth.propTabs) !== JSON.stringify(wantPropTabsLive)) {
  diffs.push(`live cloth prop tabs want=${wantPropTabsLive.join('|')} got=${(cloth.propTabs || []).join('|')}`);
} else notes.push('live C3DClothProp layout tabs');
const wantOpTabsLive = (clothChrome.propsets?.C3DClothOp?.layout || []).map(t => t.tab).filter(Boolean);
if (JSON.stringify(cloth.opTabs) !== JSON.stringify(wantOpTabsLive)) {
  diffs.push(`live cloth op tabs want=${wantOpTabsLive.join('|')} got=${(cloth.opTabs || []).join('|')}`);
} else notes.push('live C3DClothOp layout tabs');

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
fs.writeFileSync(path.join(dir, 'simulate-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
