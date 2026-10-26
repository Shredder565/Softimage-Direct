// Softimage ICE module shell vs PE MENU 303 dumps (MCP tops / SwitchToolbar / ICE Tree xsivw).
// Dump-backed only. PE Anchor leaf ids + factory_menu_names DUMP_READY (anchor Ghidra tour). Needs vite preview :4173.
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
const cmdEnPath = [
  path.resolve(__dirname, '../src/data/si/ice_desktop_command_enabled.json'),
  path.resolve(__dirname, '../data/dump/si_ice_desktop_command_enabled.json'),
].find(p => fs.existsSync(p));
const prefsPath = [
  path.resolve(__dirname, '../src/data/si/ice_desktop_prefs.json'),
  path.resolve(__dirname, '../data/dump/si_ice_desktop_prefs.json'),
].find(p => fs.existsSync(p));
const anchorPath = [
  path.resolve(__dirname, '../src/data/si/ice_pe_anchor_leaves.json'),
  path.resolve(__dirname, '../data/dump/si_ice_pe_anchor_leaves.json'),
].find(p => fs.existsSync(p));
if (!topsPath || !fs.existsSync(chromePath) || !cmdEnPath || !prefsPath || !anchorPath) {
  console.error('missing ICE dump JSON');
  process.exit(2);
}
const tops = JSON.parse(fs.readFileSync(topsPath, 'utf8'));
const chrome = JSON.parse(fs.readFileSync(chromePath, 'utf8'));
const cmdEn = JSON.parse(fs.readFileSync(cmdEnPath, 'utf8'));
const prefsDump = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
const anchors = JSON.parse(fs.readFileSync(anchorPath, 'utf8'));

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

  if (audit.iceModule.runtimeAnchors !== 'DUMP_READY') {
    diffs.push(`runtime Anchors want DUMP_READY (got ${audit.iceModule.runtimeAnchors})`);
  } else notes.push('PE Anchor leaf ids DUMP_READY');
  if (audit.iceModule.compoundNamesLock !== 'DUMP_READY') {
    diffs.push(`compound names want DUMP_READY (got ${audit.iceModule.compoundNamesLock})`);
  } else notes.push('plugin compound names DUMP_READY');

  const pe = audit.iceModule.peAnchorLeaves;
  const wantLeaves = anchors.pe_menu_leaves?.leaves || [];
  if (pe?.status !== 'DUMP_READY') diffs.push(`peAnchorLeaves.status want DUMP_READY (got ${pe?.status})`);
  else notes.push('peAnchorLeaves DUMP_READY');
  if (pe?.count !== wantLeaves.length) diffs.push(`peAnchorLeaves.count ${pe?.count} ≠ ${wantLeaves.length}`);
  else notes.push(`peAnchorLeaves count ${wantLeaves.length}`);
  if (pe?.unboundPluginCompounds !== 'DUMP_READY') {
    diffs.push(`unbound plugin compounds want DUMP_READY (got ${pe?.unboundPluginCompounds})`);
  } else notes.push('unbound plugin compounds DUMP_READY');
  const wantCompound = (anchors.compound_om_cmds?.found || []).map(c => c.scriptingname).sort();
  const gotCompound = [...(pe?.compoundCmdsWired || [])].sort();
  if (JSON.stringify(wantCompound) !== JSON.stringify(gotCompound)) {
    diffs.push(`compound OM cmds want=${wantCompound.join('|')} got=${gotCompound.join('|')}`);
  } else notes.push(`compound OM cmds wired: ${wantCompound.join(', ')}`);

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
  const anchorRows = status.filter(x => x.label === 'Anchor-to-Delete');
  const crowd = anchorRows.find(x => x.path.includes('CrowdFX') && x.path.includes('Crowd'));
  const byPath = Object.fromEntries(anchorRows.map(x => [`${x.path} > ${x.label}`, x]));
  return {
    groups, btns, placeholder, label,
    anchorCount: anchorRows.length,
    crowdCmd: crowd?.cmd ?? null,
    crowdImpl: crowd?.implemented ?? false,
    byPath,
  };
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

