// Model-tab audit — the runtime side of docs/ghidra/model-surface-audit.md.
// src/data/si/model_surface_audit.json is the inventory (tools/build_model_surface_audit.py).
// This module re-checks the contracts the pass closed: generator base parameters and the new command names.
import audit from '../data/si/model_surface_audit.json';
import { siParamDefs } from '../core/opdefs';

export type ModelSurfaceItem = {
  kind: string;
  module: string;
  item: string;
  verdict: 'PRESENT' | 'PARTIAL' | 'MISSING' | 'ABSENT';
  wired: boolean;
  surface: string;
  note: string;
};

export type ModelSurfaceCounts = {
  PRESENT: number; PARTIAL: number; MISSING: number; ABSENT: number;
  total: number; wiredThisPass: number;
};

export const MODEL_SURFACE = audit as unknown as {
  softimage: string;
  source: string;
  generated_by: string;
  counts: ModelSurfaceCounts;
  items: ModelSurfaceItem[];
};

const CRVNET = ['tol', 'featurematch', 'subdivu', 'subdivv', 'subdivuperspan', 'subdivvperspan', 'subdivtype', 'ignoresub', 'inputreadregion'];
const BASE_TYPES = ['mergemesh', 'blendcrv', 'mergecrv', 'crvnet'];
const COMMANDS = ['SelectGeneratorOutputs', 'UIAssembleNurbsMesh', 'AddPolygonTool'];

export function modelSurfaceAudit(app?: { commands: { get(name: string): unknown } }) {
  const items = MODEL_SURFACE.items;
  const tally = { PRESENT: 0, PARTIAL: 0, MISSING: 0, ABSENT: 0 } as Record<string, number>;
  for (const it of items) tally[it.verdict]++;
  const crv = new Set(siParamDefs('crvnet').map(d => d.name));
  const crvnetOk = CRVNET.every(n => crv.has(n));
  const generatorBaseOk = BASE_TYPES.every(k => siParamDefs(k).some(d => d.name === 'inputreadregion'));
  const curveListPose = siParamDefs('CurveListToMesh').some(d => d.name === 'syncwithinputspose');
  const commandsOk = !app || COMMANDS.every(n => !!app.commands.get(n));
  const counts = MODEL_SURFACE.counts;
  return {
    softimage: MODEL_SURFACE.softimage,
    counts,
    countsOk: tally.PRESENT === counts.PRESENT && tally.PARTIAL === counts.PARTIAL
      && tally.MISSING === counts.MISSING && tally.ABSENT === counts.ABSENT
      && items.length === counts.total,
    crvnetOk,
    generatorBaseOk,
    curveListPose,
    commandsOk,
    wiredOk: crvnetOk && generatorBaseOk && curveListPose && commandsOk,
    absent: items.filter(i => i.verdict === 'ABSENT').map(i => ({ module: i.module, item: i.item, note: i.note })),
  };
}
