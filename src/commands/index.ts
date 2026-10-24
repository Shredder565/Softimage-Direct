// Built-in commands. Scripting names and argument lists follow Softimage's registry (commands_full.json)
// so a Softimage script like  CreatePrim "Cube", "MeshSurface"  maps 1:1.
import { App } from '../core/commands';
import { X3DObject, Model, Null, Primitive, Light, Camera, Group, makeGeomOperator, makeDeformOperator, makePhong, makeLambert, Material, Property, makeDisplay, makeGeomApprox, Node, Shader, makeTopologyOperator, TopologyOperator, makeVisibility } from '../core/scene';
import { Cluster, threeOrder } from '../core/scene';
import * as THREE from 'three';
import { makeAimRig } from './constraints';
import { siMessage } from '../ui/si';
import { extractPolygons, meshEdges } from '../core/topology';
import { color, num, bool } from '../core/params';
import { Operator, construction } from '../core/scene';
import type { MeshData } from '../core/geometry';

class FrozenOperator extends Operator {
  constructor(readonly mesh: MeshData | null) { super('Frozen Geometry', 'geom', []); }
  apply() { return this.mesh; }
}

const MESH_PRESETS = ['Cube', 'Sphere', 'Cylinder', 'Cone', 'Torus', 'Grid', 'Disc', 'Tetrahedron', 'Octahedron', 'Icosahedron', 'Dodecahedron', 'Rhombicosidodecahedron', 'Soccer Ball', 'SoccerBall', 'Empty'];

function addObject(app: App, obj: X3DObject, parent?: X3DObject | null) {
  const p = parent ?? app.scene.root;
  app.record('Add ' + obj.name, () => p.addChild(obj), () => p.removeChild(obj));
  return obj;
}

