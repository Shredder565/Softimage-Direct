// Softimage Direct Model ops beyond compare_topology: Extrude Along Axis, CapHole,
// Boolean count locks from dump1, headless ExportDelta/ImportDelta.
// Needs vite preview on :4173. Usage: node tools/compare_model_ops.mjs
import { chromium } from 'playwright';
import fs from 'fs';

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

const rows = await page.evaluate(async () => {
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

  // --- Extrude Along Axis (object Y) vs Extrude Along Normal on a side face ---
  {
    const o = cube333();
    const m0 = o.primitive.mesh();
    // pick a polygon whose normal is NOT +Y (so axis-Y ≠ face normal)
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

  // --- CapHole after deleting one polygon (open hole → cap restores a face) ---
  {
    const o = cube333();
    const before = meshStats(o);
    A.selectComponents(o, 'polygon', [0]);
    A.run('ApplyTopoOp', { PresetObj: 'Delete Component' });
    o.primitive.dirty = true;
    const hole = meshStats(o);
    A.select([o]);
    A.run('CapHole');
    o.primitive.dirty = true;
    const capped = meshStats(o);
    out.push({
      name: 'CapHole_after_Delete',
      ok: hole.npolys === before.npolys - 1 && capped.npolys >= hole.npolys + 1,
      detail: `before ${before.npolys} hole ${hole.npolys} capped ${capped.npolys}`,
    });
  }

  // --- Boolean Difference (ApplyGenOp CSG). Softimage dump1 ≈100/87; Direct three-bvh CSG differs — lock nontrivial result. ---
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
    const stats = meshes.map(o => ({ name: o.name, ...meshStats(o) }));
    const boolObj = meshes.find(o => /bool/i.test(o.name));
    const st = boolObj ? meshStats(boolObj) : null;
    out.push({
      name: 'Boolean_Difference_wired',
      ok: !err && !!st && st.npts > 20 && st.npolys > 20,
      detail: err || `boolean npts=${st?.npts} npolys=${st?.npolys} (SI dump1 Diff≈100/87; Direct CSG counts differ)`,
    });
  }

  // --- Headless ExportDelta / ImportDelta Data roundtrip ---
  {
    A.run('NewScene');
    const ball = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'ball' });
    A.run('CreateModel', { InputObjs: 'ball', Name: 'BallModel' });
    A.run('SelectObj', { InputObjs: 'BallModel' });
    A.run('ConvertToRefModel', { FileName: 'BallRefOps' });
    A.run('AddDelta');
    const child = A.scene.find('ball') || ball;
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
});

let okN = 0, failN = 0;
for (const r of rows) {
  console.log(r.name.padEnd(28), r.ok ? 'OK  ' : 'DIFF', r.detail);
  if (r.ok) okN++; else failN++;
}
console.log(`summary ${okN} OK / ${failN} DIFF`);
await b.close();
process.exit(failN ? 1 : 0);
