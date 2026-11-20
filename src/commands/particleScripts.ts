// Ledger row CMD-03b. Brief: docs/ghidra/cmd-03b-particle-scripts.md, "Wire contract". Original code written from that contract only.
//
// The 12 legacy particle script commands (create cloud / fluid / explosion, particle types, cache file,
// initial state inspect, add event / goal / force, emit points). The script steps are attested; the native
// commands and operators they delegate to are a separate ledger row (open question Q1), so:
//
//  * Particle types, emission properties, the legacy simulation operators and their clouds are modelled here
//    with a small data model (all marked `// inferred`). Nothing is simulated: every operator application logs
//    one "not yet attested" line (Q1 / Q3).
//  * Output arguments. The bus has no by-reference arguments, so the three AddParticle... commands return
//    `{ Target, <InputObj|Source>, Output }` holding what Softimage writes back into those arguments (inferred).
//  * Two registry entries per name (Q2). AddParticleEvent / Goal / Force run the plain entry and then the
//    AutoInspect of the key-assignable entry (a no-op when auto inspect is off). InspectInitStateProp runs the
//    entry of that name; the second entry (InspectParticleSimulationOp) is `app.particleScripts.inspectParticleSimulationOp`.
//  * Pick sessions and the file browser cannot block the synchronous bus. They go through the hooks
//    `app.particleScripts.hooks.pickElement(filter, leftPrompt, middlePrompt)` (return a node, or null to end
//    the session) and `hooks.fileBrowser(options)` (return a path, or '' for cancel). Without a pick hook the
//    session counts as ended with nothing picked; without a browser hook a plain text prompt stands in.
//  * Log severities: the script log knows 'info' and 'error'; warnings are info lines prefixed "WARNING : ".
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Node, Property, Primitive, Operator, Group, Material, Shader, Light, makeDisplay, makeSiShader } from '../core/scene';
import { ICETreeOperator, type IceNode } from '../core/ice';
import { str, int, bool } from '../core/params';

const NOTE = 'docs/ghidra/cmd-03b-particle-scripts.md';
const CAT = 'Simulation';
/** Registry default of the in/out collection arguments: "use an empty collection". */
const EMPTY_COLLECTION = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';
const SIM_OP_TYPES = ['ParticlesOp', 'ExplosionOp', 'FluidOp'];
const PROMPTS: Record<number, string> = {
  1098: 'Pick ParType', 1099: 'Pick cloud or ParType', 1100: 'Select an object that you want as a particle goal',
  1101: 'Pick Cloud, Cloth, SoftBody or Hair', 1102: 'Pick Force',
};

export interface ParticleConnections { main: Node[]; emitters: Node[]; obstacles: Node[]; forces: Node[]; initialState: Node[]; particleTypes: Node[]; inputs?: any[] }
export interface ParticleScriptsState {
  /** Particle types of the scene (inferred container; where Softimage keeps them is Q1). */
  particleTypes: Property[];
  hooks: {
    pickElement?: (filter: string, leftPrompt: string, middlePrompt: string) => Node | null | undefined;
    fileBrowser?: (o: { title: string; initialDirectory: string; baseName: string; filter: string }) => string | null | undefined;
  };
  /** Stands for the user preference ScriptingSessionActive (inferred: no such preference page in this build). */
  scriptingSessionActive: boolean;
  /** What the last AutoInspect / InspectObj step of these commands was handed (the check script reads it). */
  lastInspect: { via: 'AutoInspect' | 'InspectObj'; nodes: Node[]; keywords?: string } | null;
  inspectParticleSimulationOp(inputs?: any): Node[] | undefined;
}

export function particleScripts(app: App): ParticleScriptsState {
  return ((app as any).particleScripts ??= {
    particleTypes: [], hooks: {}, scriptingSessionActive: false, lastInspect: null,
    inspectParticleSimulationOp: (inputs?: any) => inspectParticleSimulationOp(app, inputs),
  } as ParticleScriptsState);
}

// ------------------------------------------------------------------ small helpers

