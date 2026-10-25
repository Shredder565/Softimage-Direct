/** Deterministic CPU FROST evaluator — particles + hair strands + cloth. */

import type { FrostGraphIR, FrostNodeIR } from './ir';
import { FROST_NODES } from './nodes';
import { frostHash, frostTurbulence, type Vec3 } from './math';
import {
  applyStyleLayers,
  generateStrands,
  meshBoundingSphere,
  meshToColliderTris,
  packStrandLineSegments,
  proceduralScalpSamples,
  scalpSamplesFromMesh,
  strandCount,
  tickStrandDynamics,
  defaultStyleLayers,
  type FrostStrand,
  type StyleLayer,
} from './strands';
import {
  applyPinRings,
  clothFromMesh,
  ClothFrameCache,
  generateDefaultGarment,
  generatePanelGarment,
  packClothPositions,
  packClothWireframe,
  clothVertexCount,
  tickClothDynamics,
  type FrostClothMesh,
  type PinRingMode,
  QUALITY_SETTINGS,
  type ClothQuality,
} from './clothSim';

export type { Vec3 } from './math';
export { frostHash, frostNoise3, frostTurbulence } from './math';

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

export interface FrostMeshBinding {
  name: string;
  positions: Float32Array;
  indices?: Uint32Array | null;
  /** Column-major 4x4 world matrix. */
  matrix?: number[] | Float32Array | null;
}

export interface FrostEvalState {
  frame: number;
  time: number;
  particles: FrostParticle[];
  /** Accumulated emit remainder for fractional rates. */
  emitCarry: number;
  attrs: Map<string, Float32Array | number[]>;
  /** Character hair strand buffers (P1). */
  strands: FrostStrand[];
  /** True after CreateStrands builds buffers for the current recipe stamp. */
  strandsReady: boolean;
  strandStamp: string;
  /** Character cloth mesh (P2). */
  cloth: FrostClothMesh | null;
  clothReady: boolean;
  clothStamp: string;
  clothCache: ClothFrameCache;
  /** Request settle N frames once (wizard / ClothCache). */
  settlePending: number;
}

export interface FrostTickOpts {
  frame: number;
  dt?: number;
  fps?: number;
  /** Scene mesh bindings keyed by object name (scalp / body). */
  meshes?: Record<string, FrostMeshBinding>;
}

const EPS = 1e-9;

