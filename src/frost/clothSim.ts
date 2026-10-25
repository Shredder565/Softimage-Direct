/** CPU cloth mesh buffers + Verlet dynamics for FROST character cloth (P2). Not Syflex 1:1. */

import { frostHash, type Vec3 } from './math';

export interface FrostClothMesh {
  /** Interleaved xyz current positions. */
  pos: Float32Array;
  /** Rest / sew positions. */
  rest: Float32Array;
  /** Previous frame (Verlet). */
  prev: Float32Array;
  /** Per-vertex pin weight 0..1 (1 = fully pinned to rest/attach). */
  pin: Float32Array;
  /** Unique undirected edges as pairs of vertex indices. */
  edges: Uint32Array;
  /** Rest length per edge (parallel to edges, length = edges.length/2). */
  restLen: Float32Array;
  /** Triangle indices (flat ijk). */
  indices: Uint32Array;
  /** Grid dims when procedural (0 if from scene mesh). */
  cols: number;
  rows: number;
  alive: boolean;
}

export type ClothQuality = 'Playblast' | 'Preview' | 'Final';
export type FabricPresetName = 'Shirt' | 'Coat' | 'Cape' | 'Curtain';
export type PinRingMode = 'neck' | 'waist' | 'cuffs' | 'top' | 'custom';

export interface ClothFabricParams {
  mass: number;
  stretch: number;
  shear: number;
  bend: number;
  damping: number;
  gravity: Vec3;
}

export const FABRIC_PRESETS: Record<FabricPresetName, ClothFabricParams> = {
  Shirt: { mass: 1, stretch: 0.92, shear: 0.55, bend: 0.18, damping: 0.12, gravity: [0, -9.2, 0] },
  Coat: { mass: 1.35, stretch: 0.97, shear: 0.7, bend: 0.35, damping: 0.16, gravity: [0, -9.8, 0] },
  Cape: { mass: 0.85, stretch: 0.88, shear: 0.4, bend: 0.08, damping: 0.08, gravity: [0, -8.5, 0] },
  Curtain: { mass: 0.7, stretch: 0.85, shear: 0.35, bend: 0.05, damping: 0.1, gravity: [0, -7.5, 0] },
};

export const QUALITY_SETTINGS: Record<ClothQuality, {
  resolution: number;
  substeps: number;
  iterations: number;
  selfCollide: boolean;
  colliderTris: number;
  useMeshCollider: boolean;
}> = {
  Playblast: { resolution: 10, substeps: 1, iterations: 2, selfCollide: false, colliderTris: 0, useMeshCollider: false },
  Preview: { resolution: 14, substeps: 2, iterations: 4, selfCollide: false, colliderTris: 60, useMeshCollider: true },
  Final: { resolution: 18, substeps: 3, iterations: 6, selfCollide: true, colliderTris: 100, useMeshCollider: true },
};

export interface ClothSimParams {
  gravity: Vec3;
  damping: number;
  stretch: number;
  shear: number;
  bend: number;
  mass: number;
  substeps: number;
  iterations: number;
  selfCollide: boolean;
  thickness: number;
  wind: Vec3;
  dt: number;
  muted?: boolean;
  colliderSphere?: { cx: number; cy: number; cz: number; r: number } | null;
  colliderTris?: Float32Array | null;
}

