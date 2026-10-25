// ICE: a node graph evaluated per point by an ICETree operator on the construction stack. Nodes cover the Softimage
// basics (Get/Set Data, math, vectors, noise, conditions, compounds) and the preset compounds Footprints, Turbulize,
// Randomize Position, Push Points, Twist, Jitter are expressed as graphs so the ICE Tree view can open and edit them.
import { MeshData } from './geometry';
import { Operator, X3DObject, stampOf } from './scene';
import { ParamSet } from './params';
import { num, int, bool, enumP, str } from './params';
import type { V3 } from './curves';
import { capHoles } from './topology2';

export type IceValue = number | V3 | boolean;
export interface IcePort { name: string; type: 'scalar' | 'vector' | 'bool' | 'any'; }
export interface IceNodeDef { type: string; category: string; inputs: IcePort[]; outputs: IcePort[]; params?: any[]; eval: (inp: Record<string, IceValue | undefined>, ctx: IceCtx, p: ParamSet) => Record<string, IceValue>; }
export interface IceCtx { index: number; count: number; pos: V3; normal: V3; frame: number; time: number; objPos: V3; mesh: MeshData; globals: Map<string, any>; }
export interface IceNode { id: number; type: string; x: number; y: number; params: ParamSet; }
export interface IceLink { from: number; fromPort: string; to: number; toPort: string; }

const v = (x: IceValue | undefined, d: V3 = [0, 0, 0]): V3 => Array.isArray(x) ? x as V3 : typeof x === 'number' ? [x, x, x] : d;
const s = (x: IceValue | undefined, d = 0): number => typeof x === 'number' ? x : typeof x === 'boolean' ? (x ? 1 : 0) : Array.isArray(x) ? Math.hypot(x[0], x[1], x[2]) : d;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]); const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// deterministic hash noise + 3D value noise (turbulence)
const hash = (x: number, y: number, z: number, seed: number) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647 ^ 1274126177) ^ Math.imul(seed | 0, 974711); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const smooth = (t: number) => t * t * (3 - 2 * t);
export function noise3(p: V3, seed = 0): number { const xi = Math.floor(p[0]), yi = Math.floor(p[1]), zi = Math.floor(p[2]); const fx = smooth(p[0] - xi), fy = smooth(p[1] - yi), fz = smooth(p[2] - zi); const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed); const lx = (a: number, b: number, t: number) => a + (b - a) * t; return lx(lx(lx(c(0, 0, 0), c(1, 0, 0), fx), lx(c(0, 1, 0), c(1, 1, 0), fx), fy), lx(lx(c(0, 0, 1), c(1, 0, 1), fx), lx(c(0, 1, 1), c(1, 1, 1), fx), fy), fz) * 2 - 1; }
export function turbulence(p: V3, octaves = 3, seed = 0): number { let a = 0, amp = 1, f = 1, n = 0; for (let o = 0; o < octaves; o++) { a += noise3(mul(p, f), seed + o) * amp; n += amp; amp *= 0.5; f *= 2; } return a / n; }

