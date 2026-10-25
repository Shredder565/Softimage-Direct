/** CPU strand buffers + simple dynamics for FROST character hair (P1). */

import { frostHash, frostTurbulence, type Vec3 } from './math';

export interface FrostStrand {
  /** Root (scalp) position. */
  rx: number; ry: number; rz: number;
  /** Root normal / growth direction. */
  nx: number; ny: number; nz: number;
  /** Number of free segments (point count = segments + 1). */
  segments: number;
  /** Current positions, interleaved xyz, length (segments+1)*3. */
  pos: Float32Array;
  /** Rest / groom positions (style layers write here). */
  rest: Float32Array;
  /** Previous frame positions for Verlet. */
  prev: Float32Array;
  length: number;
  thickness: number;
  clumpId: number;
  alive: boolean;
}

export interface StyleLayer {
  id: string;
  name: string;
  /** comb | cut | clump | part | puff | flyaway */
  kind: string;
  strength: number;
  muted: boolean;
  /** Optional direction for comb/part (xyz). */
  direction?: Vec3;
}

export function defaultStyleLayers(): StyleLayer[] {
  return [
    { id: 'base', name: 'Base', kind: 'comb', strength: 0.35, muted: false, direction: [0.2, -0.1, 0.05] },
    { id: 'part', name: 'Part', kind: 'part', strength: 0.45, muted: false, direction: [1, 0, 0] },
    { id: 'fly', name: 'Flyaways', kind: 'flyaway', strength: 0.25, muted: false },
  ];
}

export interface StrandSimParams {
  gravity: Vec3;
  damping: number;
  stiffness: number;
  stretchLimit: number;
  iterations: number;
  wind: Vec3;
  windTurbulence: number;
  dt: number;
  time: number;
  /** Collider triangles in world space (flat xyz triples), optional. */
  colliderTris?: Float32Array | null;
  /** Fallback sphere collider when no mesh tris. */
  colliderSphere?: { cx: number; cy: number; cz: number; r: number } | null;
  muted?: boolean;
}

export interface ScalpSample {
  px: number; py: number; pz: number;
  nx: number; ny: number; nz: number;
}

/** Procedural scalp hemisphere samples (when no scene mesh is bound). */
export function proceduralScalpSamples(count: number, seed = 1, radius = 0.55, cy = 1.55): ScalpSample[] {
  const out: ScalpSample[] = [];
  for (let i = 0; i < count; i++) {
    const u = frostHash(i, 1, 2, seed);
    const v = frostHash(i, 3, 4, seed);
    // Upper hemisphere: theta around Y, phi from pole
    const theta = u * Math.PI * 2;
    const phi = v * (Math.PI * 0.48); // stay near crown/sides, avoid under-chin
    const sx = Math.sin(phi) * Math.cos(theta);
    const sy = Math.cos(phi);
    const sz = Math.sin(phi) * Math.sin(theta);
    out.push({
      px: sx * radius, py: cy + sy * radius * 0.85, pz: sz * radius,
      nx: sx, ny: Math.max(0.15, sy), nz: sz,
    });
  }
  return out;
}

