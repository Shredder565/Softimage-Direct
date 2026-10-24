// Scene graph mirroring Softimage's object model:
// Scene -> Models -> X3DObjects; each X3DObject owns Kinematics (local/global), a Primitive with a
// construction history (operator stack), Properties, a Material, Clusters.
import * as THREE from 'three';
import { ParamSet, num, int, bool, str, enumP, color } from './params';
import { siShaderDefs, type SiShaderDef } from './shaders';
import { siParamDefs, siLayout, siName, menuDefaults, siPropDefs, siPropLayout } from './opdefs';
import type { ParamDef } from './params';
/** Merge our parameter definitions with the full SPDL property set so the Property Editor shows Softimage's complete page. */
function withSi(key: string, ours: ParamDef[]): ParamDef[] { const si = siPropDefs(key); const mine = new Map(ours.map(d => [d.name, d])); const out = si.map(d => mine.get(d.name) ? { ...d, ...mine.get(d.name)! } : { ...d, group: d.group }); for (const d of ours) if (!si.some(x => x.name === d.name)) out.push(d); return out; }
import { siDeformers } from './sideform';
import { siCube, siSphere, siCylinder, siCone, siTorus, siGrid, siDisc } from './siprims';
import { MeshData, platonic, rhombicosidodecahedron, soccerBall, emptyMesh } from './geometry';
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

/** Softimage rotation orders are extrinsic (XYZ = rotate about parent X, then Y, then Z), which is three.js's reversed
 *  intrinsic string: SI XYZ → THREE 'ZYX'. Verified against the running application (Rotate siLocal/siGlobal probes). */
export const SI_ROT_ORDERS = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'];
export function threeOrder(siOrder: any): THREE.EulerOrder { const s = SI_ROT_ORDERS[Number(siOrder) || 0] ?? 'XYZ'; return s.split('').reverse().join('') as THREE.EulerOrder; }

// ------------------------------------------------------------- clusters
/** A named set of components of one object (pnt / edge / poly / sample clusters). Properties such as weight maps,
 *  vertex colours and texture projections live on clusters, exactly as in Softimage. */
export class Cluster extends Node {
  readonly properties: Property[] = [];
  constructor(name: string, public compKind: 'pnt' | 'edge' | 'poly' | 'sample', public elements: Set<number | string>) { super(name, compKind, 'cluster', [{ name: 'alwayscomplete', type: 'bool', default: false, label: 'Always Complete', readOnly: true }]); }
  get obj(): X3DObject | null { let n: Node | null = this.parent as any; while (n && !(n instanceof X3DObject)) n = (n as any).parent ?? null; return n as X3DObject | null; }
  get isComplete(): boolean { const o = this.obj; const m = o?.primitive?.mesh(); if (!m) return false; const n = this.compKind === 'pnt' ? m.positions.length / 3 : this.compKind === 'poly' ? m.polygons.length : 0; return n > 0 && this.elements.size >= n; }
  addProperty(p: Property) { p.parent = this as any; this.properties.push(p); return p; }
  removeProperty(p: Property) { const i = this.properties.indexOf(p); if (i >= 0) { this.properties.splice(i, 1); p.parent = null; } }
  property(type: string) { return this.properties.find(p => p.type === type); }
  explorerChildren(): Node[] { return this.properties; }
}
export class ClusterFolder extends Node {
  constructor() { super('Clusters', 'clusters', 'folder'); }
  explorerChildren(): Node[] { const prim = this.parent as any; const o = prim?.parent as X3DObject | undefined; return o?.clusters ?? []; }
}

// ------------------------------------------------------------- properties
export class Property extends Node {
  /** Shared (inherited scene default) until a value is changed or the property was added explicitly — the Explorer shows shared ones in italics. */
  shared = false;
  constructor(name: string, type: string, defs: any[]) { super(name, type, 'property', defs); }
  notify(p: any, old: any) { this.shared = false; super.notify(p, old); }
}
/** Explorer-only pseudo nodes: construction-mode markers and the Clusters folder under a primitive. */
export class MarkerNode extends Node { constructor(name: string, type: string, readonly mode: string) { super(name, type, 'folder'); } }

