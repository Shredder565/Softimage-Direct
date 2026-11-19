// Ledger row CMD-B13a (bvrexport.dll), part 1: actor description commands.
//   BvrInitActor BvrSetHome BvrGotoHome BvrGenerateActor BvrSetCOG BvrSetFoot BvrAddColSphere BvrAddFloor
//   BvrSetCollisionOnly BvrSetVisualOnly BvrSetDefault BvrAddJointLimit BvrRemoveCOG BvrRemoveFoot BvrRemoveFloor
//   BvrRemoveJointLimit
// Brief: docs/ghidra/cmd-b13a-bvrexport-behavior-binary.md, section 3. Original code from that prose only.
import * as THREE from 'three';
import { App } from '../core/commands';
import {
  stateOf, msgBox, fatal, abort, logNya, shiftHeld, progress, withCmdLogOff, inspect, gate, actorModel, actorRoot, nestedCheck,
  resolveCog, purgeTemp, ensureRtkNode, ensureProp, findProp, makeTag, addProp, deleteProp, deleteObjs, setVal, setWire, fitActor,
  storeHome, applyHome, scaleCheck, isAnimated, removeAnimation, globalPos, putGlobalPos, geomYRange, isLightOrCamera, body,
  makeBehaviorGen, makeBehaviorJL, rtkSphereDefs, rtkFloorDefs, rtkEffectorDefs, MSG_GATE, MB_OKCANCEL, MB_YESNO, ID_CANCEL, ID_NO,
  WIRE_DEFAULT, WIRE_VISUAL, WIRE_COLLISION, WIRE_FOOT, WIRE_SPHERE, X3DObject, Model, Null, Property,
} from './bvrB13aShared';

const node = (x: X3DObject | Property) => x as X3DObject;

// ------------------------------------------------------------------ BvrInitActor
/** The Initialize worker (also run by SetHome and, per the note, by Generate and ImportBVHActor). */
export function initWorker(app: App, C: string, n: X3DObject, shift: boolean, caption = 'Initializing Actor') {
  const model = actorModel(app, C, n);
  progress(app, C, caption);
  const root = actorRoot(app, C, model);
  nestedCheck(app, C, root);
  const cog = resolveCog(app, C, root);
  purgeTemp(app, model);
  ensureRtkNode(app, root);
  const walk = (o: X3DObject) => {
    if (isLightOrCamera(o)) return;
    ensureRtkNode(app, o);
    const end = findProp(o, 'RTKEnd'); if (end) deleteProp(app, end);
    if (!o.children.length) addProp(app, o, makeTag('RTKEnd'));
    for (const c of [...o.children]) walk(c);
  };
  walk(cog);
  if (shift) fitActor(app, root);
  return { model, root, cog };
}
const initActor = body((app) => {
  const C = 'BvrInitActor';
  const n = node(gate(app, C, MSG_GATE('Initialize')));
  const shift = shiftHeld(app);
  withCmdLogOff(app, C, () => initWorker(app, C, n, shift));
});

// ------------------------------------------------------------------ BvrSetHome
export function setHomeWorker(app: App, C: string, n: X3DObject, shiftNotHeld: boolean) {
  const model = actorModel(app, C, n);
  progress(app, C, 'Storing Home Pose');
  const root = actorRoot(app, C, model);
  nestedCheck(app, C, root);
  resolveCog(app, C, root);
  const actor = findProp(root, 'RTKActor');
  if (shiftNotHeld && actor) {
    if (!scaleCheck(app, C, root, 'Set Home action', true)) abort();
    logNya(app, C, 'helper 0x180002970 after the scale check (inferred: re-bases the actor root)');
  }
  const fix = findProp(root, 'RTKFixHomeBase');
  if (shiftNotHeld && !fix) addProp(app, root, makeTag('RTKFixHomeBase'));
  else if (!shiftNotHeld && fix) deleteProp(app, fix);
  if (findProp(root, 'RTKActor')) fitActor(app, root);
  initWorker(app, C, n, false);
  for (const c of model.children) storeHome(app, c);   // every non-sphere node under the model
}
const setHome = body((app) => {
  const C = 'BvrSetHome';
  const n = node(gate(app, C, MSG_GATE('Set Home')));
  const shiftNotHeld = !shiftHeld(app);
  withCmdLogOff(app, C, () => setHomeWorker(app, C, n, shiftNotHeld));
});