export function createFrostState(): FrostEvalState {
  return {
    frame: 0, time: 0, particles: [], emitCarry: 0, attrs: new Map(),
    strands: [], strandsReady: false, strandStamp: '',
    cloth: null, clothReady: false, clothStamp: '',
    clothCache: new ClothFrameCache(), settlePending: 0,
  };
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
    state.strandsReady = false;
    state.clothReady = false;
  } else if (frame < state.frame) {
    // scrub backward → hard reset (MVP) unless cloth cache can serve the frame
    const hasClothCache = state.clothCache.enabled && state.clothCache.has(frame);
    state.particles = [];
    state.emitCarry = 0;
    state.strandsReady = false;
    if (!hasClothCache) state.clothReady = false;
  }

  state.frame = frame;
  state.time = frame / fps;

  const ordered = topoOrder(graph);
  const nodeOut = new Map<string, Record<string, unknown>>();
  let forceSum: Vec3 = [0, 0, 0];
  let didEmit = false;
  let didSim = false;
  let windForce: Vec3 = [0, 0, 0];
  let windTurb = 0;
  let colliderSphere: { cx: number; cy: number; cz: number; r: number } | null = null;
  let colliderTris: Float32Array | null = null;
  let colliderThickness = 0.04;
  let styleLayers: StyleLayer[] = [];
  let fabricParams: {
    mass: number; stretch: number; shear: number; bend: number; damping: number; gravity: Vec3;
  } | null = null;
  const meshes = opts.meshes ?? {};

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
    } else if (node.type === 'CreateStrands') {
      const stamp = strandRecipeStamp(node, graph);
      if (!state.strandsReady || state.strandStamp !== stamp) {
        const count = Math.max(1, num(node.params.guideCount, 64) | 0);
        const segments = Math.max(2, num(node.params.segments, 8) | 0);
        const length = Math.max(0.05, num(node.params.length, 1.2));
        const seed = num(node.params.seed, 1) | 0;
        const scalpName = String(node.params.scalpObject ?? '');
        const mesh = scalpName ? meshes[scalpName] : undefined;
        const samples = mesh
          ? scalpSamplesFromMesh(mesh.positions, mesh.matrix ?? null, count, seed)
          : proceduralScalpSamples(count, seed);
        state.strands = generateStrands({
          count,
          segments,
          length,
          thickness: num(node.params.thickness, 0.02),
          seed,
          samples,
          lengthMap: num(node.params.lengthMap, 1),
          densityMap: num(node.params.densityMap, 1),
        });
        state.strandsReady = true;
        state.strandStamp = stamp;
      }
      out.execute = true;
      out.strands = 'strands';
    } else if (node.type === 'StyleLayers') {
      styleLayers = parseStyleLayers(node.params.layers);
      applyStyleLayers(state.strands, styleLayers, num(node.params.seed, 1) | 0);
      // When sim is muted or first frame after rebuild, snap to rest
      if (!graph.simulated || frame <= 1 || !!node.params.snapToRest) {
        for (const st of state.strands) { st.pos.set(st.rest); st.prev.set(st.rest); }
      }
      out.execute = true;
      out.strands = 'strands';
    } else if (node.type === 'CollideBody') {
      const bodyName = String(node.params.bodyObject ?? '');
      const quality = String(node.params.quality ?? 'Preview');
      colliderThickness = num(node.params.thickness, 0.04);
      const mesh = bodyName ? meshes[bodyName] : undefined;
      if (mesh) {
        colliderSphere = meshBoundingSphere(mesh.positions, mesh.matrix ?? null);
        if (quality !== 'Playblast') {
          colliderTris = meshToColliderTris(mesh.positions, mesh.indices ?? null, mesh.matrix ?? null, 80);
        } else {
          colliderTris = null; // capsules / sphere only
        }
      } else if (node.params.useDefaultBody !== false) {
        colliderSphere = { cx: 0, cy: 0.85, cz: 0, r: 0.42 };
      }
      out.execute = true;
      out.geometry = bodyName || 'defaultBody';
    } else if (node.type === 'CreateCloth') {
      const stamp = clothRecipeStamp(node, graph);
      if (!state.clothReady || state.clothStamp !== stamp) {
        const res = Math.max(4, num(node.params.resolution, 14) | 0);
        const seed = num(node.params.seed, 5) | 0;
        const garmentName = String(node.params.garmentObject ?? '');
        const mesh = garmentName ? meshes[garmentName] : undefined;
        const shape = String(node.params.shape ?? 'shirt');
        if (mesh) {
          state.cloth = clothFromMesh(mesh.positions, mesh.indices ?? null, mesh.matrix ?? null, res * res);
        } else if (shape === 'panel') {
          state.cloth = generatePanelGarment(res, Math.max(4, Math.round(res * 1.2)), { seed });
        } else {
          state.cloth = generateDefaultGarment(res, Math.max(4, Math.round(res * 0.75)), {
            openFront: true, seed,
          });
        }
        state.clothReady = true;
        state.clothStamp = stamp;
        state.clothCache.clear();
      }
      out.execute = true;
      out.cloth = 'cloth';
    } else if (node.type === 'ClothPins') {
      if (state.cloth) {
        const rings = String(node.params.rings ?? 'neck,waist')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean) as PinRingMode[];
        applyPinRings(state.cloth, rings.length ? rings : ['neck'], num(node.params.strength, 1));
      }
      out.execute = true;
      out.cloth = 'cloth';
    } else if (node.type === 'FabricPreset') {
      fabricParams = {
        mass: num(node.params.mass, 1),
        stretch: num(node.params.stretch, 0.92),
        shear: num(node.params.shear, 0.55),
        bend: num(node.params.bend, 0.18),
        damping: num(node.params.damping, 0.12),
        gravity: asVec3(node.params.gravity, [0, -9.2, 0]),
      };
      out.execute = true;
      out.params = fabricParams;
    } else if (node.type === 'SimulateCloth') {
      if (state.cloth) {
        // Prefer cache playback when enabled and frame is baked
        const cached = state.clothCache.enabled ? state.clothCache.get(frame) : null;
        if (cached && cached.length === state.cloth.pos.length) {
          state.cloth.pos.set(cached);
          state.cloth.prev.set(cached);
        } else if (!node.params.muted) {
          const qName = String(node.params.quality ?? 'Preview') as ClothQuality;
          const q = QUALITY_SETTINGS[qName] ?? QUALITY_SETTINGS.Preview;
          let g = asVec3(node.params.gravity, [0, -9.2, 0]);
          let damping = num(node.params.damping, 0.12);
          let stretch = num(node.params.stretch, 0.92);
          let shear = num(node.params.shear, 0.55);
          let bend = num(node.params.bend, 0.18);
          let mass = num(node.params.mass, 1);
          const paramsLink = incoming(graph, node.id, 'params');
          if (paramsLink) {
            const fo = nodeOut.get(paramsLink.from)?.[paramsLink.fromPort] as typeof fabricParams;
            if (fo && typeof fo === 'object') {
              g = fo.gravity; damping = fo.damping; stretch = fo.stretch;
              shear = fo.shear; bend = fo.bend; mass = fo.mass;
            }
          } else if (fabricParams) {
            g = fabricParams.gravity; damping = fabricParams.damping; stretch = fabricParams.stretch;
            shear = fabricParams.shear; bend = fabricParams.bend; mass = fabricParams.mass;
          }
          const wind = asVec3(node.params.wind, [0.08, 0.02, 0.04]);
          // Collider fidelity from quality
          let tris = colliderTris;
          let sphere = colliderSphere;
          if (!q.useMeshCollider) tris = null;
          if (!sphere) sphere = { cx: 0, cy: 0.85, cz: 0, r: 0.42 };

          const simP = {
            gravity: g,
            damping,
            stretch,
            shear,
            bend,
            mass,
            substeps: Math.max(1, num(node.params.substeps, q.substeps) | 0),
            iterations: Math.max(1, num(node.params.iterations, q.iterations) | 0),
            selfCollide: node.params.selfCollide !== undefined ? !!node.params.selfCollide : q.selfCollide,
            thickness: num(node.params.thickness, colliderThickness),
            wind,
            dt,
            muted: !!node.params.muted,
            colliderSphere: sphere,
            colliderTris: tris,
          };

          // Explicit settle pre-roll (wizard button / ClothCache settleFrames pending)
          if (state.settlePending > 0) {
            const n = state.settlePending;
            state.settlePending = 0;
            for (let i = 0; i < n; i++) tickClothDynamics(state.cloth, simP);
          }

          tickClothDynamics(state.cloth, simP);

          if (state.clothCache.enabled) {
            state.clothCache.bake(frame, state.cloth.pos);
          }
        } else {
          state.cloth.pos.set(state.cloth.rest);
          state.cloth.prev.set(state.cloth.rest);
        }
      }
      didSim = true;
      out.execute = true;
      out.cloth = 'cloth';
    } else if (node.type === 'ClothCache') {
      state.clothCache.enabled = !!node.params.enabled;
      state.attrs.set('ClothDisplayMode', [node.params.displayMode === 'wire' ? 1 : 0]);
      state.attrs.set('ClothSettleFrames', [num(node.params.settleFrames, 24)]);
      out.execute = true;
      out.cloth = 'cloth';
    } else if (node.type === 'Wind') {
      windForce = asVec3(node.params.force, [0.4, 0.05, 0.1]);
      windTurb = num(node.params.turbulence, 1.5);
      out.force = windForce;
      out.execute = true;
    } else if (node.type === 'SimulateStrands') {
      const muted = !!node.params.muted;
      const g = asVec3(node.params.gravity, [0, -4.5, 0]);
      // Optional linked wind
      const forceLink = incoming(graph, node.id, 'force');
      let wind: Vec3 = [...windForce] as Vec3;
      let turb = windTurb;
      if (forceLink) {
        const fo = nodeOut.get(forceLink.from)?.[forceLink.fromPort];
        if (Array.isArray(fo)) wind = asVec3(fo);
        const src = graph.nodes.find(n => n.id === forceLink.from);
        if (src?.type === 'Wind') turb = num(src.params.turbulence, turb);
      }
      tickStrandDynamics(state.strands, {
        gravity: g,
        damping: num(node.params.damping, 0.12),
        stiffness: num(node.params.stiffness, 0.35),
        stretchLimit: num(node.params.stretchLimit, 1.05),
        iterations: Math.max(1, num(node.params.iterations, 4) | 0),
        wind,
        windTurbulence: turb,
        dt,
        time: state.time,
        colliderSphere,
        colliderTris,
        muted,
      });
      didSim = true;
      out.execute = true;
      out.strands = 'strands';
    } else if (node.type === 'HairLook') {
      state.attrs.set('HairRootColor', asVec3(node.params.rootColor, [0.12, 0.08, 0.05]) as unknown as number[]);
      state.attrs.set('HairTipColor', asVec3(node.params.tipColor, [0.35, 0.22, 0.12]) as unknown as number[]);
      state.attrs.set('HairTaper', [num(node.params.taper, 0.7)]);
      state.attrs.set('HairNoise', [num(node.params.noise, 0.15)]);
      state.attrs.set('HairDisplayMode', [node.params.displayMode === 'points' ? 1 : 0]);
      out.execute = true;
      out.strands = 'strands';
    } else if (node.type === 'GetAttr') {
      const name = String(node.params.name ?? 'PointPosition');
      // MVP: expose first alive particle sample / counts for probes
      const alive = state.particles.filter(p => p.alive);
      if (name === 'NbPoints') out.value = alive.length;
      else if (name === 'NbStrands') out.value = strandCount(state.strands);
      else if (name === 'NbClothVerts') out.value = clothVertexCount(state.cloth);
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
  void didEmit; void didSim; void styleLayers;
  return state;
}

