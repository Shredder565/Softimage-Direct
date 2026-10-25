/** FROST Character Cloth wizard state + graph recipe (P2 easy-path). Not Syflex 1:1. */

import { emptyFrostGraph, frostId, type FrostGraphIR } from './ir';
import { FROST_NODES } from './nodes';
import {
  FABRIC_PRESETS,
  QUALITY_SETTINGS,
  pinModeForFabric,
  type ClothQuality,
  type FabricPresetName,
  type PinRingMode,
} from './clothSim';
import type { Vec3 } from './math';

export type { ClothQuality, FabricPresetName, PinRingMode };

export interface ClothWizardState {
  /** Step 0..5 — garment → collider → pins → preset → quality → cache */
  step: number;
  garmentObject: string;
  /** shirt cylinder vs flat panel when no mesh bound */
  garmentShape: 'shirt' | 'panel';
  bodyObject: string;
  fabric: FabricPresetName;
  quality: ClothQuality;
  pinRings: PinRingMode[];
  pinStrength: number;
  thickness: number;
  settleFrames: number;
  cacheEnabled: boolean;
  /** Advanced drawer */
  advancedOpen: boolean;
  resolution: number;
  substeps: number;
  iterations: number;
  selfCollide: boolean;
  mass: number;
  stretch: number;
  shear: number;
  bend: number;
  damping: number;
  gravity: Vec3;
  wind: Vec3;
  simMuted: boolean;
  seed: number;
  displayMode: 'mesh' | 'wire';
}

export const CLOTH_STEPS = [
  { id: 'garment', title: 'Garment', blurb: 'Pick a garment mesh, or use a procedural shirt / panel.' },
  { id: 'collider', title: 'Body', blurb: 'Bind a character body collider with thickness offset.' },
  { id: 'pins', title: 'Pins', blurb: 'Neck / waist / cuff rings — or top edge for cape & curtain.' },
  { id: 'preset', title: 'Preset', blurb: 'Shirt · Coat · Cape · Soft curtain fabric cards.' },
  { id: 'quality', title: 'Quality', blurb: 'Playblast · Preview · Final — substeps, self-collide, collider fidelity.' },
  { id: 'cache', title: 'Cache', blurb: 'Settle N frames, then one-click bake for scrub without re-sim.' },
] as const;

export function defaultClothWizard(): ClothWizardState {
  const fabric = FABRIC_PRESETS.Shirt;
  const q = QUALITY_SETTINGS.Preview;
  return {
    step: 0,
    garmentObject: '',
    garmentShape: 'shirt',
    bodyObject: '',
    fabric: 'Shirt',
    quality: 'Preview',
    pinRings: pinModeForFabric('Shirt'),
    pinStrength: 1,
    thickness: 0.04,
    settleFrames: 24,
    cacheEnabled: false,
    advancedOpen: false,
    resolution: q.resolution,
    substeps: q.substeps,
    iterations: q.iterations,
    selfCollide: q.selfCollide,
    mass: fabric.mass,
    stretch: fabric.stretch,
    shear: fabric.shear,
    bend: fabric.bend,
    damping: fabric.damping,
    gravity: [...fabric.gravity] as Vec3,
    wind: [0.08, 0.02, 0.04],
    simMuted: false,
    seed: 5,
    displayMode: 'mesh',
  };
}

function node(type: string, x: number, y: number, params: Record<string, number | string | boolean | number[]> = {}) {
  const def = FROST_NODES[type];
  return {
    id: frostId('n'),
    type,
    x,
    y,
    params: { ...(def?.defaults ?? {}), ...params },
  };
}

/** Build ejectable frost-graph from cloth wizard state. */
export function clothRecipe(wiz: ClothWizardState, name = 'CharacterCloth'): FrostGraphIR {
  const g = emptyFrostGraph(name);
  g.simulated = true;
  const create = node('CreateCloth', 40, 100, {
    garmentObject: wiz.garmentObject,
    shape: wiz.garmentShape,
    resolution: wiz.resolution,
    seed: wiz.seed,
  });
  const pins = node('ClothPins', 260, 40, {
    rings: wiz.pinRings.join(','),
    strength: wiz.pinStrength,
    attachBones: false,
  });
  const collide = node('CollideBody', 260, 200, {
    bodyObject: wiz.bodyObject,
    quality: wiz.quality === 'Playblast' ? 'Playblast' : 'Preview',
    useDefaultBody: !wiz.bodyObject,
    thickness: wiz.thickness,
  });
  const fabric = node('FabricPreset', 480, 20, {
    preset: wiz.fabric,
    mass: wiz.mass,
    stretch: wiz.stretch,
    shear: wiz.shear,
    bend: wiz.bend,
    damping: wiz.damping,
    gravity: [...wiz.gravity],
  });
  const sim = node('SimulateCloth', 480, 140, {
    gravity: [...wiz.gravity],
    damping: wiz.damping,
    stretch: wiz.stretch,
    shear: wiz.shear,
    bend: wiz.bend,
    mass: wiz.mass,
    substeps: wiz.substeps,
    iterations: wiz.iterations,
    selfCollide: wiz.selfCollide,
    thickness: wiz.thickness,
    wind: [...wiz.wind],
    muted: wiz.simMuted,
    quality: wiz.quality,
  });
  const cache = node('ClothCache', 700, 140, {
    enabled: wiz.cacheEnabled,
    settleFrames: wiz.settleFrames,
    displayMode: wiz.displayMode,
  });
  g.nodes = [create, pins, collide, fabric, sim, cache];
  g.links = [
    { id: frostId('l'), from: create.id, fromPort: 'execute', to: pins.id, toPort: 'execute' },
    { id: frostId('l'), from: create.id, fromPort: 'cloth', to: pins.id, toPort: 'cloth' },
    { id: frostId('l'), from: pins.id, fromPort: 'execute', to: collide.id, toPort: 'execute' },
    { id: frostId('l'), from: pins.id, fromPort: 'execute', to: fabric.id, toPort: 'execute' },
    { id: frostId('l'), from: pins.id, fromPort: 'execute', to: sim.id, toPort: 'execute' },
    { id: frostId('l'), from: pins.id, fromPort: 'cloth', to: sim.id, toPort: 'cloth' },
    { id: frostId('l'), from: fabric.id, fromPort: 'params', to: sim.id, toPort: 'params' },
    { id: frostId('l'), from: fabric.id, fromPort: 'execute', to: sim.id, toPort: 'execute' },
    { id: frostId('l'), from: sim.id, fromPort: 'execute', to: cache.id, toPort: 'execute' },
    { id: frostId('l'), from: sim.id, fromPort: 'cloth', to: cache.id, toPort: 'cloth' },
  ];
  return g;
}

