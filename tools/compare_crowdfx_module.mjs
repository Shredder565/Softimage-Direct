// Softimage CrowdFX under ICE vs Desktop dumps (MCP Actors/Crowd/Simulation + ICEOperators icecrowdfx*).
// Dump-backed only. Anchor-to-Delete compounds LOCK. Needs vite preview :4173.
// Usage: node tools/compare_crowdfx_module.mjs
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

const modPath = [
  path.resolve(__dirname, '../src/data/si/crowdfx_module.json'),
  path.resolve(__dirname, '../data/dump/si_crowdfx_module.json'),
].find(p => fs.existsSync(p));
const prefsPath = [
  path.resolve(__dirname, '../src/data/si/crowdfx_prefs.json'),
  path.resolve(__dirname, '../data/dump/si_crowdfx_prefs.json'),
].find(p => fs.existsSync(p));
if (!modPath || !prefsPath) {
  console.error('missing CrowdFX dump JSON');
  process.exit(2);
}
const mod = JSON.parse(fs.readFileSync(modPath, 'utf8'));
const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));

const diffs = [];
const notes = [];
notes.push(`loaded module ${modPath}`);
notes.push(`loaded prefs ${prefsPath}`);

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const audit = await page.evaluate(() => window.__uiAudit?.());
if (!audit?.crowdFxModule) diffs.push('__uiAudit.crowdFxModule missing');
else {
  notes.push(`softimage ${audit.crowdFxModule.softimage}`);
  if (!audit.modulesExtracted?.includes('ICE')) diffs.push('ICE not in modulesExtracted (CrowdFX host)');
  else notes.push('ICE host module present');

  if (audit.crowdFxModule.mcpTop !== mod.mcp_top) {
    diffs.push(`mcpTop want=${mod.mcp_top} got=${audit.crowdFxModule.mcpTop}`);
  } else notes.push(`MCP top ${mod.mcp_top}`);

  if (JSON.stringify(audit.crowdFxModule.buttons) !== JSON.stringify(mod.buttons)) {
    diffs.push(`buttons want=${mod.buttons.join('|')} got=${(audit.crowdFxModule.buttons || []).join('|')}`);
  } else notes.push(`buttons OK: ${mod.buttons.join(', ')}`);

  for (const [k, id] of Object.entries(mod.pe_menu_ids || {})) {
    if (audit.crowdFxModule.peMenuIds?.[k] !== id) {
      diffs.push(`peMenuIds[${k}] want=${id} got=${audit.crowdFxModule.peMenuIds?.[k]}`);
    }
  }
  if (!diffs.some(d => d.startsWith('peMenuIds'))) notes.push(`PE ids Actors=${mod.pe_menu_ids.Actors} Crowd=${mod.pe_menu_ids.Crowd} Simulation=${mod.pe_menu_ids.Simulation}`);

  if (audit.crowdFxModule.runtimeAnchors !== 'LOCK') diffs.push('runtime Anchors must stay LOCK');
  else notes.push('Anchor-to-Delete LOCK');

  if (!audit.crowdFxModule.createCrowd) diffs.push('CreateCrowd not registered');
  else notes.push('CreateCrowd wired');

  const wantSn = (mod.commands || []).map(c => c.scriptingname);
  const wired = audit.crowdFxModule.commandsWired || [];
  const missing = wantSn.filter(sn => !wired.includes(sn));
  if (missing.length) diffs.push(`commands missing: ${missing.join(',')}`);
  else notes.push(`CrowdFX commands wired ${wired.length}/${wantSn.length}`);

  if (!audit.crowdFxModule.crowdFxPathKeysPresent) diffs.push('ICEOperators icecrowdfx* path keys missing on app');
  else notes.push(`icecrowdfx path keys: ${(audit.crowdFxModule.crowdFxPathKeys || []).join(',')}`);

  const iceOpsDump = prefs.categories?.['preferences.ICEOperators'] || {};
  for (const k of prefs.crowdfx_path_keys || []) {
    if (!(k in (audit.crowdFxModule.iceOperatorsPrefs || {}))) diffs.push(`iceOperatorsPrefs missing ${k}`);
    else if (audit.crowdFxModule.iceOperatorsPrefs[k] !== iceOpsDump[k]) {
      diffs.push(`iceOperatorsPrefs.${k} value mismatch`);
    }
  }
  if (!diffs.some(d => d.startsWith('iceOperatorsPrefs'))) notes.push('ICEOperators icecrowdfx* match dump');

  const simDump = prefs.categories?.['preferences.simulation'] || {};
  const simGot = audit.crowdFxModule.simulationPrefs || {};
  for (const k of Object.keys(simDump)) {
    if (!(k in simGot)) diffs.push(`simulationPrefs missing ${k}`);
    else if (simGot[k] !== simDump[k]) diffs.push(`simulationPrefs.${k} value mismatch`);
  }
  if (!diffs.some(d => d.startsWith('simulationPrefs'))) notes.push('preferences.simulation path keys match dump');

  const cats = audit.crowdFxModule.preferencesCategories || {};
  if (!cats.ICEOperators || !cats.simulation) diffs.push('Preferences.Categories missing ICEOperators/simulation');
  else notes.push('Preferences.Categories has ICEOperators + simulation');
}

