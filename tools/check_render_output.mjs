// AfterImage Render tab output catalog checks (no browser).
// mp4 default, 2K/4K present, mov rejected.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const diffs = [];
const notes = [];

// propsets (prefs Output Format)
const propsets = JSON.parse(fs.readFileSync(path.join(root, 'src/data/si/propsets.json'), 'utf8'));
const picStd = (propsets.C3DPrefsOutputFormat?.params || []).find(p => p.sn === 'picture_standard');
const labels = Object.fromEntries((picStd?.items || []).map(([l, v]) => [v, l]));
if (!labels[23] || !/2K/i.test(labels[23])) diffs.push(`missing 2K picture_standard: ${labels[23]}`);
else notes.push(`2K=${labels[23]}`);
if (!labels[24] || !/4K/i.test(labels[24])) diffs.push(`missing 4K picture_standard: ${labels[24]}`);
else notes.push(`4K=${labels[24]}`);
for (const sn of ['ir_xres', 'ir_yres']) {
  const p = (propsets.C3DPrefsOutputFormat?.params || []).find(x => x.sn === sn);
  if (Number(p?.uimax) < 3840) diffs.push(`${sn} uimax ${p?.uimax}`);
}

// Softimage SPDL still lists mov — runtime must not surface it. Assert source catalog module.
const src = fs.readFileSync(path.join(root, 'src/core/renderOutput.ts'), 'utf8');
if (!/DEFAULT_RENDER_OUTPUT_FORMAT = 'mp4'/.test(src)) diffs.push('DEFAULT_RENDER_OUTPUT_FORMAT not mp4');
else notes.push('DEFAULT_RENDER_OUTPUT_FORMAT=mp4');
if (!/value: 'mp4'/.test(src)) diffs.push('mp4 not in RENDER_OUTPUT_FORMATS');
if (/value: 'mov'/.test(src) && !/never offer|no mov|drops mov|fmt !== 'mov'|=== 'mov'/.test(src)) {
  // allow references that reject mov, but not offering mov as a catalog value
}
if (/RENDER_OUTPUT_FORMATS[\s\S]*?value: 'mov'/.test(src)) diffs.push('RENDER_OUTPUT_FORMATS offers mov');
else notes.push('RENDER_OUTPUT_FORMATS has no mov');
if (!/2048,\s*height:\s*1080/.test(src) || !/3840,\s*height:\s*2160/.test(src))
  diffs.push('RENDER_RESOLUTION_PRESETS missing 2K/4K sizes');
else notes.push('RENDER_RESOLUTION_PRESETS has 2K+4K');

// Pass wiring
const scene = fs.readFileSync(path.join(root, 'src/core/scene.ts'), 'utf8');
if (!/movieFormatParamDefs/.test(scene)) diffs.push('Pass missing movieFormatParamDefs');
else notes.push('Pass wires movieFormatParamDefs');

const shell = fs.readFileSync(path.join(root, 'src/ui/shell.ts'), 'utf8');
if (!/DEFAULT_RENDER_OUTPUT_FORMAT/.test(shell) || !/Output Format/.test(shell))
  diffs.push('Render Manager missing Output Format UI');
else notes.push('Render Manager Output Format UI present');
if (!/Output Size/.test(shell)) diffs.push('Render Manager missing Output Size UI');
else notes.push('Render Manager Output Size UI present');
if (/\.mov['"]/.test(shell) && /accept.*mov|option.*mov/.test(shell))
  diffs.push('Render Manager still offers .mov');

const out = { ok: diffs.length === 0, diffs, notes };
console.log(JSON.stringify(out, null, 2));
process.exit(diffs.length ? 1 : 0);
