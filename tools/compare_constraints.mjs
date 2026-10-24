// Softimage Direct constraint fidelity smoke (path perc, symmetry, compensate, toggle).
// Needs `vite preview` on :4173. Usage: node tools/compare_constraints.mjs
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
await page.evaluate(() => { window.prompt = (_m, d) => d ?? '1'; window.confirm = () => true; });

const r = await page.evaluate(() => {
  const A = window.Application;
  A.run('NewScene');
  // Position + compensate
  A.run('GetPrim', { PresetObj: 'Null', Name: 'driver' });
  A.run('GetPrim', { PresetObj: 'Null', Name: 'driven' });
  const driver = A.scene.find('driver'); const driven = A.scene.find('driven');
  driver.kinematics.local.set('posx', 5); driver.kinematics.local.set('posy', 0);
  driven.kinematics.local.set('posx', 1); driven.kinematics.local.set('posy', 2);
  A.select([driven, driver]);
  A.run('ApplyCns', { Preset: 'Position', Compensate: true });
  const posAfter = { x: driven.globalMatrix().elements[12], y: driven.globalMatrix().elements[13] };
  // Path constraint
  A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' });
  const curve = [...A.scene.allObjects()].find(o => o.primitive?.curve());
  A.run('GetPrim', { PresetObj: 'Null', Name: 'onpath' });
  const onpath = A.scene.find('onpath');
  A.select([onpath, curve]);
  A.run('ApplyCns', { Preset: 'Path' });
  const cns = onpath.properties.find(p => p.get('perc'));
  cns.set('perc', 25);
  const p25 = { x: onpath.globalMatrix().elements[12], z: onpath.globalMatrix().elements[14] };
  cns.set('perc', 75);
  const p75 = { x: onpath.globalMatrix().elements[12], z: onpath.globalMatrix().elements[14] };
  // Symmetry
  A.run('GetPrim', { PresetObj: 'Null', Name: 'src' });
  A.run('GetPrim', { PresetObj: 'Null', Name: 'mir' });
  const src = A.scene.find('src'); const mir = A.scene.find('mir');
  src.kinematics.local.set('posx', 3); src.kinematics.local.set('posy', 1);
  A.select([mir, src]);
  A.run('ApplyCns', { Preset: 'Symmetry' });
  const mirPos = { x: mir.globalMatrix().elements[12], y: mir.globalMatrix().elements[13] };
  // Toggle
  const nOff = A.run('DeactivateConstraint', { InputObjs: 'mir' });
  const inactive = mir.properties.find(p => p.type === 'poscns')?.val('active');
  // Bounding volume
  A.run('GetPrim', { PresetObj: 'Null', Name: 'box' });
  A.run('GetPrim', { PresetObj: 'Null', Name: 'inside' });
  const box = A.scene.find('box'); const inside = A.scene.find('inside');
  box.set('size', 2); inside.kinematics.local.set('posx', 10);
  A.select([inside, box]);
  A.run('ApplyCns', { Preset: 'Bounding Volume' });
  const clamped = { x: inside.globalMatrix().elements[12] };
  // Bounding plane
  A.run('GetPrim', { PresetObj: 'Null', Name: 'plane' });
  A.run('GetPrim', { PresetObj: 'Null', Name: 'above' });
  const plane = A.scene.find('plane'); const above = A.scene.find('above');
  plane.kinematics.local.set('posy', 0); above.kinematics.local.set('posy', 5);
  A.select([above, plane]);
  A.run('ApplyCns', { Preset: 'Bounding Plane' });
  const onPlane = { y: above.globalMatrix().elements[13] };
  return { posAfter, p25, p75, mirPos, nOff, inactive, pathHasPerc: !!cns, clamped, onPlane };
});

const diffs = [];
if (Math.abs(r.posAfter.x - 1) > 0.05 || Math.abs(r.posAfter.y - 2) > 0.05) diffs.push(`compensate pose drifted ${JSON.stringify(r.posAfter)}`);
if (!r.pathHasPerc) diffs.push('path cns missing perc');
if (!(Math.hypot(r.p25.x - r.p75.x, r.p25.z - r.p75.z) > 0.5)) diffs.push(`path perc did not move object ${JSON.stringify({ p25: r.p25, p75: r.p75 })}`);
if (Math.abs(r.mirPos.x - (-3)) > 0.05) diffs.push(`symmetry x ${r.mirPos.x} != -3`);
if (r.inactive !== false) diffs.push(`deactivate active=${r.inactive}`);
if (!(Math.abs(r.clamped.x) <= 1.05)) diffs.push(`bounding volume clamp x=${r.clamped.x}`);
if (Math.abs(r.onPlane.y) > 0.05) diffs.push(`bounding plane y=${r.onPlane.y}`);

console.log(diffs.length ? 'DIFF' : 'OK', 'constraints path/symmetry/compensate/toggle/bounds');
console.log(JSON.stringify(r, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/constraints-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, r }, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
