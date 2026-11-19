// Ledger row CMD-B12e (optasks.dll), part 2: clusters and properties across a generator, PropertyTransfer,
// SITransferCenter.
//   TransferPropertiesAcrossGenOp TransferClusterPropertiesAcrossGenOp SIBasicTransferClusterPropertiesAcrossGenOp
//   SIBasicTransferClustersAcrossGenOp PropertyTransfer SITransferCenter
// Brief: docs/ghidra/cmd-b12e-optasks-generator-transfers-binary.md, section 3. Original code from that prose only.
import * as THREE from 'three';
import { App } from '../core/commands';
import { CenterOperator } from './uixsiClipsDisplayAddons';
import {
  S_OK, E_INVALIDARG, E_POINTER, E_NOTIMPL, E_UNEXPECTED, ERR_GENERATOR, ERR_OBJECT, ERR_CLUSTER, ERR_CLUSTER_PROP, ERR_PROPERTY,
  PROPERTY_XFER_PRESET, stateOf, fail, setStatus, raiseInvalid, logNya, unset, nodesArg, nodeArg, numArg, boolArg, isGenerator,
  genInputs, genOwner, copyProperty, uniqueIn, ownerObject, X3DObject, Operator, Cluster, Property, Material, Node,
} from './optasksB12eShared';

// ------------------------------------------------------------------ validation (note section 2)
/** 0x111: Operator is a generator operator whose output is Object. */
function checkGenerator(app: App, C: string, op: Node | null, obj: Node | null): Operator {
  if (!op || !isGenerator(op) || (obj && genOwner(op) !== obj) || !genOwner(op)) throw raiseInvalid(app, C, ERR_GENERATOR, `${op?.name ?? '(none)'} is not a generator operator of ${obj?.name ?? 'the object'}`);
  return op;
}
/** 0x112: Object exposes geometry / clusters. */
function checkObject(app: App, C: string, obj: Node | null): X3DObject {
  if (!(obj instanceof X3DObject) || !obj.primitive) throw raiseInvalid(app, C, ERR_OBJECT, `${obj?.name ?? '(none)'} has no geometry`);
  return obj;
}
const fromInputs = (op: Operator, n: Node) => { const o = ownerObject(n); return !!o && genInputs(op).includes(o); };
/** 0x113: a cluster of one of the operator's inputs. */
function checkCluster(app: App, C: string, op: Operator, c: Node | null): Cluster {
  if (!(c instanceof Cluster) || !fromInputs(op, c)) throw raiseInvalid(app, C, ERR_CLUSTER, `${c?.name ?? '(none)'} is not a cluster of the generator's inputs`);
  return c;
}
/** 0x114: a cluster property of one of the operator's inputs. */
function checkClusterProp(app: App, C: string, op: Operator, p: Node | null): Property {
  if (!(p instanceof Property) || !(p.parent instanceof Cluster) || !fromInputs(op, p)) throw raiseInvalid(app, C, ERR_CLUSTER_PROP, `${p?.name ?? '(none)'} is not a cluster property of the generator's inputs`);
  return p;
}