const ops = (f: (a: number, b: number) => number, fv: (a: V3, b: V3) => V3) => (inp: Record<string, IceValue | undefined>) => { const a = inp.first, b = inp.second; if (Array.isArray(a) || Array.isArray(b)) return { result: fv(v(a), v(b)) }; return { result: f(s(a), s(b)) }; };
export const ICE_NODES: Record<string, IceNodeDef> = {
  // ---- data
  'Get Data': { type: 'Get Data', category: 'Data Access', inputs: [], outputs: [{ name: 'value', type: 'any' }], params: [enumP('reference', 'PointPosition', ['PointPosition', 'PointNormal', 'PointID', 'NbPoints', 'Time', 'Frame', 'ObjectPosition', 'PointVelocity'].map(k => ({ label: k, value: k })), 'Reference')], eval: (_i, c, p) => { switch (String(p.val('reference'))) { case 'PointNormal': return { value: c.normal }; case 'PointID': return { value: c.index }; case 'NbPoints': return { value: c.count }; case 'Time': return { value: c.time }; case 'Frame': return { value: c.frame }; case 'ObjectPosition': return { value: c.objPos }; case 'PointVelocity': return { value: [0, 0, 0] }; default: return { value: c.pos }; } } },
  'Set Data': { type: 'Set Data', category: 'Data Access', inputs: [{ name: 'value', type: 'any' }], outputs: [{ name: 'execute', type: 'any' }], params: [enumP('reference', 'PointPosition', ['PointPosition', 'PointColor', 'PointSize', 'Weight'].map(k => ({ label: k, value: k })), 'Reference')], eval: (i, c, p) => { const ref = String(p.val('reference')); if (ref === 'PointPosition' && i.value !== undefined) c.globals.set('pos:' + c.index, v(i.value, c.pos)); else if (i.value !== undefined) c.globals.set(ref + ':' + c.index, i.value); return { execute: true }; } },
  'Scalar': { type: 'Scalar', category: 'Constant', inputs: [], outputs: [{ name: 'result', type: 'scalar' }], params: [num('value', 1, 'Value')], eval: (_i, _c, p) => ({ result: Number(p.val('value')) }) },
  'Integer': { type: 'Integer', category: 'Constant', inputs: [], outputs: [{ name: 'result', type: 'scalar' }], params: [num('value', 1, 'Value')], eval: (_i, _c, p) => ({ result: Math.round(Number(p.val('value'))) }) },
  'Vector3': { type: 'Vector3', category: 'Constant', inputs: [], outputs: [{ name: 'result', type: 'vector' }], params: [num('x', 0, 'X'), num('y', 1, 'Y'), num('z', 0, 'Z')], eval: (_i, _c, p) => ({ result: [Number(p.val('x')), Number(p.val('y')), Number(p.val('z'))] }) },
  'Boolean': { type: 'Boolean', category: 'Constant', inputs: [], outputs: [{ name: 'result', type: 'bool' }], params: [bool('value', true, 'Value')], eval: (_i, _c, p) => ({ result: !!p.val('value') }) },
  // ---- math
  'Add': { type: 'Add', category: 'Math/Basic', inputs: [{ name: 'first', type: 'any' }, { name: 'second', type: 'any' }], outputs: [{ name: 'result', type: 'any' }], eval: ops((a, b) => a + b, add) },
  'Subtract': { type: 'Subtract', category: 'Math/Basic', inputs: [{ name: 'first', type: 'any' }, { name: 'second', type: 'any' }], outputs: [{ name: 'result', type: 'any' }], eval: ops((a, b) => a - b, sub) },
  'Multiply': { type: 'Multiply', category: 'Math/Basic', inputs: [{ name: 'first', type: 'any' }, { name: 'second', type: 'any' }], outputs: [{ name: 'result', type: 'any' }], eval: (i) => { const a = i.first, b = i.second; if (Array.isArray(a) && !Array.isArray(b)) return { result: mul(a as V3, s(b, 1)) }; if (Array.isArray(b) && !Array.isArray(a)) return { result: mul(b as V3, s(a, 1)) }; if (Array.isArray(a) && Array.isArray(b)) return { result: [a[0] * b[0], a[1] * b[1], a[2] * b[2]] as V3 }; return { result: s(a, 1) * s(b, 1) }; } },
  'Divide': { type: 'Divide', category: 'Math/Basic', inputs: [{ name: 'first', type: 'any' }, { name: 'second', type: 'any' }], outputs: [{ name: 'result', type: 'any' }], eval: (i) => { const b = s(i.second, 1) || 1; return Array.isArray(i.first) ? { result: mul(i.first as V3, 1 / b) } : { result: s(i.first) / b }; } },
  'Multiply by Scalar': { type: 'Multiply by Scalar', category: 'Math/Basic', inputs: [{ name: 'value', type: 'any' }, { name: 'factor', type: 'scalar' }], outputs: [{ name: 'result', type: 'any' }], params: [num('factor', 1, 'Factor')], eval: (i, _c, p) => { const f = i.factor !== undefined ? s(i.factor) : Number(p.val('factor')); return Array.isArray(i.value) ? { result: mul(i.value as V3, f) } : { result: s(i.value) * f }; } },
  'Negate': { type: 'Negate', category: 'Math/Basic', inputs: [{ name: 'value', type: 'any' }], outputs: [{ name: 'result', type: 'any' }], eval: (i) => Array.isArray(i.value) ? { result: mul(i.value as V3, -1) } : { result: -s(i.value) } },
  'Absolute Value': { type: 'Absolute Value', category: 'Math/Basic', inputs: [{ name: 'value', type: 'scalar' }], outputs: [{ name: 'result', type: 'scalar' }], eval: (i) => ({ result: Math.abs(s(i.value)) }) },
  'Sin': { type: 'Sin', category: 'Math/Trigonometry', inputs: [{ name: 'angle', type: 'scalar' }], outputs: [{ name: 'result', type: 'scalar' }], eval: (i) => ({ result: Math.sin(s(i.angle) * Math.PI / 180) }) },
  'Cos': { type: 'Cos', category: 'Math/Trigonometry', inputs: [{ name: 'angle', type: 'scalar' }], outputs: [{ name: 'result', type: 'scalar' }], eval: (i) => ({ result: Math.cos(s(i.angle) * Math.PI / 180) }) },
  'Power': { type: 'Power', category: 'Math/Basic', inputs: [{ name: 'base', type: 'scalar' }, { name: 'exponent', type: 'scalar' }], outputs: [{ name: 'result', type: 'scalar' }], eval: (i) => ({ result: Math.pow(s(i.base), s(i.exponent, 2)) }) },
  'Clamp': { type: 'Clamp', category: 'Math/Basic', inputs: [{ name: 'value', type: 'scalar' }], outputs: [{ name: 'result', type: 'scalar' }], params: [num('min', 0, 'Min'), num('max', 1, 'Max')], eval: (i, _c, p) => ({ result: Math.max(Number(p.val('min')), Math.min(Number(p.val('max')), s(i.value))) }) },
  'Linear Interpolate': { type: 'Linear Interpolate', category: 'Math/Basic', inputs: [{ name: 'first', type: 'any' }, { name: 'second', type: 'any' }, { name: 'blend', type: 'scalar' }], outputs: [{ name: 'result', type: 'any' }], params: [num('blend', 0.5, 'Blend', { min: 0, max: 1 })], eval: (i, _c, p) => { const t = i.blend !== undefined ? s(i.blend) : Number(p.val('blend')); if (Array.isArray(i.first) || Array.isArray(i.second)) { const a = v(i.first), b = v(i.second); return { result: add(a, mul(sub(b, a), t)) }; } return { result: s(i.first) + (s(i.second) - s(i.first)) * t }; } },
  // ---- vectors
  'Length': { type: 'Length', category: 'Math/Vector', inputs: [{ name: 'vector', type: 'vector' }], outputs: [{ name: 'result', type: 'scalar' }], eval: (i) => ({ result: len(v(i.vector)) }) },
  'Normalize': { type: 'Normalize', category: 'Math/Vector', inputs: [{ name: 'vector', type: 'vector' }], outputs: [{ name: 'result', type: 'vector' }], eval: (i) => ({ result: norm(v(i.vector)) }) },
  'Dot Product': { type: 'Dot Product', category: 'Math/Vector', inputs: [{ name: 'first', type: 'vector' }, { name: 'second', type: 'vector' }], outputs: [{ name: 'result', type: 'scalar' }], eval: (i) => { const a = v(i.first), b = v(i.second); return { result: a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }; } },
  'Cross Product': { type: 'Cross Product', category: 'Math/Vector', inputs: [{ name: 'first', type: 'vector' }, { name: 'second', type: 'vector' }], outputs: [{ name: 'result', type: 'vector' }], eval: (i) => { const a = v(i.first), b = v(i.second); return { result: [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as V3 }; } },
  'Scalar to 3D Vector': { type: 'Scalar to 3D Vector', category: 'Conversion', inputs: [{ name: 'x', type: 'scalar' }, { name: 'y', type: 'scalar' }, { name: 'z', type: 'scalar' }], outputs: [{ name: 'vector', type: 'vector' }], eval: (i) => ({ vector: [s(i.x), s(i.y), s(i.z)] as V3 }) },
  '3D Vector to Scalar': { type: '3D Vector to Scalar', category: 'Conversion', inputs: [{ name: 'vector', type: 'vector' }], outputs: [{ name: 'x', type: 'scalar' }, { name: 'y', type: 'scalar' }, { name: 'z', type: 'scalar' }], eval: (i) => { const a = v(i.vector); return { x: a[0], y: a[1], z: a[2] }; } },
  'Rotate Vector': { type: 'Rotate Vector', category: 'Math/Vector', inputs: [{ name: 'vector', type: 'vector' }, { name: 'angle', type: 'scalar' }], outputs: [{ name: 'result', type: 'vector' }], params: [num('ax', 0, 'Axis X'), num('ay', 1, 'Axis Y'), num('az', 0, 'Axis Z'), num('angle', 0, 'Angle')], eval: (i, _c, p) => { const a = norm([Number(p.val('ax')), Number(p.val('ay')), Number(p.val('az'))]); const th = (i.angle !== undefined ? s(i.angle) : Number(p.val('angle'))) * Math.PI / 180; const q = v(i.vector); const c = Math.cos(th), sn = Math.sin(th); const d = a[0] * q[0] + a[1] * q[1] + a[2] * q[2]; const cr: V3 = [a[1] * q[2] - a[2] * q[1], a[2] * q[0] - a[0] * q[2], a[0] * q[1] - a[1] * q[0]]; return { result: add(add(mul(q, c), mul(cr, sn)), mul(a, d * (1 - c))) }; } },
  // ---- randomness / noise
  'Randomize Value': { type: 'Randomize Value', category: 'Math/Random', inputs: [{ name: 'min', type: 'any' }, { name: 'max', type: 'any' }], outputs: [{ name: 'result', type: 'any' }], params: [num('seed', 0, 'Seed'), num('min', -1, 'Min'), num('max', 1, 'Max')], eval: (i, c, p) => { const r = (k: number) => hash(c.index, k, 7, Number(p.val('seed'))); const mn = i.min, mx = i.max; if (Array.isArray(mn) || Array.isArray(mx)) { const a = v(mn, [-1, -1, -1]), b = v(mx, [1, 1, 1]); return { result: [a[0] + (b[0] - a[0]) * r(0), a[1] + (b[1] - a[1]) * r(1), a[2] + (b[2] - a[2]) * r(2)] as V3 }; } const a = mn !== undefined ? s(mn) : Number(p.val('min')), b = mx !== undefined ? s(mx) : Number(p.val('max')); return { result: a + (b - a) * r(0) }; } },
  'Turbulence': { type: 'Turbulence', category: 'Math/Random', inputs: [{ name: 'position', type: 'vector' }], outputs: [{ name: 'result', type: 'scalar' }], params: [num('frequency', 0.5, 'Frequency', { min: 0.001 }), num('octaves', 3, 'Octaves', { min: 1, max: 8 }), num('seed', 0, 'Seed'), num('timefreq', 0, 'Time Frequency')], eval: (i, c, p) => { const q = mul(v(i.position, c.pos), Number(p.val('frequency'))); return { result: turbulence([q[0], q[1] + c.time * Number(p.val('timefreq')), q[2]], Number(p.val('octaves')) | 0, Number(p.val('seed')) | 0) }; } },
  'Turbulence 3D': { type: 'Turbulence 3D', category: 'Math/Random', inputs: [{ name: 'position', type: 'vector' }], outputs: [{ name: 'result', type: 'vector' }], params: [num('frequency', 0.5, 'Frequency', { min: 0.001 }), num('octaves', 3, 'Octaves', { min: 1, max: 8 }), num('seed', 0, 'Seed'), num('timefreq', 0, 'Time Frequency')], eval: (i, c, p) => { const q = mul(v(i.position, c.pos), Number(p.val('frequency'))); const t = c.time * Number(p.val('timefreq')); const o = Number(p.val('octaves')) | 0, sd = Number(p.val('seed')) | 0; return { result: [turbulence([q[0], q[1] + t, q[2]], o, sd), turbulence([q[0] + 31.7, q[1] + t, q[2]], o, sd + 1), turbulence([q[0], q[1] + t, q[2] + 17.3], o, sd + 2)] as V3 }; } },
  // ---- conditions
  'Compare': { type: 'Compare', category: 'Conditional', inputs: [{ name: 'first', type: 'scalar' }, { name: 'second', type: 'scalar' }], outputs: [{ name: 'result', type: 'bool' }], params: [enumP('op', 0, [{ label: '<', value: 0 }, { label: '<=', value: 1 }, { label: '>', value: 2 }, { label: '>=', value: 3 }, { label: '==', value: 4 }], 'Operator'), num('second', 0, 'Second')], eval: (i, _c, p) => { const a = s(i.first), b = i.second !== undefined ? s(i.second) : Number(p.val('second')); const o = Number(p.val('op')); return { result: o === 0 ? a < b : o === 1 ? a <= b : o === 2 ? a > b : o === 3 ? a >= b : Math.abs(a - b) < 1e-9 }; } },
  'If': { type: 'If', category: 'Conditional', inputs: [{ name: 'condition', type: 'bool' }, { name: 'if_true', type: 'any' }, { name: 'if_false', type: 'any' }], outputs: [{ name: 'result', type: 'any' }], eval: (i) => ({ result: (i.condition ? i.if_true : i.if_false) ?? 0 }) },
  'Execute': { type: 'Execute', category: 'Execution', inputs: [{ name: 'port1', type: 'any' }, { name: 'port2', type: 'any' }, { name: 'port3', type: 'any' }], outputs: [], eval: () => ({}) },
  'Comment': { type: 'Comment', category: 'Misc', inputs: [], outputs: [], params: [str('text', 'comment', 'Text')], eval: () => ({}) },
};
export const ICE_CATEGORIES = () => { const m = new Map<string, string[]>(); for (const d of Object.values(ICE_NODES)) (m.get(d.category) ?? m.set(d.category, []).get(d.category)!).push(d.type); return m; };

/** Softimage Cap Hole ICETree name (CapHoleProc → ApplyICEOp("Cap Hole") → Cap_Hole:ICETree). */
export function isCapHoleIce(name: string): boolean {
  return /^Cap_?Hole$/i.test(String(name || '').replace(/\s+/g, '_')) || /^CapHole$/i.test(String(name || ''));
}

/** Softimage CapHoleProc picks a border vertex; prefer stored Vertex_Index when it lies on a boundary. */
function capHoleBorderSeed(m: MeshData, preferred: number): number {
  const count = new Map<string, number>();
  const ends = new Map<string, [number, number]>();
  for (const f of m.polygons) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      count.set(k, (count.get(k) ?? 0) + 1);
      ends.set(k, [a, b]);
    }
  }
  const border = new Set<number>();
  for (const [k, c] of count) if (c === 1) { const [a, b] = ends.get(k)!; border.add(a); border.add(b); }
  if (!border.size) return preferred;
  if (border.has(preferred)) return preferred;
  return [...border].sort((a, b) => a - b)[0];
}

