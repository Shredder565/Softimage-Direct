// Scene graph mirroring Softimage's object model:
// Scene -> Models -> X3DObjects; each X3DObject owns Kinematics (local/global), a Primitive with a
// construction history (operator stack), Properties, a Material, Clusters.
import * as THREE from 'three';
import { ParamSet, num, int, bool, str, enumP, color } from './params';
import { siShaderDefs, type SiShaderDef } from './shaders';
import { miaUnlockDefs, resolveMiaUnlockKey } from './miaUnlock';
import wrapEnum from '../data/si/render_wrap_enum.json';
import mentalRayPass from '../data/si/render_mentalray_pass.json';
import { siParamDefs, siLayout, siName, menuDefaults, siPropDefs, siPropLayout, withOp } from './opdefs';
import type { ParamDef } from './params';
import { movieFormatParamDefs } from './renderOutput';

/** C3DMaterial.spdl Combo Clamp/Repeat — unlock_render_wrap_enum_probe (10496/10497). */
const WRAP_UV_ITEMS = (wrapEnum.items as { label: string; value: number }[]).map(it => ({
  label: it.label,
  value: it.value,
}));
const WRAP_UV_DEFAULT = Number((wrapEnum as { default?: number }).default ?? 10497);
const WRAP_DESC = (wrapEnum as { descriptions?: { wrapu?: string; wrapv?: string } }).descriptions ?? {};
/** Merge our parameter definitions with the full SPDL property set so the Property Editor shows Softimage's complete page. */
function withSi(key: string, ours: ParamDef[]): ParamDef[] { const si = siPropDefs(key); const mine = new Map(ours.map(d => [d.name, d])); const out = si.map(d => mine.get(d.name) ? { ...d, ...mine.get(d.name)! } : { ...d, group: d.group }); for (const d of ours) if (!si.some(x => x.name === d.name)) out.push(d); return out; }
import { siDeformers } from './sideform';
import { siCube, siSphere, siCylinder, siCone, siTorus, siGrid, siDisc } from './siprims';
import { MeshData, platonic, rhombicosidodecahedron, soccerBall, emptyMesh } from './geometry';
import * as topo from './topology';
import type { CompSel } from './topology';
import { evalCurve, curveDomain, type CurveData } from './curves';
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
  get isComplete(): boolean {
    // Softimage "Always Complete" clusters stay complete as topology grows; honour the flag first.
    if (this.val('alwayscomplete')) return true;
    const o = this.obj; const m = o?.primitive?.mesh(); if (!m) return false;
    let n = 0;
    if (this.compKind === 'pnt') n = m.positions.length / 3;
    else if (this.compKind === 'poly') n = m.polygons.length;
    else if (this.compKind === 'edge') { const seen = new Set<string>(); for (const f of m.polygons) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; seen.add(a < b ? `${a}-${b}` : `${b}-${a}`); } n = seen.size; }
    else if (this.compKind === 'sample') n = m.polygons.reduce((s, f) => s + f.length, 0); // Softimage polynodes
    return n > 0 && this.elements.size >= n;
  }
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
const DISPLAY_MODE_ITEMS = [
  { label: 'Bounding Box', value: 0 }, { label: 'Wireframe', value: 1 }, { label: 'Shaded', value: 7 }, { label: 'Default', value: 8 },
];
export function makeDisplay(shared = true) {
  // Softimage C3DDisplayProp / prop:display defaults (staticsel=8 Default, wirecol=0, xray=1, neardist=100).
  // Keep wirecol as bool for palette/viewport callers; Softimage stores it as 0/1.
  const p = new Property('Display', 'display', withOp('prop:display', [
    enumP('staticsel', 8, DISPLAY_MODE_ITEMS, 'Static (selected)'),
    enumP('intsel', 8, DISPLAY_MODE_ITEMS, 'Interactive (selected)'),
    enumP('playbacksel', 8, DISPLAY_MODE_ITEMS, 'Playback (selected)'),
    enumP('staticunselnear', 8, DISPLAY_MODE_ITEMS, 'Static (unselected near)'),
    enumP('intunselnear', 8, DISPLAY_MODE_ITEMS, 'Interactive (unselected near)'),
    enumP('playbackunselnear', 8, DISPLAY_MODE_ITEMS, 'Playback (unselected near)'),
    enumP('staticunselfar', 8, DISPLAY_MODE_ITEMS, 'Static (unselected far)'),
    enumP('intunselfar', 8, DISPLAY_MODE_ITEMS, 'Interactive (unselected far)'),
    enumP('playbackunselfar', 8, DISPLAY_MODE_ITEMS, 'Playback (unselected far)'),
    bool('wirecol', false, 'Use Wireframe Color'),
    color('wirecolorrgb', [0.7, 0.7, 0.7], 'Wireframe Color'),
    num('xray', 1.0, 'X-Ray Opacity', { min: 0, max: 1 }),
    num('neardist', 100, 'Near Distance'),
  ]));
  p.shared = shared; p.layout = (siPropLayout('C3DDisplayProp') ?? siLayout('prop:display')) as any; return p;
}
export function makeGeomApprox(shared = true) {
  // Softimage prop:geomapprox: Auto Discontinuity ON (gapproxmoad=true), disc angle 60, subdiv level 0.
  const p = new Property('Geometry Approximation', 'geomapprox', withOp('prop:geomapprox', [
    int('gapproxmordrsl', 0, 'Subdivision Level', { min: 0, max: 5, animatable: false, group: 'Polygon Mesh' }),
    enumP('gapproxmosr', 0, [{ label: 'Catmull-Clark', value: 0 }, { label: 'Loop', value: 1 }, { label: 'XSI-Doo-Sabin', value: 2 }, { label: 'Linear', value: 3 }], 'Subdivision Rule', { group: 'Polygon Mesh' }),
    bool('gapproxmoad', true, 'Auto Discontinuity', { group: 'Polygon Mesh' }),
    num('gapproxmoan', 60, 'Disc Angle', { min: 0, max: 180, group: 'Polygon Mesh' }),
  ]));
  p.shared = shared; p.layout = siLayout('prop:geomapprox') as any; return p;
}

