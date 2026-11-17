// Ledger row CMD-B7c, Lagoa and ICE flow builder add-ons. Brief: docs/ghidra/cmd-b7c-addon-scripts.md,
// "Wire contract: Lagoa" and "Wire contract: ICEFlowBuilder". Original code written from that contract only.
//
//   LagoaEmitMPVolume, LagoaTagCollisionObject, LagoaDisplayType, LagoaSetupAdvectMesh, LagoaSetupClothMesh,
//   ICEFlowInsertSimulationRoot
//
// What this build can and cannot do:
//  * The Lagoa compounds and the two Lagoa presets are not in this build. The commands make every call of
//    the contract in order (journal: `app.addonScripts.calls`); a compound is added through the bus command,
//    which leaves a marker node, and the connections are kept as records on the tree.
//  * The build's ICE tree has no root ports (`Port1`...) and no `AddPortToICENode`: those calls are journal
//    entries and one "not yet attested" log line per command.
//  * `ICEFlow_CreateParticlesFromPreset` has no contract yet and the build only has a shell of it with another
//    argument list: the call is a journal entry + "not yet attested", the shell is not run.
//  * ICEFlowInsertSimulationRoot needs root ports and port objects, so its full procedure runs on an
//    `IceFlowTree` (a plain port / node graph defined here); on the build's own ICE tree it stops with
//    "not yet attested".
import { App } from '../core/commands';
import { Node, X3DObject, Group, Property } from '../core/scene';
import { ICETreeOperator } from '../core/ice';
import {
  addonScriptsState as state, listOf, fullNameOf, delegate, trace, inspect, logWarning, logNya, NOTE,
} from './addonScriptsShared';

const typeOfObj = (o: any): string => String(o?.type ?? o?.Type ?? '');
/** The `Collection` argument handler: an omitted value is the current selection. // inferred from the handler */
function collection(app: App, v: any): any[] {
  if (v === null || v === undefined || v === '') return [...app.selection];
  if (typeof v === 'string') return v.split(',').map(n => app.scene.find(n.trim())).filter(Boolean);
  return listOf(v);
}
/** Path component of a node: its name with spaces written as underscores. // inferred */
const pathName = (name: string) => name.replace(/ /g, '_');

/** A connection the build's tree cannot hold (an end is a root port or a compound that is only a marker). */
export interface LagoaLink { dest: string; source: string }
const linksOf = (tree: any): LagoaLink[] => (tree.lagoaLinks ??= []);

/** Run a build command for one step of a script; a failure of the build's command is reported, not raised. */
function step(app: App, by: string, name: string, named: Record<string, any>, shown: unknown[]): any {
  try { return delegate(app, by, name, named, shown).result; }
  catch (e: any) { logNya(app, by, `${name} failed in this build (${e?.message ?? e})`, 'Dependencies'); return undefined; }
}
function createSimulatedTree(app: App, by: string, target: any): ICETreeOperator | undefined {
  const r = step(app, by, 'CreateSimulatedICETree', { ConnectionSet: fullNameOf(target) }, [fullNameOf(target), 'siNode']);
  return r instanceof ICETreeOperator ? r : undefined;
}
function addCompound(app: App, by: string, tree: ICETreeOperator | undefined, name: string): string {
  const treePath = tree ? fullNameOf(tree) : '<tree>';
  if (tree) { const n = step(app, by, 'AddICECompoundNode', { File: name, Container: tree }, [name, treePath]); if (n && n !== tree) (n as any).lagoaCompound = name; }
  else trace('AddICECompoundNode', [name, treePath], 'missing');
  return `${treePath}.${pathName(name)}`;
}

/**
 * ICEFlow_CreateParticlesFromPreset <8 arguments>. The command has no contract yet (Dependencies); the build
 * registers it as a shell with its own argument list, and the two Lagoa presets are not in the build, so the
 * call is recorded and reported, not run: running the shell without a known preset would build an unrelated
 * default point cloud.
 */
function createFromPreset(app: App, by: string, named: Record<string, any>, shown: unknown[]) {
  trace('ICEFlow_CreateParticlesFromPreset', shown, 'missing');
  logNya(app, by, `ICEFlow_CreateParticlesFromPreset and the preset "${named.presetName}" (the call with ${shown.length} arguments was recorded, not run)`, 'Dependencies');
}

// ------------------------------------------------------------------ ICE flow graph (ICEFlowInsertSimulationRoot)

