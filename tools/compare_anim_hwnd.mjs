// Softimage Anim HWND chrome dump smoke (Command.Enabled + OpenView LOCK).
// Usage: node tools/compare_anim_hwnd.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP = [
  path.resolve(__dirname, '../data/dump/si_anim_hwnd_chrome.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/anim/si_anim_hwnd_chrome.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_anim_hwnd_chrome.json',
].find(p => fs.existsSync(p));
const MATRIX = path.resolve(__dirname, '../src/data/si/mcp_enabled_matrix.json');
const SHOTS = [
  path.resolve(__dirname, '../docs/screenshots/overnight-desktop/si-anim-hwnd-chrome.png'),
  path.resolve(__dirname, '../docs/screenshots/overnight-desktop/si-anim-desktop-fullscreen.png'),
];

const diffs = [];
if (!DUMP) diffs.push('si_anim_hwnd_chrome.json missing');
if (!fs.existsSync(MATRIX)) diffs.push('mcp_enabled_matrix.json missing');
for (const s of SHOTS) if (!fs.existsSync(s)) diffs.push(`screenshot missing ${path.basename(s)}`);

let note = '';
if (DUMP && fs.existsSync(MATRIX)) {
  const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
  const mat = JSON.parse(fs.readFileSync(MATRIX, 'utf8'));
  note = `dump ${DUMP}`;
  const acc = dump.acceptance || {};
  if (acc.has_enabled_matrix !== true) diffs.push('acceptance.has_enabled_matrix != true');
  const wantCtx = ['empty', 'keyed_null', 'mesh_skeleton'];
  for (const c of wantCtx) {
    if (!(acc.contexts || []).includes(c)) diffs.push(`acceptance.contexts missing ${c}`);
  }
  if (acc.n_views_opened !== 0) diffs.push(`n_views_opened ${acc.n_views_opened}`);
  if (acc.openview_api_avoided !== true && acc.openview_av_after_commands !== true) {
    diffs.push('expected OpenView avoided/AV lock flag');
  } else {
    note += '; OpenView API avoided/LOCK';
  }
  const probe = dump.view_probe || [];
  if (probe.some(v => v && v.open_ok === true)) {
    diffs.push('view_probe has open_ok — unexpected without invent');
  } else {
    note += `; view_probe ${probe.length} failed (no invent)`;
  }

  const want = ['StoreAction', 'AddClip', 'AddTransition', 'CreateCompound'];
  for (const ctx of wantCtx) {
    const row = dump.enabled_matrix?.[ctx] || {};
    for (const cmd of want) {
      if (row[cmd]?.enabled !== true) diffs.push(`dump ${ctx}.${cmd} != true`);
    }
    const mctx = mat.contexts?.[ctx];
    if (!mctx) diffs.push(`matrix missing context ${ctx}`);
    else {
      for (const cmd of want) {
        if (mctx.commands?.[cmd] !== true) diffs.push(`matrix ${ctx}.${cmd} != true`);
      }
    }
  }
  const overlay = mat.meta?.anim_hwnd_overlay;
  if (!overlay) diffs.push('matrix meta.anim_hwnd_overlay missing');
  else {
    note += `; overlay attested=${overlay.attested_command_bools} nulls=${overlay.null_command_cells}`;
    if (overlay.attested_command_bools !== 12) diffs.push(`overlay attested ${overlay.attested_command_bools} != 12`);
  }
  for (const cmd of ['OpenAnimationEditor', 'OpenAnimationMixer', 'SaveKey']) {
    const en = dump.enabled_matrix?.empty?.[cmd]?.enabled;
    if (en !== null && en !== undefined) diffs.push(`dump empty.${cmd} expected null, got ${en}`);
  }
}

console.log(diffs.length ? 'DIFF' : 'OK', 'anim HWND chrome Command.Enabled + OpenView LOCK');
console.log(JSON.stringify({ note, diffs }, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/anim-hwnd-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, note }, null, 2));
process.exit(diffs.length ? 1 : 0);
