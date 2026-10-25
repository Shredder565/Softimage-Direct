/** Shared deterministic noise / hash for FROST CPU evaluators. */

export type Vec3 = [number, number, number];

/** Deterministic hash → [0,1). */
export function frostHash(a: number, b: number, c: number, seed: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647 ^ 1274126177) ^ Math.imul(seed | 0, 974711);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function frostNoise3(p: Vec3, seed = 0): number {
  const xi = Math.floor(p[0]), yi = Math.floor(p[1]), zi = Math.floor(p[2]);
  const fx = smooth(p[0] - xi), fy = smooth(p[1] - yi), fz = smooth(p[2] - zi);
  const c = (dx: number, dy: number, dz: number) => frostHash(xi + dx, yi + dy, zi + dz, seed);
  const lx = (a: number, b: number, t: number) => a + (b - a) * t;
  return lx(
    lx(lx(c(0, 0, 0), c(1, 0, 0), fx), lx(c(0, 1, 0), c(1, 1, 0), fx), fy),
    lx(lx(c(0, 0, 1), c(1, 0, 1), fx), lx(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  ) * 2 - 1;
}

export function frostTurbulence(p: Vec3, octaves = 3, seed = 0): number {
  let a = 0, amp = 1, f = 1, n = 0;
  for (let o = 0; o < octaves; o++) {
    a += frostNoise3([p[0] * f, p[1] * f, p[2] * f], seed + o) * amp;
    n += amp; amp *= 0.5; f *= 2;
  }
  return n > 0 ? a / n : 0;
}