/** The ICE Tree operator: evaluates its graph per point; Set Data PointPosition writes the result.
 * Cap_Hole is a Softimage CapHoleProc topology compound (Vertex_Index seed) — not a point graph. */
export class ICETreeOperator extends Operator {
  nodes: IceNode[] = []; links: IceLink[] = []; nextId = 1; getTime: () => { frame: number; time: number } = () => ({ frame: 1, time: 0 });
  constructor(name = 'ICETree', readonly owner: () => X3DObject | null) {
    const defs: any[] = [bool('mute', false, 'Mute')];
    if (isCapHoleIce(name)) defs.push(int('Vertex_Index', 0, 'Vertex Index', { min: 0 }));
    super(name, 'icetree', defs);
  }
  addNode(type: string, x = 40, y = 40): IceNode { const def = ICE_NODES[type]; if (!def) throw new Error('Unknown ICE node ' + type); const params = new ParamSet(type, 'icenode', def.params ?? []); params.parent = this as any; (params as any).iceType = type; const n = { id: this.nextId++, type, x, y, params }; this.nodes.push(n); this.touch(); return n; }
  removeNode(id: number) { this.nodes = this.nodes.filter(n => n.id !== id); this.links = this.links.filter(l => l.from !== id && l.to !== id); this.touch(); }
  connect(from: number, fromPort: string, to: number, toPort: string) { this.links = this.links.filter(l => !(l.to === to && l.toPort === toPort)); this.links.push({ from, fromPort, to, toPort }); this.touch(); }
  disconnect(to: number, toPort: string) { this.links = this.links.filter(l => !(l.to === to && l.toPort === toPort)); this.touch(); }
  touch() { const prim: any = this.parent; if (prim) prim.dirty = true; this.stamp++; }
  stamp = 0;
  depStamp() { return stampOf([this.owner()]) + '|' + this.stamp + '|' + this.getTime().frame + '|' + (isCapHoleIce(this.name) ? String(this.val('Vertex_Index')) : '') + '|' + this.nodes.map(n => n.params.params.map(p => p.value).join(',')).join(';'); }
  /** Node evaluation order: inputs before their consumers. */
  private order(): IceNode[] { const seen = new Set<number>(); const out: IceNode[] = []; const visit = (n: IceNode) => { if (seen.has(n.id)) return; seen.add(n.id); for (const l of this.links) if (l.to === n.id) { const src = this.nodes.find(x => x.id === l.from); if (src) visit(src); } out.push(n); }; for (const n of this.nodes) visit(n); return out; }
  apply(m: MeshData | null): MeshData | null {
    // Softimage CapHoleProc compound: cap border loops seeded by Vertex_Index (docs/ghidra/capholeproc-path.md).
    // CapHoleProc always picks a *border* vertex; headless dumps SetValue Vertex_Index=0 when that index is on-hole.
    // If the stored index is not on a boundary (Direct delete topology differs), resolve to a border seed — same as Softimage pick filter — so Cap_Hole:ICETree still caps.
    if (isCapHoleIce(this.name)) {
      if (!m || this.val('mute')) return m;
      const preferred = Math.max(0, Number(this.val('Vertex_Index') ?? 0) | 0);
      const seed = capHoleBorderSeed(m, preferred);
      const capped = capHoles(m, { kind: 'point', indices: [seed] });
      // Softimage Cap Hole.xsicompound walks from seed to the hole; if seed still misses, cap all open borders (empty sel).
      if (capped.polygons.length === m.polygons.length) return capHoles(m, { kind: 'point', indices: [] });
      return capped;
    }
    if (!m || this.val('mute') || !this.nodes.some(n => n.type === 'Set Data')) return m;
    const order = this.order(); const n = m.positions.length / 3; const nrm = computeNormals(m); const me = this.owner(); const op = me ? me.globalMatrix().elements : null; const objPos: V3 = op ? [op[12], op[13], op[14]] : [0, 0, 0]; const t = this.getTime();
    const out = { ...m, positions: new Float32Array(m.positions) }; const globals = new Map<string, any>();
    for (let i = 0; i < n; i++) {
      const ctx: IceCtx = { index: i, count: n, pos: [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]], normal: [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]], frame: t.frame, time: t.time, objPos, mesh: m, globals };
      const values = new Map<number, Record<string, IceValue>>();
      for (const node of order) { const def = ICE_NODES[node.type]; if (!def) continue; const inp: Record<string, IceValue | undefined> = {}; for (const l of this.links) if (l.to === node.id) inp[l.toPort] = values.get(l.from)?.[l.fromPort]; try { values.set(node.id, def.eval(inp, ctx, node.params)); } catch { /* bad node */ } }
      const np = globals.get('pos:' + i) as V3 | undefined; if (np) { out.positions[i * 3] = np[0]; out.positions[i * 3 + 1] = np[1]; out.positions[i * 3 + 2] = np[2]; }
    }
    (out as any).iceColors = [...globals].filter(([k]) => k.startsWith('PointColor:')).length ? globals : undefined;
    return out;
  }
  toJSON() { return { nodes: this.nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, values: Object.fromEntries(n.params.params.map(p => [p.name, p.value])) })), links: this.links }; }
  load(d: any) { this.nodes = []; this.links = []; this.nextId = 1; for (const n of d.nodes ?? []) { const node = this.addNode(n.type, n.x, n.y); node.id = n.id; this.nextId = Math.max(this.nextId, n.id + 1); for (const [k, val] of Object.entries(n.values ?? {})) node.params.set(k, val); } this.links = (d.links ?? []).slice(); this.touch(); }
}
function computeNormals(m: MeshData): Float32Array { const n = new Float32Array(m.positions.length); const P = m.positions; for (const f of m.polygons) { let nx = 0, ny = 0, nz = 0; for (let i = 0; i < f.length; i++) { const a = f[i] * 3, b = f[(i + 1) % f.length] * 3; nx += (P[a + 1] - P[b + 1]) * (P[a + 2] + P[b + 2]); ny += (P[a + 2] - P[b + 2]) * (P[a] + P[b]); nz += (P[a] - P[b]) * (P[a + 1] + P[b + 1]); } for (const vi of f) { n[vi * 3] += nx; n[vi * 3 + 1] += ny; n[vi * 3 + 2] += nz; } } for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; } return n; }

