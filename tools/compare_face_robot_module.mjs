// Softimage Face Robot Control Panel + Stage 1 vs MENU 300 / facerobot.xsily / Desktop PNG dumps.
// Dump-backed only. FR.dll / synoptic HTML body LOCK. Needs vite preview :4173.
// Usage: node tools/compare_face_robot_module.mjs
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
  path.resolve(__dirname, '../src/data/si/face_robot_module_mcp_tops.json'),
  path.resolve(__dirname, '../data/dump/si_face_robot_module_mcp_tops.json'),
].find(p => fs.existsSync(p));
const chromePath = path.resolve(__dirname, '../src/data/si/face_robot_stage1_chrome.json');
const ctrlPath = path.resolve(__dirname, '../src/data/si/face_robot_controller_chrome.json');
if (!topsPath || !fs.existsSync(chromePath) || !fs.existsSync(ctrlPath)) {
  console.error('missing Face Robot dump JSON');
  process.exit(2);
}
const tops = JSON.parse(fs.readFileSync(topsPath, 'utf8'));
const stage1 = JSON.parse(fs.readFileSync(chromePath, 'utf8'));
const ctrl = JSON.parse(fs.readFileSync(ctrlPath, 'utf8'));

const diffs = [];
const notes = [];
notes.push(`loaded tops ${topsPath}`);

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const audit = await page.evaluate(() => window.__uiAudit?.());
if (!audit?.faceRobot) diffs.push('__uiAudit.faceRobot missing');
else {
  notes.push(`softimage ${audit.faceRobot.softimage}`);
  if (audit.faceRobot.menuId !== 300) diffs.push(`menuId want=300 got=${audit.faceRobot.menuId}`);
  else notes.push('MENU 300');

  const wantTops = tops.tops;
  if (JSON.stringify(wantTops) !== JSON.stringify(audit.faceRobot.tops)) {
    diffs.push(`FR tops mismatch want=${wantTops.join('|')} got=${(audit.faceRobot.tops || []).join('|')}`);
  } else notes.push(`FR tops OK: ${wantTops.join(', ')}`);

  if (audit.faceRobot.switchToolbarTarget != null) diffs.push('Face Robot must not use SwitchToolbar Target');
  else notes.push('no SwitchToolbar Target (layout/enable path)');

  if (audit.faceRobot.runtimeLock !== 'LOCK') diffs.push('runtimeLock must stay LOCK');
  else notes.push('FR.dll runtime LOCK');

  for (const cmd of ['showFaceRobotActPanel', 'enableFaceRobot', 'faceRobotLayout', 'disableFaceRobot', 'softimageLayout']) {
    if (!audit.faceRobot[cmd]) diffs.push(`${cmd} not registered`);
    else notes.push(`${cmd} wired`);
  }
  for (const cmd of ['frGetCurrentStage', 'frSwitchFaceLayout']) {
    if (!audit.faceRobot[cmd]) diffs.push(`${cmd} not registered`);
    else notes.push(`${cmd} wired`);
  }

  if (!audit.faceRobot.prefsPagePresent) diffs.push('C3DPrefsFaceRobot prefs page missing');
  else notes.push('preferences.FaceRobot / C3DPrefsFaceRobot page present');

  if (!audit.faceRobot.menubarPresent) diffs.push('Face Robot menubar top missing');
  else notes.push('Face Robot menubar MENU 300 present');

  if (audit.faceRobot.stageCount !== 6) diffs.push(`stageCount want=6 got=${audit.faceRobot.stageCount}`);
  else notes.push('Control Panel 6 stages (xsily)');

  const wantTypes = (ctrl.stages || []).map(s => s.side_view_type);
  if (JSON.stringify(wantTypes) !== JSON.stringify(audit.faceRobot.stageTypes)) {
    diffs.push(`stageTypes mismatch`);
  } else notes.push('FaceStage*_SideView types from xsily');

  const wantSyn = ctrl.synoptic?.stage_frames ?? [];
  if (JSON.stringify(wantSyn) !== JSON.stringify(audit.faceRobot.synopticFrames)) {
    diffs.push(`synopticFrames want=${wantSyn.join('|')} got=${(audit.faceRobot.synopticFrames || []).join('|')}`);
  } else notes.push(`synoptic frames ${wantSyn.join(', ')}`);

  if (audit.faceRobot.synopticHtmlLock !== 'LOCK') diffs.push('synoptic HTML must stay LOCK');
  else notes.push('synoptic HTML LOCK');

  const wantSz = stage1.view?.defaultsize;
  const gotSz = audit.faceRobot.stage1DefaultSize;
  if (JSON.stringify(wantSz) !== JSON.stringify(gotSz)) {
    diffs.push(`Stage1 defaultsize want=${wantSz} got=${gotSz}`);
  } else notes.push(`Stage1 defaultsize ${wantSz?.join(',')}`);
}

