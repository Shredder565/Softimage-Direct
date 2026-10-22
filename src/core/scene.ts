// Scene graph mirroring Softimage's object model:
// Scene -> Models -> X3DObjects; each X3DObject owns Kinematics (local/global), a Primitive with a
// construction history (operator stack), Properties, a Material, Clusters.
import * as THREE from 'three';
import { ParamSet, num, int, bool, str, enumP, color } from './params';
import { MeshData, cube, sphere, cylinder, cone, torus, grid, disc, platonic, deformers, rhombicosidodecahedron, soccerBall, emptyMesh } from './geometry';
import * as topo from './topology';
import type { CompSel } from './topology';
import type { CurveData } from './curves';
import type { LatticeData } from './topology2';

export type NodeKind = 'scene' | 'model' | 'object' | 'property' | 'primitive' | 'operator' | 'material' | 'shader' | 'cluster' | 'kinematics' | 'layer' | 'pass' | 'folder';

export class Node extends ParamSet {
  readonly kind: NodeKind;
  constructor(name: string, type: string, kind: NodeKind, defs: any[] = []) { super(name, type, defs); this.kind = kind; }
  /** Children shown in the Explorer under this node. */
  explorerChildren(): Node[] { return []; }
}

// ------------------------------------------------------------- properties
export class Property extends Node {
  constructor(name: string, type: string, defs: any[]) { super(name, type, 'property', defs); }
}

export function makeVisibility() {
  return new Property('Visibility', 'visibility', [
    bool('viewvis', true, 'View Visibility'), bool('rendvis', true, 'Render Visibility'), bool('selectability', true, 'Selectable'),
    bool('ghosting', false, 'Ghosting'), bool('hidemaster', false, 'Hide Master'),
    bool('primray', true, 'Primary Rays', { group: 'Rendering' }), bool('scndray', true, 'Secondary Rays', { group: 'Rendering' }),
    bool('shdwcast', true, 'Cast Shadows', { group: 'Rendering' }), bool('shdwrecv', true, 'Receive Shadows', { group: 'Rendering' }),
    bool('reflcast', true, 'Caster in Reflections', { group: 'Rendering' }), bool('reflvis', true, 'Visible in Reflections', { group: 'Rendering' }),
    bool('refrcast', true, 'Caster in Refractions', { group: 'Rendering' }), bool('trnscast', true, 'Caster in Transparency', { group: 'Rendering' }),
  ]);
}
export function makeDisplay() {
  return new Property('Display', 'display', [
    enumP('staticsel', 8, [{ label: 'Bounding Box', value: 0 }, { label: 'Wireframe', value: 1 }, { label: 'Shaded', value: 7 }, { label: 'Default', value: 8 }], 'Static (selected)'),
    enumP('intsel', 8, [{ label: 'Bounding Box', value: 0 }, { label: 'Wireframe', value: 1 }, { label: 'Shaded', value: 7 }, { label: 'Default', value: 8 }], 'Interactive (selected)'),
    bool('wirecol', false, 'Use Wireframe Color'), color('wirecolorrgb', [0.7, 0.7, 0.7], 'Wireframe Color'),
    num('xray', 1.0, 'X-Ray Opacity', { min: 0, max: 1 }), num('neardist', 100, 'Near Distance'),
  ]);
}
export function makeGeomApprox() {
  return new Property('Geometry Approximation', 'geomapprox', [
    int('gapproxmordrsl', 0, 'Subdivision Level', { min: 0, max: 5, animatable: false, group: 'Polygon Mesh' }),
    bool('gapproxmoad', false, 'Adaptive', { group: 'Polygon Mesh' }),
    num('gapproxmoan', 60, 'Discontinuity Angle', { min: 0, max: 180, group: 'Polygon Mesh' }),
  ]);
}

