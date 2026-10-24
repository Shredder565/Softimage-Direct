// Compares our topology operators against meshes recorded from Softimage (data/dump/si_topo_ref.json):
// same 3×3×3 cube, same components (mapped by vertex position), compared as point multisets + polygon histograms.
import { chromium } from 'playwright';
import fs from 'fs';
const ref = JSON.parse(fs.readFileSync(process.argv[2] ?? 'data/dump/si_topo_ref.json', 'utf8'));
const b = await chromium.launch({
  ...(await import('fs')).default.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto('http://localhost:4173/?demo'); await p.waitForTimeout(1000);
const R = (v) => Math.round(v * 1000) / 1000;
const key = (q) => q.map(R).join(',');
const base = ref.base;
const polyKeys = (idx) => idx.map(i => base.polys[i].map(j => key(base.pts[j])).sort().join('|'));
const edgeKeys = (idx) => idx.map(i => base.edges[i].map(j => key(base.pts[j])).sort().join('|'));
const pntKeys = (idx) => idx.map(i => key(base.pts[i]));
const cases = {
  ExtrudeNormal: { preset: 'Extrude Component Along Normal', polys: [0, 1, 2] }, ExtrudeNormal_sub2: { preset: 'Extrude Component Along Normal', polys: [0, 1, 2], set: { subdivs: 2 } }, ExtrudeNormal_inset: { preset: 'Extrude Component Along Normal', polys: [0, 1, 2], set: { inset: 0.3 } },
  Inset: { preset: 'Inset Polygons', polys: [0, 1, 2] }, Bevel: { preset: 'Bevel', polys: [0, 1, 2] }, Bevel_edges: { preset: 'Bevel', edges: [0, 1, 2] },
  Subdiv_plus: { preset: 'Subdivide Polygon', polys: [0, 1, 2] }, Subdiv_diamond: { preset: 'Subdivide Polygon', polys: [0, 1, 2], set: { subdivtype: 1 } }, Subdiv_x: { preset: 'Subdivide Polygon', polys: [0, 1, 2], set: { subdivtype: 2 } }, Subdiv_tri: { preset: 'Subdivide Polygon', polys: [0, 1, 2], set: { subdivtype: 3 } },
  SplitEdge: { preset: 'Split Edge', edges: [0, 1, 2] }, LocalSubdiv: { preset: 'Local Subdivision', polys: [0, 1, 2] }, Dice: { preset: 'Dice Polygons', polys: [0, 1, 2] }, Slice: { preset: 'Slice Polygons', polys: [0, 1, 2] }, Symmetrize: { preset: 'Symmetrize Polygons', polys: [0, 1, 2] },
  Weld: { preset: 'Weld Points', pnts: [0, 1] }, Collapse: { preset: 'Collapse', polys: [0, 1, 2] }, Dissolve: { preset: 'Dissolve Component', polys: [0, 1, 2] }, Disconnect: { preset: 'Disconnect Component', polys: [0, 1, 2] }, Offset: { preset: 'Offset Polygons', polys: [0, 1, 2] },
  Bridge: { preset: 'Bridge Polygon', polys: [0, 26] }, Quadrangulate: { preset: 'Quadrangulate', polys: [0, 1, 2] }, PolyReduction: { preset: 'Polygon Reduction', polys: [] }, Invert: { preset: 'Invert Polygons', polys: [] }, Thickness: { preset: 'Apply Thickness', polys: [] },
};
for (const [name, c] of Object.entries(cases)) {
  const r = ref[name]; if (!r || r.error) { console.log(name.padEnd(20), 'no reference'); continue; }
  const sel = c.polys ? { kind: 'polygon', keys: polyKeys(c.polys) } : c.edges ? { kind: 'edge', keys: edgeKeys(c.edges) } : { kind: 'point', keys: pntKeys(c.pnts) };
  const ours = await p.evaluate(([preset, set, sel]) => {
    const A = window.Application; A.run('NewScene'); const o = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const g = o.primitive.operators[0]; g.set('subdivu', 3); g.set('subdivv', 3); g.set('subdivbase', 3);
    const m = o.primitive.mesh(); const R = (v) => Math.round(v * 1000) / 1000; const key = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]].map(R).join(',');
    let items = [];
    if (sel.kind === 'polygon') items = m.polygons.map((f, i) => [f.map(key).sort().join('|'), i]).filter(([k]) => sel.keys.includes(k)).map(([, i]) => i);
    else if (sel.kind === 'point') { for (let i = 0; i < m.positions.length / 3; i++) if (sel.keys.includes(key(i))) items.push(i); }
    else { const seen = new Set(); for (const f of m.polygons) for (let i = 0; i < f.length; i++) { const a = f[i], b2 = f[(i + 1) % f.length]; const k = [key(a), key(b2)].sort().join('|'); if (sel.keys.includes(k)) { const ek = Math.min(a, b2) + '-' + Math.max(a, b2); if (!seen.has(ek)) { seen.add(ek); items.push(ek); } } } }
    if (items.length || sel.keys.length === 0) { if (items.length) A.selectComponents(o, sel.kind, items); else A.select([o]); }
    let err = null; try { A.run('ApplyTopoOp', { PresetObj: preset }); } catch (e) { err = e.message; }
    const op = A.selection[0]; if (op && op.params) for (const [k, v] of Object.entries(set || {})) op.set(k, v);
    o.primitive.dirty = true; const out = o.primitive.mesh();
    return { err, selected: items.length, pts: Array.from(out.positions), polys: out.polygons.map(f => f.length) };
  }, [c.preset, c.set ?? {}, sel]);
  if (ours.err) { console.log(name.padEnd(20), 'ERROR', ours.err); continue; }
  const siSet = r.pts.map(key).sort(), ourSet = []; for (let i = 0; i < ours.pts.length; i += 3) ourSet.push(key([ours.pts[i], ours.pts[i + 1], ours.pts[i + 2]])); ourSet.sort();
  const cnt = (arr) => { const m = new Map(); for (const k of arr) m.set(k, (m.get(k) || 0) + 1); return m; };
  const a = cnt(siSet), o2 = cnt(ourSet); let common = 0; for (const [k, n] of a) common += Math.min(n, o2.get(k) || 0);
  const hist = (arr) => { const m = {}; for (const n of arr) m[n] = (m[n] || 0) + 1; return JSON.stringify(m); };
  const ptsOK = common === siSet.length && siSet.length === ourSet.length, polyOK = r.polys.length === ours.polys.length && hist(r.polys.map(f => f.length)) === hist(ours.polys);
  console.log(name.padEnd(20), ptsOK && polyOK ? 'OK  ' : 'DIFF', `pts SI ${siSet.length} ours ${ourSet.length} shared ${common} | polys SI ${r.polys.length} ${hist(r.polys.map(f => f.length))} ours ${ours.polys.length} ${hist(ours.polys)} | sel ${ours.selected}`);
}
await b.close();