/** Sample mesh vertices as scalp roots; prefer upward-facing verts. */
export function scalpSamplesFromMesh(
  positions: Float32Array,
  matrix: number[] | Float32Array | null,
  count: number,
  seed = 1,
): ScalpSample[] {
  const n = Math.floor(positions.length / 3);
  if (n < 1) return proceduralScalpSamples(count, seed);
  // World-space verts + crude normals from neighbor deltas
  const world = new Float32Array(n * 3);
  const m = matrix && matrix.length >= 16 ? matrix : null;
  for (let i = 0; i < n; i++) {
    let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (m) {
      const nx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ny = m[1] * x + m[5] * y + m[9] * z + m[13];
      const nz = m[2] * x + m[6] * y + m[10] * z + m[14];
      x = nx; y = ny; z = nz;
    }
    world[i * 3] = x; world[i * 3 + 1] = y; world[i * 3 + 2] = z;
  }
  // Centroid for outward normals
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += world[i * 3]; cy += world[i * 3 + 1]; cz += world[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;

  // Score upward / outward verts for scalp-ish selection
  const scored: { i: number; s: number }[] = [];
  for (let i = 0; i < n; i++) {
    const dx = world[i * 3] - cx, dy = world[i * 3 + 1] - cy, dz = world[i * 3 + 2] - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const up = dy / len;
    const border = frostHash(i, 9, 10, seed); // soft falloff noise
    scored.push({ i, s: up * 2 + world[i * 3 + 1] * 0.1 - border * 0.15 });
  }
  scored.sort((a, b) => b.s - a.s);
  const pool = scored.slice(0, Math.max(count, Math.min(n, Math.ceil(n * 0.55))));
  const out: ScalpSample[] = [];
  for (let k = 0; k < count; k++) {
    const pick = pool[Math.floor(frostHash(k, 11, 12, seed) * pool.length) % pool.length];
    const i = pick.i;
    let nx = world[i * 3] - cx, ny = world[i * 3 + 1] - cy, nz = world[i * 3 + 2] - cz;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny = Math.max(0.05, ny / nl); nz /= nl;
    const n2 = Math.hypot(nx, ny, nz) || 1;
    out.push({
      px: world[i * 3], py: world[i * 3 + 1], pz: world[i * 3 + 2],
      nx: nx / n2, ny: ny / n2, nz: nz / n2,
    });
  }
  return out;
}

export function createStrand(sample: ScalpSample, segments: number, length: number, thickness: number, clumpId: number): FrostStrand {
  const segs = Math.max(2, segments | 0);
  const pts = segs + 1;
  const pos = new Float32Array(pts * 3);
  const rest = new Float32Array(pts * 3);
  const prev = new Float32Array(pts * 3);
  const nl = Math.hypot(sample.nx, sample.ny, sample.nz) || 1;
  const dx = sample.nx / nl, dy = sample.ny / nl, dz = sample.nz / nl;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const x = sample.px + dx * length * t;
    const y = sample.py + dy * length * t;
    const z = sample.pz + dz * length * t;
    pos[s * 3] = rest[s * 3] = prev[s * 3] = x;
    pos[s * 3 + 1] = rest[s * 3 + 1] = prev[s * 3 + 1] = y;
    pos[s * 3 + 2] = rest[s * 3 + 2] = prev[s * 3 + 2] = z;
  }
  return {
    rx: sample.px, ry: sample.py, rz: sample.pz,
    nx: dx, ny: dy, nz: dz,
    segments: segs, pos, rest, prev,
    length, thickness, clumpId, alive: true,
  };
}

export function generateStrands(opts: {
  count: number;
  segments: number;
  length: number;
  thickness?: number;
  seed?: number;
  samples?: ScalpSample[];
  lengthMap?: number;
  densityMap?: number;
}): FrostStrand[] {
  const seed = opts.seed ?? 1;
  const dens = Math.max(0.05, opts.densityMap ?? 1);
  const count = Math.max(1, Math.floor(opts.count * dens));
  const samples = opts.samples ?? proceduralScalpSamples(count, seed);
  const lenScale = Math.max(0.05, opts.lengthMap ?? 1);
  const thick = opts.thickness ?? 0.02;
  const out: FrostStrand[] = [];
  for (let i = 0; i < count; i++) {
    const s = samples[i % samples.length];
    const jitter = 0.85 + 0.3 * frostHash(i, 20, 21, seed);
    const clump = Math.floor(frostHash(i, 22, 23, seed) * 8);
    out.push(createStrand(s, opts.segments, opts.length * lenScale * jitter, thick, clump));
  }
  return out;
}

