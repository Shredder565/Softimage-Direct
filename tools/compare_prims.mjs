// Compare Softimage Direct polygon-mesh primitive defaults vs PC golden
// data/dump/si_model_prims.json (from softimage-pc XSIBATCH si_model_goldens_dump.js).
// Needs vite preview on :4173. Usage: node tools/compare_prims.mjs [path-to-golden]
import { chromium } from 'playwright';
import fs from 'fs';

const goldenPath = process.argv[2] ?? 'data/dump/si_model_prims.json';
const pack = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
const prims = (pack.primitives ?? []).filter(p => p.ok && p.mesh?.pts?.length);

const chrome =
  ['/opt/pw-browsers/chromium', '/usr/local/bin/google-chrome', '/opt/google/chrome/chrome']
    .find(p => fs.existsSync(p));
const b = await chromium.launch({
  ...(chrome ? { executablePath: chrome } : {}),
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(900);

const R = (v) => Math.round(v * 1000) / 1000;
const key = (q) => q.map(R).join(',');
const hist = (arr) => { const m = {}; for (const n of arr) m[n] = (m[n] || 0) + 1; return m; };
const histEq = (a, b) => { const A = hist(a), B = hist(b); const keys = new Set([...Object.keys(A), ...Object.keys(B)]); for (const k of keys) if (A[k] !== B[k]) return false; return true; };

let okN = 0, failN = 0, skipN = 0;
for (const p of prims) {
  if (p.geom !== 'MeshSurface') { skipN++; console.log(String(p.kind).padEnd(12), 'SKIP non-mesh'); continue; }
  const si = p.mesh;
  const ours = await page.evaluate((kind) => {
    const A = window.Application;
    A.run('NewScene');
    const o = A.run('CreatePrim', { PresetObj: kind, GeometryType: 'MeshSurface' });
    const g = o.primitive.operators[0];
    const subdiv = {
      subdivu: g.get('subdivu')?.value ?? g.val?.('subdivu'),
      subdivv: g.get('subdivv')?.value ?? g.val?.('subdivv'),
      subdivbase: g.get('subdivbase')?.value ?? g.val?.('subdivbase'),
    };
    const m = o.primitive.mesh();
    const pts = [];
    for (let i = 0; i < m.positions.length; i += 3) pts.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
    return { pts, polys: m.polygons.map(f => f.length), subdiv, npts: pts.length, npolys: m.polygons.length };
  }, p.kind);

  const siSet = si.pts.map(key).sort();
  const ourSet = ours.pts.map(key).sort();
  const cnt = (arr) => { const m = new Map(); for (const k of arr) m.set(k, (m.get(k) || 0) + 1); return m; };
  const a = cnt(siSet), o2 = cnt(ourSet);
  let common = 0; for (const [k, n] of a) common += Math.min(n, o2.get(k) || 0);
  const ptsOK = common === siSet.length && siSet.length === ourSet.length;
  const polyOK = si.polys.length === ours.polys.length && histEq(si.polys.map(f => f.length), ours.polys);
  const subdivOK =
    (p.subdivu == null || Number(ours.subdiv.subdivu) === Number(p.subdivu)) &&
    (p.subdivv == null || Number(ours.subdiv.subdivv) === Number(p.subdivv)) &&
    (p.subdivbase == null || Number(ours.subdiv.subdivbase) === Number(p.subdivbase));

  const pass = ptsOK && polyOK && subdivOK;
  if (pass) okN++; else failN++;
  console.log(
    String(p.kind).padEnd(12),
    pass ? 'OK  ' : 'DIFF',
    `pts SI ${siSet.length} ours ${ourSet.length} shared ${common}`,
    `| polys SI ${si.npolys ?? si.polys.length} ours ${ours.npolys}`,
    `| subdiv SI ${p.subdivu}/${p.subdivv}/${p.subdivbase ?? '-'} ours ${ours.subdiv.subdivu}/${ours.subdiv.subdivv}/${ours.subdiv.subdivbase ?? '-'}`,
  );
}

console.log(`\ncompare_prims: ${okN} OK / ${failN} DIFF / ${skipN} SKIP (of ${prims.length} mesh+ok goldens)`);
await b.close();
process.exit(failN ? 1 : 0);
