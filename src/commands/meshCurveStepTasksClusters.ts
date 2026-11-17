// Ledger row CMD-B8f, cluster commands. Brief: docs/ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md, "Wire contract".
// Original code written from that prose contract only. See meshCurveStepTasks.ts for the conventions.
//
//   simeshtasks   CreateMeshPartitionClusters CreateClustersAlongDepthFromCurvesToMeshOperator
//                 CreateClustersFromSlicePolygonsOperator
//   sicurvetasks  CreateCurvePartitionClusters
//
// How the contract is mapped onto this build:
//  * "Operator exposing a5bdcbbd-..." (the curve-list-to-mesh family) = an operator of type `CurveListToMesh`, or
//    this build's mesh text generator, which is text operator and mesh converter in one.
//  * "Operator exposing b99eae89-..." (text operator) = the text generator (`textgeom`).
//  * "Operator exposing bc58fcde-..." = an operator of type `slicepolygonsop`.
//  * Operators here have no ports. A cluster connected to an operator's port group is recorded on both sides
//    (`portConnectionOf(cluster)`, `connectedClusters(op)`); the operators of this build do not fill the clusters.
//  * The partition list of the real operators is not available: connected polygon islands (mesh) and the single
//    curves of the list (curve) stand in, and the command logs that.
import { App, CommandDef } from '../core/commands';
import { X3DObject, Operator, Cluster } from '../core/scene';
import type { MeshData } from '../core/geometry';
import type { CurveData } from '../core/curves';
import { unset, findNode, findObject } from './viewEditPropertyHelpers';
import { fail, setStatus, setOut, logNya, ownerOf, E_INVALIDARG, S_OK } from './meshCurveStepTasks';

type ClusterKind = 'pnt' | 'edge' | 'poly' | 'sample';
const connections = new WeakMap<Cluster, { operator: Operator; group: number }>();
export const portConnectionOf = (c: Cluster) => connections.get(c) ?? null;
export function connectedClusters(op: Operator): { cluster: Cluster; group: number }[] {
  const o = ownerOf(op); if (!o) return [];
  return o.clusters.filter(c => connections.get(c)?.operator === op).map(c => ({ cluster: c, group: connections.get(c)!.group }));
}

const isMeshConverter = (op: Operator) => op.type === 'CurveListToMesh' || (op.type === 'textgeom' && (op as any).mode !== 'curves');
const isTextOperator = (op: Operator) => op.type === 'textgeom';
const isSlice = (op: Operator) => op.type === 'slicepolygonsop';
const topMost = (o: X3DObject, pred: (op: Operator) => boolean): Operator | null => {
  const ops = o.primitive?.operators ?? []; for (let i = ops.length - 1; i >= 0; i--) if (pred(ops[i])) return ops[i]; return null;
};
const hasGeometry = (o: X3DObject) => { try { return !!o.primitive?.geom(); } catch { return false; } };
const listOf = (arg: any): any[] => Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg];

/** Input selection shared by the four commands: a non-empty InspectedObjectsArray wins (each element of the accepted
 *  operator class contributes the object on its port, other elements are ignored, InputObjs is not read). */
function inputObjects(app: App, command: string, a: Record<string, any>, accepted: (op: Operator) => boolean): X3DObject[] {
  const out: X3DObject[] = [];
  const add = (o: X3DObject | null | undefined) => { if (o && !out.includes(o)) out.push(o); };
  const inspected = Array.isArray(a.InspectedObjectsArray) ? a.InspectedObjectsArray : [];
  if (inspected.length) {
    // inferred: the object attached to the operator's port is the object whose stack holds the operator
    for (const x of inspected) { const n = typeof x === 'string' ? findNode(app, x) : x; if (n instanceof Operator && accepted(n)) add(ownerOf(n)); }
  } else if (unset(a.InputObjs)) {
    // inferred: the object-list argument handler supplies the selection when nothing is passed
    for (const o of app.selectedObjects) add(o);
  } else {
    for (const x of listOf(a.InputObjs)) add(x instanceof X3DObject ? x : typeof x === 'string' ? findObject(app, x) : undefined);
  }
  if (!out.length) throw fail(E_INVALIDARG, `${command}: empty object list`);
  return out;
}
/** inferred: a cluster name already used on the object gets the next free number appended. */
function uniqueClusterName(o: X3DObject, name: string, taken: Set<string>): string {
  const used = (n: string) => taken.has(n) || o.clusters.some(c => c.name === n);
  let n = name; for (let i = 1; used(n); i++) n = `${name}${i}`;
  taken.add(n); return n;
}
function createCluster(app: App, label: string, o: X3DObject, name: string, kind: string, elements: (number | string)[]): Cluster {
  const c = new Cluster(name, kind as ClusterKind, new Set(elements));
  app.record(label, () => { o.addCluster(c); }, () => { o.removeCluster(c); });
  return c;
}
function connect(app: App, label: string, c: Cluster, operator: Operator, group: number): void {
  app.record(label, () => { connections.set(c, { operator, group }); }, () => { connections.delete(c); });
}