export function makeVisibility() {
  const p = new Property('Visibility', 'visibility', withSi('C3DVisibilityAndDisplay', [
    bool('viewvis', true, 'View Visibility'), bool('rendvis', true, 'Render Visibility'), bool('selectability', true, 'Selectable'),
    bool('ghosting', false, 'Ghosting'), bool('hidemaster', false, 'Hide Master'),
    bool('primray', true, 'Primary Rays', { group: 'Rendering' }), bool('scndray', true, 'Secondary Rays', { group: 'Rendering' }),
    bool('shdwcast', true, 'Cast Shadows', { group: 'Rendering' }), bool('shdwrecv', true, 'Receive Shadows', { group: 'Rendering' }),
    bool('reflcast', true, 'Caster in Reflections', { group: 'Rendering' }), bool('reflvis', true, 'Visible in Reflections', { group: 'Rendering' }),
    bool('refrcast', true, 'Caster in Refractions', { group: 'Rendering' }), bool('trnscast', true, 'Caster in Transparency', { group: 'Rendering' }),
  ])); p.layout = siPropLayout('C3DVisibilityAndDisplay') as any; return p;
}
export function makeDisplay(shared = true) {
  const p = new Property('Display', 'display', [
    enumP('staticsel', 8, [{ label: 'Bounding Box', value: 0 }, { label: 'Wireframe', value: 1 }, { label: 'Shaded', value: 7 }, { label: 'Default', value: 8 }], 'Static (selected)'),
    enumP('intsel', 8, [{ label: 'Bounding Box', value: 0 }, { label: 'Wireframe', value: 1 }, { label: 'Shaded', value: 7 }, { label: 'Default', value: 8 }], 'Interactive (selected)'),
    bool('wirecol', false, 'Use Wireframe Color'), color('wirecolorrgb', [0.7, 0.7, 0.7], 'Wireframe Color'),
    num('xray', 1.0, 'X-Ray Opacity', { min: 0, max: 1 }), num('neardist', 100, 'Near Distance'),
  ]); p.shared = shared; p.layout = siPropLayout('C3DDisplayProp') as any; return p;
}
export function makeGeomApprox(shared = true) {
  const p = new Property('Geometry Approximation', 'geomapprox', [
    int('gapproxmordrsl', 0, 'Subdivision Level', { min: 0, max: 5, animatable: false, group: 'Polygon Mesh' }),
    enumP('gapproxmosr', 0, [{ label: 'Catmull-Clark', value: 0 }, { label: 'Loop', value: 1 }, { label: 'XSI-Doo-Sabin', value: 2 }, { label: 'Linear', value: 3 }], 'Subdivision Rule', { group: 'Polygon Mesh' }),
    bool('gapproxmoad', false, 'Adaptive', { group: 'Polygon Mesh' }),
    num('gapproxmoan', 60, 'Discontinuity Angle', { min: 0, max: 180, group: 'Polygon Mesh' }),
  ]); p.shared = shared; return p;
}

// ---------------------------------------------------------------- material
export class Shader extends Node {
  /** Render Tree connections: texturable input parameter → the shader node plugged into it. */
  readonly inputs = new Map<string, Shader>();
  spdl?: SiShaderDef;
  constructor(name: string, type: string, defs: any[], spdl?: SiShaderDef) { super(name, type, 'shader', defs); this.spdl = spdl; }
  /** Texturable parameters (the ports a Render Tree can connect). */
  ports(): string[] { return (this.spdl?.params ?? []).filter(p => p.dir === 'input' && p.texturable && p.inspectable !== false).map(p => p.sn); }
  connect(port: string, sh: Shader | null) { const old = this.inputs.get(port); if (old) old.parent = null; if (sh) { this.inputs.set(port, sh); sh.parent = this; } else this.inputs.delete(port); }
  explorerChildren(): Node[] { return [...this.inputs.values()]; }
}
/** A shader node from Softimage's own phenolib SPDL (material-phong, txt2d-image-explicit…) or a Get > Material preset name. */
export function makeSiShader(key: string, name?: string): Shader | null {
  const r = siShaderDefs(key); if (!r) return null;
  const s = new Shader(name ?? r.title, r.type, r.defs, r.spdl); if (r.layout) s.layout = r.layout; return s;
}
export function makePhong(name = 'Phong') { return makeSiShader('Phong', name)!; }
export function makeLambert(name = 'Lambert') { return makeSiShader('Lambert', name)!; }
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