// ------------------------------------------------------------------ clusters
/** Number of components of a kind on an object's geometry. */
function compCount(o: X3DObject, kind: Cluster['compKind']): number {
  const m = o.primitive?.mesh(); if (m) {
    if (kind === 'pnt') return m.positions.length / 3;
    if (kind === 'poly') return m.polygons.length;
    if (kind === 'sample') return m.polygons.reduce((s, f) => s + f.length, 0);
    const seen = new Set<string>(); for (const f of m.polygons) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; seen.add(a < b ? `${a}-${b}` : `${b}-${a}`); } return seen.size;
  }
  const c = o.primitive?.curve(); if (c && kind === 'pnt') return c.cvs.length;
  return Infinity;
}
/** Create on `obj` the transferred copy of `src` and link it (SIBasicTransferClustersAcrossGenOp body). */
function transferCluster(app: App, C: string, op: Operator, obj: X3DObject, src: Cluster, name: string, mode: number): Cluster {
  const st = stateOf(app);
  // element type: this build's component kinds (pnt / edge / poly / sample) do not depend on the geometry type, so the
  // switch between the two geometry-type GUIDs of the note changes nothing here   // inferred
  const kind = src.compKind;
  // inferred: the new cluster keeps the source's element indices (same count), clipped to the target's components
  const n = compCount(obj, kind);
  const elems = [...src.elements].filter(e => typeof e !== 'number' || e < n);
  const c = new Cluster(uniqueIn(obj.clusters, name || src.name), kind, new Set(elems));   // inferred: empty name -> source name
  const list = st.opClusters.get(op) ?? [];
  app.record(C, () => {
    obj.addCluster(c); st.links.set(c, { source: src, op, mode, command: C }); list.push(c); st.opClusters.set(op, list); st.createdBy.set(c, C);
  }, () => {
    obj.removeCluster(c); c.parent = null; st.links.delete(c); const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); st.createdBy.delete(c);
  });
  return c;
}
function basicTransferClusters(app: App, a: Record<string, any>) {
  const C = 'SIBasicTransferClustersAcrossGenOp';
  const op = nodeArg(app, a.Operator), obj = nodeArg(app, a.Object), src = nodeArg(app, a.ClustersToTransfer, false);
  if (!op || !obj || !src) throw fail(E_POINTER, `${C}: Operator, Object and ClustersToTransfer are required`);
  const g = checkGenerator(app, C, op, obj); const o = checkObject(app, C, obj); const cl = checkCluster(app, C, g, src);
  const c = transferCluster(app, C, g, o, cl, String(a.ClusterName ?? ''), 0);
  a.Value = c; setStatus(app, C, S_OK);
  return c;
}

// ------------------------------------------------------------------ cluster properties
function basicTransferClusterProps(app: App, a: Record<string, any>) {
  const C = 'SIBasicTransferClusterPropertiesAcrossGenOp';
  const op = nodeArg(app, a.Operator), prop = nodeArg(app, a.ClusterPropsToTransfer, false);
  if (!op || !prop) throw fail(E_POINTER, `${C}: Operator and ClusterPropsToTransfer are required`);
  const g = checkGenerator(app, C, op, null); const obj = checkObject(app, C, genOwner(g)); const p = checkClusterProp(app, C, g, prop);
  let target = nodeArg(app, a.Cluster, false);
  if (target && (!(target instanceof Cluster) || target.obj !== obj)) throw raiseInvalid(app, C, ERR_OBJECT, `${target.name} is not a cluster of ${obj.name}`);   // inferred
  if (!target) target = transferCluster(app, C, g, obj, p.parent as Cluster, '', 1);
  const cl = target as Cluster;
  // inferred: the value-transfer helper 0x1800502e0 was not read; the values are copied one to one
  logNya(app, C, 'the value transfer through the generator; the property values were copied one to one');
  const np = copyProperty(p, uniqueIn(cl.properties, String(a.ClusterPropertyName ?? '') || p.name));
  const st = stateOf(app);
  app.record(C, () => { cl.addProperty(np); st.links.set(np, { source: p, op: g, mode: 1, command: C }); st.createdBy.set(np, C); },
    () => { cl.removeProperty(np); st.links.delete(np); st.createdBy.delete(np); });
  a.Value = np; setStatus(app, C, S_OK);
  return np;
}
function transferClusterProps(app: App, a: Record<string, any>) {
  const C = 'TransferClusterPropertiesAcrossGenOp';
  const op = nodeArg(app, a.Operator), obj = nodeArg(app, a.Object);
  const g = checkGenerator(app, C, op, obj); const o = checkObject(app, C, obj);
  const props = nodesArg(app, a.ClusterPropsToTransfer, false);
  if (!props.length) throw raiseInvalid(app, C, ERR_CLUSTER_PROP, 'no cluster property to transfer');
  const list = props.map(p => checkClusterProp(app, C, g, p));
  const st = stateOf(app); const out: Property[] = [];
  for (const p of list) {
    const src = p.parent as Cluster;
    // (1) the owning cluster, reused when already transferred through this generator   // inferred
    let cl = o.clusters.find(c => st.links.get(c)?.source === src && st.links.get(c)?.op === g) ?? null;
    if (!cl) cl = app.run('SIBasicTransferClustersAcrossGenOp', { Operator: g, Object: o, ClustersToTransfer: src, ClusterName: src.name });
    // (2) the property onto that cluster
    const np = app.run('SIBasicTransferClusterPropertiesAcrossGenOp', { Operator: g, Cluster: cl, ClusterPropsToTransfer: p, ClusterPropertyName: String(a.ClusterPropertyName ?? '') });
    // (3) rebind
    if (boolArg(a.RebindClusterProperties, true)) logNya(app, C, `the rebind step of ${np.name} (helpers 0x180067380 / 0x180066ec0 / 0x1800677e0 not read)`);
    out.push(np);
  }
  const v = out.length === 1 ? out[0] : out;
  a.Value = v; setStatus(app, C, S_OK);
  return v;
}

