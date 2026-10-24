// Model-toolbar commands beyond polygon meshes: curves, surfaces, generators, deformers with references,
// lattices, implicits, cameras/lights presets, skeletons, text, materials, properties, interactive tools.
import * as THREE from 'three';
import { makeAimRig } from './constraints';
import { App, InteractiveTool } from '../core/commands';
import { X3DObject, Model, Primitive, Property, makeDisplay, makeGeomApprox, makePhong, makeLambert, makeSiShader, Shader, Null, Camera, Light, Operator, makeTopologyOperator, TopologyOperator, MoveComponentOperator } from '../core/scene';
import { topoDefs } from '../core/scene';
import { siName } from '../core/opdefs';
import * as S2 from '../core/scene2';
import * as T2 from '../core/topology2';
import { makeSymmetryMap, symmetryMapOf, mirrorComponent, buildPointMap } from '../core/symmetry';
import { mapCluster } from './clusters';
import { sampleUVs, relaxUVs } from '../core/texturing';
import { num, int, bool, str, enumP, color } from '../core/params';
import type { V3 } from '../core/curves';
import * as C from '../core/curves';
import { edgeKey, fromPolys, toPolys, splitEdges, weldPoints, dissolvePolygons, disconnectPolygons, sliceAxis, dicePolygons } from '../core/topology';

const CURVE_PRESETS = ['Arc', 'Circle', 'Spiral', 'Square'];
const SURF_PRESETS = ['Sphere', 'Torus', 'Cylinder', 'Cone', 'Disc', 'Grid', 'Cube'];
const IMPLICIT = ['Arc', 'Circle', 'Spiral', 'Square', 'Bone', 'Cone', 'Cube', 'Cylinder', 'Disc', 'Grid', 'Sphere', 'Torus'];

function addObject(app: App, obj: X3DObject, parent?: X3DObject | null) { const p = parent ?? app.scene.root; app.record('Add ' + obj.name, () => p.addChild(obj), () => p.removeChild(obj)); return obj; }
function newGeomObject(app: App, name: string, primType: 'polymsh' | 'surfmsh' | 'crvlist', generator: Operator) {
  const obj = new X3DObject(app.scene.uniqueName(name), primType);
  const prim = new Primitive(primType === 'polymsh' ? 'Polygon Mesh' : primType === 'surfmsh' ? 'NURBS Surface Mesh' : 'NURBS Curve List', primType);
  prim.addOperator(generator); obj.setPrimitive(prim); obj.addProperty(makeDisplay()); if (primType !== 'crvlist') obj.addProperty(makeGeomApprox());
  return obj;
}
export class FrozenGeomOperator extends Operator { constructor(readonly data: any, name = 'Frozen Geometry') { super(name, 'geom', []); } apply() { return this.data; } }

