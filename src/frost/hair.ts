/** FROST Character Hair wizard state + graph recipe (P1 easy-path). */

import { emptyFrostGraph, frostId, type FrostGraphIR } from './ir';
import { FROST_NODES } from './nodes';
import { defaultStyleLayers, type StyleLayer } from './strands';
import type { Vec3 } from './math';

export type HairLengthPreset = 'short' | 'medium' | 'long';
export type WindPresetName = 'Calm' | 'Breeze' | 'Gale';
export type SimLookName = 'Silky' | 'Thick' | 'Wet';
export type ColliderQuality = 'Preview' | 'Playblast';

export interface HairWizardState {
  /** Step index 0..5 — scalp → maps → groom → collide → sim → look */
  step: number;
  scalpObject: string;
  bodyObject: string;
  lengthPreset: HairLengthPreset;
  guideCount: number;
  segments: number;
  length: number;
  thickness: number;
  densityMap: number;
  lengthMap: number;
  seed: number;
  layers: StyleLayer[];
  windPreset: WindPresetName;
  simLook: SimLookName;
  colliderQuality: ColliderQuality;
  /** Advanced drawer */
  advancedOpen: boolean;
  gravity: Vec3;
  damping: number;
  stiffness: number;
  stretchLimit: number;
  iterations: number;
  simMuted: boolean;
  taper: number;
  noise: number;
  rootColor: Vec3;
  tipColor: Vec3;
  displayMode: 'lines' | 'points';
}

export const HAIR_STEPS = [
  { id: 'scalp', title: 'Scalp', blurb: 'Pick a head / scalp mesh, or use the default crown.' },
  { id: 'maps', title: 'Maps', blurb: 'Density and length falloff — soft hairline by default.' },
  { id: 'groom', title: 'Groom', blurb: 'Non-destructive style layers (Base / Part / Flyaways).' },
  { id: 'collide', title: 'Collide', blurb: 'Bind a body mesh collider (or a default torso sphere).' },
  { id: 'sim', title: 'Sim', blurb: 'Wind + material look. Stretch limit stays on.' },
  { id: 'look', title: 'Look', blurb: 'Viewport lines, taper, and root→tip color.' },
] as const;

export const WIND_PRESETS: Record<WindPresetName, { force: Vec3; turbulence: number }> = {
  Calm: { force: [0.05, 0.01, 0.02], turbulence: 0.2 },
  Breeze: { force: [0.45, 0.06, 0.12], turbulence: 1.6 },
  Gale: { force: [1.4, 0.15, 0.35], turbulence: 3.2 },
};

export const SIM_LOOKS: Record<SimLookName, { stiffness: number; damping: number; gravity: Vec3 }> = {
  Silky: { stiffness: 0.28, damping: 0.1, gravity: [0, -4.2, 0] },
  Thick: { stiffness: 0.55, damping: 0.18, gravity: [0, -5.5, 0] },
  Wet: { stiffness: 0.4, damping: 0.28, gravity: [0, -7.5, 0] },
};

export const LENGTH_PRESETS: Record<HairLengthPreset, { length: number; guideCount: number; segments: number }> = {
  short: { length: 0.35, guideCount: 64, segments: 5 },
  medium: { length: 0.85, guideCount: 72, segments: 7 },
  long: { length: 1.35, guideCount: 80, segments: 9 },
};

