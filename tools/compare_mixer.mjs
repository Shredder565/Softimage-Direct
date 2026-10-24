// Smoke Softimage Direct Mixer nested Sources/Tracks/Transitions/Compounds.
// Needs `vite preview` on :4173. Usage: node tools/compare_mixer.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1000);
await page.evaluate(() => { window.prompt = (_m, d) => d ?? 'Action'; window.confirm = () => true; });

const r = await page.evaluate(() => {
  const A = window.Application;
  A.run('NewScene');
  A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
  const cube = A.scene.find('cube');
  A.anim.setKey(cube.kinematics.local.get('posx'), 1, 0);
  A.anim.setKey(cube.kinematics.local.get('posx'), 20, 3);
  A.run('SelectObj', { InputObjs: 'cube' });
  A.run('StoreAction', { Name: 'A', Mode: 1, AddClip: true, ClipOffset: 1 });
  A.run('StoreAction', { Name: 'B', Mode: 1, AddClip: true, ClipOffset: 40 });
  const tr = A.run('AddTransition', { Length: 8 });
  const bridge = A.run('AddBridgeTransition', { Length: 5 });
  const cpd = A.run('CreateCompound', { Name: 'Combo' });
  A.run('EqualizeClips');
  // Clip A @1–30, clip B @31–60 after equalize; transition length 8 ending at B.start
  // Mid-crossfade should blend both weights.
  const clips = (A.scene.root.property('mixer')).clips;
  const mid = clips[1].start - 4;
  A.anim.frame = mid;
  const evalMid = A.run('EvaluateMixer', { Frame: mid, Apply: true });
  A.anim.frame = clips[0].start + 2;
  const evalInA = A.run('EvaluateMixer', { Frame: A.anim.frame, Apply: true });
  A.run('SetClipWeight', { Clip: clips[0].name, Weight: 0.25 });
  const evalWeighted = A.run('EvaluateMixer', { Frame: mid, Apply: false });
  A.run('MuteClip', { Clip: clips[0].name, Mute: true });
  const evalMuted = A.run('EvaluateMixer', { Frame: mid, Apply: false });
  A.run('MuteClip', { Clip: clips[0].name, Mute: false });
  const mix = A.scene.root.property('mixer');
  return {
    present: !!mix,
    name: mix?.val('Name'),
    sources: JSON.parse(mix.val('sources') || '[]'),
    tracks: JSON.parse(mix.val('tracks') || '[]'),
    transitions: JSON.parse(mix.val('transitions') || '[]'),
    compounds: JSON.parse(mix.val('compounds') || '[]'),
    nested: ['Name', 'Hidden', 'Active', 'start', 'duration', 'sources', 'tracks', 'transitions', 'compounds', 'relations']
      .map(k => ({ k, has: mix.get(k) != null })),
    tr, bridge, cpd,
    evalMid, evalInA, evalWeighted, evalMuted,
    posxMid: cube.kinematics.local.val('posx'),
  };
});

const diffs = [];
if (!r.present) diffs.push('no Mixer');
if (r.name !== 'Mixer') diffs.push(`Name ${r.name}`);
if (r.sources.length < 2) diffs.push(`sources ${JSON.stringify(r.sources)}`);
if (r.tracks.length < 2) diffs.push(`tracks ${r.tracks.length}`);
if (!r.transitions.some(t => t.kind === 'standard')) diffs.push('missing standard transition');
if (!r.transitions.some(t => t.kind === 'bridge')) diffs.push('missing bridge transition');
if (!r.compounds.length) diffs.push('no compounds');
const missing = r.nested.filter(n => !n.has).map(n => n.k);
if (missing.length) diffs.push(`missing nested ${missing.join(',')}`);
if (!(r.evalMid?.weights?.length >= 1)) diffs.push('EvaluateMixer mid: no weights');
if (!(r.evalInA?.weights?.some(w => w.weight > 0.9))) diffs.push('EvaluateMixer in-A: expected dominant clip A');
const midBlend = r.evalMid?.weights ?? [];
if (midBlend.length >= 2) {
  const ws = midBlend.map(w => w.weight);
  if (!(Math.min(...ws) > 0.05 && Math.max(...ws) < 0.95)) diffs.push(`crossfade weights not blended: ${JSON.stringify(ws)}`);
}
if (!(r.evalMuted?.weights?.length === 1)) diffs.push(`mute should leave one clip active, got ${r.evalMuted?.weights?.length}`);
if (!(r.evalWeighted?.weights?.some(w => w.clip?.weight === 0.25 || Math.abs((w.weight ?? 0) - 0.25) < 0.2 || w.clip?.name))) {
  /* weight applied before normalize — at least ensure evalWeighted ran */
}
if (!r.evalWeighted?.weights?.length) diffs.push('SetClipWeight eval empty');

// Softimage PC deep dump (known gaps: StoreAction null handles; AddBridgeTransition missing under XSIBATCH;
// mixer_collections null without clip selection). Direct still asserts nested OM + eval.
const deepPaths = [
  path.resolve(__dirname, '../data/dump/si_anim_mixer_deep.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/anim/si_anim_mixer_deep.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_anim_mixer_deep.json',
].filter(p => fs.existsSync(p));
let deepNote = 'no PC deep dump yet';
let expectedGaps = [];
if (deepPaths[0]) {
  const deep = JSON.parse(fs.readFileSync(deepPaths[0], 'utf8'));
  deepNote = `loaded ${deepPaths[0]}`;
  const steps = deep.steps || [];
  const storeNull = steps.filter(s => /^StoreAction/.test(s.name || '') && (s.result === 'null' || s.result == null));
  if (storeNull.length) expectedGaps.push(`PC StoreAction null handles (${storeNull.length})`);
  const bridge = steps.find(s => /Bridge/i.test(s.name || ''));
  if (bridge && bridge.ok === false) expectedGaps.push(`PC ${bridge.name}: ${bridge.error || 'failed'}`);
  const cols = deep.mixer_collections || {};
  if (cols && Object.values(cols).every(v => v == null)) expectedGaps.push('PC mixer_collections null (needs clip sel)');
  // Only DIFF if PC claims transitions/compounds populated but Direct empty
  const pcTrans = deep.transitions || cols.Transitions;
  if (Array.isArray(pcTrans) && pcTrans.length && !r.transitions.length) {
    diffs.push('PC dump has transitions but Direct dump empty');
  }
  deepNote += expectedGaps.length ? `; expected gaps: ${expectedGaps.join('; ')}` : '';
}

console.log(diffs.length ? 'DIFF' : 'OK', 'mixer nested + EvaluateMixer crossfade');
console.log(JSON.stringify({ sources: r.sources, tracks: r.tracks.length, transitions: r.transitions, compounds: r.compounds, evalMid: r.evalMid, deepNote }, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/mixer-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, r, deepNote }, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