// ------------------------------------------------------------------ BvrGotoHome
const gotoHome = body((app) => {
  const C = 'BvrGotoHome';
  const n = node(gate(app, C, MSG_GATE('Goto Home')));
  withCmdLogOff(app, C, () => {
    const model = actorModel(app, C, n);
    progress(app, C, 'Applying Home Pose');
    const root = actorRoot(app, C, model);
    if (!findProp(root, 'RTKHomePose')) return;
    const actor = !!findProp(root, 'RTKActor');
    if (!actor && isAnimated(app, root)) {
      if (msgBox(app, C, 'Is it okay to remove the embedded FCurves on the rig (the FCurves conflict with the Goto Home action)?', MB_OKCANCEL) === ID_CANCEL) return;
      removeAnimation(app, root);
    }
    applyHome(app, model, false);
    if (!actor) { applyHome(app, model, true); applyHome(app, model, false); applyHome(app, model, true); }
  });
});

// ------------------------------------------------------------------ BvrGenerateActor (SPEC-PARTIAL)
const generateActor = body((app) => {
  const C = 'BvrGenerateActor';
  const n = node(gate(app, C, MSG_GATE('Generate')));
  app.run('DeselectAll');
  const model = actorModel(app, C, n, 'The source actor description must be contained by a single model (scene root not supported).');
  const root = actorRoot(app, C, model);
  nestedCheck(app, C, root);
  resolveCog(app, C, root);
  if (!findProp(root, 'RTKNode')) fatal(app, C, 'The source actor description must be initialized.');
  const gen = ensureProp(app, root, 'BehaviorGen', makeBehaviorGen);
  if (!inspect(app, C, gen, 'Generate Actor', 4, true)) return;
  const opts = Object.fromEntries(['Envelope', 'Box', 'RemoveExtra', 'Cog', 'Factor', 'Skill', 'RemovePoly'].map(k => [k, gen.val(k)]));
  withCmdLogOff(app, C, () => {
    progress(app, C, 'Generating Actor');
    if (isAnimated(app, root) && msgBox(app, C, 'Is it okay to remove the embedded FCurves on the rig?', MB_OKCANCEL) === ID_CANCEL) return;
    stateOf(app).workers.push({ command: C, worker: 'generate', args: { ...opts, factor: Number(opts.Factor) * 0.5, homePose: !!findProp(root, 'RTKHomePose'), fixHomeBase: !!findProp(root, 'RTKFixHomeBase') } });
    logNya(app, C, 'building the generated actor (0x1800105c0), its initialization, clean-up, SetHome and skill transfer (0x18000f470, 0x180017750)');
  });
});

// ------------------------------------------------------------------ BvrSetCOG
const setCog = body((app) => {
  const C = 'BvrSetCOG';
  const n = node(gate(app, C, MSG_GATE('Set COG')));
  const model = actorModel(app, C, n, 'The actor description must be contained by a single model (scene root not supported).');
  const root = actorRoot(app, C, model);
  nestedCheck(app, C, root, 'The source description must be contained by a single model (embedded models not supported).');
  if (isLightOrCamera(n)) fatal(app, C, 'The COG node can not be a light or camera.');
  if (n.parentObj?.parentObj !== model) fatal(app, C, 'The COG node must be two levels below the model.');
  if (!findProp(n, 'RTKCogNode')) addProp(app, n, makeTag('RTKCogNode'));
});

// ------------------------------------------------------------------ collision spheres (AddColSphere, SetFoot)
/** A collision sphere under `parent` at a global position (note: AddColSphere, without the inspector). */
function makeColSphere(app: App, parent: X3DObject, radius: number, pos: THREE.Vector3): X3DObject {
  const sel = [...app.selection];
  const s: X3DObject = app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: `${parent.name}_CS`, Parent: parent.fullName });
  app.select(sel);
  putGlobalPos(app, s, pos);
  const op = s.primitive?.operators[0]; const rp = op?.get('radius'); if (rp) app.setParam(rp, radius, 'SetValue');
  ensureRtkNode(app, s);
  addProp(app, s, makeTag('RTKSphere', rtkSphereDefs(radius)));
  setWire(app, s, WIRE_SPHERE);
  return s;
}
const addColSphere = body((app) => {
  const C = 'BvrAddColSphere';
  const n = node(gate(app, C, MSG_GATE('Add Col Sphere')));
  withCmdLogOff(app, C, () => {
    if (n.parentObj instanceof Model) fatal(app, C, 'The Add Collision Sphere action can not be applied to the root node of an actor.');
    const g = globalPos(n); const yr = geomYRange(n);
    const r = yr ? Math.abs(g.y - yr.min) : 1.0;
    const s = makeColSphere(app, n, r, g);
    inspect(app, C, s.primitive?.operators[0] ?? s, 'Collision Sphere', 3, false, `${s.fullName}.Sphere`);
  });
});

