// Ledger row CMD-B6d, second half (docs/ghidra/cmd-b6d-operators-scripts.md, "Wire contract"): the cluster centre
// commands, CreateNonOverlappingCluster, CreateSimulationBracket, ApplyDeformBySpine, ApplySpringOp,
// InspectSpringPropertiesProc, BurnAndDeleteGATOROperator, ChangeVertexColorDatatype and the two symmetrize
// reference-plane commands. Original code. Conventions: see the header of operatorsScripts.ts.
import * as THREE from 'three';
import type { App, CommandDef } from '../core/commands';
import { X3DObject, Node, Operator, Cluster, Property, Group, construction, makeSiOpProperty } from '../core/scene';
import { num, enumP } from '../core/params';
import { siParamDefs } from '../core/opdefs';
import { makeRefDeformOperator } from '../core/scene2';
import { EnvelopeOperator } from '../core/envelope';
import { meshEdges, edgeKey } from '../core/topology';
import { uniqueClusterName } from '../core/textureProjectionScripts';
import { unset, boolArg, findObject } from './viewEditPropertyHelpers';
import { startPickSession, interactive } from './miscDsScriptsPick';
import {
  type CsItem, collectionItems, connectionGroups, groupsText, ownerObject, meshOf, pointsOf, componentCentres, toWorld, outConnections,
  VertexColorChangeDatatypeOp, VERTEX_COLOR_DATATYPES, markerOperator, makeSpringOperator,
} from './operatorsScriptsOps';
import { type OperatorsScriptsState, opsText, logNya, Cancelled, delegate, scriptMsgBox, autoInspect, asUi, setOut, setOp, constructionModeOf, setConstructionMode } from './operatorsScripts';

type V3 = [number, number, number];
const COMP = { pnt: 'point', edge: 'edge', poly: 'polygon' } as const;
const LABEL: Record<string, string> = { pnt: 'Point', edge: 'Edge', poly: 'Polygon', sample: 'Sample' };
const itemOfNode = (n: Node): CsItem => ({ raw: n, text: n.fullName, node: n, obj: ownerObject(n), sub: null });
const firstObject = (r: any): X3DObject | null => { const x = Array.isArray(r) ? r[0] : r; return x instanceof X3DObject ? x : null; };
function keepSelection<T>(app: App, f: () => T): T {
  const sel = [...app.selection]; const comp = app.compSel; const mode = app.selMode;
  try { return f(); } finally { app.selection = sel; app.compSel = comp; app.selMode = mode; app.events.emit('selection'); }
}

/**
 * Tagged components -> clusters (the script's shared helper). The bus cluster command reads the component selection,
 * so each tagged item is selected for its call; afterwards the tagged components are out of the selection, as the
 * callers of the helper leave them.   // inferred: one call per item instead of one call for all
 */
function subsToClusters(app: App, items: CsItem[]): { list: CsItem[]; made: Cluster[]; subs: CsItem[] } {
  const subs = items.filter(i => i.sub && i.obj), rest = items.filter(i => !i.sub); const made: Cluster[] = [];
  if (subs.length) {
    const sel = [...app.selection]; const mode = app.selMode;
    for (const s of subs) {
      const sub = s.sub!; const elems = sub.kind === 'edge' ? sub.edges.map(e => `${e[0]}-${e[1]}`) : sub.indices;
      app.selectComponents(s.obj!, COMP[sub.kind], elems, 'replace');
      const c = app.run('CreateClusterFromSubComponent', { InputObjs: s.text });
      if (c instanceof Cluster) made.push(c);
    }
    app.compSel = null; app.selMode = mode; app.selection = sel.filter(n => !(n instanceof Cluster && made.includes(n))); app.events.emit('selection');
  }
  return { list: [...rest, ...made.map(itemOfNode)], made, subs };
}
const clustersOf = (list: CsItem[]) => list.map(i => i.node).filter((n): n is Cluster => n instanceof Cluster);

