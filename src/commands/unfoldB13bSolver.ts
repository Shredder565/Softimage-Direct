// Ledger row CMD-B13b (Unfold3D.64.dll): the solver driver (note 2.6). The driver's steps, flag words and the
// parameters each flag reads are attested; the Unfold3D unfold / pack / relax maths is not described by the note, so
// the geometry below is an original stand-in (planar flattening per cut-line chart, a shelf packer, Laplacian relax),
// every part of it marked `// inferred` and logged once per run as "not yet attested".
import { App } from '../core/commands';
import type { MeshData } from '../core/geometry';
import {
  stateOf, buildRecords, uvsOf, writeUVs, relabel, licenceCheck, logNya, meshOf, relaxUVs, sampleOffsets, edgeKey,
  F_UNFOLD, F_ADJUST, F_PACK, F_ISLANDSEL, F_RELAX, F_REFRESH, S_OK, Property, X3DObject, type UnfoldRecord,
} from './unfoldB13bShared';

const PACK_PARAMS = ['Pack_spacing', 'Pack_islandrotation', 'Pack_globalrotation', 'Pack_packrandomseed', 'Pack_sortordertype',
  'Pack_angleincrement', 'Pack_uvlayoutscalingmode', 'Pack_scalingmode', 'Pack_useboxpacking', 'Pack_squareresol'];

/** Charts: polygons connected through edges that are not on the cut line.  // inferred */
export function charts(m: MeshData, cut: Set<number | string>): number[][] {
  const parent = m.polygons.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const byEdge = new Map<string, number[]>();
  m.polygons.forEach((f, pi) => f.forEach((v, i) => { const k = edgeKey(v, f[(i + 1) % f.length]); (byEdge.get(k) ?? byEdge.set(k, []).get(k)!).push(pi); }));
  for (const [k, ps] of byEdge) if (!cut.has(k)) for (let i = 1; i < ps.length; i++) { const a = find(ps[0]), b = find(ps[i]); if (a !== b) parent[a] = b; }
  const groups = new Map<number, number[]>();
  m.polygons.forEach((_, pi) => { const r = find(pi); (groups.get(r) ?? groups.set(r, []).get(r)!).push(pi); });
  return [...groups.values()];
}

/** Flatten one chart: projection on the plane of its area-weighted normal, lengths kept.  // inferred */
function flattenChart(m: MeshData, polys: number[], start: Int32Array, uv: Float32Array, pinned: Set<number>) {
  const P = (v: number) => [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]];
  let nx = 0, ny = 0, nz = 0;
  for (const pi of polys) { const f = m.polygons[pi]; for (let i = 0; i < f.length; i++) { const a = P(f[i]), b = P(f[(i + 1) % f.length]); nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); } }
  const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl; if (!Number.isFinite(nx)) { nx = 0; ny = 0; nz = 1; }
  let ux = Math.abs(nx) < 0.9 ? 1 : 0, uy = Math.abs(nx) < 0.9 ? 0 : 1, uz = 0;
  const d = ux * nx + uy * ny + uz * nz; ux -= d * nx; uy -= d * ny; uz -= d * nz; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
  for (const pi of polys) m.polygons[pi].forEach((v, i) => {
    const s = start[pi] + i; if (pinned.has(s)) return; const p = P(v);
    uv[s * 2] = p[0] * ux + p[1] * uy + p[2] * uz; uv[s * 2 + 1] = p[0] * vx + p[1] * vy + p[2] * vz;
  });
}

