// Ledger row CMD-B12d (optasks.dll), part 2: operator parameter, bevel profile and Slice Polygons plane connections.
//   ConnectOperatorParameter DisconnectOperatorParameter ConnectBevelProfileCurve DisconnectBevelProfileCurve
//   ConnectPlaneReferenceToSlicePolygonsOp DisconnectPlaneReferenceFromSlicePolygonsOp CreateGridAndConnectToSlicePolygonsOp
// Brief: docs/ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md, section 3. Original code from that prose
// only. Conventions: see optasksB12dShared.ts.
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { X3DObject, Operator, threeOrder } from '../core/scene';
import { selPoints } from '../core/topology';
import type { MeshData } from '../core/geometry';
import { inputGeom } from './meshCurveStepTasks';
import {
  S_OK, E_INVALIDARG, E_POINTER, E_NOINTERFACE, E_ACCESSDENIED, PortRef, stateOf, fail, setStatus, setOut, logNya, lockLevel,
  ownerOf, groupsOf, addInstance, removeInstance, disconnectPorts, connectPorts, paramDriver, paramConnections, paramArg,
  elementOf, firstOfList, elementKind, isSlice, isSubComponent, nameOf, unset, type Connectable,
} from './optasksB12dShared';

// ================================================================== operator parameters
function connectOperatorParameter(app: App, a: Record<string, any>) {
  const C = 'ConnectOperatorParameter';
  const p = paramArg(app, a.Parameter); const el = elementOf(app, a.ProjObj);
  const x = el instanceof PortRef ? null : el;
  if (!p || !x) throw fail(E_POINTER, `${C}: Parameter and ProjObj are required`);
  const op = p.owner;
  if (!(op instanceof Operator)) throw fail(E_NOINTERFACE, `${C}: ${p.fullName} is not a parameter of an operator`);
  const d = paramDriver(op, p.name);
  connectPorts(app, C, op, d.group, d.instance, d.ports, x);
  // F3DConnectOperatorParameterOnDelta stand-in: the parameter remembers the connected element
  const old = paramConnections.get(p) ?? null;
  app.record(C, () => { paramConnections.set(p, x); }, () => { if (old) paramConnections.set(p, old); else paramConnections.delete(p); });
  setStatus(app, C, S_OK);
}
function disconnectOperatorParameter(app: App, a: Record<string, any>) {
  const C = 'DisconnectOperatorParameter';
  const p = paramArg(app, a.Parameter);
  if (!p) throw fail(E_POINTER, `${C}: Parameter is required`);
  if (lockLevel(p) & 1) { app.logMsg('error', `${C}: ${p.fullName} is locked`); throw fail(E_ACCESSDENIED, `${C}: ${p.fullName} is locked`); }
  const op = p.owner;
  if (!(op instanceof Operator)) throw fail(E_NOINTERFACE, `${C}: ${p.fullName} is not a parameter of an operator`);
  const d = paramDriver(op, p.name); const g = groupsOf(op)[d.group];
  if (!g.dynamic) {
    const row = g.instances[d.instance] ?? [];
    const connected = d.ports.filter(i => row[i]);
    if (connected.length) disconnectPorts(app, C, op, d.group, d.instance, connected);
  } else if (d.instance < g.instances.length) removeInstance(app, C, op, d.group, d.instance);
  const old = paramConnections.get(p);
  if (old) app.record(C, () => { paramConnections.delete(p); }, () => { paramConnections.set(p, old); });   // inferred
  setStatus(app, C, S_OK);
}

// ================================================================== bevel profile curve
function targetOperator(app: App, C: string, v: any, slice: boolean): Operator {
  const t = firstOfList(app, v);
  if (t === null) throw fail(E_INVALIDARG, `${C}: Target is empty`);
  if (!(t instanceof Operator)) {
    if (slice) throw fail(E_INVALIDARG, `${C}: ${nameOf(t)} is not a Slice Polygons operator`);
    throw fail(E_POINTER, `${C}: ${nameOf(t)} is not an operator`);
  }
  if (slice && !isSlice(t)) throw fail(E_INVALIDARG, `${C}: ${t.name} is not a Slice Polygons operator`);
  return t;
}
/** Replace instance 0 of port group 1: remove it when present, then add a new one connected to `x` (two child tasks). */
function replaceGroup1(app: App, C: string, op: Operator, x: Connectable) {
  const g = groupsOf(op)[1];
  if (!g) throw fail(E_INVALIDARG, `${C}: ${op.name} has no port group 1`);
  if (g.instances.length) removeInstance(app, C, op, 1, 0);
  addInstance(app, C, op, 1, 0, [x]);
}
function connectBevelProfileCurve(app: App, a: Record<string, any>) {
  const C = 'ConnectBevelProfileCurve';
  const op = targetOperator(app, C, a.Target, false);
  const s = firstOfList(app, a.Source);
  if (s === null) throw fail(E_INVALIDARG, `${C}: Source is empty`);
  if (s instanceof PortRef) throw fail(E_INVALIDARG, `${C}: Source is a port`);
  replaceGroup1(app, C, op, s);
  if (!(s instanceof X3DObject && s.primitive?.curve())) logNya(app, C, `what the bevel operator does with "${nameOf(s)}", which has no curve geometry`, 'section 3');
  setStatus(app, C, S_OK);
}
/** The shared disconnect worker: removes instance 0 of port group 1. */
function disconnectGroup1(app: App, C: string, a: Record<string, any>, slice: boolean) {
  const op = targetOperator(app, C, a.Target, slice);
  const g = groupsOf(op)[1];
  if (g?.instances.length) removeInstance(app, C, op, 1, 0);
  setStatus(app, C, S_OK);
}