/** Softimage Get > Property preset from opdefs (AttributeDisplay, RenderMap, Transform Setup, …). */
export function makeSiOpProperty(opKey: string, name: string, type: string, overrides: Record<string, any> = {}): Property {
  const defs = withOp(opKey, []);
  for (const [k, v] of Object.entries(overrides)) { const d = defs.find(x => x.name === k); if (d) d.value = v; }
  const p = new Property(name, type, defs.length ? defs : [bool('enabled', true, 'Enabled')]);
  p.layout = siLayout(opKey) as any; return p;
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
/** Softimage ApplyShader Constant (materials_beyond_phong.json): color=[1,1,1,0], transp=1; Parameter.Name = sn.
 *  Full phenolib material-constant.spdl is NOT what headless ApplyShader installs — dump wins. */
export function makeConstant(name = 'Constant'): Shader {
  return new Shader(name, 'Constant', [
    color('color', [1, 1, 1], 'color'),
    num('transp', 1, 'transp'),
  ]);
}
/** Absolute .Preset + SIApplyShader nested OM (unlock_render_mia_probe) — 77/101/49 params. */
export function makeMiaUnlockShader(shaderKey: string, name?: string): Shader | null {
  const defs = miaUnlockDefs(shaderKey);
  if (!defs) return null;
  return new Shader(name ?? shaderKey, shaderKey, defs);
}
/** A shader node from Softimage's own phenolib SPDL (material-phong, txt2d-image-explicit…) or a Get > Material preset name. */
export function makeSiShader(key: string, name?: string): Shader | null {
  const preset = String(key).replace(/^Shaders\\Material\\/, '').replace(/^Materials\\/, '');
  if (preset === 'Constant') return makeConstant(name ?? 'Constant');
  const miaKey = resolveMiaUnlockKey(preset);
  if (miaKey) return makeMiaUnlockShader(miaKey, name ?? miaKey);
  const r = siShaderDefs(preset); if (!r) return null;
  const s = new Shader(name ?? r.title, r.type, r.defs, r.spdl); if (r.layout) s.layout = r.layout; return s;
}
export function makePhong(name = 'Phong') { return makeSiShader('Phong', name)!; }
export function makeLambert(name = 'Lambert') { return makeSiShader('Lambert', name)!; }
/** Softimage Material OM (si_render_material_phong + materials_beyond_phong): classname Material; Parameter.Name labels attested.
 *  Connection ports (surface/volume/…) are Parameter slots; Softimage wires surface/shadow/photon → shader.out. */
export class Material extends Node {
  surface: Shader | null = null;
  /** Softimage Material Parameter.Source connections: port → source ScriptName (usually 'out'). */
  readonly portConnections = new Map<string, string>();
  constructor(name: string) {
    super(name, 'Material', 'material', [
      // Connection Parameter.Name = sn (materials_beyond_phong.params_full)
      str('surface', '', 'surface', { readOnly: true }),
      str('volume', '', 'volume', { readOnly: true }),
      str('environment', '', 'environment', { readOnly: true }),
      str('contour', '', 'contour', { readOnly: true }),
      str('displacement', '', 'displacement', { readOnly: true }),
      str('shadow', '', 'shadow', { readOnly: true }),
      str('photon', '', 'photon', { readOnly: true }),
      str('photonvolume', '', 'photonvolume', { readOnly: true }),
      str('normal', '', 'normal', { readOnly: true }),
      str('lightmap', '', 'lightmap', { readOnly: true }),
      str('realtime', '', 'realtime', { readOnly: true }),
      str('material', '', 'material', { readOnly: true }),
      str('Name', name, 'Name', { readOnly: true }),
      // Softimage PC dump: sn envmode / wrapu / wrapv Parameter.Name Mode / Wrap U / Wrap V
      // unlock render.wrapu_wrapv_enum_ui: C3DMaterial.spdl Combo Clamp=10496 Repeat=10497
      int('envmode', 8448, 'Mode'),
      enumP('wrapu', WRAP_UV_DEFAULT, WRAP_UV_ITEMS, 'Wrap U', { desc: WRAP_DESC.wrapu }),
      enumP('wrapv', WRAP_UV_DEFAULT, WRAP_UV_ITEMS, 'Wrap V', { desc: WRAP_DESC.wrapv }),
      str('CAV', '', 'Vertex Color Property'),
      str('UV', '', 'UV Property'),
      int('TextureSel', 1, 'Texture Selection'),
      str('TrackedShader', '', 'Shader', { readOnly: true }),
      str('ImageClipName', '', 'Image Clip[2]'),
      bool('TextureOverriden', false, 'Overriden by Texture Editor Selection'),
      bool('alphamask', false, 'Use Alpha Mask'),
    ]);
  }
  setSurface(s: Shader | null) {
    if (this.surface) this.surface.parent = null;
    this.surface = s;
    if (s) s.parent = this;
    // Softimage dump connections_from_material: surface / shadow / photon → shader.out
    this.portConnections.clear();
    if (s) for (const port of ['surface', 'shadow', 'photon'] as const) this.portConnections.set(port, 'out');
  }
  explorerChildren() { return this.surface ? [this.surface] : []; }
  get diffuse(): [number, number, number] {
    const d = this.surface?.val('diffuse') ?? this.surface?.val('color');
    return (Array.isArray(d) ? d.slice(0, 3) : [0.7, 0.7, 0.7]) as [number, number, number];
  }
}

// -------------------------------------------------------------- operators
export class Operator extends Node {
  constructor(name: string, type: string, defs: any[]) { super(name, type, 'operator', defs); this.region = construction.mode; }
  /** Transforms the geometry payload (MeshData for meshes/surfaces, CurveData for curves, LatticeData for lattices). */
  apply(input: any): any { return input; }
  /** Operators that read other scene objects (deformers, generator inputs, references) return a stamp of what they
   *  depend on; when it changes the primitive re-evaluates, so moving a bone or a lattice updates the mesh. */
  depStamp?(): string;
  _lastStamp?: string;
  /** Construction-history region (Softimage construction modes): modeling < shape < animation < secondaryshape. */
  region: 'modeling' | 'shape' | 'animation' | 'secondaryshape' = 'modeling';
}
export const REGIONS = ['modeling', 'shape', 'animation', 'secondaryshape'] as const;
/** The construction mode new operators go into (set by the construction-mode combo). */
export const construction = { mode: 'modeling' as typeof REGIONS[number] };
/** Stamp helper: global matrices (+ geometry versions) of a set of objects. */
export function stampOf(objs: (X3DObject | null | undefined)[]): string { let s = ''; for (const o of objs) { if (!o) continue; const e = o.globalMatrix().elements; for (let i = 0; i < 16; i++) s += (Math.round(e[i] * 1e4)) + ','; s += (o.primitive?.version ?? 0) + '|'; } return s; }

/** The generator at the bottom of the stack that makes the primitive geometry. Like Softimage, it carries the shape
 *  parameters of the implicit input primitive (cube.cube: length…) and the Geometry converter parameters (subdivisions). */
export class GeomOperator extends Operator {
  /** Softimage SPDL layout for the shape tab (e.g. Torus Radius group) and Geometry converter tab. */
  shapeLayout?: ReturnType<typeof siLayout>;
  geomLayout?: ReturnType<typeof siLayout>;
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
  op.shapeLayout = siLayout(shapeKey) ?? siLayout('shape:Polygon Mesh/' + preset);
  op.geomLayout = siLayout(geomKey) ?? siLayout('geom:' + preset);
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
  'Extrude Along Normal': 'extrudenormalop', 'Extrude Along Axis': 'extrudecompaxisop', 'Inset Polygons': 'extrudecompaxisop', 'Split Edges': 'splitedgeop', 'Weld Points': 'weldpointsop',
  'Filter Points': 'filterpointsbydistancesop', 'Symmetrize Polygons': 'symmetrizepolygonop', 'Subdivide Polygons': 'subdividepolygonop', 'Triangulate': 'subdividepolygonop',
  'Collapse Components': 'collapseop', 'Invert Polygons': 'invertpolygonop', 'Delete Components': 'deletecomponentop', 'Bevel': 'bevelop', 'Bridge Polygons': 'bridgeop',
  'Quadrangulate': 'quadrangulateop', 'Dissolve': 'dissolvecompop', 'Disconnect': 'disconnectcompop', 'Spin Edges': 'spinedgeop', 'Slice': 'slicepolygonsop',
  'Slice Plane': 'slicepolygonsop', 'Dice': 'dicepolygonsop', 'Polygon Reduction': 'polygonreductionop', 'Apply Thickness': 'thicknessop', 'Duplicate Polygons': 'extrudecompaxisop',
  'Cap Hole': 'capholeop', 'Connect Points': 'addedgeop', 'Local Subdivision': 'meshlocalsubdivisionop', 'Offset Polygons': 'offsetpolygonsop',
  'Weld Boundary': 'weldedgesop',
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
      case 'Extrude Along Axis': {
        const ax = topo.extrudeAxisDirection(input, this.sel, !!this.val('x'), this.get('y') ? !!this.val('y') : true, !!this.val('z'), this.p('frame', undefined, 1));
        return topo.extrudeAlongAxis(input, this.sel, ax, this.p('length'), this.p('inset'), this.p('subdivs'), !!this.val('duplicate'));
      }
      case 'Inset Polygons': return topo.extrudeAlongNormal(input, this.sel, this.p('length', undefined, 0), this.p('inset', undefined, 0.2), this.p('subdivs'), !!this.val('duplicate'));
      case 'Offset Polygons': return topo.offsetPolygons(input, this.sel, this.p('offset', undefined, 0.2));
      case 'Local Subdivision': return topo.localSubdivision(input, this.sel, Math.max(1, this.p('subdivisionlevel', undefined, 1)));
      case 'Delete Components': return topo.deleteComponents(input, this.sel);
      case 'Duplicate Polygons': return topo.duplicatePolygons(input, this.sel, this.p('length', 'offset', 1));
      case 'Subdivide Polygons': return topo.subdividePolygons(input, this.sel, this.p('subdivtype'), Math.max(1, this.p('subdivisions', undefined, 1)));
      case 'Split Edges': { const r = this.p('ratioedge', 'ratio', 0.5); return topo.splitEdges(input, this.sel, r > 1 ? r / 100 : r, this.get('connect') ? !!this.val('connect') : true); }
      case 'Weld Points': return topo.weldPoints(input, this.sel);
      case 'Weld Boundary': return topo.weldBoundaryEdges(input, this.sel, this.p('distance', undefined, 0.001));
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
    case 'Extrude Along Axis': return new TopologyOperator(preset, sel, []);
    case 'Inset Polygons': return new TopologyOperator(preset, sel, [num('inset', 0.3, 'Inset', { min: 0, max: 1 })]);
    case 'Duplicate Polygons': return new TopologyOperator(preset, sel, [num('offset', 1, 'Offset', { min: -100, max: 100 })]);
    case 'Split Edges': return new TopologyOperator(preset, sel, [num('ratio', 0.5, 'Split Ratio', { min: 0.01, max: 0.99 })]);
    case 'Apply Thickness': return new TopologyOperator(preset, sel, [num('amount', 0.5, 'Thickness', { min: -50, max: 50 })]);
    case 'Filter Points': return new TopologyOperator(preset, sel, [num('strength', 0.5, 'Strength', { min: 0, max: 1 })]);
    case 'Symmetrize Polygons': return new TopologyOperator(preset, sel, [enumP('axis', 0, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Mirror Axis')]);
    case 'Weld Boundary': return new TopologyOperator(preset, sel, [num('distance', 0.001, 'Distance', { min: 0, max: 10 })]);
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
  /** Insert at the top of the operator's region (the generator always stays first), so a deform added in Animation mode
   *  evaluates after every modeling/shape operator even if those are added later. */
  addOperator(op: Operator) {
    op.parent = this; if (!this.operators.length || op.type === 'geom' || this.operators.length === 0) { this.operators.push(op); this.dirty = true; return; }
    if (!op.region) op.region = construction.mode; const r = REGIONS.indexOf(op.region); let at = this.operators.length;
    for (let i = 1; i < this.operators.length; i++) { const ri = REGIONS.indexOf(this.operators[i].region ?? 'modeling'); if (ri > r) { at = i; break; } }
    this.operators.splice(at, 0, op); this.dirty = true;
  }
  /** Geometry at the end of a region (e.g. the result of the modeling region), used by Freeze Modeling. */
  geomUpTo(region: typeof REGIONS[number]): any { const r = REGIONS.indexOf(region); let m: any = null; for (const op of this.operators) { if (op !== this.operators[0] && REGIONS.indexOf(op.region ?? 'modeling') > r) break; try { m = op.apply(m); } catch { /* ignore */ } } return m; }
  removeOperator(op: Operator) { const i = this.operators.indexOf(op); if (i >= 0) { this.operators.splice(i, 1); op.parent = null; this.dirty = true; } }
  /** Evaluate the construction history. */
  geom(): any {
    if (!this.dirty && this.cache !== null) { for (const op of this.operators) if (op.depStamp) { const st = op.depStamp(); if (st !== op._lastStamp) { op._lastStamp = st; this.dirty = true; } } }
    if (!this.dirty && this.cache !== null) return this.cache;
    for (const op of this.operators) if (op.depStamp) op._lastStamp = op.depStamp();
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
    // each region marker is followed by its operators (newest first); the generator sits at the bottom of the modeling region
    const out: Node[] = []; const byRegion = (r: string) => this.operators.filter((op, i) => i > 0 && (op.region ?? 'modeling') === r).reverse();
    for (const mk of this.markers) { out.push(mk); out.push(...byRegion(mk.mode)); if (mk.mode === 'modeling' && this.operators[0]) out.push(this.operators[0]); }
    return [...out, this.clustersFolder];
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
        const off = new THREE.Vector3(Number(c.val('offsetx') ?? 0), Number(c.val('offsety') ?? 0), Number(c.val('offsetz') ?? 0));
        let np = tc.clone().add(off);
        // Softimage Path / Curve (Path): perc 0–100 samples the constraining curve.
        const percP = c.get('perc');
        const pathCurve = alive[0]?.primitive?.curve?.() ?? null;
        if (percP && pathCurve) {
          const [u0, u1] = curveDomain(pathCurve);
          const u = u0 + (u1 - u0) * (Number(percP.value) / 100);
          const lp = evalCurve(pathCurve, u);
          np = new THREE.Vector3(lp[0], lp[1], lp[2]).applyMatrix4(alive[0].globalMatrix()).add(off);
        } else if (c.name.startsWith('Symmetry') || (c as any)._symmetry) {
          // Symmetry Cns: mirror constraining position across YZ (Softimage default plane).
          np = new THREE.Vector3(-tc.x, tc.y, tc.z).add(off);
        } else if ((c as any)._cluster) {
          // Object to Cluster: average selected cluster point positions in world.
          const cl = (c as any)._cluster as { obj: X3DObject; indices: number[] };
          const mesh = cl.obj.primitive?.mesh();
          if (mesh && cl.indices?.length) {
            const acc = new THREE.Vector3(); const M = cl.obj.globalMatrix();
            for (const i of cl.indices) {
              acc.add(new THREE.Vector3(mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]).applyMatrix4(M));
            }
            np = acc.multiplyScalar(1 / cl.indices.length).add(off);
          }
        } else if ((c as any)._bndPlane) {
          // Bounding Plane: project onto plane through target with normal from enum (default Y).
          const axis = Number(c.val('axis') ?? 1);
          const nrm = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
          const toPoint = p.clone().sub(tc); const d = toPoint.dot(nrm); np = p.clone().sub(nrm.multiplyScalar(d)).add(off);
        } else if ((c as any)._bndVolume) {
          // Bounding Volume: clamp inside axis-aligned box of target's size (implicit/null).
          const size = Number(alive[0].get('size')?.value ?? alive[0].primitive?.val?.('size') ?? 2);
          const half = size / 2;
          np = new THREE.Vector3(
            Math.max(tc.x - half, Math.min(tc.x + half, p.x)),
            Math.max(tc.y - half, Math.min(tc.y + half, p.y)),
            Math.max(tc.z - half, Math.min(tc.z + half, p.z)),
          ).add(off);
        }
        // Path tangent: optionally aim local -Z along curve (Direction-on-path).
        if (percP && pathCurve && c.val('tangent')) {
          const [u0, u1] = curveDomain(pathCurve);
          const u = u0 + (u1 - u0) * (Number(percP.value) / 100);
          const du = (u1 - u0) * 0.01;
          const a = evalCurve(pathCurve, u); const b = evalCurve(pathCurve, Math.min(u1 - 1e-6, u + du));
          const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).transformDirection(alive[0].globalMatrix()).normalize();
          if (dir.lengthSq() > 1e-8) {
            const z = dir.clone().negate(); const up = new THREE.Vector3(0, 1, 0);
            const x = new THREE.Vector3().crossVectors(up, z).normalize(); if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
            const y = new THREE.Vector3().crossVectors(z, x); const m = new THREE.Matrix4().makeBasis(x, y, z);
            q.copy(new THREE.Quaternion().setFromRotationMatrix(m));
          }
        }
        g = new THREE.Matrix4().compose(blend < 1 ? p.clone().lerp(np, blend) : np, q, s);
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
/** Softimage Partition under a Pass (Background_Objects / Background_Lights). viewvis=2 is Softimage default (siInherited). */
export class Partition extends Node {
  constructor(name: string) {
    super(name, 'Partition', 'folder', [
      str('Name', name, 'Name', { readOnly: true }),
      int('viewvis', 2, 'View Visibility'),
      int('rendvis', 2, 'Render Visibility'),
      int('selectability', 2, 'Selectability'),
      int('ghosting', 2, 'Animation Ghosting'),
      int('viewplaybackvis', 2, 'View Playback Visibility'),
    ]);
  }
}
/** Softimage Framebuffer on a Pass (Default_Pass.Main). Dump: si_render_framebuffer_enums.json */
export class Framebuffer extends Node {
  constructor(name = 'Main') {
    super(name, 'Framebuffer', 'property', [
      str('Name', name, 'Name'),
      str('RenderChannel', 'Main', 'RenderChannel'),
      bool('Enabled', true, 'Enabled'),
      str('Filename', '[Pass]_[Framebuffer]', 'Filename'),
      str('Format', 'pic', 'Format'),
      str('DataType', 'RGBA', 'DataType'),
      int('BitDepth', 3, 'BitDepth'),
    ]);
  }
}
/**
 * Softimage Passes.<Pass>.mentalray Property — Desktop tour desktop_tour_commands.json
 * (180 OM params). No invent HWND / PPG chrome beyond attested defaults.
 */
export function makeMentalRayPassOptions(): Property {
  const raw = (mentalRayPass as { params: Record<string, unknown> }).params || {};
  const defs: ParamDef[] = [];
  for (const [sn, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') defs.push(bool(sn, v, sn));
    else if (typeof v === 'number' && Number.isInteger(v)) defs.push(int(sn, v, sn));
    else if (typeof v === 'number') defs.push(num(sn, v, sn));
    else defs.push(str(sn, String(v ?? ''), sn));
  }
  return new Property('mentalray', 'mentalray', defs);
}

/**
 * Softimage Pass OM (si_render_passes.json): classname Pass, Default_Pass + CreatePass→Pass,
 * nested partitions + Main framebuffer; ImageWidth/Height match Scene Render Options defaults.
 * Desktop tour: Passes.Default_Pass.mentalray Property attached.
 */
export class Pass extends Node {
  readonly partitions: Partition[] = [];
  readonly framebuffers: Framebuffer[] = [];
  /** Softimage Passes.<Pass>.mentalray — desktop_tour_commands.json */
  readonly mentalray: Property;
  constructor(name: string) {
    super(name, 'Pass', 'pass', [
      bool('Active', true, 'Active'),
      str('Name', name, 'Name'),
      str('Camera', 'Camera', 'Camera'),
      str('Renderer', '', 'Renderer'),
      int('ImageWidth', 1920, 'ImageWidth'),
      int('ImageHeight', 1080, 'ImageHeight'),
      num('ImageAspectRatio', 1.777778, 'ImageAspectRatio'),
      num('ImagePixelRatio', 1, 'ImagePixelRatio'),
      bool('ImageLockAspectRatio', true, 'ImageLockAspectRatio'),
      int('ImageFormatPreset', -16, 'ImageFormatPreset'),
      bool('ImageFormatOverride', false, 'ImageFormatOverride'),
      int('FrameRangeSource', 3, 'FrameRangeSource'),
      int('FrameStart', 1, 'FrameStart'),
      int('FrameEnd', 100, 'FrameEnd'),
      int('FrameStep', 1, 'FrameStep'),
      str('FrameSet', '1-100', 'FrameSet'),
      bool('FieldEnable', false, 'FieldEnable'),
      int('FieldOrder', 0, 'FieldOrder'),
      bool('MotionBlur', false, 'MotionBlur'),
      num('MotionBlurShutterSpeed', 0.5, 'MotionBlurShutterSpeed'),
      bool('MotionBlurDeformation', true, 'MotionBlurDeformation'),
      int('OverrideCameraLensShaders', 0, 'OverrideCameraLensShaders'),
      // Softimage RenderPass Movie* (desktop_tour / SPDL); AfterImage: MovieFormat default mp4, no mov
      ...movieFormatParamDefs(),
    ]);
    this.mentalray = makeMentalRayPassOptions();
    this.mentalray.parent = this as any;
    this.addPartition('Background_Objects_Partition');
    this.addPartition('Background_Lights_Partition');
    this.addFramebuffer('Main');
  }
  addPartition(name: string) {
    const p = new Partition(name); p.parent = this; this.partitions.push(p); return p;
  }
  addFramebuffer(name: string) {
    const f = new Framebuffer(name); f.parent = this; this.framebuffers.push(f); return f;
  }
  explorerChildren(): Node[] { return [this.mentalray, ...this.partitions, ...this.framebuffers]; }
}
/** Softimage Passes.RenderOptions (SceneRenderProperty) — si_render_prefs.json */
export function makeSceneRenderOptions(): Property {
  const p = new Property('Scene Render Options', 'SceneRenderProperty', [
    str('Renderer', 'Mental Ray', 'Renderer'),
    str('OutputDir', '[Project Path]/Render_Pictures', 'OutputDir'),
    int('FramePadding', 1, 'FramePadding'),
    int('ImageFormatPreset', -16, 'ImageFormatPreset'),
    num('ImageAspectRatio', 1.777778, 'ImageAspectRatio'),
    int('ImageWidth', 1920, 'ImageWidth'),
    int('ImageHeight', 1080, 'ImageHeight'),
    num('ImagePixelRatio', 1, 'ImagePixelRatio'),
    bool('ImageLockAspectRatio', true, 'ImageLockAspectRatio'),
    int('FrameRangeSource', 0, 'FrameRangeSource'),
    int('FrameStart', 1, 'FrameStart'),
    int('FrameEnd', 100, 'FrameEnd'),
    int('FrameStep', 1, 'FrameStep'),
    str('FrameSet', '1-100', 'FrameSet'),
    bool('FieldEnable', false, 'FieldEnable'),
    int('FieldOrder', 0, 'FieldOrder'),
    bool('FieldInterleave', false, 'FieldInterleave'),
    num('MotionBlurShutterSpeed', 0.5, 'MotionBlurShutterSpeed'),
    num('MotionBlurShutterOffset', 0, 'MotionBlurShutterOffset'),
    int('MotionBlurShutterType', 0, 'MotionBlurShutterType'),
    bool('MotionBlurDeformation', true, 'MotionBlurDeformation'),
  ]);
  return p;
}
/**
 * Softimage RenderOptionsRegion.spdl — unlock_render_region_probe / PE unlock.
 * Param names + Softimage labels only. HWND crop chrome stays LOCK (defaults 0).
 */
export function makeRenderOptionsRegion(): Property {
  return new Property('Render Region Options', 'RenderOptions', [
    bool('UsePassOptions', true, 'Use Current Pass Options'),
    num('RegionOffsetX', 0, 'Offset X', { readOnly: true }),
    num('RegionOffsetY', 0, 'Offset Y', { readOnly: true }),
    num('RegionWidth', 0, 'Width', { readOnly: true }),
    num('RegionHeight', 0, 'Height', { readOnly: true }),
  ]);
}

// ---------------------------------------------------------------- scene
/** Softimage actionclip.weight FCurve key (ModifyWeightProc / gk10 via SetDefaultWeight). */
export type MixerWeightKey = { time: number; value: number; left?: number; right?: number; interp?: number };
/** Softimage Mixer clip on a track (PC dump nested Sources/Tracks). */
export type MixerClip = {
  name: string; source: string; start: number; duration: number; track?: number; weight?: number; mute?: boolean; additive?: boolean;
  /** Softimage `clip.actionclip.weight` FCurve keys; when set, mixer eval samples this instead of scalar `weight`. */
  weightKeys?: MixerWeightKey[];
};
/**
 * Softimage mixer transition between two clips (AddTransition / AddBridgeTransition / AddTWTransition).
 * Desktop pass3 (`si_mixer_transitions.json`): AddTWTransition → Mixer.TW1 classname Transition with
 * params weight=1, type=2, active=true, Name=TW1. Softimage Transition Type 2 = timewarp (TW#).
 */
export type MixerTransition = {
  name: string;
  kind: 'standard' | 'bridge' | 'timewarp';
  from: string;
  to: string;
  length: number;
  /** Softimage Parameter `sn: weight` (Transition Weight). Attested TW1 = 1. */
  weight?: number;
  /** Softimage Parameter `sn: type` (Transition Type). Attested TW1 = 2 (timewarp). */
  type?: number;
  /** Softimage Parameter `sn: active` (Active). Attested TW1 = true. */
  active?: boolean;
};
/** Softimage mixer compound (CreateCompound / ExplodeCompound). */
export type MixerCompound = { name: string; clips: string[]; start: number; duration: number };

/** Softimage scene Mixer (probe from si_anim_fcurve_golden.json): Sources/Tracks/Transitions/…. */
export function makeMixer(): Property {
  const m = new Property('Mixer', 'mixer', [
    str('Name', 'Mixer', 'Name'), bool('Hidden', false, 'Hidden'), bool('Active', true, 'Active'),
    num('start', 1, 'Start time'), num('duration', 100, 'Duration'),
    str('markers', '', 'Markers'), str('ui', '', 'UI properties'), str('templates', '', 'Templates'),
    bool('autotransition', false, 'Auto Transition'),
    str('sources', '[]', 'Sources', { readOnly: true }), str('tracks', '[]', 'Tracks', { readOnly: true }),
    str('transitions', '[]', 'Transitions', { readOnly: true }), str('compounds', '[]', 'Compounds', { readOnly: true }),
    str('relations', '[]', 'Relations', { readOnly: true }),
  ]);
  const state = m as any;
  state.clips = [] as MixerClip[];
  state.transitions = [] as MixerTransition[];
  state.compounds = [] as MixerCompound[];
  state.relations = [] as { master: string; slave: string }[];
  return m;
}
export function mixerOf(host: { property: (t: string) => Property | undefined; addProperty: (p: Property) => Property }): Property {
  return host.property('mixer') ?? host.addProperty(makeMixer());
}
/** Persist in-memory mixer arrays onto Softimage-visible nested string params. */
export function syncMixer(mix: Property) {
  const s = mix as any;
  const clips: MixerClip[] = s.clips ?? (s.clips = []);
  const transitions: MixerTransition[] = s.transitions ?? (s.transitions = []);
  const compounds: MixerCompound[] = s.compounds ?? (s.compounds = []);
  const relations = s.relations ?? (s.relations = []);
  mix.set('sources', JSON.stringify([...new Set(clips.map(c => c.source))]));
  mix.set('tracks', JSON.stringify(clips));
  mix.set('transitions', JSON.stringify(transitions));
  mix.set('compounds', JSON.stringify(compounds));
  mix.set('relations', JSON.stringify(relations));
  if (clips.length) {
    const end = Math.max(...clips.map(c => c.start + c.duration), Number(mix.val('duration')) || 1);
    mix.set('duration', end);
  }
  return mix;
}

export class Scene extends Node {
  readonly root: Model;
  readonly layers: Layer[] = [];
  readonly passes: Pass[] = [];
  readonly materials: Material[] = [];   // sources > materials library
  readonly groupList: Group[] = [];
  /** Softimage Passes.RenderOptions (SceneRenderProperty). */
  readonly renderOptions: Property;
  /** Softimage RenderOptionsRegion.spdl OM — HWND crop chrome LOCK. */
  readonly renderOptionsRegion: Property;
  constructor() {
    super('Scene', 'scene', 'scene', [str('Name', 'Untitled', 'Scene Name')]);
    this.root = new Model('Scene_Root');
    this.root.parent = this;
    this.root.setMaterial(this.newMaterial('Scene_Material', makePhong()));
    this.root.addProperty(makeDisplay()); this.root.addProperty(makeGeomApprox());
    this.root.addProperty(makeMixer());
    this.renderOptions = makeSceneRenderOptions();
    this.renderOptions.parent = this as any;
    this.renderOptionsRegion = makeRenderOptionsRegion();
    this.renderOptionsRegion.parent = this as any;
    this.addLayer('Layer_Default'); this.addPass('Default_Pass');
  }
  newMaterial(name: string, surface: Shader) { const m = new Material(this.uniqueName(name)); m.setSurface(surface); this.materials.push(m); return m; }
  addLayer(name: string) { const l = new Layer(this.uniqueName(name)); l.parent = this; this.layers.push(l); return l; }
  addPass(name: string) { const p = new Pass(this.uniqueName(name)); p.parent = this; this.passes.push(p); return p; }
  *allObjects(): Generator<X3DObject> { yield* this.root.descendants(); }
  find(name: string): X3DObject | undefined { for (const o of this.allObjects()) if (o.name === name || o.fullName === name) return o; return undefined; }
  uniqueName(base: string): string {
    const taken = new Set<string>(); for (const o of this.allObjects()) taken.add(o.name); for (const l of this.layers) taken.add(l.name); for (const m of this.materials) taken.add(m.name); for (const p of this.passes) taken.add(p.name);
    if (!taken.has(base)) return base;
    let i = 1; while (taken.has(`${base}${i}`)) i++; return `${base}${i}`;
  }
  /** Explorer "Scene" scope roots. */
  explorerChildren(): Node[] { return [this.root]; }
}