export const unset = (v: any) => v === undefined || v === null || v === '' || v === EMPTY_COLLECTION;
const same = (a: any, b: string) => String(a ?? '').toLowerCase() === b.toLowerCase();
const warn = (app: App, text: string) => app.logMsg('info', 'WARNING : ' + text);
const nya = (app: App, cmd: string, what: string, q: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${NOTE} ${q})`);
const isCloud = (n: any): boolean => n instanceof X3DObject && n.type === 'cloud';
const asCloud = (n: any): X3DObject | null => (isCloud(n) ? n as X3DObject : null);
const isPType = (n: any): boolean => n instanceof Property && n.type === 'ParType';
const simOpOf = (prim: Primitive | null | undefined) => prim?.operators.find(op => SIM_OP_TYPES.includes(op.type));

/** Selection filters of the contract. Their exact membership is the native filter's; these are the readings used here. */
const FILTERS: Record<string, (n: Node) => boolean> = {
  Decay: n => isPType(n) || (n instanceof Property && n.type === 'ObstacleProp'),          // inferred: "a ptype or an obstacle"
  CloudOrPType: n => isCloud(n) || isPType(n),
  PType: n => isPType(n),
  Emitter: n => n instanceof X3DObject && !isCloud(n) && !!n.primitive && n.type !== 'light' && n.type !== 'camera', // inferred: an object with geometry
  Force: n => n instanceof X3DObject && n.get('forcetype') !== undefined,                  // inferred: this build's force objects (CreateForce)
  object: n => n instanceof X3DObject,
};

/** Resolve a collection argument to scene nodes (no selection fallback; the callers decide that). */
export function nodesOf(app: App, arg: any): Node[] {
  if (unset(arg)) return [];
  const st = particleScripts(app);
  const list: any[] = Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg];
  const out: Node[] = [];
  for (const x of list) {
    let n: Node | undefined;
    if (x instanceof Node) n = x;
    else if (typeof x === 'string') {
      n = app.scene.find(x) ?? app.scene.groupList.find(g => g.name === x) ?? st.particleTypes.find(p => p.name === x);
      if (!n) { const i = x.lastIndexOf('.'); const o = i > 0 ? app.scene.find(x.slice(0, i)) : undefined; n = o?.allProperties().find(p => same(p.name, x.slice(i + 1)) || same(p.type, x.slice(i + 1))); }
    }
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
/** Collection handler: the argument, or the selection when omitted. */
const inputOrSelection = (app: App, arg: any): Node[] => unset(arg) ? [...app.selection] : nodesOf(app, arg);
/** Groups flattened to their members (branch selection is not modelled in this build). */
function expand(list: Node[]): Node[] {
  const out: Node[] = [];
  for (const n of list) for (const m of n instanceof Group ? n.members : [n]) if (!out.includes(m)) out.push(m);
  return out;
}

export function autoInspect(app: App, nodes: Node[]) {
  particleScripts(app).lastInspect = { via: 'AutoInspect', nodes: [...nodes] };
  if (app.autoInspect && nodes.length) app.events.emit('inspect', nodes[0]);   // inferred: the editor opens on the first element
}
function inspectObj(app: App, cmd: string, nodes: Node[], keywords?: string) {
  particleScripts(app).lastInspect = { via: 'InspectObj', nodes: [...nodes], keywords };
  if (nodes.length) app.events.emit('inspect', nodes[0]);                     // inferred: the editor opens on the first element
  else nya(app, cmd, 'InspectObj on an empty collection', 'Wire contract: the callee\'s behaviour');
}

// ------------------------------------------------------------------ model of the native callees (Q1, all inferred)

/** CreateParticleType <renderType>: a new particle type element. */
function createParticleType(app: App, cmd: string, renderType: any): Property {
  const st = particleScripts(app);
  const taken = new Set(st.particleTypes.map(p => p.name));
  let name = 'PType', i = 1; while (taken.has(name)) name = `PType${i++}`;                 // inferred: default name
  const pt = new Property(name, 'ParType', [str('rendertype', String(renderType ?? ''), 'Render Type', { readOnly: true })]); // inferred parameter
  (pt as any).renderType = String(renderType ?? '');
  app.record('Create particle type', () => { st.particleTypes.push(pt); }, () => { const k = st.particleTypes.indexOf(pt); if (k >= 0) st.particleTypes.splice(k, 1); });
  nya(app, cmd, 'the parameters and owner of the particle type made by CreateParticleType', 'Q1');
  return pt;
}

/** "Emission Property" preset, named <object>_emission; SetParticleType points its ParType at the type. */
function addEmission(app: App, obj: X3DObject, ptype: Property): Property {
  const p = new Property(`${obj.name}_emission`, 'EmissionProp', [
    int('Generation', 0, 'Generation'),                                                     // inferred default
    str('ParType', ptype.name, 'Particle Type', { readOnly: true }),
  ]);
  (p as any).parType = ptype;
  app.record('Add emission property', () => { obj.addProperty(p); }, () => { obj.removeProperty(p); });
  return p;
}

const SIM_PRESETS: Record<string, { type: string; name: string; defs: () => any[] }> = {
  SparksOp: { type: 'ParticlesOp', name: 'ParticlesOp', defs: () => [] },                   // inferred preset -> operator type pairing
  HyperFlowOp: { type: 'FluidOp', name: 'FluidOp', defs: () => [] },
  BlowUpOp: { type: 'ExplosionOp', name: 'ExplosionOp', defs: () => [int('emittertype', 0, 'Emitter Type')] },
  BlasterOp: { type: 'BlasterOp', name: 'blasterop', defs: () => [str('infilename', '', 'Input File'), bool('writeout', true, 'Write Out')] },
};

/** ApplyOp of a legacy simulation operator: the operator, and the particle cloud it outputs. */
function applySimOp(app: App, cmd: string, preset: string, conn: Partial<ParticleConnections>): { op: Operator; cloud: X3DObject } {
  const d = SIM_PRESETS[preset];
  const op = new Operator(d.name, d.type, d.defs());
  (op as any).preset = preset;
  (op as any).connections = { main: [], emitters: [], obstacles: [], forces: [], initialState: [], particleTypes: [], ...conn } as ParticleConnections;
  const cloud = new X3DObject(app.scene.uniqueName('cloud'), 'cloud');                      // inferred name (Q5)
  const prim = new Primitive('cloud', 'cloud');
  prim.addOperator(op); cloud.setPrimitive(prim); cloud.addProperty(makeDisplay());
  const root = app.scene.root;
  app.record('Apply ' + preset, () => { root.addChild(cloud); }, () => { root.removeChild(cloud); });
  nya(app, cmd, `the simulation of operator ${preset} and whether it can still be created in 2015 SP2`, 'Q1, Q3');
  return { op, cloud };
}

/** UpdateParticleTypeConnections: the operator's particle type group follows its emitters' emission properties. */
export function updateParticleTypeConnections(cloud: X3DObject) {
  const op = cloud.primitive?.operators[0]; const c = (op as any)?.connections as ParticleConnections | undefined; if (!c) return;
  const types: Node[] = [];
  for (const e of c.emitters) if (e instanceof X3DObject) for (const p of e.properties) { const t = (p as any).parType; if (p.type === 'EmissionProp' && t && !types.includes(t)) types.push(t); }
  c.particleTypes = types;
}

const PORT_PARAM: Record<string, string> = { Surface: 'surface', Shadow: 'shadow', Volume: 'volume', PhotonVolume: 'photonvolume', Photon: 'photon' };
const portShaders = (m: Material): Record<string, Shader | null> => ((m as any).portShaders ??= {});
function disconnectPort(m: Material, port: string): boolean {
  if (port === 'Surface') m.setSurface(null);
  delete portShaders(m)[port]; m.portConnections.delete(PORT_PARAM[port]);
  return true;
}
function connectPort(m: Material, port: string, sh: Shader): boolean {
  if (!disconnectPort(m, port)) return false;
  if (port === 'Surface') m.setSurface(sh); else if (!sh.parent) sh.parent = m;
  portShaders(m)[port] = sh; m.portConnections.set(PORT_PARAM[port], 'out');
  return true;
}
const particleShader = (preset: string) => makeSiShader(preset, preset) ?? new Shader(preset, preset, []);
function setLocalMaterial(app: App, o: X3DObject, m: Material) {
  const old = o.material, mats = app.scene.materials;
  app.record('Local material', () => { mats.push(m); o.setMaterial(m); }, () => { const i = mats.indexOf(m); if (i >= 0) mats.splice(i, 1); o.setMaterial(old); });
}

/** Default particle renderer (Shared facts): local material, Particle_Renderer on the first port that takes it. */
export function defaultParticleRenderer(app: App, objs: Node[]) {
  for (const n of objs) {
    const o = asCloud(n); if (!o) continue;
    const mat = new Material(app.scene.uniqueName('Material'));                              // the object's material, made local
    const sh = particleShader('Particle_Renderer');
    let taken = false;
    for (const port of ['Surface', 'Shadow', 'Volume', 'PhotonVolume']) if (connectPort(mat, port, sh)) { taken = true; break; }
    if (taken) mat.name = `${o.name}_Material`;
    setLocalMaterial(app, o, mat);
  }
}

/** Explosion shader set (Shared facts). */
function explosionShader(app: App, objs: Node[]) {
  for (const n of objs) {
    const o = asCloud(n); if (!o) continue;
    const sel = [...app.selection];
    app.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [o] });
    app.select(sel);                                                                         // inferred: the script does not change the selection here
    const mat = o.material; if (!mat) continue;
    const surf = particleShader('Particle_ExplosionV2');
    connectPort(mat, 'Surface', surf); connectPort(mat, 'Shadow', surf);
    connectPort(mat, 'Volume', particleShader('Particle_vol_ExplosionV2'));
    disconnectPort(mat, 'Photon');
  }
}

/** SIGetPrim(<preset>, <name>): the emitter primitive. */
function getEmitterPrim(app: App, cmd: string, preset: string, name: string): X3DObject {
  const canon = ['Sphere', 'Disc', 'Grid', 'Cube', 'Cylinder', 'Square'].find(p => same(preset, p))!;
  if (canon === 'Square') {
    // inferred: this build has no square primitive; an implicit one carrying the contract's `square.length`
    const o = new X3DObject(app.scene.uniqueName(name), 'square');
    const prim = new Primitive('square', 'square'); prim.add({ name: 'length', label: 'Length', type: 'double', value: 1 });
    o.setPrimitive(prim); o.addProperty(makeDisplay());
    const root = app.scene.root; app.record('Add ' + o.name, () => { root.addChild(o); }, () => { root.removeChild(o); });
    nya(app, cmd, 'the geometry of the implicit Square primitive in this build', 'Q5');
    return o;
  }
  return app.run('CreatePrim', { PresetObj: canon, GeometryType: 'MeshSurface', Name: name }) as X3DObject;
}
/** SetValue "<emitter>.<prim>.<param>" on the emitter's generator / primitive. */
function setPrimParam(app: App, cmd: string, o: X3DObject, name: string, value: any) {
  const p = o.primitive?.operators[0]?.get(name) ?? o.primitive?.get(name);
  if (p) app.setParam(p, value); else nya(app, cmd, `parameter ${name} of ${o.name} (not on this build's primitive)`, 'Wire contract');
}
/** MakeLocal of the display property (node propagation) and wirecol. */
function localWireColour(app: App, o: X3DObject, colour: number) {
  let d = o.properties.find(p => p.type === 'display');
  if (!d) { const nd = makeDisplay(false); app.record('Local display', () => { o.addProperty(nd); }, () => { o.removeProperty(nd); }); d = nd; }
  else if (d.shared) { const dd = d; app.record('Local display', () => { dd.shared = false; }, () => { dd.shared = true; }); }
  const w = d.get('wirecol'); if (w) app.setParam(w, colour);
  const disp: any = d, old = disp.wirecolIndex;                                              // the palette index itself (this build's wirecol is an on/off flag)
  app.record('Wire colour', () => { disp.wirecolIndex = colour; }, () => { disp.wirecolIndex = old; });
}

