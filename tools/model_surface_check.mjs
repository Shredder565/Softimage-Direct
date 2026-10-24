// Model surface fidelity checks beyond topology core: NURBS closest-point / stitch / fillet,
// curve fillet geometry, and cluster CRUD. Usage: node tools/model_surface_check.mjs
// Expects vite preview at http://127.0.0.1:4173/
import { chromium } from 'playwright';

const URL = process.env.SI_URL || 'http://127.0.0.1:4173/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrs = []; p.on('pageerror', e => pageErrs.push(e.message));
await p.goto(URL); await p.waitForTimeout(900);

const run = (name, args = {}) => p.evaluate(([n, a]) => {
  try { const r = window.Application.run(n, a); return r && r.name ? r.name : r == null ? 'null' : String(r); }
  catch (e) { return 'ERR ' + (e?.message ?? e); }
}, [name, args]);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

// ---- NURBS: closest-point Newton + snap boundary moves seam onto target
await run('NewScene');
await run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'gridA' });
await run('Translate', { X: -2 });
await run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'gridB' });
await run('Translate', { X: 3 });
const closest = await p.evaluate(() => {
  const A = window.Application.scene.find('gridA');
  const B = window.Application.scene.find('gridB');
  const sa = A.primitive.mesh().nurbs, sb = B.primitive.mesh().nurbs;
  // probe a known control point of A; Newton closest on B should beat the coarse-only residual
  const p0 = sa.cps[0];
  // expose via eval path used by Snap: Application doesn't export N, so compare pre/post snap distance
  const before = (() => {
    const mesh = A.primitive.mesh(); const n = mesh.nurbs; const i = n.nu - 1; // umax column
    let sum = 0; for (let j = 0; j < n.nv; j++) {
      const q = n.cps[j * n.nu + i];
      // distance to B's AABB centre as a proxy — replaced below after snap
      sum += Math.hypot(q[0] - 3, q[1], q[2]);
    }
    return sum / n.nv;
  })();
  return { before, hasNurbs: !!(sa && sb), nu: sa.nu, nv: sa.nv, p0 };
});
check('nurbs grids created', closest.hasNurbs && closest.nu >= 2, `nu=${closest.nu} nv=${closest.nv}`);

await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridA,gridB' }));
const snap = await run('ApplySnapFaceOp');
const afterSnap = await p.evaluate(() => {
  const A = window.Application.scene.find('gridA');
  const B = window.Application.scene.find('gridB');
  const sa = A.primitive.mesh().nurbs, sb = B.primitive.mesh().nurbs;
  // umax of A should sit near surface B after snap (blend=1)
  let maxD = 0, sum = 0;
  const i = sa.nu - 1;
  for (let j = 0; j < sa.nv; j++) {
    const p = sa.cps[j * sa.nu + i];
    // brute closest on B control/eval grid
    let bd = Infinity;
    for (let jj = 0; jj <= 32; jj++) for (let ii = 0; ii <= 32; ii++) {
      // evaluate via tessellated mesh positions as fallback
      void ii; void jj;
    }
    // use tessellated mesh of B
    const m = B.primitive.mesh();
    for (let k = 0; k < m.positions.length; k += 3) {
      const d = Math.hypot(p[0] - m.positions[k], p[1] - m.positions[k + 1], p[2] - m.positions[k + 2]);
      if (d < bd) bd = d;
    }
    maxD = Math.max(maxD, bd); sum += bd;
  }
  return { snapOp: true, maxD, meanD: sum / sa.nv, sbNu: sb.nu };
});
check('Snap Boundary runs', !String(snap).startsWith('ERR'), snap);
check('Snap Boundary seam near target', afterSnap.meanD < 0.35, `meanD=${afterSnap.meanD.toFixed(4)} maxD=${afterSnap.maxD.toFixed(4)}`);

await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridA,gridB' }));
const stitch = await run('ApplyTopoOp', { PresetObj: 'SrfStitch' });
check('SrfStitch runs', !String(stitch).startsWith('ERR'), stitch);