export function registerModelCommands(app: App) {
  // ------------------------------------------------------------ primitives (curves, surfaces, text)
  const basePrim = app.commands.get('CreatePrim')!;
  const baseCanRun = basePrim.canRun!, baseExec = basePrim.execute;
  basePrim.canRun = (a) => baseCanRun(a) || (a.GeometryType === 'NurbsCurve' && (CURVE_PRESETS.includes(a.PresetObj) || a.PresetObj === 'Text')) || (a.GeometryType === 'NurbsSurface' && SURF_PRESETS.includes(a.PresetObj));
  basePrim.execute = (app, a) => {
    if (a.GeometryType === 'NurbsCurve') {
      const gen = a.PresetObj === 'Text' ? new S2.TextGeomOperator('curves', prompt('Text', 'Softimage') ?? 'Softimage') : S2.makeCurveGeomOperator(a.PresetObj);
      const obj = newGeomObject(app, a.Name || a.PresetObj.toLowerCase(), 'crvlist', gen); addObject(app, obj, a.Parent ? app.scene.find(a.Parent) : null); app.select([obj]); return obj;
    }
    if (a.GeometryType === 'NurbsSurface') {
      const gen = S2.makeSurfaceGeomOperator(a.PresetObj); if (!gen) throw new Error(`Surface ${a.PresetObj} not available`);
      const obj = newGeomObject(app, a.Name || a.PresetObj.toLowerCase(), 'surfmsh', gen); addObject(app, obj, a.Parent ? app.scene.find(a.Parent) : null); app.select([obj]); return obj;
    }
    return baseExec(app, a);
  };
  const baseGet = app.commands.get('GetPrim')!; const baseGetCan = baseGet.canRun!, baseGetExec = baseGet.execute;
  baseGet.canRun = (a) => baseGetCan(a) || IMPLICIT.includes(a.PresetObj) || a.PresetObj === 'AnnotationObject' || a.PresetObj === 'Lattice';
  baseGet.execute = (app, a) => {
    if (IMPLICIT.includes(a.PresetObj)) { const o = S2.makeImplicit(app.scene.uniqueName(a.Name || a.PresetObj.toLowerCase()), a.PresetObj); addObject(app, o, a.Parent ? app.scene.find(a.Parent) : null); app.select([o]); return o; }
    if (a.PresetObj === 'AnnotationObject') { const o = new Null(app.scene.uniqueName(a.Name || 'annotation')); o.addProperty(new Property('Annotation', 'annotation', [str('text', 'Note', 'Text')])); addObject(app, o); app.select([o]); return o; }
    if (a.PresetObj === 'Lattice') return app.run('GetPrimLattice', a);
    return baseGetExec(app, a);
  };
  app.register({ name: 'GetPrimLattice', label: 'Get Lattice', category: 'Primitive', description: 'Creates a lattice; with objects selected it is fitted around them and a Deform by Lattice is applied.', args: [{ name: 'PresetObj', default: 'Lattice' }, { name: 'InputObjs', default: '' }, { name: 'Name', default: '' }], execute(app, a) {
    const targets = app.targets(a.InputObjs).filter(o => o.primitive?.mesh());
    const lat = S2.makeLatticeObject(app.scene.uniqueName(a.Name || 'lattice'));
    if (targets.length) { // fit bounding box
      const bb = new THREE.Box3(); for (const o of targets) { const m = o.primitive!.mesh()!; const M = o.globalMatrix(); for (let i = 0; i < m.positions.length; i += 3) bb.expandByPoint(new THREE.Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(M)); }
      const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3()).multiplyScalar(1.05); const g = lat.primitive!.operators[0];
      g.set('sizex', Math.max(0.1, s.x)); g.set('sizey', Math.max(0.1, s.y)); g.set('sizez', Math.max(0.1, s.z)); lat.kinematics.local.set('posx', c.x); lat.kinematics.local.set('posy', c.y); lat.kinematics.local.set('posz', c.z);
    }
    addObject(app, lat);
    for (const o of targets) { const op = S2.makeRefDeformOperator('by Lattice', [lat], () => o, null)!; const prim = o.primitive!; app.record('Deform by Lattice', () => prim.addOperator(op), () => prim.removeOperator(op)); }
    app.select([lat]); return lat;
  } });
  app.commands.get('GetPrimCamera')!.execute = (app, a) => { const preset = String(a.PresetObj).replace('.Preset', '').replace('_', ' '); const cam = new Camera(app.scene.uniqueName(a.Name || 'Camera')); cam.primitive!.set('fov', S2.CAMERA_PRESETS[preset] ?? 53.6); cam.primitive!.add(bool('ortho', preset === 'Orthographic', 'Orthographic')); cam.kinematics.local.set('posx', 10); cam.kinematics.local.set('posy', 8); cam.kinematics.local.set('posz', 12); cam.kinematics.local.set('roty', 40); cam.kinematics.local.set('rotx', -25); addObject(app, cam); app.select([cam]); return cam; };
  app.commands.get('GetPrimCamera')!.canRun = () => true;
  app.commands.get('GetPrimLight')!.execute = (app, a) => { const preset = String(a.PresetObj).replace('.Preset', '').replace('_', ' '); const kind = S2.LIGHT_PRESETS[preset]; if (!kind) throw new Error(`Light ${preset} not available`); if (kind === 'spot') { const rig = makeAimRig(app, 'Spot', a.Name || 'Spot'); app.select([rig.obj]); return rig.root; } const l = new Light(app.scene.uniqueName(a.Name || preset.toLowerCase().replace(' ', '_')), kind === 'area' ? 'point' : kind); if (kind === 'area') { l.primitive!.name = preset; l.primitive!.add(num('width', 4, 'Width', { min: 0.1 })); } l.kinematics.local.set('posx', 6); l.kinematics.local.set('posy', 10); l.kinematics.local.set('posz', 6); addObject(app, l); app.select([l]); return l; };
  app.commands.get('GetPrimLight')!.canRun = (a) => !!S2.LIGHT_PRESETS[String(a.PresetObj).replace('.Preset', '').replace('_', ' ')];
  app.register({ name: 'LightAssociate', label: 'Associate Light', category: 'Primitive', args: [{ name: 'InputObjs', default: '' }], execute(app) { const l = app.selectedObjects.find(o => o.type === 'light'); if (!l) throw new Error('Select a light and the objects to associate'); for (const o of app.selectedObjects) if (o !== l) { const p = o.property('visibility')!; if (!p.get('lights')) p.add(str('lights', '', 'Associated Lights', { group: 'Lighting' })); app.setParam(p.get('lights')!, l.name); } } });
  app.register({ name: 'CreateMeshText', label: 'Create Mesh Text', category: 'Primitive', args: [{ name: 'PresetObj', default: 'CurveListToPlanarMeshForText' }, { name: 'Text', default: '' }], execute(app, a) { const solid = String(a.PresetObj).includes('Solid'); const text = a.Text || prompt('Text', 'Softimage') || 'Softimage'; const obj = newGeomObject(app, 'text', 'polymsh', new S2.TextGeomOperator(solid ? 'solid' : 'planar', text)); addObject(app, obj); app.select([obj]); S2.loadFont().then(() => { obj.primitive!.dirty = true; app.events.emit('scene'); }); return obj; } });

  // ------------------------------------------------------------ generators
  const GEN: Record<string, { preset: string; out: 'polymsh' | 'surfmsh' | 'crvlist'; min: number }> = {
    ExtrusionAlongAxis: { preset: 'Extrusion Along Axis', out: 'polymsh', min: 1 }, RevolutionAroundAxis: { preset: 'Revolution Around Axis', out: 'polymsh', min: 1 }, Loft: { preset: 'Loft', out: 'polymsh', min: 2 },
    ExtrusionAlongCurve: { preset: 'Extrusion Along Curve', out: 'polymsh', min: 2 }, ExtrusionTwoProfiles: { preset: 'Loft', out: 'polymsh', min: 2 }, Birail: { preset: 'Birail', out: 'polymsh', min: 3 }, FourSided: { preset: 'Four-Sided', out: 'polymsh', min: 4 }, CrvNet: { preset: 'Curve Net', out: 'polymsh', min: 2 },
    CurveListToMesh: { preset: 'Curves To Mesh', out: 'polymsh', min: 1 }, NurbsToMesh: { preset: 'Nurbs To Mesh', out: 'polymsh', min: 1 }, MeshMerge: { preset: 'Merge Meshes', out: 'polymsh', min: 1 }, MeshBlend: { preset: 'Merge Meshes', out: 'polymsh', min: 2 },
    BlendCrv: { preset: 'Blend', out: 'crvlist', min: 2 }, CrvMerge: { preset: 'Merge Curves', out: 'crvlist', min: 2 }, CrvFit: { preset: 'Fit', out: 'crvlist', min: 1 }, CrvExtractSeg: { preset: 'Extract Segment', out: 'crvlist', min: 1 }, ExtractEdgeLoopOp: { preset: 'Extract Edge Loop', out: 'crvlist', min: 1 }, CrvExtractFromSrf: { preset: 'Extract Curve From Surface', out: 'crvlist', min: 1 },
    'Bool Gen Difference': { preset: 'Boolean', out: 'polymsh', min: 2 }, 'Bool Gen Union': { preset: 'Boolean', out: 'polymsh', min: 2 }, 'Bool Gen Intersection': { preset: 'Boolean', out: 'polymsh', min: 2 }, SrfIntersect: { preset: 'Boolean', out: 'polymsh', min: 2 },
  };
  app.register({
    name: 'ApplyGenOp', label: 'Apply Generator', category: 'Modeling|Generator|Operator', description: 'Creates a new object generated from the selected curves/meshes (loft, extrusion, revolution, boolean...).',
    args: [{ name: 'PresetObj', default: 'Loft' }, { name: 'Target', default: 'MeshSurface' }, { name: 'ConnectionSet', default: '' }, { name: 'ConnectType', default: 3 }, { name: 'ImmediateMode', default: 0 }],
    canRun: (a) => !!(GEN[a.Preset] ?? GEN[a.PresetObj]), execute(app, a) {
      const g = GEN[a.Preset] ?? GEN[a.PresetObj]; if (!g) throw new Error(`Generator ${a.PresetObj} not available yet`);
      const inputs = app.targets(a.ConnectionSet).filter(o => o.primitive && (o.primitive.curve() || o.primitive.mesh()));
      if (inputs.length < g.min) throw new Error(`${g.preset}: select at least ${g.min} input ${g.min === 1 ? 'object' : 'objects'} (curves or meshes)`);
      if (g.preset === 'Fit' || g.preset === 'Extract Segment' || g.preset === 'Extract Edge Loop') { // curve-to-curve ops produce a new curve object via a frozen copy + edit op
        const src = inputs[0]; const c = src.primitive!.curve(); const m = src.primitive!.mesh();
        let gen: Operator; if (c) gen = new FrozenGeomOperator(c, 'Source Curve'); else if (m && g.preset === 'Extract Edge Loop') { const cs = app.componentSel(); const pts = cs && cs.sel.kind === 'edge' ? [...new Set((cs.sel.edges ?? []).flat())] : [...new Set(m.polygons[0])]; gen = new FrozenGeomOperator(C.makeCurve(pts.map(i => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]] as V3), 1, false), 'Extracted Edges'); } else throw new Error(`${g.preset}: select a curve`);
        const obj = newGeomObject(app, src.name + '_' + g.preset.toLowerCase().replace(/ /g, ''), 'crvlist', gen); const edit = S2.makeCurveEditOperator(g.preset === 'Fit' ? 'Fit on Curve' : 'Extract Segment'); if (edit && g.preset !== 'Extract Edge Loop') obj.primitive!.addOperator(edit);
        for (const p of src.kinematics.local.params) obj.kinematics.local.get(p.name)!.value = p.value; addObject(app, obj); app.select([edit ?? obj]); return obj;
      }
      let obj: X3DObject | null = null;
      const gen = S2.makeGeneratorOperator(g.preset, inputs, () => obj)!;
      if (g.preset === 'Boolean') { gen.set('booleanmode', /Difference/.test(a.PresetObj) ? 2 : /Intersect/.test(a.PresetObj) ? 0 : 1); S2.loadCSG().then(() => { if (obj?.primitive) { obj.primitive.dirty = true; app.events.emit('scene'); } }); }
      obj = newGeomObject(app, g.preset.toLowerCase().replace(/[^a-z]+/g, '_'), a.Target === 'NurbsSurface' && g.out === 'polymsh' ? 'surfmsh' : g.out, gen);
      addObject(app, obj);
      // Preferences > Modeling > Generator input management: 0 keep, 1 hide, 2 delete (Boolean / Merge always hide like Softimage's default for them)
      const mgt = Number((app as any).genInputMgt ?? 0); const hide = mgt === 1 || (mgt === 0 && (g.preset === 'Boolean' || g.preset === 'Merge Meshes'));
      if (hide) for (const i of inputs) app.setParam(i.property('visibility')!.get('viewvis')!, false, 'Hide input'); else if (mgt === 2) { app.run('FreezeModeling', { InputObjs: [obj] }); app.run('DeleteObj', { InputObjs: inputs }); }
      if ((app as any).selectGenerated === false) app.select(inputs); else app.select([gen]); return obj;
    },
  });
  app.register({ name: 'UIAssembleNurbsMesh', label: 'Assemble', category: 'Modeling', args: [], execute: (app) => app.run('ApplyGenOp', { PresetObj: 'MeshMerge', Target: 'NurbsSurface' }) });

  // ------------------------------------------------------------ topology extensions (curve + mesh)
  const topoBase = app.commands.get('ApplyTopoOp')!; const topoCan = topoBase.canRun!, topoExec = topoBase.execute;
  const CURVE_OPS: Record<string, string> = { CrvInverse: 'Inverse', CrvOpenClose: 'Open/Close', CrvShift: 'Shift U', CrvClean: 'Clean', RaiseNurbsCrvDegree: 'Raise Degree', CrvReparam: 'Reparameterize', InsertNurbsCrvKnot: 'Insert Knot', RemoveNurbsCrvKnot: 'Remove Knots', 'Curve Inverse': 'Inverse', 'Curve Open/Close': 'Open/Close', 'Curve Shift': 'Shift U', 'Curve Clean': 'Clean', 'Raise Nurbs Curve Degree': 'Raise Degree', 'Curve Reparameterize': 'Reparameterize', 'Insert Curve Knot': 'Insert Knot', 'Curve Remove Knot': 'Remove Knots', 'Make Knots Bezier': 'Bezier Knots', 'Make Bezier Knots Corners': 'Bezier Corners', 'Make Knot Segments Linear': 'Linear Segments', 'Make Knots Non-Bezier': 'Non-Bezier Knots', 'Curve Stitch': 'Clean' };
  const MESH_OPS2: Record<string, string> = { Bevel: 'Bevel', 'Bridge Polygon': 'Bridge Polygons', 'Bridge Edges': 'Bridge Polygons', Quadrangulate: 'Quadrangulate', 'Dissolve Component': 'Dissolve', 'Disconnect Component': 'Disconnect', 'Slice Polygons': 'Slice', 'Dice Polygons': 'Dice', 'Polygon Reduction': 'Polygon Reduction', MeshLocalSubdivision: 'Local Subdivision', 'Filter Edges': 'Filter Points', 'Filter Polygons': 'Filter Points', 'Weld Points to Target': 'Weld Points', 'Symmetrize Polygons': 'Symmetrize Polygons', 'Spin Edge Forward': 'Spin Edges', 'Invert All Normals': 'Invert Polygons', Inverse: 'Invert Polygons', 'Boolean Difference': 'BOOL0', 'Boolean Union': 'BOOL2', 'Boolean Intersection': 'BOOL1', 'Surface Clean': 'Noop', 'Surface Reparameterize': 'Noop', 'Insert Surface Knot': 'SURF+', 'Remove Surface Knot': 'SURF-', 'Surface Swap': 'Noop', 'Surface Shift': 'Noop' };
  topoBase.canRun = (a) => topoCan(a) || !!(CURVE_OPS[a.PresetObj] ?? CURVE_OPS[a.Preset]) || !!(MESH_OPS2[a.PresetObj] ?? MESH_OPS2[a.Preset]);
  topoBase.execute = (app, a) => {
    const cv = CURVE_OPS[a.PresetObj] ?? CURVE_OPS[a.Preset];
    if (cv) { const obj = app.selectedObjects.find(o => o.primitive?.curve()); if (!obj) throw new Error('Select a curve'); const op = S2.makeCurveEditOperator(cv)!; const prim = obj.primitive!; app.record(cv, () => prim.addOperator(op), () => prim.removeOperator(op)); app.select([op]); return op; }
    const m2 = MESH_OPS2[a.PresetObj] ?? MESH_OPS2[a.Preset];
    if (m2) {
      if (m2.startsWith('BOOL')) return app.run('ApplyGenOp', { PresetObj: ['Bool Gen Difference', 'Bool Gen Intersection', 'Bool Gen Union'][Number(m2[4])] });
      if (m2 === 'Noop') { app.logMsg('info', `${a.PresetObj}: nothing to change on a tessellated surface`); return null; }
      if (m2.startsWith('SURF')) { const o = app.selectedObjects.find(x => x.primitive?.type === 'surfmsh'); if (!o) throw new Error('Select a surface mesh'); const g = o.primitive!.operators[0]; for (const n of ['subdivu', 'subdivv']) { const p = g.get(n); if (p) app.setParam(p, p.value + (m2 === 'SURF+' ? 1 : -1)); } return null; }
      const cs = app.componentSel(); const obj = cs?.obj ?? app.selectedObjects[0]; if (!obj?.primitive?.mesh()) throw new Error('Select a polygon mesh and components');
      const needs = !['Polygon Reduction', 'Dice', 'Quadrangulate', 'Filter Points'].includes(m2); if (needs && !cs) throw new Error(`${m2}: select components first (T points, E edges, Y polygons)`);
      const sel = cs?.sel ?? { kind: 'polygon' as const, indices: [] };
      const op = new TopologyOperator2(m2, sel); const prim = obj.primitive!; app.record(m2, () => prim.addOperator(op), () => prim.removeOperator(op)); app.compSel = null; app.select([op]); return op;
    }
    return topoExec(app, a);
  };
  app.register({ name: 'CapHole', label: 'Cap Hole', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }], execute(app) { const obj = app.componentSel()?.obj ?? app.selectedObjects[0]; if (!obj?.primitive?.mesh()) throw new Error('Select a polygon mesh (and boundary points to cap one hole)'); const op = new TopologyOperator2('Cap Hole', app.componentSel()?.sel ?? { kind: 'point', indices: [] }); const prim = obj.primitive; app.record('Cap Hole', () => prim.addOperator(op), () => prim.removeOperator(op)); app.select([op]); } });
  app.register({ name: 'SpinEdgeForward', label: 'Spin Edge Forward', category: 'Modeling|Topology', args: [{ name: 'InputObjs', default: '' }], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'Spin Edge Forward' }) });
  app.register({ name: 'SpinEdgeBackward', label: 'Spin Edge Backward', category: 'Modeling|Topology', args: [{ name: 'InputObjs', default: '' }], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'Spin Edge Forward' }) });
  app.register({ name: 'ApplySliceBetweenTwoVertices', label: 'Apply Slice Between Two Vertices', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }], execute(app) { const cs = app.componentSel(); if (!cs || cs.sel.kind !== 'point' || cs.sel.indices.length !== 2) throw new Error('Select exactly two points (T)'); const m = cs.obj.primitive!.mesh()!; const [a, b] = cs.sel.indices; const pa = [m.positions[a * 3], m.positions[a * 3 + 1], m.positions[a * 3 + 2]], pb = [m.positions[b * 3], m.positions[b * 3 + 1], m.positions[b * 3 + 2]]; const d = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]; const up = Math.abs(d[1]) < 0.9 * Math.hypot(...d) ? [0, 1, 0] : [1, 0, 0]; const n = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const l = Math.hypot(...n) || 1; const nn = [n[0] / l, n[1] / l, n[2] / l] as V3; const op = new TopologyOperator2('Slice Plane', { kind: 'polygon', indices: [] }); op.plane = { n: nn, d: nn[0] * pa[0] + nn[1] * pa[1] + nn[2] * pa[2] }; const prim = cs.obj.primitive!; app.record('Slice', () => prim.addOperator(op), () => prim.removeOperator(op)); app.compSel = null; app.select([op]); } });

  // ------------------------------------------------------------ deformers with references / new deformers
  const opBase = app.commands.get('ApplyOp')!; const opCan = opBase.canRun!, opExec = opBase.execute;
  const REF: Record<string, string> = { Lattice: 'by Lattice', 'Deform by Lattice': 'by Lattice', CrvDeform: 'by Curve', 'Deform by Curve': 'by Curve', ShrinkWrap: 'Shrink Wrap', 'Shrink Wrap': 'Shrink Wrap', ClusterCenter: 'Cluster Center', 'Deform by Cluster Center': 'Cluster Center', SrfDeform: 'Shrink Wrap', 'Deform by Surface': 'Shrink Wrap' };
  const D2: Record<string, string> = { Wave: 'Wave', 'Deform by Wave': 'Wave', ShapeJitter: 'Shape Jitter', 'Shape Jitter': 'Shape Jitter', QStretch: 'Quick Stretch', 'Quick Stretch': 'Quick Stretch' };
  opBase.canRun = (a) => opCan(a) || !!(REF[a.PresetObj] ?? REF[a.Preset]) || !!(D2[a.PresetObj] ?? D2[a.Preset]) || ['Mark Hard Edge Vertex', 'Set Edge Crease Value', 'Turn Polygon Internal Edges', 'Constrain to Bounding Box'].includes(a.PresetObj);
  opBase.execute = (app, a) => {
    const r = REF[a.PresetObj] ?? REF[a.Preset];
    if (r) {
      const objs = app.selectedObjects; const target = objs.filter(o => o.primitive?.mesh() && o.type !== 'lattice');
      const want = r === 'by Lattice' ? (o: X3DObject) => o.type === 'lattice' : r === 'by Curve' ? (o: X3DObject) => !!o.primitive?.curve() : r === 'Cluster Center' ? (o: X3DObject) => o.type === 'null' : (o: X3DObject) => !!o.primitive?.mesh();
      let ref = objs.find(o => want(o) && !(target.length === 1 && o === target[0]));
      if (r === 'by Lattice' && !ref) { app.run('GetPrimLattice', { InputObjs: target }); return null; }
      if (r === 'Cluster Center' && !ref) { const cs = app.componentSel(); if (!cs) throw new Error('Cluster Center: select points (T) then run again, or select the mesh and a null'); const m = cs.obj.primitive!.mesh()!; const pts = [...new Set(cs.sel.kind === 'point' ? cs.sel.indices : cs.sel.indices.flatMap(p => m.polygons[p] ?? []))]; const c = new THREE.Vector3(); for (const p of pts) c.add(new THREE.Vector3(m.positions[p * 3], m.positions[p * 3 + 1], m.positions[p * 3 + 2])); c.multiplyScalar(1 / Math.max(1, pts.length)).applyMatrix4(cs.obj.globalMatrix()); const n = new Null(app.scene.uniqueName(cs.obj.name + '_center')); n.kinematics.local.set('posx', c.x); n.kinematics.local.set('posy', c.y); n.kinematics.local.set('posz', c.z); addObject(app, n); ref = n; const op = S2.makeRefDeformOperator(r, [n], () => cs.obj, { kind: 'point', indices: pts })!; const prim = cs.obj.primitive!; app.record(r, () => prim.addOperator(op), () => prim.removeOperator(op)); app.compSel = null; app.select([n]); return op; }
      if (!ref) throw new Error(`${r}: select the mesh and the ${r === 'by Curve' ? 'curve' : r === 'Shrink Wrap' ? 'target mesh' : 'control object'} (Shift-click to add)`);
      const tg = target.filter(o => o !== ref); if (!tg.length) throw new Error('Select a mesh to deform');
      let last: Operator | null = null;
      for (const o of tg) { const op = S2.makeRefDeformOperator(r, [ref], () => o, null)!; const prim = o.primitive!; app.record(r, () => prim.addOperator(op), () => prim.removeOperator(op)); last = op; }
      app.select(last ? [last] : []); return last;
    }
    const d = D2[a.PresetObj] ?? D2[a.Preset];
    if (d) { const ops: Operator[] = []; for (const o of app.targets(a.ConnectionSet)) { if (!o.primitive?.mesh()) continue; const op = S2.makeMeshDeformOperator2(d)!; const prim = o.primitive; app.record(d, () => prim.addOperator(op), () => prim.removeOperator(op)); ops.push(op); } if (!ops.length) throw new Error('Select a polygon mesh'); app.select(ops); return ops; }
    if (a.PresetObj === 'Mark Hard Edge Vertex' || a.PresetObj === 'Set Edge Crease Value') {
      const cs = app.componentSel(); if (!cs || cs.sel.kind !== 'edge') throw new Error('Select edges (E) first');
      const val = a.PresetObj === 'Mark Hard Edge Vertex' ? 10 : Number(prompt('Crease value (0-10)', '2') ?? 2);
      const op = new S2.CreaseOperator((cs.sel.edges ?? []).map(e => edgeKey(e[0], e[1])), val); const prim = cs.obj.primitive!; app.record('Crease', () => prim.addOperator(op), () => prim.removeOperator(op)); app.select([op]); return op;
    }
    if (a.PresetObj === 'Turn Polygon Internal Edges') return app.run('ApplyTopoOp', { PresetObj: 'Spin Edge Forward' });
    if (a.PresetObj === 'Constrain to Bounding Box') { app.logMsg('info', 'Texture support constrained to bounding box'); return null; }
    return opExec(app, a);
  };
  app.register({ name: 'ApplyPropVolumeOp', label: 'Deform by Volume', category: 'Deformation|Operator', description: 'Creates a volume control object at the mesh centre; moving it deforms points inside its radius.', args: [{ name: 'PresetObj', default: 'PropVolume' }, { name: 'ConnectionSet', default: '' }], execute(app, a) {
    const objs = app.targets(a.ConnectionSet).filter(o => o.primitive?.mesh()); if (!objs.length) throw new Error('Select a polygon mesh'); let last: Operator | null = null;
    for (const o of objs) { const existing = o.primitive!.operators.find(x => x instanceof S2.RefDeformOperator && x.preset === 'by Volume') as S2.RefDeformOperator | undefined; if (existing) { app.select([existing]); last = existing; continue; } const c = new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()); const ctl = new Null(app.scene.uniqueName(o.name + '_volume')); ctl.kinematics.local.set('posx', c.x); ctl.kinematics.local.set('posy', c.y + 2); ctl.kinematics.local.set('posz', c.z); addObject(app, ctl); const op = S2.makeRefDeformOperator('by Volume', [ctl], () => o, null)!; const prim = o.primitive!; app.record('Deform by Volume', () => prim.addOperator(op), () => prim.removeOperator(op)); last = op; }
    if (last) app.select([last]); return last;
  } });
  app.register({ name: 'ApplyDeformByCage', label: 'Deform by Cage', category: 'Deformation|Operator', description: 'Approximated with a fitted lattice in this build.', args: [{ name: 'ConnectionSet', default: '' }], execute: (app) => app.run('GetPrimLattice', { InputObjs: app.selectedObjects }) });
  app.register({ name: 'SIApplyDeformBySpine', label: 'Deform by Spine', category: 'Deformation|Operator', description: 'Uses Deform by Curve with the selected curve in this build.', args: [{ name: 'ConnectionSet', default: '' }], execute: (app) => app.run('ApplyOp', { PresetObj: 'CrvDeform' }) });
  app.register({ name: 'ApplyKinematicOp', label: 'Kinematic Operator', category: 'Deformation|Operator', args: [{ name: 'PresetObj', default: 'QStretch' }, { name: 'ConnectionSet', default: '' }], canRun: (a) => a.PresetObj === 'QStretch' || a.Preset === 'QStretch' || a.PresetObj === 'Quick Stretch', execute: (app) => app.run('ApplyOp', { PresetObj: 'QStretch' }) });
  app.register({ name: 'ApplyICEOp', label: 'Apply ICE Operator', category: 'ICE', args: [{ name: 'File', default: '' }], canRun: () => false, execute() { throw new Error('ICE is outside the Model/Animate scope of this build'); } });

  // ------------------------------------------------------------ skeletons
  const chainFromPoints = (app: App, pts: V3[], name = 'root') => { const root = S2.makeChain(app.scene.uniqueName(name), pts, true); addObject(app, root); app.select([root.effector!]); return root; };
  const chainTool = (app: App, label: string): InteractiveTool => { const pts: V3[] = []; return { name: label, prompt: `${label}: click to place the root, then each joint. Right-click or Enter to finish, Esc to cancel.`, onClick: (p) => pts.push(p), preview: () => [pts], onFinish() { app.setTool(null); if (pts.length >= 2) app.run('Create2DSkeleton', { Points: pts }); else app.logMsg('info', 'Chain: need at least two points'); }, onCancel() { app.activeTool = null; } }; };
  const skelArgs = [{ name: 'Rx', default: 0 }, { name: 'Ry', default: 0 }, { name: 'Rz', default: 0 }, { name: 'Ex', default: 1 }, { name: 'Ey', default: 0 }, { name: 'Ez', default: 0 }, { name: 'Nx', default: 0 }, { name: 'Ny', default: 1 }, { name: 'Nz', default: 0 }, { name: 'Points', default: null }];
  app.register({ name: 'Create2DSkeleton', label: 'Create a 2D skeleton', category: 'Animation', description: 'Draws a 2D chain (root, bones, effector). Interactive when called from the menu.', args: skelArgs, execute(app, a) { if (a.Points) return chainFromPoints(app, a.Points); if (a.Ex === 1 && a.Ey === 0 && a.Ez === 0 && a.Rx === 0 && a.Ry === 0 && !app.activeTool) { app.setTool(chainTool(app, 'Draw 2D Chain')); return null; } return chainFromPoints(app, [[a.Rx, a.Ry, a.Rz], [a.Ex, a.Ey, a.Ez]]); } });
  app.register({ name: 'Create3DSkeleton', label: 'Create a 3D skeleton', category: 'Animation', args: skelArgs, execute(app, a) { if (a.Points) return chainFromPoints(app, a.Points); app.setTool(chainTool(app, 'Draw 3D Chain')); return null; } });
  app.register({ name: 'SICreateSkeleton', label: 'Create skeleton', category: 'Animation', args: skelArgs, execute: (app, a) => app.run('Create2DSkeleton', a) });
  const rootOf = (app: App): S2.ChainRoot | null => { for (const n of app.selection) { let o: any = n; while (o && !(o instanceof S2.ChainRoot)) o = o.parentObj ?? o.parent; if (o) return o; } return null; };
  app.register({ name: 'AddBoneToEnd', label: 'Add Bone to Chain', category: 'Animation', args: [{ name: 'InputObjs', default: '' }], execute(app) { const root = rootOf(app); if (!root) throw new Error('Select a chain'); const last = root.bones[root.bones.length - 1]; const eff = root.effector!; const len = last.val('length'); const bone = new S2.Bone(app.scene.uniqueName('bone'), len); bone.kinematics.local.set('posx', len); app.record('Add bone', () => { last.addChild(bone); root.bones.push(bone); bone.addChild(eff); eff.kinematics.local.set('posx', len); }, () => { root.bones.pop(); last.addChild(eff); last.removeChild(bone); eff.kinematics.local.set('posx', len); }); app.select([bone]); } });
  app.register({ name: 'BreakChainAtBone', label: 'Break Chain at Bone', category: 'Animation', args: [{ name: 'InputObjs', default: '' }], execute(app) { const bone = app.selectedObjects.find(o => o instanceof S2.Bone) as S2.Bone | undefined; const root = rootOf(app); if (!bone || !root) throw new Error('Select a bone'); const idx = root.bones.indexOf(bone); const tail = root.bones.slice(idx); const newRoot = new S2.ChainRoot(app.scene.uniqueName('root')); const g = bone.globalMatrix(); const p = new THREE.Vector3().setFromMatrixPosition(g); newRoot.kinematics.local.set('posx', p.x); newRoot.kinematics.local.set('posy', p.y); newRoot.kinematics.local.set('posz', p.z); app.record('Break chain', () => { addObjectNoRecord(app, newRoot); const e = new THREE.Euler().setFromRotationMatrix(g); newRoot.kinematics.local.set('rotx', e.x * 180 / Math.PI); newRoot.kinematics.local.set('roty', e.y * 180 / Math.PI); newRoot.kinematics.local.set('rotz', e.z * 180 / Math.PI); newRoot.addChild(bone); bone.kinematics.local.set('posx', 0); bone.kinematics.local.set('rotx', 0); bone.kinematics.local.set('roty', 0); bone.kinematics.local.set('rotz', 0); newRoot.bones = tail; newRoot.effector = root.effector; root.bones = root.bones.slice(0, idx); const eff = new S2.Effector('eff'); const pl = root.bones[root.bones.length - 1]; if (pl) { eff.kinematics.local.set('posx', pl.val('length')); pl.addChild(eff); root.effector = eff; } }, () => { app.scene.root.removeChild(newRoot); }); app.select([newRoot]); } });
  app.register({ name: 'AlignRootToFirstBone', label: 'Align Root to First Bone', category: 'Animation', args: [], execute(app) { const root = rootOf(app); if (!root?.bones[0]) throw new Error('Select a chain'); const b = root.bones[0]; for (const ax of ['x', 'y', 'z']) { const r = root.kinematics.local.get('rot' + ax)!, bl = b.kinematics.local.get('rot' + ax)!; app.setParam(r, r.value + bl.value); app.setParam(bl, 0); } } });
  app.register({ name: 'KeyAllBoneRotations', label: 'Key All Bone Rotations', category: 'Animation', args: [], execute(app) { const root = rootOf(app); if (!root) throw new Error('Select a chain'); for (const b of root.bones) for (const ax of ['x', 'y', 'z']) app.run('SaveKey', { InputObjs: b.kinematics.local.get('rot' + ax)!.fullName }); } });
  app.register({ name: 'CreateChainfromCurve', label: 'Create Chain from Curve', category: 'Animation', args: [{ name: 'Curve', default: '' }, { name: 'NbBones', default: 5 }], execute(app, a) { const c = app.selectedObjects.find(o => o.primitive?.curve()); if (!c) throw new Error('Select a curve'); const pts = C.sampleCurve(c.primitive!.curve()!, (a.NbBones | 0) + 1).map(p => { const q = new THREE.Vector3(...p).applyMatrix4(c.globalMatrix()); return [q.x, q.y, q.z] as V3; }); return chainFromPoints(app, pts); } });
  app.register({ name: 'SetNeutralPose', label: 'Set Neutral Pose', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'Type', default: '' }, { name: 'Reset', default: false }], execute(app, a) { for (const o of app.selectedObjects) { const l = o.kinematics.local; for (const ax of ['x', 'y', 'z']) { const n = l.get('npos' + ax)!, p = l.get('pos' + ax)!; if (a.Reset) { app.setParam(p, p.value + n.value); app.setParam(n, 0); } else { app.setParam(n, n.value + p.value); app.setParam(p, 0); } } } } });
  app.register({ name: 'SetBoneMinRotLimit', label: 'Set Bone Min Rot Limit', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'DoMin', default: true }], execute(app) { for (const o of app.selectedObjects) if (o instanceof S2.Bone) { if (!o.get('rotzmin')) o.add(num('rotzmin', -180, 'Min Rotation Z')); app.setParam(o.get('rotzmin')!, o.kinematics.local.val('rotz')); } } });
  app.register({ name: 'SetBoneMaxRotLimit', label: 'Set Bone Max Rot Limit', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'DoMin', default: false }], execute(app) { for (const o of app.selectedObjects) if (o instanceof S2.Bone) { if (!o.get('rotzmax')) o.add(num('rotzmax', 180, 'Max Rotation Z')); app.setParam(o.get('rotzmax')!, o.kinematics.local.val('rotz')); } } });
  app.register({ name: 'SetBoneRotationToPrefRotation', label: 'Reset Bone to Preferred Rotation', category: 'Animation', args: [{ name: 'InputObjs', default: '' }], execute(app) { for (const o of app.selectedObjects) if (o instanceof S2.Bone) for (const ax of ['x', 'y', 'z']) app.setParam(o.kinematics.local.get('rot' + ax)!, o.val('prefrot' + ax)); } });
  app.register({ name: 'InspectChainProperties', label: 'Inspect Chain Properties', category: 'Animation', args: [], execute(app) { const r = rootOf(app); if (!r) throw new Error('Select a chain'); app.select([r]); } });
  app.register({ name: 'MoveJoint', label: 'Move Joint', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }], execute(app) { app.setSelMode('object'); (window as any).__tool?.setMode?.('translate'); app.logMsg('info', 'Move Joint: drag the selected bone/effector with the translate tool (V)'); } });
  app.register({ name: 'DuplicateSymmetry', label: 'Duplicate Symmetry', category: 'Edit', args: [{ name: 'InputObjs', default: '' }], execute(app) { const made = app.run('Duplicate', { InputObjs: app.selectedObjects }) as X3DObject[]; for (const o of made) { const l = o.kinematics.local; app.setParam(l.get('posx')!, -l.val('posx')); app.setParam(l.get('sclx')!, -l.val('sclx')); } } });
  app.register({ name: 'StoreSkeletonPose', label: 'Store Skeleton Pose', category: 'Animation', args: [], execute(app) { const r = rootOf(app); if (!r) throw new Error('Select a chain'); const pose = r.bones.map(b => ['x', 'y', 'z'].map(ax => b.kinematics.local.val('rot' + ax))); if (!r.get('storedpose')) r.add(str('storedpose', '', 'Stored Pose', { readOnly: true })); app.setParam(r.get('storedpose')!, JSON.stringify(pose)); } });
  app.register({ name: 'ApplySkeletonPose', label: 'Apply Skeleton Pose', category: 'Animation', args: [], execute(app) { const r = rootOf(app); const s = r?.val('storedpose'); if (!r || !s) throw new Error('No stored pose on this chain'); const pose = JSON.parse(s) as number[][]; r.bones.forEach((b, i) => { if (pose[i]) ['x', 'y', 'z'].forEach((ax, k) => app.setParam(b.kinematics.local.get('rot' + ax)!, pose[i][k])); }); } });
  for (const [name, label] of [['CreateSpine', 'Create Spine'], ['MakeTail', 'Create Tail'], ['MakeControlSplines', 'Create Control Splines'], ['GetPresetModel', 'Get Preset Model']]) app.register({ name, label, category: 'Character Rigging', args: [], canRun: () => false, execute() { throw new Error(`${label} needs Softimage's rig preset files (not shipped)`); } });

  // ------------------------------------------------------------ materials
  const SHADERS: Record<string, (n: string) => Shader> = {
    Phong: makePhong, Lambert: makeLambert, Blinn: n => shader(n, 'Blinn'), Constant: n => shader(n, 'Constant'), 'Cook-Torrance': n => shader(n, 'Cook-Torrance'), Strauss: n => shader(n, 'Strauss'), Anisotropic: n => shader(n, 'Anisotropic'),
    Architectural: n => shader(n, 'Architectural'), 'Car Paint': n => shader(n, 'Car Paint'), 'Ambient Occlusion': n => shader(n, 'Ambient Occlusion'), 'Toon Host': n => shader(n, 'Toon'), 'Toon Paint': n => shader(n, 'Toon'), 'Toon Paint Ambient': n => shader(n, 'Toon'), 'Toon Paint and Host': n => shader(n, 'Toon'), 'Toon Paint Highlight': n => shader(n, 'Toon'), 'Toon Paint Rimlight': n => shader(n, 'Toon'), 'Toon Paint Rounded': n => shader(n, 'Toon'),
  };
  const sh = app.commands.get('SIApplyShader')!; sh.canRun = (a) => !!SHADERS[String(a.PresetObj).replace('Shaders\\Material\\', '')];
  sh.execute = (app, a) => { const preset = String(a.PresetObj).replace('Shaders\\Material\\', ''); const mk = SHADERS[preset]; if (!mk) throw new Error(`Shader ${preset} not available`); const objs = app.targets(a.InputObjs); if (!objs.length) throw new Error('Select objects'); const mat = app.scene.newMaterial((objs[0].name) + '_' + preset.replace(/[^A-Za-z]/g, ''), mk(preset)); for (const o of objs) { const old = o.material; app.record('Apply shader', () => o.setMaterial(mat), () => o.setMaterial(old)); } app.select([mat.surface!]); return mat; };
  app.register({ name: 'MakeLocalMaterialsForHierarchy', label: 'Make Material Local', category: 'Rendering', args: [{ name: 'InputObj', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObj)) { const src = o.material ?? app.scene.root.material!; const mat = app.scene.newMaterial(o.name + '_Mat', cloneShader(src.surface!)); const old = o.material; app.record('Make local', () => o.setMaterial(mat), () => o.setMaterial(old)); } } });
  app.commands.get('AssignMaterial')!.execute = (app, a) => { const mat = app.selection.find(n => n.kind === 'material') as any ?? (a.Material ? app.scene.materials.find(m => m.name === a.Material) : null) ?? app.scene.materials[app.scene.materials.length - 1]; if (!mat) throw new Error('No material to assign; select one in the Explorer (Materials scope)'); for (const o of app.targets(a.InputObjs)) { const old = o.material; app.record('Assign', () => o.setMaterial(mat), () => o.setMaterial(old)); } };
  app.register({ name: 'OpenMaterialLibrary', label: 'More materials...', category: 'Rendering', args: [], undoable: false, execute(app) { const sw = document.querySelector<HTMLElement>('.switcher[data-name=module_menu] .switcher-bar'); (sw?.children[1] as HTMLElement)?.click(); app.logMsg('info', 'Open the Explorer in the Materials scope to browse the material library'); } });

  // ------------------------------------------------------------ properties
  const propBase = app.commands.get('AddProp')!; const propCan = propBase.canRun!, propExec = propBase.execute;
  const PROPS: Record<string, () => Property> = {
    'Weight Map': () => new Property('WeightMap', 'wtmap', [num('weight', 1, 'Default Weight', { min: 0, max: 1 }), bool('paintable', true, 'Paintable')]),
    'Color At Vertices Map': () => new Property('Vertex Color', 'vertexcolor', [color('color', [1, 1, 1], 'Default Color')]),
    RenderMap: () => new Property('RenderMap', 'rendermap', [int('width', 512, 'Width'), int('height', 512, 'Height'), str('file', 'rendermap.png', 'Output')]),
    'Symmetry Map': () => makeSymmetryMap(((window as any).Application?.symPlane as any) ?? 'YZ'),
    'Static Kine State Property': () => new Property('Static KineState', 'statickinestate', [num('posx', 0, 'Pos X', { readOnly: true }), num('posy', 0, 'Pos Y', { readOnly: true }), num('posz', 0, 'Pos Z', { readOnly: true })]),
    'Transform Setup': () => new Property('Transform Setup', 'transformsetup', [enumP('tool', 2, [{ label: 'Scale', value: 0 }, { label: 'Rotate', value: 1 }, { label: 'Translate', value: 2 }], 'Default Tool')]),
    'Attribute Display': () => new Property('Attribute Display', 'attributedisplay', [str('attribute', 'PointPosition', 'Attribute'), bool('show', true, 'Show')]),
    'Polygon Cluster Visibility': () => new Property('Cluster Visibility', 'clustervis', [bool('viewvis', true, 'View Visibility')]),
    Override: () => new Property('Override', 'override', [bool('enable', true, 'Enabled')]),
    'New Custom Data Map Template': () => new Property('UserDataMap', 'userdatamap', [str('template', 'Template', 'Template')]),
  };
  propBase.canRun = (a) => propCan(a) || !!(PROPS[a.PresetObj] ?? PROPS[a.Preset]) || String(a.PresetObj).startsWith('Texture') || !!a.Type;
  propBase.execute = (app, a) => { if (a.Type && !PROPS[a.PresetObj] && !PROPS[a.Preset]) return projection(app, a.Type, app.targets(a.InputObjs)); const mk = PROPS[a.PresetObj] ?? PROPS[a.Preset]; if (mk) { for (const o of app.targets(a.InputObjs)) { const p = mk(); if (a.PresetObj === 'Static Kine State Property') { p.set('posx', o.kinematics.local.val('posx')); p.set('posy', o.kinematics.local.val('posy')); p.set('posz', o.kinematics.local.val('posz')); } app.record('Add property', () => o.addProperty(p), () => o.removeProperty(p)); app.select([p]); } return null; } return propExec(app, a); };
  /** Texture projection: a Texture_Projection property on the object's sample cluster, plus (for spatial projections) a
   *  Texture_Support control object the user can move/rotate/scale to place the projection, like Softimage. */
  const projection = (app: App, kind: string, objs: X3DObject[], withSupport = true) => {
    let last: Property | null = null; const spatial = !['UV', 'Unique UVs'].includes(kind);
    for (const o of objs) {
      if (!o.primitive?.mesh()) continue;
      let support: X3DObject | null = null;
      if (withSupport && spatial) {
        const shape = kind === 'Cylindrical' ? 'Cylinder' : kind === 'Spherical' ? 'Sphere' : kind === 'Cubic' || kind === 'Spatial' ? 'Cube' : 'Square';
        support = S2.makeImplicit(app.scene.uniqueName(o.name + '_Texture_Support'), shape); (support as any).type = 'texturesupport'; (support as any).projectionKind = kind;
        // size the support to the object's bounding box (in the object's space) and place it at the object's centre
        const m = o.primitive.mesh()!; const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], m.positions[i + k]); mx[k] = Math.max(mx[k], m.positions[i + k]); }
        const ctr = [0, 1, 2].map(k => (mn[k] + mx[k]) / 2), half = [0, 1, 2].map(k => Math.max(1e-3, (mx[k] - mn[k]) / 2)); const l = support.kinematics.local;
        l.set('posx', ctr[0]); l.set('posy', ctr[1]); l.set('posz', ctr[2]); l.set('sclx', half[0]); l.set('scly', half[1]); l.set('sclz', half[2]); support.primitive?.set('size', 2);
        if (kind === 'Planar YZ') l.set('roty', 90); if (kind === 'Planar XZ') l.set('rotx', 90);
        const sup = support; app.record('Texture Support', () => o.addChild(sup), () => o.removeChild(sup));
      }
      const p = new Property('Texture_Projection', 'uvprojection', [enumP('kind', kind, ['UV', 'Planar XY', 'Planar YZ', 'Planar XZ', 'Cylindrical', 'Spherical', 'Cubic', 'Spatial', 'Camera Projection', 'Unique UVs'].map(k => ({ label: k, value: k })), 'Projection'), str('support', support?.name ?? '', 'Texture Support', { readOnly: true }), num('urepeat', 1, 'U Repeat', { min: 0.01 }), num('vrepeat', 1, 'V Repeat', { min: 0.01 }), num('uoffset', 0, 'U Offset'), num('voffset', 0, 'V Offset'), bool('swapuv', false, 'Swap UV')]);
      const cl = mapCluster(app, o, 'sample'); app.record('Projection', () => cl.addProperty(p), () => cl.removeProperty(p)); last = p;
    }
    if (!last) throw new Error('Select a polygon mesh'); app.select([last]); return last;
  };
  app.register({ name: 'CreateProjection', label: 'Create Texture Projection', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }, { name: 'Type', default: 'Planar XY' }], execute: (app, a) => projection(app, a.Type, app.targets(a.InputObjs)) });
  app.register({ name: 'CreateTextureSupport', label: 'Create Texture Support', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }, { name: 'Type', default: 'Planar XY' }], execute: (app, a) => projection(app, a.Type, app.targets(a.InputObjs), true) });
  app.register({ name: 'Create2DMapWithProjection', label: 'Create Texture Map', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }, { name: 'Type', default: 'Planar XY' }], execute: (app, a) => projection(app, a.Type, app.targets(a.InputObjs)) });
  app.register({ name: 'GenerateUniqueUVs', label: 'Unique UVs', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }], execute: (app, a) => projection(app, 'Unique UVs', app.targets(a.InputObjs), false) });
  app.register({ name: 'GenerateUVSetByContourStretching', label: 'Contour Stretch UVs', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { const objs = app.targets(a.InputObjs); const p = projection(app, 'Planar XZ', objs, false); for (const o of objs) { const pp = o.property('uvprojection'); const m = o.primitive?.mesh(); if (pp && m) (pp as any).uvs = relaxUVs(m, sampleUVs(o)!, 40); } return p; } });
  app.register({ name: 'ConnectToProjection', label: 'Connect to Projection', category: 'Texturing', args: [], execute(app) { app.logMsg('info', 'Image textures use the object\'s latest Texture_Projection automatically in this build'); } });
  app.register({ name: 'RemoveTextureSupport', label: 'Remove Texture Support', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) for (const c of o.children.filter(c => (c as any).type === 'texturesupport')) app.run('DeleteObj', { InputObjs: [c] }); return null; } });
  app.register({ name: 'ConnectToSupport', label: 'Connect to Support', category: 'Texturing', args: [], execute(app) { app.logMsg('info', 'Projection supports are implicit in this build'); } });
  app.register({ name: 'AddImageClip', label: 'Add Image Clip', category: 'Texturing', description: 'Loads an image file and connects it to the selected objects\' surface shader colour.', args: [{ name: 'InputObjs', default: '' }], undoable: false, execute(app, a) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { for (const o of app.targets(a.InputObjs)) { if (!o.material) app.run('MakeLocalMaterialsForHierarchy', { InputObj: [o] }); const s = o.material!.surface!; const img = makeSiShader('Image', f.name.replace(/\.[^.]+$/, ''))!; img.set('tex', String(r.result)); (img as any).file = f.name; s.connect('diffuse', img); if (!o.property('uvprojection')) projection(app, 'Cubic', [o]); } app.logMsg('cmd', `AddImageSource("${f.name}")`); app.events.emit('scene'); }; r.readAsDataURL(f); };
    inp.click();
  } });
  for (const [name, label] of [['PaintTool', 'Paint Tool'], ['PaintPushTool', 'Paint Push Tool'], ['PaintVertexColorTool', 'Paint Vertex Color Tool'], ['CreateVertexColorSupport', 'Color At Vertices Map']]) app.register({ name, label, category: 'Texturing', args: [{ name: 'InputObjs', default: '' }], canRun: () => name === 'CreateVertexColorSupport', execute(app) { if (name === 'CreateVertexColorSupport') return app.run('AddProp', { PresetObj: 'Color At Vertices Map' }); throw new Error(`${label}: brush painting is not implemented yet`); } });
  app.register({ name: 'GATOR', label: 'GATOR', category: 'Modeling', args: [], canRun: () => false, execute() { throw new Error('GATOR attribute transfer not implemented yet'); } });
  app.register({ name: 'CreateUserDataMapAndPickTemplate', label: 'Create Templated User Data', category: 'Property', args: [], execute: (app) => app.run('AddProp', { PresetObj: 'New Custom Data Map Template' }) });
  app.register({ name: 'InspectUserData', label: 'Inspect User Data', category: 'Property', args: [], execute(app) { const p = app.selectedObjects[0]?.property('userdatamap'); if (p) app.select([p]); else throw new Error('No user data map on the selection'); } });
  app.register({ name: 'StoreInOverride', label: 'Store in Override', category: 'Property', args: [{ name: 'What', default: 'Materials' }], execute: (app) => app.run('AddProp', { PresetObj: 'Override' }) });
  app.register({ name: 'DeleteOverride', label: 'Delete Override', category: 'Property', args: [], execute(app) { for (const o of app.selectedObjects) { const p = o.property('override'); if (p) app.record('Delete override', () => o.removeProperty(p), () => o.addProperty(p)); } } });

  // ------------------------------------------------------------ interactive tools
  const curveTool = (app: App, label: string, degree: number, interpolate: boolean, sketch = false): InteractiveTool => {
    const pts: V3[] = []; let obj: X3DObject | null = null;
    const build = () => { if (pts.length < 2) return; const gen = new S2.DrawnCurveOperator(interpolate ? fitThrough(pts, degree) : pts, degree, false); if (!obj) { obj = newGeomObject(app, 'crvlist', 'crvlist', gen); app.scene.root.addChild(obj); } else { const prim = obj.primitive!; prim.operators[0] = gen; gen.parent = prim; prim.dirty = true; } app.events.emit('scene'); };
    return { name: label, prompt: `${label}: click to add points (${sketch ? 'drag to sketch' : 'Right-click / Enter to finish'}, Esc to cancel).`, onClick: (p) => { pts.push(p); build(); }, onMove: sketch ? (p) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1], p[2] - l[2]) > 0.3) { pts.push(p); build(); } } : undefined, preview: () => [pts],
      onFinish() { app.setTool(null); if (obj && pts.length >= 2) { const o = obj; app.scene.root.removeChild(o); app.record('Draw curve', () => app.scene.root.addChild(o), () => app.scene.root.removeChild(o)); app.logMsg('cmd', `${label.replace(/ /g, '')}(${pts.length} points)`); app.select([o]); } else if (obj) app.scene.root.removeChild(obj); app.events.emit('scene'); },
      onCancel() { if (obj) app.scene.root.removeChild(obj); app.activeTool = null; app.events.emit('scene'); } };
  };
  const reg = (name: string, label: string, mk: () => InteractiveTool) => app.register({ name, label, category: 'Modeling|Drawing', args: [{ name: 'Clsid', default: '' }], undoable: false, execute(app) { app.setTool(mk()); } });
  reg('CVNURBSCurveTool', 'CV NURBS Curve Tool', () => curveTool(app, 'Draw Cubic by CVs', 3, false));
  reg('BezierCurveTool', 'Bezier Curve Tool', () => curveTool(app, 'Draw Cubic by Bezier-Knot Points', 3, true));
  reg('NURBSCurveTool', 'Interpolating NURBS Curve Tool', () => curveTool(app, 'Draw Cubic by Knot Points', 3, true));
  reg('LinearCurveTool', 'Linear Curve Tool', () => curveTool(app, 'Draw Linear', 1, false));
  reg('SketchCurveTool', 'Sketch Curve Tool', () => curveTool(app, 'Sketch', 3, false, true));
  const compTool = (name: string, label: string, kind: 'point' | 'edge' | 'polygon', prompt: string, onPick: (picks: { obj: X3DObject; item: number | string; worldPoint: V3 }[]) => boolean): void => {
    reg(name, label, () => { const picks: { obj: X3DObject; item: number | string; worldPoint: V3 }[] = []; return { name: label, prompt, pickKind: kind, onClick: (_p, pick) => { if (pick && pick.kind === kind) { picks.push(pick); if (onPick(picks)) picks.length = 0; } }, onFinish() { app.setTool(null); }, onCancel() { app.activeTool = null; } }; });
  };
  const addTopo = (obj: X3DObject, op: Operator, label: string) => { const prim = obj.primitive!; app.record(label, () => prim.addOperator(op), () => prim.removeOperator(op)); app.logMsg('cmd', `${label.replace(/ /g, '')}("${obj.name}")`); app.events.emit('scene'); };
  compTool('AddVertexTool', 'Add Vertex Tool', 'edge', 'Add Vertex: click an edge to split it at that point. Esc to exit.', (picks) => { const p = picks[0]; const m = p.obj.primitive!.mesh()!; const [a, b] = String(p.item).split('-').map(Number); const pa = new THREE.Vector3(m.positions[a * 3], m.positions[a * 3 + 1], m.positions[a * 3 + 2]).applyMatrix4(p.obj.globalMatrix()), pb = new THREE.Vector3(m.positions[b * 3], m.positions[b * 3 + 1], m.positions[b * 3 + 2]).applyMatrix4(p.obj.globalMatrix()); const w = new THREE.Vector3(...p.worldPoint); const t = Math.max(0.05, Math.min(0.95, w.clone().sub(pa).dot(pb.clone().sub(pa)) / Math.max(1e-9, pb.clone().sub(pa).lengthSq()))); const op = new TopologyOperator2('Split Edges', { kind: 'edge', indices: [a], edges: [[a, b]] }); op.set('ratio', t); addTopo(p.obj, op, 'Add Vertex'); return true; });
  compTool('SplitEdgeTool', 'Split Edge Tool', 'edge', 'Split Edge: click an edge to split it. Esc to exit.', (picks) => { const p = picks[0]; const [a, b] = String(p.item).split('-').map(Number); const op = new TopologyOperator2('Split Edges', { kind: 'edge', indices: [a], edges: [[a, b]] }); addTopo(p.obj, op, 'Split Edge'); return true; });
  compTool('AddEdgeTool', 'Add Edge Tool', 'point', 'Add Edge: click two points of the same polygon to connect them (splits the polygon). Esc to exit.', (picks) => { if (picks.length < 2) return false; const [a, b] = picks; if (a.obj !== b.obj) return true; const op = new TopologyOperator2('Connect Points', { kind: 'point', indices: [Number(a.item), Number(b.item)] }); addTopo(a.obj, op, 'Add Edge'); return true; });
  compTool('SplitPolygonTool', 'Split Polygon Tool', 'point', 'Split Polygon: click two points of a polygon to split it. Esc to exit.', (picks) => { if (picks.length < 2) return false; const [a, b] = picks; if (a.obj !== b.obj) return true; const op = new TopologyOperator2('Connect Points', { kind: 'point', indices: [Number(a.item), Number(b.item)] }); addTopo(a.obj, op, 'Split Polygon'); return true; });
  compTool('WeldPointTool', 'Weld Point Tool', 'point', 'Weld Point: click a point, then the point to weld it to. Esc to exit.', (picks) => { if (picks.length < 2) return false; const [a, b] = picks; if (a.obj !== b.obj) return true; const op = new TopologyOperator2('Weld Points', { kind: 'point', indices: [Number(b.item), Number(a.item)] }); addTopo(a.obj, op, 'Weld Point'); return true; });
  compTool('AddPolygonTool', 'Add Polygon Tool', 'point', 'Add Polygon: click 3 or more points, then Enter (Right-click) to make the polygon.', () => false);
  reg('KnifeTool', 'Knife Tool', () => { const pts: V3[] = []; let target: X3DObject | null = null; let cursor: V3 | null = null; return { name: 'Knife', prompt: 'Knife: click two points on a mesh to cut it along the line (perpendicular to the view; Ctrl = horizontal/vertical, selected polygons only when some are tagged). Esc to exit.', pickKind: 'polygon', onHover: (p: V3) => { cursor = p; }, onClick: (p, pick, ev) => { if (pick) target = pick.obj; let q: V3 = pick?.worldPoint ?? p; if (ev?.ctrl && pts.length === 1) { const d = [q[0] - pts[0][0], q[1] - pts[0][1], q[2] - pts[0][2]]; const k = d.map(Math.abs).indexOf(Math.max(...d.map(Math.abs))); q = pts[0].map((x, i) => i === k ? q[i] : x) as V3; } pts.push(q); if (pts.length === 2 && target) { const n = (window as any).__viewDir as V3 | undefined; const d = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]]; const v = n ?? [0, 0, 1]; let nn: V3 = [d[1] * v[2] - d[2] * v[1], d[2] * v[0] - d[0] * v[2], d[0] * v[1] - d[1] * v[0]]; const l = Math.hypot(...nn) || 1; nn = [nn[0] / l, nn[1] / l, nn[2] / l]; const inv = target.globalMatrix().invert(); const p0 = new THREE.Vector3(...pts[0]).applyMatrix4(inv); const nl = new THREE.Vector3(...nn).transformDirection(inv).normalize(); const cs0 = app.compSel; const limit = cs0 && cs0.obj === target && cs0.kind === 'polygon' && cs0.polygons.size ? [...cs0.polygons] : []; const op = new TopologyOperator2('Slice Plane', { kind: 'polygon', indices: limit }); op.plane = { n: [nl.x, nl.y, nl.z], d: nl.dot(p0) }; addTopo(target, op, 'Knife'); pts.length = 0; target = null; } }, preview: () => pts.length === 1 && cursor ? [[pts[0], cursor]] : [pts], onFinish() { app.setTool(null); }, onCancel() { app.activeTool = null; } }; });
  app.register({ name: 'MovePointTool', label: 'Move Point Tool', category: 'Modeling', args: [{ name: 'Clsid', default: '' }], undoable: false, execute(app) { app.setSelMode('point'); (window as any).__tool?.setMode?.('translate'); app.logMsg('info', 'Move Point: select points (T) and drag with the translate tool (V)'); } });
  app.register({ name: 'TweakTool', label: 'Tweak Tool', category: 'Modeling', args: [{ name: 'Clsid', default: '' }], undoable: false, execute(app) { if (app.selMode === 'object') app.setSelMode('point'); (window as any).__tool?.setMode?.('translate'); app.logMsg('info', 'Tweak: select components and drag with V / C / X'); } });
  app.register({ name: 'TweakNormalsTool', label: 'Tweak Normals Tool', category: 'Modeling', args: [{ name: 'Clsid', default: '' }], canRun: () => false, execute() { throw new Error('User normals are not implemented yet'); } });
  for (const n of ['AverageUserNormals', 'InvertUserNormals', 'NormalizeUserNormals', 'ResetUserNormals']) app.register({ name: n, label: n, category: 'Modeling', args: [], canRun: () => n === 'InvertUserNormals', execute(app) { if (n === 'InvertUserNormals') return app.run('InvertPolygons'); throw new Error('User normals are not implemented yet'); } });
  app.register({ name: 'PropTransformTool', label: 'Proportional Transform Tool', category: 'Manipulation', args: [{ name: 'Clsid', default: '' }], undoable: false, execute(app) { app.proportional.on = !app.proportional.on; app.logMsg('info', `Proportional modelling ${app.proportional.on ? 'ON' : 'OFF'} (radius ${app.proportional.radius})`); app.events.emit('selection'); } });
  app.register({ name: 'SetProportionalRadius', label: 'Proportional Setup', category: 'Manipulation', args: [{ name: 'Radius', default: 3 }], undoable: false, execute(app, a) { app.proportional.radius = Number(a.Radius); app.proportional.on = true; app.events.emit('selection'); } });
  for (const n of ['AddPointOnCurveToolByCVs', 'AddPointOnCurveToolByBezierKnotPoints', 'AddPointOnCurveToolByKnotPoints']) reg(n, 'Add Point on Curve Tool', () => ({ name: 'Add Point', prompt: 'Add Point on Curve: click near the curve to add a control point there. Esc to exit.', onClick: (p) => { const c = app.selectedObjects.find(o => o.primitive?.curve()); if (!c) { app.logMsg('error', 'Select a curve first'); return; } const inv = c.globalMatrix().invert(); const lp = new THREE.Vector3(...p).applyMatrix4(inv); const gen = c.primitive!.operators[0]; if (!(gen instanceof S2.DrawnCurveOperator)) { const cur = c.primitive!.curve()!; const drawn = new S2.DrawnCurveOperator(cur.cvs.map(v => [v[0], v[1], v[2]] as V3), cur.degree, cur.closed); c.primitive!.operators.splice(0, c.primitive!.operators.length, drawn); drawn.parent = c.primitive!; } const d = c.primitive!.operators[0] as S2.DrawnCurveOperator; let bi = 0, bd = Infinity; d.points.forEach((q, i) => { const dd = Math.hypot(q[0] - lp.x, q[1] - lp.y, q[2] - lp.z); if (dd < bd) { bd = dd; bi = i; } }); const old = [...d.points]; app.record('Add point', () => { d.points.splice(bi + 1, 0, [lp.x, lp.y, lp.z]); c.primitive!.dirty = true; }, () => { d.points = old; c.primitive!.dirty = true; }); app.events.emit('scene'); }, onFinish() { app.setTool(null); }, onCancel() { app.activeTool = null; } }));
  reg('DelPointOnCurveTool', 'Delete Point on Curve Tool', () => ({ name: 'Delete Point', prompt: 'Delete Point: click near a control point to remove it. Esc to exit.', onClick: (p) => { const c = app.selectedObjects.find(o => o.primitive?.curve()); if (!c) return; const gen = c.primitive!.operators[0]; if (!(gen instanceof S2.DrawnCurveOperator)) { const cur = c.primitive!.curve()!; const drawn = new S2.DrawnCurveOperator(cur.cvs.map(v => [v[0], v[1], v[2]] as V3), cur.degree, cur.closed); c.primitive!.operators.splice(0, c.primitive!.operators.length, drawn); drawn.parent = c.primitive!; } const d = c.primitive!.operators[0] as S2.DrawnCurveOperator; const lp = new THREE.Vector3(...p).applyMatrix4(c.globalMatrix().invert()); let bi = -1, bd = 1.5; d.points.forEach((q, i) => { const dd = Math.hypot(q[0] - lp.x, q[1] - lp.y, q[2] - lp.z); if (dd < bd) { bd = dd; bi = i; } }); if (bi < 0 || d.points.length <= 2) return; const old = [...d.points]; app.record('Delete point', () => { d.points.splice(bi, 1); c.primitive!.dirty = true; }, () => { d.points = old; c.primitive!.dirty = true; }); app.events.emit('scene'); }, onFinish() { app.setTool(null); }, onCancel() { app.activeTool = null; } }));
  app.register({ name: 'AlignBezierKnotsTangents', label: 'Align Bezier Handles', category: 'Modeling', args: [], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'CrvClean' }) });
  app.register({ name: 'SetCurveKnotMultiplicity', label: 'Set Curve Knot Multiplicity', category: 'Modeling', args: [{ name: 'Multiplicity', default: 1 }], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'CrvReparam' }) });
  app.register({ name: 'ExtractFromComponents', label: 'Extract Subcurves', category: 'Modeling', args: [], execute: (app) => app.run('ApplyGenOp', { PresetObj: 'CrvExtractSeg' }) });
  app.register({ name: 'ApplySnapFaceOp', label: 'Snap Boundary', category: 'Modeling', args: [], canRun: () => false, execute() { throw new Error('NURBS boundary snapping is not implemented yet'); } });
  for (const [name, label] of [['ConvertToRefModel', 'Convert to Referenced Model'], ['ImportRefModels', 'Import Referenced Model'], ['CreateEmptyRefModel', 'Create Empty Referenced Model'], ['UpdateReferencedModel', 'Update Referenced Model'], ['SetResolutionOfRefModels', 'Set Resolution'], ['MakeModelLocal', 'Make Referenced Model Local'], ['AddDelta', 'Add Delta'], ['ImportDelta', 'Import Delta'], ['ExportDelta', 'Export Delta'], ['CommitToReference', 'Commit To Reference']]) app.register({ name, label, category: 'Modeling', args: [], canRun: () => false, execute() { throw new Error(`${label}: referenced models need scene files on disk (not in this web build)`); } });
  app.register({ name: 'SetUserPref', label: 'Set User Preference', category: 'Preferences', args: [{ name: 'Name' }, { name: 'Value' }, { name: 'Target' }], undoable: false, execute(app, a) { if (a.Name === 'AutoInspect') app.autoInspect = !!a.Value; if (a.Name === 'AutoKey') app.autoKey = !!a.Value; if (a.Target) app.logMsg('info', `Preference ${a.Target} = ${a.Value}`); } });
  app.register({ name: 'ProbeMaterialTool', label: 'Probe Material Tool', category: 'Rendering', args: [], canRun: () => false, execute() { throw new Error('Not implemented'); } });
}