/** Factory compounds built as graphs. Cap Hole is topology (CapHoleProc) — no point graph. */
export function buildPreset(op: ICETreeOperator, preset: string) {
  if (/^Cap\s*Hole$/i.test(preset) || isCapHoleIce(preset)) {
    // Softimage Cap Hole.xsicompound: Vertex_Index lives on the Cap_Hole ICETree (CapHoleProc sets it).
    if (op.get('Vertex_Index')) op.set('Vertex_Index', Number(op.val('Vertex_Index') ?? 0));
    return;
  }
  const N = (type: string, x: number, y: number, vals: Record<string, any> = {}) => { const n = op.addNode(type, x, y); for (const [k, val] of Object.entries(vals)) n.params.set(k, val); return n; };
  const L = (a: IceNode, ap: string, b: IceNode, bp: string) => op.connect(a.id, ap, b.id, bp);
  const pos = N('Get Data', 40, 60, { reference: 'PointPosition' }); const set = N('Set Data', 620, 60, { reference: 'PointPosition' });
  switch (preset) {
    case 'Push Points': { const nrm = N('Get Data', 40, 160, { reference: 'PointNormal' }); const amt = N('Multiply by Scalar', 260, 160, { factor: 0.5 }); const addN = N('Add', 440, 60); L(nrm, 'value', amt, 'value'); L(pos, 'value', addN, 'first'); L(amt, 'result', addN, 'second'); L(addN, 'result', set, 'value'); break; }
    case 'Turbulize Mesh': { const nrm = N('Get Data', 40, 160, { reference: 'PointNormal' }); const tb = N('Turbulence', 220, 260, { frequency: 0.6, octaves: 3 }); const sc = N('Multiply', 400, 160); const amp = N('Multiply by Scalar', 260, 160, { factor: 0.6 }); const addN = N('Add', 440, 60); L(pos, 'value', tb, 'position'); L(nrm, 'value', amp, 'value'); L(amp, 'result', sc, 'first'); L(tb, 'result', sc, 'second'); L(pos, 'value', addN, 'first'); L(sc, 'result', addN, 'second'); L(addN, 'result', set, 'value'); break; }
    case 'Randomize Position': { const rnd = N('Randomize Value', 220, 180, { seed: 3 }); const mn = N('Vector3', 40, 180, { x: -0.3, y: -0.3, z: -0.3 }); const mx = N('Vector3', 40, 280, { x: 0.3, y: 0.3, z: 0.3 }); const addN = N('Add', 440, 60); L(mn, 'result', rnd, 'min'); L(mx, 'result', rnd, 'max'); L(pos, 'value', addN, 'first'); L(rnd, 'result', addN, 'second'); L(addN, 'result', set, 'value'); break; }
    case 'Twist': { const split = N('3D Vector to Scalar', 200, 180); const ang = N('Multiply by Scalar', 380, 220, { factor: 20 }); const rot = N('Rotate Vector', 440, 60, { ax: 0, ay: 1, az: 0 }); L(pos, 'value', split, 'vector'); L(split, 'y', ang, 'value'); L(pos, 'value', rot, 'vector'); L(ang, 'result', rot, 'angle'); L(rot, 'result', set, 'value'); break; }
    case 'Wave': { const split = N('3D Vector to Scalar', 200, 180); const freq = N('Multiply by Scalar', 360, 200, { factor: 60 }); const tm = N('Get Data', 200, 300, { reference: 'Time' }); const tf = N('Multiply by Scalar', 360, 300, { factor: 180 }); const sum = N('Add', 470, 240); const sn = N('Sin', 560, 240); const amp = N('Multiply by Scalar', 640, 240, { factor: 0.5 }); const up = N('Scalar to 3D Vector', 720, 160); const addN = N('Add', 800, 60); set.x = 960; L(pos, 'value', split, 'vector'); L(split, 'x', freq, 'value'); L(tm, 'value', tf, 'value'); L(freq, 'result', sum, 'first'); L(tf, 'result', sum, 'second'); L(sum, 'result', sn, 'angle'); L(sn, 'result', amp, 'value'); L(amp, 'result', up, 'y'); L(pos, 'value', addN, 'first'); L(up, 'vector', addN, 'second'); L(addN, 'result', set, 'value'); break; }
    case 'Footprints': { // ground dents along the X axis: weight = clamp(1 − sin²(x·90°/step) − (z/size)²)², depth · weight pushes points down
      const split = N('3D Vector to Scalar', 200, 180); const depth = N('Scalar', 40, 380, { value: 0.3 }); const size = N('Scalar', 40, 460, { value: 0.5 });
      const freq = N('Multiply by Scalar', 360, 300, { factor: 90 }); const sn = N('Sin', 470, 300); const dx2 = N('Multiply', 640, 300); const dz = N('Divide', 360, 420); const dz2 = N('Multiply', 470, 420); const one = N('Scalar', 640, 380, { value: 1 }); const sub1 = N('Subtract', 720, 320); const sub2 = N('Subtract', 800, 340); const cl = N('Clamp', 880, 340, { min: 0, max: 1 }); const sq = N('Multiply', 960, 340); const dp = N('Multiply', 1040, 340); const negv = N('Scalar to 3D Vector', 1120, 200); const sub3 = N('Subtract', 1200, 60); set.x = 1300;
      L(pos, 'value', split, 'vector'); L(split, 'x', freq, 'value'); L(freq, 'result', sn, 'angle'); L(sn, 'result', dx2, 'first'); L(sn, 'result', dx2, 'second');
      L(split, 'z', dz, 'first'); L(size, 'result', dz, 'second'); L(dz, 'result', dz2, 'first'); L(dz, 'result', dz2, 'second'); L(one, 'result', sub1, 'first'); L(dx2, 'result', sub1, 'second'); L(sub1, 'result', sub2, 'first'); L(dz2, 'result', sub2, 'second'); L(sub2, 'result', cl, 'value'); L(cl, 'result', sq, 'first'); L(cl, 'result', sq, 'second'); L(sq, 'result', dp, 'first'); L(depth, 'result', dp, 'second'); L(dp, 'result', negv, 'y'); L(pos, 'value', sub3, 'first'); L(negv, 'vector', sub3, 'second'); L(sub3, 'result', set, 'value'); break; }
    default: L(pos, 'value', set, 'value');
  }
}
export const ICE_PRESETS = ['Push Points', 'Turbulize Mesh', 'Randomize Position', 'Twist', 'Wave', 'Footprints', 'Cap Hole'];
