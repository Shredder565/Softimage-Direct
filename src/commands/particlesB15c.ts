// Ledger row CMD-B15c (sparks.dll / forces.dll): the legacy particle native commands. 20 commands (+ their "Pick ..." and
// other duplicate registry entries, which are the same task):
//   ConnectWeightMapToComponent ConnectParticleInitState DisconnectParticleInitState SetParticleInitState
//   UpdateParticleTypeConnections AddParticleEmitter AddParticleObstacle AddParticles SetParticleType CreateParticleType
//   SIAddParticleGoal CreateEventSource AddUserParameter RemoveUserParameter SIAddParticleEvent SetEventObstacle
//   SIAddParticleForce, and CreateInspectParticleType{Sphere,Blob,Billboard} (cmd-b15f / cmd-03b, particle.vbs).
// Brief: docs/ghidra/cmd-b15c-particles.md ("Wire contract" of each command, including the `(inferred)` parts),
// docs/ghidra/cmd-b15f-misc-scripts.md 3.1 / cmd-03b-particle-scripts.md (the three Create&Inspect scripts) and
// docs/re/WIRE_CORRECTIONS_B15.md items 27-29. Original code written from that prose only; no golden exists.
//
// Model: an ORIGINAL stand-in built on the CMD-03b particle model, see particlesB15cShared.ts. Nothing is simulated.
//  * Both registry entries of a command ("Pick Emitter" / "Add Particle Emitter", ...) run one handler. The scripting name
//    carries the list entry's argument list; each other entry is also registered under its own display name with its argument
//    list (strings, default ""). Create Event Source / Set Event Obstacle are two entries of the same display name.
//  * Output arguments cannot be written by reference on the bus: a command with an `Output` / `OutputObj` argument returns
//    what Softimage writes there (CreateParticleType -> the type, SIAddParticleGoal / SIAddParticleEvent -> the list,
//    CreateEventSource -> the source, AddParticles -> the new cloud when one was made).
//  * The Do return value (S_OK 0 / S_FALSE 1) is kept in `app.particlesB15c.status[<command>]`; failures throw SiStatusError.
//  * "Not yet attested" branches log "<command>: not yet attested: <what> (CMD-B15c)".
import * as THREE from 'three';
import { App } from '../core/commands';
import { makeDisplay } from '../core/scene';
import { ownerObject } from './operatorsScriptsOps';
import { autoInspect, defaultParticleRenderer } from './particleScripts';
import {
  Node, X3DObject, Property, Primitive, Operator, Cluster, unset, ptypes, items, expand, fail, logNya, setStatus, b15c,
  S_OK, S_FALSE, E_FAIL, E_POINTER, E_INVALIDARG, E_UNEXPECTED_ARG, SPARKS, HYPERFLOW, BLOWUP, isSparks, isSimOp,
  isCloud, isPType, isEmission, isObstacleProp, isEvent, isOperator, simOpOf, findSimOp, cloudOfOp, connOf, allSimOps, setList,
  addTo, touchCloud, updateOp, opsUsing, newParticleType, attach, uniqueElementName, ensureObstacle, ensureEmission,
  putSlotType, makeEventSource, renderTypeName,
} from './particlesB15cShared';

const CAT = 'Simulation';
const EMPTY = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';