/** Non-destructive style layers write into rest (and optionally sync pos when not simulating). */
export function applyStyleLayers(strands: FrostStrand[], layers: StyleLayer[], seed = 1) {
  // Rebuild rest from straight growth, then stack layers
  for (const st of strands) {
    if (!st.alive) continue;
    for (let s = 0; s <= st.segments; s++) {
      const t = s / st.segments;
      st.rest[s * 3] = st.rx + st.nx * st.length * t;
      st.rest[s * 3 + 1] = st.ry + st.ny * st.length * t;
      st.rest[s * 3 + 2] = st.rz + st.nz * st.length * t;
    }
  }
  for (const layer of layers) {
    if (layer.muted || layer.strength === 0) continue;
    const k = Math.max(0, Math.min(1, layer.strength));
    if (layer.kind === 'comb') {
      const d = layer.direction ?? [1, 0, 0.15];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      const dx = d[0] / dl, dy = d[1] / dl, dz = d[2] / dl;
      for (const st of strands) {
        for (let s = 1; s <= st.segments; s++) {
          const t = s / st.segments;
          st.rest[s * 3] += dx * k * st.length * 0.35 * t;
          st.rest[s * 3 + 1] += dy * k * st.length * 0.15 * t;
          st.rest[s * 3 + 2] += dz * k * st.length * 0.35 * t;
        }
      }
    } else if (layer.kind === 'part') {
      const d = layer.direction ?? [1, 0, 0];
      for (const st of strands) {
        const side = st.rx * d[0] + st.rz * (d[2] || 0) >= 0 ? 1 : -1;
        for (let s = 1; s <= st.segments; s++) {
          const t = s / st.segments;
          st.rest[s * 3] += side * k * 0.25 * t;
          st.rest[s * 3 + 2] += side * k * 0.05 * t;
        }
      }
    } else if (layer.kind === 'clump') {
      // Pull tips toward clump centroid
      const centroids = new Map<number, { x: number; y: number; z: number; n: number }>();
      for (const st of strands) {
        const tip = st.segments;
        const c = centroids.get(st.clumpId) ?? { x: 0, y: 0, z: 0, n: 0 };
        c.x += st.rest[tip * 3]; c.y += st.rest[tip * 3 + 1]; c.z += st.rest[tip * 3 + 2]; c.n++;
        centroids.set(st.clumpId, c);
      }
      for (const st of strands) {
        const c = centroids.get(st.clumpId);
        if (!c || !c.n) continue;
        const tx = c.x / c.n, ty = c.y / c.n, tz = c.z / c.n;
        for (let s = 1; s <= st.segments; s++) {
          const t = (s / st.segments) * k;
          st.rest[s * 3] += (tx - st.rest[s * 3]) * t * 0.55;
          st.rest[s * 3 + 1] += (ty - st.rest[s * 3 + 1]) * t * 0.55;
          st.rest[s * 3 + 2] += (tz - st.rest[s * 3 + 2]) * t * 0.55;
        }
      }
    } else if (layer.kind === 'puff') {
      for (const st of strands) {
        for (let s = 1; s <= st.segments; s++) {
          const t = s / st.segments;
          const u = frostHash(s, st.clumpId, 40, seed) * 2 - 1;
          const v = frostHash(s, st.clumpId, 41, seed) * 2 - 1;
          st.rest[s * 3] += st.nx * k * 0.12 * t + u * k * 0.04 * t;
          st.rest[s * 3 + 1] += k * 0.08 * t;
          st.rest[s * 3 + 2] += st.nz * k * 0.12 * t + v * k * 0.04 * t;
        }
      }
    } else if (layer.kind === 'cut') {
      for (const st of strands) {
        const keep = Math.max(2, Math.floor(st.segments * (1 - k * 0.45)));
        // Shorten rest beyond keep by blending toward keep point
        const kx = st.rest[keep * 3], ky = st.rest[keep * 3 + 1], kz = st.rest[keep * 3 + 2];
        for (let s = keep + 1; s <= st.segments; s++) {
          const t = (s - keep) / Math.max(1, st.segments - keep);
          st.rest[s * 3] = kx + (st.rest[s * 3] - kx) * (1 - k) * (1 - t * 0.5);
          st.rest[s * 3 + 1] = ky + (st.rest[s * 3 + 1] - ky) * (1 - k) * (1 - t * 0.5);
          st.rest[s * 3 + 2] = kz + (st.rest[s * 3 + 2] - kz) * (1 - k) * (1 - t * 0.5);
        }
      }
    } else if (layer.kind === 'flyaway') {
      for (const st of strands) {
        if (frostHash(st.clumpId, 50, 51, seed) > 0.22) continue;
        for (let s = 1; s <= st.segments; s++) {
          const t = s / st.segments;
          const u = frostHash(s, 52, 53, seed) * 2 - 1;
          const v = frostHash(s, 54, 55, seed) * 2 - 1;
          st.rest[s * 3] += u * k * 0.2 * t;
          st.rest[s * 3 + 1] += Math.abs(v) * k * 0.1 * t;
          st.rest[s * 3 + 2] += v * k * 0.2 * t;
        }
      }
    }
  }
  // Enforce segment rest lengths roughly after layers
  for (const st of strands) {
    const segLen = st.length / st.segments;
    st.rest[0] = st.rx; st.rest[1] = st.ry; st.rest[2] = st.rz;
    for (let s = 1; s <= st.segments; s++) {
      const i = s * 3, j = (s - 1) * 3;
      let dx = st.rest[i] - st.rest[j], dy = st.rest[i + 1] - st.rest[j + 1], dz = st.rest[i + 2] - st.rest[j + 2];
      const L = Math.hypot(dx, dy, dz) || 1;
      dx = (dx / L) * segLen; dy = (dy / L) * segLen; dz = (dz / L) * segLen;
      st.rest[i] = st.rest[j] + dx;
      st.rest[i + 1] = st.rest[j + 1] + dy;
      st.rest[i + 2] = st.rest[j + 2] + dz;
    }
  }
}