// ------------------------------------------------------------------ properties
/** Property kinds of the transfer helper: 1 cluster property, 2 object property, 0 not transferable.   // inferred */
function kindOf(n: Node): number {
  if (n instanceof Property && n.parent instanceof Cluster) return 1;
  if (n instanceof Material) return 2;
  if (n instanceof Property && n.parent instanceof X3DObject) return 2;
  return 0;
}
function transferProperties(app: App, a: Record<string, any>) {
  const C = 'TransferPropertiesAcrossGenOp';
  const op = nodeArg(app, a.Operator), obj = nodeArg(app, a.Object);
  const g = checkGenerator(app, C, op, obj); const o = checkObject(app, C, obj);
  const props = nodesArg(app, a.PropertiesToTransfer, false);
  if (!props.length) throw raiseInvalid(app, C, ERR_PROPERTY, 'no property to transfer');
  for (const p of props) if (!(p instanceof Material ? genInputs(g).some(i => i.material === p) : fromInputs(g, p))) throw raiseInvalid(app, C, ERR_PROPERTY, `${p.name} is not a property of the generator's inputs`);
  logNya(app, C, 'the property classification helper; cluster properties are kind 1, object properties and materials kind 2');
  const share = boolArg(a.ShareProperty, true), withCls = boolArg(a.TransferClusterProperties, true);
  const name = String(a.PropertyName ?? '');
  const out: Node[] = []; const mats: Material[] = [];
  for (const p of props) {
    const k = kindOf(p);
    if (k === 0) throw fail(E_NOTIMPL, `${C}: ${p.name} cannot be transferred`);
    if (k === 1) {
      if (!withCls) continue;
      const r = app.run('TransferClusterPropertiesAcrossGenOp', { Operator: g, Object: o, ClusterPropsToTransfer: p, ClusterPropertyName: name });
      out.push(...(Array.isArray(r) ? r : [r]));
    } else if (k === 2) {
      if (p instanceof Material) {
        // a material is shared onto the object (as AssignMaterial does on this build)
        if (!share) logNya(app, C, `copying the material ${p.name}; it was shared`);
        const old = o.material;
        app.record(C, () => o.setMaterial(p), () => o.setMaterial(old));
        mats.push(p); out.push(p);
      } else {
        if (share) logNya(app, C, `sharing ${p.name}; a copy was made`);
        const np = copyProperty(p as Property, uniqueIn(o.properties, name || p.name));
        const st = stateOf(app);
        app.record(C, () => { o.addProperty(np); st.createdBy.set(np, C); }, () => { o.removeProperty(np); st.createdBy.delete(np); });
        out.push(np);
      }
    } else throw fail(E_UNEXPECTED, `${C}: unknown property kind`);
  }
  if (mats.length) {
    app.logMsg('info', `${C}: Rebind tasks (${mats.map(m => m.name).join(', ')})`);
    for (const m of mats) logNya(app, C, `the rebind sub-task of material ${m.name}`);
  }
  const v = out.length === 1 ? out[0] : out;
  a.Value = v; setStatus(app, C, S_OK);
  return v;
}

// ------------------------------------------------------------------ PropertyTransfer
/** The PropertyXferOp the ApplyOperator sub-task creates (stand-in; its connection groups are not attested). */
export class PropertyXferOp extends Operator {
  readonly preset = PROPERTY_XFER_PRESET;
  readonly connectionMode = 2; readonly flags = 4;
  constructor(readonly target: X3DObject, readonly source: Property) { super('PropertyXferOp', 'PropertyXferOp', []); }
}
function propertyTransfer(app: App, a: Record<string, any>) {
  const C = 'PropertyTransfer';
  const targets = nodesArg(app, a.Target), props = nodesArg(app, a.PropObj, false);
  if (!targets.length || !props.length) throw fail(E_INVALIDARG, `${C}: Target and PropObj must not be empty`);
  const t = targets[0], p = props[0];
  // inferred owner check: the target is an object with geometry and PropObj is a property
  if (!(t instanceof X3DObject) || !t.primitive || !(p instanceof Property)) throw fail(E_INVALIDARG, `${C}: ${p.name} cannot be transferred onto ${t.name}`);
  logNya(app, C, 'the owner check and the four connection groups of the PropertyXferOp; the operator carries the target and the property only');
  const op = new PropertyXferOp(t, p); const prim = t.primitive;
  app.record('ApplyOperator', () => prim.addOperator(op), () => prim.removeOperator(op));
  setStatus(app, C, S_OK);
  return op;
}