interface Entry { name: string; label?: string; args: [string, any][]; keyAssignable?: boolean }
/** Register one handler under the scripting name (first entry's argument list) and under every other entry's own name. */
function reg(app: App, scripting: string, entries: Entry[], execute: (app: App, a: Record<string, any>) => any, description = '') {
  const mk = (name: string, e: Entry) => app.register({ name, label: e.label ?? name, category: CAT, description, args: e.args.map(([n, d]) => ({ name: n, default: d })), execute });
  mk(scripting, entries[0]);
  for (const e of entries) if (e.name !== scripting && !(app.commands.get(e.name) as any)?.__b15c) { mk(e.name, e); (app.commands.get(e.name) as any).__b15c = true; }
}
const nums = (v: any): number[] | null => {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return Array.from(v as ArrayLike<number>, Number);
  return null;
};
const bool = (v: any, d: boolean) => (v === undefined || v === null || v === '' ? d : typeof v === 'string' ? !/^(false|0|no)$/i.test(v.trim()) : !!v);
/** Object kind of a primitive (the preset of its generator, or its name). */
const primKind = (o: X3DObject): string => String((o.primitive?.operators[0] as any)?.preset ?? o.name);
/** The simulation operator of any target: a cloud's Sparks / HyperFlow / BlowUp operator, or a cloth / soft body operator. */
function targetOp(t: Node): Operator | null {
  if (isCloud(t)) return simOpOf(t);
  if (t instanceof X3DObject) return t.primitive?.operators.find(op => /cloth|softbody/i.test(op.type)) ?? null;
  return null;
}
const typesOfCloud = (cloud: X3DObject): Property[] => { const op = simOpOf(cloud); return op ? (connOf(op).particleTypes.filter(isPType) as Property[]) : []; };