/** The generator at the bottom of the stack that makes the primitive geometry. Like Softimage, it carries the shape
 *  parameters of the implicit input primitive (cube.cube: length…) and the Geometry converter parameters (subdivisions). */
export class GeomOperator extends Operator {
  constructor(readonly preset: string, readonly geomKind: 'Polygon Mesh' | 'Surface' | 'Point Cloud' | 'Curve', defs: any[]) { super('Geometry', 'geom', defs); }
  /** Shape parameters (first PPG tab, named after the primitive) vs converter parameters (the "Geometry" tab). */
  get shapeParams() { return this.params.filter(p => p.def.group === this.preset); }
  get geometryParams() { return this.params.filter(p => p.def.group !== this.preset); }
  apply(): MeshData | null {
    const v: Record<string, any> = {}; for (const p of this.params) v[p.name] = p.value;
    switch (this.preset) {
      case 'Cube': return siCube(v);
      case 'Sphere': return siSphere(v);
      case 'Cylinder': return siCylinder(v);
      case 'Cone': return siCone(v);
      case 'Torus': return siTorus(v);
      case 'Grid': return siGrid(v);
      case 'Disc': return siDisc(v);
      case 'Tetrahedron': case 'Octahedron': case 'Icosahedron': case 'Dodecahedron': return platonic(this.preset.toLowerCase() as any, Number(v.radius ?? 4));
      case 'Rhombicosidodecahedron': return rhombicosidodecahedron(Number(v.radius ?? 4));
      case 'Soccer Ball': case 'SoccerBall': return soccerBall(Number(v.radius ?? 4));
      case 'Empty': return emptyMesh();
    }
    return null;
  }
}
export function makeGeomOperator(preset: string, kind: 'Polygon Mesh' | 'Surface' | 'Point Cloud' | 'Curve' = 'Polygon Mesh'): GeomOperator {
  const shapeKey = 'shape:' + kind + '/' + preset, geomKey = 'geom:' + preset + (kind === 'Polygon Mesh' ? '' : ':' + kind);
  let shape = siParamDefs(shapeKey, {}, { group: preset });
  if (!shape.length) shape = siParamDefs('shape:Polygon Mesh/' + preset, {}, { group: preset });
  if (!shape.length && !['Empty'].includes(preset)) shape = [num('radius', 4, 'Radius', { min: 0.01, uimin: 0.01, uimax: 50, group: preset })];
  let geom = siParamDefs(geomKey, {}, { group: 'Geometry' });
  if (!geom.length) geom = siParamDefs('geom:' + preset, {}, { group: 'Geometry' });
  const op = new GeomOperator(preset, kind, [...shape, ...geom]);
  return op;
}

/** Softimage op type for each Deform menu preset (ApplyOp PresetObj). */
export const DEFORM_TYPES: Record<string, string> = { Twist: 'twistop', Bend: 'bendop', Taper: 'taperop', Bulge: 'bulgeop', Shear: 'shearop', Push: 'pushop', Randomize: 'randomizeop', Smooth: 'smoothop', Relax: 'smoothop', Fold: 'foldop' };
export class DeformOperator extends Operator {
  constructor(readonly preset: string, readonly siType: string, defs: any[]) {
    super(siName(siType, preset + ' Op'), siType, [...defs, bool('mute', false, 'Mute')]);
    this.layout = siLayout(siType);
  }
  apply(input: MeshData | null) {
    if (!input || this.val('mute')) return input;
    const fn = siDeformers[this.siType]; if (!fn) return input;
    const v: Record<string, any> = {}; for (const p of this.params) v[p.name] = p.value;
    return fn(input, v);
  }
}
export function makeDeformOperator(preset: string): DeformOperator | null {
  const t = DEFORM_TYPES[preset]; if (!t) return null;
  const menu = menuDefaults('Modify/Deform/' + preset);
  return new DeformOperator(preset, t, siParamDefs(t, menu?.values ?? {}));
}

