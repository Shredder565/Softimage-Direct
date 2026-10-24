// Compares our deformers against vertex positions recorded from Softimage (data/dump/si_deform_ref.json).
// Needs `vite preview` on :4173. Usage: node tools/compare_deformers.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const ref = JSON.parse(fs.readFileSync(new URL('../data/dump/si_deform_ref.json', import.meta.url), 'utf8'));
const chromeBin = ['/opt/pw-browsers/chromium', '/usr/local/bin/google-chrome', '/opt/google/chrome/chrome'].find(p => fs.existsSync(p));
const b = await chromium.launch({ ...(chromeBin ? { executablePath: chromeBin } : {}), args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto('http://localhost:4173/?demo'); await p.waitForTimeout(1000);
const cases = { Twist: {}, Bend: {}, Taper: {}, Bulge: {}, Shear: {}, Push_1: { preset: 'Push', set: { ampl: 1 } }, Smooth: {}, Relax: {}, Fold: {}, Twist_Y: { preset: 'Twist', set: { axis: 1 } }, Bend_bottom: { preset: 'Bend', set: { bottom: true } }, Bend_dir90: { preset: 'Bend', set: { dir: 90 } }, Taper_neg: { preset: 'Taper', set: { ampl: -0.5 } } };
for (const [name, c] of Object.entries(cases)) {
  const r = ref[name]; if (!r) continue;
  const base = ref[c.preset ?? name]?.base ?? ref.Twist.base;
  const ours = await p.evaluate(([preset, set]) => {
    const A = window.Application; A.run('NewScene'); const o = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const g = o.primitive.operators[0]; g.set('subdivu', 4); g.set('subdivv', 4); g.set('subdivbase', 4);
    const basePts = Array.from(o.primitive.mesh().positions);
    A.run('ApplyOp', { PresetObj: preset }); const op = A.selection[0]; for (const [k, v] of Object.entries(set || {})) op.set(k, v);
    o.primitive.dirty = true; const m = o.primitive.mesh(); return { base: basePts, def: Array.from(m.positions) };
  }, [c.preset ?? name, c.set ?? {}]);
  // map SI base vertices to ours by position
  const key = (x, y, z) => [x, y, z].map(v => Math.round(v * 1000) / 1000).join(',');
  const idx = new Map(); for (let i = 0; i < ours.base.length; i += 3) idx.set(key(ours.base[i], ours.base[i + 1], ours.base[i + 2]), i / 3);
  let maxd = 0, sum = 0, n = 0, worst = null;
  for (let i = 0; i < base.length; i++) {
    const j = idx.get(key(...base[i])); if (j === undefined) continue;
    const a = r.deformed[i], o = [ours.def[j * 3], ours.def[j * 3 + 1], ours.def[j * 3 + 2]];
    const d = Math.hypot(a[0] - o[0], a[1] - o[1], a[2] - o[2]); sum += d; n++; if (d > maxd) { maxd = d; worst = { base: base[i], si: a.map(v => +v.toFixed(3)), ours: o.map(v => +v.toFixed(3)) }; }
  }
  console.log(name.padEnd(12), 'matched', n, 'mean', (sum / n).toFixed(3), 'max', maxd.toFixed(3), maxd < 0.05 ? 'OK' : 'DIFF', maxd >= 0.05 ? JSON.stringify(worst) : '');
}
await b.close();