// Enable Face Robot → Control Panel with Stage 1 Assemble
const stage = await page.evaluate(() => {
  window.Application.run('Enable Face Robot');
  const ctrlHost = document.querySelector('.fr-controller');
  const host = document.querySelector('.fr-stage1');
  const win = [...document.querySelectorAll('.ppg-float')].find(el =>
    el.querySelector('.ppg-float-title')?.textContent === 'Face Robot Control Panel'
    || el.querySelector('.fr-controller')
    || el.querySelector('.fr-stage1'));
  const tabs = [...(host?.querySelectorAll('.fr-stage1-lib .fr-tab') ?? [])].map(t => t.textContent.trim());
  const heads = [...(host?.querySelectorAll('.fr-lib-item') ?? [])].map(t => t.textContent.trim());
  const toolBtns = [...(host?.querySelectorAll('.fr-tool-btn') ?? [])].map(t => t.textContent.trim());
  const title = host?.querySelector('.fr-stage1-title-text')?.textContent?.trim()
    ?? ctrlHost?.querySelector('.fr-stage-title-text')?.textContent?.trim()
    ?? null;
  const log = host?.querySelector('.fr-log')?.textContent?.trim() ?? null;
  const scanDisabled = host?.querySelector('.fr-exec-scan')?.disabled ?? null;
  const diagnoseBtn = [...(host?.querySelectorAll('.fr-tool-btn') ?? [])].find(b => b.textContent.trim() === 'Diagnose');
  const stageTabs = [...(ctrlHost?.querySelectorAll('.fr-stage-tab') ?? [])].map(t => t.textContent.trim());
  const libLabel = host?.querySelector('.fr-section-label')?.textContent?.trim() ?? null;
  return {
    ctrlHost: !!ctrlHost,
    host: !!host,
    float: !!win,
    category: ctrlHost?.dataset.siCategory ?? host?.dataset.siCategory ?? null,
    defaultsize: ctrlHost?.dataset.siDefaultsize ?? host?.dataset.siDefaultsize ?? null,
    title,
    tabs,
    heads,
    toolBtns,
    log,
    scanDisabled,
    diagnoseDisabled: diagnoseBtn?.disabled ?? null,
    stageTabs,
    libLabel,
    enabled: window.__uiAudit?.()?.faceRobot?.faceRobotEnabled,
    currentStage: window.Application.run('fr_GetCurrentStage'),
  };
});

if (!stage.ctrlHost || !stage.host || !stage.float) diffs.push('Enable Face Robot did not open Control Panel + Stage 1');
else notes.push('Enable Face Robot → Control Panel + Stage 1 Assemble');
if (stage.title !== stage1.view.title) diffs.push(`Stage1 title want=${stage1.view.title} got=${stage.title}`);
else notes.push(`title ${stage.title}`);
if (stage.category !== 'Face Robot') diffs.push(`Control Panel category=${stage.category}`);
else notes.push('category=Face Robot');
if (JSON.stringify(stage.tabs) !== JSON.stringify(stage1.library_tabs)) {
  diffs.push(`library tabs want=${stage1.library_tabs.join('|')} got=${(stage.tabs || []).join('|')}`);
} else notes.push('library tabs Heads/Parts/Actor/Custom/Type');
if (stage.libLabel !== 'Library') diffs.push(`Library section label got=${stage.libLabel}`);
else notes.push('Library section label');
if (JSON.stringify(stage.heads) !== JSON.stringify(stage1.heads_list_attested)) {
  diffs.push(`heads list mismatch count want=${stage1.heads_list_attested.length} got=${(stage.heads || []).length}`);
} else notes.push(`heads list ${stage.heads.length} Desktop-attested`);
if (JSON.stringify(stage.toolBtns) !== JSON.stringify(stage1.tool_buttons)) {
  diffs.push(`tool buttons want=${stage1.tool_buttons.join('|')} got=${(stage.toolBtns || []).join('|')}`);
} else notes.push(`tool buttons ${stage.toolBtns.join(', ')} (Desktop OCR)`);
if (stage.log !== stage1.log_default) diffs.push(`log want="${stage1.log_default}" got="${stage.log}"`);
else notes.push('log: Pick Objects before Diagnose');
if (stage.scanDisabled !== true) diffs.push('Scan should be grey until pick');
else notes.push('Scan grey until pick');
if (stage.diagnoseDisabled !== true) diffs.push('Diagnose tool should be grey until pick');
else notes.push('Diagnose grey until pick');
if (!stage.enabled) diffs.push('faceRobotEnabled false after Enable');
else notes.push('faceRobotEnabled');
if (stage.currentStage !== 1) diffs.push(`fr_GetCurrentStage want=1 got=${stage.currentStage}`);
else notes.push('fr_GetCurrentStage=1');
if (JSON.stringify(stage.stageTabs) !== JSON.stringify(['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6'])) {
  diffs.push(`stage tabs got=${(stage.stageTabs || []).join('|')}`);
} else notes.push('stage tray tabs 1–6');