// ------------------------------------------------------------------ pick loop, SIAddParticle... (Q1, inferred)

function pickLoop(app: App, filter: string, promptId: number): Node[] {
  const text = PROMPTS[promptId]; const hook = particleScripts(app).hooks.pickElement;
  app.logMsg('info', text);
  if (!hook) return [];                                                                      // inferred: no pick UI wired, the session ends with nothing picked
  let picked: Node | null = null;
  for (let i = 0; i < 1000; i++) { const n = hook(filter, text, text); if (!n) break; if (FILTERS[filter](n)) picked = n; }   // every pick replaces the previous one
  return picked ? [picked] : [];
}
function cancelled(app: App, line: string): never {
  app.logMsg('error', line);
  const e = new Error('siErrCancelled (the operation was cancelled)'); e.name = 'siErrCancelled'; (e as any).siErrCancelled = true;
  throw e;
}
/** Elements hung on a target that is not a 3D object (a particle type). */
function attach(app: App, target: Node, el: Property) {
  if (target instanceof X3DObject) { app.record('Add ' + el.name, () => { target.addProperty(el); }, () => { target.removeProperty(el); }); return; }
  const list: Property[] = ((target as any).particleElements ??= []);
  app.record('Add ' + el.name, () => { list.push(el); el.parent = target; }, () => { const i = list.indexOf(el); if (i >= 0) list.splice(i, 1); el.parent = null; });
}
function siAddParticleEvent(app: App, targets: Node[], sources: Node[]): Node[] {
  const out = targets.map(t => { const ev = new Property('ParticleEvent', 'ParticleEvent', []); (ev as any).sources = [...sources]; attach(app, t, ev); return ev; });
  nya(app, 'AddParticleEvent', 'the event element SIAddParticleEvent creates and its parameters', 'Q1');
  return out;
}
function siAddParticleGoal(app: App, targets: Node[], goals: Node[]): Node[] {
  const out = targets.map(t => { const g = new Property('ParticleGoal', 'ParticleGoal', []); (g as any).goalObjects = [...goals]; attach(app, t, g); return g; });
  nya(app, 'AddParticleGoal', 'the goal element SIAddParticleGoal creates and its parameters', 'Q1');
  return out;
}
function siAddParticleForce(app: App, targets: Node[], forces: Node[]) {
  for (const t of targets) {
    const c = isCloud(t) ? (asCloud(t)!.primitive?.operators[0] as any)?.connections as ParticleConnections | undefined : undefined;
    if (!c) { nya(app, 'AddParticleForce', `connecting forces to ${t.name} (not a legacy particle cloud of this build)`, 'Q1'); continue; }
    const before = [...c.forces], after = [...before, ...forces.filter(f => !before.includes(f))];
    app.record('Add force', () => { c.forces = after; }, () => { c.forces = before; });
  }
  nya(app, 'AddParticleForce', 'what SIAddParticleForce connects on the simulation operator', 'Q1');
}