// Softimage PE id 41646 collides with RenderRegion — Anchor must NOT map that cmd; factory fill uses AnchorFactoryMenuItem.
if (live.crowdCmd && live.crowdCmd !== 'AnchorFactoryMenuItem') {
  diffs.push(`CrowdFX Anchor must not map RenderRegion cmd (got cmd=${live.crowdCmd} impl=${live.crowdImpl})`);
} else if (!live.crowdImpl) {
  diffs.push(`CrowdFX Anchor factory fill want implemented (got cmd=${live.crowdCmd} impl=${live.crowdImpl})`);
} else notes.push(`Anchor-to-Delete factory fills DUMP_READY (${live.anchorCount} slots)`);

const wantAnchorLeaves = anchors.pe_menu_leaves?.leaves || [];
if (live.anchorCount !== wantAnchorLeaves.length) {
  diffs.push(`live Anchor slots ${live.anchorCount} ≠ dump ${wantAnchorLeaves.length}`);
} else notes.push(`live Anchor slots match dump (${wantAnchorLeaves.length})`);
let leafIdMismatches = 0;
for (const leaf of wantAnchorLeaves) {
  const pathKey = `${leaf.trail.join(' > ')} > Anchor-to-Delete`;
  const row = live.byPath[pathKey];
  if (!row) { diffs.push(`missing ICE menu leaf ${pathKey}`); leafIdMismatches++; }
  else if (row.id !== leaf.id) { diffs.push(`${pathKey} id want=${leaf.id} got=${row.id}`); leafIdMismatches++; }
  else if (row.cmd && row.cmd !== 'AnchorFactoryMenuItem') {
    diffs.push(`${pathKey} must not map PE collision cmd (got ${row.cmd})`); leafIdMismatches++;
  } else if (!row.implemented) {
    diffs.push(`${pathKey} factory fill want implemented`); leafIdMismatches++;
  }
}
if (!leafIdMismatches) notes.push('MENU 303 Anchor leaf ids + factory fills DUMP_READY');

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
  const tb = [...(host?.querySelectorAll('.ice-menubar > button.xp-btn') ?? [])].map(b => (b.textContent || '').replace(/▾$/, '').trim());
  const tbText = [...(host?.querySelectorAll('.ice-toolbar-text > button.xp-btn') ?? [])].map(b => (b.textContent || '').replace(/▾$/, '').trim());
  const cs = getComputedStyle(document.documentElement);
  return {
    host: !!host,
    category: host?.dataset.siCategory ?? null,
    defaultsize: host?.dataset.siDefaultsize ?? null,
    clsid: host?.dataset.siClsid ?? null,
    cmdmap: host?.dataset.siCmdmap ?? null,
    clientGdi: host?.dataset.siClientGdi ?? null,
    status: host?.dataset.siStatus ?? null,
    explorerSize: host?.dataset.siExplorerSize ?? null,
    presetSize: host?.dataset.siPresetManagerSize ?? null,
    leftBar: host?.dataset.siLeftCompoundbarSize ?? null,
    rightBar: host?.dataset.siRightCompoundbarSize ?? null,
    createNodeMode: host?.dataset.siCreateNodeMode ?? null,
    prefsApplyCss: host?.dataset.siPrefsApplyCss ?? null,
    toolbar: tb,
    toolbarText: tbText,
    bodyLayout: !!host?.querySelector('.ice-body'),
    palette: !!host?.querySelector('.ice-palette'),
    explorer: !!host?.querySelector('.ice-explorer'),
    iceDefaultW: cs.getPropertyValue('--ice-default-w').trim(),
    iceDefaultH: cs.getPropertyValue('--ice-default-h').trim(),
    icePresetW: cs.getPropertyValue('--ice-preset-w').trim(),
    iceExplorerW: cs.getPropertyValue('--ice-explorer-w').trim(),
    iceToolbarH: cs.getPropertyValue('--ice-toolbar-h').trim(),
    icePanelBg: cs.getPropertyValue('--ice-panel-bg').trim(),
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
const wantClsid = chrome.views['ICE Tree'].clsid;
if (wantClsid && tree.clsid !== wantClsid) diffs.push(`ICE Tree clsid ${tree.clsid}`);
else if (wantClsid) notes.push(`ICE Tree clsid ${wantClsid}`);
const wantCmd = chrome.views['ICE Tree'].cmdmap;
if (wantCmd && tree.cmdmap !== wantCmd) diffs.push(`ICE Tree cmdmap ${tree.cmdmap}`);
else if (wantCmd) notes.push('ICE Tree cmdmap shared with Render Tree');
if (tree.clientGdi !== 'DUMP_READY') diffs.push(`ICE Tree client_gdi want DUMP_READY (got ${tree.clientGdi})`);
else notes.push('ICE Tree client_gdi DUMP_READY');
if (tree.status !== 'CLIENT_GDI') diffs.push(`ICE Tree status=${tree.status}`);
else notes.push('ICE Tree status CLIENT_GDI');
if (tree.prefsApplyCss !== 'true') diffs.push(`prefs region CSS must be on (got ${tree.prefsApplyCss})`);
else notes.push('prefs region CSS on (PREFS_ATTESTED_REGION_DESKTOP)');
const pl = chrome.prefs_layout || {};
if (String(pl.explorer_size) !== tree.explorerSize) diffs.push(`explorer_size dataset ${tree.explorerSize}`);
else notes.push(`explorer_size dataset ${tree.explorerSize}`);
if (String(pl.preset_manager_size) !== tree.presetSize) diffs.push(`preset_manager_size dataset ${tree.presetSize}`);
else notes.push(`preset_manager_size dataset ${tree.presetSize}`);
if (String(pl.leftcompoundbar_size) !== tree.leftBar || String(pl.rightcompoundbar_size) !== tree.rightBar) {
  diffs.push(`compoundbar dataset L/R ${tree.leftBar}/${tree.rightBar}`);
} else notes.push(`compoundbar dataset ${tree.leftBar}/${tree.rightBar}`);
const wantTb = chrome.toolbar_shell?.attested || ['Create', 'Show', 'Tools', 'Nodes', 'Compounds', 'User Tools'];
if (JSON.stringify(tree.toolbar) !== JSON.stringify(wantTb)) {
  diffs.push(`menubar want=${wantTb.join('|')} got=${(tree.toolbar || []).join('|')}`);
} else notes.push(`menubar Desktop ${wantTb.join(', ')}`);
const wantTbText = chrome.toolbar_shell?.toolbar_text || ['Attr. Editor', 'No Highlight'];
if (JSON.stringify(tree.toolbarText) !== JSON.stringify(wantTbText)) {
  diffs.push(`toolbar text want=${wantTbText.join('|')} got=${(tree.toolbarText || []).join('|')}`);
} else notes.push(`toolbar text ${wantTbText.join(', ')}`);
if (tree.toolbar?.includes('New Tree')) diffs.push('New Tree invent must not appear on toolbar');
if (!tree.bodyLayout || !tree.palette || !tree.explorer) diffs.push('ICE body/palette/explorer layout missing');
else notes.push('ICE body palette|canvas|explorer layout');
if (tree.iceDefaultW !== `${chrome.views['ICE Tree'].defaultsize[2]}px`) {
  diffs.push(`--ice-default-w ${tree.iceDefaultW}`);
} else notes.push(`--ice-default-w ${tree.iceDefaultW}`);
if (tree.iceDefaultH !== `${chrome.views['ICE Tree'].defaultsize[3]}px`) {
  diffs.push(`--ice-default-h ${tree.iceDefaultH}`);
} else notes.push(`--ice-default-h ${tree.iceDefaultH}`);
if (tree.icePresetW !== `${pl.preset_manager_size}px`) diffs.push(`--ice-preset-w ${tree.icePresetW}`);
else notes.push(`--ice-preset-w ${tree.icePresetW}`);
if (tree.iceExplorerW !== `${pl.explorer_size}px`) diffs.push(`--ice-explorer-w ${tree.iceExplorerW}`);
else notes.push(`--ice-explorer-w ${tree.iceExplorerW}`);
const wantToolbarH = chrome.client_gdi?.toolbar_h_px;
if (wantToolbarH != null && tree.iceToolbarH !== `${wantToolbarH}px`) diffs.push(`--ice-toolbar-h ${tree.iceToolbarH}`);
else if (wantToolbarH != null) notes.push(`--ice-toolbar-h ${tree.iceToolbarH}`);
const wantPanelBg = chrome.client_gdi?.colors?.panel_bg;
if (wantPanelBg && tree.icePanelBg !== wantPanelBg) diffs.push(`--ice-panel-bg ${tree.icePanelBg}`);
else if (wantPanelBg) notes.push(`--ice-panel-bg ${tree.icePanelBg}`);
// Mislabel guard: never treat Face Robot tour 12 as ICE Tree source
if (chrome.desktop_png_attestation?.shots?.['12-ice-tree.png']?.use_for_ice_tree_gdi) {
  diffs.push('tour 12-ice-tree.png must not be used for ICE Tree GDI');
} else notes.push('tour 12-ice-tree.png excluded (Face Robot mislabel)');
if (!chrome.desktop_png_attestation?.shots?.['20-ice-tree.png']?.use_for_ice_tree_gdi) {
  diffs.push('20-ice-tree.png must be attested for ICE Tree GDI');
} else notes.push('20-ice-tree.png DUMP_READY attested');

// ICE Attribute Editor SHELL_ONLY from iceattributeeditor.xsivw
const attr = await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'ICE Attribute Editor' } }));
  const host = document.querySelector('.ice-attr-editor');
  const win = [...document.querySelectorAll('.ppg-float')].find(el => el.querySelector('.ppg-float-title')?.textContent === 'ICE Attribute Editor');
  return {
    host: !!host,
    category: host?.dataset.siCategory ?? null,
    defaultsize: host?.dataset.siDefaultsize ?? null,
    clsid: host?.dataset.siClsid ?? null,
    status: host?.dataset.siStatus ?? null,
    clientGdi: host?.dataset.siClientGdi ?? null,
    toolbar: [...(host?.querySelectorAll('.ice-attr-toolbar > button.xp-btn') ?? [])].map(b => (b.textContent || '').replace(/▾$/, '').trim()),
    bodyStatic: host?.querySelector('.ice-attr-body-static')?.textContent?.trim() ?? null,
    float: !!win,
    w: win ? Math.round(win.getBoundingClientRect().width) : 0,
    h: win ? Math.round(win.getBoundingClientRect().height) : 0,
  };
});
const wantAttr = chrome.views['ICE Attribute Editor'];
if (!attr.host || !attr.float) diffs.push('ICE Attribute Editor shell did not open');
else notes.push(`ICE Attribute Editor shell open ${attr.w}x${attr.h}`);
if (attr.category !== wantAttr?.category) diffs.push(`ICE Attribute Editor category=${attr.category}`);
else notes.push('ICE Attribute Editor category=ICE');
if (attr.defaultsize !== (wantAttr?.defaultsize || []).join(',')) diffs.push(`ICE Attribute Editor defaultsize ${attr.defaultsize}`);
else notes.push(`ICE Attribute Editor defaultsize ${attr.defaultsize}`);
if (attr.clsid !== wantAttr?.clsid) diffs.push(`ICE Attribute Editor clsid ${attr.clsid}`);
else notes.push(`ICE Attribute Editor clsid OK`);
if (attr.status !== 'CLIENT_GDI') diffs.push(`ICE Attribute Editor status=${attr.status}`);
else notes.push('ICE Attribute Editor CLIENT_GDI');
if (attr.clientGdi !== 'DUMP_READY') diffs.push(`ICE Attribute Editor client_gdi=${attr.clientGdi}`);
else notes.push('ICE Attribute Editor client_gdi DUMP_READY');
const wantAttrTb = wantAttr?.toolbar_labels || chrome.attr_client_gdi?.toolbar_labels || [];
if (JSON.stringify(attr.toolbar) !== JSON.stringify(wantAttrTb)) {
  diffs.push(`attr toolbar want=${wantAttrTb.join('|')} got=${(attr.toolbar || []).join('|')}`);
} else notes.push(`attr toolbar ${wantAttrTb.join(', ')}`);
const wantBody = wantAttr?.body_static || chrome.attr_client_gdi?.body_static;
if (attr.bodyStatic !== wantBody) diffs.push(`attr body static mismatch`);
else notes.push('attr body static from HWND');