export interface IceFlowPort { name: string; source: { node: IceFlowNode; port: string } | null }
export class IceFlowNode {
  inputs: IceFlowPort[] = [];
  constructor(public name: string, public type: string, inputs: string[] = [], public outputs: string[] = []) { this.inputs = inputs.map(n => ({ name: n, source: null })); }
}
/** A plain ICE tree model with root ports: enough for the port rewiring the ICE flow commands do. */
export class IceFlowTree {
  /** Root input ports, in port order. */
  ports: IceFlowPort[] = [];
  nodes: IceFlowNode[] = [];
  constructor(public fullName: string, portCount = 0) { for (let i = 1; i <= portCount; i++) this.ports.push({ name: `Port${i}`, source: null }); }
  addNode(n: IceFlowNode): IceFlowNode { this.nodes.push(n); return n; }
  /** AddICECompoundNode: only the compound this row describes is known. */
  addCompound(name: string): IceFlowNode {
    if (name !== 'Simulation Root') throw new Error(`unknown compound ${name}`);
    // inferred (Q5): the port names come from the script only; one input of each name is assumed.
    return this.addNode(new IceFlowNode(pathName(name), 'Simulation_Root', ['Emitter', 'Forces', 'Simulate', 'Execute', 'PostSimExecute'], ['Execute']));
  }
  pathOf(n: IceFlowNode): string { return `${this.fullName}.${n.name}`; }
  private rel(path: string): string[] | null { return path.startsWith(this.fullName + '.') ? path.slice(this.fullName.length + 1).split('.') : null; }
  /** The input port a path names: `<tree>.<port>` or `<tree>.<node>.<port>`. */
  inputAt(path: string): IceFlowPort | undefined {
    const r = this.rel(path); if (!r) return undefined;
    if (r.length === 1) return this.ports.find(p => p.name === r[0]);
    return this.nodes.find(n => n.name === r[0])?.inputs.find(p => p.name === r[1]);
  }
  /** ConnectICENodes <dest>, <source>; false when either end does not resolve. */
  connect(dest: string, source: string): boolean {
    const d = this.inputAt(dest); const r = this.rel(source);
    const node = r && r.length === 2 ? this.nodes.find(n => n.name === r[0]) : undefined;
    if (!d || !node || !node.outputs.includes(r![1])) return false;
    d.source = { node, port: r![1] };
    return true;
  }
  /** DisconnectICENodePort <port>. */
  disconnect(dest: string): void { const d = this.inputAt(dest); if (d) d.source = null; }
  /** AddPortToICENode <port>, after: a new input of the same base name right after the given one. */
  addPortAfter(node: IceFlowNode, port: IceFlowPort): IceFlowPort {
    const base = port.name.replace(/\d+/g, '');
    let i = 1; while (node.inputs.some(p => p.name === `${base}${i}`)) i++;   // inferred: the new port's name
    const fresh: IceFlowPort = { name: `${base}${i}`, source: null };
    node.inputs.splice(node.inputs.indexOf(port) + 1, 0, fresh);
    return fresh;
  }
}
/** Helper method GetUnconnectedInputPorts(node, name). */
export function unconnectedInput(tree: IceFlowTree, node: IceFlowNode, name: string): IceFlowPort {
  const same = node.inputs.filter(p => p.name.replace(/\d+/g, '').toLowerCase() === name.toLowerCase());
  const free = same.find(p => !p.source);
  if (free) return free;
  const last = same[same.length - 1];
  trace('AddPortToICENode', [`${tree.pathOf(node)}.${last.name}`, 'siNodePortDataInsertionLocationAfter'], 'stand-in');
  return tree.addPortAfter(node, last);
}
const GLOBAL = 'SimulateParticlesPortIndex';
const sameName = (a: string, b: string) => pathName(a) === pathName(b);

