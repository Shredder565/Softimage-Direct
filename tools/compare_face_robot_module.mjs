// Softimage Face Robot module shell vs MENU 300 / Stage 1 Desktop dumps.
// Dump-backed only. FR.dll body LOCK. Needs vite preview :4173.
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
if (!topsPath || !fs.existsSync(chromePath)) {
  console.error('missing Face Robot dump JSON');
  process.exit(2);
}
const tops = JSON.parse(fs.readFileSync(topsPath, 'utf8'));
const stage1 = JSON.parse(fs.readFileSync(chromePath, 'utf8'));

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

  if (!audit.faceRobot.prefsPagePresent) diffs.push('C3DPrefsFaceRobot prefs page missing');
  else notes.push('preferences.FaceRobot / C3DPrefsFaceRobot page present');

  if (!audit.prefsPages?.includes('C3DPrefsFaceRobot') && !audit.faceRobot.prefsPagePresent) {
    diffs.push('prefsPages missing C3DPrefsFaceRobot');
  }

  if (!audit.faceRobot.menubarPresent) diffs.push('Face Robot menubar top missing');
  else notes.push('Face Robot menubar MENU 300 present');

  const wantSz = stage1.view?.defaultsize;
  const gotSz = audit.faceRobot.stage1DefaultSize;
  if (JSON.stringify(wantSz) !== JSON.stringify(gotSz)) {
    diffs.push(`Stage1 defaultsize want=${wantSz} got=${gotSz}`);
  } else notes.push(`Stage1 defaultsize ${wantSz?.join(',')}`);
}

// Enable Face Robot → Stage 1 Assemble shell
const stage = await page.evaluate(() => {
  window.Application.run('Enable Face Robot');
  const host = document.querySelector('.fr-stage1');
  const win = [...document.querySelectorAll('.ppg-float')].find(el =>
    el.querySelector('.ppg-float-title')?.textContent === 'Face Robot Stage 1'
    || el.querySelector('.fr-stage1'));
  const tabs = [...(host?.querySelectorAll('.fr-stage1-lib .fr-tab') ?? [])].map(t => t.textContent.trim());
  const heads = [...(host?.querySelectorAll('.fr-lib-item') ?? [])].map(t => t.textContent.trim());
  const title = host?.querySelector('.fr-stage1-title-text')?.textContent?.trim() ?? null;
  const log = host?.querySelector('.fr-log')?.textContent?.trim() ?? null;
  const scanDisabled = host?.querySelector('.fr-exec-scan')?.disabled ?? null;
  return {
    host: !!host,
    float: !!win,
    category: host?.dataset.siCategory ?? null,
    defaultsize: host?.dataset.siDefaultsize ?? null,
    title,
    tabs,
    heads,
    log,
    scanDisabled,
    enabled: window.__uiAudit?.()?.faceRobot?.faceRobotEnabled,
  };
});

if (!stage.host || !stage.float) diffs.push('Enable Face Robot did not open Stage 1 shell');
else notes.push('Enable Face Robot → Stage 1 Assemble');
if (stage.title !== stage1.view.title) diffs.push(`Stage1 title want=${stage1.view.title} got=${stage.title}`);
else notes.push(`title ${stage.title}`);
if (stage.category !== 'Face Robot') diffs.push(`Stage1 category=${stage.category}`);
else notes.push('Stage1 category=Face Robot');
if (JSON.stringify(stage.tabs) !== JSON.stringify(stage1.library_tabs)) {
  diffs.push(`library tabs want=${stage1.library_tabs.join('|')} got=${(stage.tabs || []).join('|')}`);
} else notes.push('library tabs Heads/Parts/Actor/Custom/Type');
if (JSON.stringify(stage.heads) !== JSON.stringify(stage1.heads_list_attested)) {
  diffs.push(`heads list mismatch count want=${stage1.heads_list_attested.length} got=${(stage.heads || []).length}`);
} else notes.push(`heads list ${stage.heads.length} Desktop-attested`);
if (stage.log !== stage1.log_default) diffs.push(`log want="${stage1.log_default}" got="${stage.log}"`);
else notes.push('log: Pick Objects before Diagnose');
if (stage.scanDisabled !== true) diffs.push('Scan should be grey until pick');
else notes.push('Scan grey until pick');
if (!stage.enabled) diffs.push('faceRobotEnabled false after Enable');
else notes.push('faceRobotEnabled');

// Face Robot Layout command
const layout = await page.evaluate(() => {
  window.Application.run('Face Robot Layout');
  return { host: !!document.querySelector('.fr-stage1'), enabled: window.__uiAudit?.()?.faceRobot?.faceRobotEnabled };
});
if (!layout.host || !layout.enabled) diffs.push('Face Robot Layout failed');
else notes.push('Face Robot Layout OK');

// ShowFaceRobotActPanel
const act = await page.evaluate(() => {
  window.Application.run('ShowFaceRobotActPanel');
  const host = document.querySelector('.fr-act-panel');
  const win = [...document.querySelectorAll('.ppg-float')].find(el =>
    el.querySelector('.ppg-float-title')?.textContent === 'Face Robot Act Floating Panel'
    || el.querySelector('.fr-act-panel'));
  return {
    host: !!host,
    float: !!win,
    category: host?.dataset.siCategory ?? null,
    path: host?.querySelector('.fr-act-path')?.textContent?.includes('FaceRobotContext.htm') ?? false,
  };
});
if (!act.host || !act.float) diffs.push('ShowFaceRobotActPanel did not open Act panel');
else notes.push('ShowFaceRobotActPanel OK');
if (act.category !== 'Face Robot') diffs.push(`Act category=${act.category}`);
else notes.push('Act category=Face Robot');
if (!act.path) diffs.push('Act Path default missing FaceRobotContext.htm');
else notes.push('Act Path default from commands_full');

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
};
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'face-robot-module-last.json'), JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