function strandRecipeStamp(node: FrostNodeIR, graph: FrostGraphIR): string {
  const style = graph.nodes.find(n => n.type === 'StyleLayers');
  return [
    node.params.guideCount, node.params.segments, node.params.length, node.params.seed,
    node.params.scalpObject, node.params.densityMap, node.params.lengthMap, node.params.thickness,
    style ? JSON.stringify(style.params.layers ?? '') : '',
  ].join('|');
}

function clothRecipeStamp(node: FrostNodeIR, graph: FrostGraphIR): string {
  const pins = graph.nodes.find(n => n.type === 'ClothPins');
  return [
    node.params.garmentObject, node.params.shape, node.params.resolution, node.params.seed,
    pins ? `${pins.params.rings}|${pins.params.strength}` : '',
  ].join('|');
}

function parseStyleLayers(raw: unknown): StyleLayer[] {
  if (typeof raw === 'string') {
    try { return parseStyleLayers(JSON.parse(raw)); } catch { return defaultStyleLayers(); }
  }
  if (!Array.isArray(raw)) return defaultStyleLayers();
  return raw.map((l: any, i: number) => ({
    id: String(l?.id ?? `layer${i}`),
    name: String(l?.name ?? `Layer ${i + 1}`),
    kind: String(l?.kind ?? 'comb'),
    strength: Number(l?.strength) || 0,
    muted: !!l?.muted,
    direction: Array.isArray(l?.direction) ? asVec3(l.direction) : undefined,
  }));
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

/** Packed line-segment positions for strand display. */
export function frostStrandLines(state: FrostEvalState): Float32Array {
  return packStrandLineSegments(state.strands);
}

/** Packed cloth vertex positions for mesh deform display. */
export function frostClothPositions(state: FrostEvalState): Float32Array {
  return packClothPositions(state.cloth);
}

/** Packed cloth edge wireframe. */
export function frostClothWireframe(state: FrostEvalState): Float32Array {
  return packClothWireframe(state.cloth);
}

export function aliveCount(state: FrostEvalState): number {
  return state.particles.reduce((n, p) => n + (p.alive ? 1 : 0), 0);
}

export function aliveStrandCount(state: FrostEvalState): number {
  return strandCount(state.strands);
}

export function aliveClothVerts(state: FrostEvalState): number {
  return clothVertexCount(state.cloth);
}