// ------------------------------------------------------------------ SITransferCenter
function transferCenter(app: App, a: Record<string, any>) {
  const C = 'SITransferCenter';
  if (unset(a.InputObj) && !app.selection.length) throw fail(E_INVALIDARG, `${C}: InputObj is empty`);
  const objs = nodesArg(app, a.InputObj).filter((n): n is X3DObject => n instanceof X3DObject);
  const x = numArg(a.X, 0), y = numArg(a.Y, 0), z = numArg(a.Z, 0);
  for (const o of objs) {
    // centre: local = local * T(x, y, z) (translation only, so rotation and scaling are unchanged)
    const p = new THREE.Vector3(x, y, z).applyMatrix4(o.kinematics.localMatrix());
    const l = o.kinematics.local;
    app.setParam(l.get('posx')!, p.x, C); app.setParam(l.get('posy')!, p.y, C); app.setParam(l.get('posz')!, p.z, C);
    // geometry: the inverse, so the points stay in place in world space
    const prim = o.primitive;
    if (prim && prim.operators.length) { const op = new CenterOperator(new THREE.Matrix4().makeTranslation(-x, -y, -z)); app.record(C, () => prim.addOperator(op), () => prim.removeOperator(op)); }
  }
  setStatus(app, C, S_OK);
}

export function registerOptasksB12eTransferCommands(app: App) {
  app.register({
    name: 'TransferPropertiesAcrossGenOp', label: 'Transfer Properties Across Generator Operator', category: 'Modeling|Generator',
    description: 'Transfers properties of a generator\'s inputs onto the generated object.',
    args: [{ name: 'Operator' }, { name: 'Object' }, { name: 'PropertiesToTransfer' }, { name: 'PropertyName', default: '' }, { name: 'ShareProperty', default: true }, { name: 'TransferClusterProperties', default: true }],
    execute: transferProperties,
  });
  app.register({
    name: 'TransferClusterPropertiesAcrossGenOp', label: 'Transfer Cluster Properties Across Generator Operator', category: 'Modeling|Generator',
    description: 'Transfers cluster properties of a generator\'s inputs (and their clusters) onto the generated object.',
    args: [{ name: 'Operator' }, { name: 'Object' }, { name: 'ClusterPropsToTransfer' }, { name: 'ClusterPropertyName', default: '' }, { name: 'RebindClusterProperties', default: true }],
    execute: transferClusterProps,
  });
  app.register({
    name: 'SIBasicTransferClusterPropertiesAcrossGenOp', label: 'Basic Cluster Property Transfer Across Generator Operator', category: 'Modeling|Generator',
    description: 'Creates a cluster property on a cluster of the generated object from a cluster property of an input.',
    args: [{ name: 'Operator' }, { name: 'Cluster' }, { name: 'ClusterPropsToTransfer' }, { name: 'ClusterPropertyName', default: '' }],
    execute: basicTransferClusterProps,
  });
  app.register({
    name: 'SIBasicTransferClustersAcrossGenOp', label: 'Basic Cluster Transfer Across Generator Operator', category: 'Modeling|Generator',
    description: 'Creates on the generated object a cluster linked to a cluster of an input.',
    args: [{ name: 'Operator' }, { name: 'Object' }, { name: 'ClustersToTransfer' }, { name: 'ClusterName', default: '' }],
    execute: basicTransferClusters,
  });
  app.register({
    name: 'PropertyTransfer', label: 'Connect PropertyXferOp', category: 'Property',
    description: 'Connects a property transfer operator from a property onto a target object.',
    args: [{ name: 'Target' }, { name: 'PropObj' }], execute: propertyTransfer,
  });
  app.register({
    name: 'SITransferCenter', label: 'Transfer Center', category: 'Transform',
    description: 'Moves the objects\' centres by (X, Y, Z) in local space; the geometry stays in place.',
    args: [{ name: 'InputObj' }, { name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }],
    execute: transferCenter,
  });
}
