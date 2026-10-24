// Softimage shape-key blending: relative targets on a mesh (StoreShapeKey / ApplyShapeKey).
import { Property, Operator, stampOf } from './scene';
import { str, int, bool } from './params';
import type { MeshData } from './geometry';

/** Snapshot rest / reference positions used for relative shape blending. */
export function ensureShapeBase(owner: { properties: Property[]; addProperty(p: Property): Property }, positions: Float32Array | number[]): Property {
  let base = owner.properties.find(p => p.type === 'shapebase');
  if (!base) {
    base = new Property('ShapeBase', 'shapebase', [
      str('data', JSON.stringify(Array.from(positions)), 'Positions', { readOnly: true }),
      int('points', positions.length / 3, 'Points', { readOnly: true }),
    ]);
    owner.addProperty(base);
  }
  return base;
}

export function parsePositions(raw: string): Float32Array {
  try { return Float32Array.from(JSON.parse(raw || '[]')); } catch { return new Float32Array(); }
}

/**
 * Softimage shape blend onto current mesh `input`:
 * - relative (default): input + weight*(shape - base)
 * - absolute: lerp(input, shape, weight)
 */
export function blendShapeKeys(
  mesh: MeshData,
  base: Float32Array,
  shapes: { positions: Float32Array; weight: number }[],
  relative = true,
): Float32Array {
  const out = new Float32Array(mesh.positions);
  for (const sh of shapes) {
    const w = Number(sh.weight) || 0; if (!w) continue;
    const m = Math.min(out.length, sh.positions.length, base.length || out.length);
    for (let i = 0; i < m; i++) {
      if (relative) out[i] += w * (sh.positions[i] - (base[i] ?? mesh.positions[i]));
      else out[i] = out[i] * (1 - w) + sh.positions[i] * w;
    }
  }
  return out;
}

/** Construction-history shape blender (Animation region) so blends survive geom rebuilds. */
export class ShapeBlendOperator extends Operator {
  constructor(readonly owner: () => { properties: Property[] } | null) {
    super('Shape Blend', 'shapblend', [bool('mute', false, 'Mute'), bool('relative', true, 'Relative')]);
    this.region = 'animation';
  }
  depStamp() {
    const o = this.owner();
    if (!o) return '0';
    const keys = o.properties.filter(p => p.type === 'shapekey');
    return stampOf([o as any]) + '|' + keys.map(k => `${k.name}:${k.val('weight')}`).join(',');
  }
  apply(input: MeshData | null): MeshData | null {
    if (!input?.positions || this.val('mute')) return input;
    const o = this.owner(); if (!o) return input;
    const keys = o.properties.filter(p => p.type === 'shapekey');
    if (!keys.length) return input;
    const baseProp = o.properties.find(p => p.type === 'shapebase');
    const base = baseProp ? parsePositions(String(baseProp.val('data'))) : Float32Array.from(input.positions);
    const rest = base.length === input.positions.length ? base : Float32Array.from(input.positions);
    const shapes = keys.map(sk => ({ positions: parsePositions(String(sk.val('data'))), weight: Number(sk.val('weight') ?? 0) }));
    const blended = blendShapeKeys(input, rest, shapes, !!this.val('relative'));
    return { ...input, positions: blended };
  }
}

/** Ensure a ShapeBlendOperator sits on the mesh primitive (idempotent). */
export function ensureShapeOperator(obj: { properties: Property[]; primitive?: { operators: Operator[]; addOperator(op: Operator): void } | null }): ShapeBlendOperator | null {
  const prim = obj.primitive; if (!prim) return null;
  let op = prim.operators.find(o => o.type === 'shapblend') as ShapeBlendOperator | undefined;
  if (!op) {
    op = new ShapeBlendOperator(() => obj);
    prim.addOperator(op);
  }
  return op;
}

/** Apply all shapekey properties via the shape blend operator (marks prim dirty). */
export function evaluateShapes(owner: { properties: Property[]; primitive?: { operators: Operator[]; addOperator(op: Operator): void; dirty?: boolean; mesh(): MeshData | null } | null }, _relative = true): number {
  const keys = owner.properties.filter(p => p.type === 'shapekey');
  if (!keys.length || !owner.primitive) return 0;
  ensureShapeOperator(owner);
  (owner.primitive as any).dirty = true;
  owner.primitive.mesh(); // force eval through ShapeBlendOperator
  return keys.length;
}