/** Procedural shirt-like cylinder garment around a torso (default when no scene mesh). */
export function generateDefaultGarment(
  cols: number,
  rows: number,
  opts?: { radius?: number; height?: number; cy?: number; openFront?: boolean; seed?: number },
): FrostClothMesh {
  const radius = opts?.radius ?? 0.48;
  const height = opts?.height ?? 0.95;
  const cy = opts?.cy ?? 1.15;
  const openFront = opts?.openFront ?? false;
  const seed = opts?.seed ?? 1;
  const c = Math.max(4, cols | 0);
  const r = Math.max(3, rows | 0);
  const n = c * r;
  const pos = new Float32Array(n * 3);
  const rest = new Float32Array(n * 3);
  const prev = new Float32Array(n * 3);
  const pin = new Float32Array(n);

  for (let j = 0; j < r; j++) {
    const v = j / (r - 1);
    const y = cy + height * 0.5 - v * height;
    for (let i = 0; i < c; i++) {
      const u = i / c;
      // Leave a front slit for shirt/coat feel when openFront
      const ang = openFront
        ? (-Math.PI * 0.55 + u * Math.PI * 1.1)
        : (u * Math.PI * 2 - Math.PI);
      const wobble = 1 + (frostHash(i, j, 3, seed) - 0.5) * 0.02;
      const x = Math.cos(ang) * radius * wobble;
      const z = Math.sin(ang) * radius * wobble;
      const idx = (j * c + i) * 3;
      pos[idx] = x; pos[idx + 1] = y; pos[idx + 2] = z;
    }
  }
  rest.set(pos);
  prev.set(pos);

  const edges: number[] = [];
  const tris: number[] = [];
  const addEdge = (a: number, b: number) => {
    if (a > b) { const t = a; a = b; b = t; }
    edges.push(a, b);
  };
  for (let j = 0; j < r; j++) {
    for (let i = 0; i < c; i++) {
      const a = j * c + i;
      if (i + 1 < c) addEdge(a, a + 1);
      else if (!openFront) addEdge(a, j * c); // wrap seam
      if (j + 1 < r) addEdge(a, a + c);
      // diagonals (shear)
      if (i + 1 < c && j + 1 < r) {
        addEdge(a, a + c + 1);
        addEdge(a + 1, a + c);
        tris.push(a, a + 1, a + c);
        tris.push(a + 1, a + c + 1, a + c);
      } else if (!openFront && i + 1 === c && j + 1 < r) {
        const next = j * c;
        addEdge(a, next + c);
        tris.push(a, next, a + c);
        tris.push(next, next + c, a + c);
      }
    }
  }
  // Deduplicate edges
  const seen = new Set<string>();
  const uniq: number[] = [];
  for (let e = 0; e < edges.length; e += 2) {
    const key = `${edges[e]},${edges[e + 1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(edges[e], edges[e + 1]);
  }
  const edgeArr = new Uint32Array(uniq);
  const restLen = new Float32Array(edgeArr.length / 2);
  for (let e = 0; e < restLen.length; e++) {
    const a = edgeArr[e * 2] * 3, b = edgeArr[e * 2 + 1] * 3;
    restLen[e] = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]) || 1e-4;
  }

  return {
    pos, rest, prev, pin, edges: edgeArr, restLen,
    indices: new Uint32Array(tris),
    cols: c, rows: r, alive: true,
  };
}

/** Cape / curtain flat panel hanging from a top bar. */
export function generatePanelGarment(
  cols: number,
  rows: number,
  opts?: { width?: number; height?: number; cy?: number; seed?: number },
): FrostClothMesh {
  const width = opts?.width ?? 1.1;
  const height = opts?.height ?? 1.4;
  const cy = opts?.cy ?? 1.7;
  const seed = opts?.seed ?? 2;
  const c = Math.max(4, cols | 0);
  const r = Math.max(3, rows | 0);
  const n = c * r;
  const pos = new Float32Array(n * 3);
  for (let j = 0; j < r; j++) {
    const v = j / (r - 1);
    for (let i = 0; i < c; i++) {
      const u = i / (c - 1);
      const idx = (j * c + i) * 3;
      pos[idx] = (u - 0.5) * width + (frostHash(i, j, 1, seed) - 0.5) * 0.01;
      pos[idx + 1] = cy - v * height;
      pos[idx + 2] = -0.15 + (frostHash(i, j, 2, seed) - 0.5) * 0.01;
    }
  }
  const rest = new Float32Array(pos);
  const prev = new Float32Array(pos);
  const pin = new Float32Array(n);
  const edges: number[] = [];
  const tris: number[] = [];
  for (let j = 0; j < r; j++) {
    for (let i = 0; i < c; i++) {
      const a = j * c + i;
      if (i + 1 < c) edges.push(a, a + 1);
      if (j + 1 < r) edges.push(a, a + c);
      if (i + 1 < c && j + 1 < r) {
        edges.push(a, a + c + 1);
        edges.push(a + 1, a + c);
        tris.push(a, a + 1, a + c);
        tris.push(a + 1, a + c + 1, a + c);
      }
    }
  }
  const edgeArr = new Uint32Array(edges);
  const restLen = new Float32Array(edgeArr.length / 2);
  for (let e = 0; e < restLen.length; e++) {
    const a = edgeArr[e * 2] * 3, b = edgeArr[e * 2 + 1] * 3;
    restLen[e] = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]) || 1e-4;
  }
  return {
    pos, rest, prev, pin, edges: edgeArr, restLen,
    indices: new Uint32Array(tris),
    cols: c, rows: r, alive: true,
  };
}

/** Bind a scene mesh as the garment (world-space copy; remesh ≈ downsample verts). */
export function clothFromMesh(
  positions: Float32Array,
  indices: Uint32Array | null | undefined,
  matrix: number[] | Float32Array | null,
  maxVerts = 220,
): FrostClothMesh {
  const m = matrix && matrix.length >= 16 ? matrix : null;
  const nAll = Math.floor(positions.length / 3);
  const step = Math.max(1, Math.ceil(nAll / Math.max(8, maxVerts)));
  const map = new Map<number, number>();
  const world: number[] = [];
  for (let i = 0; i < nAll; i += step) {
    let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (m) {
      const nx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ny = m[1] * x + m[5] * y + m[9] * z + m[13];
      const nz = m[2] * x + m[6] * y + m[10] * z + m[14];
      x = nx; y = ny; z = nz;
    }
    map.set(i, world.length / 3);
    world.push(x, y, z);
  }
  const n = world.length / 3;
  const pos = new Float32Array(world);
  const rest = new Float32Array(pos);
  const prev = new Float32Array(pos);
  const pin = new Float32Array(n);

  const edgeSet = new Set<string>();
  const pushEdge = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0) return;
    if (a > b) { const t = a; a = b; b = t; }
    edgeSet.add(`${a},${b}`);
  };
  const tris: number[] = [];
  if (indices && indices.length >= 3) {
    for (let t = 0; t + 2 < indices.length; t += 3) {
      const ia = map.get(Math.floor(indices[t] / 1) - (indices[t] % step === 0 ? 0 : 0));
      // Remap original indices to nearest kept vert
      const raw = [indices[t], indices[t + 1], indices[t + 2]].map(orig => {
        const nearest = Math.round(orig / step) * step;
        const clamped = Math.min(nAll - 1, Math.max(0, nearest));
        // walk to a mapped index
        for (let d = 0; d < step; d++) {
          if (map.has(clamped - d)) return map.get(clamped - d)!;
          if (map.has(clamped + d)) return map.get(clamped + d)!;
        }
        return map.get(0) ?? 0;
      });
      void ia;
      if (raw[0] === raw[1] || raw[1] === raw[2] || raw[0] === raw[2]) continue;
      tris.push(raw[0], raw[1], raw[2]);
      pushEdge(raw[0], raw[1]); pushEdge(raw[1], raw[2]); pushEdge(raw[2], raw[0]);
    }
  }
  // If remesh lost connectivity, chain nearest-neighbor edges for a soft cloth
  if (edgeSet.size < n) {
    for (let i = 0; i < n; i++) {
      let best = -1, bestD = 1e9;
      let best2 = -1, bestD2 = 1e9;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]);
        if (d < bestD) { best2 = best; bestD2 = bestD; best = j; bestD = d; }
        else if (d < bestD2) { best2 = j; bestD2 = d; }
      }
      if (best >= 0) pushEdge(i, best);
      if (best2 >= 0) pushEdge(i, best2);
    }
  }
  const edges: number[] = [];
  for (const key of edgeSet) {
    const [a, b] = key.split(',').map(Number);
    edges.push(a, b);
  }
  const edgeArr = new Uint32Array(edges);
  const restLen = new Float32Array(edgeArr.length / 2);
  for (let e = 0; e < restLen.length; e++) {
    const a = edgeArr[e * 2] * 3, b = edgeArr[e * 2 + 1] * 3;
    restLen[e] = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]) || 1e-4;
  }
  return {
    pos, rest, prev, pin, edges: edgeArr, restLen,
    indices: new Uint32Array(tris),
    cols: 0, rows: 0, alive: true,
  };
}

/** Paint pin rings by height percentile of the garment bbox (neck / waist / cuffs / top). */
export function applyPinRings(cloth: FrostClothMesh, rings: PinRingMode[], strength = 1) {
  cloth.pin.fill(0);
  const n = cloth.pin.length;
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = cloth.rest[i * 3 + 1];
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }
  const span = Math.max(1e-4, ymax - ymin);
  for (let i = 0; i < n; i++) {
    const y = cloth.rest[i * 3 + 1];
    const t = (y - ymin) / span; // 0 bottom … 1 top
    let w = 0;
    for (const ring of rings) {
      if (ring === 'neck' || ring === 'top') {
        if (t > 0.88) w = Math.max(w, (t - 0.88) / 0.12);
      }
      if (ring === 'waist') {
        if (t > 0.35 && t < 0.55) w = Math.max(w, 1 - Math.abs(t - 0.45) / 0.1);
      }
      if (ring === 'cuffs') {
        // Side verts near mid-height (sleeve stand-in on cylinder)
        const x = cloth.rest[i * 3], z = cloth.rest[i * 3 + 2];
        const side = Math.abs(x) > Math.abs(z) ? Math.abs(x) : 0;
        if (t > 0.55 && t < 0.85 && side > 0.35) w = Math.max(w, 0.85);
      }
    }
    cloth.pin[i] = Math.min(1, w * strength);
  }
}

export function pinModeForFabric(fabric: FabricPresetName): PinRingMode[] {
  if (fabric === 'Cape' || fabric === 'Curtain') return ['top'];
  if (fabric === 'Coat') return ['neck', 'cuffs'];
  return ['neck', 'waist']; // Shirt
}

function collidePoint(
  x: number, y: number, z: number,
  sphere: ClothSimParams['colliderSphere'],
  tris: Float32Array | null | undefined,
  thickness: number,
): Vec3 {
  let px = x, py = y, pz = z;
  const rOff = Math.max(0, thickness);
  if (sphere) {
    const r = sphere.r + rOff;
    const dx = px - sphere.cx, dy = py - sphere.cy, dz = pz - sphere.cz;
    const d = Math.hypot(dx, dy, dz);
    if (d < r && d > 1e-8) {
      const s = r / d;
      px = sphere.cx + dx * s;
      py = sphere.cy + dy * s;
      pz = sphere.cz + dz * s;
    } else if (d <= 1e-8) {
      px = sphere.cx; py = sphere.cy + r; pz = sphere.cz;
    }
  }
  if (tris && tris.length >= 9) {
    const softR = 0.07 + rOff;
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

/** One (or substepped) Verlet cloth tick. */
export function tickClothDynamics(cloth: FrostClothMesh, p: ClothSimParams) {
  if (!cloth.alive) return;
  if (p.muted) {
    cloth.pos.set(cloth.rest);
    cloth.prev.set(cloth.rest);
    return;
  }
  const dt = Math.max(1e-4, p.dt);
  const sub = Math.max(1, p.substeps | 0);
  const h = dt / sub;
  const damp = Math.max(0, Math.min(0.95, p.damping));
  const stretchK = Math.max(0.05, Math.min(1, p.stretch));
  const iters = Math.max(1, p.iterations | 0);
  const invMass = 1 / Math.max(0.2, p.mass);

  for (let s = 0; s < sub; s++) {
    const n = cloth.pin.length;
    for (let i = 0; i < n; i++) {
      const pinW = cloth.pin[i];
      if (pinW >= 0.999) {
        const i3 = i * 3;
        cloth.pos[i3] = cloth.rest[i3];
        cloth.pos[i3 + 1] = cloth.rest[i3 + 1];
        cloth.pos[i3 + 2] = cloth.rest[i3 + 2];
        cloth.prev[i3] = cloth.rest[i3];
        cloth.prev[i3 + 1] = cloth.rest[i3 + 1];
        cloth.prev[i3 + 2] = cloth.rest[i3 + 2];
        continue;
      }
      const i3 = i * 3;
      const x = cloth.pos[i3], y = cloth.pos[i3 + 1], z = cloth.pos[i3 + 2];
      const px = cloth.prev[i3], py = cloth.prev[i3 + 1], pz = cloth.prev[i3 + 2];
      let vx = (x - px) * (1 - damp);
      let vy = (y - py) * (1 - damp);
      let vz = (z - pz) * (1 - damp);
      const ax = (p.gravity[0] + p.wind[0]) * invMass;
      const ay = (p.gravity[1] + p.wind[1]) * invMass;
      const az = (p.gravity[2] + p.wind[2]) * invMass;
      cloth.prev[i3] = x; cloth.prev[i3 + 1] = y; cloth.prev[i3 + 2] = z;
      let nx = x + vx + ax * h * h;
      let ny = y + vy + ay * h * h;
      let nz = z + vz + az * h * h;
      if (pinW > 0) {
        nx = nx + (cloth.rest[i3] - nx) * pinW;
        ny = ny + (cloth.rest[i3 + 1] - ny) * pinW;
        nz = nz + (cloth.rest[i3 + 2] - nz) * pinW;
      }
      cloth.pos[i3] = nx; cloth.pos[i3 + 1] = ny; cloth.pos[i3 + 2] = nz;
    }

    for (let it = 0; it < iters; it++) {
      const edgeCount = cloth.restLen.length;
      for (let e = 0; e < edgeCount; e++) {
        const ia = cloth.edges[e * 2], ib = cloth.edges[e * 2 + 1];
        const a = ia * 3, b = ib * 3;
        let dx = cloth.pos[b] - cloth.pos[a];
        let dy = cloth.pos[b + 1] - cloth.pos[a + 1];
        let dz = cloth.pos[b + 2] - cloth.pos[a + 2];
        const L = Math.hypot(dx, dy, dz) || 1e-8;
        const target = cloth.restLen[e];
        const corr = ((L - target) / L) * stretchK;
        const wa = 1 - cloth.pin[ia];
        const wb = 1 - cloth.pin[ib];
        const wsum = wa + wb;
        if (wsum < 1e-8) continue;
        const ca = corr * (wa / wsum);
        const cb = corr * (wb / wsum);
        cloth.pos[a] += dx * ca;
        cloth.pos[a + 1] += dy * ca;
        cloth.pos[a + 2] += dz * ca;
        cloth.pos[b] -= dx * cb;
        cloth.pos[b + 1] -= dy * cb;
        cloth.pos[b + 2] -= dz * cb;
      }

      // Soft bend: pull toward rest slightly (fabric memory)
      const bend = Math.max(0, Math.min(1, p.bend)) * 0.08;
      if (bend > 0) {
        for (let i = 0; i < n; i++) {
          if (cloth.pin[i] >= 0.999) continue;
          const i3 = i * 3;
          const free = 1 - cloth.pin[i];
          cloth.pos[i3] += (cloth.rest[i3] - cloth.pos[i3]) * bend * free;
          cloth.pos[i3 + 1] += (cloth.rest[i3 + 1] - cloth.pos[i3 + 1]) * bend * free;
          cloth.pos[i3 + 2] += (cloth.rest[i3 + 2] - cloth.pos[i3 + 2]) * bend * free;
        }
      }

      // Collide
      for (let i = 0; i < n; i++) {
        if (cloth.pin[i] >= 0.999) continue;
        const i3 = i * 3;
        const hit = collidePoint(cloth.pos[i3], cloth.pos[i3 + 1], cloth.pos[i3 + 2], p.colliderSphere, p.colliderTris, p.thickness);
        cloth.pos[i3] = hit[0]; cloth.pos[i3 + 1] = hit[1]; cloth.pos[i3 + 2] = hit[2];
      }

      // Cheap self-collide: push overlapping verts apart (Final quality)
      if (p.selfCollide) {
        const minD = 0.045 + p.thickness;
        const stride = Math.max(1, Math.floor(n / 80));
        for (let i = 0; i < n; i += stride) {
          if (cloth.pin[i] >= 0.999) continue;
          const i3 = i * 3;
          for (let j = i + stride; j < n; j += stride) {
            if (cloth.pin[j] >= 0.999) continue;
            const j3 = j * 3;
            let dx = cloth.pos[j3] - cloth.pos[i3];
            let dy = cloth.pos[j3 + 1] - cloth.pos[i3 + 1];
            let dz = cloth.pos[j3 + 2] - cloth.pos[i3 + 2];
            const d = Math.hypot(dx, dy, dz);
            if (d < minD && d > 1e-8) {
              const push = (minD - d) * 0.5 / d;
              cloth.pos[i3] -= dx * push; cloth.pos[i3 + 1] -= dy * push; cloth.pos[i3 + 2] -= dz * push;
              cloth.pos[j3] += dx * push; cloth.pos[j3 + 1] += dy * push; cloth.pos[j3 + 2] += dz * push;
            }
          }
        }
      }
    }
  }
}

/** Run N settle ticks without changing external frame (pre-roll replacement). */
export function settleCloth(cloth: FrostClothMesh, p: ClothSimParams, frames: number) {
  const n = Math.max(0, frames | 0);
  for (let i = 0; i < n; i++) tickClothDynamics(cloth, p);
}

/** Frame cache: scrub without re-sim once baked. */
export class ClothFrameCache {
  private frames = new Map<number, Float32Array>();
  enabled = false;

  clear() { this.frames.clear(); }

  bake(frame: number, pos: Float32Array) {
    this.frames.set(frame | 0, pos.slice());
  }

  get(frame: number): Float32Array | null {
    return this.frames.get(frame | 0) ?? null;
  }

  get size() { return this.frames.size; }

  has(frame: number) { return this.frames.has(frame | 0); }
}

export function clothVertexCount(cloth: FrostClothMesh | null | undefined): number {
  return cloth?.alive ? cloth.pin.length : 0;
}

/** Packed positions for Points / Mesh attribute sync. */
export function packClothPositions(cloth: FrostClothMesh | null | undefined): Float32Array {
  if (!cloth?.alive) return new Float32Array(0);
  return cloth.pos.slice();
}

/** Wireframe line segments for viewport overlay. */
export function packClothWireframe(cloth: FrostClothMesh | null | undefined): Float32Array {
  if (!cloth?.alive) return new Float32Array(0);
  const e = cloth.edges.length / 2;
  const out = new Float32Array(e * 6);
  let o = 0;
  for (let i = 0; i < e; i++) {
    const a = cloth.edges[i * 2] * 3, b = cloth.edges[i * 2 + 1] * 3;
    out[o++] = cloth.pos[a]; out[o++] = cloth.pos[a + 1]; out[o++] = cloth.pos[a + 2];
    out[o++] = cloth.pos[b]; out[o++] = cloth.pos[b + 1]; out[o++] = cloth.pos[b + 2];
  }
  return out;
}