// ================================================================== Slice Polygons plane reference
/** inferred: the grid / plane class {3df7f9e2-...} = an object whose generator is the Grid primitive. */
export const isGridObject = (o: any): o is X3DObject => o instanceof X3DObject && (o.primitive?.operators[0] as any)?.preset === 'Grid';
function connectPlaneReference(app: App, a: Record<string, any>) {
  const C = 'ConnectPlaneReferenceToSlicePolygonsOp';
  const op = targetOperator(app, C, a.Target, true);
  const s = firstOfList(app, a.Source);
  if (s === null) throw fail(E_INVALIDARG, `${C}: Source is empty`);
  let variant: string;
  if (isGridObject(s)) variant = 'the plane object';
  else if (elementKind(s) === 7 && isGridObject(isSubComponent(s) ? s.obj : (s as any).obj)) variant = 'a sub-component of the plane object';
  else if (elementKind(s) === 2) variant = 'an object without a plane interface';
  else throw fail(E_INVALIDARG, `${C}: ${nameOf(s)} cannot be a plane reference`);
  // inferred (Q3): every variant replaces the operator's plane-reference input (port group 1, instance 0)
  replaceGroup1(app, C, op, s as Connectable);
  logNya(app, C, `the connect variant for ${variant} (port group used, removal of an existing reference)`, 'Q3');
  setStatus(app, C, S_OK);
}

type V3 = THREE.Vector3;
/** The operator's slicing plane in its owner's local space: origin and two axes (normal = u x v). */
function slicingPlaneLocal(op: Operator): { o: V3; u: V3; v: V3 } {
  const t: any = op; const P = (n: string, d = 0) => Number(op.get(n)?.value ?? d);
  const frame = (n: V3, o: V3) => {
    const u = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0).cross(n).normalize();
    // u perpendicular to n, v = n x u, so u x v = n
    return { o, u, v: n.clone().cross(u) };
  };
  if (t.preset === 'Slice Plane' && t.plane) { const n = new THREE.Vector3(...t.plane.n).normalize(); return frame(n, n.clone().multiplyScalar(t.plane.d)); }
  const sp = Math.trunc(P('sliceplane', t.preset === 'Slice' ? Number(op.get('axis')?.value ?? 0) : 0));
  if (sp === 3) {
    // inferred: the custom plane is planepos / planerot (SI XYZ order) around the axis named by planenormal
    const e = new THREE.Euler(...[P('planerotx'), P('planeroty'), P('planerotz')].map(d => d * Math.PI / 180) as [number, number, number], threeOrder(0));
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map(x => x.applyEuler(e));
    const k = Math.min(2, Math.max(0, Math.trunc(P('planenormal', 1))));
    return { o: new THREE.Vector3(P('planeposx'), P('planeposy'), P('planeposz')), u: axes[(k + 1) % 3], v: axes[(k + 2) % 3] };
  }
  const axis = Math.min(2, Math.max(0, sp));
  // the axis plane as this build evaluates it: bbox of the sliced points, Offset % along the axis, plus Offset
  const m = inputGeom(op) as MeshData | null; const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  if (m?.positions) {
    const sel = t.sel; const idx = sel?.indices?.length ? [...selPoints(m, sel)] : Array.from({ length: m.positions.length / 3 }, (_, i) => i);
    for (const i of idx) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i * 3 + k]); hi[k] = Math.max(hi[k], m.positions[i * 3 + k]); }
  }
  const ok = lo[0] <= hi[0];
  const usebbox = op.get('usebbox') ? !!op.get('usebbox')!.value : true;
  const off = Number((op.get('planeoffset') ?? op.get('offset'))?.value ?? 0);
  const d = (usebbox && ok ? lo[axis] + (hi[axis] - lo[axis]) * P('planeoffsetbboxpercentage', 50) / 100 : 0) + off;
  const o = new THREE.Vector3(); for (let k = 0; k < 3; k++) o.setComponent(k, k === axis ? d : ok ? (lo[k] + hi[k]) / 2 : 0);   // inferred: centred on the bbox
  return { o, u: new THREE.Vector3().setComponent((axis + 1) % 3, 1), v: new THREE.Vector3().setComponent((axis + 2) % 3, 1) };
}
function createGridAndConnect(app: App, a: Record<string, any>) {
  const C = 'CreateGridAndConnectToSlicePolygonsOp';
  const op = targetOperator(app, C, a.Target, true);
  const sliced = ownerOf(op);
  if (!sliced) throw fail(E_POINTER, `${C}: ${op.name} has no owner object`);
  // 1. the grid primitive (create-primitive child task)
  const grid = app.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface' }) as X3DObject;
  // 2. the slicing plane at the current time, in world space; normal = normalised u x v (kept when its length <= 1e-12)
  const pl = slicingPlaneLocal(op); const G = sliced.globalMatrix(); const N3 = new THREE.Matrix3().setFromMatrix4(G);
  const o = pl.o.clone().applyMatrix4(G), u = pl.u.clone().applyMatrix3(N3), v = pl.v.clone().applyMatrix3(N3);
  const n = u.clone().cross(v); if (n.length() > 1e-12) n.normalize();
  // 3. bbox of the sliced object in the plane frame; both grid sizes = its largest extent
  const ax = [u.clone().normalize(), n.length() > 1e-12 ? n.clone() : new THREE.Vector3(0, 1, 0), v.clone().normalize()];
  const m = sliced.primitive?.mesh(); let size = 0;
  if (m?.positions?.length) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; const w = new THREE.Vector3();
    for (let i = 0; i < m.positions.length; i += 3) {
      w.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(G).sub(o);
      ax.forEach((x, k) => { const d = w.dot(x); lo[k] = Math.min(lo[k], d); hi[k] = Math.max(hi[k], d); });
    }
    size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  }
  const gop = grid.primitive!.operators[0];
  if (size > 0) for (const k of ['ulength', 'vlength']) { const p = gop.get(k); if (p) app.setParam(p, size, C); }
  // 4. local position = plane origin; rotation = XYZ Euler angles (degrees) of the rotation taking +Y onto the normal
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.length() > 1e-12 ? n : new THREE.Vector3(0, 1, 0));
  const e = new THREE.Euler().setFromQuaternion(q, threeOrder(0)); const deg = (r: number) => r * 180 / Math.PI;
  const L = grid.kinematics.local;
  const values: [string, number][] = [['posx', o.x], ['posy', o.y], ['posz', o.z], ['rotx', deg(e.x)], ['roty', deg(e.y)], ['rotz', deg(e.z)]];
  for (const [k, val] of values) app.setParam(L.get(k)!, val, C);
  // 5. the grid becomes the plane reference (child task)
  replaceGroup1(app, C, op, grid);
  // 6. operator parameter id 4 = false. inferred: id 4 is `usebbox`, the fifth parameter of C3DSlicePolygonsOp.spdl
  const p4 = op.get('usebbox'); if (p4) app.setParam(p4, false, C);
  // 7. a final child task on [grid]. inferred: select it (Q5)
  app.select([grid]);
  logNya(app, C, 'the final child task run on the one-element list holding the grid (selected here)', 'Q5');
  setOut(app, C, a, { Value: grid });
  setStatus(app, C, S_OK);
  return grid;
}