// ------------------------------------------------------------------ second InspectInitStateProp entry

/** Particle element / operator resolution (Shared facts). */
function particleOperators(app: App, inputs: any): Node[] {
  const out: Node[] = [];
  for (const n of inputOrSelection(app, inputs)) {
    let op: Node | undefined;
    if (n instanceof Operator) op = n;
    else { const prim = isCloud(n) ? asCloud(n)!.primitive : n instanceof Primitive && n.type === 'cloud' ? n : null; op = simOpOf(prim); }
    if (op && !out.includes(op)) out.push(op);
  }
  return out;
}
function inspectParticleSimulationOp(app: App, inputs?: any): Node[] | undefined {
  if (particleScripts(app).scriptingSessionActive) return undefined;
  const ops = particleOperators(app, inputs);
  inspectObj(app, 'InspectParticleSimulationOp', ops, 'Operators');
  return ops;
}

// ------------------------------------------------------------------ EmitPointsFromObject root-port model

interface RootPort { from: { node: number; port: string } | null }
/** The ICE tree's root ports (this build's tree has no root node: ports are kept on the operator, links go to node id 0). */
function syncRoot(tree: ICETreeOperator, ports: RootPort[]) {
  (tree as any).rootPorts = ports.map((p, i) => ({ name: `port${i + 1}`, from: p.from }));
  tree.links = tree.links.filter(l => l.to !== 0);
  ports.forEach((p, i) => { if (p.from) tree.links.push({ from: p.from.node, fromPort: p.from.port, to: 0, toPort: `port${i + 1}` }); });
  tree.touch();
}

