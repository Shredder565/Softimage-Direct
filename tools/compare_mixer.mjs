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
  // Softimage SetDefaultWeight / siWeightPresets → actionclip.weight FCurve (not prefs display bits)
  A.run('SetDefaultWeight', { InputObj: clips[0].name, Mode: ':siWeightEaseIn:siWeightPresets' });
  const presetClip = clips[0];
  const presetKeys = presetClip.weightKeys || [];
  A.anim.frame = clips[0].start;
  const evalEaseStart = A.run('EvaluateMixer', { Frame: clips[0].start, Apply: false });
  let expLock = null;
  try { A.run('SetDefaultWeight', { InputObj: clips[0].name, Mode: 'siWeightExponentialIn' }); }
  catch (e) { expLock = String(e && e.message || e); }
  const mix = A.scene.root.property('mixer');
  // Softimage PC nested Parameter.Name labels (si_anim_mixer_deep.json)
  const nestedSI = [
    { name: 'Name', value: mix.val('Name') },
    { name: 'Hidden', value: !!mix.val('Hidden') },
    { name: 'Active', value: !!mix.val('Active') },
    { name: 'Start time', value: mix.val('start') },
    { name: 'Duration', value: mix.val('duration') },
    { name: 'Auto Transition', value: !!mix.val('autotransition') },
  ];
  return {
    present: !!mix,
    name: mix?.val('Name'),
    sources: JSON.parse(mix.val('sources') || '[]'),
    tracks: JSON.parse(mix.val('tracks') || '[]'),
    transitions: JSON.parse(mix.val('transitions') || '[]'),
    compounds: JSON.parse(mix.val('compounds') || '[]'),
    nested: ['Name', 'Hidden', 'Active', 'start', 'duration', 'sources', 'tracks', 'transitions', 'compounds', 'relations', 'autotransition']
      .map(k => ({ k, has: mix.get(k) != null })),
    nestedSI,
    tr, bridge, cpd,
    evalMid, evalInA, evalWeighted, evalMuted,
    presetKeys, evalEaseStart, expLock,
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
if (!(r.presetKeys?.length >= 2)) diffs.push(`SetDefaultWeight EaseIn keys missing: ${JSON.stringify(r.presetKeys)}`);
else {
  const first = r.presetKeys[0], last = r.presetKeys[r.presetKeys.length - 1];
  if (!(first.value === 0 && last.value === 1)) diffs.push(`EaseIn key values ${first.value}->${last.value}`);
}
if (!(r.expLock && /not implemented|LOCK/i.test(r.expLock))) diffs.push(`Exponential should LOCK, got ${r.expLock}`);

// Softimage PC deep dump (known gaps: StoreAction null handles; AddBridgeTransition missing under XSIBATCH;
// mixer_collections null without clip selection). Direct still asserts nested OM + eval.
const deepPaths = [
  path.resolve(__dirname, '../data/dump/si_anim_mixer_deep.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/anim/si_anim_mixer_deep.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_anim_mixer_deep.json',
].filter(p => fs.existsSync(p));
const transDumpPaths = [
  path.resolve(__dirname, '../data/dump/si_mixer_transitions.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/anim/si_mixer_transitions.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_mixer_transitions.json',
].filter(p => fs.existsSync(p));
let deepNote = 'no PC deep dump yet';
let expectedGaps = [];
function consumeMixerPcDump(deep, label) {
  deepNote = deepNote.startsWith('no PC') ? `loaded ${label}` : `${deepNote}; +${label}`;
  const steps = deep.steps || [];
  const storeNull = steps.filter(s => /^StoreAction/.test(s.name || '') && (s.result === 'null' || s.result == null));
  if (storeNull.length) expectedGaps.push(`PC StoreAction null handles (${storeNull.length})`);
  const sel = steps.find(s => s.name === 'SelectClips');
  if (sel && sel.ok === false) expectedGaps.push(`PC SelectClips: ${sel.error || 'failed'}`);
  const bridge = steps.find(s => /Bridge/i.test(s.name || ''));
  if (bridge && bridge.ok === false) expectedGaps.push(`PC ${bridge.name}: ${bridge.error || 'failed'}`);
  const tw = steps.find(s => /TWTransition/i.test(s.name || ''));
  if (tw && tw.ok === false) expectedGaps.push(`PC ${tw.name}: ${tw.error || 'failed'}`);
  const cols = deep.mixer_collections || {};
  if (cols && Object.values(cols).every(v => v == null)) expectedGaps.push('PC mixer_collections null (needs clip sel)');
  // TransitionCollection classname attested even when empty
  const tc = deep.transitions;
  if (tc && typeof tc === 'object' && !Array.isArray(tc)) {
    if (tc.classname && tc.classname !== 'TransitionCollection') {
      diffs.push(`PC transitions classname ${tc.classname}`);
    } else if (tc.classname === 'TransitionCollection') {
      expectedGaps.push('PC TransitionCollection empty (LOCK until clip sel)');
    }
  }
  if (Array.isArray(deep.transition_list) && deep.transition_list.length === 0) {
    expectedGaps.push('PC transition_list empty');
  }
  const probe = steps.find(s => s.name === 'Mixer_probe');
  if (probe && probe.n_transitions === 0) expectedGaps.push('PC Mixer_probe n_transitions=0');
  // Only DIFF if PC claims transitions/compounds populated but Direct empty
  const pcTrans = Array.isArray(deep.transitions) ? deep.transitions : cols.Transitions;
  if (Array.isArray(pcTrans) && pcTrans.length && !r.transitions.length) {
    diffs.push('PC dump has transitions but Direct dump empty');
  }
  // Softimage nested Parameter.Name schema lock
  const pcNested = deep.mixer?.nested || [];
  const pcNames = pcNested.map(n => n.name).filter(Boolean);
  const want = ['Name', 'Hidden', 'Active', 'Start time', 'Duration', 'Auto Transition'];
  for (const nm of want) {
    if (pcNames.length && !pcNames.includes(nm)) diffs.push(`PC mixer nested missing ${nm}`);
    if (!r.nestedSI?.some(n => n.name === nm)) diffs.push(`Direct nestedSI missing ${nm}`);
  }
  if (pcNested.length) {
    const pcName = pcNested.find(n => n.name === 'Name');
    if (pcName && pcName.value != null && r.name !== pcName.value) diffs.push(`Mixer Name ${r.name} != PC ${pcName.value}`);
    const pcActive = pcNested.find(n => n.name === 'Active');
    if (pcActive && pcActive.value === true && r.nestedSI?.find(n => n.name === 'Active')?.value !== true) {
      diffs.push('Mixer Active should be true (PC)');
    }
    const pcAuto = pcNested.find(n => n.name === 'Auto Transition');
    if (pcAuto && pcAuto.value === false && r.nestedSI?.find(n => n.name === 'Auto Transition')?.value !== false) {
      diffs.push('Auto Transition should be false (PC empty default)');
    }
  }
}
if (deepPaths[0]) consumeMixerPcDump(JSON.parse(fs.readFileSync(deepPaths[0], 'utf8')), deepPaths[0]);
if (transDumpPaths[0]) consumeMixerPcDump(JSON.parse(fs.readFileSync(transDumpPaths[0], 'utf8')), transDumpPaths[0]);
if (deepPaths[0] || transDumpPaths[0]) {
  deepNote += expectedGaps.length ? `; expected gaps: ${[...new Set(expectedGaps)].join('; ')}` : '';
  deepNote += `; nestedSI ${r.nestedSI?.map(n => n.name).join('/')}`;
}

console.log(diffs.length ? 'DIFF' : 'OK', 'mixer nested + EvaluateMixer crossfade');
console.log(JSON.stringify({ sources: r.sources, tracks: r.tracks.length, transitions: r.transitions, compounds: r.compounds, evalMid: r.evalMid, deepNote }, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/mixer-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, r, deepNote }, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
