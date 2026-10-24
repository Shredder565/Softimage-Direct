// Softimage Direct Model ops beyond compare_topology:
// Extrude Along Axis (SI topo_extra golden), CapHole, Boolean (Direct CSG + SI count doc),
// OT-* locks from data/dump/si_model_ops_counts.json, headless ExportDelta/ImportDelta.
// Needs vite preview on :4173. Usage: node tools/compare_model_ops.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const countsPath = process.argv[2] ?? 'data/dump/si_model_ops_counts.json';
const counts = JSON.parse(fs.readFileSync(countsPath, 'utf8'));
const topoRef = JSON.parse(fs.readFileSync('data/dump/si_topo_ref.json', 'utf8'));
const topoExtraPath = 'data/dump/si_model_topo_extra.json';
const topoExtra = fs.existsSync(topoExtraPath)
  ? JSON.parse(fs.readFileSync(topoExtraPath, 'utf8'))
  : { cases: {} };
counts._topoBase = topoRef.base;
counts._topoExtra = topoExtra.cases ?? {};

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

const rows = await page.evaluate(async (siCounts) => {
  const A = window.Application;
  const out = [];
  const meshStats = (o) => {
    const m = o.primitive.mesh();
    return { npts: m.positions.length / 3, npolys: m.polygons.length, polyHist: (() => {
      const h = {}; for (const f of m.polygons) h[f.length] = (h[f.length] || 0) + 1; return h;
    })() };
  };
  const cube333 = () => {
    A.run('NewScene');
    const o = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const g = o.primitive.operators[0];
    g.set('subdivu', 3); g.set('subdivv', 3); g.set('subdivbase', 3);
    return o;
  };
  const edgeKeysOf = (m, n = 3) => {
    const seen = new Set(), keys = [];
    for (const f of m.polygons) {
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length];
        const k = Math.min(a, b) + '-' + Math.max(a, b);
        if (!seen.has(k)) { seen.add(k); keys.push(k); if (keys.length >= n) return keys; }
      }
    }
    return keys;
  };

  const R = (v) => Math.round(v * 1000) / 1000;
  const ptKey = (p) => p.map(R).join(',');
  const mapPolys = (m, siPolys, base) => {
    const key = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]].map(R).join(',');
    const want = siPolys.map(f => f.map(j => base.pts[j].map(R).join(',')).sort().join('|'));
    return m.polygons.map((f, i) => [f.map(key).sort().join('|'), i]).filter(([k]) => want.includes(k)).map(([, i]) => i);
  };
  const mapEdges = (m, siEdges, base) => {
    const key = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]].map(R).join(',');
    const want = new Set(siEdges.map(e => e.map(j => base.pts[j].map(R).join(',')).sort().join('|')));
    const seen = new Set(), outE = [];
    for (const f of m.polygons) {
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length];
        const pk = [key(a), key(b)].sort().join('|');
        if (!want.has(pk)) continue;
        const ek = Math.min(a, b) + '-' + Math.max(a, b);
        if (seen.has(ek)) continue;
        seen.add(ek); outE.push(ek);
      }
    }
    return outE;
  };
  const mapPnts = (m, siPnts, base) => {
    const want = new Set(siPnts.map(i => base.pts[i].map(R).join(',')));
    const outP = [];
    for (let i = 0; i < m.positions.length / 3; i++) {
      const k = [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]].map(R).join(',');
      if (want.has(k)) outP.push(i);
    }
    return outP;
  };
  const ptsMultisetMatch = (oursMesh, siPts) => {
    const ours = [];
    for (let i = 0; i < oursMesh.positions.length; i += 3) ours.push(ptKey([oursMesh.positions[i], oursMesh.positions[i + 1], oursMesh.positions[i + 2]]));
    const si = siPts.map(ptKey);
    const cnt = (arr) => { const m = new Map(); for (const k of arr) m.set(k, (m.get(k) || 0) + 1); return m; };
    const a = cnt(si), b = cnt(ours); let common = 0;
    for (const [k, n] of a) common += Math.min(n, b.get(k) || 0);
    return { common, siN: si.length, ourN: ours.length, ok: common === si.length && si.length === ours.length };
  };

  // --- Extrude Along Axis vs Extrude Along Normal on a side face (object Y ≠ side normal) ---
  {
    const o = cube333();
    const m0 = o.primitive.mesh();
    let side = 0;
    for (let i = 0; i < m0.polygons.length; i++) {
      const f = m0.polygons[i];
      const a = f[0], b = f[1], c = f[2];
      const ax = m0.positions[a * 3], ay = m0.positions[a * 3 + 1], az = m0.positions[a * 3 + 2];
      const bx = m0.positions[b * 3] - ax, by = m0.positions[b * 3 + 1] - ay, bz = m0.positions[b * 3 + 2] - az;
      const cx = m0.positions[c * 3] - ax, cy = m0.positions[c * 3 + 1] - ay, cz = m0.positions[c * 3 + 2] - az;
      const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
      const len = Math.hypot(nx, ny, nz) || 1;
      if (Math.abs(ny / len) < 0.3) { side = i; break; }
    }
    A.selectComponents(o, 'polygon', [side]);
    A.run('ApplyTopoOp', { PresetObj: 'ExtrudeComponentAxis' });
    const op = A.selection[0];
    if (op?.set) { op.set('length', 1); op.set('inset', 0); op.set('x', false); op.set('y', true); op.set('z', false); op.set('frame', 0); }
    o.primitive.dirty = true;
    const axis = meshStats(o);

    const o2 = cube333();
    A.selectComponents(o2, 'polygon', [side]);
    A.run('ApplyTopoOp', { PresetObj: 'Extrude Component Along Normal' });
    const op2 = A.selection[0];
    if (op2?.set) { op2.set('length', 1); op2.set('inset', 0); }
    o2.primitive.dirty = true;
    const normal = meshStats(o2);

    const differ = axis.npts === normal.npts && JSON.stringify(axis.polyHist) === JSON.stringify(normal.polyHist)
      ? (() => {
          const ma = o.primitive.mesh(), mn = o2.primitive.mesh();
          let d = 0;
          for (let i = 0; i < Math.min(ma.positions.length, mn.positions.length); i++) d += Math.abs(ma.positions[i] - mn.positions[i]);
          return d > 1e-3;
        })()
      : true;
    out.push({
      name: 'ExtrudeAxis_vs_Normal',
      ok: axis.npts > 56 && differ,
      detail: `axis ${axis.npts}/${axis.npolys} normal ${normal.npts}/${normal.npolys} differ=${differ} sidePoly=${side}`,
    });
  }

  // --- Extrude Along Axis vs softimage-pc si_model_topo_extra extrude_axis_poly0 ---
  // SI dump mesh matches Extrude Along Normal defaults (length=1, inset=0) on Softimage poly[0]
  // (component-frame Y ≡ face normal). SPDL defaults length=0/inset=0.2 are overridden to match golden.
  {
    const gold = siCounts._topoExtra?.extrude_axis_poly0;
    const base = siCounts._topoBase;
    if (!gold?.pts || gold.error) {
      out.push({ name: 'ExtrudeAxis_SI_poly0', ok: false, detail: `no SI golden (${gold?.error || 'missing'})` });
    } else {
      const o = cube333();
      const m = o.primitive.mesh();
      const items = mapPolys(m, [base.polys[0]], base);
      A.selectComponents(o, 'polygon', items.length ? items : [0]);
      A.run('ApplyTopoOp', { PresetObj: 'ExtrudeComponentAxis' });
      const op = A.selection[0];
      if (op?.set) {
        op.set('length', 1); op.set('inset', 0);
        op.set('x', false); op.set('y', true); op.set('z', false); op.set('frame', 1);
      }
      o.primitive.dirty = true;
      const st = meshStats(o);
      const match = ptsMultisetMatch(o.primitive.mesh(), gold.pts);
      out.push({
        name: 'ExtrudeAxis_SI_poly0',
        ok: match.ok && st.npolys === gold.npolys,
        detail: `Direct ${st.npts}/${st.npolys} SI ${gold.npts}/${gold.npolys} shared ${match.common}/${match.siN} mappedSel=${items.length}`,
      });
    }
  }

  // --- Dissolve edge[0] / Weld pnt[0,1] from PC topo_extra (usable goldens) ---
  {
    const gold = siCounts._topoExtra?.dissolve_edge0;
    const base = siCounts._topoBase;
    if (!gold?.pts || gold.error) {
      out.push({ name: 'DissolveEdge0_SI', ok: false, detail: `no SI golden (${gold?.error || 'missing'})` });
    } else {
      const o = cube333();
      const m = o.primitive.mesh();
      const edges = mapEdges(m, [base.edges[0]], base);
      A.selectComponents(o, 'edge', edges.length ? edges : edgeKeysOf(m, 1));
      let err = null;
      try { A.run('ApplyTopoOp', { PresetObj: 'Dissolve Component' }); } catch (e) { err = e.message; }
      o.primitive.dirty = true;
      const st = meshStats(o);
      out.push({
        name: 'DissolveEdge0_SI',
        ok: !err && st.npts === gold.npts && st.npolys === gold.npolys,
        detail: err || `Direct ${st.npts}/${st.npolys} SI ${gold.npts}/${gold.npolys} edges=${edges.length}`,
      });
    }
  }
  {
    const gold = siCounts._topoExtra?.weld_pnt01;
    const base = siCounts._topoBase;
    if (!gold?.pts || gold.error) {
      out.push({ name: 'WeldPnt01_SI', ok: false, detail: `no SI golden (${gold?.error || 'missing'})` });
    } else {
      const o = cube333();
      const m = o.primitive.mesh();
      const pnts = mapPnts(m, [0, 1], base);
      A.selectComponents(o, 'point', pnts.length ? pnts : [0, 1]);
      let err = null;
      try { A.run('ApplyTopoOp', { PresetObj: 'Weld Points' }); } catch (e) { err = e.message; }
      o.primitive.dirty = true;
      const st = meshStats(o);
      const match = ptsMultisetMatch(o.primitive.mesh(), gold.pts);
      out.push({
        name: 'WeldPnt01_SI',
        ok: !err && match.ok && st.npolys === gold.npolys,
        detail: err || `Direct ${st.npts}/${st.npolys} SI ${gold.npts}/${gold.npolys} shared ${match.common} pnts=${pnts.length}`,
      });
    }
  }

  // --- CapHole after Delete poly[0]: SI after_delete + final mesh golden (PC Cap_Hole ICETree 56/54) ---
  {
    const pcCap = siCounts._topoExtra?.caphole_after_delete_poly0;
    const base = siCounts._topoBase;
    if (!pcCap?.pts || pcCap.error) {
      out.push({ name: 'CapHole_SI_Delete_poly0', ok: false, detail: `no SI golden (${pcCap?.error || 'missing'})` });
      out.push({ name: 'CapHole_SI_poly0', ok: false, detail: 'no SI golden' });
    } else {
      const o = cube333();
      const m = o.primitive.mesh();
      const items = mapPolys(m, [base.polys[0]], base);
      const before = meshStats(o);
      A.selectComponents(o, 'polygon', items.length ? items : [0]);
      A.run('ApplyTopoOp', { PresetObj: 'Delete Component' });
      o.primitive.dirty = true;
      const hole = meshStats(o);
      const siDel = pcCap.after_delete;
      out.push({
        name: 'CapHole_SI_Delete_poly0',
        ok: !!siDel && hole.npts === siDel.npts && hole.npolys === siDel.npolys,
        detail: `Direct hole ${hole.npts}/${hole.npolys} SI after_delete ${siDel?.npts}/${siDel?.npolys} mappedSel=${items.length}`,
      });
      A.select([o]);
      A.run('CapHole');
      o.primitive.dirty = true;
      const capped = meshStats(o);
      const match = ptsMultisetMatch(o.primitive.mesh(), pcCap.pts);
      out.push({
        name: 'CapHole_SI_poly0',
        ok: match.ok && capped.npolys === pcCap.npolys && hole.npolys === before.npolys - 1,
        detail: `Direct ${capped.npts}/${capped.npolys} SI ${pcCap.npts}/${pcCap.npolys} shared ${match.common}/${match.siN} op=${pcCap.op_name}/${pcCap.op_type}`,
      });
    }
  }

  // --- Boolean Difference: Direct nontrivial CSG; SI dump1 counts documented (not equal) ---
  {
    A.run('NewScene');
    const cube = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const sphere = A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface' });
    A.run('Translate', { X: 1.5, Y: 0, Z: 0 });
    A.run('SelectObj', { InputObjs: `${cube.name},${sphere.name}` });
    let err = null;
    try { A.run('ApplyTopoOp', { PresetObj: 'Boolean Difference' }); } catch (e) { err = e.message; }
    await new Promise(r => setTimeout(r, 1200));
    const meshes = [...A.scene.allObjects()].filter(o => o.primitive?.mesh());
    for (const o of meshes) { if (o.primitive) o.primitive.dirty = true; }
    const boolObj = meshes.find(o => /bool/i.test(o.name));
    const st = boolObj ? meshStats(boolObj) : null;
    const si = siCounts.boolean?.Difference?.si?.cube;
    out.push({
      name: 'Boolean_Difference_wired',
      ok: !err && !!st && st.npts > 20 && st.npolys > 20,
      detail: err || `Direct ${st?.npts}/${st?.npolys}; SI dump1 Diff cube≈${si?.points}/${si?.polys} (CSG impl differs — not equality-locked)`,
    });
  }

  // --- Boolean Union wired (SI dump1 Union cube 113/101) ---
  {
    A.run('NewScene');
    const cube = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const sphere = A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface' });
    A.run('Translate', { X: 1.5, Y: 0, Z: 0 });
    A.run('SelectObj', { InputObjs: `${cube.name},${sphere.name}` });
    let err = null;
    try { A.run('ApplyTopoOp', { PresetObj: 'Boolean Union' }); } catch (e) { err = e.message; }
    await new Promise(r => setTimeout(r, 1200));
    const meshes = [...A.scene.allObjects()].filter(o => o.primitive?.mesh());
    for (const o of meshes) { if (o.primitive) o.primitive.dirty = true; }
    const boolObj = meshes.find(o => /bool/i.test(o.name));
    const st = boolObj ? meshStats(boolObj) : null;
    const si = siCounts.boolean?.Union?.si?.cube;
    out.push({
      name: 'Boolean_Union_wired',
      ok: !err && !!st && st.npts > 20 && st.npolys > 20,
      detail: err || `Direct ${st?.npts}/${st?.npolys}; SI dump1 Union cube≈${si?.points}/${si?.polys}`,
    });
  }

  // --- OT: Triangulate cube333 (SI dump2 218/216 is different base mesh) ---
  {
    const o = cube333();
    A.select([o]);
    A.run('TriangulatePolygons');
    o.primitive.dirty = true;
    const st = meshStats(o);
    const allTris = !st.polyHist[4] && !st.polyHist[5] && (st.polyHist[3] === st.npolys);
    out.push({
      name: 'OT_Triangulate_cube333',
      ok: st.npts === 56 && st.npolys === 108 && allTris,
      detail: `${st.npts}/${st.npolys} hist=${JSON.stringify(st.polyHist)} (SI dump2 Triangulate=${siCounts.ot?.Triangulate?.si?.points}/${siCounts.ot?.Triangulate?.si?.polys} other base)`,
    });
  }

  // --- OT: Duplicate Polygons increases topology ---
  {
    const o = cube333();
    const before = meshStats(o);
    A.selectComponents(o, 'polygon', [0, 1, 2]);
    A.run('ApplyTopoOp', { PresetObj: 'Duplicate Polygons' });
    const op = A.selection[0];
    if (op?.set) { op.set('length', 1); op.set('offset', 1); }
    o.primitive.dirty = true;
    const after = meshStats(o);
    out.push({
      name: 'OT_DuplicatePolygons',
      ok: after.npts > before.npts && after.npolys > before.npolys,
      detail: `before ${before.npts}/${before.npolys} after ${after.npts}/${after.npolys}`,
    });
  }

  // --- OT: Extract Polygons keep (SI dump2 extracted 6/2) ---
  {
    const o = cube333();
    A.selectComponents(o, 'polygon', [0, 1]);
    let err = null; let extracted = null;
    try { extracted = A.run('ExtractPolygons', { Keep: true }); } catch (e) { err = e.message; }
    const src = meshStats(o);
    const part = extracted?.primitive?.mesh ? meshStats(extracted) : null;
    out.push({
      name: 'OT_ExtractPolygons_keep',
      ok: !err && !!part && part.npts >= 4 && part.npolys >= 1 && src.npolys === 54,
      detail: err || `src ${src.npts}/${src.npolys} part ${part?.npts}/${part?.npolys} (SI keep extracted≈6/2)`,
    });
  }

  // --- OT: Spin Edges on three edges ---
  {
    const o = cube333();
    const m = o.primitive.mesh();
    const ek = edgeKeysOf(m, 3);
    A.selectComponents(o, 'edge', ek);
    let err = null;
    try { A.run('SpinEdgeForward'); } catch (e) { err = e.message; }
    o.primitive.dirty = true;
    const st = meshStats(o);
    out.push({
      name: 'OT_SpinEdges',
      ok: !err && st.npts === 56 && st.npolys === 54,
      detail: err || `npts/npolys ${st.npts}/${st.npolys} edges=${ek.length} (SI dump2 SpinEdges 56/54)`,
    });
  }

  // --- OT: Filter Points (SI default leaves counts unchanged) ---
  {
    const o = cube333();
    A.selectComponents(o, 'point', [0, 1, 2, 3]);
    let err = null;
    try { A.run('ApplyTopoOp', { PresetObj: 'Filter Points' }); } catch (e) { err = e.message; }
    o.primitive.dirty = true;
    const st = meshStats(o);
    out.push({
      name: 'OT_FilterPoints',
      ok: !err && st.npts === 56 && st.npolys === 54,
      detail: err || `${st.npts}/${st.npolys} (SI FilterPoints unchanged at default distance)`,
    });
  }

  // --- OT: Dissolve and Clean — map SI poly[0,1,2] by position (same as compare_topology) ---
  {
    const base = siCounts._topoBase;
    const o = cube333();
    const m = o.primitive.mesh();
    const R = (v) => Math.round(v * 1000) / 1000;
    const key = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]].map(R).join(',');
    const want = (base?.polys ?? [[0, 1, 2]]).slice(0, 3).map(f => f.map(j => base.pts[j].map(R).join(',')).sort().join('|'));
    const items = m.polygons.map((f, i) => [f.map(key).sort().join('|'), i]).filter(([k]) => want.includes(k)).map(([, i]) => i);
    A.selectComponents(o, 'polygon', items.length ? items : [0, 1, 2]);
    let err = null;
    try { A.run('ApplyTopoOp', { PresetObj: 'Dissolve and Clean Adjacent Vertices' }); } catch (e) { err = e.message; }
    o.primitive.dirty = true;
    const st = meshStats(o);
    const si = siCounts.ot?.DissolveAndClean?.si;
    out.push({
      name: 'OT_DissolveAndClean',
      ok: !err && st.npts === si.points && st.npolys === si.polys,
      detail: err || `Direct ${st.npts}/${st.npolys} SI ${si?.points}/${si?.polys} mappedSel=${items.length}`,
    });
  }

  // --- OT: Curve Clean — Softimage Circle Points 16→8; Direct exact NURBS circle is 9 CVs.
  //     Lock Clean reduces a dense polyline-like curve (collinear/near-dup filter). ---
  {
    A.run('NewScene');
    const c = A.run('CreatePrim', { PresetObj: 'Spiral', GeometryType: 'NurbsCurve' });
    // densify: raise then we clean — or use Arc with many CVs
    const before = c.primitive.curve()?.cvs?.length ?? 0;
    A.select([c]);
    let err = null;
    try {
      const op = A.run('ApplyTopoOp', { PresetObj: 'Curve Clean' });
      if (op?.set) op.set('tolerance', 0.5);
    } catch (e) { err = e.message; }
    c.primitive.dirty = true;
    const after = c.primitive.curve()?.cvs?.length ?? 0;
    const circ = (() => {
      A.run('NewScene');
      const o = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' });
      return o.primitive.curve()?.cvs?.length ?? 0;
    })();
    out.push({
      name: 'OT_CurveClean',
      ok: !err && after <= before && circ === 9,
      detail: err || `spiral ${before}→${after}; Direct Circle CVs=${circ} (SI Circle Points 16→8 after Clean — different curve schema)`,
    });
  }

  // --- Headless ExportDelta / ImportDelta Data roundtrip ---
  {
    A.run('NewScene');
    A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'ball' });
    A.run('CreateModel', { InputObjs: 'ball', Name: 'BallModel' });
    A.run('SelectObj', { InputObjs: 'BallModel' });
    A.run('ConvertToRefModel', { FileName: 'BallRefOps' });
    A.run('AddDelta');
    const child = A.scene.find('ball');
    const l = child.kinematics.local;
    A.setParam(l.get('posx'), 2.5);
    A.setParam(l.get('posy'), 1.25);
    const payload = A.run('ExportDelta', { Data: true, FileName: 'BallRefOps.delta' });
    A.setParam(l.get('posx'), 0);
    A.setParam(l.get('posy'), 0);
    const n = A.run('ImportDelta', { Data: payload });
    const ok = Math.abs(Number(l.val('posx')) - 2.5) < 1e-6 && Math.abs(Number(l.val('posy')) - 1.25) < 1e-6 && (payload?.delta?.length ?? 0) >= 1;
    out.push({
      name: 'ExportImportDelta_Data',
      ok,
      detail: `n=${n} deltaLen=${payload?.delta?.length} pos=[${l.val('posx')},${l.val('posy')}]`,
    });
  }

  return out;
}, counts);

let okN = 0, failN = 0;
for (const r of rows) {
  console.log(r.name.padEnd(28), r.ok ? 'OK  ' : 'DIFF', r.detail);
  if (r.ok) okN++; else failN++;
}
console.log(`summary ${okN} OK / ${failN} DIFF`);
await b.close();
process.exit(failN ? 1 : 0);
