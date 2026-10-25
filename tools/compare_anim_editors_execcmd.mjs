// Softimage floating Anim editors — ExecuteCommand empty-args open path smoke.
// Usage: node tools/compare_anim_editors_execcmd.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP = path.resolve(__dirname, '../src/data/si/anim_editors_execcmd.json');
const MIRROR = path.resolve(__dirname, '../data/dump/si_anim_editors_execcmd.json');
const HWND = path.resolve(__dirname, '../data/dump/si_anim_hwnd_chrome.json');
const DIRECT = path.resolve(__dirname, '../src/data/si/direct_lock_desktop_close.json');

const diffs = [];
const note = [];

for (const p of [DUMP, MIRROR, HWND, DIRECT]) {
  if (!fs.existsSync(p)) diffs.push(`missing ${path.basename(p)}`);
}

if (!diffs.length) {
  const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
  const mir = JSON.parse(fs.readFileSync(MIRROR, 'utf8'));
  const hwnd = JSON.parse(fs.readFileSync(HWND, 'utf8'));
  const desk = JSON.parse(fs.readFileSync(DIRECT, 'utf8'));

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
  if (dump.honest?.['animate.fcurve_mixer_client_paint']?.status !== 'LOCK') {
    diffs.push('client paint expected LOCK');
  }

  if (desk.honest?.['animate.floating_views']?.status !== 'EXECCMD_DONE') {
    diffs.push(`direct_lock floating_views status expected EXECCMD_DONE got ${desk.honest?.['animate.floating_views']?.status}`);
  }
  if (desk.honest?.['animate.floating_views']?.openview !== 'LOCK') {
    diffs.push('direct_lock openview expected LOCK');
  }
  if (desk.honest?.['animate.fcurve_mixer_client_paint']?.status !== 'LOCK') {
    diffs.push('direct_lock paint expected LOCK');
  }

  const ov = desk.openview_errors || {};
  if (!Object.keys(ov).length) diffs.push('direct_lock openview_errors empty');
  else note.push(`OpenView LOCK errors=${Object.keys(ov).length}`);

  note.push(`cmds=${cmds.join(',')}; paint LOCK; ExecCmd DONE`);
}

console.log(diffs.length ? 'DIFF' : 'OK', 'anim editors ExecuteCommand open path');
console.log(JSON.stringify({ note: note.join('; '), diffs }, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/anim-editors-execcmd-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, note }, null, 2));
process.exit(diffs.length ? 1 : 0);
