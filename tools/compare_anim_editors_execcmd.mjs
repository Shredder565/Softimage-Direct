// Softimage floating Anim editors — ExecuteCommand empty-args open path smoke.
// Usage: node tools/compare_anim_editors_execcmd.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP = path.resolve(__dirname, '../src/data/si/anim_editors_execcmd.json');
const MIRROR = path.resolve(__dirname, '../data/dump/si_anim_editors_execcmd.json');
const HWND = path.resolve(__dirname, '../data/dump/si_anim_hwnd_chrome.json');
const DIRECT = path.resolve(__dirname, '../src/data/si/direct_lock_desktop_close.json');
const PAINT = path.resolve(__dirname, '../src/data/si/anim_client_paint.json');
const PAINT_MIR = path.resolve(__dirname, '../data/dump/si_anim_client_paint.json');

const diffs = [];
const note = [];

for (const p of [DUMP, MIRROR, HWND, DIRECT, PAINT, PAINT_MIR]) {
  if (!fs.existsSync(p)) diffs.push(`missing ${path.basename(p)}`);
}

if (!diffs.length) {
  const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
  const mir = JSON.parse(fs.readFileSync(MIRROR, 'utf8'));
  const hwnd = JSON.parse(fs.readFileSync(HWND, 'utf8'));
  const desk = JSON.parse(fs.readFileSync(DIRECT, 'utf8'));
  const paint = JSON.parse(fs.readFileSync(PAINT, 'utf8'));

  const cmds = ['OpenAnimationMixer', 'OpenAnimationEditor', 'OpenFcurveEditor'];
  for (const c of cmds) {
    if (!dump.commands?.[c]) diffs.push(`dump missing ${c}`);
    if (!mir.commands?.[c]) diffs.push(`mirror missing ${c}`);
    const found = hwnd.enabled_matrix?.empty?.[c]?.found;
    if (found !== true) diffs.push(`anim_hwnd empty.${c}.found expected true got ${found}`);
  }

  if (dump.honest?.['animate.floating_views']?.execute_command_empty_args !== 'DONE') {
    diffs.push('floating_views execcmd expected DONE');
  }
  if (dump.honest?.['animate.floating_views']?.openview !== 'LOCK') {
    diffs.push('floating_views openview expected LOCK');
  }
  if (dump.honest?.['animate.fcurve_mixer_client_paint']?.status !== 'DONE') {
    diffs.push('client paint expected DONE');
  }
  if (dump.honest?.['animate.fcurve_mixer_client_paint']?.wire !== 'HWND_PNG') {
    diffs.push('client paint wire expected HWND_PNG');
  }

  if (desk.honest?.['animate.floating_views']?.status !== 'EXECCMD_DONE') {
    diffs.push(`direct_lock floating_views status expected EXECCMD_DONE got ${desk.honest?.['animate.floating_views']?.status}`);
  }
  if (desk.honest?.['animate.floating_views']?.openview !== 'LOCK') {
    diffs.push('direct_lock openview expected LOCK');
  }
  if (desk.honest?.['animate.fcurve_mixer_client_paint']?.status !== 'DONE') {
    diffs.push('direct_lock paint expected DONE');
  }
  if (desk.honest?.['animate.fcurve_mixer_client_paint']?.wire !== 'HWND_PNG') {
    diffs.push('direct_lock paint wire expected HWND_PNG');
  }

  if (paint.status !== 'DONE' || paint.wire !== 'HWND_PNG') {
    diffs.push(`anim_client_paint status/wire expected DONE/HWND_PNG got ${paint.status}/${paint.wire}`);
  }
  const mixer = paint.views?.['Animation Mixer'];
  const editor = paint.views?.['Animation Editor'];
  const fcurve = paint.views?.['Fcurve Editor'];
  if (!mixer?.menubar?.includes('Mix')) diffs.push('mixer menubar missing Mix (Desktop)');
  if ((mixer?.menubar?.length ?? 0) !== 6) diffs.push(`mixer menubar length want 6 got ${mixer?.menubar?.length}`);
  if ((editor?.menubar?.length ?? 0) < 8) diffs.push('editor menubar expected ≥8 Desktop labels');
  if (editor?.explorer_w_px !== 195) diffs.push(`explorer_w_px want 195 got ${editor?.explorer_w_px}`);
  if (editor?.sha256 !== fcurve?.sha256) diffs.push('51/52 sha256 must match (same HWND)');
  if (JSON.stringify(mixer?.png_px) !== JSON.stringify([1010, 327])) diffs.push('mixer png_px');
  if (JSON.stringify(editor?.png_px) !== JSON.stringify([1056, 327])) diffs.push('editor png_px');

  for (const [label, rel] of [
    ['mixer', mixer?.png],
    ['editor', editor?.png],
    ['fcurve', fcurve?.png],
  ]) {
    const abs = path.resolve(__dirname, '..', rel);
    if (!fs.existsSync(abs)) diffs.push(`missing PNG ${rel}`);
    else {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      const want = label === 'mixer' ? mixer.sha256 : editor.sha256;
      if (hash !== want) diffs.push(`${label} PNG sha256 mismatch`);
    }
  }

  const ov = desk.openview_errors || {};
  if (!Object.keys(ov).length) diffs.push('direct_lock openview_errors empty');
  else note.push(`OpenView LOCK errors=${Object.keys(ov).length}`);

  note.push(`cmds=${cmds.join(',')}; paint DONE HWND_PNG; ExecCmd DONE`);
}

console.log(diffs.length ? 'DIFF' : 'OK', 'anim editors ExecuteCommand open path + client paint');
console.log(JSON.stringify({ note: note.join('; '), diffs }, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/anim-editors-execcmd-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, note }, null, 2));
process.exit(diffs.length ? 1 : 0);