function collidePoint(
  x: number, y: number, z: number,
  sphere: StrandSimParams['colliderSphere'],
  tris: Float32Array | null | undefined,
): Vec3 {
  let px = x, py = y, pz = z;
  if (sphere) {
    const dx = px - sphere.cx, dy = py - sphere.cy, dz = pz - sphere.cz;
    const d = Math.hypot(dx, dy, dz);
    if (d < sphere.r && d > 1e-8) {
      const s = sphere.r / d;
      px = sphere.cx + dx * s;
      py = sphere.cy + dy * s;
      pz = sphere.cz + dz * s;
    } else if (d <= 1e-8) {
      px = sphere.cx; py = sphere.cy + sphere.r; pz = sphere.cz;
    }
  }
  // Lightweight triangle push: only against AABB-ish by sampling triangle centroids as soft spheres
  if (tris && tris.length >= 9) {
    const softR = 0.08;
    for (let t = 0; t + 8 < tris.length; t += 9) {
      const cx = (tris[t] + tris[t + 3] + tris[t + 6]) / 3;
      const cy = (tris[t + 1] + tris[t + 4] + tris[t + 7]) / 3;
      const cz = (tris[t + 2] + tris[t + 5] + tris[t + 8]) / 3;
      const dx = px - cx, dy = py - cy, dz = pz - cz;
      const d = Math.hypot(dx, dy, dz);
      if (d < softR && d > 1e-8) {
        const s = softR / d;
        px = cx + dx * s; py = cy + dy * s; pz = cz + dz * s;
      }
    }
  }
  return [px, py, pz];
}

/** One Verlet dynamics tick for strand tips (root pinned). */
export function tickStrandDynamics(strands: FrostStrand[], p: StrandSimParams) {
  if (p.muted) {
    for (const st of strands) {
      st.pos.set(st.rest);
      st.prev.set(st.rest);
    }
    return;
  }
  const dt = Math.max(1e-4, p.dt);
  const damp = Math.max(0, Math.min(1, p.damping));
  const stiff = Math.max(0, Math.min(1, p.stiffness));
  const iters = Math.max(1, p.iterations | 0);
  const windT = p.windTurbulence;

  for (const st of strands) {
    if (!st.alive) continue;
    // Pin root
    st.pos[0] = st.rx; st.pos[1] = st.ry; st.pos[2] = st.rz;
    st.prev[0] = st.rx; st.prev[1] = st.ry; st.prev[2] = st.rz;

    for (let s = 1; s <= st.segments; s++) {
      const i = s * 3;
      const x = st.pos[i], y = st.pos[i + 1], z = st.pos[i + 2];
      const px = st.prev[i], py = st.prev[i + 1], pz = st.prev[i + 2];
      let vx = (x - px) * (1 - damp);
      let vy = (y - py) * (1 - damp);
      let vz = (z - pz) * (1 - damp);

      let fx = p.gravity[0] + p.wind[0];
      let fy = p.gravity[1] + p.wind[1];
      let fz = p.gravity[2] + p.wind[2];
      if (windT > 0) {
        const q: Vec3 = [x * 0.4, y * 0.4 + p.time * 0.7, z * 0.4];
        fx += frostTurbulence(q, 2, 3) * windT;
        fy += frostTurbulence([q[0] + 11, q[1], q[2]], 2, 4) * windT * 0.35;
        fz += frostTurbulence([q[0], q[1], q[2] + 7], 2, 5) * windT;
      }
      // Soft pull toward rest (style memory)
      fx += (st.rest[i] - x) * stiff * 18;
      fy += (st.rest[i + 1] - y) * stiff * 18;
      fz += (st.rest[i + 2] - z) * stiff * 18;

      st.prev[i] = x; st.prev[i + 1] = y; st.prev[i + 2] = z;
      st.pos[i] = x + vx + fx * dt * dt;
      st.pos[i + 1] = y + vy + fy * dt * dt;
      st.pos[i + 2] = z + vz + fz * dt * dt;
    }

    const segLen = st.length / st.segments;
    const maxStretch = segLen * Math.max(1, p.stretchLimit);
    for (let it = 0; it < iters; it++) {
      st.pos[0] = st.rx; st.pos[1] = st.ry; st.pos[2] = st.rz;
      for (let s = 1; s <= st.segments; s++) {
        const i = s * 3, j = (s - 1) * 3;
        let dx = st.pos[i] - st.pos[j], dy = st.pos[i + 1] - st.pos[j + 1], dz = st.pos[i + 2] - st.pos[j + 2];
        let L = Math.hypot(dx, dy, dz) || 1e-8;
        if (L > maxStretch) L = maxStretch;
        const target = segLen;
        const corr = (L - target) / L;
        // Move free point only (root side fixed when j==0 partially)
        if (s === 1) {
          st.pos[i] -= dx * corr;
          st.pos[i + 1] -= dy * corr;
          st.pos[i + 2] -= dz * corr;
        } else {
          st.pos[i] -= dx * corr * 0.5;
          st.pos[i + 1] -= dy * corr * 0.5;
          st.pos[i + 2] -= dz * corr * 0.5;
          st.pos[j] += dx * corr * 0.5;
          st.pos[j + 1] += dy * corr * 0.5;
          st.pos[j + 2] += dz * corr * 0.5;
        }
        const hit = collidePoint(st.pos[i], st.pos[i + 1], st.pos[i + 2], p.colliderSphere, p.colliderTris);
        st.pos[i] = hit[0]; st.pos[i + 1] = hit[1]; st.pos[i + 2] = hit[2];
      }
      st.pos[0] = st.rx; st.pos[1] = st.ry; st.pos[2] = st.rz;
    }
  }
}