// ---------------------------------------------------------------- material
export class Shader extends Node {
  constructor(name: string, type: string, defs: any[]) { super(name, type, 'shader', defs); }
}
export function makePhong(name = 'Phong') {
  return new Shader(name, 'Phong', [
    color('ambient', [0.3, 0.3, 0.3], 'Ambient', { group: 'Illumination' }), color('diffuse', [0.7, 0.7, 0.7], 'Diffuse', { group: 'Illumination' }),
    color('specular', [1, 1, 1], 'Specular', { group: 'Illumination' }), num('shiny', 50, 'Specular Decay', { min: 0, max: 200, group: 'Illumination' }),
    num('transparency', 0, 'Transparency', { min: 0, max: 1, group: 'Transparency/Reflection' }), num('reflectivity', 0, 'Reflectivity', { min: 0, max: 1, group: 'Transparency/Reflection' }),
  ]);
}
export function makeLambert(name = 'Lambert') {
  return new Shader(name, 'Lambert', [
    color('ambient', [0.3, 0.3, 0.3], 'Ambient'), color('diffuse', [0.7, 0.7, 0.7], 'Diffuse'), num('transparency', 0, 'Transparency', { min: 0, max: 1 }),
  ]);
}
export class Material extends Node {
  surface: Shader | null = null;
  constructor(name: string) {
    super(name, 'material', 'material', [str('Name', name, 'Name', { readOnly: true }), bool('wrapu', false, 'Wrap U'), bool('wrapv', false, 'Wrap V')]);
  }
  setSurface(s: Shader | null) { if (this.surface) this.surface.parent = null; this.surface = s; if (s) s.parent = this; }
  explorerChildren() { return this.surface ? [this.surface] : []; }
  get diffuse(): [number, number, number] { return this.surface?.val('diffuse') ?? [0.7, 0.7, 0.7]; }
}

// -------------------------------------------------------------- operators
export class Operator extends Node {
  constructor(name: string, type: string, defs: any[]) { super(name, type, 'operator', defs); }
  /** Transforms the geometry payload (MeshData for meshes/surfaces, CurveData for curves, LatticeData for lattices). */
  apply(input: any): any { return input; }
}

/** The generator at the bottom of the stack that makes the primitive geometry. */
export class GeomOperator extends Operator {
  constructor(readonly preset: string, defs: any[]) { super('Geometry', 'geom', defs); }
  apply(): MeshData | null {
    const v = (n: string) => Number(this.val(n));
    switch (this.preset) {
      case 'Cube': return cube(v('length'), v('subdivu'));
      case 'Sphere': return sphere(v('radius'), v('subdivu'), v('subdivv'));
      case 'Cylinder': return cylinder(v('radius'), v('height'), v('subdivu'), v('subdivv'));
      case 'Cone': return cone(v('radius'), v('height'), v('subdivu'), v('subdivv'));
      case 'Torus': return torus(v('radius'), v('innerradius'), v('subdivu'), v('subdivv'));
      case 'Grid': return grid(v('ulength'), v('vlength'), v('subdivu'), v('subdivv'));
      case 'Disc': return disc(v('radius'), v('innerradius'), v('subdivu'), v('subdivv'));
      case 'Tetrahedron': case 'Octahedron': case 'Icosahedron': case 'Dodecahedron': return platonic(this.preset.toLowerCase() as any, v('radius'));
      case 'Rhombicosidodecahedron': return rhombicosidodecahedron(v('radius'));
      case 'Soccer Ball': case 'SoccerBall': return soccerBall(v('radius'));
      case 'Empty': return emptyMesh();
    }
    return null;
  }
}
export function makeGeomOperator(preset: string): GeomOperator {
  const common = (extra: any[]) => [...extra, int('subdivu', 8, 'Subdivisions U', { min: 1, max: 128 }), int('subdivv', 8, 'Subdivisions V', { min: 1, max: 128 })];
  switch (preset) {
    case 'Cube': return new GeomOperator(preset, [num('length', 8, 'Length', { min: 0.01 }), int('subdivu', 1, 'Subdivisions', { min: 1, max: 64 })]);
    case 'Sphere': return new GeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 })]));
    case 'Cylinder': return new GeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 }), num('height', 8, 'Height', { min: 0.01 })]));
    case 'Cone': return new GeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 }), num('height', 8, 'Height', { min: 0.01 })]));
    case 'Torus': return new GeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 }), num('innerradius', 1.5, 'Inner Radius', { min: 0.01 })]));
    case 'Grid': return new GeomOperator(preset, common([num('ulength', 8, 'U Length', { min: 0.01 }), num('vlength', 8, 'V Length', { min: 0.01 })]));
    case 'Disc': return new GeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 }), num('innerradius', 0.5, 'Inner Radius', { min: 0 })]));
    default: return new GeomOperator(preset, [num('radius', 4, 'Radius', { min: 0.01 })]);
  }
}

