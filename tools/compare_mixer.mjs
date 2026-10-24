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

console.log(diffs.length ? 'DIFF' : 'OK', 'mixer nested Sources/Tracks/Transitions/Compounds');
console.log(JSON.stringify({ sources: r.sources, tracks: r.tracks.length, transitions: r.transitions, compounds: r.compounds }, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/mixer-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, r }, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
