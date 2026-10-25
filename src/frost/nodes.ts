/** Built-in FROST node catalog for P0 (Emit / Simulate / attributes / turbulize). */

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