/** Pack strand polylines for THREE.LineSegments (pairs of points). */
export function packStrandLineSegments(strands: FrostStrand[]): Float32Array {
  let segs = 0;
  for (const st of strands) if (st.alive) segs += st.segments;
  const out = new Float32Array(segs * 6);
  let o = 0;
  for (const st of strands) {
    if (!st.alive) continue;
    for (let s = 0; s < st.segments; s++) {
      const a = s * 3, b = (s + 1) * 3;
      out[o++] = st.pos[a]; out[o++] = st.pos[a + 1]; out[o++] = st.pos[a + 2];
      out[o++] = st.pos[b]; out[o++] = st.pos[b + 1]; out[o++] = st.pos[b + 2];
    }
  }
  return out;
}

export function strandCount(strands: FrostStrand[]): number {
  return strands.reduce((n, s) => n + (s.alive ? 1 : 0), 0);
}

/** Build a coarse triangle soup from mesh indices (or fan from verts) for collide. */
export function meshToColliderTris(
  positions: Float32Array,
  indices: Uint32Array | null | undefined,
  matrix: number[] | Float32Array | null,
  maxTris = 120,
): Float32Array {
  const m = matrix && matrix.length >= 16 ? matrix : null;
  const xform = (i: number): Vec3 => {
    let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (m) {
      const nx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ny = m[1] * x + m[5] * y + m[9] * z + m[13];
      const nz = m[2] * x + m[6] * y + m[10] * z + m[14];
      return [nx, ny, nz];
    }
    return [x, y, z];
  };
  const tris: number[] = [];
  if (indices && indices.length >= 3) {
    const step = Math.max(1, Math.floor((indices.length / 3) / maxTris));
    for (let t = 0; t + 2 < indices.length && tris.length / 9 < maxTris; t += 3 * step) {
      const a = xform(indices[t]), b = xform(indices[t + 1]), c = xform(indices[t + 2]);
      tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  } else {
    const n = Math.floor(positions.length / 3);
    const step = Math.max(1, Math.floor(n / (maxTris + 2)));
    for (let i = 0; i + 2 < n && tris.length / 9 < maxTris; i += step) {
      const a = xform(i), b = xform(Math.min(n - 1, i + 1)), c = xform(Math.min(n - 1, i + 2));
      tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  }
  return new Float32Array(tris);
}

export function meshBoundingSphere(
  positions: Float32Array,
  matrix: number[] | Float32Array | null,
): { cx: number; cy: number; cz: number; r: number } {
  const m = matrix && matrix.length >= 16 ? matrix : null;
  let cx = 0, cy = 0, cz = 0, n = Math.floor(positions.length / 3);
  if (n < 1) return { cx: 0, cy: 1, cz: 0, r: 0.5 };
  for (let i = 0; i < n; i++) {
    let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (m) {
      const nx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ny = m[1] * x + m[5] * y + m[9] * z + m[13];
      const nz = m[2] * x + m[6] * y + m[10] * z + m[14];
      x = nx; y = ny; z = nz;
    }
    cx += x; cy += y; cz += z;
  }
  cx /= n; cy /= n; cz /= n;
  let r = 0;
  for (let i = 0; i < n; i++) {
    let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (m) {
      const nx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ny = m[1] * x + m[5] * y + m[9] * z + m[13];
      const nz = m[2] * x + m[6] * y + m[10] * z + m[14];
      x = nx; y = ny; z = nz;
    }
    r = Math.max(r, Math.hypot(x - cx, y - cy, z - cz));
  }
  return { cx, cy, cz, r: r * 1.02 };
}