// Audit chrome tokens from iceModule
const chromeAudit = await page.evaluate(() => window.__uiAudit?.()?.iceModule?.iceTreeChrome);
if (!chromeAudit?.tokensApplied) diffs.push('iceTreeChrome tokensApplied false');
else notes.push('iceTreeChrome CSS vars applied');
if (chromeAudit?.clientGdi !== 'DUMP_READY') diffs.push(`audit clientGdi ${chromeAudit?.clientGdi}`);
else notes.push('audit clientGdi DUMP_READY');
if (!chromeAudit?.prefsApplyCss) diffs.push('audit prefsApplyCss must be true');
else notes.push('audit prefsApplyCss true');
if (!chromeAudit?.regionCssApplied) diffs.push('audit regionCssApplied false');
else notes.push('audit region CSS vars applied');

// Desktop tour HIGH: ScriptingNames registered + prefs icetree(10) / ICEOperators(21)
const high = Object.keys(cmdEn.enabled_by_scriptingname || {});
const highLive = await page.evaluate((names) => {
  const ice = window.__uiAudit?.()?.iceModule;
  const missing = names.filter(n => !window.Application.commands.has(n));
  return {
    missing,
    highWiredCount: ice?.highWiredCount,
    highExpectedCount: ice?.highExpectedCount,
    prefs: ice?.prefs,
    addNode: (() => {
      try {
        window.Application.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
        window.Application.run('SelectObj', { InputObjs: window.Application.scene.root.children.slice(-1)[0]?.fullName });
        window.Application.run('ApplyICEOp', { File: '' });
        const n = window.Application.run('AddICENode', { PresetObj: 'Get Data' });
        return { ok: !!n, id: n?.id ?? null };
      } catch (e) {
        return { ok: false, err: String(e?.message || e) };
      }
    })(),
    genCloud: (() => {
      try {
        const r = window.Application.run('GeneratePointCloudWithICETemplate', { File: '' });
        return { ok: !!r?.cloud, name: r?.cloud?.name ?? null };
      } catch (e) {
        return { ok: false, err: String(e?.message || e) };
      }
    })(),
  };
}, high);