/** Stand-in partition list of a mesh: its connected polygon islands, in order of their first polygon. */
export function polygonIslands(m: MeshData): number[][] {
  const owner = new Map<number, number>(); const parent: number[] = m.polygons.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  m.polygons.forEach((f, fi) => { for (const v of f) { const o = owner.get(v); if (o === undefined) owner.set(v, fi); else parent[find(fi)] = find(o); } });
  const groups = new Map<number, number[]>();
  m.polygons.forEach((_, fi) => { const r = find(fi); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(fi); });
  return [...groups.values()];
}
const curvesOf = (c: CurveData & { subcurves?: CurveData[] }): CurveData[] => [c, ...(c.subcurves ?? [])];
/** One suffix per partition: `_` + the corresponding character of the text. */
const suffixes = (text: string, n: number): string[] => Array.from({ length: n }, (_, i) => { const ch = [...text][i]; return ch === undefined ? '' : `_${ch}`; });

function partitionClusters(app: App, command: string, a: Record<string, any>, curve: boolean): void {
  const objects = inputObjects(app, command, a, curve ? isTextOperator : isMeshConverter);
  const created: Cluster[] = [];
  for (const o of objects) {
    if (!hasGeometry(o)) continue;
    const op = topMost(o, curve ? isTextOperator : isMeshConverter); if (!op) continue;
    let text: string | null = null, partitions: (number | string)[][];
    if (curve) {
      text = String(op.val('text') ?? '');
      const c = o.primitive!.curve(); if (!c) continue;
      partitions = curvesOf(c).map((_, i) => [i]);
    } else {
      // The text operator: this operator itself, or the one on the object feeding the single instance of port group 0.
      const inputs: X3DObject[] = (op as any).inputs ?? [];
      const source = isTextOperator(op) ? op : inputs.length === 1 ? topMost(inputs[0], isTextOperator) : null;
      if (source) text = String(source.val('text') ?? '');
      const m = o.primitive!.mesh(); if (!m) continue;
      partitions = polygonIslands(m);
    }
    logNya(app, command, `the operator's partition list (${curve ? 'each curve of the list' : 'connected polygon islands'} stand in for it)`);
    const prefix = text === null ? 'Face' : 'Char'; const suffix = text === null ? [] : suffixes(text, partitions.length);
    const taken = new Set<string>();
    partitions.forEach((elements, i) => {
      // inferred: curve partitions are sub-curve clusters (the contract does not name the type); mesh ones are polygon clusters
      created.push(createCluster(app, command, o, uniqueClusterName(o, prefix + (suffix[i] ?? ''), taken), curve ? 'subcrv' : 'poly', elements));
    });
  }
  if (created.length) logNya(app, command, 'the final sub-task run on the list of created clusters', 'Q4');
  app.events.emit('scene');
  setOut(app, command, a, { InputObjs: objects });   // RePackArg writes the input list back
  stateOf_created(app, command, created);
  setStatus(app, command, S_OK);
}
/** The created clusters are not an output argument of the partition commands; the check script reads them here. */
function stateOf_created(app: App, command: string, created: Cluster[]): void {
  ((app as any).meshCurveStepTasks.out[command] ??= {}).created = created;
}

