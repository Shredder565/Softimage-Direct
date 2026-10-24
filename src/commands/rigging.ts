// Character rigging: envelopes (Set Envelope, weights, smoothing, reassignment, locks), proportional guides and
// Create Rig from Guide (biped / quadruped), bone utilities.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Model, Null, Property, threeOrder } from '../core/scene';
import { ChainRoot, Bone, makeChain, makeImplicit } from '../core/scene2';
import { EnvelopeOperator, makeEnvelopeProperty, envelopeOf } from '../core/envelope';
import { mapCluster } from './clusters';
import { int, num, bool, enumP } from '../core/params';
import type { V3 } from '../core/curves';

const descendants = (o: X3DObject): X3DObject[] => o.children.flatMap(c => [c, ...descendants(c)]);
/** Expand a selection into deformers: chain roots → their bones; nulls, bones and effectors stay; models → all their bones/nulls. */
function deformersOf(objs: X3DObject[]): X3DObject[] {
  const out: X3DObject[] = [];
  for (const o of objs) {
    if (o instanceof ChainRoot) out.push(...o.bones);
    else if (o instanceof Model) out.push(...descendants(o).filter(c => c.type === 'bone' || c.type === 'null'));
    else if (['bone', 'null', 'eff', 'root'].includes(o.type) || !o.primitive?.mesh()) out.push(o);
  }
  return [...new Set(out)];
}
function envTargets(app: App, a: any): { meshes: X3DObject[]; deformers: X3DObject[] } {
  const sel = a.ConnectionSet ? app.targets(a.ConnectionSet) : app.selectedObjects; const meshes = sel.filter(o => o.primitive?.mesh());
  const defs = deformersOf(a.DeformerSet ? app.targets(a.DeformerSet) : sel.filter(o => !meshes.includes(o)));
  return { meshes, deformers: defs };
}
const selPoints = (app: App, o: X3DObject): number[] | null => { const cs = app.componentSel(); if (!cs || cs.obj !== o) return null; const m = o.primitive!.mesh()!; if (cs.sel.kind === 'point') return cs.sel.indices; if (cs.sel.kind === 'polygon') return [...new Set(cs.sel.indices.flatMap(p => m.polygons[p]))]; return [...new Set((cs.sel.edges ?? []).flat())]; };