/** SIGetPrim "Null", <name>[, <parent>]: the bus GetPrim, with the selection kept. */
function getNull(app: App, name: string, parent: X3DObject | null): X3DObject | null {
  return keepSelection(app, () => firstObject(app.run('GetPrim', { PresetObj: 'Null', Name: name, Parent: parent && parent !== app.scene.root ? parent.name : '' })));
}
/** Translate <null>, x, y, z, 0. inferred: delta mode 0 is relative (Q4). */
const translate = (app: App, o: X3DObject, p: V3) => { app.run('Translate', { InputObj: [o], X: p[0], Y: p[1], Z: p[2], Mode: 'siRelative' }); };
/** ApplyOperator "ClusterCenter", <cluster ; null>: this build's cluster-centre deformer on the cluster's points. */
function applyClusterCenter(app: App, c: Cluster, nul: X3DObject): Operator | null {
  const o = c.obj; const prim = o?.primitive; if (!o || !prim) return null;
  const op = makeRefDeformOperator('Cluster Center', [nul], () => o, { kind: 'point', indices: pointsOf(o, c.compKind, c.elements) }); if (!op) return null;
  app.record('ClusterCenter', () => prim.addOperator(op), () => prim.removeOperator(op));
  return op;
}
const mean = (ps: V3[]): V3 | null => ps.length ? [0, 1, 2].map(k => ps.reduce((s, p) => s + p[k], 0) / ps.length) as V3 : null;
const elemKey = (o: X3DObject | null, kind: string, e: number | string): string => {
  if (kind !== 'edge') return String(e);
  const pair = typeof e === 'string' && e.includes('-') ? e.split('-').map(Number) : meshEdges(meshOf(o) ?? ({ polygons: [] } as any))[Number(e)];
  return pair ? edgeKey(pair[0], pair[1]) : String(e);
};

