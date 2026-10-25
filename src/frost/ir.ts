/** FROST graph IR — versioned JSON. Clean-room 2026 successor; not Softimage ICE binary-compatible. */

export const FROST_IR_VERSION = 1 as const;

export type FrostPortType =
  | 'float'
  | 'vec3'
  | 'bool'
  | 'execution'
  | 'pointcloud'
  | 'strandfield'
  | 'clothmesh'
  | 'geometry'
  | 'any';

export interface FrostPortDef {
  name: string;
  type: FrostPortType;
}

export interface FrostNodeIR {
  id: string;
  type: string;
  x: number;
  y: number;
  params: Record<string, number | string | boolean | number[]>;
}

export interface FrostLinkIR {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
}

/** Versioned frost-graph document. */
export interface FrostGraphIR {
  version: typeof FROST_IR_VERSION | number;
  name: string;
  /** Softimage-inspired flag: simulated graphs carry frame-to-frame particle state. */
  simulated: boolean;
  nodes: FrostNodeIR[];
  links: FrostLinkIR[];
}

export function emptyFrostGraph(name = 'FrostGraph'): FrostGraphIR {
  return { version: FROST_IR_VERSION, name, simulated: true, nodes: [], links: [] };
}

export function serializeFrostGraph(graph: FrostGraphIR): string {
  return JSON.stringify(graph, null, 2);
}

export function parseFrostGraph(json: string | FrostGraphIR): FrostGraphIR {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!raw || typeof raw !== 'object') throw new Error('FROST IR: expected object');
  if (typeof raw.version !== 'number') throw new Error('FROST IR: missing version');
  if (raw.version > FROST_IR_VERSION) throw new Error(`FROST IR: unsupported version ${raw.version}`);
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.links)) throw new Error('FROST IR: nodes/links required');
  return {
    version: raw.version,
    name: String(raw.name ?? 'FrostGraph'),
    simulated: !!raw.simulated,
    nodes: raw.nodes.map((n: any) => ({
      id: String(n.id),
      type: String(n.type),
      x: Number(n.x) || 0,
      y: Number(n.y) || 0,
      params: { ...(n.params ?? {}) },
    })),
    links: raw.links.map((l: any) => ({
      id: String(l.id),
      from: String(l.from),
      fromPort: String(l.fromPort),
      to: String(l.to),
      toPort: String(l.toPort),
    })),
  };
}

let _seq = 1;
export function frostId(prefix = 'n'): string {
  return `${prefix}${_seq++}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function resetFrostIdSeq(n = 1) { _seq = n; }
