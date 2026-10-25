/** Default FROST recipes for P0 particles + P1 character hair. */

import { emptyFrostGraph, frostId, type FrostGraphIR } from './ir';
import { FROST_NODES } from './nodes';
import { defaultHairWizard, hairRecipe } from './hair';

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

/** Emit → Turbulize → Simulate Particles — basic simulated particle FX. */
export function emitSimulateRecipe(name = 'EmitSimulate'): FrostGraphIR {
  const g = emptyFrostGraph(name);
  g.simulated = true;
  const emit = node('Emit', 40, 80, { rate: 10, speed: 3, lifetime: 90, maxParticles: 600 });
  const turb = node('Turbulize', 260, 40, { amplitude: 6, frequency: 0.25 });
  const sim = node('SimulateParticles', 480, 80, { gravity: [0, -4, 0], drag: 0.04 });
  g.nodes = [emit, turb, sim];
  g.links = [
    { id: frostId('l'), from: emit.id, fromPort: 'execute', to: turb.id, toPort: 'execute' },
    { id: frostId('l'), from: emit.id, fromPort: 'cloud', to: sim.id, toPort: 'cloud' },
    { id: frostId('l'), from: turb.id, fromPort: 'force', to: sim.id, toPort: 'force' },
    { id: frostId('l'), from: turb.id, fromPort: 'execute', to: sim.id, toPort: 'execute' },
  ];
  return g;
}

/** Character hair easy-path recipe (wizard default). */
export function characterHairRecipe(name = 'CharacterHair'): FrostGraphIR {
  return hairRecipe(defaultHairWizard(), name);
}

export const FROST_PRESETS: { label: string; build: () => FrostGraphIR }[] = [
  { label: 'Emit → Simulate Particles', build: () => emitSimulateRecipe() },
  { label: 'Character Hair', build: () => characterHairRecipe() },
];