// Face Robot Layout command
const layout = await page.evaluate(() => {
  window.Application.run('Face Robot Layout');
  return {
    ctrl: !!document.querySelector('.fr-controller'),
    host: !!document.querySelector('.fr-stage1'),
    enabled: window.__uiAudit?.()?.faceRobot?.faceRobotEnabled,
  };
});
if (!layout.ctrl || !layout.host || !layout.enabled) diffs.push('Face Robot Layout failed');
else notes.push('Face Robot Layout → Control Panel OK');

// Switch to Stage 5 — synoptic slots from xsily
const s5 = await page.evaluate(() => {
  window.Application.run('fr_SwitchFaceLayout', { inLayoutID: 5 });
  const ctrlHost = document.querySelector('.fr-controller');
  const slots = [...(ctrlHost?.querySelectorAll('.fr-synoptic-slot') ?? [])].map(s => s.dataset.siFrFrame);
  const type = ctrlHost?.querySelector('.fr-stage-type')?.textContent?.trim() ?? null;
  const stage = window.Application.run('fr_GetCurrentStage');
  return { slots, type, stage, activeTab: ctrlHost?.querySelector('.fr-stage-tab.active')?.textContent?.trim() };
});
if (s5.stage !== 5) diffs.push(`fr_SwitchFaceLayout(5) stage got=${s5.stage}`);
else notes.push('fr_SwitchFaceLayout(5)');
if (s5.type !== 'FaceStage5_UpperSideView') diffs.push(`Stage5 type got=${s5.type}`);
else notes.push('Stage5 FaceStage5_UpperSideView shell');
if (!s5.slots.includes('stage5select') || !s5.slots.includes('stage5cameras')) {
  diffs.push(`Stage5 synoptic slots got=${(s5.slots || []).join('|')}`);
} else notes.push('Stage5 synoptic frames stage5select/stage5cameras');

// ShowFaceRobotActPanel — Synoptic View structure
const act = await page.evaluate(() => {
  window.Application.run('ShowFaceRobotActPanel');
  const host = document.querySelector('.fr-act-panel');
  const win = [...document.querySelectorAll('.ppg-float')].find(el =>
    el.querySelector('.ppg-float-title')?.textContent === 'Face Robot Act Floating Panel'
    || el.querySelector('.fr-act-panel'));
  const slot = host?.querySelector('.fr-synoptic-slot');
  return {
    host: !!host,
    float: !!win,
    category: host?.dataset.siCategory ?? null,
    viewType: host?.dataset.siViewType ?? null,
    path: slot?.querySelector('.fr-synoptic-path')?.textContent?.includes('FaceRobotContext.htm') ?? false,
    lock: slot?.querySelector('.fr-synoptic-lock')?.textContent?.includes('LOCK') ?? false,
  };
});
if (!act.host || !act.float) diffs.push('ShowFaceRobotActPanel did not open Act panel');
else notes.push('ShowFaceRobotActPanel OK');
if (act.category !== 'Face Robot') diffs.push(`Act category=${act.category}`);
else notes.push('Act category=Face Robot');
if (act.viewType !== 'Synoptic View') diffs.push(`Act viewType=${act.viewType}`);
else notes.push('Act Synoptic View type');
if (!act.path) diffs.push('Act Path default missing FaceRobotContext.htm');
else notes.push('Act Path default from commands_full');
if (!act.lock) diffs.push('Act synoptic HTML LOCK note missing');
else notes.push('Act synoptic HTML LOCK');

// Softimage Layout + Disable
const off = await page.evaluate(() => {
  window.Application.run('Softimage Layout');
  window.Application.run('Disable Face Robot');
  return { enabled: window.__uiAudit?.()?.faceRobot?.faceRobotEnabled };
});
if (off.enabled) diffs.push('Disable Face Robot left enabled');
else notes.push('Disable Face Robot OK');

// FROST still present (parallel; not replaced)
const frost = await page.evaluate(() => {
  const sel = document.querySelector('.module-select');
  return sel ? [...sel.options].map(o => o.value).includes('FROST') : false;
});
if (!frost) diffs.push('FROST module-select missing (must stay additive)');
else notes.push('FROST still in module-select (additive)');

await b.close();

const out = {
  ok: diffs.length === 0,
  diffs,
  notes,
  softimage: tops.softimage,
  menu_id: tops.menu_id,
  tops: tops.tops,
  stage_count: ctrl.stages?.length,
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'face-robot-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