export function registerBuiltins(app: App) {
  // ------------------------------------------------------------ primitives
  app.register({
    name: 'CreatePrim', label: 'Create primitive', category: 'Primitive',
    description: 'Creates an explicit primitive (polygon mesh / curve / surface) of the given preset, selects it and inspects it.',
    args: [{ name: 'PresetObj', default: 'Cube' }, { name: 'GeometryType', default: 'MeshSurface' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }],
    canRun: (a) => MESH_PRESETS.includes(a.PresetObj) && (a.GeometryType === 'MeshSurface' || a.GeometryType === 'PointCloud'),
    execute(app, a) {
      if (!MESH_PRESETS.includes(a.PresetObj)) throw new Error(`Preset ${a.PresetObj} not available yet (geometry type ${a.GeometryType})`);
      const name = app.scene.uniqueName(a.Name || a.PresetObj.toLowerCase());
      const obj = new X3DObject(name, a.GeometryType === 'PointCloud' ? 'pointcloud' : 'polymsh');
      const prim = new Primitive('Polygon Mesh', 'polymsh');
      prim.addOperator(makeGeomOperator(a.PresetObj, a.GeometryType === 'PointCloud' ? 'Point Cloud' : 'Polygon Mesh'));
      obj.setPrimitive(prim); obj.addProperty(makeDisplay()); obj.addProperty(makeGeomApprox());
      addObject(app, obj, a.Parent ? app.scene.find(a.Parent) : null);
      app.select([obj]);
      return obj;
    },
  });
  app.register({
    name: 'GetPrim', label: 'Get primitive', category: 'Primitive', description: 'Creates an implicit primitive (null, light, camera...).',
    args: [{ name: 'PresetObj', default: 'Null' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }],
    canRun: (a) => ['Null', 'Camera', 'Point', 'Infinite', 'Spot'].includes(a.PresetObj) || /Empty/i.test(a.PresetObj) || MESH_PRESETS.includes(a.PresetObj),
    execute(app, a) {
      if (MESH_PRESETS.includes(a.PresetObj)) return app.run('CreatePrim', { PresetObj: a.PresetObj, GeometryType: 'MeshSurface', Name: a.Name });
      if (/Empty/i.test(a.PresetObj)) return app.run('CreatePrim', { PresetObj: 'Empty', GeometryType: /Cloud/i.test(a.PresetObj) ? 'PointCloud' : 'MeshSurface', Name: a.Name });
      let obj: X3DObject;
      const name = app.scene.uniqueName(a.Name || a.PresetObj.toLowerCase());
      if (a.PresetObj === 'Camera' || a.PresetObj === 'Spot') { const rig = makeAimRig(app, a.PresetObj, a.Name || a.PresetObj, a.Parent ? app.scene.find(a.Parent) : null); app.select([rig.obj]); return rig.root; }
      if (a.PresetObj === 'Null') obj = new Null(name);
      else if (['Point', 'Infinite'].includes(a.PresetObj)) obj = new Light(name, a.PresetObj.toLowerCase() as any);
      else throw new Error(`Implicit primitive ${a.PresetObj} not available yet`);
      addObject(app, obj, a.Parent ? app.scene.find(a.Parent) : null);
      app.select([obj]); return obj;
    },
  });
  app.register({ name: 'GetPrimLight', label: 'Get light', category: 'Primitive', args: [{ name: 'PresetObj', default: 'Point' }, { name: 'Name', default: '' }], execute: (app, a) => app.run('GetPrim', { PresetObj: a.PresetObj.replace('.Preset', ''), Name: a.Name }) });
  app.register({ name: 'GetPrimCamera', label: 'Get camera', category: 'Primitive', args: [{ name: 'PresetObj', default: 'Camera' }, { name: 'Name', default: '' }], execute: (app, a) => app.run('GetPrim', { PresetObj: 'Camera', Name: a.Name }) });
  app.register({
    name: 'CreateModel', label: 'Create Model', category: 'Modeling', description: 'Creates a model containing the given objects.',
    args: [{ name: 'InputObj', default: '' }, { name: 'Name', default: 'Model' }, { name: 'Parent', default: '' }],
    execute(app, a) {
      const objs = app.targets(a.InputObj); if (objs.some(o => o === app.scene.root)) throw new Error(siMessage(19));
      const m = new Model(app.scene.uniqueName(a.Name || 'Model'));
      addObject(app, m, a.Parent ? app.scene.find(a.Parent) : null);
      for (const o of objs) { const oldP = o.parentObj!; app.record('Reparent', () => m.addChild(o), () => oldP.addChild(o)); }
      app.select([m]); return m;
    },
  });

  // ------------------------------------------------------------------ edit
  app.register({
    name: 'DeleteObj', label: 'Delete', category: 'Edit', args: [{ name: 'InputObj', default: '' }],
    execute(app, a) {
      for (const n of app.selection) if (n instanceof Cluster && !a.InputObj) { const o = n.obj; if (o) app.record('Delete ' + n.name, () => o.removeCluster(n), () => o.addCluster(n)); }
      for (const o of app.targets(a.InputObj)) { if (o === app.scene.root) continue; const p = o.parentObj!; const idx = p.children.indexOf(o); app.record('Delete ' + o.name, () => p.removeChild(o), () => { p.addChild(o); p.children.splice(p.children.indexOf(o), 1); p.children.splice(idx, 0, o); }); }
      app.select([]);
    },
  });
  app.register({
    name: 'Duplicate', label: 'Duplicate', category: 'Edit', args: [{ name: 'InputObjs', default: '' }, { name: 'NbCopies', default: 1 }],
    execute(app, a) {
      const made: X3DObject[] = [];
      for (const o of app.targets(a.InputObjs)) for (let i = 0; i < (a.NbCopies | 0 || 1); i++) {
        const c = cloneObject(app, o); addObject(app, c, o.parentObj); made.push(c);
      }
      app.select(made); return made;
    },
  });
  app.register({ name: 'ToggleVisibility', label: 'Hide/Unhide', category: 'Viewing', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const p = o.property('visibility')!.get('viewvis')!; app.setParam(p, !p.value, 'Visibility'); } } });
  app.register({ name: 'HideSelection', label: 'Hide Selection', category: 'Viewing', args: [], execute(app) { for (const o of app.selectedObjects) app.setParam(o.property('visibility')!.get('viewvis')!, false, 'Hide'); } });
  app.register({ name: 'UnhideAll', label: 'Unhide All', category: 'Viewing', args: [], execute(app) { for (const o of app.scene.allObjects()) app.setParam(o.property('visibility')!.get('viewvis')!, true, 'Unhide'); } });
  app.register({ name: 'SetValue', label: 'Set Value', category: 'Edit', args: [{ name: 'Target' }, { name: 'Value' }], execute(app, a) { const p = findParam(app, a.Target); if (!p) throw new Error('No such parameter ' + a.Target); app.setParam(p, a.Value); } });
  app.register({
    name: 'Translate', label: 'Translate', category: 'Manipulation', args: [{ name: 'InputObj', default: '' }, { name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }, { name: 'Mode', default: 'siRelative' }],
    execute(app, a) { for (const o of app.targets(a.InputObj)) ['x', 'y', 'z'].forEach((ax, i) => { const p = o.kinematics.local.get('pos' + ax)!; const v = [a.X, a.Y, a.Z][i]; app.setParam(p, a.Mode === 'siAbsolute' ? v : p.value + v, 'Translate'); }); },
  });
  app.register({
    name: 'Rotate', label: 'Rotate', category: 'Manipulation', args: [{ name: 'InputObj', default: '' }, { name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }, { name: 'Mode', default: 'siRelative' }, { name: 'RefFrame', default: 'siParent' }],
    execute(app, a) {
      for (const o of app.targets(a.InputObj)) {
        const l = o.kinematics.local; const ref = String(a.RefFrame ?? 'siParent');
        if (a.Mode === 'siAbsolute' || ref === 'siParent' || ref === 'siObj') { ['x', 'y', 'z'].forEach((ax, i) => { const p = l.get('rot' + ax)!; const v = [a.X, a.Y, a.Z][i]; app.setParam(p, a.Mode === 'siAbsolute' ? v : p.value + v, 'Rotate'); }); continue; }
        // siLocal / siGlobal relative rotation: compose quaternions (verified against Softimage's Rotate siLocal/siGlobal results)
        const d = Math.PI / 180, order = threeOrder(l.val('rotorder')); let q = new THREE.Quaternion().setFromEuler(new THREE.Euler(l.val('rotx') * d, l.val('roty') * d, l.val('rotz') * d, order));
        const pq = new THREE.Quaternion(); if (o.parentObj) o.parentObj.globalMatrix().decompose(new THREE.Vector3(), pq, new THREE.Vector3()); const pinv = pq.clone().invert();
        for (const [i, ax] of [[0, 'x'], [1, 'y'], [2, 'z']] as [number, string][]) { const ang = Number([a.X, a.Y, a.Z][i]) || 0; if (!ang) continue; const base = new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0); const axisP = ref === 'siLocal' ? base.applyQuaternion(q) : base.applyQuaternion(pinv); q = new THREE.Quaternion().setFromAxisAngle(axisP.normalize(), ang * d).multiply(q); }
        const e = new THREE.Euler().setFromQuaternion(q, order); app.setParam(l.get('rotx')!, e.x / d, 'Rotate'); app.setParam(l.get('roty')!, e.y / d, 'Rotate'); app.setParam(l.get('rotz')!, e.z / d, 'Rotate');
      }
    },
  });
  app.register({
    name: 'Scale', label: 'Scale', category: 'Manipulation', args: [{ name: 'InputObj', default: '' }, { name: 'X', default: 1 }, { name: 'Y', default: 1 }, { name: 'Z', default: 1 }, { name: 'Mode', default: 'siRelative' }],
    execute(app, a) { for (const o of app.targets(a.InputObj)) ['x', 'y', 'z'].forEach((ax, i) => { const p = o.kinematics.local.get('scl' + ax)!; const v = [a.X, a.Y, a.Z][i]; app.setParam(p, a.Mode === 'siAbsolute' ? v : p.value * v, 'Scale'); }); },
  });
  app.register({ name: 'ResetTransform', label: 'Reset Transform', category: 'Manipulation', args: [{ name: 'InputObj', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObj)) { const l = o.kinematics.local; for (const n of ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz']) app.setParam(l.get(n)!, 0, 'Reset'); for (const n of ['sclx', 'scly', 'sclz']) app.setParam(l.get(n)!, 1, 'Reset'); } } });
  app.register({ name: 'ParentObj', label: 'Parent', category: 'Edit', args: [{ name: 'Parent' }, { name: 'Children', default: '' }], execute(app, a) { const p = app.scene.find(a.Parent) ?? app.scene.root; for (const c of app.targets(a.Children)) { if (c === p) continue; const old = c.parentObj!; app.record('Parent', () => p.addChild(c), () => old.addChild(c)); } } });
  app.register({ name: 'CutObj', label: 'Cut Hierarchical Link', category: 'Edit', args: [{ name: 'Children', default: '' }], execute(app, a) { for (const c of app.targets(a.Children)) { const old = c.parentObj!; if (old === app.scene.root) continue; app.record('Cut', () => app.scene.root.addChild(c), () => old.addChild(c)); } } });
  app.register({ name: 'Rename', label: 'Rename', category: 'Edit', args: [{ name: 'InputObj' }, { name: 'Name' }], execute(app, a) { for (const o of app.targets(a.InputObj)) { const old = o.name; const nn = app.scene.uniqueName(a.Name); app.record('Rename', () => { o.name = nn; }, () => { o.name = old; }); } } });

  // ------------------------------------------------------------- operators
  app.register({
    name: 'ApplyOp', label: 'Apply Operator', category: 'Deformation|Operator', description: 'Applies a deformation operator (Twist, Bend, Taper, Bulge, Shear, Push, Randomize, Smooth) to the construction history.',
    args: [{ name: 'PresetObj', default: 'Twist' }, { name: 'ConnectionSet', default: '' }, { name: 'ConnectType', default: 3 }, { name: 'ImmediateMode', default: 0 }],
    canRun: (a) => !!makeDeformOperator(a.PresetObj) || !!makeDeformOperator(a.Preset),
    execute(app, a) {
      const ops: Node[] = [];
      for (const o of app.targets(a.ConnectionSet)) {
        if (!o.primitive || !o.primitive.mesh()) continue;
        const op = makeDeformOperator(a.PresetObj) ?? makeDeformOperator(a.Preset); if (!op) throw new Error(`Operator ${a.PresetObj} not available yet`);
        const prim = o.primitive; app.record('Apply ' + a.PresetObj, () => prim.addOperator(op), () => prim.removeOperator(op)); ops.push(op);
      }
      if (ops.length) app.select(ops);
      return ops;
    },
  });
  app.register({ name: 'DeleteOp', label: 'Delete Operator', category: 'Operator', args: [{ name: 'Operator' }], execute(app, a) { for (const n of app.selection) if (n.kind === 'operator' && n.type !== 'geom') { const prim = n.parent as Primitive; const idx = prim.operators.indexOf(n as any); app.record('Delete op', () => prim.removeOperator(n as any), () => { prim.addOperator(n as any); prim.operators.splice(prim.operators.indexOf(n as any), 1); prim.operators.splice(idx, 0, n as any); prim.dirty = true; }); } app.select([]); } });
  app.register({ name: 'CreateGroup', label: 'Create Group', category: 'Edit', description: 'Groups the selected objects (MCP Edit > Group).', args: [{ name: 'Name', default: 'Group' }, { name: 'InputObjs', default: '' }], execute(app, a) {
    const objs = app.targets(a.InputObjs); if (!objs.length) throw new Error(siMessage(41));
    const g = new Group(app.scene.uniqueName(a.Name || 'Group')); g.members.push(...objs); g.parent = app.scene.root;
    app.record('Group', () => { app.scene.groupList.push(g); }, () => { const i = app.scene.groupList.indexOf(g); if (i >= 0) app.scene.groupList.splice(i, 1); });
    app.select([g]); return g;
  } });
  app.register({ name: 'FreezeModeling', label: 'Freeze Modeling', category: 'Modeling', description: 'Freezes the modeling region of the construction history (MCP Edit > Freeze M); shape/animation/secondary operators stay live.', args: [{ name: 'InputObjs', default: '' }], execute(app, a) {
    for (const o of app.targets(a.InputObjs)) {
      const prim = o.primitive; if (!prim || prim.operators.length < 2) continue; const old = [...prim.operators]; const keep = old.filter((op, i) => i > 0 && (op.region ?? 'modeling') !== 'modeling'); if (keep.length === old.length - 1) continue;
      const mesh = prim.geomUpTo('modeling'); const frozen = new FrozenOperator(mesh); frozen.region = 'modeling';
      app.record('Freeze Modeling', () => { prim.operators.splice(0, prim.operators.length, frozen, ...keep); frozen.parent = prim; prim.dirty = true; }, () => { prim.operators.splice(0, prim.operators.length, ...old); prim.dirty = true; });
    }
  } });
  app.register({ name: 'SetConstructionMode', label: 'Set Construction Mode', category: 'Modeling', args: [{ name: 'Mode', default: 'modeling' }], undoable: false, execute(app, a) { const m = String(a.Mode).toLowerCase().replace(/[^a-z]/g, '') as any; const map: Record<string, string> = { modeling: 'modeling', shapemodeling: 'shape', shape: 'shape', animation: 'animation', secondaryshapemodeling: 'secondaryshape', secondaryshape: 'secondaryshape', secondary: 'secondaryshape' }; if (!map[m]) throw new Error('Mode: Modeling, Shape Modeling, Animation or Secondary Shape Modeling'); construction.mode = map[m] as any; app.events.emit('module'); app.logMsg('info', `Construction mode: ${map[m]}`); return construction.mode; } });
  app.register({ name: 'FreezeObj', label: 'Freeze', category: 'Modeling', description: 'Collapses the construction history into the geometry.', args: [{ name: 'InputObjs', default: '' }], execute(app, a) {
    for (const o of app.targets(a.InputObjs)) {
      const prim = o.primitive; if (!prim || prim.operators.length < 2) continue;
      const mesh = prim.mesh(); const old = [...prim.operators];
      const frozen = new FrozenOperator(mesh);
      app.record('Freeze', () => { prim.operators.splice(0, prim.operators.length, frozen); frozen.parent = prim; prim.dirty = true; }, () => { prim.operators.splice(0, prim.operators.length, ...old); prim.dirty = true; });
    }
  } });

  // -------------------------------------------------------------- topology
  const TOPO: Record<string, string> = {  // Softimage ApplyTopoOp preset display name -> our operator
    'Extrude Component Along Normal': 'Extrude Along Normal', 'Inset Polygons': 'Inset Polygons', 'Offset Polygons': 'Offset Polygons', 'Local Subdivision': 'Local Subdivision', 'Delete Component': 'Delete Components',
    'Duplicate Polygons Along Curve': 'Duplicate Polygons', 'Duplicate Polygons': 'Duplicate Polygons', 'Subdivide Polygon': 'Subdivide Polygons',
    'Collapse': 'Collapse Components', 'Weld Points': 'Weld Points', 'Weld Edges': 'Weld Points', 'Invert Polygons': 'Invert Polygons', 'Triangulate': 'Triangulate',
    'Filter Points': 'Filter Points', 'Symmetrize Polygons': 'Symmetrize Polygons', 'Apply Thickness': 'Apply Thickness', 'Split Edge': 'Split Edges',
  };
  const needsSel = (preset: string) => !['Apply Thickness', 'Triangulate', 'Invert Polygons', 'Filter Points', 'Symmetrize Polygons'].includes(preset);
  app.register({
    name: 'ApplyTopoOp', label: 'Apply Topology Operator', category: 'Modeling|Topology|Operator', description: 'Applies a topology operator to the selected components (polygons, edges or points).',
    args: [{ name: 'PresetObj', default: 'Extrude Component Along Normal' }, { name: 'ConnectionSet', default: '' }, { name: 'ConnectType', default: 3 }, { name: 'ImmediateMode', default: 0 }],
    canRun: (a) => !!(TOPO[a.PresetObj] ?? TOPO[a.Preset]),
    execute(app, a) {
      const preset = TOPO[a.PresetObj] ?? TOPO[a.Preset]; if (!preset) throw new Error(`Topology operator ${a.PresetObj} not available yet`);
      const cs = app.componentSel();
      let obj = cs?.obj ?? app.selectedObjects[0];
      if (!obj || obj.primitive?.type !== 'polymsh') throw new Error('Select a polygon mesh' + (needsSel(preset) ? ' and some of its components (T points, E edges, Y polygons)' : ''));
      if (needsSel(preset) && !cs) throw new Error(`${preset}: select components first (T points, E edges, Y polygons)`);
      const sel = cs?.sel ?? { kind: 'polygon' as const, indices: [] };
      const op = makeTopologyOperator(preset, sel)!;
      const prim = obj.primitive!;
      app.record(preset, () => prim.addOperator(op), () => prim.removeOperator(op));
      // immediate mode is handled generically in App.run (bakes only up to the new operator)
      app.compSel = null; app.select([op]);
      return op;
    },
  });
  app.register({ name: 'DeleteComponent', label: 'Delete Components', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }], canRun: () => true, execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'Delete Component' }) });
  app.register({ name: 'ApplyThickness', label: 'Apply Thickness', category: 'Modeling|Topology|Operator', args: [{ name: 'InputObjs', default: '' }, { name: 'Thickness', default: 0.5 }], execute(app, a) { const op = app.run('ApplyTopoOp', { PresetObj: 'Apply Thickness' }) as TopologyOperator; if (op && a.Thickness !== undefined) op.set('amount', a.Thickness); return op; } });
  app.register({ name: 'SplitEdge', label: 'Split Edge', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }, { name: 'Ratio', default: 0.5 }], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'Split Edge' }) });
  app.register({ name: 'WeldPoints', label: 'Weld Points', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'Weld Points' }) });
  app.register({ name: 'TriangulatePolygons', label: 'Triangulate', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'Triangulate' }) });
  app.register({ name: 'InvertPolygons', label: 'Invert Polygons', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }], execute: (app) => app.run('ApplyTopoOp', { PresetObj: 'Invert Polygons' }) });
  app.register({
    name: 'ExtractPolygons', label: 'Extract Polygons', category: 'Modeling|Topology', args: [{ name: 'ConnectionSet', default: '' }, { name: 'Keep', default: false }],
    execute(app, a) {
      const cs = app.componentSel(); if (!cs || cs.sel.kind !== 'polygon' || !cs.sel.indices.length) throw new Error('Select polygons first (Y)');
      const src = cs.obj.primitive!.mesh()!; const { part } = extractPolygons(src, cs.sel, !!a.Keep);
      const obj = new X3DObject(app.scene.uniqueName(cs.obj.name + '_extract'), 'polymsh'); const prim = new Primitive('Polygon Mesh', 'polymsh');
      prim.addOperator(new FrozenOperator(part)); obj.setPrimitive(prim); obj.addProperty(makeDisplay()); obj.addProperty(makeGeomApprox());
      for (const p of cs.obj.kinematics.local.params) obj.kinematics.local.get(p.name)!.value = p.value;
      if (!a.Keep) app.run('ApplyTopoOp', { PresetObj: 'Delete Component' });
      addObject(app, obj, cs.obj.parentObj); app.compSel = null; app.select([obj]); return obj;
    },
  });
  // selection helpers for components
  app.register({ name: 'SelectAllComponents', label: 'Select All Components', category: 'Selection', args: [], undoable: false, execute(app) { const o = app.selectedObjects[0]; const m = o?.primitive?.mesh(); if (!o || !m || app.selMode === 'object') return; if (app.selMode === 'point') app.selectComponents(o, 'point', m.positions.length / 3 > 0 ? [...Array(m.positions.length / 3).keys()] : []); else if (app.selMode === 'polygon') app.selectComponents(o, 'polygon', m.polygons.map((_, i) => i)); else app.selectComponents(o, 'edge', meshEdges(m).map(e => e[0] + '-' + e[1])); } });
  app.register({ name: 'InvertSelection', label: 'Invert Selection', category: 'Selection', args: [], undoable: false, execute(app) { const c = app.compSel; const o = app.selectedObjects[0]; const m = o?.primitive?.mesh(); if (!c || !m) return; if (c.kind === 'point') app.selectComponents(o, 'point', [...Array(m.positions.length / 3).keys()].filter(i => !c.points.has(i))); else if (c.kind === 'polygon') app.selectComponents(o, 'polygon', m.polygons.map((_, i) => i).filter(i => !c.polygons.has(i))); else app.selectComponents(o, 'edge', meshEdges(m).map(e => e[0] + '-' + e[1]).filter(k => !c.edges.has(k))); } });
  for (const [name, mode, label] of [['ActivateObjectSelTool', 'object', 'Object Select Tool'], ['ActivateVertexSelTool', 'point', 'Point Select Tool'], ['ActivateEdgeSelTool', 'edge', 'Edge Select Tool'], ['ActivatePolygonSelTool', 'polygon', 'Polygon Select Tool'], ['ActivateRaycastPolySelTool', 'polygon', 'Raycast Polygon Select Tool'], ['ActivateRaycastEdgeSelTool', 'edge', 'Raycast Edge Select Tool'], ['ActivatePolygonSelToolWithNoObjStateChange', 'polygon', 'Polygon Select Tool (Extended)']] as const)
    app.register({ name, label, category: 'Selection', args: [], undoable: false, execute(app) { app.setSelMode(mode as any); } });

  // -------------------------------------------------------------- material
  app.register({
    name: 'SIApplyShader', label: 'Apply Shader', category: 'Rendering', args: [{ name: 'PresetObj', default: 'Phong' }, { name: 'InputObjs', default: '' }],
    execute(app, a) {
      const preset = String(a.PresetObj).replace('Shaders\\Material\\', '');
      for (const o of app.targets(a.InputObjs)) {
        const shader: Shader = preset === 'Lambert' ? makeLambert() : makePhong(preset === 'Phong' ? 'Phong' : preset);
        const mat = app.scene.newMaterial(o.name + '_Mat', shader); const old = o.material;
        app.record('Apply shader', () => o.setMaterial(mat), () => o.setMaterial(old));
        app.select([shader]);
      }
    },
  });
  app.register({ name: 'AssignMaterial', label: 'Assign Material', category: 'Rendering', args: [{ name: 'InputObjs', default: '' }, { name: 'Material' }], execute(app, a) { const mat = app.scene.materials.find(m => m.name === a.Material) ?? app.scene.materials[app.scene.materials.length - 1]; for (const o of app.targets(a.InputObjs)) { const old = o.material; app.record('Assign', () => o.setMaterial(mat), () => o.setMaterial(old)); } } });
  app.register({ name: 'UnAssignMaterial', label: 'UnAssign Material', category: 'Rendering', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const old = o.material; if (!old) continue; app.record('Unassign', () => o.setMaterial(null), () => o.setMaterial(old)); } } });
  app.register({
    name: 'AddProp', label: 'Add Property', category: 'Property', args: [{ name: 'PresetObj', default: 'Display' }, { name: 'InputObjs', default: '' }],
    canRun: (a) => ['Display', 'Geometry Approximation', 'Annotation', 'CustomProperty', 'Custom Parameter Set', 'Static KineState', 'Synoptic', 'Visibility'].includes(a.PresetObj),
    execute(app, a) {
      for (const o of app.targets(a.InputObjs)) {
        let p: Property;
        if (a.PresetObj === 'Display') p = makeDisplay(false); else if (a.PresetObj === 'Geometry Approximation') p = makeGeomApprox(false);
        else if (a.PresetObj === 'Annotation') p = new Property('Annotation', 'annotation', [{ name: 'text', label: 'Text', type: 'string', value: 'Note' }]);
        else if (a.PresetObj === 'CustomProperty' || a.PresetObj === 'Custom Parameter Set') p = new Property(app.scene.uniqueName('CustomPSet'), 'customparamset', [num('value', 0, 'Value', { keyable: true })]);
        else if (a.PresetObj === 'Synoptic') p = new Property('Synoptic', 'synoptic', [{ name: 'file', label: 'Synoptic File', type: 'string', value: '' }]);
        else if (a.PresetObj === 'Visibility') p = makeVisibility();
        else throw new Error(`Property ${a.PresetObj} not available yet`);
        app.record('Add property', () => o.addProperty(p), () => o.removeProperty(p)); app.select([p]);
      }
    },
  });

  // -------------------------------------------------------------- animation
  app.register({
    name: 'SaveKey', label: 'Save Key', category: 'Animation', description: 'Sets a key on the given parameters (default: keyable transform parameters of the selection) at the current frame.',
    args: [{ name: 'InputObjs', default: '' }, { name: 'Time', default: null }, { name: 'Value', default: null }],
    execute(app, a) {
      const t = a.Time ?? app.anim.frame;
      const params = keyableParams(app, a.InputObjs);
      for (const p of params) { const fc = app.anim.fcurve(p, true)!; const had = fc.keys.find(k => k.time === t); const v = a.Value ?? p.value; app.record('Key', () => fc.addKey(t, v), () => { if (had) fc.addKey(t, had.value); else fc.removeKey(t); }); }
      app.events.emit('params');
      return params.length;
    },
  });
  app.register({ name: 'SetKey', label: 'Set Key', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'Time', default: null }, { name: 'Value', default: null }], execute: (app, a) => app.run('SaveKey', a) });
  app.register({ name: 'RemoveKey', label: 'Remove Key', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'Time', default: null }], execute(app, a) { const t = a.Time ?? app.anim.frame; for (const p of keyableParams(app, a.InputObjs)) { const fc = app.anim.fcurve(p); const had = fc?.keys.find(k => k.time === t); if (!had) continue; app.record('Remove key', () => fc!.removeKey(t), () => fc!.addKey(t, had.value)); } app.events.emit('params'); } });
  app.register({ name: 'RemoveAnimation', label: 'Remove Animation', category: 'Animation', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const p of keyableParams(app, a.InputObjs)) { const fc = app.anim.fcurve(p); if (!fc) continue; const keys = [...fc.keys]; app.record('Remove anim', () => { fc.keys = []; }, () => { fc.keys = keys; }); } app.events.emit('params'); } });
  app.register({ name: 'SetCurrentFrame', label: 'Set Current Frame', category: 'Transport Control', args: [{ name: 'Frame', default: 1 }], undoable: false, execute(app, a) { app.anim.frame = Number(a.Frame); } });
  app.register({ name: 'PlayForwardsFromStart', label: 'Play', category: 'Transport Control', args: [], undoable: false, execute(app) { app.anim.frame = app.anim.startFrame; app.anim.play(); } });
  app.register({ name: 'PlayForwards', label: 'Play Forwards', category: 'Transport Control', args: [], undoable: false, execute(app) { app.anim.play(); } });
  app.register({ name: 'PlaybackStop', label: 'Stop', category: 'Transport Control', args: [], undoable: false, execute(app) { app.anim.stop(); } });
  app.register({ name: 'FirstFrame', label: 'First Frame', category: 'Transport Control', args: [], undoable: false, execute(app) { app.anim.frame = app.anim.startFrame; } });
  app.register({ name: 'LastFrame', label: 'Last Frame', category: 'Transport Control', args: [], undoable: false, execute(app) { app.anim.frame = app.anim.endFrame; } });
  app.register({ name: 'NextFrame', label: 'Next Frame', category: 'Transport Control', args: [], undoable: false, execute(app) { app.anim.frame = Math.min(app.anim.endFrame, app.anim.frame + 1); } });
  app.register({ name: 'PrevFrame', label: 'Previous Frame', category: 'Transport Control', args: [], undoable: false, execute(app) { app.anim.frame = Math.max(app.anim.startFrame, app.anim.frame - 1); } });
  app.register({ name: 'SetPlayRange', label: 'Set Play Range', category: 'Transport Control', args: [{ name: 'Start', default: 1 }, { name: 'End', default: 100 }], undoable: false, execute(app, a) { app.anim.startFrame = a.Start | 0; app.anim.endFrame = a.End | 0; app.events.emit('frame'); } });

  // -------------------------------------------------------------- selection
  app.register({ name: 'SelectObj', label: 'Select Object', category: 'Selection', args: [{ name: 'InputObjs', default: '' }, { name: 'Mode', default: 'replace' }], undoable: false, execute(app, a) { app.select(app.targets(a.InputObjs), a.Mode); } });
  app.register({ name: 'DeselectAll', label: 'Deselect All', category: 'Selection', args: [], undoable: false, execute(app) { app.select([]); } });
  app.register({ name: 'SelectAll', label: 'Select All', category: 'Selection', args: [], undoable: false, execute(app) { app.select([...app.scene.allObjects()].filter(o => o.visible)); } });
  app.register({ name: 'SelectChildNodes', label: 'Select Children', category: 'Selection', args: [{ name: 'InputObjs', default: '' }], undoable: false, execute(app, a) { const s: X3DObject[] = []; for (const o of app.targets(a.InputObjs)) { s.push(o); s.push(...o.descendants()); } app.select(s); } });

  // ------------------------------------------------------------------ misc
  app.register({ name: 'InspectObj', label: 'Inspect Object', category: 'Property|Edit', args: [{ name: 'InputObjs', default: '' }], undoable: false, execute(app, a) { if (a.InputObjs) app.select(app.targets(a.InputObjs)); app.events.emit('selection'); } });
  app.register({ name: 'Undo', label: 'Undo', category: 'Edit', args: [], undoable: false, execute(app) { app.undo(); } });
  app.register({ name: 'Redo', label: 'Redo', category: 'Edit', args: [], undoable: false, execute(app) { app.redo(); } });
  app.register({ name: 'NewScene', label: 'New Scene', category: 'File', args: [{ name: 'Confirm', default: false }], undoable: false, execute(app) { app.scene = new (app.scene.constructor as any)(); app.anim.fcurves.clear(); app.undoStack = []; app.redoStack = []; app.select([]); app.events.emit('newscene'); } });
  app.register({ name: 'SetUserPref', label: 'Set User Preference', category: 'Preferences', args: [{ name: 'Name' }, { name: 'Value' }], undoable: false, execute(app, a) { if (a.Name === 'AutoInspect') app.autoInspect = !!a.Value; if (a.Name === 'AutoKey') app.autoKey = !!a.Value; } });
  app.register({ name: 'CreateLayer', label: 'Create Layer', category: 'Layer', args: [{ name: 'Name', default: 'Layer' }, { name: 'InputObjs', default: '' }], execute(app, a) { const l = app.scene.addLayer(a.Name || 'Layer'); for (const o of app.targets(a.InputObjs)) { o.layer = l; l.members.add(o); } return l; } });
  app.register({ name: 'CreatePass', label: 'Create Pass', category: 'Rendering', args: [{ name: 'Name', default: 'Pass' }], execute: (app, a) => app.scene.addPass(a.Name || 'Pass') });
}