// ------------------------------------------------------------------ BvrSetFoot
const setFoot = body((app) => {
  const C = 'BvrSetFoot';
  const n = node(gate(app, C, MSG_GATE('Set Foot')));
  const shiftNotHeld = !shiftHeld(app);
  withCmdLogOff(app, C, () => {
    const home = findProp(n, 'RTKHomePose');
    if (!home) fatal(app, C, 'The Set Foot action can not be applied to an actor whose Home pose is not set. Please set the Home pose and try again.');
    if (n.parentObj instanceof Model) fatal(app, C, 'The Set Foot action can not be applied to the root node of an actor.');
    if (!findProp(n, 'RTKEffector')) addProp(app, n, makeTag('RTKEffector', rtkEffectorDefs()));
    setWire(app, n, WIRE_FOOT);
    if (!shiftNotHeld) return;
    if (n.children.some(c => findProp(c, 'RTKSphere'))) { msgBox(app, C, 'The foot node already has a collision sphere as a child. You will need to add additional collision spheres manually.'); return; }
    // inferred: heel and toe spheres; radius 0.25 x home py of the node the sphere goes under (0.25 without a home pose)
    const py = (o: X3DObject) => { const h = findProp(o, 'RTKHomePose'); return h ? Number(h.val('py')) : null; };
    const radiusFor = (o: X3DObject) => { const v = py(o); return v === null ? 0.25 : 0.25 * v; };
    const homePy = py(n)!; const g = globalPos(n);
    const r0 = radiusFor(n); const drop = r0 + (g.y - homePy);
    let low: X3DObject | null = null; let lowY = Infinity;
    for (const d of n.descendants()) { const y = globalPos(d).y; if (y < lowY) { lowY = y; low = d; } }
    const p1 = g.clone(); p1.y -= drop;
    let host2: X3DObject, p2: THREE.Vector3;
    if (low) { host2 = low; p2 = globalPos(low); p2.y -= drop; } else { host2 = n; p2 = g.clone(); p2.z += homePy; p2.y -= drop; }
    makeColSphere(app, n, r0, p1);
    makeColSphere(app, host2, radiusFor(host2), p2);
  });
});

// ------------------------------------------------------------------ BvrAddFloor
const addFloor = body((app) => {
  const C = 'BvrAddFloor';
  const n = node(gate(app, C, MSG_GATE('Add Floor')));
  withCmdLogOff(app, C, () => {
    if (!findProp(n, 'RTKNode')) fatal(app, C, 'The Add Floor action requires the selected node to be initialized. Please initialize the actor and try again.');
    // WIRE_CORRECTIONS_B13: the root-node message is shown, and the command continues
    if (n.parentObj instanceof Model) msgBox(app, C, 'The Add Floor action can not be applied to the root node of an actor.');
    if (!((n.primitive?.mesh()?.polygons.length ?? 0) > 0)) fatal(app, C, 'The Add Floor action can not be applied to a node without an associated polygon mesh.');
    if (n.children.some(c => findProp(c, 'RTKFloor'))) fatal(app, C, 'A floor node already exists under the selected node.');
    const yr = geomYRange(n);
    const f = new Null('Floor');
    app.record('Add Floor', () => n.addChild(f), () => n.removeChild(f));
    if (yr) setVal(app, f.kinematics.local as any, 'posy', yr.min);
    ensureRtkNode(app, f);
    addProp(app, f, makeTag('RTKFloor', rtkFloorDefs(yr ? yr.max - yr.min : 0)));
  });
});

// ------------------------------------------------------------------ BvrSetCollisionOnly / BvrSetVisualOnly / BvrSetDefault
function setKind(C: string, action: string, vis: boolean, col: boolean, wire: number) {
  return body((app) => {
    const n = node(gate(app, C, MSG_GATE(action)));
    withCmdLogOff(app, C, () => {
      const p = findProp(n, 'RTKNode');
      if (!p) fatal(app, C, `The ${action} action requires the selected node to be initialized. Please initialize the actor and try again.`);
      // inferred values (note: follow from RemoveFoot's colour mapping)
      setVal(app, p!, 'VisualizationOnly', vis); setVal(app, p!, 'CollisionOnly', col);
      if (!findProp(n, 'RTKEffector')) setWire(app, n, wire);
    });
  });
}

// ------------------------------------------------------------------ BvrAddJointLimit
const addJointLimit = body((app) => {
  const C = 'BvrAddJointLimit';
  const n = node(gate(app, C, MSG_GATE('Add Joint Limit')));
  if (!findProp(n, 'RTKNode')) fatal(app, C, 'To add a Behavior Joint Limit, the actor must first be initialized.');
  if (!findProp(n, 'RTKHomePose')) fatal(app, C, 'To add a Behavior Joint Limit, the actor home pose must be set (Set Home).');   // inferred: the elided start
  const model = actorModel(app, C, n);
  const root = actorRoot(app, C, model);
  if (!findProp(root, 'RTKActor')) fatal(app, C, 'The actor must be properly generated before a Behavior Joint Limit can be added. Please try the Generate action and try again.');
  const jl = ensureProp(app, n, 'BehaviorJL', makeBehaviorJL);
  inspect(app, C, jl, 'Behavior Joint Limit', 1, false);
});