export class DeformOperator extends Operator {
  constructor(readonly preset: string, defs: any[]) { super(preset + ' Op', preset.toLowerCase() + 'op', [...defs, bool('mute', false, 'Mute')]); }
  apply(input: MeshData | null) {
    if (!input || this.val('mute')) return input;
    const fn = deformers[this.preset]; if (!fn) return input;
    const v: Record<string, number> = {}; for (const p of this.params) v[p.name] = Number(p.value);
    return fn(input, v);
  }
}
export function makeDeformOperator(preset: string): DeformOperator | null {
  switch (preset) {
    case 'Twist': case 'Bend': return new DeformOperator(preset, [num('angle', 45, 'Angle', { min: -720, max: 720 })]);
    case 'Taper': return new DeformOperator(preset, [num('factor', 0.5, 'Factor', { min: -5, max: 5 })]);
    case 'Bulge': case 'Shear': return new DeformOperator(preset, [num('factor', 0.5, 'Factor', { min: -5, max: 5 })]);
    case 'Push': return new DeformOperator(preset, [num('amplitude', 1, 'Amplitude', { min: -50, max: 50 })]);
    case 'Randomize': return new DeformOperator(preset, [num('displacement', 0.5, 'Displacement', { min: 0, max: 50 }), int('seed', 0, 'Seed', { min: 0 })]);
    case 'Smooth': case 'Relax': return new DeformOperator('Smooth', [num('strength', 0.5, 'Strength', { min: 0, max: 1 }), int('iterations', 2, 'Iterations', { min: 1, max: 50 })]);
  }
  return null;
}

