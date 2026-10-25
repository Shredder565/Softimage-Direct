// Softimage CrowdFX under ICE vs Desktop dumps (MCP Actors/Crowd/Simulation + ICE menubar tear-off + closer95 flyouts).
// Dump-backed only. Anchor-to-Delete compounds LOCK (submenu_live=false); crowdfx.submenu_flyouts DUMP_READY.
// Needs vite preview :4173. Usage: node tools/compare_crowdfx_module.mjs
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
const deskPath = [
  path.resolve(__dirname, '../src/data/si/crowdfx_desktop_menu.json'),
  path.resolve(__dirname, '../data/dump/si_crowdfx_desktop_menu.json'),
].find(p => fs.existsSync(p));
const flyPath = [
  path.resolve(__dirname, '../src/data/si/crowdfx_submenu_flyouts.json'),
  path.resolve(__dirname, '../data/dump/si_crowdfx_submenu_flyouts.json'),
].find(p => fs.existsSync(p));
if (!modPath || !prefsPath || !deskPath || !flyPath) {
  console.error('missing CrowdFX dump JSON (module/prefs/desktop_menu/submenu_flyouts)');
  process.exit(2);
}
const mod = JSON.parse(fs.readFileSync(modPath, 'utf8'));
const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
const desk = JSON.parse(fs.readFileSync(deskPath, 'utf8'));
const fly = JSON.parse(fs.readFileSync(flyPath, 'utf8'));

const diffs = [];
const notes = [];
notes.push(`loaded module ${modPath}`);
notes.push(`loaded prefs ${prefsPath}`);
notes.push(`loaded desktop_menu ${deskPath}`);
notes.push(`loaded submenu_flyouts ${flyPath}`);

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

// Desktop menubar ICE tear-off → CrowdFX Actors/Crowd/Simulation (DUMP_READY; submenu_live=false compounds)
if (desk.status !== 'DUMP_READY') diffs.push(`desktop_menu status want=DUMP_READY got=${desk.status}`);
else notes.push('desktop_menu DUMP_READY');
if (desk.reachability?.submenu_live !== false) diffs.push('desktop_menu submenu_live must be false (no invent compounds)');
else notes.push('desktop_menu submenu_live=false (compounds LOCK)');
if (desk.submenu_flyouts?.status !== 'DUMP_READY') {
  diffs.push(`desktop_menu submenu_flyouts.status want=DUMP_READY got=${desk.submenu_flyouts?.status}`);
} else notes.push('desktop_menu submenu_flyouts DUMP_READY (closer95)');
if (desk.submenu_flyouts?.compound_leaves !== 'LOCK') {
  diffs.push('desktop_menu submenu_flyouts.compound_leaves must be LOCK');
} else notes.push('submenu_flyouts compound_leaves LOCK');
if (desk.submenu_flyouts?.pe_leaf !== 'Anchor-to-Delete') {
  diffs.push(`submenu_flyouts pe_leaf want=Anchor-to-Delete got=${desk.submenu_flyouts?.pe_leaf}`);
}
if (fly.status !== 'DUMP_READY' || fly.lock_id !== 'crowdfx.submenu_flyouts') {
  diffs.push(`flyouts dump status/lock_id want=DUMP_READY/crowdfx.submenu_flyouts got=${fly.status}/${fly.lock_id}`);
} else notes.push('crowdfx.submenu_flyouts dump DUMP_READY');
if (fly.summary?.submenu_live_compounds !== false) diffs.push('flyouts submenu_live_compounds must be false');
if ((fly.summary?.flyout_count ?? 0) !== 3) diffs.push(`flyouts flyout_count want=3 got=${fly.summary?.flyout_count}`);
else notes.push('flyouts Actors/Crowd/Simulation × Anchor-to-Delete');
if (JSON.stringify(desk.reachability?.buttons) !== JSON.stringify(mod.buttons)) {
  diffs.push(`desktop_menu buttons mismatch mod=${(mod.buttons || []).join('|')}`);
}

const deskLive = await page.evaluate(async (wantButtons) => {
  window.__switchModule?.('Model');
  await new Promise(r => setTimeout(r, 40));
  const iceBtn = document.querySelector('#menubar .m[data-si-menu="ICE"]');
  if (!iceBtn) return { menubar: false };
  iceBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 80));
  const tear = document.querySelector('.menu.module-tearoff[data-si-module-menu="ICE"]');
  const groups = tear ? [...tear.querySelectorAll('.menu-group')].map(el => el.textContent.trim()) : [];
  const items = tear ? [...tear.querySelectorAll('.menu-item')].map(el => el.textContent.trim()) : [];
  const crowdFxGroup = tear?.querySelector('.menu-group[data-si-menu-group="CrowdFX"]');
  const crowdFxItems = wantButtons.map(b => {
    const row = tear?.querySelector(`.menu-item[data-si-menu-item="${b}"]`);
    return { label: b, present: !!row, hasSub: !!row?.classList.contains('has-sub') };
  });
  // Hover Actors → Anchor-to-Delete LOCK submenu (no invent compounds)
  const actors = tear?.querySelector('.menu-item[data-si-menu-item="Actors"]');
  if (actors) {
    actors.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
  }
  const sub = document.querySelectorAll('.menu');
  const subItems = [...sub].slice(1).flatMap(m => [...m.querySelectorAll('.menu-item')].map(el => el.textContent.trim()));
  return {
    menubar: true,
    module: window.Application?.module,
    select: document.querySelector('.module-select')?.value,
    tearPresent: !!tear,
    groups,
    items,
    crowdFxGroup: !!crowdFxGroup,
    crowdFxItems,
    subItems,
    auditDesktop: window.__uiAudit?.()?.crowdFxModule?.desktopMenu ?? null,
  };
}, desk.reachability?.buttons || mod.buttons);