// Live ICE toolbar: CrowdFX group + Actors/Crowd/Simulation buttons; anchors unbound
const live = await page.evaluate(async () => {
  window.__switchModule?.('ICE');
  await new Promise(r => setTimeout(r, 80));
  const groups = [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim());
  const btns = [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim());
  const status = window.__menuStatus?.('ICE') ?? [];
  const anchors = status.filter(x => x.label === 'Anchor-to-Delete');
  const crowdFxAnchors = anchors.filter(x => x.path.includes('CrowdFX'));
  // path is parent chain (e.g. "CrowdFX > Crowd"); avoid matching substring "Crowd" inside "CrowdFX"
  const leafOf = (p) => (p.split(' > ').pop() || '');
  const bySub = {
    Actors: crowdFxAnchors.find(x => leafOf(x.path) === 'Actors'),
    Crowd: crowdFxAnchors.find(x => leafOf(x.path) === 'Crowd'),
    Simulation: crowdFxAnchors.find(x => leafOf(x.path) === 'Simulation'),
  };
  return {
    groups,
    btns,
    crowdFxAnchors: crowdFxAnchors.map(x => ({ path: x.path, id: x.id, cmd: x.cmd, impl: x.implemented })),
    bySub: Object.fromEntries(Object.entries(bySub).map(([k, v]) => [k, v ? { id: v.id, cmd: v.cmd, impl: v.implemented } : null])),
  };
});

if (!live.groups.includes('CrowdFX')) diffs.push('live ICE missing CrowdFX group');
else notes.push('live ICE CrowdFX group');

for (const b of mod.buttons) {
  if (!live.btns.includes(b)) diffs.push(`live missing CrowdFX button ${b}`);
}
if (!diffs.some(d => d.startsWith('live missing'))) notes.push('live Actors/Crowd/Simulation buttons');

for (const [sub, id] of Object.entries(mod.pe_menu_ids || {})) {
  const got = live.bySub[sub];
  if (!got) diffs.push(`live Anchor missing under CrowdFX > ${sub}`);
  else if (got.id !== id) diffs.push(`live ${sub} id want=${id} got=${got.id}`);
  else if (got.cmd !== null || got.impl) diffs.push(`CrowdFX ${sub} Anchor must not map cmd (got cmd=${got.cmd} impl=${got.impl})`);
}
if (!diffs.some(d => d.includes('Anchor') || d.includes('id want'))) {
  notes.push('CrowdFX PE Anchors unbound (41644/41646/41645)');
}

// SwitchToolbar Target=4 then CreateCrowd
const run = await page.evaluate(() => {
  window.__switchModule?.('Model');
  window.Application.run('SwitchToolbar', { Target: 4 });
  const crowd = window.Application.run('CreateCrowd', { BehaviorPreset: 'Basic' });
  const name = crowd?.name ?? null;
  const obj = name ? window.Application.scene?.find?.(name) : null;
  const p = obj?.properties?.find?.(x => x.type === 'crowdfx');
  const crowdKind = p ? (typeof p.val === 'function' ? p.val('kind') : null) : null;
  return {
    module: window.Application.module,
    select: document.querySelector('.module-select')?.value,
    crowdName: name,
    crowdKind,
    hasCmd: window.Application.commands?.has?.('CreateCrowd') ?? false,
  };
});
if (run.module !== 'ICE' || run.select !== 'ICE') diffs.push(`SwitchToolbar Target=4 → ${run.module}/${run.select}`);
else notes.push('SwitchToolbar Target=4 → ICE (CrowdFX host)');
if (!run.crowdName) diffs.push('CreateCrowd returned no object');
else notes.push(`CreateCrowd → ${run.crowdName} kind=${run.crowdKind}`);
if (run.crowdKind !== 'crowd') diffs.push(`CreateCrowd kind want=crowd got=${run.crowdKind}`);

await b.close();

const out = {
  ok: diffs.length === 0,
  diffs,
  notes,
  softimage: mod.softimage,
  menu_id: mod.menu_id,
  mcp_top: mod.mcp_top,
  buttons: mod.buttons,
  pe_menu_ids: mod.pe_menu_ids,
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'crowdfx-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