export function registerParticlesB15cCommands(app: App) {
  b15c(app);

  // ------------------------------------------------------------------ CreateParticleType
  reg(app, 'CreateParticleType', [
    { name: 'Create Particle Type', args: [['RenderType', ':siBillboardType:siParticleRenderType'], ['Output', null]] },
    { name: 'Create a new particle type', args: [['Output', null]], keyAssignable: true },
  ], (app, a) => {
    const pt = newParticleType(app, a.RenderType === undefined || a.RenderType === null ? ':siBillboardType:siParticleRenderType' : a.RenderType);
    setStatus(app, 'CreateParticleType', S_OK);
    return pt;
  }, 'Create a new Particle Type');

  // CreateInspectParticleType{Sphere,Blob,Billboard}: CreateParticleType <renderType>, then AutoInspect the new type (no return)
  for (const [kind, def] of [['Billboard', 'siBillboardType'], ['Sphere', 'siSphereType'], ['Blob', 'siBlobType']] as const) {
    const name = `CreateInspectParticleType${kind}`;
    app.register({
      name, label: `Create & Inspect Particle ${kind} Type`, category: CAT, args: [{ name: 'renderType', default: def }],
      execute(app, a) {
        const pt = app.run('CreateParticleType', { RenderType: a.renderType }) as Property;
        autoInspect(app, [pt]);
        return undefined;
      },
    });
  }

  // ------------------------------------------------------------------ UpdateParticleTypeConnections
  reg(app, 'UpdateParticleTypeConnections', [{ name: 'Update Particle Type Connections', args: [['InputObj', null]] }], (app, a) => {
    const C = 'UpdateParticleTypeConnections';
    // the first item that classifies: cloud (A), operator (B), emission (C), particle type (D), obstacle extension (E)
    const list = items(app, a.InputObj, true);
    const hit = list.find(n => isCloud(n) || isOperator(n) || isEmission(n) || isPType(n) || isObstacleProp(n));
    if (!hit) throw fail(E_FAIL, `${C}: nothing to update in the input (message id 0x6f)`);
    if (isOperator(hit)) updateOp(app, hit);                                              // slot 10
    else if (isCloud(hit)) updateOp(app, findSimOp(hit, C));                              // slot 9, then 10
    else {
      // slots 11 (emission), 12 (particle type), 13 (obstacle extension): not decompiled; the operators using the node are updated
      logNya(app, C, 'the emission / particle type / obstacle extension paths of the update (the operators that use the node are refreshed)');
      const ops = isPType(hit) ? allSimOps(app).filter(op => connOf(op).particleTypes.includes(hit)) : opsUsing(app, ((hit as Node).parent ?? hit) as Node);
      for (const op of isPType(hit) ? allSimOps(app) : ops) updateOp(app, op);
    }
    setStatus(app, C, S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ AddParticleEmitter
  reg(app, 'AddParticleEmitter', [
    { name: 'Add Particle Emitter', args: [['Target', null], ['InputObj', null], ['Interactive', true]] },
    { name: 'Pick Emitter', args: [['Target', ''], ['InputObj', ''], ['Interactive', true]], keyAssignable: true },
  ], (app, a) => {
    const C = 'AddParticleEmitter';
    const interactive = bool(a.Interactive, true);
    const cloud = expand(items(app, a.Target, true)).find((t): t is X3DObject => isCloud(t) && (isSparks(simOpOf(t)) || simOpOf(t)?.type === HYPERFLOW));
    if (!cloud) throw fail(E_INVALIDARG, `${C}: no Target carries a Sparks or HyperFlow operator`);
    const op = simOpOf(cloud)!;
    const emitters: Node[] = [], fresh: Property[] = [];
    for (const o of expand(items(app, a.InputObj, true))) {
      if (!(o instanceof X3DObject) || isCloud(o)) continue;
      if (op.type === HYPERFLOW && !/disc|cube|square/i.test(primKind(o))) continue;     // HyperFlow takes Disc / Cube / Square only
      ensureEmission(app, o, fresh);
      if (!emitters.includes(o)) emitters.push(o);
    }
    addTo(app, 'Connect emitters', connOf(op), 'emitters', emitters);
    updateOp(app, op);
    if (interactive && fresh.length) autoInspect(app, fresh);                              // "Auto Inspect" with the new emission properties
    setStatus(app, C, S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ AddParticleObstacle
  reg(app, 'AddParticleObstacle', [
    { name: 'Add Particle Obstacle Object', args: [['Target', null], ['InputObj', null]] },
    { name: 'Pick Obstacle', args: [['Target', ''], ['InputObj', '']], keyAssignable: true },
  ], (app, a) => {
    const C = 'AddParticleObstacle';
    const inputs = expand(items(app, a.InputObj, true)).filter((n): n is X3DObject => n instanceof X3DObject);
    for (const t of expand(items(app, a.Target, true))) {
      const op = targetOp(t);
      if (!op) { logNya(app, C, `the simulation operator of ${t.name} (not a cloud, cloth or soft body of this build)`); continue; }
      const obstacles = inputs.filter(o => o !== t).map(o => ensureObstacle(app, o));
      if (isSparks(op)) {
        // one event per particle type of the container, with the obstacle as the event's obstacle (inferred)
        for (const pt of ptypes(app)) for (const ob of obstacles) {
          const ev = (app.run('SIAddParticleEvent', { Target: [pt] }) as Property[])[0];
          if (ev) app.record('Set event obstacle', () => { (ev as any).obstacle = ob; }, () => { (ev as any).obstacle = undefined; });
        }
        logNya(app, C, 'the event parameter values and the port group numbers of the obstacle connection for a Sparks operator');
      } else {
        addTo(app, 'Connect obstacles', connOf(op), 'obstacles', obstacles);
        logNya(app, C, 'the port group numbers of the obstacle connection per operator class');
      }
      updateOp(app, op);
    }
    setStatus(app, C, S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ AddParticles
  reg(app, 'AddParticles', [{ name: 'Add Particles', args: [['InputObj', null], ['ParType', null], ['Positions', null], ['Velocities', null], ['World Referential', true], ['OutputObj', null]] }], (app, a) => {
    const C = 'AddParticles';
    let cloud = items(app, a.InputObj).find(isCloud) ?? null;
    const given = items(app, a.ParType)[0];
    let type: Property | null = isPType(given) ? given : null;
    const pos = nums(a.Positions);
    if (!pos || !pos.length) throw fail(E_INVALIDARG, `${C}: Positions must be a non-empty array`);
    let vel: number[];
    if (a.Velocities === undefined || a.Velocities === null || a.Velocities === '') vel = [];
    else { const v = nums(a.Velocities); if (!v) throw fail(E_INVALIDARG, `${C}: Velocities must be an array`); vel = v; }
    const count = Math.floor(pos.length / 3);
    if (!vel.length) vel = new Array(count * 3).fill(0);
    else if (vel.length < count * 3) { logNya(app, C, 'a Velocities array shorter than 3 per particle (the missing components are zero)'); vel = vel.concat(new Array(count * 3 - vel.length).fill(0)); }
    let created: X3DObject | undefined;
    if (!cloud) {
      cloud = created = new X3DObject(app.scene.uniqueName('cloud'), 'cloud');
      const prim = new Primitive('cloud', 'cloud'); cloud.setPrimitive(prim); cloud.addProperty(makeDisplay());
      const root = app.scene.root, c = cloud;
      app.record('Create cloud', () => { root.addChild(c); }, () => { root.removeChild(c); });
      defaultParticleRenderer(app, [cloud]);                                               // the "Particle_Renderer" shader preset
    }
    if (!type) { if (!ptypes(app).length) app.run('CreateParticleType', {}); type = ptypes(app)[0]; }   // inferred: the first type of the container
    const worldRef = bool(a['World Referential'], true);
    let P = pos.slice(0, count * 3), V = vel.slice(0, count * 3);
    if (worldRef) {
      const inv = cloud.globalMatrix().invert(); const m3 = new THREE.Matrix3().setFromMatrix4(inv);
      const p = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        p.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]).applyMatrix4(inv); P[3 * i] = p.x; P[3 * i + 1] = p.y; P[3 * i + 2] = p.z;
        v.set(V[3 * i], V[3 * i + 1], V[3 * i + 2]).applyMatrix3(m3); V[3 * i] = v.x; V[3 * i + 1] = v.y; V[3 * i + 2] = v.z;
      }
    }
    const op = new Operator('AddParticleOp', 'AddParticleOp', []);
    (op as any).particles = { positions: P, velocities: V, type, count };
    const prim = cloud.primitive!;
    app.record('Apply AddParticleOp', () => { prim.addOperator(op); }, () => { prim.removeOperator(op); });
    logNya(app, C, 'the parameter layout of the AddParticleOp operator (the particles are stored as positions / velocities / type)');
    setStatus(app, C, S_OK);
    return created;
  }, 'Add particles to a cloud');

  // ------------------------------------------------------------------ SetParticleType
  reg(app, 'SetParticleType', [
    { name: 'Set a Particle Type', args: [['Target', null], ['Source', null]] },
    { name: 'Set a particle type', args: [['Target', ''], ['Source', '']], keyAssignable: true },
  ], (app, a) => {
    const C = 'SetParticleType';
    const holders: Node[] = [];
    for (const n of items(app, a.Target, true)) {
      let h: Node | null = n;
      if (isPType(n)) { h = n.parent as Node | null; if (!h || !(isEmission(h) || isEvent(h))) { logNya(app, C, `the holder that owns the particle type ${n.name}`); h = null; } }
      if (h && (isEmission(h) || isEvent(h)) && !holders.includes(h)) holders.push(h);
    }
    let source = items(app, a.Source).filter(isPType).pop() as Property | undefined;
    if (!source) source = app.run('CreateParticleType', {}) as Property;
    for (const h of holders) {
      putSlotType(app, h, source);                                                         // the previous type is kept for undo
      const owner = (h.parent ?? h) as Node;
      const ops = isEmission(h) ? opsUsing(app, owner) : allSimOps(app).filter(op => (connOf(op).eventSources ?? []).includes((h as any).eventSource));
      for (const op of ops) updateOp(app, op);
    }
    setStatus(app, C, S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ SIAddParticleGoal
  reg(app, 'SIAddParticleGoal', [{ name: 'SIAddParticleGoal', args: [['Target', EMPTY], ['InputObj', EMPTY], ['Output', null]], keyAssignable: true }], (app, a) => {
    const C = 'SIAddParticleGoal';
    const out: Property[] = [];
    const goals = expand(items(app, a.InputObj)).filter((n): n is X3DObject => n instanceof X3DObject);
    const typeSet: Property[] = [];
    for (const t of expand(items(app, a.Target))) {
      if (isCloud(t)) { for (const pt of typesOfCloud(t)) if (!typeSet.includes(pt)) typeSet.push(pt); }
      else if (isPType(t) && !typeSet.includes(t)) typeSet.push(t);
    }
    for (const pt of typeSet) for (const g of goals) {
      const gp = new Property(uniqueElementName(pt, `${g.name}_goal`), 'ParticleGoal', []);
      (gp as any).goalObjects = [g];
      attach(app, pt, gp); out.push(gp);
      logNya(app, C, 'which parameter of the goal property is set to 4');
      for (const op of allSimOps(app)) if (connOf(op).particleTypes.includes(pt)) updateOp(app, op);
    }
    setStatus(app, C, S_OK);
    return out;
  });

  // ------------------------------------------------------------------ CreateEventSource
  reg(app, 'CreateEventSource', [
    { name: 'CreateEventSource', args: [['Target', null], ['Output', null]] },
    { name: 'Create Event Source', args: [['Target', ''], ['Output', null]], keyAssignable: true },
  ], (app, a) => {
    const C = 'CreateEventSource';
    const list = items(app, a.Target);
    if (list.length > 1) throw fail(E_UNEXPECTED_ARG, `${C}: at most one Target is accepted`);
    const holder = list[0];
    if (!holder || !isEvent(holder)) { logNya(app, C, 'what a target that is not an event holder does'); setStatus(app, C, S_OK); return undefined; }
    const { src, existed } = makeEventSource(app, holder, C);
    setStatus(app, C, existed ? S_FALSE : S_OK);
    return src;
  });

  // ------------------------------------------------------------------ AddUserParameter / RemoveUserParameter
  const typesOf = (app: App, C: string, target: any): Property[] => {
    const out: Property[] = [];
    for (const n of expand(items(app, target))) {
      if (isPType(n)) { if (!out.includes(n)) out.push(n); }
      else if (isCloud(n)) for (const pt of typesOfCloud(n)) if (!out.includes(pt)) out.push(pt);
    }
    if (!out.length) throw fail(E_FAIL, `${C}: no particle type found (message id 0x6f)`);
    return out;
  };
  const refresh = (app: App, pt: Property) => { for (const op of allSimOps(app)) if (connOf(op).particleTypes.includes(pt)) touchCloud(app, cloudOfOp(op)); };
  reg(app, 'AddUserParameter', [{ name: 'Add User Parameter To Particle Types', args: [['Target', null], ['Name', ''], ['Type', 0]] }], (app, a) => {
    const C = 'AddUserParameter';
    const name = String(a.Name ?? ''), type = Number(a.Type ?? 0);
    if (!name || !(type < 7) || unset(a.Target)) throw fail(E_FAIL, `${C}: empty Name or Target, or Type >= 7 (message id 0x6f)`);
    for (const pt of typesOf(app, C, a.Target)) {
      const list: { name: string; type: number }[] = ((pt as any).userParams ??= []);
      const before = list.map(p => ({ ...p }));
      const i = list.findIndex(p => p.name === name);
      if (i >= 0) logNya(app, C, `adding a user parameter that already exists (the type of ${name} is replaced)`);
      app.record('Add user parameter', () => { const k = list.findIndex(p => p.name === name); if (k >= 0) list[k] = { name, type }; else list.push({ name, type }); },
        () => { list.splice(0, list.length, ...before); });
      refresh(app, pt);
    }
    setStatus(app, C, S_OK);
    return undefined;
  });
  reg(app, 'RemoveUserParameter', [{ name: 'Remove User Parameter From Particle Types', args: [['Target', null], ['Name', '']] }], (app, a) => {
    const C = 'RemoveUserParameter';
    const name = String(a.Name ?? '');
    if (!name || unset(a.Target)) throw fail(E_FAIL, `${C}: empty Name or Target (message id 0x6f)`);
    let notFound = false;
    for (const pt of typesOf(app, C, a.Target)) {
      const list: { name: string; type: number }[] = ((pt as any).userParams ??= []);
      const before = list.map(p => ({ ...p }));
      if (!list.some(p => p.name === name)) notFound = true;                              // the type kept for undo defaults to 7 when unknown
      else app.record('Remove user parameter', () => { const k = list.findIndex(p => p.name === name); if (k >= 0) list.splice(k, 1); }, () => { list.splice(0, list.length, ...before); });
      refresh(app, pt);
    }
    setStatus(app, C, notFound ? S_FALSE : S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ SIAddParticleEvent
  reg(app, 'SIAddParticleEvent', [{ name: 'SIAddParticleEvent', args: [['Target', EMPTY], ['Source', EMPTY], ['Output', null]] }], (app, a) => {
    const C = 'SIAddParticleEvent';
    const out: Property[] = [];
    const source = items(app, a.Source).find(isPType) ?? null;
    for (const t of items(app, a.Target)) {
      if (!(isPType(t) || isObstacleProp(t))) continue;                                   // inferred: events hang on a particle type or an obstacle extension
      const ev = new Property(uniqueElementName(t, 'ParticleEvent'), 'ParticleEvent', [{ name: 'ParType', type: 'string', default: '', label: 'Particle Type', readOnly: true }]);
      (ev as any).sources = source ? [source] : []; (ev as any).parType = null;
      attach(app, t, ev);
      app.run('CreateEventSource', { Target: [ev] });
      if (source) putSlotType(app, ev, source);
      out.push(ev);
      for (const op of allSimOps(app)) if (connOf(op).particleTypes.includes(t)) updateOp(app, op);
    }
    if (!out.length) throw fail(E_INVALIDARG, `${C}: no target succeeded (message id 0x126)`);
    logNya(app, C, 'the role of Source and the event parameter values');
    setStatus(app, C, S_OK);
    return out;
  });

  // ------------------------------------------------------------------ SetEventObstacle
  reg(app, 'SetEventObstacle', [
    { name: 'SetEventObstacle', args: [['Target', null], ['Source', null]] },
    { name: 'Set Event Obstacle', args: [['Target', null], ['Source', null]], keyAssignable: true },
  ], (app, a) => {
    const C = 'SetEventObstacle';
    const target = items(app, a.Target)[0], source = items(app, a.Source)[0];
    if (!target || !source) throw fail(E_UNEXPECTED_ARG, `${C}: empty Target or Source`);
    const ob = ensureObstacle(app, source);
    if (!isEvent(target)) { logNya(app, C, `a target that is not a particle event (${target.name})`); setStatus(app, C, S_OK); return undefined; }
    app.record('Set event obstacle', () => { (target as any).obstacle = ob; }, () => { (target as any).obstacle = undefined; });
    const ops = allSimOps(app).filter(op => (connOf(op).eventSources ?? []).includes((target as any).eventSource));
    if (!ops.length) logNya(app, C, `the operator of the event ${target.name} (the obstacle is set on the event only)`);
    for (const op of ops) { addTo(app, 'Connect obstacle', connOf(op), 'obstacles', [ob]); updateOp(app, op); }
    setStatus(app, C, S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ SIAddParticleForce (forces.dll)
  const forceGroup = (op: Operator): number | null => op.type === SPARKS || op.type === HYPERFLOW || /cloth/i.test(op.type) ? 3 : /softbody/i.test(op.type) ? 2 : op.type === BLOWUP ? 4 : null;
  reg(app, 'SIAddParticleForce', [{ name: 'Add Particle Force Object', args: [['Target', EMPTY], ['InputObj', EMPTY]] }], (app, a) => {
    const C = 'SIAddParticleForce';
    const forces = expand(items(app, a.InputObj)).filter((n): n is X3DObject => n instanceof X3DObject && n.get('forcetype') !== undefined);   // force primitives; others skipped silently
    for (const t of expand(items(app, a.Target))) {
      const op = targetOp(t); const g = op ? forceGroup(op) : null;
      if (!op || g === null) continue;                                                     // no simulation operator: nothing done
      const groups: Record<number, Node[]> = ((op as any).portGroups ??= {});
      for (const f of forces) {
        if ((groups[g] ?? []).includes(f)) { app.logMsg('info', `WARNING : ${f.name}: not yet attested: XSIFORCES message 0x34 text (${'CMD-B15c'})`); continue; }
        const before = [...(groups[g] ?? [])];
        app.record('Connect force', () => { groups[g] = [...before, f]; if (isSimOp(op)) connOf(op).forces = [...(connOf(op).forces), f]; },
          () => { groups[g] = before; if (isSimOp(op)) connOf(op).forces = connOf(op).forces.filter(x => x !== f); });
      }
    }
    setStatus(app, C, S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ ConnectParticleInitState / DisconnectParticleInitState
  const initTarget = (app: App, C: string, arg: any): { cloud: X3DObject | null; op: Operator | null } => {
    const list = items(app, arg, true);
    const cloud = list.find(isCloud) ?? null;
    const op = cloud ? null : list.find(isOperator) ?? null;
    if (!cloud && !op) throw fail(E_FAIL, `${C}: no cloud or operator in InputObj (message id 0x6f)`);
    return { cloud, op };
  };
  const connectInit = (app: App, C: string, op: Operator, init: X3DObject) => {
    if (!isSparks(op)) throw fail(E_FAIL, `${C}: the operator is not a Sparks operator (message id 0x6f)`);
    if (!init.properties.some(p => p.type === 'ParticleInitState')) {
      const p = new Property('ParticleInitialStateProp', 'ParticleInitState', []);
      app.record('Add initial state property', () => { init.addProperty(p); }, () => { init.removeProperty(p); });
    }
    setList(app, 'Connect initial state', connOf(op), 'initialState', [init]);             // port group 4, one input
    updateOp(app, op);
  };
  const disconnectInit = (app: App, C: string, op: Operator) => {
    if (!isSparks(op)) throw fail(E_FAIL, `${C}: the operator is not a Sparks operator (message id 0x6f)`);
    setList(app, 'Disconnect initial state', connOf(op), 'initialState', []);
    updateOp(app, op);
  };
  reg(app, 'ConnectParticleInitState', [{ name: 'Connect particle initial state', args: [['InputObj', null], ['InitCloud', null]] }], (app, a) => {
    const C = 'ConnectParticleInitState';
    const { cloud, op } = initTarget(app, C, a.InputObj);
    const init = items(app, a.InitCloud, false).find(isCloud);
    if (!init) throw fail(E_FAIL, `${C}: no cloud in InitCloud (message id 0x6f)`);
    connectInit(app, C, op ?? findSimOp(cloud, C), init);
    setStatus(app, C, S_OK);
    return undefined;
  });
  reg(app, 'DisconnectParticleInitState', [{ name: 'Disconnect particle initial state', args: [['InputObj', null]] }], (app, a) => {
    const C = 'DisconnectParticleInitState';
    const { cloud, op } = initTarget(app, C, a.InputObj);
    disconnectInit(app, C, op ?? findSimOp(cloud, C));
    setStatus(app, C, S_OK);
    return undefined;
  });

  // ------------------------------------------------------------------ SetParticleInitState
  reg(app, 'SetParticleInitState', [{ name: 'Set Particle Init State', args: [['InputObj', null], ['Overwrite', 0]] }], (app, a) => {
    const C = 'SetParticleInitState';
    const clouds = expand(items(app, a.InputObj)).filter(isCloud);
    if (unset(a.InputObj)) { setStatus(app, C, S_FALSE); return undefined; }
    const overwrite = Number(a.Overwrite ?? 0) || 0;
    let processed = 0;
    for (const cloud of clouds) {
      const op = findSimOp(cloud, C, true);
      const old = connOf(op).initialState[0] as X3DObject | undefined;
      let mode = 1;
      if (old) {
        if (overwrite === 0) {
          const st = b15c(app);
          if (st.ui && st.hooks.messageBox) { const r = st.hooks.messageBox('This cloud already has an initial state. Do you wish to replace it?', 'SOFTIMAGE® | XSI®'); mode = r === 'yes' ? 1 : r === 'no' ? 2 : 3; }
        } else mode = overwrite;                                                           // inferred: used directly as the mode
      }
      if (old && mode === 1) { const par = old.parentObj; if (par) app.record('Delete old initial state', () => { par.removeChild(old); }, () => { par.addChild(old); }); }
      else if (old && mode === 2) app.run('DisconnectParticleInitState', { InputObj: [cloud] });
      else if (old && mode === 3) continue;
      const init = new X3DObject(`${cloud.name}_InitState`, 'cloud');
      const prim = new Primitive('cloud', 'cloud'); init.setPrimitive(prim); init.addProperty(makeDisplay());
      const copy = (cloud.primitive?.operators ?? []).filter(o => o.type === 'AddParticleOp').map(o => (o as any).particles);
      (prim as any).particles = copy.map(p => ({ ...p, positions: [...p.positions], velocities: [...p.velocities] }));
      const parent = cloud.parentObj ?? app.scene.root;
      app.record('Create initial state cloud', () => { parent.addChild(init); }, () => { parent.removeChild(init); });
      logNya(app, C, 'the two SetValue parameters of the new cloud, the operator stripping, and copying simulated (not AddParticles) particles');
      app.run('ConnectParticleInitState', { InputObj: [cloud], InitCloud: [init] });
      processed++;
    }
    setStatus(app, C, processed ? S_OK : S_FALSE);
    return undefined;
  });

  // ------------------------------------------------------------------ ConnectWeightMapToComponent
  reg(app, 'ConnectWeightMapToComponent', [
    { name: 'Connect weight map to component', args: [['Target', null], ['PropObj', null]] },
    { name: 'Pick Component', args: [['Target', ''], ['PropObj', '']], keyAssignable: true },
  ], (app, a) => {
    const C = 'ConnectWeightMapToComponent';
    const target = items(app, a.Target, true)[0];
    const map = items(app, a.PropObj).find((n): n is Property => n instanceof Property && n.type === 'weightmap');
    let geometry: X3DObject | null = null, cluster: Cluster | null = null;
    if (target instanceof Cluster) { cluster = target; geometry = ownerObject(target); }
    else if (target instanceof X3DObject) geometry = target;                              // the object's primitive
    if (!cluster && map && map.parent instanceof Cluster) cluster = map.parent;
    if (!geometry || !cluster || !map || !target) throw fail(E_POINTER, `${C}: geometry, cluster, weight map or target missing`);
    const op = new Operator('WMCnxOp', 'WMCnxOp', []);
    (op as any).inputs = [geometry, cluster, map]; (op as any).target = target;           // C3DWMCnxOp: input group 1
    const st = b15c(app);
    app.record('Connect weight map', () => { st.wmConnections.push({ op, geometry: geometry!, cluster: cluster!, map, target }); }, () => { const i = st.wmConnections.findIndex(x => x.op === op); if (i >= 0) st.wmConnections.splice(i, 1); });
    logNya(app, C, 'the port meaning of the operator\'s two bidirectional output connections to the target');
    setStatus(app, C, S_OK);
    return undefined;
  });
}