// ------------------------------------------------------------------ registration

export function registerParticleScriptCommands(app: App) {
  particleScripts(app);

  // ---- CreateParticleCloud
  app.register({
    name: 'CreateParticleCloud', label: 'Particle Cloud', category: CAT,
    args: [{ name: 'InputObjs', default: null }, { name: 'Prim', default: '' }],
    execute(app, a) {
      const cmd = 'CreateParticleCloud';
      const ptype = createParticleType(app, cmd, 'siBillboardType');                        // always, even when unused
      const prim = ['Sphere', 'Disc', 'Grid', 'Cube'].find(p => same(a.Prim, p));
      let made: { op: Operator; cloud: X3DObject };
      if (prim) {
        const em = getEmitterPrim(app, cmd, prim, 'PEmitter');                               // already a polygon mesh here (SIConvert "MeshSurface")
        if (prim === 'Sphere') setPrimParam(app, cmd, em, 'radius', 1);
        else if (prim === 'Disc') { setPrimParam(app, cmd, em, 'innerradius', 0.01); setPrimParam(app, cmd, em, 'outerradius', 1); setPrimParam(app, cmd, em, 'subdivv', 3); }
        else if (prim === 'Grid') { setPrimParam(app, cmd, em, 'ulength', 1); setPrimParam(app, cmd, em, 'vlength', 1); setPrimParam(app, cmd, em, 'subdivu', 1); setPrimParam(app, cmd, em, 'subdivv', 1); }
        else setPrimParam(app, cmd, em, 'length', 1);
        localWireColour(app, em, 33);
        addEmission(app, em, ptype);
        made = applySimOp(app, cmd, 'SparksOp', { emitters: [em] });
      } else {
        const all = expand(inputOrSelection(app, a.InputObjs));
        const emitters = all.filter((n): n is X3DObject => n instanceof X3DObject && !!n.primitive && !isCloud(n) && n.type !== 'light' && n.type !== 'camera'); // `geometry` members, clouds dropped
        for (const e of emitters) if (!e.properties.some(p => p.type === 'EmissionProp')) addEmission(app, e, ptype);
        const init = all.map(asCloud).find(c => !!c && !simOpOf(c.primitive)) ?? null;
        if (init) { const p = new Property('ParticleInitialStateProp', 'ParticleInitState', []); app.record('Add initial state', () => { init.addProperty(p); }, () => { init.removeProperty(p); }); }
        if (!emitters.length) nya(app, cmd, 'the outcome of SparksOp applied with no emitters', 'Wire contract, Errors');
        made = applySimOp(app, cmd, 'SparksOp', { main: [], emitters, obstacles: [], forces: [], initialState: init ? [init] : [], particleTypes: [] });
      }
      const clouds = [made.cloud];
      for (const c of clouds) updateParticleTypeConnections(c);
      defaultParticleRenderer(app, clouds);
      autoInspect(app, [made.op]);
      return clouds;
    },
  });

  // ---- CreateFluid
  app.register({
    name: 'CreateFluid', label: 'Create Fluid from Cube', category: CAT,
    args: [{ name: 'InputObjs', default: 'Cube' }],
    execute(app, a) {
      const cmd = 'CreateFluid';
      const ptype = createParticleType(app, cmd, 'siBlobType');                              // before the argument check
      const prim = ['Cube', 'Square', 'Disc'].find(p => same(a.InputObjs, p));
      if (!prim) { warn(app, 'Can only CreateFluid with Cube, Square or Disc emitters.'); return undefined; }
      const em = getEmitterPrim(app, cmd, prim, 'FluidEmitter');
      if (prim === 'Disc') { setPrimParam(app, cmd, em, 'innerradius', 0.01); setPrimParam(app, cmd, em, 'outerradius', 1); }
      else setPrimParam(app, cmd, em, 'length', 2);
      localWireColour(app, em, 33);
      app.run('Rotate', { InputObj: [em], X: 90, Y: 0, Z: 0, Mode: 'siAbsolute', RefFrame: 'siLocal' });
      const emission = addEmission(app, em, ptype);
      app.setParam(emission.get('Generation')!, 4);
      const made = applySimOp(app, cmd, 'HyperFlowOp', { emitters: [em] });
      updateParticleTypeConnections(made.cloud);
      defaultParticleRenderer(app, [made.cloud]);
      autoInspect(app, [made.op]);
      return [made.cloud];
    },
  });

  // ---- CreateExplosion
  app.register({
    name: 'CreateExplosion', label: 'Create Explosion from Sphere', category: CAT,
    args: [{ name: 'InputObjs', default: 'Sphere' }],
    execute(app, a) {
      const cmd = 'CreateExplosion';
      const prim = ['Sphere', 'Cylinder'].find(p => same(a.InputObjs, p));
      if (!prim) { warn(app, 'Can only CreateExplosion with Sphere or Cylinder emitters.'); return undefined; }
      const em = getEmitterPrim(app, cmd, prim, 'ExplosionEmitter');
      const rv = em.properties.find(p => p.type === 'visibility')?.get('rendvis'); if (rv) app.setParam(rv, false);
      if (prim === 'Sphere') setPrimParam(app, cmd, em, 'radius', 1);
      else { setPrimParam(app, cmd, em, 'subdivv', 1); setPrimParam(app, cmd, em, 'height', 1); }
      const gen: any = em.primitive?.operators[0];
      if (gen) { const old = gen.locked; app.record('Lock', () => { gen.locked = true; }, () => { gen.locked = old; }); }   // Lock <emitter>.polymsh.geom, default level (inferred: a flag)
      localWireColour(app, em, 33);
      const light = app.run('GetPrim', { PresetObj: 'Point', Name: 'ExplosionLight', Parent: em.fullName }) as X3DObject;
      // the emitter's global position onto the light's global position
      const g = new THREE.Vector3().setFromMatrixPosition(em.globalMatrix());
      const loc = g.clone().applyMatrix4(em.globalMatrix().invert());
      (['x', 'y', 'z'] as const).forEach(ax => app.setParam(light.kinematics.local.get('pos' + ax)!, Math.abs(loc[ax]) < 1e-12 ? 0 : loc[ax]));
      localWireColour(app, light, 15);
      const colour = light instanceof Light ? (light.primitive?.get('soft_light.color') ?? null) : null;
      const made = applySimOp(app, cmd, 'BlowUpOp', { emitters: [em], inputs: [colour ? colour.fullName : `${light.fullName}.soft_light.color`, em] });
      (made.op as any).light = light;
      updateParticleTypeConnections(made.cloud);
      app.setParam(made.op.get('emittertype')!, prim === 'Sphere' ? 0 : 1);
      explosionShader(app, [made.cloud]);
      autoInspect(app, [made.op]);
      return [made.cloud];
    },
  });

  // ---- CreateInspectParticleType{Billboard,Sphere,Blob}: one procedure, three defaults
  for (const [kind, def] of [['Billboard', 'siBillboardType'], ['Sphere', 'siSphereType'], ['Blob', 'siBlobType']] as const) {
    const name = `CreateInspectParticleType${kind}`;
    app.register({
      name, label: `Create & Inspect Particle ${kind} Type`, category: CAT,
      args: [{ name: 'renderType', default: def }],
      execute(app, a) { const pt = createParticleType(app, name, a.renderType); autoInspect(app, [pt]); return undefined; },
    });
  }

  // ---- CreateParticleSimulationFromFile
  app.register({
    name: 'CreateParticleSimulationFromFile', label: 'Create Particle Simulation From File', category: CAT,
    description: 'Create a particle simulation from a cache file',
    args: [{ name: 'FileName', default: '' }],
    execute(app, a) {
      const cmd = 'CreateParticleSimulationFromFile';
      let file = String(a.FileName ?? '');
      if (!file) {
        const o = { title: 'Load Cache File', initialDirectory: 'c:\\', baseName: '', filter: 'PTP Files (*.ptp)|*.ptp|All Files (*.*)|*.*||' };
        const hook = particleScripts(app).hooks.fileBrowser;
        // inferred: without a browser hook a plain text prompt stands in for the open-file browser
        const got = hook ? hook(o) : typeof prompt === 'function' ? prompt(`${o.title} (${o.filter})`, o.initialDirectory) : '';
        file = got && String(got) !== o.initialDirectory ? String(got) : '';
      }
      if (!file) return undefined;                                                           // nothing happens, nothing is logged
      const made = applySimOp(app, cmd, 'BlasterOp', {});
      app.setParam(made.op.get('infilename')!, file);
      app.setParam(made.op.get('writeout')!, false);
      defaultParticleRenderer(app, [made.cloud]);
      autoInspect(app, [made.op]);
      return undefined;                                                                      // the procedure hands nothing back
    },
  });

  // ---- InspectInitStateProp (entry of that name; the second entry is particleScripts(app).inspectParticleSimulationOp, Q2)
  app.register({
    name: 'InspectInitStateProp', label: 'InspectInitStateProp', category: CAT, description: 'Inspect the associated initial states', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const found: Node[] = [];
      const add = (n: Node | undefined) => { if (n && !found.includes(n)) found.push(n); };
      for (const n of inputOrSelection(app, a.InputObjs)) {
        let prim: Primitive | null = null;
        if (isCloud(n)) { prim = asCloud(n)!.primitive; app.logMsg('info', 'got an 3dobject'); }
        else if (n instanceof Primitive && n.type === 'cloud') prim = n;
        if (!prim) continue;
        const pop = prim.operators.find(op => op.type === 'ParticlesOp');
        if (pop) {
          // targets of the operator's connected input ports whose type is ParticleInitState
          const c = (pop as any).connections as ParticleConnections | undefined;
          for (const t of c ? [...c.main, ...c.emitters, ...c.obstacles, ...c.forces, ...c.initialState, ...c.particleTypes] : []) {
            if (t instanceof Property && t.type === 'ParticleInitState') add(t);
            else if (c!.initialState.includes(t) && t instanceof X3DObject) add(t.properties.find(p => p.type === 'ParticleInitState'));   // inferred: the port is connected to the cloud's property
          }
        } else {
          const owner = prim.parent; if (owner instanceof X3DObject) add(owner.properties.find(p => p.type === 'ParticleInitState'));
        }
      }
      if (!particleScripts(app).scriptingSessionActive) inspectObj(app, 'InspectInitStateProp', found);
      return undefined;                                                                      // nothing is produced
    },
  });

  // ---- AddParticleEvent
  app.register({
    name: 'AddParticleEvent', label: 'Add Particle Event', category: CAT,
    description: 'Add a Particle Event to a Particle Type or Obstacle extension property.',
    args: [{ name: 'Target', default: EMPTY_COLLECTION }, { name: 'Source', default: EMPTY_COLLECTION }, { name: 'Output', default: null }],
    execute(app, a) {
      let work = nodesOf(app, a.Target); if (!work.length) work = [...app.selection];
      let targets = work.filter(FILTERS.Decay);
      if (!targets.length) targets = pickLoop(app, 'Decay', 1098);
      if (!targets.length) cancelled(app, 'AddParticleEvent: At least a ptype or an obstacle object needs to be selected in order to add an event to it.');
      const sources = work.filter(n => !targets.includes(n)).filter(FILTERS.PType);          // the Source argument's incoming value is not consulted
      const output = siAddParticleEvent(app, targets, sources);
      autoInspect(app, output);                                                              // key-assignable entry (Q2)
      return { Target: targets, Source: sources, Output: output };
    },
  });

  // ---- AddParticleGoal
  app.register({
    name: 'AddParticleGoal', label: 'Add Particle Goal Object', category: CAT, description: 'Add a particle goal to a particle simulation',
    args: [{ name: 'Target', default: EMPTY_COLLECTION }, { name: 'InputObj', default: EMPTY_COLLECTION }, { name: 'Output', default: null }],
    execute(app, a) {
      let work = nodesOf(app, a.Target); if (!work.length) work = [...app.selection];
      let targets = work.filter(FILTERS.CloudOrPType);
      if (!targets.length) targets = pickLoop(app, 'CloudOrPType', 1099);
      if (!targets.length) cancelled(app, 'AddParticleGoal: At least a cloud or ptype object needs to be selected in order to add a goal to it.');
      let goals = nodesOf(app, a.InputObj).filter(FILTERS.Emitter);                          // no selection fallback here
      if (!goals.length) goals = pickLoop(app, 'Emitter', 1100);
      if (!goals.length) cancelled(app, 'AddParticleGoal: At least a goal object needs to be selected in order to add goal to the particle simulation.');
      const output = siAddParticleGoal(app, targets, goals);
      autoInspect(app, output);                                                              // key-assignable entry "Pick Goal" (Q2)
      return { Target: targets, InputObj: goals, Output: output };
    },
  });

  // ---- AddParticleForce
  app.register({
    name: 'AddParticleForce', label: 'Add Particle Force Object', category: CAT, description: 'Add an object to apply a force to particles',
    args: [{ name: 'Target', default: EMPTY_COLLECTION }, { name: 'InputObj', default: EMPTY_COLLECTION }],
    execute(app, a) {
      let work = nodesOf(app, a.Target); if (!work.length) work = [...app.selection];
      for (const n of nodesOf(app, a.InputObj)) if (!work.includes(n)) work.push(n);
      let forces = work.filter(FILTERS.Force);
      work = work.filter(n => !forces.includes(n));
      let targets = work.filter(FILTERS.object);
      if (!targets.length) targets = pickLoop(app, 'object', 1101);
      if (!targets.length) cancelled(app, 'AddParticleForce: At least a cloud, cloth or SoftBody object needs to be selected in order to add force to it.');
      if (!forces.length) forces = pickLoop(app, 'Force', 1102);                             // a cancelled pick leaves the empty collection
      siAddParticleForce(app, targets, forces);
      autoInspect(app, forces);                                                              // key-assignable entry "Pick Force" (Q2)
      return { Target: targets, InputObj: forces };
    },
  });

  // ---- EmitPointsFromObject
  app.register({
    name: 'EmitPointsFromObject', label: 'Emit Points From Object', category: CAT,
    args: [{ name: 'InputObj', default: null }],
    execute(app, a) {
      const emitters = inputOrSelection(app, a.InputObj).filter(n => n instanceof X3DObject || n instanceof Group);
      if (!emitters.length) { app.logMsg('error', 'No valid geometry selected for emission'); return undefined; }
      const sel = [...app.selection];
      const cloud = app.run('GetPrim', { PresetObj: 'EmptyPointCloud', Name: 'PointCloud' }) as X3DObject;
      const tree = app.run('CreateSimulatedICETree', { ConnectionSet: cloud.fullName }) as ICETreeOperator;
      const ports: RootPort[] = [{ from: null }];                                            // the root's first input port
      const shared: Record<string, { node: IceNode; count: number }> = {};
      const compound = (file: string): IceNode => { const n = app.run('AddICECompoundNode', { File: file, Container: tree }) as IceNode; ports.unshift({ from: { node: n.id, port: 'emit' } }); return n; };
      emitters.forEach((e, i) => {
        const data = tree.addNode('Get Data', 40, 40 + i * 70);                              // GetDataNode, reference = the emitter's full name
        data.params.set('reference', e instanceof Group ? e.name : e.fullName);
        const first = e instanceof Group ? e.members[0] : e;
        const type = e instanceof Group ? (first?.primitive?.type ?? first?.type) : e.type; // inferred for groups: the member's object type when it has no primitive
        const kind = type === 'crvlist' ? 'Emit from Curve' : type === 'surfmsh' || type === 'polymsh' || first?.primitive?.type === 'polymsh' ? 'Emit from Surface' : 'Emit from Null';
        if (kind === 'Emit from Null') { const n = compound(kind); tree.connect(data.id, 'outname', n.id, 'Null_Name'); return; }
        const s = (shared[kind] ??= { node: compound(kind), count: 0 });
        s.count++;                                                                           // later emitters: a new emitter port after Emitter1
        ((s.node as any).emitterPorts ??= []).push(`emitter${s.count}`);
        tree.connect(data.id, 'value', s.node.id, `emitter${s.count}`);
      });
      ports.splice(1, 0, { from: null });                                                    // one more port after the root's first input port
      const sim = app.run('AddICENode', { PresetObj: 'SimulateParticlesNode', Container: tree }) as IceNode;
      ports[ports.length - 1].from = { node: sim.id, port: 'simulate' };                     // the root's last input port
      syncRoot(tree, ports);
      nya(app, 'EmitPointsFromObject', 'the emission compounds and the simulate node are placeholders in this build\'s ICE node catalogue', 'Wire contract');
      app.select(sel);                                                                       // no selection change of its own
      return cloud;
    },
  });
}