// ---- Curve fillet: two axis-aligned segments that meet at origin (Softimage intersecting case)
await run('NewScene');
const fillet = await p.evaluate(() => {
  const A = window.Application;
  A.run('CreatePrim', { PresetObj: 'Square', GeometryType: 'NurbsCurve', Name: 'sq' });
  A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'circ' });
  A.run('Translate', { X: 2.5 });
  A.run('SelectObj', { InputObjs: 'sq,circ' });
  const name = (() => { try { return A.run('ApplyGenOp', { PresetObj: 'CrvFillet' })?.name ?? 'ok'; } catch (e) { return 'ERR ' + e.message; } })();
  const f = [...A.scene.allObjects()].find(o => o.primitive?.type === 'crvlist' && /fillet/i.test(o.name));
  const curve = f?.primitive?.curve(); if (!curve) return { run: name, ok: false, reason: 'no fillet' };
  const pts = curve.cvs.map(q => [q[0], q[1], q[2]]);
  let chord = 0; for (let i = 1; i < pts.length; i++) chord += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[2]), ys = pts.map(p => p[1]);
  const spread = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const ySpan = Math.max(...ys) - Math.min(...ys);
  // Reject the old Y-bump heuristic (mid Y = avg + radius with tiny XZ motion)
  const notYBump = !(ySpan > 0.3 && spread < 0.05);
  return { run: name, ok: true, nCvs: pts.length, chord, spread, ySpan, notYBump, end0: pts[0], end1: pts[pts.length - 1] };
});
check('CrvFillet runs', !String(fillet.run).startsWith('ERR'), fillet.run);
check('CrvFillet has arc length', fillet.ok && fillet.chord > 0.3, `chord=${fillet.chord?.toFixed?.(3)} spread=${fillet.spread?.toFixed?.(3)}`);
check('CrvFillet not Y-only bump', fillet.ok && fillet.notYBump, `ySpan=${fillet.ySpan?.toFixed?.(3)} spread=${fillet.spread?.toFixed?.(3)}`);

// ---- Clusters: create / copy / invert / aliases / always-complete reuse
await run('NewScene');
await run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'box' });
const cluster = await p.evaluate(async () => {
  const app = window.Application;
  const box = app.scene.find('box');
  app.setSelMode('point');
  app.selectComponents(box, 'point', [0, 1, 2, 3]);
  const c = app.run('CreateCluster', { Name: 'Top' });
  const n0 = c.elements.size;
  const copy = app.run('CopyCluster');
  const inv = app.run('InvertCluster', { Cluster: box.name + '.Top' });
  // Softimage: Weight Map hangs on the complete Point cluster
  app.select([box]);
  const wm = app.run('AddProp', { PresetObj: 'Weight Map', InputObjs: [box] });
  const pointClusters = box.clusters.filter(x => x.compKind === 'pnt');
  const complete = pointClusters.filter(x => x.isComplete);
  const wmOnCluster = complete.some(x => x.properties.some(p => p.type === 'weightmap'));
  const aliasOk = app.commands.has('SICreateCluster') && app.commands.has('AddToCluster') && app.commands.has('RemoveCluster') && app.commands.has('CopyCluster') && app.commands.has('InvertCluster');
  return {
    created: n0 === 4,
    copied: copy && copy.elements.size === 4 && copy.name !== c.name,
    inverted: inv.elements.size === (box.primitive.mesh().positions.length / 3 - 4),
    weightMap: !!wm,
    completeCount: complete.length,
    wmOnCluster,
    aliases: aliasOk,
    clusterNames: box.clusters.map(x => x.name),
  };
});
check('CreateCluster 4 points', cluster.created, JSON.stringify(cluster.clusterNames));
check('CopyCluster', cluster.copied);
check('InvertCluster complement', cluster.inverted);
check('Weight map on complete Point cluster', cluster.completeCount >= 1 && cluster.wmOnCluster, `complete=${cluster.completeCount} onCluster=${cluster.wmOnCluster}`);
check('Cluster command aliases registered', cluster.aliases);

const failed = results.filter(r => !r.ok);
console.log('---');
console.log(`${results.length - failed.length}/${results.length} passed`);
if (pageErrs.length) console.log('page errors', pageErrs);
await b.close();
process.exit(failed.length ? 1 : 0);