export function registerRiggingCommands(app: App) {
  // ------------------------------------------------------------ envelopes
  app.register({
    name: 'ApplyFlexEnv', label: 'Set Envelope', category: 'Deformation|Envelope', description: 'Envelopes the selected meshes to the selected deformers (bones, nulls, chains).',
    args: [{ name: 'ConnectionSet', default: '' }, { name: 'DeformerSet', default: '' }, { name: 'Mode', default: 2 }, { name: 'DistanceWeighting', default: 0 }],
    execute(app, a) {
      const { meshes, deformers } = envTargets(app, a); if (!meshes.length) throw new Error('Set Envelope: select a polygon mesh and its deformers (bones, nulls or chains)'); if (!deformers.length) throw new Error('Set Envelope: pick the deformers (bones / nulls / chain roots) together with the mesh');
      let last: Property | null = null;
      for (const o of meshes) {
        const prim = o.primitive!; const existing = envelopeOf(o);
        if (existing) { existing.addDeformers(deformers); existing.computeWeights(prim.mesh()!, o.globalMatrix()); prim.dirty = true; last = o.property('envelope') ?? null; (last as any)?.refreshDeformers?.(); continue; }
        const op = new EnvelopeOperator(deformers, () => o); op.setReferencePoses(); if (a.Mode !== undefined) op.set('weighting', Number(a.DistanceWeighting ?? 0) ? 0 : Number(a.Mode) === 1 ? 1 : 0);
        const base = prim.mesh()!; op.computeWeights(base, o.globalMatrix());
        const prop = makeEnvelopeProperty(op); const cl = mapCluster(app, o, 'pnt');
        app.record('Set Envelope', () => { prim.addOperator(op); cl.addProperty(prop); }, () => { prim.removeOperator(op); cl.removeProperty(prop); });
        last = prop;
      }
      app.logMsg('info', `Envelope: ${meshes.map(m => m.name).join(', ')} ← ${deformers.length} deformer(s)`); if (last) app.select([last]); return last;
    },
  });
  app.register({ name: 'RemoveFlexEnv', label: 'Remove Envelope', category: 'Deformation|Envelope', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const op = envelopeOf(o); const prop = o.property('envelope'); if (!op) continue; const prim = o.primitive!; const cl = o.clusters.find(c => prop && c.properties.includes(prop)); app.record('Remove Envelope', () => { prim.removeOperator(op); if (prop && cl) cl.removeProperty(prop); }, () => { prim.addOperator(op); if (prop && cl) cl.addProperty(prop); }); } return null; } });
  app.register({ name: 'SetEnvelopeRefPoses', label: 'Set Reference Poses', category: 'Deformation|Envelope', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const op = envelopeOf(o); if (op) { op.setReferencePoses(); o.primitive!.dirty = true; } } app.events.emit('scene'); return null; } });
  app.register({ name: 'ResetEnvelopeWeights', label: 'Reset Envelope Weights', category: 'Deformation|Envelope', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const op = envelopeOf(o); if (op) { op.weights = []; op.computeWeights(o.primitive!.operators.slice(0, o.primitive!.operators.indexOf(op)).reduce((m: any, x) => x.apply(m), null) ?? o.primitive!.mesh()!, o.globalMatrix()); o.primitive!.dirty = true; } } app.events.emit('scene'); return null; } });
  app.register({ name: 'SISmoothEnvWght', label: 'Smooth Envelope Weights', category: 'Deformation|Envelope', args: [{ name: 'PropObj', default: '' }, { name: 'SubComp', default: '' }, { name: 'Iterations', default: 2 }], execute(app, a) { const objs = app.selectedObjects.filter(o => envelopeOf(o)); if (!objs.length) { const cs = app.compSel; if (cs && envelopeOf(cs.obj)) objs.push(cs.obj); } if (!objs.length) throw new Error('Select an enveloped mesh (or some of its points)'); for (const o of objs) { const op = envelopeOf(o)!; const pts = selPoints(app, o); op.smooth(o.primitive!.mesh()!, Math.max(1, Number(a.Iterations ?? 2)), pts ? new Set(pts) : undefined); o.primitive!.dirty = true; } app.events.emit('scene'); return null; } });
  app.register({ name: 'ReassignLocallyEnvWght', label: 'Reassign Locally', category: 'Deformation|Envelope', description: 'Gives the selected points entirely to the selected deformers.', args: [{ name: 'PropObj', default: '' }, { name: 'SubComp', default: '' }, { name: 'Deformers', default: '' }], execute(app, a) { const cs = app.compSel; const o = cs?.obj ?? app.selectedObjects.find(x => envelopeOf(x)); if (!o || !envelopeOf(o)) throw new Error('Select points of an enveloped mesh, then the deformers'); const op = envelopeOf(o)!; const defs = deformersOf(a.Deformers ? app.targets(a.Deformers) : app.selectedObjects.filter(x => x !== o)); if (!defs.length) throw new Error('Reassign Locally: select the deformer(s) too'); const pts = selPoints(app, o) ?? Array.from({ length: o.primitive!.mesh()!.positions.length / 3 }, (_, i) => i); op.addDeformers(defs); op.reassign(pts, defs); o.primitive!.dirty = true; (o.property('envelope') as any)?.refreshDeformers?.(); app.events.emit('scene'); app.logMsg('info', `Reassigned ${pts.length} point(s) to ${defs.map(d => d.name).join(', ')}`); return null; } });
  app.register({ name: 'LockEnvelopePointWeights', label: 'Lock Envelope Point Weights', category: 'Deformation|Envelope', args: [{ name: 'PropObj', default: '' }, { name: 'SubComp', default: '' }, { name: 'Locked', default: true }], execute(app, a) { const cs = app.compSel; const o = cs?.obj ?? app.selectedObjects.find(x => envelopeOf(x)); const op = o && envelopeOf(o); if (!o || !op) throw new Error('Select points of an enveloped mesh'); const pts = selPoints(app, o) ?? []; for (const i of pts) { if (a.Locked) op.locked.add(i); else op.locked.delete(i); } (o.property('envelope') as any)?.set('locked', op.locked.size); return null; } });
  app.register({ name: 'ClearEnvelopeWeightLocks', label: 'Clear Envelope Weight Locks', category: 'Deformation|Envelope', args: [{ name: 'PropObj', default: '' }], execute(app) { for (const o of app.selectedObjects) { const op = envelopeOf(o); if (op) { op.locked.clear(); (o.property('envelope') as any)?.set('locked', 0); } } return null; } });
  app.register({ name: 'LimitEnvelopeDeformers', label: 'Limit Envelope Deformers', category: 'Deformation|Envelope', args: [{ name: 'PropObj', default: '' }, { name: 'SubComp', default: '' }, { name: 'Limit', default: 2 }], execute(app, a) { for (const o of app.selectedObjects) { const op = envelopeOf(o); if (!op) continue; const lim = Math.max(1, Number(a.Limit ?? 2)); op.set('maxdeformers', lim); for (const w of op.weights) { const order = [...w.keys()].sort((x, y) => w[y] - w[x]); for (const k of order.slice(lim)) w[k] = 0; let s = 0; for (const x of w) s += x; if (s > 0) for (let k = 0; k < w.length; k++) w[k] /= s; } o.primitive!.dirty = true; } app.events.emit('scene'); return null; } });
  app.register({ name: 'SelectDeformersFromEnvelope', label: 'Select Deformers from Envelope', category: 'Deformation|Envelope', args: [{ name: 'InputObjs', default: '' }], undoable: false, execute(app, a) { const defs = app.targets(a.InputObjs).flatMap(o => envelopeOf(o)?.deformers ?? []); if (defs.length) app.select(defs); return defs; } });
  app.register({ name: 'InspectEnvelopeWeights', label: 'Inspect Envelope Weights', category: 'Deformation|Envelope', args: [], undoable: false, execute(app) { const o = app.selectedObjects.find(x => envelopeOf(x)) ?? app.compSel?.obj; const p = o?.property('envelope'); if (!p) throw new Error('Select an enveloped mesh'); app.events.emit('inspect', p); window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Weight Paint Panel' } })); return p; } });
  app.register({ name: 'AssociateEnvelopeBoundingVolume', label: 'Associate Envelope Bounding Volume', category: 'Deformation|Envelope', args: [{ name: 'InputObjs', default: '' }, { name: 'BndVolType', default: 'Inclusive' }], execute(app, a) { const vol = app.selectedObjects.find(o => o.type === 'implicit'); const def = app.selectedObjects.find(o => ['bone', 'null'].includes(o.type)); if (!vol || !def) throw new Error('Select a deformer and an implicit sphere/cube'); (def as any).envVolume = { obj: vol, type: a.BndVolType }; app.logMsg('info', `${def.name}: ${a.BndVolType} bounding volume ${vol.name}`); return null; } });
  app.register({ name: 'NormalizeEnvelopeWeights', label: 'Normalize Envelope Weights', category: 'Deformation|Envelope', args: [{ name: 'InputObjs', default: '' }], execute(app, a) {
    let n = 0;
    for (const o of app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects) {
      const op = envelopeOf(o); if (!op) continue;
      const pts = selPoints(app, o); op.normalizeAll(pts ?? undefined); o.primitive!.dirty = true; n++;
    }
    if (!n) throw new Error('Select an enveloped mesh'); app.events.emit('scene'); return n;
  } });
  app.register({ name: 'MirrorEnvelopeWeights', label: 'Mirror Envelope Weights', category: 'Deformation|Envelope', args: [{ name: 'InputObjs', default: '' }, { name: 'Axis', default: 0 }], execute(app, a) {
    const o = (app.targets(a.InputObjs)[0] ?? app.selectedObjects.find(x => envelopeOf(x)))!;
    const op = envelopeOf(o); if (!op) throw new Error('Select an enveloped mesh');
    const mesh = o.primitive!.mesh()!;
    const tmpl = o.properties.find(p => p.type === 'symmetrytemplate') ?? o.model?.properties.find(p => p.type === 'symmetrytemplate');
    const pairs = (tmpl as any)?.pairs as [number, number][] | undefined;
    op.mirrorWeights(mesh, pairs, Number(a.Axis ?? 0)); o.primitive!.dirty = true; app.events.emit('scene');
    app.logMsg('info', `MirrorEnvelopeWeights: ${pairs?.length ?? 'spatial'} pair(s) on ${o.name}`); return op.weights.length;
  } });
  app.register({ name: 'RemoveFlexEnvDeformer', label: 'Remove Envelope Deformer', category: 'Deformation|Envelope', args: [{ name: 'ConnectionSet', default: '' }, { name: 'Interactive', default: true }], execute(app, a) {
    const meshes = app.selectedObjects.filter(o => envelopeOf(o));
    const defs = deformersOf(app.selectedObjects.filter(o => !envelopeOf(o)));
    const hosts = meshes.length ? meshes : [...app.scene.allObjects()].filter(o => envelopeOf(o));
    if (!hosts.length) throw new Error('RemoveFlexEnvDeformer: select an enveloped mesh (and deformers to remove)');
    let n = 0;
    for (const o of hosts) {
      const op = envelopeOf(o)!;
      const remove = defs.length ? defs.filter(d => op.deformers.includes(d)) : op.deformers.slice(-1);
      if (!remove.length) continue;
      op.removeDeformers(remove); o.primitive!.dirty = true; (o.property('envelope') as any)?.refreshDeformers?.(); n += remove.length;
    }
    app.events.emit('scene'); app.logMsg('info', `RemoveFlexEnvDeformer: removed ${n} deformer(s)`); void a; return n;
  } });

  // ------------------------------------------------------------ guides and rigs
  type GuideDef = { name: string; pos: V3; parent?: string }; const L = 'L_', R = 'R_';
  const bipedGuide: GuideDef[] = [
    { name: 'Global', pos: [0, 0, 0] }, { name: 'Hips', pos: [0, 9.5, 0], parent: 'Global' }, { name: 'Spine1', pos: [0, 10.5, 0], parent: 'Hips' }, { name: 'Spine2', pos: [0, 12, 0], parent: 'Spine1' }, { name: 'Chest', pos: [0, 13.5, 0], parent: 'Spine2' }, { name: 'Neck', pos: [0, 15.2, 0], parent: 'Chest' }, { name: 'Head', pos: [0, 16.2, 0], parent: 'Neck' }, { name: 'HeadTop', pos: [0, 18, 0], parent: 'Head' },
    ...[L, R].flatMap((s, i) => { const x = i ? -1 : 1; return [
      { name: s + 'Shoulder', pos: [x * 1.2, 14.8, 0] as V3, parent: 'Chest' }, { name: s + 'Elbow', pos: [x * 4.6, 14.8, 0] as V3, parent: s + 'Shoulder' }, { name: s + 'Wrist', pos: [x * 7.8, 14.8, 0] as V3, parent: s + 'Elbow' }, { name: s + 'HandTip', pos: [x * 9.5, 14.8, 0] as V3, parent: s + 'Wrist' },
      { name: s + 'Hip', pos: [x * 1.1, 9.5, 0] as V3, parent: 'Hips' }, { name: s + 'Knee', pos: [x * 1.1, 5.2, 0.3] as V3, parent: s + 'Hip' }, { name: s + 'Ankle', pos: [x * 1.1, 1, 0] as V3, parent: s + 'Knee' }, { name: s + 'Toe', pos: [x * 1.1, 0.2, 1.6] as V3, parent: s + 'Ankle' }, { name: s + 'ToeTip', pos: [x * 1.1, 0.2, 2.6] as V3, parent: s + 'Toe' }]; }),
  ];
  const quadGuide: GuideDef[] = [
    { name: 'Global', pos: [0, 0, 0] }, { name: 'Hips', pos: [0, 8, -6], parent: 'Global' }, { name: 'Spine1', pos: [0, 8.5, -3], parent: 'Hips' }, { name: 'Spine2', pos: [0, 8.8, 0], parent: 'Spine1' }, { name: 'Chest', pos: [0, 8.5, 4], parent: 'Spine2' }, { name: 'Neck', pos: [0, 9.5, 6.5], parent: 'Chest' }, { name: 'Head', pos: [0, 11, 8.5], parent: 'Neck' }, { name: 'HeadTop', pos: [0, 11, 10.5], parent: 'Head' }, { name: 'Tail1', pos: [0, 8, -8], parent: 'Hips' }, { name: 'Tail2', pos: [0, 7, -10], parent: 'Tail1' }, { name: 'TailTip', pos: [0, 5.5, -12], parent: 'Tail2' },
    ...[L, R].flatMap((s, i) => { const x = i ? -1 : 1; return [
      { name: s + 'Shoulder', pos: [x * 1.5, 7.5, 4] as V3, parent: 'Chest' }, { name: s + 'Elbow', pos: [x * 1.5, 4.5, 4.4] as V3, parent: s + 'Shoulder' }, { name: s + 'Wrist', pos: [x * 1.5, 1.5, 4] as V3, parent: s + 'Elbow' }, { name: s + 'HandTip', pos: [x * 1.5, 0.2, 5] as V3, parent: s + 'Wrist' },
      { name: s + 'Hip', pos: [x * 1.5, 7, -6] as V3, parent: 'Hips' }, { name: s + 'Knee', pos: [x * 1.5, 4.5, -5] as V3, parent: s + 'Hip' }, { name: s + 'Ankle', pos: [x * 1.5, 2, -6.5] as V3, parent: s + 'Knee' }, { name: s + 'Toe', pos: [x * 1.5, 0.2, -5.5] as V3, parent: s + 'Ankle' }, { name: s + 'ToeTip', pos: [x * 1.5, 0.2, -4.5] as V3, parent: s + 'Toe' }]; }),
  ];
  const buildGuide = (app: App, modelName: string, defs: GuideDef[], style: number) => {
    const model = new Model(app.scene.uniqueName(modelName)); const made = new Map<string, X3DObject>();
    for (const d of defs) {
      const o = style === 1 ? makeImplicit(d.name, 'Cube') : new Null(d.name); if (style === 1) o.primitive?.set('size', 0.6); else if (o.get('size')) o.set('size', 0.4);
      (o as any).type = style === 1 ? 'implicit' : 'null'; const parent = d.parent ? made.get(d.parent) : undefined; const pp = parent ? [parent.kinematics.local.val('posx'), parent.kinematics.local.val('posy'), parent.kinematics.local.val('posz')] : null;
      // guides are a flat hierarchy of nulls under the model with global positions (so moving one guide does not drag the others), linked by the guide lines
      void pp; o.kinematics.local.set('posx', d.pos[0]); o.kinematics.local.set('posy', d.pos[1]); o.kinematics.local.set('posz', d.pos[2]); (o as any).guideParent = d.parent; model.addChild(o); made.set(d.name, o);
    }
    (model as any).guideDefs = defs; (model as any).isGuide = true;
    const prop = new Property('Guide Settings', 'guidesettings', [enumP('style', style, [{ label: 'Nulls', value: 0 }, { label: 'Cubes', value: 1 }], 'Guide Style'), bool('symmetry', true, 'Symmetric Editing'), int('spinebones', 3, 'Spine Bones', { min: 1, max: 8 }), int('neckbones', 1, 'Neck Bones', { min: 1, max: 4 }), num('bonesize', 1, 'Bone Display Size', { min: 0.1, max: 5 })]); model.addProperty(prop);
    app.record('Get Guide', () => app.scene.root.addChild(model), () => app.scene.root.removeChild(model)); app.select([model]); return model;
  };
  app.register({ name: 'GetProportionalGuide', label: 'Get Proportional Guide', category: 'Character Rigging', args: [{ name: 'ModelName', default: 'Biped_Guide' }, { name: 'GuideStyle', default: 0 }, { name: 'GuideSymmetry', default: 0 }], execute(app, a) { const quad = /Quadruped|Dog/i.test(String(a.ModelName)); return buildGuide(app, String(a.ModelName || 'Biped_Guide'), quad ? quadGuide : bipedGuide, Number(a.GuideStyle ?? 0)); } });
  app.register({ name: 'GetQuadrupedGuide', label: 'Get Quadruped Guide', category: 'Character Rigging', args: [{ name: 'ModelName', default: 'Quadruped_Guide' }, { name: 'GuideStyle', default: 0 }], execute: (app, a) => buildGuide(app, String(a.ModelName || 'Quadruped_Guide'), quadGuide, Number(a.GuideStyle ?? 0)) });

  /** Build chains between guide positions; returns the rig model. */
  const rigFromGuide = (app: App, guide: Model, rigName: string) => {
    const gp = (n: string): V3 => { const o = guide.children.find(c => c.name === n); if (!o) throw new Error(`Guide is missing ${n}`); const v = new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()); return [v.x, v.y, v.z]; };
    const settings = guide.property('guidesettings'); const spineBones = Number(settings?.val('spinebones') ?? 3);
    const rig = new Model(app.scene.uniqueName(rigName)); const made: X3DObject[] = [];
    const ctrl = (name: string, pos: V3, shape = 'Circle', size = 2) => { const c = makeImplicit(name, shape); c.primitive?.set('size', size); c.kinematics.local.set('posx', pos[0]); c.kinematics.local.set('posy', pos[1]); c.kinematics.local.set('posz', pos[2]); return c; };
    const global = ctrl('GlobalSRT', gp('Global'), 'Circle', 6); rig.addChild(global); const hipsCtrl = ctrl('Hip_Ctrl', gp('Hips'), 'Cube', 2.5); global.addChild(hipsCtrl);
    const chain = (name: string, pts: V3[], parent: X3DObject, planar = false) => {
      const root = makeChain(name, pts, planar); // built in world space; re-express the root in the parent's space so the chain lands on the guide
      const inv = parent.globalMatrix().invert(); const local = inv.multiply(new THREE.Matrix4().makeTranslation(pts[0][0], pts[0][1], pts[0][2]));
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); local.decompose(p, q, sc); const e = new THREE.Euler().setFromQuaternion(q, threeOrder(0)); const d = 180 / Math.PI; const l = root.kinematics.local;
      l.set('posx', p.x); l.set('posy', p.y); l.set('posz', p.z); l.set('rotx', e.x * d); l.set('roty', e.y * d); l.set('rotz', e.z * d); if (l.get('rotorder')) l.set('rotorder', 0);
      parent.addChild(root); made.push(root, ...root.bones); if (root.effector) made.push(root.effector); return root; };
    // spine: Hips → Chest with spineBones bones through the guide spine points
    const spinePts: V3[] = [gp('Hips'), ...(spineBones >= 3 ? [gp('Spine1'), gp('Spine2')] : spineBones === 2 ? [gp('Spine1')] : []), gp('Chest')]; const spine = chain('Spine', spinePts, hipsCtrl);
    const neck = chain('Neck', [gp('Neck'), gp('Head')], spine.bones[spine.bones.length - 1] ?? spine); const head = chain('Head', [gp('Head'), gp('HeadTop')], neck.bones[neck.bones.length - 1] ?? neck);
    for (const s of [L, R]) {
      const arm = chain(s + 'Arm', [gp(s + 'Shoulder'), gp(s + 'Elbow'), gp(s + 'Wrist')], spine.bones[spine.bones.length - 1] ?? spine, true); chain(s + 'Hand', [gp(s + 'Wrist'), gp(s + 'HandTip')], arm.bones[arm.bones.length - 1] ?? arm);
      const leg = chain(s + 'Leg', [gp(s + 'Hip'), gp(s + 'Knee'), gp(s + 'Ankle')], hipsCtrl, true); const foot = chain(s + 'Foot', [gp(s + 'Ankle'), gp(s + 'Toe'), gp(s + 'ToeTip')], leg.bones[leg.bones.length - 1] ?? leg, true);
      // IK controls on the effectors (hand / foot) + up-vector style knee / elbow controls
      const handC = ctrl(s + 'Hand_Ctrl', gp(s + 'Wrist'), 'Cube', 1.2); global.addChild(handC); const footC = ctrl(s + 'Foot_Ctrl', gp(s + 'Ankle'), 'Cube', 1.5); global.addChild(footC); const kneeC = ctrl(s + 'Knee_UpV', [gp(s + 'Knee')[0], gp(s + 'Knee')[1], gp(s + 'Knee')[2] + 4], 'Sphere', 0.6); global.addChild(kneeC); const elbowC = ctrl(s + 'Elbow_UpV', [gp(s + 'Elbow')[0], gp(s + 'Elbow')[1], gp(s + 'Elbow')[2] - 4], 'Sphere', 0.6); global.addChild(elbowC);
      if (arm.effector) (arm.effector as any).ikControl = handC; if (leg.effector) (leg.effector as any).ikControl = footC; void foot; void head;
    }
    if (guide.children.some(c => c.name === 'Tail1')) chain('Tail', [gp('Hips'), gp('Tail1'), gp('Tail2'), gp('TailTip')], hipsCtrl);
    app.record('Create Rig', () => app.scene.root.addChild(rig), () => app.scene.root.removeChild(rig));
    // hide the guide, like Softimage
    const vis = guide.property('visibility')?.get('viewvis'); if (vis) app.setParam(vis, false, 'Hide guide'); for (const c of guide.children) { const v = c.property('visibility')?.get('viewvis'); if (v) app.setParam(v, false, 'Hide guide'); }
    app.logMsg('info', `${rig.name}: ${made.filter(m => m.type === 'bone').length} bones, ${rig.children.length} controls`); app.select([rig]); return rig;
  };
  const guideOf = (app: App) => { let g = app.selectedObjects[0]?.model ?? app.selectedObjects[0]; while (g && !(g as any).isGuide && g.parentObj) g = g.parentObj; if (!g || !(g as any).isGuide) g = [...app.scene.allObjects()].find(o => (o as any).isGuide) as any; if (!g) throw new Error('Get a Proportional Guide first (Create > Skeleton > Biped Guide)'); return g as Model; };
  app.register({ name: 'CreateRigFromGuide', label: 'Create Rig from Biped Guide', category: 'Character Rigging', args: [{ name: 'Guide', default: '' }, { name: 'Name', default: 'Biped_Rig' }], execute: (app, a) => rigFromGuide(app, a.Guide ? (app.scene.find(a.Guide) as Model) : guideOf(app), a.Name || 'Biped_Rig') });
  app.register({ name: 'CreateRigFromQuadruped', label: 'Create Rig from Quadruped Guide', category: 'Character Rigging', args: [{ name: 'Guide', default: '' }, { name: 'Name', default: 'Quadruped_Rig' }], execute: (app, a) => rigFromGuide(app, a.Guide ? (app.scene.find(a.Guide) as Model) : guideOf(app), a.Name || 'Quadruped_Rig') });
  app.register({ name: 'CreateSkeletonFromGuide', label: 'Create Skeleton from Guide', category: 'Character Rigging', description: 'Bones only (no control objects).', args: [{ name: 'Guide', default: '' }, { name: 'Name', default: 'Biped_Skeleton' }], execute(app, a) { const rig = rigFromGuide(app, a.Guide ? (app.scene.find(a.Guide) as Model) : guideOf(app), a.Name || 'Biped_Skeleton'); for (const c of descendants(rig).filter(c => c.type === 'implicit' && c.name.endsWith('_Ctrl') || c.name.endsWith('_UpV'))) { const v = c.property('visibility')?.get('viewvis'); if (v) app.setParam(v, false); } return rig; } });

  // ------------------------------------------------------------ bones
  app.register({ name: 'ResizeBone', label: 'Resize Bone', category: 'Character Rigging', args: [{ name: 'InputObjs', default: '' }, { name: 'Length', default: 2 }], execute(app, a) { for (const b of app.targets(a.InputObjs).filter(o => o instanceof Bone)) app.setParam(b.get('length')!, Number(a.Length)); return null; } });
  app.register({ name: 'DuplicateSymmetryChain', label: 'Duplicate Chain Symmetrically', category: 'Character Rigging', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { const roots = app.targets(a.InputObjs).filter((o): o is ChainRoot => o instanceof ChainRoot); const out: ChainRoot[] = []; for (const r of roots) { const pts: V3[] = [r, ...r.bones].map(o => { const v = new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()); return [-v.x, v.y, v.z] as V3; }); if (r.effector) { const v = new THREE.Vector3().setFromMatrixPosition(r.effector.globalMatrix()); pts.push([-v.x, v.y, v.z]); } const c = makeChain(r.name.replace(/^L_/, 'R_').replace(/^R_(?!.*R_)/, 'L_') === r.name ? r.name + '_sym' : r.name.startsWith('L_') ? 'R_' + r.name.slice(2) : 'L_' + r.name.slice(2), pts, true); const p = r.parentObj ?? app.scene.root; app.record('Duplicate chain', () => p.addChild(c), () => p.removeChild(c)); out.push(c); } app.select(out); return out; } });
}