// ----------------------------------------------------------- topology ops
/** A topology operator records the component selection it was applied to (like Softimage's connection set). */
export class TopologyOperator extends Operator {
  constructor(readonly preset: string, readonly sel: CompSel, defs: any[]) { super(preset, 'topo', [...defs, bool('mute', false, 'Mute')]); }
  apply(input: MeshData | null): MeshData | null {
    if (!input || this.val('mute')) return input;
    const v = (n: string) => Number(this.val(n));
    switch (this.preset) {
      case 'Extrude Along Normal': return topo.extrudeAlongNormal(input, this.sel, v('length'), v('inset'));
      case 'Inset Polygons': return topo.insetPolygons(input, this.sel, v('inset'));
      case 'Delete Components': return topo.deleteComponents(input, this.sel);
      case 'Duplicate Polygons': return topo.duplicatePolygons(input, this.sel, v('offset'));
      case 'Subdivide Polygons': return topo.subdividePolygons(input, this.sel);
      case 'Split Edges': return topo.splitEdges(input, this.sel, v('ratio'));
      case 'Weld Points': return topo.weldPoints(input, this.sel);
      case 'Collapse Components': return topo.collapseComponents(input, this.sel);
      case 'Invert Polygons': return topo.invertPolygons(input, this.sel);
      case 'Triangulate': return topo.triangulate(input, this.sel);
      case 'Apply Thickness': return topo.applyThickness(input, v('amount'));
      case 'Filter Points': return topo.filterPoints(input, this.sel, v('strength'));
      case 'Symmetrize Polygons': return topo.symmetrize(input, this.sel, this.val('axis'));
    }
    return input;
  }
}
export function makeTopologyOperator(preset: string, sel: CompSel): TopologyOperator | null {
  switch (preset) {
    case 'Extrude Along Normal': return new TopologyOperator(preset, sel, [num('length', 1, 'Length', { min: -100, max: 100 }), num('inset', 0, 'Inset', { min: -2, max: 1 })]);
    case 'Inset Polygons': return new TopologyOperator(preset, sel, [num('inset', 0.3, 'Inset', { min: 0, max: 1 })]);
    case 'Duplicate Polygons': return new TopologyOperator(preset, sel, [num('offset', 1, 'Offset', { min: -100, max: 100 })]);
    case 'Split Edges': return new TopologyOperator(preset, sel, [num('ratio', 0.5, 'Split Ratio', { min: 0.01, max: 0.99 })]);
    case 'Apply Thickness': return new TopologyOperator(preset, sel, [num('amount', 0.5, 'Thickness', { min: -50, max: 50 })]);
    case 'Filter Points': return new TopologyOperator(preset, sel, [num('strength', 0.5, 'Strength', { min: 0, max: 1 })]);
    case 'Symmetrize Polygons': return new TopologyOperator(preset, sel, [enumP('axis', 0, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Mirror Axis')]);
    case 'Delete Components': case 'Subdivide Polygons': case 'Weld Points': case 'Collapse Components': case 'Invert Polygons': case 'Triangulate': return new TopologyOperator(preset, sel, []);
  }
  return null;
}
/** Interactive point moves (Move Point / Tweak tools) accumulate into one operator at the top of the stack. */
export class MoveComponentOperator extends Operator {
  readonly deltas = new Map<number, [number, number, number]>();
  constructor() { super('Move Component', 'movecomponent', [bool('mute', false, 'Mute')]); }
  apply(input: any) {
    if (!input || this.val('mute')) return input;
    if (input.cvs) return { ...input, cvs: input.cvs.map((c: number[], i: number) => { const d = this.deltas.get(i); return d ? [c[0] + d[0], c[1] + d[1], c[2] + d[2], c[3]] : c; }) };
    if (input.sub && input.points) return { ...input, points: input.points.map((p: number[], i: number) => { const d = this.deltas.get(i); return d ? [p[0] + d[0], p[1] + d[1], p[2] + d[2]] : p; }) };
    return topo.movePoints(input, this.deltas);
  }
}
/** Positions of the "points" of any geometry payload (mesh vertices, curve CVs, lattice points). */
export function geomPoints(g: any): Float32Array | null {
  if (!g) return null; if (g.positions) return g.positions;
  if (g.cvs) { const a = new Float32Array(g.cvs.length * 3); g.cvs.forEach((c: number[], i: number) => { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }); return a; }
  if (g.points) { const a = new Float32Array(g.points.length * 3); g.points.forEach((c: number[], i: number) => { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }); return a; }
  return null;
}

// ---------------------------------------------------------------- primitive
export class Primitive extends Node {
  readonly operators: Operator[] = [];   // construction history, bottom (generator) first
  private cache: any = null;
  dirty = true;
  version = 0;                            // bumps whenever the result changes (dependents re-evaluate)
  constructor(name: string, type: string) {
    super(name, type, 'primitive', type === 'polymsh' ? [enumP('subdrule', 0, [{ label: 'Catmull-Clark', value: 0 }, { label: 'Linear', value: 1 }], 'Subdivision Rule')] : []);
  }
  addOperator(op: Operator) { op.parent = this; this.operators.push(op); this.dirty = true; }
  removeOperator(op: Operator) { const i = this.operators.indexOf(op); if (i >= 0) { this.operators.splice(i, 1); op.parent = null; this.dirty = true; } }
  /** Evaluate the construction history. */
  geom(): any {
    if (!this.dirty && this.cache !== null) return this.cache;
    let m: any = null;
    for (const op of this.operators) { try { m = op.apply(m); } catch (e) { console.warn(op.name, e); } }
    this.cache = m; this.dirty = false; this.version++; return m;
  }
  mesh(): MeshData | null { const g = this.geom(); return g && g.positions ? g as MeshData : null; }
  curve(): CurveData | null { const g = this.geom(); return g && g.cvs ? g as CurveData : null; }
  lattice(): LatticeData | null { const g = this.geom(); return g && g.sub ? g as LatticeData : null; }
  explorerChildren() { return [...this.operators].reverse(); }
  notify(p: any, old: any) { this.dirty = true; super.notify(p, old); }
}

// --------------------------------------------------------------- kinematics
export class Kinematics extends Node {
  readonly local: Node;
  readonly global: Node;
  constructor() {
    super('Kinematics', 'kine', 'kinematics');
    this.local = new Node('Local', 'kine.local', 'property', [
      num('posx', 0, 'Position X', { keyable: true, group: 'Transform' }), num('posy', 0, 'Position Y', { keyable: true, group: 'Transform' }), num('posz', 0, 'Position Z', { keyable: true, group: 'Transform' }),
      num('rotx', 0, 'Rotation X', { keyable: true, group: 'Transform' }), num('roty', 0, 'Rotation Y', { keyable: true, group: 'Transform' }), num('rotz', 0, 'Rotation Z', { keyable: true, group: 'Transform' }),
      num('sclx', 1, 'Scaling X', { keyable: true, group: 'Transform' }), num('scly', 1, 'Scaling Y', { keyable: true, group: 'Transform' }), num('sclz', 1, 'Scaling Z', { keyable: true, group: 'Transform' }),
      enumP('rotorder', 0, [{ label: 'XYZ', value: 0 }, { label: 'XZY', value: 1 }, { label: 'YXZ', value: 2 }, { label: 'YZX', value: 3 }, { label: 'ZXY', value: 4 }, { label: 'ZYX', value: 5 }], 'Rotation Order', { group: 'Transform' }),
      bool('siscaling', true, 'SI Scaling', { group: 'Transform' }),
      num('pposx', 0, 'Pivot X', { group: 'Pivot' }), num('pposy', 0, 'Pivot Y', { group: 'Pivot' }), num('pposz', 0, 'Pivot Z', { group: 'Pivot' }), bool('pivotactive', false, 'Pivot Active', { group: 'Pivot' }),
      num('nposx', 0, 'Neutral Pos X', { group: 'Neutral Pose' }), num('nposy', 0, 'Neutral Pos Y', { group: 'Neutral Pose' }), num('nposz', 0, 'Neutral Pos Z', { group: 'Neutral Pose' }),
    ]);
    this.global = new Node('Global', 'kine.global', 'property', [
      num('posx', 0, 'Position X', { readOnly: true }), num('posy', 0, 'Position Y', { readOnly: true }), num('posz', 0, 'Position Z', { readOnly: true }),
      num('rotx', 0, 'Rotation X', { readOnly: true }), num('roty', 0, 'Rotation Y', { readOnly: true }), num('rotz', 0, 'Rotation Z', { readOnly: true }),
      num('sclx', 1, 'Scaling X', { readOnly: true }), num('scly', 1, 'Scaling Y', { readOnly: true }), num('sclz', 1, 'Scaling Z', { readOnly: true }),
    ]);
    this.local.parent = this; this.global.parent = this;
  }
  localMatrix(): THREE.Matrix4 {
    const l = this.local, d = Math.PI / 180;
    const e = new THREE.Euler(l.val('rotx') * d, l.val('roty') * d, l.val('rotz') * d, ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'][l.val('rotorder')] as any);
    return new THREE.Matrix4().compose(new THREE.Vector3(l.val('posx'), l.val('posy'), l.val('posz')), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(l.val('sclx'), l.val('scly'), l.val('sclz')));
  }
  explorerChildren() { return [this.local, this.global]; }
}

// ---------------------------------------------------------------- X3DObject
export class X3DObject extends Node {
  parentObj: X3DObject | null = null;
  readonly children: X3DObject[] = [];
  readonly kinematics = new Kinematics();
  readonly properties: Property[] = [];
  primitive: Primitive | null = null;
  material: Material | null = null;   // null = inherits Scene_Material
  readonly clusters: Node[] = [];
  layer: Layer | null = null;

  constructor(name: string, type: string, kind: NodeKind = 'object') {
    super(name, type, kind);
    this.kinematics.parent = this;
    this.addProperty(makeVisibility());
  }
  addProperty(p: Property) { p.parent = this; this.properties.push(p); return p; }
  removeProperty(p: Property) { const i = this.properties.indexOf(p); if (i >= 0) { this.properties.splice(i, 1); p.parent = null; } }
  property(type: string) { return this.properties.find(p => p.type === type); }
  setPrimitive(p: Primitive | null) { if (this.primitive) this.primitive.parent = null; this.primitive = p; if (p) p.parent = this; }
  setMaterial(m: Material | null) { if (this.material) this.material.parent = null; this.material = m; if (m) m.parent = this; }
  addChild(c: X3DObject) { if (c.parentObj) c.parentObj.removeChild(c); c.parentObj = this; c.parent = this; this.children.push(c); }
  removeChild(c: X3DObject) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentObj = null; c.parent = null; }
  get model(): Model | null { let n: X3DObject | null = this; while (n) { if (n instanceof Model) return n; n = n.parentObj; } return null; }
  get visible(): boolean { return !!this.property('visibility')?.val('viewvis'); }
  globalMatrix(): THREE.Matrix4 {
    const m = this.kinematics.localMatrix();
    return this.parentObj ? this.parentObj.globalMatrix().multiply(m) : m;
  }
  updateGlobal() {
    const g = this.globalMatrix(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    g.decompose(p, q, s); const e = new THREE.Euler().setFromQuaternion(q), r = 180 / Math.PI;
    const G = this.kinematics.global;
    G.get('posx')!.def.value = p.x; // readonly: set internal silently
    (G.get('posx') as any)._value = p.x; (G.get('posy') as any)._value = p.y; (G.get('posz') as any)._value = p.z;
    (G.get('rotx') as any)._value = e.x * r; (G.get('roty') as any)._value = e.y * r; (G.get('rotz') as any)._value = e.z * r;
    (G.get('sclx') as any)._value = s.x; (G.get('scly') as any)._value = s.y; (G.get('sclz') as any)._value = s.z;
  }
  *descendants(): Generator<X3DObject> { for (const c of this.children) { yield c; yield* c.descendants(); } }
  explorerChildren(): Node[] {
    const out: Node[] = [this.kinematics, ...this.properties];
    if (this.material) out.push(this.material);
    if (this.primitive) out.push(this.primitive);
    out.push(...this.clusters, ...this.children);
    return out;
  }
}

export class Model extends X3DObject {
  constructor(name: string) { super(name, '#model', 'model'); }
}
export class Null extends X3DObject {
  constructor(name: string) { super(name, 'null'); this.addProperty(makeDisplay()); }
}
export class Camera extends X3DObject {
  constructor(name: string) {
    super(name, 'camera');
    this.setPrimitive(new Primitive('Camera', 'camera'));
    this.primitive!.add(num('fov', 53.6, 'Field of View', { min: 1, max: 179 })); this.primitive!.add(num('near', 0.1, 'Near Plane', { min: 0.001 })); this.primitive!.add(num('far', 32768, 'Far Plane'));
  }
}
export class Light extends X3DObject {
  constructor(name: string, kind: 'point' | 'infinite' | 'spot') {
    super(name, 'light');
    const p = new Primitive(kind === 'point' ? 'Point' : kind === 'spot' ? 'Spot' : 'Infinite', 'light');
    p.add(color('soft_light.color', [1, 1, 1], 'Color')); p.add(num('soft_light.intensity', 0.75, 'Intensity', { min: 0, max: 10 })); p.add(enumP('type', kind, [{ label: 'Point', value: 'point' }, { label: 'Infinite', value: 'infinite' }, { label: 'Spot', value: 'spot' }], 'Type'));
    this.setPrimitive(p);
  }
}

// ---------------------------------------------------------------- layers/passes
export class Layer extends Node {
  readonly members = new Set<X3DObject>();
  constructor(name: string) { super(name, 'layer', 'layer', [bool('viewvis', true, 'View Visibility'), bool('rendvis', true, 'Render Visibility'), bool('selectability', true, 'Selectable'), color('color', [0.6, 0.6, 0.6], 'Color')]); }
}
export class Pass extends Node { constructor(name: string) { super(name, 'pass', 'pass', [bool('Active', true, 'Active'), int('FrameStart', 1, 'Start Frame'), int('FrameEnd', 100, 'End Frame')]); } }

// ---------------------------------------------------------------- scene
export class Scene extends Node {
  readonly root: Model;
  readonly layers: Layer[] = [];
  readonly passes: Pass[] = [];
  readonly materials: Material[] = [];   // sources > materials library
  constructor() {
    super('Scene', 'scene', 'scene', [str('Name', 'Untitled', 'Scene Name')]);
    this.root = new Model('Scene_Root');
    this.root.parent = this;
    this.root.setMaterial(this.newMaterial('Scene_Material', makePhong()));
    this.root.addProperty(makeDisplay()); this.root.addProperty(makeGeomApprox());
    this.addLayer('Layer_Default'); this.addPass('Default_Pass');
  }
  newMaterial(name: string, surface: Shader) { const m = new Material(this.uniqueName(name)); m.setSurface(surface); this.materials.push(m); return m; }
  addLayer(name: string) { const l = new Layer(this.uniqueName(name)); l.parent = this; this.layers.push(l); return l; }
  addPass(name: string) { const p = new Pass(this.uniqueName(name)); p.parent = this; this.passes.push(p); return p; }
  *allObjects(): Generator<X3DObject> { yield* this.root.descendants(); }
  find(name: string): X3DObject | undefined { for (const o of this.allObjects()) if (o.name === name || o.fullName === name) return o; return undefined; }
  uniqueName(base: string): string {
    const taken = new Set<string>(); for (const o of this.allObjects()) taken.add(o.name); for (const l of this.layers) taken.add(l.name); for (const m of this.materials) taken.add(m.name);
    if (!taken.has(base)) return base;
    let i = 1; while (taken.has(`${base}${i}`)) i++; return `${base}${i}`;
  }
  /** Explorer "Scene" scope roots. */
  explorerChildren(): Node[] { return [this.root]; }
}
