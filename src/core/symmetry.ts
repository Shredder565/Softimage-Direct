// Symmetry maps (Get > Property > Symmetry Map): a per-point correspondence across a local plane, computed once with a
// tolerance and reused by symmetry mode (mirrored tweaks and selections), Duplicate Symmetry and Polygon Reduction.
import { MeshData } from './geometry';
import { X3DObject, Property } from './scene';
import { enumP, num, int } from './params';

export type SymPlane = 'YZ' | 'XZ' | 'XY';
export const PLANE_AXIS: Record<SymPlane, 0 | 1 | 2> = { YZ: 0, XZ: 1, XY: 2 };

/** point index → mirrored point index (only points with a match within `tol` are mapped; points on the plane map to themselves). */
export function buildPointMap(pts: Float32Array | number[], plane: SymPlane, tol = 1e-3): Map<number, number> {
  const ax = PLANE_AXIS[plane]; const n = pts.length / 3; const cell = Math.max(tol * 2, 1e-6); const key = (x: number, y: number, z: number) => `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
  const grid = new Map<string, number[]>(); for (let i = 0; i < n; i++) { const k = key(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); }
  const out = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const m = [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]; m[ax] = -m[ax];
    let best = -1, bd = tol; const cx = Math.round(m[0] / cell), cy = Math.round(m[1] / cell), cz = Math.round(m[2] / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) { const d = Math.hypot(pts[j * 3] - m[0], pts[j * 3 + 1] - m[1], pts[j * 3 + 2] - m[2]); if (d <= bd) { bd = d; best = j; } }
    if (best >= 0) out.set(i, best);
  }
  return out;
}
/** Mirror of a component (point index, "a-b" edge key or polygon index) through a point map. */
export function mirrorComponent(mesh: MeshData, map: Map<number, number>, kind: 'point' | 'edge' | 'polygon', item: number | string): number | string | null {
  if (kind === 'point') { const m = map.get(Number(item)); return m === undefined ? null : m; }
  if (kind === 'edge') { const [a, b] = String(item).split('-').map(Number); const ma = map.get(a), mb = map.get(b); if (ma === undefined || mb === undefined) return null; return ma < mb ? `${ma}-${mb}` : `${mb}-${ma}`; }
  const f = mesh.polygons[Number(item)]; if (!f) return null; const mf = f.map(v => map.get(v)); if (mf.some(v => v === undefined)) return null; const want = new Set(mf as number[]);
  const idx = mesh.polygons.findIndex(g => g.length === f.length && g.every(v => want.has(v))); return idx >= 0 ? idx : null;
}
/** The object's symmetry map property (if any) with a map that matches the current point count, rebuilding it when the topology changed. */
export function symmetryMapOf(o: X3DObject, plane?: SymPlane): { plane: SymPlane; map: Map<number, number>; tol: number } | null {
  const p = o.property('symmetrymap'); const pts = o.primitive?.mesh()?.positions; if (!pts) return null;
  const pl: SymPlane = plane ?? (p ? (['YZ', 'XZ', 'XY'][Number(p.val('plane') ?? 0)] as SymPlane) : 'YZ'); const tol = p ? Number(p.val('tolerance') ?? 1e-3) : 1e-3;
  const cache = (p ?? o) as any; const n = pts.length / 3;
  if (!cache._sym || cache._sym.n !== n || cache._sym.plane !== pl || cache._sym.tol !== tol) cache._sym = { n, plane: pl, tol, map: buildPointMap(pts, pl, tol) };
  return { plane: pl, map: cache._sym.map, tol };
}
export function makeSymmetryMap(plane: SymPlane = 'YZ', tol = 1e-3): Property {
  const p = new Property('Symmetry Map', 'symmetrymap', [enumP('plane', ['YZ', 'XZ', 'XY'].indexOf(plane), [{ label: 'YZ (mirror X)', value: 0 }, { label: 'XZ (mirror Y)', value: 1 }, { label: 'XY (mirror Z)', value: 2 }], 'Symmetry Plane'), num('tolerance', tol, 'Tolerance', { min: 0, max: 10 }), int('mapped', 0, 'Mapped Points', { readOnly: true }), int('unmapped', 0, 'Unmapped Points', { readOnly: true })]);
  return p;
}