/** Shelf packer into 0..1: island order by Pack_sortordertype, Pack_spacing between islands, best-fit scaling.  // inferred */
function pack(recs: { rec: UnfoldRecord; uv: Float32Array; islands: number[][]; start: Int32Array }[], prop: Property) {
  const spacing = Number(prop.val('Pack_spacing')) || 0, order = Number(prop.val('Pack_sortordertype')); let seed = Number(prop.val('Pack_packrandomseed')) || 0;
  type Isl = { r: typeof recs[number]; samples: number[]; x0: number; y0: number; w: number; h: number };
  const isl: Isl[] = [];
  for (const r of recs) {
    const m = meshOf(r.rec.object);
    for (const polys of r.islands) {
      const samples = polys.flatMap(pi => m.polygons[pi].map((_, i) => r.start[pi] + i));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of samples) { x0 = Math.min(x0, r.uv[s * 2]); x1 = Math.max(x1, r.uv[s * 2]); y0 = Math.min(y0, r.uv[s * 2 + 1]); y1 = Math.max(y1, r.uv[s * 2 + 1]); }
      if (samples.length) isl.push({ r, samples, x0, y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  if (!isl.length) return;
  const area = (i: Isl) => i.w * i.h;
  if (order === 0) isl.sort((a, b) => area(a) - area(b));
  else if (order === 2) { const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; }; for (let i = isl.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [isl[i], isl[j]] = [isl[j], isl[i]]; } }
  else isl.sort((a, b) => area(b) - area(a));
  const total = isl.reduce((s, i) => s + (i.w + spacing) * (i.h + spacing), 0);
  const width = Math.max(Math.sqrt(total) * 1.1, ...isl.map(i => i.w + spacing));
  let x = 0, y = 0, row = 0; const place: [number, number][] = [];
  for (const i of isl) { if (x > 0 && x + i.w > width) { x = 0; y += row + spacing; row = 0; } place.push([x, y]); x += i.w + spacing; row = Math.max(row, i.h); }
  const extent = Math.max(width, y + row) || 1; const k = 1 / extent;
  isl.forEach((i, n) => { const [px, py] = place[n]; for (const s of i.samples) { i.r.uv[s * 2] = (i.r.uv[s * 2] - i.x0 + px) * k; i.r.uv[s * 2 + 1] = (i.r.uv[s * 2 + 1] - i.y0 + py) * k; } });
}

/** Samples of the current component selection on an object (points: their samples; polygons: their samples). */
function selectedSamples(app: App, o: X3DObject, m: MeshData, start: Int32Array): Set<number> {
  const out = new Set<number>(); const c = app.compSel; if (!c || c.obj !== o) return out;
  if (c.kind === 'polygon') for (const pi of c.polygons) m.polygons[pi as number]?.forEach((_, i) => out.add(start[pi as number] + i));
  else if (c.kind === 'point') m.polygons.forEach((f, pi) => f.forEach((v, i) => { if (c.points.has(v)) out.add(start[pi] + i); }));
  else if (c.kind === 'edge') { const vs = new Set([...c.edges].flatMap(k => String(k).split('-').map(Number))); m.polygons.forEach((f, pi) => f.forEach((v, i) => { if (vs.has(v)) out.add(start[pi] + i); })); }
  return out;
}

/** The solver driver (note 2.6). Returns S_OK; throws on the licence failure. */
export function solverDriver(app: App, command: string, prop: Property, flags: number): number {
  const st = stateOf(app);
  licenceCheck(app, command);
  const recs = buildRecords(app, prop);
  const params: Record<string, any> = {};
  if (flags & F_ADJUST) { params.Adjust_power = prop.val('Adjust_power'); params.Adjust_iterations = prop.val('Adjust_iterations'); }
  if (flags & F_RELAX) { params.Relax_power = prop.val('Relax_power'); params.Relax_iterations = prop.val('Relax_iterations'); }
  if (flags & F_PACK) for (const n of PACK_PARAMS) params[n] = prop.val(n);
  params.UnfoldSignature = prop.val('UnfoldSignature');
  st.solverCalls.push({ property: prop, flags, params });
  const work = recs.map(rec => {
    const m = meshOf(rec.object); const { start, total } = sampleOffsets(m);
    const cur = uvsOf(rec.object, rec.projection); const uv = cur && cur.length === total * 2 ? Float32Array.from(cur) : new Float32Array(total * 2);
    return { rec, m, start, uv, islands: charts(m, rec.cutCluster.elements), pinned: (((rec.projection as any).pinned as Set<number> | undefined) ?? new Set<number>()) };
  });
  if (flags & F_UNFOLD) {
    logNya(app, command, 'the Unfold3D unfold solver; each cut-line chart is flattened on its average plane instead');
    for (const w of work) {
      const sel = flags & F_ISLANDSEL ? selectedSamples(app, w.rec.object, w.m, w.start) : null;
      for (const polys of w.islands) {
        if (sel && !polys.some(pi => w.m.polygons[pi].some((_, i) => sel.has(w.start[pi] + i)))) continue;   // island-selection restriction
        flattenChart(w.m, polys, w.start, w.uv, w.pinned);
      }
    }
  }
  if (flags & (F_ADJUST | F_RELAX)) {
    const relax = !!(flags & F_RELAX);
    const it = Math.max(1, Math.round(Number(relax ? params.Relax_iterations : params.Adjust_iterations) || 1)), power = Number(relax ? params.Relax_power : params.Adjust_power) || 0;
    logNya(app, command, `the Unfold3D ${relax ? 'relax' : 'adjust'} maths; a Laplacian relax of the selected samples is used`);
    for (const w of work) {
      const sel = selectedSamples(app, w.rec.object, w.m, w.start); if (!sel.size) continue;
      const r = relaxUVs(w.m, w.uv, it * 5, w.pinned);
      for (const s of sel) if (!w.pinned.has(s)) { w.uv[s * 2] += (r[s * 2] - w.uv[s * 2]) * power; w.uv[s * 2 + 1] += (r[s * 2 + 1] - w.uv[s * 2 + 1]) * power; }
    }
  }
  if (flags & F_PACK) {
    logNya(app, command, 'the Unfold3D packer (rotations, scaling modes, positioning precision, box packing); a shelf packer is used');
    pack(work.map(w => ({ rec: w.rec, uv: w.uv, islands: w.islands, start: w.start })), prop);
  }
  // signature: one entry per record (object, sample count, cut-line size)   // inferred: the signature format is not described
  const sig = recs.map(r => `${r.object.fullName}:${sampleOffsets(meshOf(r.object)).total}:${r.cutCluster.elements.size}`).join(';');
  const sp = prop.get('UnfoldSignature'); if (sp) app.setParam(sp, sig, command);
  if (!(flags & F_REFRESH) || flags & ~F_REFRESH) for (const w of work) writeUVs(app, w.rec.projection, w.uv);
  relabel(app, prop);
  return S_OK;
}