// ----------------------------------------------------------- topology ops
/** Softimage op type for each topology preset; parameters come from the real definitions (opdefs.json). */
export const TOPO_TYPES: Record<string, string> = {
  'Extrude Along Normal': 'extrudenormalop', 'Inset Polygons': 'extrudecompaxisop', 'Split Edges': 'splitedgeop', 'Weld Points': 'weldpointsop',
  'Filter Points': 'filterpointsbydistancesop', 'Symmetrize Polygons': 'symmetrizepolygonop', 'Subdivide Polygons': 'subdividepolygonop', 'Triangulate': 'subdividepolygonop',
  'Collapse Components': 'collapseop', 'Invert Polygons': 'invertpolygonop', 'Delete Components': 'deletecomponentop', 'Bevel': 'bevelop', 'Bridge Polygons': 'bridgeop',
  'Quadrangulate': 'quadrangulateop', 'Dissolve': 'dissolvecompop', 'Disconnect': 'disconnectcompop', 'Spin Edges': 'spinedgeop', 'Slice': 'slicepolygonsop',
  'Slice Plane': 'slicepolygonsop', 'Dice': 'dicepolygonsop', 'Polygon Reduction': 'polygonreductionop', 'Apply Thickness': 'thicknessop', 'Duplicate Polygons': 'extrudecompaxisop',
  'Cap Hole': 'capholeop', 'Connect Points': 'addedgeop', 'Local Subdivision': 'meshlocalsubdivisionop', 'Offset Polygons': 'offsetpolygonsop',
};
const TOPO_NAMES: Record<string, string> = { 'Triangulate': 'Triangulate', 'Duplicate Polygons': 'Duplicate Op' };
/** Build the parameter list for a topology preset: Softimage definitions first, then any legacy defs not covered. */
export function topoDefs(preset: string, legacy: any[] = []): { type: string; defs: any[]; layout?: any } {
  const t = TOPO_TYPES[preset] ?? 'topo';
  const over: Record<string, any> = preset === 'Triangulate' ? { subdivtype: 3 } : preset === 'Duplicate Polygons' ? { duplicate: true, length: 1, inset: 0 } : {};
  const si = siParamDefs(t, over); const names = new Set(si.map(d => d.name));
  return { type: t, defs: [...si, ...legacy.filter(d => !names.has(d.name))], layout: siLayout(t) };
}
/** A topology operator records the component selection it was applied to (like Softimage's connection set). */
export class TopologyOperator extends Operator {
  readonly siType: string;
  constructor(readonly preset: string, readonly sel: CompSel, defs: any[]) {
    const td = topoDefs(preset, defs);
    super(TOPO_NAMES[preset] ?? siName(td.type, preset), td.type, [...td.defs, bool('mute', false, 'Mute')]);
    this.siType = td.type; this.layout = td.layout;
  }
  /** Read a Softimage parameter, falling back to a legacy name. */
  p(si: string, legacy?: string, dflt = 0): number { const a = this.get(si); if (a) return Number(a.value); const b = legacy ? this.get(legacy) : undefined; return b ? Number(b.value) : dflt; }
  apply(input: MeshData | null): MeshData | null {
    if (!input || this.val('mute')) return input;
    switch (this.preset) {
      case 'Extrude Along Normal': return topo.extrudeAlongNormal(input, this.sel, this.p('length'), this.p('inset'), this.p('subdivs'), !!this.val('duplicate'));
      case 'Inset Polygons': return topo.extrudeAlongNormal(input, this.sel, this.p('length', undefined, 0), this.p('inset', undefined, 0.2), this.p('subdivs'), !!this.val('duplicate'));
      case 'Offset Polygons': return topo.offsetPolygons(input, this.sel, this.p('offset', undefined, 0.2));
      case 'Local Subdivision': return topo.localSubdivision(input, this.sel, Math.max(1, this.p('subdivisionlevel', undefined, 1)));
      case 'Delete Components': return topo.deleteComponents(input, this.sel);
      case 'Duplicate Polygons': return topo.duplicatePolygons(input, this.sel, this.p('length', 'offset', 1));
      case 'Subdivide Polygons': return topo.subdividePolygons(input, this.sel, this.p('subdivtype'), Math.max(1, this.p('subdivisions', undefined, 1)));
      case 'Split Edges': { const r = this.p('ratioedge', 'ratio', 0.5); return topo.splitEdges(input, this.sel, r > 1 ? r / 100 : r, this.get('connect') ? !!this.val('connect') : true); }
      case 'Weld Points': return topo.weldPoints(input, this.sel);
      case 'Collapse Components': return topo.collapseComponents(input, this.sel);
      case 'Invert Polygons': return topo.invertPolygons(input, this.sel);
      case 'Triangulate': return topo.triangulate(input, this.sel);
      case 'Apply Thickness': return topo.applyThickness(input, this.p('thickness', 'amount', 0.5));
      case 'Filter Points': return topo.filterPoints(input, this.sel, this.p('distance', 'strength', 0.5));
      case 'Symmetrize Polygons': return topo.symmetrize(input, this.sel, Math.min(2, this.p('symmetryplane', 'axis')) as 0 | 1 | 2);
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
    case 'Delete Components': case 'Subdivide Polygons': case 'Weld Points': case 'Collapse Components': case 'Invert Polygons': case 'Triangulate': case 'Offset Polygons': case 'Local Subdivision': return new TopologyOperator(preset, sel, []);
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
    super(name, type, 'primitive', type === 'polymsh' ? (siParamDefs('prim:Polygon Mesh/Cube').length ? siParamDefs('prim:Polygon Mesh/Cube') : [enumP('subdrule', 0, [{ label: 'Catmull-Clark', value: 0 }, { label: 'XSI-Doo-Sabin', value: 2 }, { label: 'Linear', value: 3 }], 'Rule')]) : []);
    if (type === 'polymsh') this.layout = siLayout('prim:Polygon Mesh/Cube');
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
  private markers: MarkerNode[] | null = null; private clustersFolder: Node | null = null;
  /** Like Softimage: the four construction-mode markers, then the operators (newest first), then the Clusters folder. */
  explorerChildren(): Node[] {
    if (!this.markers) { this.markers = [new MarkerNode('Secondary Shape Modeling', 'secondaryshapemarker', 'secondaryshape'), new MarkerNode('Animation', 'animationmarker', 'animation'), new MarkerNode('Shape Modeling', 'shapemarker', 'shape'), new MarkerNode('Modeling', 'modelingmarker', 'modeling')]; for (const m of this.markers) m.parent = this; }
    if (!this.clustersFolder) { this.clustersFolder = new ClusterFolder(); this.clustersFolder.parent = this; }
    return [...this.markers, ...[...this.operators].reverse(), this.clustersFolder];
  }
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
    this.local.layout = siPropLayout('C3DKineState') as any;
  }
  localMatrix(): THREE.Matrix4 {
    const l = this.local, d = Math.PI / 180;
    const e = new THREE.Euler(l.val('rotx') * d, l.val('roty') * d, l.val('rotz') * d, threeOrder(l.val('rotorder')));
    return new THREE.Matrix4().compose(new THREE.Vector3(l.val('posx'), l.val('posy'), l.val('posz')), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(l.val('sclx'), l.val('scly'), l.val('sclz')));
  }
  explorerChildren() { return [this.local, this.global]; }
}

// ---------------------------------------------------------------- X3DObject
// ------------------------------------------------------------- constraints
/** Kinematic constraints live on the object as properties (Direction Cns, Position Cns, Orientation Cns, Pose Cns, Up Vector…)
 *  with a `targets` list, like Softimage's Kinematics > Constraints. Evaluated on top of the local transform. */
export class Constraint extends Property {
  targets: X3DObject[] = [];
  constructor(name: string, type: string, defs: any[], targets: X3DObject[]) { super(name, type, defs); this.targets = targets; }
}
let evaluating = 0;
export function applyConstraints(o: X3DObject, g: THREE.Matrix4): THREE.Matrix4 {
  if (evaluating > 8) return g; // guard against constraint cycles
  for (const c of o.properties) {
    if (!(c instanceof Constraint) || !c.targets.length || c.val('active') === false) continue;
    const alive = c.targets.filter(t => t.parentObj || t === o); if (!alive.length) continue;
    evaluating++;
    try {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); g.decompose(p, q, s);
      const tg = alive.map(t => t.globalMatrix()); const tp = tg.map(m => new THREE.Vector3().setFromMatrixPosition(m)); const tc = tp.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / tp.length);
      const blend = Number(c.val('blendweight') ?? 1);
      if (c.type === 'dircns') {
        // point the chosen local axis (-Z for cameras and lights, +X for bones) at the target, up vector = world Y unless an up-vector reference is set
        const axis = c.val('dirx') ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, -1); const dir = tc.clone().sub(p); if (dir.lengthSq() < 1e-12) return g; dir.normalize();
        const up = new THREE.Vector3(0, 1, 0); const upRef = (c as any).upVector as X3DObject | undefined; if (upRef) up.copy(new THREE.Vector3().setFromMatrixPosition(upRef.globalMatrix()).sub(p).normalize());
        const z = axis.z ? dir.clone().negate() : new THREE.Vector3().crossVectors(axis.x ? dir : up, up).normalize(); const m = new THREE.Matrix4();
        if (axis.z) { const x = new THREE.Vector3().crossVectors(up, z).normalize(); if (x.lengthSq() < 1e-8) x.set(1, 0, 0); const y = new THREE.Vector3().crossVectors(z, x); m.makeBasis(x, y, z); }
        else { const x = dir; const zz = new THREE.Vector3().crossVectors(x, up).normalize(); if (zz.lengthSq() < 1e-8) zz.set(0, 0, 1); const y = new THREE.Vector3().crossVectors(zz, x); m.makeBasis(x, y, zz); }
        const roll = Number(c.val('roll') ?? 0) * Math.PI / 180; const nq = new THREE.Quaternion().setFromRotationMatrix(m); if (roll) nq.multiply(new THREE.Quaternion().setFromAxisAngle(axis.z ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), roll));
        g = new THREE.Matrix4().compose(p, blend < 1 ? q.clone().slerp(nq, blend) : nq, s);
      } else if (c.type === 'poscns') {
        const off = new THREE.Vector3(Number(c.val('offsetx') ?? 0), Number(c.val('offsety') ?? 0), Number(c.val('offsetz') ?? 0)); const np = tc.clone().add(off); g = new THREE.Matrix4().compose(blend < 1 ? p.clone().lerp(np, blend) : np, q, s);
      } else if (c.type === 'oricns') {
        const tq = new THREE.Quaternion(); tg[0].decompose(new THREE.Vector3(), tq, new THREE.Vector3()); const off = new THREE.Euler(Number(c.val('offsetx') ?? 0) * Math.PI / 180, Number(c.val('offsety') ?? 0) * Math.PI / 180, Number(c.val('offsetz') ?? 0) * Math.PI / 180, 'ZYX'); tq.multiply(new THREE.Quaternion().setFromEuler(off)); g = new THREE.Matrix4().compose(p, blend < 1 ? q.clone().slerp(tq, blend) : tq, s);
      } else if (c.type === 'posecns') {
        const tq = new THREE.Quaternion(), ts = new THREE.Vector3(); tg[0].decompose(new THREE.Vector3(), tq, ts); g = new THREE.Matrix4().compose(blend < 1 ? p.clone().lerp(tc, blend) : tc, blend < 1 ? q.clone().slerp(tq, blend) : tq, c.val('cnsscl') === false ? s : ts);
      } else if (c.type === 'sclcns') {
        const ts = new THREE.Vector3(); tg[0].decompose(new THREE.Vector3(), new THREE.Quaternion(), ts); g = new THREE.Matrix4().compose(p, q, ts);
      } else if (c.type === 'dstcns') {
        const dist = Number(c.val('distance') ?? 1); const dir = p.clone().sub(tc); if (dir.lengthSq() > 1e-12) { dir.normalize(); g = new THREE.Matrix4().compose(tc.clone().add(dir.multiplyScalar(dist)), q, s); }
      }
    } finally { evaluating--; }
  }
  return g;
}