// ================================================================== registration
export function registerOptasksB12dConnectCommands(app: App) {
  const reg = (def: Omit<CommandDef, 'category'>) => app.register({ category: 'Operator', ...def } as CommandDef);
  const target = { name: 'Target', default: null }, source = { name: 'Source', default: null };
  reg({ name: 'ConnectOperatorParameter', label: 'Connect Operator Parameter', description: 'Connects an object to the ports that drive an operator parameter.',
    args: [{ name: 'Parameter', default: null }, { name: 'ProjObj', default: null }], execute: (app, a) => connectOperatorParameter(app, a) });
  reg({ name: 'DisconnectOperatorParameter', label: 'Disconnect Operator Parameter', description: 'Disconnects the ports that drive an operator parameter.',
    args: [{ name: 'Parameter', default: null }], execute: (app, a) => disconnectOperatorParameter(app, a) });
  reg({ name: 'ConnectBevelProfileCurve', label: 'Connect Bevel Profile Curve', description: 'Connects a profile curve to a bevel operator.',
    args: [target, source], execute: (app, a) => connectBevelProfileCurve(app, a) });
  reg({ name: 'DisconnectBevelProfileCurve', label: 'Disconnect Bevel Profile Curve', description: 'Disconnects the profile curve of a bevel operator.',
    args: [target], execute: (app, a) => disconnectGroup1(app, 'DisconnectBevelProfileCurve', a, false) });
  reg({ name: 'ConnectPlaneReferenceToSlicePolygonsOp', label: 'Connect Plane Reference to Slice Polygons', description: 'Connects a plane reference to a Slice Polygons operator.',
    args: [target, source], execute: (app, a) => connectPlaneReference(app, a) });
  reg({ name: 'DisconnectPlaneReferenceFromSlicePolygonsOp', label: 'Disconnect Plane Reference from Slice Polygons', description: 'Disconnects the plane reference of a Slice Polygons operator.',
    args: [target], execute: (app, a) => disconnectGroup1(app, 'DisconnectPlaneReferenceFromSlicePolygonsOp', a, true) });
  reg({ name: 'CreateGridAndConnectToSlicePolygonsOp', label: 'Create Grid and Connect to Slice Polygons', description: 'Creates a grid on the slicing plane and connects it as the plane reference.',
    args: [target], execute: (app, a) => createGridAndConnect(app, a) });
  void stateOf; void unset;
}