const DEPTH: [string, number][] = [['Front', 3], ['FrontBevel', 4], ['Extrusion', 5], ['BackBevel', 6], ['Back', 7]];
function clustersAlongDepth(app: App, a: Record<string, any>): Cluster[] {
  const C = 'CreateClustersAlongDepthFromCurvesToMeshOperator';
  const objects = inputObjects(app, C, a, isMeshConverter);
  const created: Cluster[] = [];
  for (const o of objects) {
    if (!hasGeometry(o)) continue;
    const op = topMost(o, isMeshConverter); if (!op) continue;
    const existing = new Set(o.clusters.filter(c => c.compKind === 'poly').map(c => c.name));
    for (const [name, group] of DEPTH) {
      if (existing.has(name)) continue;
      const c = createCluster(app, C, o, name, 'poly', []);
      connect(app, C, c, op, group);
      created.push(c);
    }
  }
  if (created.length) logNya(app, C, 'the operator filling the connected clusters (they are created empty and stay empty in this build)');
  app.events.emit('scene');
  setOut(app, C, a, { InputObjs: objects, CreatedClusters: created }); setStatus(app, C, S_OK);
  return created;
}
const SLICE: [string, string, number][] = [['PolysAbove', 'poly', 2], ['PolysBelow', 'poly', 3], ['EdgesAlong', 'edge', 4]];
function clustersFromSlice(app: App, a: Record<string, any>): Cluster[] {
  const C = 'CreateClustersFromSlicePolygonsOperator';
  const objects = inputObjects(app, C, a, isSlice);
  const created: Cluster[] = [];
  for (const o of objects) {
    if (!hasGeometry(o)) continue;
    const op = topMost(o, isSlice); if (!op) continue;
    // no "already exists" check, unlike the Curves To Mesh command
    for (const [name, kind, group] of SLICE) {
      const c = createCluster(app, C, o, name, kind, []);
      connect(app, C, c, op, group);
      created.push(c);
    }
  }
  if (created.length) logNya(app, C, 'the operator filling the connected clusters (they are created empty and stay empty in this build)');
  app.events.emit('scene');
  setOut(app, C, a, { InputObjs: objects, CreatedClusters: created }); setStatus(app, C, S_OK);
  return created;
}

export function registerMeshCurveStepTaskClusters(app: App, reg: (def: CommandDef) => void) {
  const LIST = [{ name: 'InputObjs', default: null }, { name: 'InspectedObjectsArray', default: null }];
  const OUT = [...LIST, { name: 'CreatedClusters', default: null }];
  reg({
    name: 'CreateMeshPartitionClusters', label: 'Create Mesh Partition Clusters', category: 'Cluster', description: 'Creates one polygon cluster per partition of the operator that built the mesh',
    args: LIST, execute: (app, a) => partitionClusters(app, 'CreateMeshPartitionClusters', a, false),
  });
  reg({
    name: 'CreateCurvePartitionClusters', label: 'Create Curve Partition Clusters', category: 'Cluster', description: 'Creates one cluster per partition of the text operator that built the curve list',
    args: LIST, execute: (app, a) => partitionClusters(app, 'CreateCurvePartitionClusters', a, true),
  });
  reg({
    name: 'CreateClustersAlongDepthFromCurvesToMeshOperator', label: 'Create Front&Back Clusters for CurvesToMesh', category: 'Cluster', description: 'Creates the Front, FrontBevel, Extrusion, BackBevel and Back clusters of a Curves To Mesh result',
    args: OUT, execute: (app, a) => clustersAlongDepth(app, a),
  });
  reg({
    name: 'CreateClustersFromSlicePolygonsOperator', label: 'Create Clusters for SlicePolygonsOp', category: 'Cluster', description: 'Creates the PolysAbove, PolysBelow and EdgesAlong clusters of a Slice Polygons operator',
    args: OUT, execute: (app, a) => clustersFromSlice(app, a),
  });
  const st = (app as any).meshCurveStepTasks;
  st.portConnection = (c: Cluster) => { const k = portConnectionOf(c); return k ? { operator: k.operator, group: k.group } : null; };
  st.connectedClusters = connectedClusters;
}