export function registerOperatorsScriptsMore(app: App, state: OperatorsScriptsState) {
  const reg = (def: CommandDef) => app.register(def);

  // ---------------------------------------------------------------- CreateClusterCenter
  reg({
    name: 'CreateClusterCenter', label: 'Deform by Cluster Center with Nulls Creation', category: 'Deformation', description: 'Applies a cluster centre deformer to clusters, driven by supplied, created or picked nulls',
    args: [{ name: 'InputObjs', default: null }, { name: 'S3D_CMDARG_NULLLIST', default: null }, { name: 'SupplyMode', default: true }, { name: 'ConstructionMode', default: null }],
    execute(app, a) {
      const cmd = 'CreateClusterCenter';
      const fail = () => { app.logMsg('info', opsText(1092)); scriptMsgBox(app, opsText(1092), 'Warning'); return undefined; };
      const items = collectionItems(app, a.InputObjs);
      if (!items.length) return fail();
      const clusters = clustersOf(subsToClusters(app, items).list);
      if (!clusters.length) return fail();
      const supplied = collectionItems(app, a.S3D_CMDARG_NULLLIST, false).map(i => i.node).filter((n): n is X3DObject => n instanceof X3DObject);
      const supply = boolArg(a.SupplyMode); const mode = constructionModeOf(a.ConstructionMode);
      const results: Operator[] = [], created: X3DObject[] = [], picked: X3DObject[] = [];
      // deformer apply helper: the given construction mode for the application, the previous one afterwards
      const apply = (c: Cluster, nul: X3DObject) => {
        const prev = construction.mode; if (mode) setConstructionMode(app, mode);
        try { const op = applyClusterCenter(app, c, nul); if (op) results.push(op); } finally { setConstructionMode(app, prev); }
      };
      let single: X3DObject | null = null;
      if (supply && clusters.length > 1) {
        const names = new Set(clusters.map(c => c.obj?.name ?? ''));
        const o = clusters[0].obj;
        single = names.size === 1 && o ? getNull(app, `${o.name}_ClsCtr`, o) : getNull(app, 'ClsCtr', null);
        if (single) created.push(single);
      }
      const sum = new THREE.Vector3(); const sharedOps: Operator[] = []; let lastPicked = false;
      const finish = () => {
        setOut(app, cmd, { S3D_CMDARG_NULLLIST: lastPicked ? [...supplied, ...picked] : a.S3D_CMDARG_NULLLIST ?? null });
        if (!results.length) { fail(); return; }
        app.run('DeselectAll');
        app.run('SelectObj', { InputObjs: [...supplied, ...created, ...picked] });
        autoInspect(app, results);
      };
      const step = (i: number): void => {
        if (i >= clusters.length) { finish(); return; }
        const c = clusters[i]; const o = c.obj; lastPicked = false;
        if (supply && i >= supplied.length) {
          // centre in global space: polygon centre / edge average / point position per element, then the mean
          const centre = o ? mean(componentCentres(c).map(p => toWorld(o, p))) : null;
          if (single) {
            if (centre) sum.add(new THREE.Vector3(...centre));
            const before = results.length;
            if (i === clusters.length - 1) {
              translate(app, single, [sum.x / clusters.length, sum.y / clusters.length, sum.z / clusters.length]);
              // inferred: this build's deformer snapshots the null when it is applied; the ones applied before the move take the moved pose as rest
              const rest = single.globalMatrix().clone(); for (const op of sharedOps) { (op as any).rest = rest; const prim: any = op.parent; if (prim) prim.dirty = true; }
            }
            apply(c, single); sharedOps.push(...results.slice(before));
          } else if (o) {
            const nul = getNull(app, `${o.name}_${c.name}_ClsCtr`, o);
            if (nul) { created.push(nul); if (centre) translate(app, nul, centre); apply(c, nul); }
          }
          step(i + 1); return;
        }
        if (i < supplied.length) { apply(c, supplied[i]); step(i + 1); return; }
        // SupplyMode false and no null left: the user picks the null
        if (!interactive(app)) { logNya(app, cmd, `picking the null for ${c.fullName} needs a user session; the cluster is skipped`, 'Q3'); step(i + 1); return; }
        let got: X3DObject | null = null;
        const s = startPickSession(app, {
          command: cmd, kind: 'element', filter: 'object', prompt: `Pick the null for ${c.name}`,   // inferred prompt: the connection-set command's own text is not in the note
          fromClick: (_p, pick) => pick?.obj ?? null,
          onPick: (v: any) => { const n = v instanceof X3DObject ? v : typeof v === 'string' ? findObject(app, v) : null; if (!n) return true; got = n; return false; },
          onEnd: () => { if (got) { picked.push(got); apply(c, got); lastPicked = true; } else logNya(app, cmd, `the pick for ${c.fullName} was cancelled; the cluster is skipped`, 'Q3'); step(i + 1); },
        });
        if (!s) step(i + 1);
      };
      step(0);
      return results;   // filled as picks arrive when nulls are picked (Q3: item type of the result)
    },
  });

  // ---------------------------------------------------------------- CreateClusterCenterWithNull
  function clusterCenterWithNull(app: App, a: Record<string, any>, proc: boolean): Operator[] | undefined {
    const fail = () => {
      if (proc) { app.logMsg('info', 'CreateClusterCenter: ' + opsText(1092)); scriptMsgBox(app, opsText(1092), 'Warning'); }
      else app.logMsg('error', 'CreateClusterCenter: Please tag some points or select a cluster first.');
      return undefined;
    };
    const clusters = clustersOf(subsToClusters(app, collectionItems(app, a.InputObjs)).list);
    if (!clusters.length) return fail();
    const owners = [...new Set(clusters.map(c => c.obj).filter((o): o is X3DObject => !!o))];
    const first = owners[0] ?? null;
    const nul = clusters.length === 1 && first ? getNull(app, `${first.name}_${clusters[0].name}_ClsCtr`, first)
      : owners.length === 1 && first ? getNull(app, `${first.name}_ClsCtr`, first) : getNull(app, 'ClsCtr', null);
    if (!nul) return fail();
    // average of each cluster's components in object space, mapped to world space; clusters that give nothing still count
    const sum = new THREE.Vector3();
    for (const c of clusters) { const o = c.obj; const m = o ? mean(componentCentres(c)) : null; if (o && m) sum.add(new THREE.Vector3(...toWorld(o, m))); }
    translate(app, nul, [sum.x / clusters.length, sum.y / clusters.length, sum.z / clusters.length]);   // before applying: the rest snapshot
    const prev = construction.mode; const mode = constructionModeOf(a.ConstructionMode); const ops: Operator[] = [];
    if (mode) setConstructionMode(app, mode);
    try { for (const c of clusters) { const op = applyClusterCenter(app, c, nul); if (op) ops.push(op); } } finally { setConstructionMode(app, prev); }
    app.run('DeselectAll'); app.run('SelectObj', { InputObjs: [nul] });
    if (proc) autoInspect(app, ops);
    return ops;
  }
  reg({
    name: 'CreateClusterCenterWithNull', label: 'Deform by Cluster Center with Nulls Creation', category: 'Modeling|Deformation', description: 'One new null driving all given clusters through cluster centre deformers',
    args: [{ name: 'InputObjs', default: null }, { name: 'ConstructionMode', default: null }],
    execute: (app, a) => clusterCenterWithNull(app, a, false),
  });
  state.ui.CreateClusterCenterWithNull = (args = {}) => asUi(app, () => clusterCenterWithNull(app, { InputObjs: null, ConstructionMode: null, ...args }, true));

  // ---------------------------------------------------------------- CreateNonOverlappingCluster
  reg({
    name: 'CreateNonOverlappingCluster', label: 'Create Non-Overlapping Cluster', category: 'Cluster', description: 'Makes a cluster of the tagged components that belong to no cluster of the same type',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const items = collectionItems(app, a.InputObjs);
      if (!items.length) { app.logMsg('info', 'Tag some components first'); return undefined; }
      // inferred: with no tagged component in the input the script's temporary list is unset and it fails
      if (!items.some(i => i.sub)) throw new Error('CreateNonOverlappingCluster: the input holds no tagged components');
      const temps = subsToClusters(app, items).made;
      app.run('DeselectAll');
      for (const t of temps) {
        const old = t.name; app.record('Rename', () => { t.name = 'tagged_nonoverlap'; }, () => { t.name = old; });
        const o = t.obj; if (!o) continue;
        const others = o.clusters.filter(c => c !== t && c.compKind === t.compKind && c.name !== t.name).map(c => new Set([...c.elements].map(e => elemKey(o, c.compKind, e))));
        const kept = [...t.elements].filter(e => { const k = elemKey(o, t.compKind, e); return !others.some(s => s.has(k)); });
        if (!kept.length) continue;
        const c = new Cluster(uniqueClusterName(o, LABEL[t.compKind] ?? 'Cluster'), t.compKind, new Set(kept));   // object-model AddCluster: default name, not a logged command
        app.record('Add cluster', () => { o.addCluster(c); }, () => o.removeCluster(c));
        app.select([c], 'add');   // AddToSelection <new cluster>
      }
      // RemoveCluster <temporary clusters> (done here: the bus command selects the owner afterwards)
      for (const t of temps) { const o = t.obj; if (!o) continue; const idx = o.clusters.indexOf(t); app.record('Remove ' + t.name, () => o.removeCluster(t), () => { t.parent = o.primitive?.explorerChildren().slice(-1)[0] ?? (o as any); o.clusters.splice(idx, 0, t); }); }
      return undefined;
    },
  });

  // ---------------------------------------------------------------- CreateSimulationBracket
  const hang = (target: object, op: Operator) => { const list = outConnections(target); app.record('Apply ' + op.name, () => { op.parent = target as any; list.push(op); }, () => { const i = list.indexOf(op); if (i >= 0) list.splice(i, 1); }); };
  const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
  reg({
    name: 'CreateSimulationBracket', label: 'Create Simulation Bracket', category: 'Edit', description: 'Adds the simulation region markers and the evolve operator to objects',
    args: [{ name: 'ConnectionSet', default: null }],
    execute(app, a) {
      const cmd = 'CreateSimulationBracket';
      // the scene's simulation environment (inferred: the node this build's CreateEnvironment makes), created when missing
      let env = [...app.scene.allObjects()].find(o => !!o.get('simenv')) ?? null;
      if (!env) {
        env = keepSelection(app, () => firstObject(app.run('CreateEnvironment', { Name: 'Environment' })));
        if (env && !delegate(app, 'AddContainerToEnvironment', { Environment: env, Type: 'Force', Support3DObject: true, Name: 'Forces' }).done) logNya(app, cmd, 'the environment container command is not available; the new environment has no "Forces" container', 'Q9');
      }
      if (!env) return 0;
      const environment = env;
      // inferred: the environment's simulation time control and its per-model caches are properties of the environment node
      const timeControl = () => { let p = environment.properties.find(x => x.type === 'simtimectrl'); if (!p) { const np = new Property('SimulationTimeControl', 'simtimectrl', []); app.record('Add time control', () => { environment.addProperty(np); }, () => environment.removeProperty(np)); p = np; } return p; };
      const cacheFor = (model: X3DObject) => {
        let p = environment.properties.find(x => x.type === 'environmentcache' && (x as any).model === model);
        if (!p) { const np = new Property(`${model.name}_${environment.name}_Cache`, 'environmentcache', []); (np as any).model = model; app.record('Add cache', () => { environment.addProperty(np); }, () => environment.removeProperty(np)); p = np; }
        return p;
      };
      const evolve = (target: any, owner: X3DObject | null, settings: Property | null) => {
        const op = markerOperator('Evolve', 'Evolve', siParamDefs('Evolve'));
        (op as any).connections = { target, timeControl: timeControl(), cache: cacheFor(owner?.model ?? app.scene.root), settings };
        return op;
      };
      const items = collectionItems(app, a.ConnectionSet).filter(i => i.node instanceof X3DObject || i.node instanceof Group || i.node instanceof Property);
      for (const it of items) {
        const n = it.node!;
        if (n instanceof X3DObject && n.type !== 'null') {
          const prim = n.primitive; if (!prim || !prim.operators.length) continue;   // needs the unevaluated primitive
          if (prim.operators.some(op => same(op.type, 'MixerOp'))) { app.logMsg('error', `The object ${n.fullName} has a mixer connected. Cannot add a simulated ICE tree.`); continue; }
          const has = (t: string) => prim.operators.some(op => op.type === t || op.name === t);
          const add = (op: Operator) => app.record('Apply ' + op.name, () => prim.addOperator(op), () => prim.removeOperator(op));
          for (const t of ['SimulationMarker', 'PostSimulationMarker']) if (!has(t)) add(markerOperator(t, t));
          if (!has('Evolve')) {
            const settings = makeSiOpProperty('prop:simulationsettings', 'Simulation Settings', 'simulationsettings');   // SIAddProp "SimulationSettings", <object>, , "Simulation Settings"
            app.record('Add Simulation Settings', () => { n.addProperty(settings); }, () => n.removeProperty(settings));
            add(evolve(prim, n, settings));
          }
          continue;
        }
        const isNull = n instanceof X3DObject; const isIce = n instanceof Property && n.type === 'ICEProperty';
        if (!isNull && !isIce) continue;   // groups and other properties: nothing
        // inferred: a null has no primitive node here, the null itself carries its connections
        const target: any = isNull ? (n as X3DObject).primitive ?? n : n; const prefix = isNull ? 'Primitive' : 'ICEProperty';
        const conns = outConnections(target);
        for (const c of conns) app.logMsg('info', `checking : ${c.fullName}, type: ${c.type}`);
        const has = (t: string) => conns.some(c => same(c.type, t));
        for (const t of ['SimulationMarker', 'PostSimulationMarker', 'PreSimulationMarker']) if (!has(t)) hang(target, markerOperator(prefix + t, t.toLowerCase()));
        if (!has('Evolve')) hang(target, evolve(target, ownerObject(n), null));
      }
      return 0;
    },
  });

  // ---------------------------------------------------------------- ApplyDeformBySpine
  function deformBySpine(app: App, a: Record<string, any>, ui: boolean): any {
    const cmd = 'ApplyDeformBySpine';
    const made: Cluster[] = [], tagged: CsItem[] = [];
    const groups = connectionGroups(app, a.ConnectionSet).map(g => { const r = subsToClusters(app, g); made.push(...r.made); tagged.push(...r.subs); return r.list; }).filter(g => g.length);
    const text = groupsText(groups);
    setOut(app, cmd, { ConnectionSet: ui ? text : a.ConnectionSet ?? '' });
    if (!groups.length) { logNya(app, cmd, 'picking the inputs is the C++ spine command\'s; with an empty connection set nothing was applied', 'Q9'); return undefined; }
    let result: any;
    if (!app.commands.has('SIApplyDeformBySpine')) logNya(app, cmd, 'the C++ spine command is not available; nothing was applied', 'Q9');
    else {
      // inferred: the bus spine command reads the selection and the current construction mode, so both are set for the call
      const objs = [...new Set(groups.flat().map(i => i.obj).filter((o): o is X3DObject => !!o))];
      const prev = construction.mode; const mode = constructionModeOf(a.ConstructionMode);
      app.select(objs); if (mode) setConstructionMode(app, mode);
      try { result = app.run('SIApplyDeformBySpine', { ConnectionSet: text, Interactive: ui, ConstructionMode: a.ConstructionMode }); } finally { setConstructionMode(app, prev); }
    }
    if (made.length) { app.compSel = null; app.select(made, 'add'); }   // RemoveFromSelection <tagged components>, AddToSelection <new clusters>
    if (ui && result) autoInspect(app, Array.isArray(result) ? result : [result]);
    return result;
  }
  reg({
    name: 'ApplyDeformBySpine', label: 'Deform by Spine', category: 'Deformation', description: 'Set both the PropWeightMapBySpine and DeformBySpine operators on selected objects',
    args: [{ name: 'ConnectionSet', default: null }, { name: 'ConstructionMode', default: null }],
    execute: (app, a) => deformBySpine(app, a, false),
  });
  state.ui.ApplyDeformBySpine = (args = {}) => asUi(app, () => deformBySpine(app, { ConnectionSet: '', ConstructionMode: null, ...args }, true));

  // ---------------------------------------------------------------- ApplySpringOp
  reg({
    name: 'ApplySpringOp', label: 'ApplySpringOp', category: 'Simulation', description: 'Applies a spring operator between a driven object and its anchor',
    args: [{ name: 'InputObjs', default: null }, { name: 'Mass', default: 20 }, { name: 'LinearStiffness', default: 100 }, { name: 'LinearDamping', default: 100 }, { name: 'SpringCache', default: '' }, { name: 'OutputObjs', default: null }],
    execute(app, a) {
      const cmd = 'ApplySpringOp';
      const inputs = collectionItems(app, a.InputObjs, false).map(i => i.node).filter((n): n is X3DObject => n instanceof X3DObject);
      const driven = inputs[0], anchor = inputs[1];
      // inferred: the script does not validate the input count; reading a missing item fails
      if (!driven || !anchor) throw new Error('ApplySpringOp: InputObjs needs the driven object and its anchor');
      let cache: any = a.SpringCache;
      if (unset(cache)) {
        const model = driven.model ?? app.scene.root; let name = 'SpringCacheSource'; for (let i = 1; model.properties.some(p => p.name === name); i++) name = `SpringCacheSource${i}`;
        const src = new Property(name, 'actionsource', []);
        app.record('Add ' + name, () => { model.addProperty(src); }, () => model.removeProperty(src));
        cache = src.fullName;
      }
      const rest = new THREE.Vector3().setFromMatrixPosition(driven.globalMatrix()).applyMatrix4(anchor.globalMatrix().invert());
      // ApplyOp "SpringOp", <InputObjs>: this build has no spring solver; the operator is created with its parameters and hangs on the driven object's global kinematics
      const kine = driven.kinematics.global;
      const op = makeSpringOperator(); (op as any).driven = driven; (op as any).anchor = anchor; hang(kine, op);
      const stiff = Number(a.LinearStiffness), damp = Number(a.LinearDamping);
      const values: [string, number][] = [['Mass', Number(a.Mass)], ['LinearStiffness', stiff], ['LinearDamping', damp], ['AngularStiffness', stiff], ['AngularDamping', damp],
        ['RestPosX', rest.x], ['RestPosY', rest.y], ['RestPosZ', rest.z], ['InitialStatePosX', rest.x], ['InitialStatePosY', rest.y], ['InitialStatePosZ', rest.z],
        ['InitialStateVelX', 0], ['InitialStateVelY', 0], ['InitialStateVelZ', 0]];
      for (const [k, v] of values) setOp(app, cmd, op, k, v);
      const tc: Property = (op as any).simtimectrl;
      setOp(app, cmd, tc, 'playmode', 2); setOp(app, cmd, tc, 'SynchWithSceneStart', true); setOp(app, cmd, tc, 'SynchWithSceneEnd', true);
      // ApplyOp "EvolveOp", "<driven>.kine.global;<driven>.kine.global;<spring op>.simtimectrl;<SpringCache>"
      const ev = markerOperator('Evolve', 'Evolve', siParamDefs('Evolve'));
      (ev as any).connections = { target: kine, timeControl: tc, cache }; (ev as any).driven = driven; hang(kine, ev);
      logNya(app, cmd, 'the spring simulation itself is the C++ operator\'s; the spring and evolve operators were created with their parameters and do not move the object', 'Q9');
      if (Array.isArray(a.OutputObjs)) { a.OutputObjs.length = 0; a.OutputObjs.push(op); }
      setOut(app, cmd, { InputObjs: inputs.map(o => o.fullName).join(','), SpringCache: cache, OutputObjs: [op] });
      return undefined;
    },
  });

  // ---------------------------------------------------------------- InspectSpringPropertiesProc
  reg({
    name: 'InspectSpringPropertiesProc', label: 'Inspect Spring Properties', category: 'Simulation', description: 'Opens the global kinematics of the spring-driven children of the given nodes', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const cmd = 'InspectSpringPropertiesProc';
      // FindObjects by class id: spring operators, then evolve operators (those hanging on a global kinematic state)
      const all = [...app.scene.allObjects()].flatMap(o => outConnections(o.kinematics.global));
      const ops = [...all.filter(op => op.type === 'SpringOp'), ...all.filter(op => op.type === 'Evolve')];
      const inputs = collectionItems(app, a.InputObjs).map(i => i.node).filter((n): n is X3DObject => n instanceof X3DObject);
      const list: Node[] = [];
      for (let k = ops.length - 1; k >= 0; k--) {
        const driven: X3DObject | undefined = (ops[k] as any).driven; if (!driven) continue;
        for (const input of inputs) {
          const found = findObject(app, input.name);   // the input item, located under the scene root by name
          if (found && found.children.includes(driven)) { list.push(driven.kinematics.global); break; }
        }
      }
      setOut(app, cmd, { inspected: list.map(n => n.fullName) });
      // InspectObj <list>: the bus command addresses objects, so the kinematic states are sent to the property editor here
      if (!list.length) { logNya(app, cmd, 'InspectObj with an empty list; nothing was opened', 'Q11'); return undefined; }
      for (const n of [...new Set(list)]) app.events.emit('inspect', n);
      return undefined;
    },
  });

  // ---------------------------------------------------------------- BurnAndDeleteGATOROperator
  reg({
    name: 'BurnAndDeleteGATOROperator', label: 'Burn GATOR Operator', category: 'Modeling', description: 'Writes the GATOR envelope weights into the other envelopes of the object and hands back the GATOR cluster',
    args: [{ name: 'InputObj', default: null }, { name: 'OutputObjs', default: null }],
    execute(app, a) {
      const cmd = 'BurnAndDeleteGATOROperator';
      const op = a.InputObj instanceof Node ? a.InputObj : collectionItems(app, a.InputObj, false)[0]?.node ?? null;
      setOut(app, cmd, { OutputObjs: Array.isArray(a.OutputObjs) ? a.OutputObjs : [] });
      if (!op || op.type !== 'TransferAttributes') return undefined;
      const o: X3DObject | null = ownerObject(op) ?? ((op as any).cluster instanceof Cluster ? ((op as any).cluster as Cluster).obj : null);
      const envelopes = (o?.primitive?.operators ?? []).filter((x): x is EnvelopeOperator => x instanceof EnvelopeOperator);
      if (!o || envelopes.length < 2) return undefined;   // the only envelope is GATOR's own
      // the first owner of the operator that is a cluster.   // inferred: operators sit in the geometry stack here, the cluster is the operator's `cluster` link
      let cluster: Cluster | null = null; for (let n: any = op.parent; n && !cluster; n = n.parent) if (n instanceof Cluster) cluster = n;
      if (!cluster && (op as any).cluster instanceof Cluster) cluster = (op as any).cluster;
      const envProp = cluster?.properties.find(p => p.type === 'envelope');
      const gator: EnvelopeOperator | null = (envProp as any)?.op instanceof EnvelopeOperator ? (envProp as any).op : null;
      if (!cluster || !gator) { logNya(app, cmd, 'the GATOR cluster or its envelope could not be found on the operator; nothing was burnt'); return undefined; }
      const prim = o.primitive!;
      for (const env of envelopes) {
        if (env === gator) continue;
        const before = env.weights.map(w => new Float32Array(w)), after = env.weights.map(w => new Float32Array(w));
        gator.deformers.forEach((d, gi) => {
          const ei = env.deformers.indexOf(d); if (ei < 0) return;   // inferred: a deformer the other envelope does not have is left out
          for (let i = 0; i < after.length; i++) { const gw = gator.weights[i]?.[gi] ?? 0; if (gw !== 0) after[i][ei] = gw; }   // zero GATOR weights keep the existing value; no normalisation
        });
        app.record('Burn GATOR weights', () => { env.weights = after.map(w => new Float32Array(w)); prim.dirty = true; }, () => { env.weights = before.map(w => new Float32Array(w)); prim.dirty = true; });
      }
      // the procedure appends to the collection it was given
      if (Array.isArray(a.OutputObjs)) a.OutputObjs.push(cluster);
      else logNya(app, cmd, 'OutputObjs must already be a collection; the GATOR cluster is in app.operatorsScripts.outputs only');
      setOut(app, cmd, { OutputObjs: Array.isArray(a.OutputObjs) ? a.OutputObjs : [cluster] });
      return undefined;
    },
  });

  // ---------------------------------------------------------------- ChangeVertexColorDatatype
  reg({
    name: 'ChangeVertexColorDatatype', label: 'Change VertexColor Datatype', category: 'VertexColor', description: 'Installs the operator that converts a vertex colour property to another datatype',
    args: [{ name: 'InputObj', default: null }, { name: 'DesiredDatatype', default: 0 }, { name: 'OutputObjs', default: null }],
    execute(app, a) {
      const cmd = 'ChangeVertexColorDatatype';
      const invalid = (): never => { app.logMsg('error', 'Invalid VertexColor property'); throw new Cancelled(cmd); };
      setOut(app, cmd, { OutputObjs: null });
      const prop = collectionItems(app, a.InputObj, false)[0]?.node;
      if (!(prop instanceof Property) || prop.type !== 'vertexcolor') return invalid();
      // inferred: this build's vertex colour property is created without the SPDL "datatype" parameter (C3DVertexColorProp.spdl, default 0)
      if (!prop.get('datatype')) prop.add(enumP('datatype', 0, VERTEX_COLOR_DATATYPES, 'DataType', { readOnly: true }));
      const desired = Number(a.DesiredDatatype) || 0;
      if (Number(prop.val('datatype')) === desired) { app.logMsg('info', 'The CAV is already using the specified datatype. There is no need to install an operator'); return undefined; }
      // ApplyOp "VertexColorChangeDatatype", <property>
      const prim = ownerObject(prop)?.primitive;
      if (!prim || !prim.operators.length) { app.logMsg('error', 'Could not install the Vertex Color conversion operator'); throw new Cancelled(cmd); }
      const op = new VertexColorChangeDatatypeOp(prop);
      app.record('Apply ' + op.name, () => prim.addOperator(op), () => prim.removeOperator(op));
      setOp(app, cmd, op, 'desireddatatype', desired);
      const out = [op];
      if (Array.isArray(a.OutputObjs)) { a.OutputObjs.length = 0; a.OutputObjs.push(op); }
      setOut(app, cmd, { OutputObjs: out });
      return out;
    },
  });

  // ---------------------------------------------------------------- symmetrize reference plane
  const PLANE_PARAMS: [string, string][] = [['planeposx', 'posx'], ['planeposy', 'posy'], ['planeposz', 'posz'], ['planerotx', 'rotx'], ['planeroty', 'roty'], ['planerotz', 'rotz'], ['planenormal', 'normal']];
  /** "RefPlanes.<name>": created on first use with zero values.   // inferred: this build has no reference plane container */
  const refPlane = (name: string): Property => {
    let p = state.refPlanes.get(name);
    if (!p) { p = new Property(name, 'refplane', PLANE_PARAMS.map(([, n]) => num(n, 0, n))); state.refPlanes.set(name, p); }
    return p;
  };
  function symmetrizeRefPlane(app: App, cmd: string, a: Record<string, any>, toOperator: boolean) {
    const ops = collectionItems(app, a.InputObjs, false).map(i => i.node).filter((n): n is Operator => n instanceof Node && n.kind === 'operator');
    if (!ops.length || ops.some(op => op.type !== 'symmetrizepolygonop')) { app.logMsg('info', 'This command must be applied on a SymmetrizePolygon operator.'); return undefined; }
    const name = String(a.RefPlane ?? '');
    if (['View', 'XY', 'XZ', 'YZ'].includes(name)) { app.logMsg('info', 'The input reference plane cannot be View, XY, XZ or YZ.'); return undefined; }
    const full = `RefPlanes.${name}`;
    if (!delegate(app, 'SetCurrentReferencePlane', { RefPlane: full }).done) state.currentReferencePlane = full;
    app.run('SetUserPref', { Name: '3D_TRANSFO_REFERENTIAL_CHANGED', Value: 7 });
    const plane = refPlane(name);
    for (const op of ops) {
      setOp(app, cmd, op, 'symmetryreference', 0); setOp(app, cmd, op, 'symmetryplane', 3);
      for (const [o, r] of PLANE_PARAMS) {
        if (toOperator) setOp(app, cmd, op, o, plane.val(r));
        else if (op.get(o)) setOp(app, cmd, plane, r, op.val(o));
      }
    }
    return undefined;
  }
  reg({
    name: 'SetSymmetrizePolygonOpRefPlane', label: 'Set SymmetrizePolygonOp RefPlane', category: 'Modeling|Topology', description: 'Copies a reference plane into the custom symmetry plane of SymmetrizePolygon operators',
    args: [{ name: 'InputObjs', default: null }, { name: 'RefPlane', default: 'Transform' }],
    execute: (app, a) => symmetrizeRefPlane(app, 'SetSymmetrizePolygonOpRefPlane', a, true),
  });
  reg({
    name: 'SetRefPlaneFromSymmetrizePolygonOp', label: 'Set RefPlane From SymmetrizePolygonOp', category: 'Modeling|Topology', description: 'Copies the custom symmetry plane of a SymmetrizePolygon operator into a reference plane',
    args: [{ name: 'RefPlane', default: 'Transform' }, { name: 'InputObjs', default: null }],
    execute: (app, a) => symmetrizeRefPlane(app, 'SetRefPlaneFromSymmetrizePolygonOp', a, false),
  });
}