export function defaultHairWizard(): HairWizardState {
  const len = LENGTH_PRESETS.long;
  const look = SIM_LOOKS.Silky;
  return {
    step: 0,
    scalpObject: '',
    bodyObject: '',
    lengthPreset: 'long',
    guideCount: len.guideCount,
    segments: len.segments,
    length: len.length,
    thickness: 0.02,
    densityMap: 1,
    lengthMap: 1,
    seed: 3,
    layers: defaultStyleLayers(),
    windPreset: 'Breeze',
    simLook: 'Silky',
    colliderQuality: 'Preview',
    advancedOpen: false,
    gravity: [...look.gravity] as Vec3,
    damping: look.damping,
    stiffness: look.stiffness,
    stretchLimit: 1.05,
    iterations: 4,
    simMuted: false,
    taper: 0.7,
    noise: 0.15,
    rootColor: [0.12, 0.08, 0.05],
    tipColor: [0.38, 0.24, 0.14],
    displayMode: 'lines',
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

/** Build ejectable frost-graph from wizard state (scalp→…→look). */
export function hairRecipe(wiz: HairWizardState, name = 'CharacterHair'): FrostGraphIR {
  const g = emptyFrostGraph(name);
  g.simulated = true;
  const wind = WIND_PRESETS[wiz.windPreset] ?? WIND_PRESETS.Breeze;
  const create = node('CreateStrands', 40, 100, {
    scalpObject: wiz.scalpObject,
    guideCount: wiz.guideCount,
    segments: wiz.segments,
    length: wiz.length,
    thickness: wiz.thickness,
    densityMap: wiz.densityMap,
    lengthMap: wiz.lengthMap,
    seed: wiz.seed,
  });
  const style = node('StyleLayers', 260, 40, {
    layers: JSON.stringify(wiz.layers),
    seed: wiz.seed,
    snapToRest: false,
  });
  const collide = node('CollideBody', 260, 200, {
    bodyObject: wiz.bodyObject,
    quality: wiz.colliderQuality,
    useDefaultBody: !wiz.bodyObject,
  });
  const windN = node('Wind', 480, 20, {
    preset: wiz.windPreset,
    force: [...wind.force],
    turbulence: wind.turbulence,
  });
  const sim = node('SimulateStrands', 480, 120, {
    gravity: [...wiz.gravity],
    damping: wiz.damping,
    stiffness: wiz.stiffness,
    stretchLimit: wiz.stretchLimit,
    iterations: wiz.iterations,
    muted: wiz.simMuted,
    look: wiz.simLook,
  });
  const lookN = node('HairLook', 700, 120, {
    displayMode: wiz.displayMode,
    taper: wiz.taper,
    noise: wiz.noise,
    rootColor: [...wiz.rootColor],
    tipColor: [...wiz.tipColor],
    renderDensity: 1,
  });
  g.nodes = [create, style, collide, windN, sim, lookN];
  g.links = [
    { id: frostId('l'), from: create.id, fromPort: 'execute', to: style.id, toPort: 'execute' },
    { id: frostId('l'), from: create.id, fromPort: 'strands', to: style.id, toPort: 'strands' },
    { id: frostId('l'), from: style.id, fromPort: 'execute', to: collide.id, toPort: 'execute' },
    { id: frostId('l'), from: collide.id, fromPort: 'execute', to: windN.id, toPort: 'execute' },
    { id: frostId('l'), from: style.id, fromPort: 'execute', to: sim.id, toPort: 'execute' },
    { id: frostId('l'), from: style.id, fromPort: 'strands', to: sim.id, toPort: 'strands' },
    { id: frostId('l'), from: windN.id, fromPort: 'force', to: sim.id, toPort: 'force' },
    { id: frostId('l'), from: sim.id, fromPort: 'execute', to: lookN.id, toPort: 'execute' },
    { id: frostId('l'), from: sim.id, fromPort: 'strands', to: lookN.id, toPort: 'strands' },
  ];
  return g;
}

/** Apply length / sim-look presets onto wizard numbers (user-facing cards). */
export function applyLengthPreset(wiz: HairWizardState, preset: HairLengthPreset) {
  const p = LENGTH_PRESETS[preset];
  wiz.lengthPreset = preset;
  wiz.length = p.length;
  wiz.guideCount = p.guideCount;
  wiz.segments = p.segments;
  if (preset === 'short') wiz.lengthMap = 0.55;
  else if (preset === 'medium') wiz.lengthMap = 0.85;
  else wiz.lengthMap = 1;
}

export function applySimLook(wiz: HairWizardState, look: SimLookName) {
  const p = SIM_LOOKS[look];
  wiz.simLook = look;
  wiz.stiffness = p.stiffness;
  wiz.damping = p.damping;
  wiz.gravity = [...p.gravity] as Vec3;
}

export function applyWindPreset(wiz: HairWizardState, name: WindPresetName) {
  wiz.windPreset = name;
}

/** Read wizard-ish fields back from an existing hair graph (best-effort). */
export function wizardFromGraph(graph: FrostGraphIR): HairWizardState | null {
  const create = graph.nodes.find(n => n.type === 'CreateStrands');
  if (!create) return null;
  const wiz = defaultHairWizard();
  wiz.scalpObject = String(create.params.scalpObject ?? '');
  wiz.guideCount = Number(create.params.guideCount) || wiz.guideCount;
  wiz.segments = Number(create.params.segments) || wiz.segments;
  wiz.length = Number(create.params.length) || wiz.length;
  wiz.thickness = Number(create.params.thickness) || wiz.thickness;
  wiz.densityMap = Number(create.params.densityMap) || 1;
  wiz.lengthMap = Number(create.params.lengthMap) || 1;
  wiz.seed = Number(create.params.seed) || 3;
  const style = graph.nodes.find(n => n.type === 'StyleLayers');
  if (style && typeof style.params.layers === 'string' && style.params.layers) {
    try { wiz.layers = JSON.parse(String(style.params.layers)); } catch { /* keep defaults */ }
  }
  const collide = graph.nodes.find(n => n.type === 'CollideBody');
  if (collide) {
    wiz.bodyObject = String(collide.params.bodyObject ?? '');
    wiz.colliderQuality = (String(collide.params.quality) === 'Playblast' ? 'Playblast' : 'Preview');
  }
  const wind = graph.nodes.find(n => n.type === 'Wind');
  if (wind) {
    const p = String(wind.params.preset ?? 'Breeze');
    if (p === 'Calm' || p === 'Breeze' || p === 'Gale') wiz.windPreset = p;
  }
  const sim = graph.nodes.find(n => n.type === 'SimulateStrands');
  if (sim) {
    const look = String(sim.params.look ?? 'Silky');
    if (look === 'Silky' || look === 'Thick' || look === 'Wet') wiz.simLook = look;
    wiz.damping = Number(sim.params.damping) || wiz.damping;
    wiz.stiffness = Number(sim.params.stiffness) || wiz.stiffness;
    wiz.stretchLimit = Number(sim.params.stretchLimit) || wiz.stretchLimit;
    wiz.iterations = Number(sim.params.iterations) || wiz.iterations;
    wiz.simMuted = !!sim.params.muted;
    if (Array.isArray(sim.params.gravity)) wiz.gravity = sim.params.gravity as Vec3;
  }
  const lookN = graph.nodes.find(n => n.type === 'HairLook');
  if (lookN) {
    wiz.taper = Number(lookN.params.taper) || wiz.taper;
    wiz.noise = Number(lookN.params.noise) || wiz.noise;
    if (Array.isArray(lookN.params.rootColor)) wiz.rootColor = lookN.params.rootColor as Vec3;
    if (Array.isArray(lookN.params.tipColor)) wiz.tipColor = lookN.params.tipColor as Vec3;
    if (lookN.params.displayMode === 'points') wiz.displayMode = 'points';
  }
  return wiz;
}
