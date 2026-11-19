// Row CMD-B11a: the CollapseOp per-operator step (task slot 15), wired from the batch-12 answer of
// docs/ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md ("Batch 12 answers", Q5). Original code from that prose.
//
// The step, for one operator with at least one input:
//   1. read the point positions at the current time from the operator output (A) and from its last input (B);
//      different point counts: stop silently;
//   2. offsets = A - B per point; with Relative each offset is expressed in the point's local reference frame;
//   3. a point cluster on the whole object and a shape key named "Offsets" on it (reference mode 1 Relative, 2 otherwise)
//      hold the offsets; the key is connected through a shape-combiner element; the operator is removed (inferred).
// How it maps onto this build: the construction stack is `primitive.operators` (generator first); the shape combiner is
// a ShapeBlendOperator (core/shape.ts) owned by the new cluster, placed where the collapsed operator was, so the
// evaluated geometry does not change. The muting of the first operator outside the collapsed family is not modelled
// (this build has no operator families; nothing is muted).
import * as THREE from 'three';
import type { App } from '../core/commands';
import { Cluster, Operator, Property, X3DObject } from '../core/scene';
import { str, int, num as numP } from '../core/params';
import { ShapeBlendOperator, ensureShapeBase } from '../core/shape';
import type { MeshData } from '../core/geometry';

/** Positions after the operators [0, upTo) of a stack (a fresh evaluation; null when the stack gives no mesh). */
function positionsUpTo(ops: Operator[], upTo: number): { positions: Float32Array; mesh: MeshData } | null {
  let m: any = null;
  for (let i = 0; i < upTo; i++) { try { m = ops[i].apply(m); } catch { /* the stack's own evaluation ignores failing operators too */ } }
  return m && m.positions ? { positions: Float32Array.from(m.positions), mesh: m as MeshData } : null;
}

/** Per-point local reference frame (rows t, n, b). inferred: normal = average of the adjacent polygon normals, tangent = the
 *  direction to the first neighbour of the point made orthogonal to the normal (the frame helper of the step was not read). */
function localFrames(mesh: MeshData): THREE.Matrix3[] {
  const P = mesh.positions; const n = P.length / 3;
  const v = (i: number) => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const normals = Array.from({ length: n }, () => new THREE.Vector3()); const neighbour: number[] = new Array(n).fill(-1);
  for (const f of mesh.polygons) {
    if (f.length < 3) continue;
    const fn = new THREE.Vector3().subVectors(v(f[1]), v(f[0])).cross(new THREE.Vector3().subVectors(v(f[2]), v(f[0])));
    f.forEach((p, k) => { normals[p].add(fn); if (neighbour[p] < 0) neighbour[p] = f[(k + 1) % f.length]; });
  }
  return normals.map((nr, i) => {
    const N = nr.lengthSq() > 1e-20 ? nr.normalize() : new THREE.Vector3(0, 1, 0);
    let T = neighbour[i] >= 0 ? v(neighbour[i]).sub(v(i)) : new THREE.Vector3(1, 0, 0);
    T.sub(N.clone().multiplyScalar(T.dot(N))); if (T.lengthSq() < 1e-20) T = new THREE.Vector3(1, 0, 0).cross(N).lengthSq() > 1e-12 ? new THREE.Vector3(1, 0, 0).cross(N) : new THREE.Vector3(0, 0, 1);
    T.normalize(); const B = new THREE.Vector3().crossVectors(T, N);
    return new THREE.Matrix3().set(T.x, T.y, T.z, N.x, N.y, N.z, B.x, B.y, B.z);
  });
}

export interface CollapseResult { key: Property; cluster: Cluster; combiner: ShapeBlendOperator }

/** The per-operator step. Returns null when it stops (no input, no mesh, different point counts, operator not in a stack). */
export function collapseOperator(app: App, op: Operator, relative: boolean): CollapseResult | null {
  const prim: any = op.parent; const obj = prim?.parent;
  if (!prim || !(obj instanceof X3DObject) || !Array.isArray(prim.operators)) return null;
  const ops: Operator[] = prim.operators; const at = ops.indexOf(op);
  if (at < 1) return null; // no input (the generator at the bottom of the stack)
  const B = positionsUpTo(ops, at), A = positionsUpTo(ops, at + 1);
  if (!A || !B || A.positions.length !== B.positions.length) return null; // point counts differ: silent stop
  const n = B.positions.length / 3;
  const offsets = new Float32Array(B.positions.length);
  for (let i = 0; i < offsets.length; i++) offsets[i] = A.positions[i] - B.positions[i];
  let stored = offsets;
  if (relative) {
    const frames = localFrames(B.mesh); stored = new Float32Array(offsets.length);
    for (let i = 0; i < n; i++) { const d = new THREE.Vector3(offsets[i * 3], offsets[i * 3 + 1], offsets[i * 3 + 2]).applyMatrix3(frames[i]); stored[i * 3] = d.x; stored[i * 3 + 1] = d.y; stored[i * 3 + 2] = d.z; }
  }
  // point cluster on the whole object and the "Offsets" shape key (reference mode 1 Relative, 2 otherwise)
  const taken = new Set(obj.clusters.map(c => c.name)); let cname = 'Point'; for (let k = 1; taken.has(cname); k++) cname = `Point${k}`; // inferred: cluster name
  const cluster = new Cluster(cname, 'pnt', new Set(Array.from({ length: n }, (_, i) => i)));
  // the key as this build's blender reads it: absolute shape positions (B + offset) over a base of B, so weight 1 gives A
  const shape = Array.from(B.positions, (x, i) => x + offsets[i]);
  const key = new Property('Offsets', 'shapekey', [
    str('data', JSON.stringify(shape), 'Positions', { readOnly: true }), int('points', n, 'Points', { readOnly: true }),
    numP('weight', 1, 'Weight'), int('refmode', relative ? 1 : 2, 'Reference Mode', { readOnly: true }),
    str('offsets', JSON.stringify(Array.from(stored)), 'Offsets', { readOnly: true }),
  ]);
  // the blender reads the keys of its owner; the owner view is the cluster's property list (no transform of its own)
  const ownerView = { properties: cluster.properties, globalMatrix: () => new THREE.Matrix4(), primitive: null };
  const combiner = new ShapeBlendOperator(() => ownerView as any); combiner.region = op.region;
  app.record('CollapseOp', () => {
    obj.addCluster(cluster);
    if (!cluster.properties.includes(key)) { ensureShapeBase(cluster, B.positions); cluster.addProperty(key); }
    const i = ops.indexOf(op); if (i >= 0) ops.splice(i, 1, combiner); combiner.parent = prim; op.parent = null; prim.dirty = true;
  }, () => {
    const i = ops.indexOf(combiner); if (i >= 0) ops.splice(i, 1, op); op.parent = prim; combiner.parent = null; prim.dirty = true;
    obj.removeCluster(cluster);
  });
  return { key, cluster, combiner };
}
