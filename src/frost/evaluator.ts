/** Deterministic CPU FROST evaluator — emit + integrate (+ turbulize force). */

import type { FrostGraphIR, FrostNodeIR } from './ir';
import { FROST_NODES } from './nodes';

export type Vec3 = [number, number, number];

export interface FrostParticle {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  fx: number; fy: number; fz: number;
  age: number;
  life: number;
  size: number;
  alive: boolean;
  seed: number;
}

export interface FrostEvalState {
  frame: number;
  time: number;
  particles: FrostParticle[];
  /** Accumulated emit remainder for fractional rates. */
  emitCarry: number;
  attrs: Map<string, Float32Array | number[]>;
}

export interface FrostTickOpts {
  frame: number;
  dt?: number;
  fps?: number;
}

const EPS = 1e-9;

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

export function createFrostState(): FrostEvalState {
  return { frame: 0, time: 0, particles: [], emitCarry: 0, attrs: new Map() };
}

function asVec3(v: unknown, fallback: Vec3 = [0, 0, 0]): Vec3 {
  if (Array.isArray(v) && v.length >= 3) return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
  return [...fallback] as Vec3;
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function topoOrder(graph: FrostGraphIR): FrostNodeIR[] {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const indeg = new Map(graph.nodes.map(n => [n.id, 0]));
  const outs = new Map<string, string[]>();
  for (const l of graph.links) {
    indeg.set(l.to, (indeg.get(l.to) ?? 0) + 1);
    const arr = outs.get(l.from) ?? [];
    arr.push(l.to);
    outs.set(l.from, arr);
  }
  const q = graph.nodes.filter(n => (indeg.get(n.id) ?? 0) === 0).map(n => n.id);
  const ordered: FrostNodeIR[] = [];
  while (q.length) {
    const id = q.shift()!;
    const n = byId.get(id);
    if (n) ordered.push(n);
    for (const to of outs.get(id) ?? []) {
      const d = (indeg.get(to) ?? 1) - 1;
      indeg.set(to, d);
      if (d === 0) q.push(to);
    }
  }
  // Append orphans / cycle leftovers in original order
  for (const n of graph.nodes) if (!ordered.includes(n)) ordered.push(n);
  return ordered;
}

function incoming(graph: FrostGraphIR, nodeId: string, port: string): { from: string; fromPort: string } | null {
  const l = graph.links.find(x => x.to === nodeId && x.toPort === port);
  return l ? { from: l.from, fromPort: l.fromPort } : null;
}

function emitParticles(state: FrostEvalState, node: FrostNodeIR, count: number) {
  const rateSeed = num(node.params.seed, 1) | 0;
  const life = Math.max(1, num(node.params.lifetime, 60));
  const size = num(node.params.size, 0.15);
  const speed = num(node.params.speed, 2);
  const spread = num(node.params.spread, 0.35);
  const dir = asVec3(node.params.direction, [0, 1, 0]);
  const origin = asVec3(node.params.position, [0, 0, 0]);
  const maxP = Math.max(1, num(node.params.maxParticles, 800) | 0);
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const dx = dir[0] / dl, dy = dir[1] / dl, dz = dir[2] / dl;

  for (let i = 0; i < count; i++) {
    if (state.particles.filter(p => p.alive).length >= maxP) break;
    const birth = state.particles.length + i + state.frame * 997;
    const u = frostHash(birth, 1, 2, rateSeed) * 2 - 1;
    const v = frostHash(birth, 3, 4, rateSeed) * 2 - 1;
    const w = frostHash(birth, 5, 6, rateSeed) * 2 - 1;
    // orthonormal-ish jitter around direction
    const jx = dx + u * spread, jy = dy + v * spread, jz = dz + w * spread;
    const jl = Math.hypot(jx, jy, jz) || 1;
    const sp = speed * (0.7 + 0.6 * frostHash(birth, 7, 8, rateSeed));
    const p: FrostParticle = {
      px: origin[0], py: origin[1], pz: origin[2],
      vx: (jx / jl) * sp, vy: (jy / jl) * sp, vz: (jz / jl) * sp,
      fx: 0, fy: 0, fz: 0,
      age: 0, life, size, alive: true, seed: birth ^ rateSeed,
    };
    // reuse dead slots
    const slot = state.particles.findIndex(x => !x.alive);
    if (slot >= 0) state.particles[slot] = p;
    else state.particles.push(p);
  }
}

function turbulizeForce(p: FrostParticle, node: FrostNodeIR, time: number): Vec3 {
  const amp = num(node.params.amplitude, 4);
  const freq = num(node.params.frequency, 0.35);
  const oct = Math.max(1, num(node.params.octaves, 3) | 0);
  const seed = num(node.params.seed, 7) | 0;
  const ts = num(node.params.timeScale, 0.4);
  const q: Vec3 = [p.px * freq, p.py * freq + time * ts, p.pz * freq];
  return [
    frostTurbulence(q, oct, seed) * amp,
    frostTurbulence([q[0] + 31.7, q[1], q[2]], oct, seed + 1) * amp,
    frostTurbulence([q[0], q[1], q[2] + 17.3], oct, seed + 2) * amp,
  ];
}

function integrate(state: FrostEvalState, node: FrostNodeIR, forceAdd: Vec3, dt: number) {
  const g = asVec3(node.params.gravity, [0, -9.8, 0]);
  const drag = Math.max(0, num(node.params.drag, 0.02));
  const sub = Math.max(1, num(node.params.substeps, 1) | 0);
  const h = dt / sub;
  for (let s = 0; s < sub; s++) {
    for (const p of state.particles) {
      if (!p.alive) continue;
      const ax = g[0] + forceAdd[0] + p.fx;
      const ay = g[1] + forceAdd[1] + p.fy;
      const az = g[2] + forceAdd[2] + p.fz;
      p.vx += ax * h; p.vy += ay * h; p.vz += az * h;
      const damp = Math.max(0, 1 - drag * h);
      p.vx *= damp; p.vy *= damp; p.vz *= damp;
      p.px += p.vx * h; p.py += p.vy * h; p.pz += p.vz * h;
      p.age += h * 30; // age in frames @30fps units when dt=1/30
      if (p.age >= p.life) p.alive = false;
      p.fx = p.fy = p.fz = 0;
    }
  }
}

/**
 * Advance one evaluation tick.
 * - simulated graphs: emit + integrate with carried particle state
 * - procedural graphs: reset particles each tick then emit (no carry)
 */
export function tickFrost(graph: FrostGraphIR, state: FrostEvalState, opts: FrostTickOpts): FrostEvalState {
  const fps = opts.fps && opts.fps > 0 ? opts.fps : 30;
  const dt = opts.dt ?? (1 / fps);
  const frame = opts.frame;

  if (!graph.simulated) {
    state.particles = [];
    state.emitCarry = 0;
  } else if (frame < state.frame) {
    // scrub backward → hard reset (MVP)
    state.particles = [];
    state.emitCarry = 0;
  }

  state.frame = frame;
  state.time = frame / fps;

  const ordered = topoOrder(graph);
  const nodeOut = new Map<string, Record<string, unknown>>();
  let forceSum: Vec3 = [0, 0, 0];
  let didEmit = false;
  let didSim = false;

  for (const node of ordered) {
    const def = FROST_NODES[node.type];
    if (!def) { nodeOut.set(node.id, {}); continue; }
    const out: Record<string, unknown> = {};

    if (node.type === 'Emit') {
      const rate = Math.max(0, num(node.params.rate, 12));
      state.emitCarry += rate;
      const n = Math.floor(state.emitCarry + EPS);
      state.emitCarry -= n;
      emitParticles(state, node, n);
      didEmit = true;
      out.execute = true;
      out.cloud = 'particles';
    } else if (node.type === 'Turbulize') {
      // Sample field at each particle and accumulate into particle force (and global force sum for Simulate)
      let sx = 0, sy = 0, sz = 0, c = 0;
      for (const p of state.particles) {
        if (!p.alive) continue;
        const f = turbulizeForce(p, node, state.time);
        p.fx += f[0]; p.fy += f[1]; p.fz += f[2];
        sx += f[0]; sy += f[1]; sz += f[2]; c++;
      }
      const inv = c ? 1 / c : 0;
      out.force = [sx * inv, sy * inv, sz * inv] as Vec3;
      forceSum = [forceSum[0] + sx * inv, forceSum[1] + sy * inv, forceSum[2] + sz * inv];
      out.execute = true;
    } else if (node.type === 'Gravity') {
      const g = asVec3(node.params.gravity, [0, -9.8, 0]);
      out.force = g;
      forceSum = [forceSum[0] + g[0], forceSum[1] + g[1], forceSum[2] + g[2]];
    } else if (node.type === 'SimulateParticles') {
      // Optional force from linked Turbulize/Gravity ports
      const forceLink = incoming(graph, node.id, 'force');
      let add: Vec3 = [0, 0, 0];
      if (forceLink) {
        const fo = nodeOut.get(forceLink.from)?.[forceLink.fromPort];
        if (Array.isArray(fo)) add = asVec3(fo);
      } else {
        add = forceSum;
      }
      // Prefer Simulate's own gravity param; linked Gravity force is additive via force port
      integrate(state, node, add, dt);
      didSim = true;
      out.execute = true;
      out.cloud = 'particles';
    } else if (node.type === 'GetAttr') {
      const name = String(node.params.name ?? 'PointPosition');
      // MVP: expose first alive particle sample / counts for probes
      const alive = state.particles.filter(p => p.alive);
      if (name === 'NbPoints') out.value = alive.length;
      else if (name === 'Frame') out.value = frame;
      else if (name === 'Time') out.value = state.time;
      else if (name === 'PointPosition' && alive[0]) out.value = [alive[0].px, alive[0].py, alive[0].pz];
      else if (name === 'PointVelocity' && alive[0]) out.value = [alive[0].vx, alive[0].vy, alive[0].vz];
      else out.value = 0;
    } else if (node.type === 'SetAttr') {
      const name = String(node.params.name ?? 'PointColor');
      const vin = incoming(graph, node.id, 'value');
      let value: unknown = node.params.value;
      if (vin) value = nodeOut.get(vin.from)?.[vin.fromPort];
      // Store as global attr buffer (MVP: uniform color/size applied to all)
      if (name === 'PointSize' && typeof value === 'number') {
        for (const p of state.particles) if (p.alive) p.size = value;
      }
      state.attrs.set(name, Array.isArray(value) ? value as number[] : [num(value)]);
      out.execute = true;
    }

    nodeOut.set(node.id, out);
  }

  // Safety: if graph has Emit but no Simulate, still age nothing — particles sit at birth
  void didEmit; void didSim;
  return state;
}

/** Packed positions of alive particles (xyz interleaved). */
export function frostPositions(state: FrostEvalState): Float32Array {
  const alive = state.particles.filter(p => p.alive);
  const out = new Float32Array(alive.length * 3);
  for (let i = 0; i < alive.length; i++) {
    const p = alive[i];
    out[i * 3] = p.px; out[i * 3 + 1] = p.py; out[i * 3 + 2] = p.pz;
  }
  return out;
}

export function aliveCount(state: FrostEvalState): number {
  return state.particles.reduce((n, p) => n + (p.alive ? 1 : 0), 0);
}