function insertSimulationRoot(app: App, tree: IceFlowTree): true | undefined {
  const getGlobal = () => app.run('GetGlobal', { in_VariableName: GLOBAL });
  const setGlobal = (v: any) => app.run('SetGlobal', { in_VariableName: GLOBAL, in_Value: v });
  const g = getGlobal();
  if (g === null || g === undefined || g === '') setGlobal(99);
  const ports = [...tree.ports];   // the port list is read before a compound is added
  const found = tree.nodes.filter(n => sameName(n.name, 'Simulation Root'));
  let root: IceFlowNode;
  const first = ports[0];
  if (!found.length) {
    trace('AddICECompoundNode', ['Simulation Root', tree.fullName], 'stand-in');
    root = tree.addCompound('Simulation Root');
    if (!(first?.source && first.source.port === 'Emit')) {
      logWarning(app, 'Unable to connect Simulation Root as no Emit output plugged in to the ICETree node');
      return undefined;
    }
  } else {
    if (first?.source?.node.type !== 'Simulation_Root') return undefined;
    root = found[0];
  }
  const rootPath = tree.pathOf(root);
  const connect = (dest: string, source: string): boolean => { trace('ConnectICENodes', [dest, source], 'stand-in'); return tree.connect(dest, source); };
  const disconnect = (dest: string) => { trace('DisconnectICENodePort', [dest], 'stand-in'); tree.disconnect(dest); };
  for (const port of ports) {
    const src = port.source;
    if (!src) continue;
    const node = src.node; const portPath = `${tree.fullName}.${port.name}`;
    if (node.type === 'Simulation_Root') continue;
    if (src.port === 'Emit') {
      if (connect(`${rootPath}.Emitter`, `${tree.fullName}.${node.type}.Emit`)) connect(portPath, `${rootPath}.Execute`);
    } else if (src.port === 'simulate') {
      setGlobal(Number(port.name.slice(4)));
      disconnect(portPath);
      connect(`${rootPath}.Simulate`, `${tree.pathOf(node)}.simulate`);
    } else if (node.type === 'Add_Forces') {
      disconnect(portPath);
      connect(`${rootPath}.Forces`, `${tree.pathOf(node)}.Execute`);
    } else if (node.type === 'State_Machine') {
      /* left as it is */
    } else {
      const remembered = src.port;
      disconnect(portPath);
      const free = unconnectedInput(tree, root, Number(port.name.slice(4)) > Number(getGlobal()) ? 'PostSimExecute' : 'Execute');
      connect(`${rootPath}.${free.name}`, `${tree.pathOf(node)}.${remembered}`);
    }
  }
  setGlobal(99);
  return true;
}

// ------------------------------------------------------------------ ICE flow helper: GetGeometries

const GEOM = new Set(['polymsh', 'surfmsh']);
function selectedGeometries(app: App): any[] {
  return app.selection.filter((n: any) => n instanceof Group ? n.members.length > 0 && n.members.every(m => GEOM.has(m.type)) : GEOM.has(typeOfObj(n)));
}

// ------------------------------------------------------------------ registration