function keyableParams(app: App, arg: any) {
  if (typeof arg === 'string' && arg && arg.includes('.')) { const p = findParam(app, arg); return p ? [p] : []; }
  const out: any[] = [];
  for (const n of app.selection) {
    if (n instanceof X3DObject) out.push(...n.kinematics.local.params.filter(p => p.keyable));
    else out.push(...n.params.filter(p => p.animatable && !p.def.readOnly));
  }
  return out;
}

export function findParam(app: App, path: string) {
  // e.g. "cube.kine.local.posx" or "cube.polymsh.geom.length"
  const parts = path.split('.'); const obj = app.scene.find(parts[0]); if (!obj) return undefined;
  const pname = parts[parts.length - 1]; const mid = parts.slice(1, -1).join('.');
  if (mid === 'kine.local') return obj.kinematics.local.get(pname);
  if (mid === 'kine.global') return obj.kinematics.global.get(pname);
  for (const pr of obj.properties) if (pr.type === mid || pr.name === mid) return pr.get(pname);
  if (obj.primitive) { if (mid === obj.primitive.type) return obj.primitive.get(pname); for (const op of obj.primitive.operators) if (mid.endsWith(op.type) || mid.endsWith(op.name)) return op.get(pname); }
  return undefined;
}

function cloneObject(app: App, o: X3DObject): X3DObject {
  const c = new X3DObject(app.scene.uniqueName(o.name), o.type);
  for (const p of o.kinematics.local.params) c.kinematics.local.get(p.name)!.value = p.value;
  c.properties.splice(0); for (const p of o.properties) { const np = new Property(p.name, p.type, p.params.map(x => ({ ...x.def, value: x.value }))); c.addProperty(np); }
  if (o.primitive) {
    const prim = new Primitive(o.primitive.name, o.primitive.type);
    for (const op of o.primitive.operators) {
      const n = op instanceof (makeGeomOperator('Cube').constructor as any) ? makeGeomOperator((op as any).preset) : makeDeformOperator((op as any).preset);
      if (n) { for (const p of op.params) n.get(p.name)!.value = p.value; prim.addOperator(n); }
    }
    c.setPrimitive(prim);
  }
  c.setMaterial(o.material);
  for (const ch of o.children) c.addChild(cloneObject(app, ch));
  return c;
}

export { color, bool };
