/** Built-in FROST node catalog — particles (P0) + character hair (P1). */

import type { FrostPortDef } from './ir';

export interface FrostNodeDef {
  type: string;
  category: string;
  inputs: FrostPortDef[];
  outputs: FrostPortDef[];
  /** Default params written into IR when the node is created. */
  defaults: Record<string, number | string | boolean | number[]>;
}

export const FROST_NODES: Record<string, FrostNodeDef> = {
  GetAttr: {
    type: 'GetAttr',
    category: 'Attributes',
    inputs: [],
    outputs: [{ name: 'value', type: 'any' }],
    defaults: { name: 'PointPosition' },
  },
  SetAttr: {
    type: 'SetAttr',
    category: 'Attributes',
    inputs: [
      { name: 'execute', type: 'execution' },
      { name: 'value', type: 'any' },
    ],
    outputs: [{ name: 'execute', type: 'execution' }],
    defaults: { name: 'PointColor' },
  },
  Emit: {
    type: 'Emit',
    category: 'Particles',
    inputs: [{ name: 'execute', type: 'execution' }],
    outputs: [
      { name: 'execute', type: 'execution' },
      { name: 'cloud', type: 'pointcloud' },
    ],
    defaults: {
      rate: 12,
      rateType: 'perFrame',
      size: 0.15,
      speed: 2,
      direction: [0, 1, 0],
      position: [0, 0, 0],
      spread: 0.35,
      seed: 1,
      lifetime: 60,
      maxParticles: 800,
    },
  },
  SimulateParticles: {
    type: 'SimulateParticles',
    category: 'Particles',
    inputs: [
      { name: 'execute', type: 'execution' },
      { name: 'cloud', type: 'pointcloud' },
      { name: 'force', type: 'vec3' },
    ],
    outputs: [
      { name: 'execute', type: 'execution' },
      { name: 'cloud', type: 'pointcloud' },
    ],
    defaults: {
      gravity: [0, -9.8, 0],
      drag: 0.02,
      substeps: 1,
    },
  },
  Turbulize: {
    type: 'Turbulize',
    category: 'Forces',
    inputs: [
      { name: 'execute', type: 'execution' },
      { name: 'position', type: 'vec3' },
    ],
    outputs: [
      { name: 'force', type: 'vec3' },
      { name: 'execute', type: 'execution' },
    ],
    defaults: {
      amplitude: 4,
      frequency: 0.35,
      octaves: 3,
      seed: 7,
      timeScale: 0.4,
    },
  },
  Gravity: {
    type: 'Gravity',
    category: 'Forces',
    inputs: [{ name: 'execute', type: 'execution' }],
    outputs: [{ name: 'force', type: 'vec3' }],
    defaults: { gravity: [0, -9.8, 0] },
  },

  // —— Character hair (P1 easy-path; wizard authors these) ——
  CreateStrands: {
    type: 'CreateStrands',
    category: 'Hair',
    inputs: [{ name: 'execute', type: 'execution' }],
    outputs: [
      { name: 'execute', type: 'execution' },
      { name: 'strands', type: 'strandfield' },
    ],
    defaults: {
      scalpObject: '',
      guideCount: 72,
      segments: 8,
      length: 1.25,
      thickness: 0.02,
      densityMap: 1,
      lengthMap: 1,
      seed: 3,
    },
  },
  StyleLayers: {
    type: 'StyleLayers',
    category: 'Hair',
    inputs: [
      { name: 'execute', type: 'execution' },
      { name: 'strands', type: 'strandfield' },
    ],
    outputs: [
      { name: 'execute', type: 'execution' },
      { name: 'strands', type: 'strandfield' },
    ],
    defaults: {
      layers: '', // JSON string filled by hair recipe
      seed: 3,
      snapToRest: false,
    },
  },
  CollideBody: {
    type: 'CollideBody',
    category: 'Hair',
    inputs: [{ name: 'execute', type: 'execution' }],
    outputs: [
      { name: 'execute', type: 'execution' },
      { name: 'geometry', type: 'geometry' },
    ],
    defaults: {
      bodyObject: '',
      quality: 'Preview', // Preview = mesh soft collide; Playblast = sphere
      useDefaultBody: true,
    },
  },
  Wind: {
    type: 'Wind',
    category: 'Forces',
    inputs: [{ name: 'execute', type: 'execution' }],
    outputs: [
      { name: 'force', type: 'vec3' },
      { name: 'execute', type: 'execution' },
    ],
    defaults: {
      preset: 'Breeze',
      force: [0.45, 0.06, 0.12],
      turbulence: 1.6,
    },
  },
  SimulateStrands: {
    type: 'SimulateStrands',
    category: 'Hair',
    inputs: [
      { name: 'execute', type: 'execution' },
      { name: 'strands', type: 'strandfield' },
      { name: 'force', type: 'vec3' },
    ],
    outputs: [
      { name: 'execute', type: 'execution' },
      { name: 'strands', type: 'strandfield' },
    ],
    defaults: {
      gravity: [0, -4.5, 0],
      damping: 0.12,
      stiffness: 0.35,
      stretchLimit: 1.05,
      iterations: 4,
      muted: false,
      look: 'Silky',
    },
  },
  HairLook: {
    type: 'HairLook',
    category: 'Hair',
    inputs: [
      { name: 'execute', type: 'execution' },
      { name: 'strands', type: 'strandfield' },
    ],
    outputs: [
      { name: 'execute', type: 'execution' },
      { name: 'strands', type: 'strandfield' },
    ],
    defaults: {
      displayMode: 'lines',
      renderDensity: 1,
      taper: 0.7,
      noise: 0.15,
      rootColor: [0.12, 0.08, 0.05],
      tipColor: [0.38, 0.24, 0.14],
    },
  },
};

export function frostCategories(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const d of Object.values(FROST_NODES)) {
    const list = m.get(d.category) ?? [];
    list.push(d.type);
    m.set(d.category, list);
  }
  return m;
}
