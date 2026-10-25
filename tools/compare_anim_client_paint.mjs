// Softimage Anim Mixer / Editor / Fcurve client paint — modules-gdi HWND PNG harness.
// Usage: node tools/compare_anim_client_paint.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAINT = path.resolve(__dirname, '../src/data/si/anim_client_paint.json');
const DIRECT = path.resolve(__dirname, '../src/data/si/direct_lock_desktop_close.json');

const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/local/bin/google-chrome',
  '/opt/google/chrome/chrome',
].filter(Boolean).find(p => fs.existsSync(p));

const diffs = [];
const notes = [];

if (!fs.existsSync(PAINT)) {
  console.error('missing anim_client_paint.json');
  process.exit(2);
}
const paint = JSON.parse(fs.readFileSync(PAINT, 'utf8'));
const desk = JSON.parse(fs.readFileSync(DIRECT, 'utf8'));

if (paint.status !== 'DONE') diffs.push(`status want DONE got ${paint.status}`);
if (paint.wire !== 'HWND_PNG') diffs.push(`wire want HWND_PNG got ${paint.wire}`);
if (desk.honest?.['animate.fcurve_mixer_client_paint']?.status !== 'DONE') {
  diffs.push('direct_lock paint not DONE');
}

const mixer = paint.views['Animation Mixer'];
const editor = paint.views['Animation Editor'];
const fcurve = paint.views['Fcurve Editor'];

for (const [name, v] of [['mixer', mixer], ['editor', editor], ['fcurve', fcurve]]) {
  const abs = path.resolve(__dirname, '..', v.png);
  if (!fs.existsSync(abs)) diffs.push(`missing ${v.png}`);
  else {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    if (hash !== v.sha256) diffs.push(`${name} sha256 mismatch`);
    else notes.push(`${name} PNG sha OK`);
  }
}
if (editor.sha256 !== fcurve.sha256) diffs.push('editor/fcurve sha must match');
else notes.push('51/52 identical HWND');

if (JSON.stringify(mixer.menubar) !== JSON.stringify(['Edit', 'View', 'Track', 'Clip', 'Mix', 'Effect'])) {
  diffs.push(`mixer menubar Desktop mismatch ${mixer.menubar}`);
} else notes.push('mixer menubar Desktop Mix');

if (!editor.menubar?.includes('Explorer') || !editor.menubar?.includes('Keys')) {
  diffs.push('editor menubar missing Explorer/Keys');
} else notes.push(`editor menubar ${editor.menubar.length} labels`);

if (editor.explorer_w_px !== 195) diffs.push('explorer_w_px');
if (editor.mode_combo !== 'Absolute Offset') diffs.push('mode_combo');
if (paint.colors?.time_cursor !== '#ff0000') diffs.push('time_cursor');
if (paint.colors?.clip_bg !== '#9ab49d') diffs.push('clip_bg track green');

if (!CHROME) {
  notes.push('No Chromium — skip live audit');
} else {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
  const page = await b.newPage();
  await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
  await page.waitForTimeout(1000);
  // Open Mixer + Editor so live dataset/menubar are present
  await page.evaluate(() => {
    window.Application?.ExecuteCommand?.('OpenAnimationMixer', []);
    window.Application?.ExecuteCommand?.('OpenAnimationEditor', []);
  });
  await page.waitForTimeout(200);
  const audit = await page.evaluate(() => window.__uiAudit?.());
  await b.close();
  const a = audit?.animClientPaint;
  if (!a) diffs.push('__uiAudit.animClientPaint missing');
  else if (!a.ok) diffs.push(`animClientPaint audit failed: ${JSON.stringify(a)}`);
  else {
    notes.push(`live mixer menubar=${(a.live?.mixerMenubar || []).join('|')}`);
    notes.push(`live fcv mode=${a.live?.fcvMode}`);
    if (a.live?.mixerPaint !== 'DONE') diffs.push(`mixer dataset paint ${a.live?.mixerPaint}`);
    if (a.live?.fcvPaint !== 'DONE') diffs.push(`fcv dataset paint ${a.live?.fcvPaint}`);
    if (!(a.live?.mixerMenubar || []).includes('Mix')) diffs.push('live mixer missing Mix');
    if (a.live?.fcvMode !== 'Absolute Offset') diffs.push(`live mode ${a.live?.fcvMode}`);
    if (a.live?.cursor !== '#ff0000' && a.colors?.cursor !== '#ff0000') {
      // live.cursor is CSS; colors.cursor from dump
    }
    if (a.live?.cursor !== '#ff0000') diffs.push(`live --anim-cursor ${a.live?.cursor}`);
  }
  if (audit?.directLockDesktop?.fcurveMixerClientPaint !== 'DONE') {
    diffs.push(`directLockDesktop paint ${audit?.directLockDesktop?.fcurveMixerClientPaint}`);
  }
  if (audit?.animEditorsExecCmd?.clientPaint !== 'DONE') {
    diffs.push(`animEditorsExecCmd paint ${audit?.animEditorsExecCmd?.clientPaint}`);
  }
}

console.log(diffs.length ? 'DIFF' : 'OK', 'anim client paint HWND_PNG');
console.log(JSON.stringify({ notes, diffs }, null, 2));
const outPath = path.resolve(__dirname, '../docs/screenshots/anim-client-paint-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, notes, diffs }, null, 2));
process.exit(diffs.length ? 1 : 0);