export function applyFabricPreset(wiz: ClothWizardState, fabric: FabricPresetName) {
  const p = FABRIC_PRESETS[fabric];
  wiz.fabric = fabric;
  wiz.mass = p.mass;
  wiz.stretch = p.stretch;
  wiz.shear = p.shear;
  wiz.bend = p.bend;
  wiz.damping = p.damping;
  wiz.gravity = [...p.gravity] as Vec3;
  wiz.pinRings = pinModeForFabric(fabric);
  wiz.garmentShape = fabric === 'Cape' || fabric === 'Curtain' ? 'panel' : 'shirt';
}

export function applyClothQuality(wiz: ClothWizardState, quality: ClothQuality) {
  const q = QUALITY_SETTINGS[quality];
  wiz.quality = quality;
  wiz.resolution = q.resolution;
  wiz.substeps = q.substeps;
  wiz.iterations = q.iterations;
  wiz.selfCollide = q.selfCollide;
}

/** Best-effort restore wizard fields from an existing cloth graph. */
export function clothWizardFromGraph(graph: FrostGraphIR): ClothWizardState | null {
  const create = graph.nodes.find(n => n.type === 'CreateCloth');
  if (!create) return null;
  const wiz = defaultClothWizard();
  wiz.garmentObject = String(create.params.garmentObject ?? '');
  wiz.garmentShape = String(create.params.shape) === 'panel' ? 'panel' : 'shirt';
  wiz.resolution = Number(create.params.resolution) || wiz.resolution;
  wiz.seed = Number(create.params.seed) || wiz.seed;
  const pins = graph.nodes.find(n => n.type === 'ClothPins');
  if (pins) {
    const rings = String(pins.params.rings ?? '').split(',').map(s => s.trim()).filter(Boolean) as PinRingMode[];
    if (rings.length) wiz.pinRings = rings;
    wiz.pinStrength = Number(pins.params.strength) || wiz.pinStrength;
  }
  const collide = graph.nodes.find(n => n.type === 'CollideBody');
  if (collide) {
    wiz.bodyObject = String(collide.params.bodyObject ?? '');
    wiz.thickness = Number(collide.params.thickness) || wiz.thickness;
  }
  const fabric = graph.nodes.find(n => n.type === 'FabricPreset');
  if (fabric) {
    const p = String(fabric.params.preset ?? 'Shirt');
    if (p === 'Shirt' || p === 'Coat' || p === 'Cape' || p === 'Curtain') wiz.fabric = p;
    wiz.mass = Number(fabric.params.mass) || wiz.mass;
    wiz.stretch = Number(fabric.params.stretch) || wiz.stretch;
    wiz.shear = Number(fabric.params.shear) || wiz.shear;
    wiz.bend = Number(fabric.params.bend) || wiz.bend;
    wiz.damping = Number(fabric.params.damping) || wiz.damping;
    if (Array.isArray(fabric.params.gravity)) wiz.gravity = fabric.params.gravity as Vec3;
  }
  const sim = graph.nodes.find(n => n.type === 'SimulateCloth');
  if (sim) {
    const q = String(sim.params.quality ?? 'Preview');
    if (q === 'Playblast' || q === 'Preview' || q === 'Final') wiz.quality = q;
    wiz.substeps = Number(sim.params.substeps) || wiz.substeps;
    wiz.iterations = Number(sim.params.iterations) || wiz.iterations;
    wiz.selfCollide = !!sim.params.selfCollide;
    wiz.simMuted = !!sim.params.muted;
    wiz.thickness = Number(sim.params.thickness) || wiz.thickness;
    if (Array.isArray(sim.params.wind)) wiz.wind = sim.params.wind as Vec3;
    if (Array.isArray(sim.params.gravity)) wiz.gravity = sim.params.gravity as Vec3;
  }
  const cache = graph.nodes.find(n => n.type === 'ClothCache');
  if (cache) {
    wiz.cacheEnabled = !!cache.params.enabled;
    wiz.settleFrames = Number(cache.params.settleFrames) || wiz.settleFrames;
    if (cache.params.displayMode === 'wire') wiz.displayMode = 'wire';
  }
  return wiz;
}