function addObjectNoRecord(app: App, o: X3DObject) { app.scene.root.addChild(o); }
function shader(name: string, type: string): Shader {
  const si = makeSiShader(type, name); if (si) return si;
  const s = new Shader(name, type, [color('ambient', [0.3, 0.3, 0.3], 'Ambient', { group: 'Illumination' }), color('diffuse', [0.7, 0.7, 0.7], 'Diffuse', { group: 'Illumination' })]);
  if (type !== 'Constant' && type !== 'Toon') { s.add(color('specular', [1, 1, 1], 'Specular', { group: 'Illumination' })); s.add(num('shiny', 50, 'Specular Decay', { min: 0, max: 200, group: 'Illumination' })); }
  if (type === 'Cook-Torrance' || type === 'Strauss' || type === 'Architectural' || type === 'Car Paint') { s.add(num('roughness', 0.4, 'Roughness', { min: 0, max: 1, group: 'Illumination' })); s.add(num('metalness', type === 'Car Paint' ? 0.8 : 0.1, 'Metalness', { min: 0, max: 1, group: 'Illumination' })); }
  if (type === 'Anisotropic') { s.add(num('anisotropy', 0.5, 'Anisotropy', { min: 0, max: 1, group: 'Illumination' })); }
  if (type === 'Toon') { s.add(int('steps', 3, 'Shading Steps', { min: 2, max: 8 })); s.add(color('inkcolor', [0, 0, 0], 'Ink Color')); }
  s.add(num('transparency', 0, 'Transparency', { min: 0, max: 1, group: 'Transparency/Reflection' })); s.add(num('reflectivity', 0, 'Reflectivity', { min: 0, max: 1, group: 'Transparency/Reflection' }));
  return s;
}
function cloneShader(s: Shader): Shader { const n = new Shader(s.name, s.type, s.params.map(p => ({ ...p.def, value: Array.isArray(p.value) ? [...p.value] : p.value })), s.spdl); n.layout = s.layout; for (const [k, v] of s.inputs) n.connect(k, cloneShader(v)); return n; }
function fitThrough(pts: V3[], degree: number): V3[] {
  // simple interpolation: use the points as a Catmull-Rom sampled set then treat samples as CVs
  if (pts.length < 3 || degree < 2) return pts; const out: V3[] = [];
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let s = 0; s < 3; s++) { const t = s / 3; out.push([0, 1, 2].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t)) as V3); } }
  out.push(pts[pts.length - 1]); return out;
}