export function registerIceAddonCommands(app: App) {
  const CAT = 'Custom';
  (state as any).iceFlowTrees ??= new Map<string, IceFlowTree>();

  app.register({
    name: 'LagoaEmitMPVolume', label: 'LagoaEmitMPVolume', category: CAT, description: '',
    args: [{ name: 'SelectionList', default: null }], noLog: true,
    execute(app2, a) {
      const BY = 'LagoaEmitMPVolume';
      const meshes = collection(app2, a.SelectionList).filter(o => typeOfObj(o) === 'polymsh');
      if (!meshes.length) { logWarning(app2, 'No polymesh objects in selection'); return true; }
      const n = meshes.length;
      // 1. GetPrim "PointCloud", "Lagoa_MP_Cloud" (the build's GetPrim has no point cloud preset: an empty point cloud is made)
      trace('GetPrim', ['PointCloud', 'Lagoa_MP_Cloud'], 'stand-in');
      const cloud: X3DObject = app2.run('CreatePrim', { PresetObj: 'Empty', GeometryType: 'PointCloud', Name: 'Lagoa_MP_Cloud' });
      // 2. Display Property with the wire colour
      trace('AddProp', ['Display Property', fullNameOf(cloud)], 'stand-in');
      let disp: Property | undefined = cloud.properties.find(p => p.type === 'display' || /display/i.test(p.name));
      const wire: [string, number][] = [['wirecolorr', 0.2], ['wirecolorg', 0.3], ['wirecolorb', 1]];
      for (const [k, v] of wire) {
        trace('SetValue', [`${fullNameOf(cloud)}.display.${k}`, v], 'stand-in');
        const p = disp?.get(k);
        if (p) app2.setParam(p, v); else { ((cloud as any).lagoaWireColor ??= {})[k] = v; }
      }
      if (!disp?.get('wirecolorr')) logNya(app2, BY, 'the display property of this build has no wirecolorr / wirecolorg / wirecolorb parameters; the colour 0.2, 0.3, 1 is kept on the object');
      // 3. simulated tree, 4. the five compounds
      const tree = createSimulatedTree(app2, BY, cloud);
      const treePath = tree ? fullNameOf(tree) : '<tree>';
      const [emit, simulate, material, forces, phase] = ['Lagoa Emit Volume', 'Lagoa Simulate Multiphysics', 'Lagoa Main Material', 'Lagoa Add Forces', 'Lagoa Phase'].map(c => addCompound(app2, BY, tree, c));
      // 5. ports
      const AFTER = 'siNodePortDataInsertionLocationAfter';
      const treePorts = n === 1 ? 4 : n + 2;
      for (let i = 1; i <= treePorts; i++) trace('AddPortToICENode', [`${treePath}.port${i}`, AFTER], 'missing');
      if (n > 1) for (let i = 1; i <= n - 1; i++) trace('AddPortToICENode', [`${emit}.Emitter In Name${i}`, AFTER], 'missing');
      // 6. one get-data node per mesh, all connected to the same destination path (Q3)
      const links = tree ? linksOf(tree) : [];
      const link = (dest: string, source: string) => { trace('ConnectICENodes', [dest, source], 'stand-in'); links.push({ dest, source }); };
      meshes.forEach((m, i) => {
        app2.logMsg('info', fullNameOf(m));
        let getData = `${treePath}.Get_Data${i ? i : ''}`;   // inferred: path of the i-th get-data node
        if (tree) {
          const node = step(app2, BY, 'AddICENode', { PresetObj: 'Get Data', Container: tree }, ['GetDataNode', treePath]);   // the build's name of the get-data node
          const ref = node?.params?.get?.('reference');
          trace('SetValue', [`${getData}.reference`, fullNameOf(m)], 'stand-in');
          if (ref) ref.value = fullNameOf(m); else if (node && typeof node === 'object') (node as any).lagoaReference = fullNameOf(m);
          if (node?.id !== undefined) getData = `${treePath}.${pathName(String(node.type))}[${node.id}]`;
        } else { trace('AddICENode', ['GetDataNode', treePath], 'missing'); trace('SetValue', [`${getData}.reference`, fullNameOf(m)], 'stand-in'); }
        link(`${emit}.Emitter_In_Name`, `${getData}.outname`);
      });
      // 7. the fixed connections; Port4 stays free
      link(`${treePath}.Port1`, `${emit}.Execute`);
      link(`${treePath}.Port2`, `${forces}.Execute`);
      link(`${treePath}.Port3`, `${phase}.Execute`);
      link(`${phase}.Execute1`, `${material}.Execute`);
      link(`${treePath}.Port5`, `${simulate}.Execute`);
      logNya(app2, BY, 'the Lagoa compounds and the root ports of an ICE tree are not in this build: the compounds are marker nodes, AddPortToICENode was not run, the connections are kept as records on the tree', 'Q3');
      return true;
    },
  });

  app.register({
    name: 'LagoaTagCollisionObject', label: 'LagoaTagCollisionObject', category: CAT, description: '',
    args: [{ name: 'SelectionList', default: null }, { name: 'arg1', default: 1 }], noLog: true,
    execute(app2, a) {
      const BY = 'LagoaTagCollisionObject';
      const compounds: any[] = []; let stoodIn = false;
      for (const o of collection(app2, a.SelectionList).filter(x => typeOfObj(x) === 'polymsh')) {
        // ApplyOp "ICETree", <object>, siNode, , , 0
        trace('ApplyOp', ['ICETree', fullNameOf(o), 'siNode', '', '', 0], 'stand-in');
        let tree: any;
        try { tree = app2.run('ApplyICEOp', { File: '', Target: fullNameOf(o) }); } catch (e: any) { logNya(app2, BY, `an ICE tree on ${fullNameOf(o)} (${e?.message ?? e})`); }
        const t = tree instanceof ICETreeOperator ? tree : undefined;
        const compound = addCompound(app2, BY, t, 'Lagoa Set Collision Data');
        trace('ConnectICENodes', [`${t ? fullNameOf(t) : '<tree>'}.Port1`, `${compound}.Execute`], 'stand-in');
        if (t) linksOf(t).push({ dest: `${fullNameOf(t)}.Port1`, source: `${compound}.Execute` });
        app2.logMsg('info', `Object -->${fullNameOf(o)} tagged with Set Collision Data node, inspect ICEtree`);
        compounds.push(compound); stoodIn = true;
      }
      inspect(app2, compounds);   // always, even when nothing was tagged
      logWarning(app2, 'Objects tagged! Make sure these objects are added to the collision ports on the Lagoa Framework');
      if (stoodIn) logNya(app2, BY, 'the compound Lagoa Set Collision Data and the root ports of an ICE tree are not in this build: the compound is a marker node, the connection is kept as a record on the tree');
    },
  });

  app.register({
    name: 'LagoaDisplayType', label: 'Lagoa Display Type', category: CAT, description: '',
    args: [{ name: 'SelectionList', default: null }, { name: 'arg1', default: 1 }, { name: 'arg2', default: 1 }], noLog: true,
    execute(app2, a) {
      for (const o of collection(app2, a.SelectionList).filter(x => typeOfObj(x) === 'pointcloud')) {
        const props: any[] = o instanceof X3DObject ? o.properties : listOf(o.Properties);
        const prop = props.find(p => (p.name ?? p.Name) === 'Particle Display');
        // no guard: a cloud without that property is a script error. The engine's wording is not attested.
        if (!prop) throw new Error(`script error: ${fullNameOf(o)} has no property named "Particle Display" (${NOTE})`);
        const put = (name: string, v: any) => {
          if (prop instanceof Node) { const p = prop.get(name); if (p) app2.setParam(p, v); else logNya(app2, 'LagoaDisplayType', `the property has no "${name}" parameter in this build; the value ${v} was not written`, 'Q8'); }
          else prop[name] = v;
        };
        put('displaytype', a.arg2);
        put('pointsize', a.arg1);
      }
    },
  });

  app.register({
    name: 'LagoaSetupAdvectMesh', label: 'LagoaSetupAdvectMesh', category: CAT, description: '',
    args: [{ name: 'inspectPPG', default: true }],
    execute(app2, a) {
      const BY = 'LagoaSetupAdvectMesh';
      const geoms = selectedGeometries(app2);
      if (!geoms.length) { app2.logMsg('error', 'You need to Select a Polygon Mesh Object !'); return true; }
      // a simulated tree on the first geometry, deleted again at once
      const first = geoms[0];
      const before = first instanceof X3DObject ? [...(first.primitive?.operators ?? [])] : [];
      const tree = createSimulatedTree(app2, BY, first);
      trace('DeleteObj', [tree ? fullNameOf(tree) : '<tree>'], 'stand-in');
      const prim: any = tree?.parent;
      if (tree && prim?.removeOperator && !before.includes(tree)) app2.record('Delete ICE tree', () => prim.removeOperator(tree), () => prim.addOperator(tree));
      createFromPreset(app2, BY, { presetName: 'Lagoa Setup Advect Mesh', outPortName: 'Execute', emitterInputName: 'Emitter In Name', colliderInputName: 'Passive Body In Name', ExplodeCompound: false,
        ShaderPresetName: null, EmitInputIsGeomType: false, inspectPPG: a.inspectPPG }, ['Lagoa Setup Advect Mesh', 'Execute', 'Emitter In Name', 'Passive Body In Name', false, null, false, a.inspectPPG]);
      return true;
    },
  });

  app.register({
    name: 'LagoaSetupClothMesh', label: 'LagoaSetupClothMesh', category: CAT, description: '',
    args: [],
    execute(app2) {
      const BY = 'LagoaSetupClothMesh';
      const first: any = app2.selection[0];
      if (first === undefined || !(first instanceof X3DObject) || !first.primitive) return true;   // silent
      delegate(app2, BY, 'ResetTransform', { InputObj: '' }, ['', 'siCtr', 'siSRT', 'siXYZ']);
      createFromPreset(app2, BY, { presetName: 'Lagoa Setup Cloth Mesh', outPortName: 'Execute', emitterInputName: ' ', colliderInputName: 'Passive Body In Name', ExplodeCompound: false },
        ['Lagoa Setup Cloth Mesh', 'Execute', ' ', 'Passive Body In Name', false]);
      return true;
    },
  });

  app.register({
    name: 'ICEFlowInsertSimulationRoot', label: 'ICEFlowInsertSimulationRoot', category: CAT, description: '',
    args: [{ name: 'in_ICETree', default: null }],
    execute(app2, a) {
      try {
        const arg = a.in_ICETree;
        const tree = arg instanceof IceFlowTree ? arg : typeof arg === 'string' ? (state as any).iceFlowTrees.get(arg) : undefined;
        if (tree instanceof IceFlowTree) return insertSimulationRoot(app2, tree);
        logNya(app2, 'ICEFlowInsertSimulationRoot', `the root ports of ${arg == null ? 'an ICE tree' : fullNameOf(arg)} (the build's ICE tree has no root ports and no Simulation Root compound; the procedure runs on an IceFlowTree)`, 'Q5');
        return undefined;
      } catch { return undefined; /* errors are suppressed for the whole procedure */ }
    },
  });
}
