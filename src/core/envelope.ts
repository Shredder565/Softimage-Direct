// Envelopes (Animate > Deform > Envelope): linear-blend skinning of a mesh by deformers (bones, nulls…) with a
// reference pose per deformer, per-point weights computed by distance falloff, smoothing, reassignment and locks.
// The weights live in an "Envelope_Weights" property on the mesh's Point cluster, like Softimage.
import * as THREE from 'three';
import { MeshData } from './geometry';
import { X3DObject, Operator, Property, stampOf } from './scene';
import { bool, int, num, enumP } from './params';

export class EnvelopeOperator extends Operator {
  /** deformer → its global matrix at the reference pose */
  refPoses = new Map<X3DObject, THREE.Matrix4>();
  /** per point: Float32Array of weights (one per deformer, normalised to 1) */
  weights: Float32Array[] = [];
  locked = new Set<number>();
  deformers: X3DObject[];
  constructor(deformers: X3DObject[], readonly owner: () => X3DObject | null) {
    super('Envelope Op', 'envelopop', [int('nbdeformers', deformers.length, 'Deformers', { readOnly: true }), enumP('weighting', 0, [{ label: 'Distance (falloff)', value: 0 }, { label: 'Nearest deformer', value: 1 }, { label: 'Heat-like (smoothed distance)', value: 2 }], 'Initial Weighting'), int('maxdeformers', 2, 'Max Deformers per Point', { min: 1, max: 8 }), num('falloff', 2, 'Falloff Exponent', { min: 0.1, max: 8 }), bool('mute', false, 'Mute')]);
    this.deformers = deformers.slice();
  }
  depStamp() { return stampOf([...this.deformers, this.owner()]); }
  setReferencePoses() { for (const d of this.deformers) this.refPoses.set(d, d.globalMatrix().clone()); }
  /** Bone segment (start → end in world) used for distances; nulls are points. */
  private segment(d: X3DObject, M: THREE.Matrix4): [THREE.Vector3, THREE.Vector3] { const a = new THREE.Vector3().setFromMatrixPosition(M); const L = Number(d.get('length')?.value ?? 0); if (d.type === 'bone' && L > 0) { const b = new THREE.Vector3(L, 0, 0).applyMatrix4(M); return [a, b]; } return [a, a.clone()]; }
  private distToSeg(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) { const ab = b.clone().sub(a); const l2 = ab.lengthSq(); if (l2 < 1e-12) return p.distanceTo(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / l2)); return p.distanceTo(a.clone().add(ab.multiplyScalar(t))); }
  /** Initial weights from the reference pose (object points in world space at bind time). */
  computeWeights(m: MeshData, meGlobal: THREE.Matrix4, points?: Iterable<number>) {
    const n = m.positions.length / 3; const mode = Number(this.val('weighting')); const maxD = Math.max(1, Number(this.val('maxdeformers'))); const fo = Number(this.val('falloff'));
    const segs = this.deformers.map(d => this.segment(d, this.refPoses.get(d) ?? d.globalMatrix()));
    if (this.weights.length !== n) { const old = this.weights; this.weights = Array.from({ length: n }, (_, i) => old[i] ?? new Float32Array(this.deformers.length)); }
    const idx = points ? [...points] : Array.from({ length: n }, (_, i) => i);
    for (const i of idx) {
      if (this.locked.has(i)) continue; const p = new THREE.Vector3(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]).applyMatrix4(meGlobal);
      const d = segs.map(([a, b]) => this.distToSeg(p, a, b)); const order = d.map((x, k) => k).sort((x, y) => d[x] - d[y]); const w = new Float32Array(this.deformers.length);
      if (mode === 1) w[order[0]] = 1;
      else { const near = order.slice(0, maxD); const dmin = Math.max(1e-6, d[near[0]]); let sum = 0; for (const k of near) { const v = 1 / Math.pow(Math.max(1e-6, d[k]) / dmin, fo); w[k] = v; sum += v; } for (const k of near) w[k] /= sum; }
      this.weights[i] = w;
    }
    if (mode === 2) this.smooth(m, 2);
  }
  smooth(m: MeshData, iterations = 1, points?: Set<number>) {
    const n = m.positions.length / 3; const nbr: Set<number>[] = Array.from({ length: n }, () => new Set()); for (const f of m.polygons) for (let i = 0; i < f.length; i++) { nbr[f[i]].add(f[(i + 1) % f.length]); nbr[f[(i + 1) % f.length]].add(f[i]); }
    for (let it = 0; it < iterations; it++) { const next = this.weights.map((w, i) => { if (this.locked.has(i) || (points && !points.has(i))) return w; const ns = [...nbr[i]]; if (!ns.length) return w; const o = new Float32Array(w.length); for (let k = 0; k < w.length; k++) { let s = w[k] * 0.5; for (const j of ns) s += (this.weights[j]?.[k] ?? 0) * 0.5 / ns.length; o[k] = s; } return normalize(o); }); this.weights = next; }
  }
  /** Give the given points entirely to the given deformers (equal shares), e.g. Reassign Locally. */
  reassign(points: Iterable<number>, deformers: X3DObject[]) { const ks = deformers.map(d => this.deformers.indexOf(d)).filter(k => k >= 0); if (!ks.length) return; for (const i of points) { const w = new Float32Array(this.deformers.length); for (const k of ks) w[k] = 1 / ks.length; this.weights[i] = w; } }
  addDeformers(ds: X3DObject[]) { const add = ds.filter(d => !this.deformers.includes(d)); if (!add.length) return; for (const d of add) { this.deformers.push(d); this.refPoses.set(d, d.globalMatrix().clone()); } this.weights = this.weights.map(w => { const o = new Float32Array(this.deformers.length); o.set(w); return o; }); this.set('nbdeformers', this.deformers.length); }
  removeDeformers(ds: X3DObject[]) { const keep = this.deformers.map((d, k) => ds.includes(d) ? -1 : k).filter(k => k >= 0); this.deformers = keep.map(k => this.deformers[k]); this.weights = this.weights.map(w => normalize(Float32Array.from(keep.map(k => w[k])))); this.set('nbdeformers', this.deformers.length); }
  apply(m: MeshData | null): MeshData | null {
    if (!m || this.val('mute')) return m; const me = this.owner(); if (!me || !this.deformers.length) return m;
    const meG = me.globalMatrix(), meInv = meG.clone().invert(); const n = m.positions.length / 3; if (this.weights.length !== n) this.computeWeights(m, meG);
    // skinning matrices in object space: meInv · M_now · M_ref⁻¹ · meG
    const mats = this.deformers.map(d => { const ref = this.refPoses.get(d) ?? d.globalMatrix(); return meInv.clone().multiply(d.globalMatrix()).multiply(ref.clone().invert()).multiply(meG); });
    const out = { ...m, positions: new Float32Array(m.positions) }; const p = new THREE.Vector3(), q = new THREE.Vector3(), acc = new THREE.Vector3();
    for (let i = 0; i < n; i++) { const w = this.weights[i]; if (!w) continue; p.set(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]); acc.set(0, 0, 0); let sum = 0; for (let k = 0; k < w.length; k++) { if (!w[k]) continue; q.copy(p).applyMatrix4(mats[k]); acc.addScaledVector(q, w[k]); sum += w[k]; } if (sum > 0) { acc.multiplyScalar(1 / sum); out.positions[i * 3] = acc.x; out.positions[i * 3 + 1] = acc.y; out.positions[i * 3 + 2] = acc.z; } }
    return out;
  }
}
const normalize = (w: Float32Array) => { let s = 0; for (const x of w) s += x; if (s > 0) for (let k = 0; k < w.length; k++) w[k] /= s; return w; };

/** The Envelope_Weights property on the point cluster: shows one deformer's weights in the viewport, exposes locks. */
export function makeEnvelopeProperty(op: EnvelopeOperator): Property {
  const p = new Property('Envelope_Weights', 'envelope', [enumP('deformer', 0, op.deformers.map((d, i) => ({ label: d.name, value: i })), 'Display Deformer'), int('locked', 0, 'Locked Points', { readOnly: true })]);
  (p as any).op = op;
  (p as any).weightsFor = () => { const k = Number(p.val('deformer') ?? 0); const out = new Map<number, number>(); op.weights.forEach((w, i) => out.set(i, w[k] ?? 0)); return out; };
  (p as any).refreshDeformers = () => { const prm = p.get('deformer'); if (prm) (prm.def as any).items = op.deformers.map((d, i) => ({ label: d.name, value: i })); };
  return p;
}
export function envelopeOf(o: X3DObject): EnvelopeOperator | null { const op = o.primitive?.operators.find(x => x instanceof EnvelopeOperator); return (op as EnvelopeOperator) ?? null; }