/** Topology operators from topology2 (bevel, bridge, dissolve...). */
export class TopologyOperator2 extends Operator {
  plane: { n: V3; d: number } | null = null;
  readonly siType: string;
  constructor(readonly preset: string, readonly sel: any) {
    const legacy = preset === 'Bevel' ? [num('amount', 0.3, 'Bevel Amount', { min: 0.01, max: 0.95 })] : preset === 'Bridge Polygons' ? [int('subdiv', 1, 'Subdivisions', { min: 1, max: 20 })] : preset === 'Slice' ? [enumP('axis', 1, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Axis'), num('offset', 0, 'Offset', { min: -50, max: 50 })] : preset === 'Dice' ? [num('size', 2, 'Cell Size', { min: 0.1, max: 50 })] : preset === 'Polygon Reduction' ? [num('ratio', 0.5, 'Ratio', { min: 0.05, max: 1 })] : preset === 'Split Edges' ? [num('ratio', 0.5, 'Split Ratio', { min: 0.01, max: 0.99 })] : preset === 'Filter Points' ? [num('strength', 0.5, 'Strength', { min: 0, max: 1 })] : preset === 'Symmetrize Polygons' ? [enumP('axis', 0, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Mirror Axis')] : [];
    const td = topoDefs(preset, legacy);
    super(siName(td.type, preset), td.type, [...td.defs, bool('mute', false, 'Mute')]);
    this.siType = td.type; this.layout = td.layout;
  }
  p(si: string, legacy?: string, dflt = 0): number { const a = this.get(si); if (a) return Number(a.value); const b = legacy ? this.get(legacy) : undefined; return b ? Number(b.value) : dflt; }
  apply(m: any) {
    if (!m || !m.positions || this.val('mute')) return m; const v = (n: string) => Number(this.val(n));
    switch (this.preset) {
      case 'Bevel': { const rel = this.get('units') ? this.p('units', undefined, 1) === 1 : true; const w = this.get('ratio') ? this.p('ratio') * (rel ? 0.125 : 1) : v('amount'); return T2.bevelEdges(m, this.sel, w, Math.max(0, this.p('nbsubdivs', undefined, 0) | 0), !!this.val('miter'), rel); }
      case 'Bridge Polygons': return T2.bridgePolygons(m, this.sel, Math.max(1, this.p('subdivs', 'subdiv', 1)));
      case 'Cap Hole': return T2.capHoles(m, this.sel);
      case 'Quadrangulate': return T2.quadrangulate(m, this.sel);
      case 'Dissolve': return dissolvePolygons(m, this.sel);
      case 'Disconnect': return disconnectPolygons(m, this.sel);
      case 'Spin Edges': return T2.spinEdges(m, this.sel, this.get('spin') ? this.p('spin') >= 0 : true);
      case 'Slice': { const sp = Math.min(2, this.p('sliceplane', 'axis', 0)) as 0 | 1 | 2; return sliceAxis(m, this.sel, sp, this.p('planeoffset', 'offset'), this.get('usebbox') ? !!this.val('usebbox') : true, this.p('planeoffsetbboxpercentage', undefined, 50)); }
      case 'Slice Plane': return this.plane ? T2.slicePlane(m, this.sel, this.plane.n, this.plane.d) : m;
      case 'Dice': { if (!this.get('style')) return T2.dice(m, this.sel, v('size'));
        const slicer = (mm: any, ss: any) => dicePolygons(mm, ss, this.p('style', undefined, 2), [this.p('nbslicesx', undefined, 1), this.p('nbslicesy', undefined, 1), this.p('nbslicesz', undefined, 1)], !!this.val('gridlike'), this.p('gridsize', undefined, 1));
        const ref = this.p('planeref', undefined, 2); if (ref === 1) return slicer(m, this.sel);
        if (ref === 2) return T2.diceInFrame(m, this.sel, T2.selectionFrame(m, this.sel), slicer);
        const owner: any = (this.parent as any)?.parent; const g = owner?.globalMatrix?.(); if (!g) return slicer(m, this.sel); const e = g.elements; const col = (i: number): V3 => { const c: V3 = [e[i], e[i + 1], e[i + 2]]; const l = Math.hypot(...c) || 1; return [c[0] / l, c[1] / l, c[2] / l]; };
        return T2.diceInFrame(m, this.sel, [col(0), col(4), col(8)], slicer); }
      case 'Polygon Reduction': { const r = this.p('ratio', undefined, 0.5); return T2.reduceQuadric(m, r > 1 ? r / 100 : r, this.get('preserveboundaries') ? !!this.val('preserveboundaries') : true, this.p('quadlineweight', undefined, 0)); }
      case 'Subdivide Polygons': { const op = makeTopologyOperator('Subdivide Polygons', this.sel)!; op.set('subdivtype', this.p('subdivtype')); op.set('subdivisions', this.p('subdivisions', undefined, 1)); return op.apply(m); }
      case 'Split Edges': { const r = this.p('ratioedge', 'ratio', 0.5); return splitEdges(m, this.sel, r > 1 ? r / 100 : r, this.get('connect') ? !!this.val('connect') : true); }
      case 'Weld Points': return weldPoints(m, this.sel);
      case 'Filter Points': return makeTopologyOperator('Filter Points', this.sel)!.apply(m);
      case 'Symmetrize Polygons': { const op = makeTopologyOperator('Symmetrize Polygons', this.sel)!; op.set('symmetryplane', this.p('symmetryplane', 'axis')); return op.apply(m); }
      case 'Invert Polygons': return makeTopologyOperator('Invert Polygons', this.sel)!.apply(m);
      case 'Connect Points': { const [a, b] = this.sel.indices as number[]; const { verts, faces } = toPolys(m); const fi = faces.findIndex(f => f.includes(a) && f.includes(b) && Math.abs(f.indexOf(a) - f.indexOf(b)) > 1 && Math.abs(f.indexOf(a) - f.indexOf(b)) !== f.length - 1); if (fi < 0) return m; const f = faces[fi]; const ia = f.indexOf(a), ib = f.indexOf(b); const one: number[] = []; for (let i = ia; ; i = (i + 1) % f.length) { one.push(f[i]); if (i === ib) break; } const two: number[] = []; for (let i = ib; ; i = (i + 1) % f.length) { two.push(f[i]); if (i === ia) break; } faces[fi] = one; faces.push(two); return fromPolys(verts, faces); }
    }
    return m;
  }
}
export { MoveComponentOperator };