export class X3DObject extends Node {
  parentObj: X3DObject | null = null;
  readonly children: X3DObject[] = [];
  readonly kinematics = new Kinematics();
  readonly properties: Property[] = [];
  primitive: Primitive | null = null;
  material: Material | null = null;   // null = inherits Scene_Material
  readonly clusters: Cluster[] = [];
  cluster(name: string) { return this.clusters.find(c => c.name === name); }
  addCluster(c: Cluster) { c.parent = this.primitive?.explorerChildren().slice(-1)[0] ?? (this as any); this.clusters.push(c); return c; }
  removeCluster(c: Cluster) { const i = this.clusters.indexOf(c); if (i >= 0) this.clusters.splice(i, 1); }
  layer: Layer | null = null;

  constructor(name: string, type: string, kind: NodeKind = 'object') {
    super(name, type, kind);
    this.kinematics.parent = this;
    this.addProperty(makeVisibility());
  }
  addProperty(p: Property) { p.parent = this; this.properties.push(p); return p; }
  removeProperty(p: Property) { const i = this.properties.indexOf(p); if (i >= 0) { this.properties.splice(i, 1); p.parent = null; } }
  property(type: string) { return this.properties.find(p => p.type === type) ?? this.clusters.flatMap(c => c.properties).find(p => p.type === type); }
  /** Every property on the object and on its clusters. */
  allProperties(): Property[] { return [...this.properties, ...this.clusters.flatMap(c => c.properties)]; }
  setPrimitive(p: Primitive | null) { if (this.primitive) this.primitive.parent = null; this.primitive = p; if (p) p.parent = this; }
  setMaterial(m: Material | null) { if (this.material) this.material.parent = null; this.material = m; if (m) m.parent = this; }
  addChild(c: X3DObject) { if (c.parentObj) c.parentObj.removeChild(c); c.parentObj = this; c.parent = this; this.children.push(c); }
  removeChild(c: X3DObject) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentObj = null; c.parent = null; }
  get model(): Model | null { let n: X3DObject | null = this; while (n) { if (n instanceof Model) return n; n = n.parentObj; } return null; }
  get visible(): boolean { return !!this.property('visibility')?.val('viewvis'); }
  globalMatrix(): THREE.Matrix4 {
    const m = this.kinematics.localMatrix();
    const g = this.parentObj ? this.parentObj.globalMatrix().multiply(m) : m;
    return applyConstraints(this, g);
  }
  updateGlobal() {
    const g = this.globalMatrix(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    g.decompose(p, q, s); const e = new THREE.Euler().setFromQuaternion(q, threeOrder(this.kinematics.local.val('rotorder'))), r = 180 / Math.PI;
    const G = this.kinematics.global;
    G.get('posx')!.def.value = p.x; // readonly: set internal silently
    (G.get('posx') as any)._value = p.x; (G.get('posy') as any)._value = p.y; (G.get('posz') as any)._value = p.z;
    (G.get('rotx') as any)._value = e.x * r; (G.get('roty') as any)._value = e.y * r; (G.get('rotz') as any)._value = e.z * r;
    (G.get('sclx') as any)._value = s.x; (G.get('scly') as any)._value = s.y; (G.get('sclz') as any)._value = s.z;
  }
  *descendants(): Generator<X3DObject> { for (const c of this.children) { yield c; yield* c.descendants(); } }
  /** Softimage order: Polygon Mesh, Kinematics, Visibility, Material, (shared) Ambient Lighting, Display, Geometry Approximation, children. */
  explorerChildren(): Node[] {
    const out: Node[] = [];
    if (this.primitive) out.push(this.primitive);
    out.push(this.kinematics);
    const vis = this.properties.filter(p => p.type === 'visibility'), rest = this.properties.filter(p => p.type !== 'visibility');
    out.push(...vis);
    if (this.material) out.push(this.material);
    if (!this.ambientNode) { this.ambientNode = new Property('Ambient Lighting', 'AmbientLighting', [color('ambience', [0.2, 0.2, 0.2], 'Ambience')]); this.ambientNode.shared = true; this.ambientNode.parent = this; }
    out.push(this.ambientNode, ...rest, ...this.children);
    return out;
  }
  private ambientNode: Property | null = null;
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
    const prim = new Primitive('Camera', 'camera');
    // The real C3DCamera property page (Primitive / Projection Plane / Lens Shaders / Display tabs); fov in degrees, near/far planes.
    for (const d of withSi('C3DCamera', [num('fov', 53.6, 'Angle', { min: 1, max: 179, uimin: 1, uimax: 179 }), num('near', 0.1, 'Near Plane', { min: 0.001 }), num('far', 32768, 'Far Plane'), num('aspect', 1.333, 'Pict. Ratio'), num('orthoheight', 10, 'Ortho Height')])) prim.add(d);
    prim.layout = siPropLayout('C3DCamera') as any; this.setPrimitive(prim);
  }
  get ortho() { return Number(this.primitive?.val('proj') ?? 0) === 1 || !!this.primitive?.val('ortho'); }
}
export class Light extends X3DObject {
  /** The light shader (Softimage's soft_light: colour, intensity, shadows, spread…), a real shader node like a material's surface shader. */
  readonly shader: Shader;
  constructor(name: string, kind: 'point' | 'infinite' | 'spot') {
    super(name, 'light');
    const p = new Primitive(kind === 'point' ? 'Point' : kind === 'spot' ? 'Spot' : 'Infinite', 'light');
    // C3DLightPoint "General" page: Type, cone, falloff exponent, contributions, clipping, selective lighting.
    const TYPE = enumP('Type', kind === 'point' ? 0 : kind === 'infinite' ? 1 : 2, [{ label: 'Point', value: 0 }, { label: 'Infinite', value: 1 }, { label: 'Spot', value: 2 }], 'Type');
    for (const d of withSi('C3DLightPoint', [TYPE, num('LightCone', 30, 'Cone Angle', { min: 0, max: 180 }), num('LightExponent', 0, 'Spread Exponent', { min: 0 }), bool('DiffuseContribution', true, 'Diffuse'), bool('SpecularContribution', true, 'Specular')])) p.add(d);
    p.add(enumP('type', kind, [{ label: 'Point', value: 'point' }, { label: 'Infinite', value: 'infinite' }, { label: 'Spot', value: 'spot' }], 'Kind', { readOnly: true }));
    const lay = siPropLayout('C3DLightPoint') as any[] | undefined; if (lay) p.layout = lay.filter(t => t.tab === 'General') as any;
    p.add(color('soft_light.color', [1, 1, 1], 'Color')); p.add(num('soft_light.intensity', 0.75, 'Intensity', { min: 0, max: 10 }));
    this.setPrimitive(p);
    this.shader = makeSiShader('sib_light', 'soft_light') ?? new Shader('soft_light', 'soft_light', [color('color', [1, 1, 1], 'Light Color'), num('intensity', 0.75, 'Intensity')]);
    this.shader.set('intensity', 0.75); this.shader.parent = this;
    // keep the primitive's legacy colour/intensity in sync with the shader (viewport + light rig code read those)
    this.shader.onChange((q) => { if (q.name === 'color') p.set('soft_light.color', q.value); if (q.name === 'intensity') p.set('soft_light.intensity', q.value); });
  }
}

// ---------------------------------------------------------------- layers/passes
export class Layer extends Node {
  readonly members = new Set<X3DObject>();
  constructor(name: string) { super(name, 'layer', 'layer', [bool('viewvis', true, 'View Visibility'), bool('rendvis', true, 'Render Visibility'), bool('selectability', true, 'Selectable'), color('color', [0.6, 0.6, 0.6], 'Color')]); }
}
/** A Softimage group: a named set of objects (Edit > Group in the MCP). */
export class Group extends Node {
  readonly members: X3DObject[] = [];
  constructor(name: string) { super(name, 'group', 'folder', []); }
  explorerChildren(): Node[] { return [...this.members]; }
}
export class Pass extends Node { constructor(name: string) { super(name, 'pass', 'pass', [bool('Active', true, 'Active'), int('FrameStart', 1, 'Start Frame'), int('FrameEnd', 100, 'End Frame')]); } }

// ---------------------------------------------------------------- scene
export class Scene extends Node {
  readonly root: Model;
  readonly layers: Layer[] = [];
  readonly passes: Pass[] = [];
  readonly materials: Material[] = [];   // sources > materials library
  readonly groupList: Group[] = [];
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