// ------------------------------------------------------------------ removals
const removeCog = body((app) => { const n = node(gate(app, 'BvrRemoveCOG', MSG_GATE('Remove COG'))); const p = findProp(n, 'RTKCogNode'); if (p) deleteProp(app, p); });
const removeJointLimit = body((app) => { const n = node(gate(app, 'BvrRemoveJointLimit', MSG_GATE('Remove Joint Limit'))); const p = findProp(n, 'BehaviorJL'); if (p) deleteProp(app, p); });
const removeFloor = body((app) => {
  const n = node(gate(app, 'BvrRemoveFloor', MSG_GATE('Remove Floor')));
  deleteObjs(app, [n, ...n.descendants()].filter(o => findProp(o, 'RTKFloor')).filter((o, _i, all) => !all.some(a => a !== o && [...a.descendants()].includes(o))));
});
const removeFoot = body((app) => {
  const C = 'BvrRemoveFoot';
  const n = node(gate(app, C, MSG_GATE('Remove Foot')));
  const eff = findProp(n, 'RTKEffector'); if (!eff) return;
  deleteProp(app, eff);
  const rn = findProp(n, 'RTKNode');
  if (rn) setWire(app, n, rn.val('VisualizationOnly') ? WIRE_VISUAL : rn.val('CollisionOnly') ? WIRE_COLLISION : WIRE_DEFAULT);
  const spheres = [n, ...n.descendants()].filter(o => findProp(o, 'RTKSphere'));
  if (!spheres.length) return;
  if (msgBox(app, C, 'Do you want to remove the collision spheres under the foot node?', MB_YESNO) === ID_NO) return;
  deleteObjs(app, spheres.filter((o, _i, all) => !all.some(a => a !== o && [...a.descendants()].includes(o))));
});

export function registerBvrB13aActorCommands(app: App) {
  const reg = (name: string, label: string, description: string, execute: (app: App, a: Record<string, any>) => any) =>
    app.register({ name, label, category: 'Animate|Behavior', description, args: [], noLog: true, execute });
  reg('BvrInitActor', 'Initialize', 'Tags the actor description (RTKNode, RTKEnd) for Behavior export.', initActor);
  reg('BvrSetHome', 'Set Home', 'Stores the home pose (RTKHomePose) of every node of the actor.', setHome);
  reg('BvrGotoHome', 'Goto Home', 'Puts the actor back in its stored home pose.', gotoHome);
  reg('BvrGenerateActor', 'Generate', 'Generates a Behavior actor from the actor description.', generateActor);
  reg('BvrSetCOG', 'Set COG', 'Marks the selected node as the actor\'s centre of gravity.', setCog);
  reg('BvrSetFoot', 'Set Foot', 'Tags the selected node as a foot and adds heel / toe collision spheres.', setFoot);
  reg('BvrAddColSphere', 'Add Col Sphere', 'Adds a collision sphere under the selected node.', addColSphere);
  reg('BvrAddFloor', 'Add Floor', 'Adds a floor null under the selected node.', addFloor);
  reg('BvrSetCollisionOnly', 'Set Collision Only', 'Marks the selected node as collision only.', setKind('BvrSetCollisionOnly', 'Set Collision Only', false, true, WIRE_COLLISION));
  reg('BvrSetVisualOnly', 'Set Visual Only', 'Marks the selected node as visualization only.', setKind('BvrSetVisualOnly', 'Set Visual Only', true, false, WIRE_VISUAL));
  reg('BvrSetDefault', 'Set Default', 'Clears the collision only / visual only marks of the selected node.', setKind('BvrSetDefault', 'Set Default', false, false, WIRE_DEFAULT));
  reg('BvrAddJointLimit', 'Add Joint Limit', 'Adds a Behavior joint limit property to the selected node.', addJointLimit);
  reg('BvrRemoveCOG', 'Remove COG', 'Removes the COG tag of the selected node.', removeCog);
  reg('BvrRemoveFoot', 'Remove Foot', 'Removes the foot tag (and optionally its collision spheres).', removeFoot);
  reg('BvrRemoveFloor', 'Remove Floor', 'Removes the floor nodes under the selected node.', removeFloor);
  reg('BvrRemoveJointLimit', 'Remove Joint Limit', 'Removes the Behavior joint limit property of the selected node.', removeJointLimit);
}