/** Aliases and the remaining Model-toolbar commands (control objects, actions, chain helpers). */
export function registerModelAliases(app: App) {
  const alias = (name: string, target: string, map: (a: any) => any = a => a, label = name) => app.register({ name, label, category: app.commands.get(target)?.category, args: app.commands.get(target)?.args ?? [], canRun: (a) => { const d = app.commands.get(target)!; return !d.canRun || d.canRun(map(a)); }, undoable: app.commands.get(target)?.undoable, execute: (app, a) => app.run(target, map(a)) });
  alias('ApplyShader', 'SIApplyShader', a => ({ ...a, PresetObj: a.PresetObj === 'More...' ? 'Phong' : a.PresetObj }));
  alias('Create2DMap', 'AddProp', a => ({ ...a, Type: a.Type ?? 'Cubic', PresetObj: 'Texture Map' }));
  app.register({ name: 'CreateSymmetryMap', label: 'Create Symmetry Map', category: 'Property', args: [{ name: 'PresetObj', default: 'SymmetryMap' }, { name: 'InputObj', default: '' }, { name: 'Name', default: 'Symmetry Map' }, { name: 'PropPresetObj', default: 'Symmetry Map Property' }], execute(app, a) {
    const objs = app.targets(a.InputObj).filter(o => o.primitive?.mesh()); if (!objs.length) throw new Error('Select a polygon mesh'); let last: Property | null = null;
    for (const o of objs) { let p = o.property('symmetrymap'); if (!p) { p = makeSymmetryMap(((app as any).symPlane as any) ?? 'YZ'); const pp = p; app.record('Symmetry Map', () => o.addProperty(pp), () => o.removeProperty(pp)); } const sm = symmetryMapOf(o)!; p.set('mapped', sm.map.size); p.set('unmapped', o.primitive!.mesh()!.positions.length / 3 - sm.map.size); p.onChange(() => { const s2 = symmetryMapOf(o); if (s2) { p!.set('mapped', s2.map.size); p!.set('unmapped', o.primitive!.mesh()!.positions.length / 3 - s2.map.size); } }); last = p; }
    if (last) app.select([last]); return last;
  } });
  app.register({ name: 'UpdateSymmetryMap', label: 'Update Symmetry Map', category: 'Property', args: [{ name: 'InputObjs', default: '' }], undoable: false, execute(app, a) { for (const o of app.targets(a.InputObjs)) { const p = o.property('symmetrymap'); if (p) { (p as any)._sym = null; const sm = symmetryMapOf(o)!; p.set('mapped', sm.map.size); app.logMsg('info', `${o.name}: ${sm.map.size} symmetric points`); } } return null; } });
  app.register({ name: 'CreateSymmetryMappingTemplate', label: 'Create Symmetry Mapping Template', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'FillTemplate', default: true }, { name: 'Symmetry Plane', default: 0 }, { name: 'CreateSymmetryMap', default: true }], execute(app, a) {
    // a mapping template pairs objects across the plane by mirrored global position (Left_* / Right_* naming); stored on the model as a property
    const root = app.selectedObjects[0]?.model ?? app.scene.root; const objs = [...app.scene.allObjects()].filter(o => o.model === root || root === app.scene.root); const plane = ['YZ', 'XZ', 'XY'][Number(a['Symmetry Plane'] ?? 0)] as any; const ax = ['YZ', 'XZ', 'XY'].indexOf(plane);
    const pts = new Float32Array(objs.length * 3); objs.forEach((o, i) => { const p = new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()); pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z; });
    const map = buildPointMap(pts, plane, 0.05); const pairs: [string, string][] = []; for (const [i, j] of map) if (i < j) pairs.push([objs[i].name, objs[j].name]);
    const t = new Property('Symmetry Mapping Template', 'symmetrytemplate', [enumP('plane', ax, [{ label: 'YZ', value: 0 }, { label: 'XZ', value: 1 }, { label: 'XY', value: 2 }], 'Symmetry Plane'), int('pairs', pairs.length, 'Mapped Pairs', { readOnly: true })]); (t as any).pairs = pairs;
    const host = root instanceof Model ? root : app.scene.root; app.record('Symmetry Template', () => host.addProperty(t), () => host.removeProperty(t)); app.logMsg('info', `Symmetry mapping template: ${pairs.length} pairs`); app.select([t]); return t;
  } });
  void mirrorComponent;
  alias('CreateWeightMap', 'AddProp', a => ({ ...a, PresetObj: 'Weight Map' }));
  alias('SIStoreProp', 'AddProp', a => ({ ...a, PresetObj: 'Override' }));
  alias('AddSmoothEdgeLoopTool', 'AddEdgeTool');
  app.commands.get('OpenMaterialLibrary')!.canRun = () => true;
  // generic properties: anything AddProp does not know becomes a plain property named after the preset
  const prop = app.commands.get('AddProp')!; const pc = prop.canRun!, pe = prop.execute;
  prop.canRun = (a) => pc(a) || typeof a.PresetObj === 'string';
  prop.execute = (app, a) => { if (pc(a)) return pe(app, a); for (const o of app.targets(a.InputObjs)) { const p = new Property(String(a.PresetObj), String(a.PresetObj).toLowerCase().replace(/[^a-z]+/g, ''), [bool('enabled', true, 'Enabled')]); app.record('Add property', () => o.addProperty(p), () => o.removeProperty(p)); app.select([p]); } return null; };
  // control objects
  app.register({ name: 'GetPrimWave', label: 'Wave Control Object', category: 'Primitive', description: 'Creates a wave control null and applies a Wave deformer driven by it to the selected meshes.', args: [{ name: 'PresetObj', default: 'Wave' }, { name: 'InputObjs', default: '' }], execute(app, a) { const n = new Null(app.scene.uniqueName('wave')); n.add(num('amplitude', 1, 'Amplitude', { keyable: true })); n.add(num('wavelength', 4, 'Wavelength')); n.add(num('phase', 0, 'Phase', { keyable: true })); addObject(app, n); for (const o of app.targets(a.InputObjs)) if (o.primitive?.mesh()) { const op = S2.makeMeshDeformOperator2('Wave')!; const prim = o.primitive; app.record('Wave', () => prim.addOperator(op), () => prim.removeOperator(op)); } app.select([n]); return n; } });
  app.register({ name: 'GetPrimVolumeDeform', label: 'Volume Deform Control Object', category: 'Primitive', args: [{ name: 'PresetObj', default: 'VolumeDeform' }], execute: (app) => app.run('ApplyPropVolumeOp') });
  app.register({ name: 'CreateForce', label: 'Create Force', category: 'Simulation', description: 'Creates a force control object (used by simulations, which are outside the Model/Animate scope).', args: [{ name: 'PresetObj', default: 'Gravity' }], execute(app, a) { const n = new Null(app.scene.uniqueName(String(a.PresetObj).toLowerCase())); n.add(str('forcetype', String(a.PresetObj), 'Force Type', { readOnly: true })); n.add(num('amplitude', 1, 'Amplitude', { keyable: true })); addObject(app, n); app.select([n]); return n; } });
  app.register({ name: 'CreateLightRigFromImage', label: 'Light Rig from Image', category: 'Primitive', args: [], canRun: () => false, execute() { throw new Error('Needs an HDR image loader (not in this build)'); } });
  // static-pose actions (Store/Apply Skeleton Pose use these)
  app.register({ name: 'StoreAction', label: 'Store Action', category: 'Animation Mixer', description: 'Stores the current transform values of the selection as an action source on the model.', args: [{ name: 'Model', default: '' }, { name: 'InputObj', default: '' }, { name: 'Mode', default: 4 }, { name: 'Name', default: 'StoredStaticPose' }], execute(app, a) { const objs = app.targets(a.InputObj); const model = objs[0]?.model ?? app.scene.root; const values: Record<string, number> = {}; for (const o of objs) for (const ax of ['x', 'y', 'z']) for (const k of ['pos', 'rot', 'scl']) values[`${o.fullName}.kine.local.${k}${ax}`] = o.kinematics.local.val(k + ax); const src = new Property(app.scene.uniqueName(a.Name || 'Action'), 'actionsource', [str('data', JSON.stringify(values), 'Values', { readOnly: true }), int('items', Object.keys(values).length, 'Items', { readOnly: true })]); app.record('Store action', () => model.addProperty(src), () => model.removeProperty(src)); app.select([src]); return src; } });
  app.register({ name: 'ApplyAction', label: 'Apply Action', category: 'Animation Mixer', args: [{ name: 'Source', default: '' }], execute(app, a) { const src = (app.selection.find(n => n.type === 'actionsource') as Property | undefined) ?? (app.selectedObjects[0]?.model ?? app.scene.root).properties.filter(p => p.type === 'actionsource').pop(); if (!src) throw new Error('No action source to apply (store one first)'); const values = JSON.parse(src.val('data')); for (const [path, v] of Object.entries(values)) { const p = findParamPath(app, path); if (p) app.setParam(p, v as number); } void a; } });
  app.commands.get('StoreSkeletonPose')!.execute = (app) => app.run('StoreAction', { Name: 'StoredStaticPose' });
  app.commands.get('ApplySkeletonPose')!.execute = (app) => app.run('ApplyAction');
  // chain up-vector / preferred axis
  const opBase = app.commands.get('ApplyOp')!; const can = opBase.canRun!, ex = opBase.execute;
  opBase.canRun = (a) => can(a) || ['SkeletonUpVector', 'SkeletonPrefAxis', 'Chain Up-Vector', 'Chain Preferred Axis'].includes(a.PresetObj) || ['SkeletonUpVector', 'SkeletonPrefAxis'].includes(a.Preset);
  opBase.execute = (app, a) => { const k = a.Preset ?? a.PresetObj; if (k === 'SkeletonUpVector' || a.PresetObj === 'Chain Up-Vector') { const root = app.selectedObjects.map(o => { let x: any = o; while (x && !(x instanceof S2.ChainRoot)) x = x.parentObj; return x; }).find(Boolean) as S2.ChainRoot | undefined; if (!root) throw new Error('Select a chain'); const up = new Null(app.scene.uniqueName(root.name + '_upvector')); const c = new THREE.Vector3().setFromMatrixPosition(root.globalMatrix()); up.kinematics.local.set('posx', c.x); up.kinematics.local.set('posy', c.y + 5); up.kinematics.local.set('posz', c.z); addObject(app, up); if (!root.get('upvector')) root.add(str('upvector', '', 'Up Vector Object', { readOnly: true })); app.setParam(root.get('upvector')!, up.name); app.select([up]); return up; } if (k === 'SkeletonPrefAxis' || a.PresetObj === 'Chain Preferred Axis') { for (const o of app.selectedObjects) if (o instanceof S2.Bone) for (const ax of ['x', 'y', 'z']) app.setParam(o.get('prefrot' + ax)!, o.kinematics.local.val('rot' + ax)); return null; } return ex(app, a); };
  // misc
  app.commands.get('SetProportionalRadius')!.execute = (app, a) => { const r = a.Radius ?? Number(prompt('Proportional radius', String(app.proportional.radius)) ?? app.proportional.radius); app.proportional.radius = Number(r) || app.proportional.radius; app.proportional.on = true; app.events.emit('selection'); app.logMsg('info', `Proportional ON, radius ${app.proportional.radius}`); };
  app.register({ name: 'SetUserNormalsSettings', label: 'User Normals Settings', category: 'Modeling', args: [], canRun: () => false, execute() { throw new Error('User normals are not implemented yet'); } });
  for (const n of ['Copy', 'Paste']) app.register({ name: n, label: n, category: 'Edit', args: [], canRun: () => false, execute() { throw new Error('Clipboard for user normals is not implemented yet'); } });
  app.register({ name: 'AutoInspect', label: 'Auto Inspect', category: 'Preferences', args: [], undoable: false, execute(app) { app.autoInspect = !app.autoInspect; app.logMsg('info', 'Auto inspect ' + (app.autoInspect ? 'ON' : 'OFF')); } });
  // dissolve & clean, extrude along curve
  const topo = app.commands.get('ApplyTopoOp')!; const tc = topo.canRun!, te = topo.execute;
  topo.canRun = (a) => tc(a) || /Dissolve & Clean|Dissolve and Clean/.test(a.PresetObj) || a.Preset === 'MeshDissolveAndClean' || /Extrude Component Along Curve/.test(a.PresetObj);
  topo.execute = (app, a) => { if (/Dissolve/.test(a.PresetObj) && /Clean/.test(a.PresetObj)) return te(app, { ...a, PresetObj: 'Dissolve Component', Preset: 'Dissolve Component' }); if (/Extrude Component Along Curve/.test(a.PresetObj)) { const cs = app.componentSel(); const curve = app.selectedObjects.find(o => o.primitive?.curve()); if (!cs || cs.sel.kind !== 'polygon') throw new Error('Select polygons (Y) and Shift-select a curve'); const len = curve ? C.curveLength(curve.primitive!.curve()!) : 2; const op = makeTopologyOperator('Extrude Along Normal', cs.sel)!; op.set('length', len); const prim = cs.obj.primitive!; app.record('Extrude Along Curve', () => prim.addOperator(op), () => prim.removeOperator(op)); app.compSel = null; app.select([op]); return op; } return te(app, a); };
}
function findParamPath(app: App, path: string) { const parts = path.split('.'); const obj = [...app.scene.allObjects()].find(o => path.startsWith(o.fullName + '.')); if (!obj) return undefined; const name = parts[parts.length - 1]; return path.includes('.kine.local.') ? obj.kinematics.local.get(name) : undefined; }