if (!deskLive.menubar) diffs.push('menubar ICE top missing (#menubar [data-si-menu=ICE])');
else notes.push('menubar ICE present');
if (deskLive.module !== 'ICE' || deskLive.select !== 'ICE') {
  diffs.push(`ICE menubar click → module ${deskLive.module}/${deskLive.select}`);
} else notes.push('ICE menubar click → SwitchToolbar ICE host');
if (!deskLive.tearPresent) diffs.push('ICE menubar tear-off missing');
else notes.push('ICE module tear-off open');
if (!deskLive.groups?.includes('CrowdFX')) diffs.push('tear-off missing CrowdFX group header');
else notes.push('tear-off CrowdFX group');
for (const row of deskLive.crowdFxItems || []) {
  if (!row.present) diffs.push(`tear-off missing CrowdFX row ${row.label}`);
  else if (!row.hasSub) diffs.push(`tear-off ${row.label} must has-sub (Desktop submenu arrow)`);
}
if (!(deskLive.crowdFxItems || []).some(r => !r.present || !r.hasSub)) {
  notes.push('tear-off Actors/Crowd/Simulation has-sub');
}
const anchorsOnly = (deskLive.subItems || []).every(l => l === 'Anchor-to-Delete' || l === '');
if ((deskLive.subItems || []).length && !anchorsOnly) {
  diffs.push(`CrowdFX submenu invent leaves: ${(deskLive.subItems || []).join(',')}`);
} else if ((deskLive.subItems || []).includes('Anchor-to-Delete')) {
  notes.push('CrowdFX submenu Anchor-to-Delete LOCK (no invent)');
} else {
  // still OK if hover did not open — PE anchors must remain unbound via menuStatus
  notes.push('CrowdFX submenu hover checked');
}
if (deskLive.auditDesktop?.status !== 'DUMP_READY') {
  diffs.push(`audit desktopMenu.status want=DUMP_READY got=${deskLive.auditDesktop?.status}`);
} else notes.push('audit desktopMenu DUMP_READY');
if (deskLive.auditDesktop?.submenuLive !== false) diffs.push('audit desktopMenu.submenuLive must be false');
if (deskLive.auditDesktop?.submenuFlyouts !== 'DUMP_READY') {
  diffs.push(`audit desktopMenu.submenuFlyouts want=DUMP_READY got=${deskLive.auditDesktop?.submenuFlyouts}`);
} else notes.push('audit desktopMenu.submenuFlyouts DUMP_READY');
if (deskLive.auditDesktop?.menubarPresent !== true) diffs.push('audit desktopMenu.menubarPresent false');

const flyAudit = await page.evaluate(() => window.__uiAudit?.()?.crowdFxModule?.submenuFlyouts ?? null);
if (!flyAudit) diffs.push('audit submenuFlyouts missing');
else {
  if (flyAudit.status !== 'WIRED') diffs.push(`audit submenuFlyouts.status want=WIRED got=${flyAudit.status}`);
  else notes.push('audit submenuFlyouts WIRED');
  if (flyAudit.dumpStatus !== 'DUMP_READY') diffs.push(`audit submenuFlyouts.dumpStatus want=DUMP_READY got=${flyAudit.dumpStatus}`);
  if (flyAudit.lockId !== 'crowdfx.submenu_flyouts') diffs.push(`audit submenuFlyouts.lockId mismatch`);
  if ((flyAudit.flyoutCount ?? 0) !== 3) diffs.push(`audit submenuFlyouts.flyoutCount want=3 got=${flyAudit.flyoutCount}`);
  if (flyAudit.compoundLeaves !== 'LOCK') diffs.push('audit submenuFlyouts.compoundLeaves must LOCK');
  else notes.push('audit submenuFlyouts compounds LOCK');
  if ((flyAudit.mismatches || []).length) diffs.push(`audit submenuFlyouts mismatches: ${flyAudit.mismatches.join(',')}`);
}

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
  desktop_menu: {
    status: desk.status,
    path: desk.reachability?.path,
    buttons: desk.reachability?.buttons,
    submenu_live: desk.reachability?.submenu_live,
    submenu_flyouts: desk.submenu_flyouts?.status,
  },
  submenu_flyouts: {
    lock_id: fly.lock_id,
    status: fly.status,
    flyout_count: fly.summary?.flyout_count,
    compound_leaves: fly.summary?.compound_leaves,
  },
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'crowdfx-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