if (highLive.missing.length) diffs.push(`HIGH cmds missing: ${highLive.missing.join(',')}`);
else notes.push(`tour HIGH cmds wired ${high.length}`);
if (highLive.highWiredCount !== high.length) {
  diffs.push(`highWiredCount ${highLive.highWiredCount} ≠ ${high.length}`);
} else notes.push(`audit highWiredCount ${highLive.highWiredCount}`);

const wantTreeN = prefsDump['preferences.icetree']?.param_count ?? 10;
const wantOpsN = prefsDump['preferences.ICEOperators']?.param_count ?? 21;
if (highLive.prefs?.icetreeCount !== wantTreeN) diffs.push(`prefs.icetree count ${highLive.prefs?.icetreeCount}`);
else notes.push(`preferences.icetree ${wantTreeN} params`);
if (highLive.prefs?.iceOperatorsCount !== wantOpsN) diffs.push(`prefs.ICEOperators count ${highLive.prefs?.iceOperatorsCount}`);
else notes.push(`preferences.ICEOperators ${wantOpsN} params`);
if (!highLive.prefs?.icetreeMatch) diffs.push('C3DPrefsICETree live params mismatch dump');
else notes.push('C3DPrefsICETree matches dump keys');
if (!highLive.prefs?.iceOperatorsMatch) diffs.push('C3DPrefsICEOperators live params mismatch dump');
else notes.push('C3DPrefsICEOperators matches dump keys');

if (!highLive.addNode?.ok) diffs.push(`AddICENode failed: ${highLive.addNode?.err}`);
else notes.push(`AddICENode → node ${highLive.addNode.id}`);
if (!highLive.genCloud?.ok) diffs.push(`GeneratePointCloudWithICETemplate failed: ${highLive.genCloud?.err}`);
else notes.push(`GeneratePointCloudWithICETemplate → ${highLive.genCloud.name}`);

await b.close();

const out = {
  ok: diffs.length === 0,
  diffs,
  notes,
  softimage: tops.softimage,
  menu_id: tops.menu_id,
  tops: tops.tops,
  tour_high: high.length,
  prefs: { icetree: wantTreeN, ICEOperators: wantOpsN },
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'ice-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
