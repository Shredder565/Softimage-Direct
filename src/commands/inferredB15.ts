// Batch 15 commands that no analyst note covers. INFERRED: each registration below is reasoned from the command table
// (data/commands_full.json: name, description, tooltip, category, argument list) and from how closely related commands
// of this build behave. No Softimage code or golden backs them. Branches that inference cannot settle log
// "<command>: not yet attested: <what> (inferred, CMD-B15f worker)" and change nothing.
//
//   tools / modes:  "Add Surface Point Tool" BoneCreateTool CrowdCreateDirectionalEmitterTool CrowdCreateWallTool
//                   CursorTransformTool "MoveComponent Tool" "Pick Session Tool" ToggleProjectionTool
//                   "Turn ON Interactive SRT" "Turn OFF Interactive SRT" "Transform Set New " "XYZ Transform " DoNothing
//   edits:          CopyPaste CopyPartition "Delete Selected Branch" DeleteCurrentLayer "Freeze Selected"
//                   "Dice Object/Polygons" "Mesh Filter" PaintWeights (SISwapArrayElements, SIAppendBone: shadertasksB16b.ts)
//   rendering/sim:  RegenerateMaps CreateEnvironmentCache
import { App, type CommandDef } from '../core/commands';
import { Node, X3DObject, Property, Partition, Pass, Model } from '../core/scene';
import { Parameter } from '../core/params';
import { Effector, ChainRoot } from '../core/scene2';
import * as THREE from 'three';
import { stateOf as pluginsB13eState } from './pluginsB13eShared';
import { simEnvironment } from './duplicateRenderingSimulationScriptsSimulation';
import { appendBoneStandIn } from './miscDsScripts';

const TAG = 'inferred, CMD-B15f worker';
export const logInferredNya = (app: App, command: string, what: string) => app.logMsg('info', `${command}: not yet attested: ${what} (${TAG})`);
const unset = (v: any) => v === undefined || v === null || v === '';
/** Run another command when the bus has a real registration of it. */
function delegate(app: App, by: string, name: string, args: Record<string, any>): { done: boolean; result?: any } {
  if (!app.commands.has(name)) { logInferredNya(app, by, `the command ${name} it stands for is not on the bus`); return { done: false }; }
  const r = app.run(name, args);
  if (r && typeof r === 'object' && (r as any).command === name && 'args' in r) { logInferredNya(app, by, `${name} is only a placeholder registration`); return { done: false }; }
  return { done: true, result: r };
}
function nodesOf(app: App, v: any): any[] {
  if (unset(v)) return [];
  if (Array.isArray(v)) return v.flatMap(x => nodesOf(app, x));
  if (v instanceof Node || v instanceof Parameter) return [v];
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean).map(s => findNode(app, s)).filter(Boolean);
  return [v];
}
function findNode(app: App, name: string): any {
  const o = app.scene.find(name); if (o) return o;
  for (const p of app.scene.passes) { if (p.name === name || `Passes.${p.name}` === name) return p; for (const q of p.partitions) if (`${p.name}.${q.name}` === name || `Passes.${p.name}.${q.name}` === name) return q; }
  for (const l of app.scene.layers) if (l.name === name || `Layers.${l.name}` === name) return l;
  for (const x of app.scene.allObjects()) for (const p of x.properties) if (p.fullName === name || `${x.name}.${p.name}` === name) return p;
  return undefined;
}
/** A tool command whose interactive tool this build does not have: records the request and logs it. */
const toolState = (app: App) => ((app as any).inferredB15 ??= { tools: [] as string[], interactiveSRT: true });

export function registerInferredB15Commands(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  const st = toolState(app);
  const missingTool = (name: string, what: string) => (app2: App) => { st.tools.push(name); logInferredNya(app2, name, what); return undefined; };

  // inferred: a viewport tool that adds points on NURBS surfaces (catalogue: disabled). No such tool in this build.
  reg({ name: 'Add Surface Point Tool', label: 'Add Surface Point Tool', category: 'Modeling', description: 'Add Surface Point Tool', undoable: false,
    args: [{ name: 'Clsid', default: '{DCCB8091-B82C-11D1-A900-00A024190119}' }, { name: 'CmdID', default: '{DCCB8090-B82C-11D1-A900-00A024190119}' }],
    execute: missingTool('Add Surface Point Tool', 'the surface point tool (no NURBS surface point insertion tool in this build)') });

  // inferred: starts the bone drawing tool of the BoneCreateTool plug-in (CMD-B13e keeps its live instance and undo
  // record); the drawing itself is this build's chain tool (Create2DSkeleton with no points installs it).
  reg({ name: 'BoneCreateTool', label: 'BoneCreateTool', category: '', undoable: false, args: [],
    execute(app2) {
      const p = pluginsB13eState(app2);
      p.boneTool = { currentBone: null, rootBone: null, rootPos: [0, 0, 0] };
      st.tools.push('BoneCreateTool');
      app2.setTool(null);
      delegate(app2, 'BoneCreateTool', 'Create2DSkeleton', {});
      return undefined;
    } });

  // inferred: the CrowdFX drawing tools behind InitCrowdAndDrawEmitter / InitCrowdAndDrawWall (which create the crowd and
  // then call CreateCrowdEmitter / CreateWall): the tool commands stand for those creation commands.
  reg({ name: 'CrowdCreateDirectionalEmitterTool', label: 'CrowdCreateDirectionalEmitterTool', category: '', args: [],
    execute: app2 => delegate(app2, 'CrowdCreateDirectionalEmitterTool', 'CreateCrowdEmitter', {}).result });
  reg({ name: 'CrowdCreateWallTool', label: 'CrowdCreateWallTool', category: '', args: [],
    execute: app2 => delegate(app2, 'CrowdCreateWallTool', 'CreateWall', {}).result });

  // inferred: "Activate the Cursor transform tool". No cursor transform tool in this build.
  reg({ name: 'CursorTransformTool', label: 'Cursor Transform Tool', category: 'Modeling|Deformation', description: 'Activate the Cursor transform tool', undoable: false,
    args: [{ name: 'Clsid', default: '{BAAA041A-D204-45DF-8D4F-E2C524678315}' }],
    execute: missingTool('CursorTransformTool', 'the cursor transform tool') });

  // inferred: "MoveComponent Tool Active" = the component tweak tool of this build.
  reg({ name: 'MoveComponent Tool', label: 'MoveComponent Tool', category: 'Modeling|Deformation', description: 'MoveComponent Tool Active', undoable: false,
    args: [{ name: 'Clsid', default: '{DA55A810-5F86-11D2-B11C-00A0C906811E}' }],
    execute: app2 => delegate(app2, 'MoveComponent Tool', 'TweakTool', {}).result });

  // inferred: the tool a pick session installs; on its own (no session) it does nothing.
  reg({ name: 'Pick Session Tool', label: 'Pick Session Tool', category: '', undoable: false,
    args: [{ name: 'Clsid', default: '{CF80CBC3-984E-11D1-96E7-00A024191BAC}' }],
    execute(app2) {
      const s = (app2 as any).miscDsScripts?.session;
      if (!s?.active) logInferredNya(app2, 'Pick Session Tool', 'the pick tool outside a pick session');
      return undefined;
    } });

  // inferred: "Modify Projection" = the texture projection manipulation tool. This build's EditUVProjectionTool is a
  // Softimage-absent entry, so there is no tool to stand for it.
  reg({ name: 'ToggleProjectionTool', label: 'Modify Projection', category: 'Rendering', undoable: false,
    args: [{ name: 'Clsid', default: '{0BF11154-359A-11D4-B4C4-00D0B7142C4C}' }],
    execute: missingTool('ToggleProjectionTool', 'the texture projection manipulation tool') });

  // inferred: switch the interactive SRT (live transform update while dragging) flag.
  for (const [name, on] of [['Turn ON Interactive SRT', true], ['Turn OFF Interactive SRT', false]] as const)
    reg({ name, label: name, category: '', description: name, undoable: false, args: [],
      execute(app2) { toolState(app2).interactiveSRT = on; app2.events.emit('selection'); return undefined; } });

  // inferred: no description; nothing attested.
  reg({ name: 'Transform Set New ', label: 'Transform Set New ', category: '', undoable: false, args: [],
    execute: missingTool('Transform Set New ', 'what "Transform Set New" creates') });
  // inferred: catalogue description is "Todo: XYZ transform" — an unfinished entry; it does nothing.
  reg({ name: 'XYZ Transform ', label: 'XYZ Transform ', category: '', description: 'Todo: XYZ transform', undoable: false,
    args: [{ name: 'Property', default: 'SI3D_COMMAND_EXECUTED' }], execute: () => undefined });
  // inferred: by its name.
  reg({ name: 'DoNothing', label: 'DoNothing', category: '', description: 'DoNothing', undoable: false,
    args: [{ name: 'Clsid', default: '{2B2FFB2E-5987-11D2-8411-00A0C961747D}' }], execute: () => undefined });

  // inferred: "This task copy and paste something ... does not affect the current copied items": Source is duplicated
  // (the clipboard is left alone) and the copies go under Target when one is given. Mode 0 only.
  reg({ name: 'CopyPaste', label: 'CopyPaste', category: 'Edit', description: 'This task copy and paste something.  This copy / paste in one command does not affect the current copied items.',
    args: [{ name: 'Source', default: null }, { name: 'FileName', default: '' }, { name: 'Target', default: null }, { name: 'Mode', default: 0 }],
    execute(app2, a) {
      const C = 'CopyPaste';
      if (!unset(a.FileName)) { logInferredNya(app2, C, 'copy / paste through a file'); return undefined; }
      if (Number(a.Mode) || 0) logInferredNya(app2, C, `Mode ${a.Mode}; mode 0 is used`);
      const src = nodesOf(app2, a.Source).filter((x): x is X3DObject => x instanceof X3DObject);
      if (!src.length) throw new Error(`${C}: no source object`);
      const clip = (app2 as any).clipboard;
      const made: X3DObject[] = app2.run('Duplicate', { InputObjs: src }) ?? [];
      (app2 as any).clipboard = clip;
      const target = nodesOf(app2, a.Target).find(x => x instanceof X3DObject) as X3DObject | undefined;
      if (target) for (const c of made) { const old = c.parentObj!; app2.record('Parent', () => target.addChild(c), () => old.addChild(c)); }
      return made;
    } });

  // inferred: "Copy partitions to the passes": each input partition (default: the current pass's partitions) is copied,
  // with its members, into each target pass (default: every other pass). A same-named partition receives the members.
  reg({ name: 'CopyPartition', label: 'Copy Partition', category: 'Rendering', description: 'Copy partitions to the passes',
    args: [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }],
    execute(app2, a) {
      const sc = app2.scene; const cur: Pass | undefined = (sc as any).currentPass ?? sc.passes[0];
      let parts = nodesOf(app2, a.InputObjs).filter((x): x is Partition => x instanceof Partition);
      if (!parts.length) parts = [...(cur?.partitions ?? [])];
      let passes = nodesOf(app2, a.Target).filter((x): x is Pass => x instanceof Pass);
      if (!passes.length) passes = sc.passes.filter(p => !p.partitions.some(q => parts.includes(q)));
      let n = 0;
      for (const pass of passes) for (const part of parts) {
        if (pass.partitions.includes(part)) continue;
        const same = pass.partitions.find(q => q.name === part.name);
        if (same) { const add = [...part.members].filter(m => !same.members.has(m)); app2.record('CopyPartition', () => add.forEach(m => same.members.add(m)), () => add.forEach(m => same.members.delete(m))); n++; continue; }
        const copy = new Partition(part.name);
        for (const p of part.params) { const q = copy.get(p.def.name); if (q && !p.def.readOnly) q.value = p.value; }
        part.members.forEach(m => copy.members.add(m));
        app2.record('CopyPartition', () => { pass.partitions.push(copy); copy.parent = pass; }, () => { const i = pass.partitions.indexOf(copy); if (i >= 0) pass.partitions.splice(i, 1); });
        n++;
      }
      app2.events.emit('scene');
      return n;
    } });

  // inferred: delete each selected object together with its branch (DeleteObj removes the whole sub-tree here).
  reg({ name: 'Delete Selected Branch', label: 'Delete Selected Branch', category: '', description: 'Delete Selected Branch', args: [],
    execute(app2) { const sel = app2.selectedObjects; if (!sel.length) return undefined; return delegate(app2, 'Delete Selected Branch', 'DeleteObj', { InputObj: sel }).result; } });

  // inferred: "Delete Current Layer": DeleteLayer of the layer InputObj names ("Layers.Current" = the current layer).
  reg({ name: 'DeleteCurrentLayer', label: 'Delete Current Layer', category: '', args: [{ name: 'InputObj', default: 'Layers.Current' }],
    execute(app2, a) {
      const want = String(a.InputObj ?? 'Layers.Current');
      const layer = want === 'Layers.Current' || want === '' ? ((app2 as any).currentLayer ?? app2.scene.layers[0]) : (nodesOf(app2, want)[0] ?? null);
      if (!layer) throw new Error(`DeleteCurrentLayer: no layer ${want}`);
      return app2.run('DeleteLayer', { Name: layer.name });
    } });

  // inferred: freeze the operator stack of the selected objects (FreezeObj on the selection).
  reg({ name: 'Freeze Selected', label: 'Freeze Selected', category: '', args: [],
    execute(app2) { const sel = app2.selectedObjects; if (!sel.length) return undefined; return app2.run('FreezeObj', { InputObjs: sel }); } });

  // inferred: the "Dice Object or Polygons" entry carries two filter blocks (polygon, then object): it applies the Dice
  // Polygons topology operator to the selected polygons, or to the whole selected mesh.
  reg({ name: 'Dice Object/Polygons', label: 'Dice Object/Polygons', category: 'Modeling|Topology', description: 'Dice Object or Polygons',
    args: [{ name: 'InputObjs', default: null }, { name: 'SelFilter', default: 'polygon' }, { name: 'OnFilterCmdMapClient', default: '{50830560-31B5-11D0-82E7-00A0243E268D}' },
      { name: 'OnFilterCmdID', default: '{86B4DB7E-3569-4FD0-B8D3-05C11AA054D5}' }, { name: 'InputObjsArgName', default: 'ConnectionSet' }, { name: 'SelFilter', default: 'object' },
      { name: 'OnFilterCmdMapClient', default: '{50830560-31B5-11D0-82E7-00A0243E268D}' }, { name: 'OnFilterCmdID', default: '{6AF65230-4EDA-42EB-9AC5-192F4F3916BA}' }, { name: 'InputObjsArgName', default: 'ConnectionSet' }],
    execute(app2, a) { const o = nodesOf(app2, a.InputObjs).filter(x => x instanceof X3DObject); if (o.length && !app2.compSel) app2.select(o); return app2.run('ApplyTopoOp', { PresetObj: 'Dice Polygons' }); } });

  // inferred: "Filter Mesh Components" with three filter blocks (polygon, edge, polygon mesh): Filter Edges on an edge
  // selection, otherwise Filter Polygons (selected polygons or the whole mesh).
  const mf = (filter: string, id: string) => [{ name: 'SelFilter', default: filter }, { name: 'OnFilterCmdMapClient', default: '{50830560-31B5-11D0-82E7-00A0243E268D}' }, { name: 'OnFilterCmdID', default: id }, { name: 'InputObjsArgName', default: 'ConnectionSet' }];
  reg({ name: 'Mesh Filter', label: 'Mesh Filter', category: 'Modeling|Topology', description: 'Filter Mesh Components',
    args: [{ name: 'InputObjs', default: null }, ...mf('polygon', '{1067D621-96FC-4DED-983F-E83C4D121372}'), ...mf('edge', '{053894C2-8E7C-4F76-B1BB-283C34E3C420}'), ...mf('polygon_mesh', '{1067D621-96FC-4DED-983F-E83C4D121372}')],
    execute(app2, a) {
      const o = nodesOf(app2, a.InputObjs).filter(x => x instanceof X3DObject); if (o.length && !app2.compSel) app2.select(o);
      return app2.run('ApplyTopoOp', { PresetObj: app2.compSel?.kind === 'edge' ? 'Filter Edges' : 'Filter Polygons' });
    } });

  // inferred: "Paint Weights": writes Weights at Indices into a weight map (InputObj = the map, or an object whose first
  // weight map is used) or into an envelope (Deformer = deformer index; Normalize renormalises each point). Flags 0 =
  // replace; other flags are not attested. OutputObj returns the painted property.
  reg({ name: 'PaintWeights', label: 'Paint Weights', category: 'Property|Paint', description: 'Paint Weights',
    args: [{ name: 'InputObj', default: null }, { name: 'Indices', default: null }, { name: 'Weights', default: null }, { name: 'Flags', default: 0 }, { name: 'Deformer', default: 0 },
      { name: 'Normalize', default: true }, { name: 'OutputObj', default: null }],
    execute(app2, a) {
      const C = 'PaintWeights';
      let target: any = nodesOf(app2, a.InputObj)[0] ?? app2.selection.find(n => n instanceof Property && n.type === 'weightmap');
      if (target instanceof X3DObject) target = target.allProperties().find(p => p.type === 'weightmap') ?? (target as any).envelope ?? target.properties.find((p: any) => Array.isArray(p.weights));
      if (!target) throw new Error(`${C}: no weight map or envelope to paint`);
      const idx: number[] = Array.from((a.Indices ?? []) as ArrayLike<number>).map(Number);
      const w: number[] = Array.from((a.Weights ?? []) as ArrayLike<number>).map(Number);
      if (Number(a.Flags) || 0) logInferredNya(app2, C, `Flags ${a.Flags}; the weights replace the old values`);
      if (target.values instanceof Map) {
        const map: Map<number, number> = target.values; const before = idx.map(i => map.get(i));
        app2.record(C, () => idx.forEach((i, k) => map.set(i, w[k] ?? w[w.length - 1] ?? 0)), () => idx.forEach((i, k) => { const b = before[k]; if (b === undefined) map.delete(i); else map.set(i, b); }));
      } else if (Array.isArray(target.weights)) {
        const d = Number(a.Deformer) || 0; const norm = a.Normalize !== false;
        const before = idx.map(i => target.weights[i] ? Float32Array.from(target.weights[i]) : null);
        app2.record(C, () => idx.forEach((i, k) => {
          const row: Float32Array = target.weights[i] ?? new Float32Array(Math.max(d + 1, target.deformers?.length ?? 1));
          row[d] = w[k] ?? w[w.length - 1] ?? 0;
          if (norm) { let rest = 0; for (let j = 0; j < row.length; j++) if (j !== d) rest += row[j]; const left = Math.max(0, 1 - row[d]); if (rest > 0) for (let j = 0; j < row.length; j++) if (j !== d) row[j] = row[j] / rest * left; }
          target.weights[i] = row;
        }), () => idx.forEach((i, k) => { if (before[k]) target.weights[i] = before[k]; }));
      } else throw new Error(`${C}: ${target.name ?? target} is not a weight map or an envelope`);
      app2.events.emit('scene');
      return target;
    } });

  // SISwapArrayElements and SIAppendBone: wired from their contracts in shadertasksB16b.ts (row CMD-B16b).

  // inferred: "Regenerates the selected Render Maps": needs the renderer, which this build does not have.
  reg({ name: 'RegenerateMaps', label: 'RegenerateMaps', category: 'Rendering', description: 'Regenerates the selected Render Maps.', undoable: false,
    args: [{ name: 'Properties', default: null }, { name: 'TileSize', default: 32 }],
    execute(app2, a) {
      const C = 'RegenerateMaps';
      let props = nodesOf(app2, a.Properties).filter(p => p instanceof Property && p.type === 'rendermap');
      if (unset(a.Properties)) props = app2.selection.filter(p => p instanceof Property && p.type === 'rendermap');
      if (!props.length) { app2.logMsg('error', `${C}: no Render Map property selected`); return undefined; }
      for (const p of props) logInferredNya(app2, C, `rendering ${p.name} (tile size ${Number(a.TileSize) || 32}); no renderer in this build`);
      return undefined;
    } });

  // inferred: the C++ worker other simulation scripts call: a cache record for Model in the environment's cache list
  // (the record shape of duplicateRenderingSimulationScriptsSimulation.ts), returned to the caller.
  reg({ name: 'CreateEnvironmentCache', label: 'CreateEnvironmentCache', category: 'Simulation',
    args: [{ name: 'Model', default: null }, { name: 'Environment', default: null }],
    execute(app2, a) {
      const C = 'CreateEnvironmentCache';
      const model = (nodesOf(app2, a.Model)[0] ?? null) as Model | null;
      if (!(model instanceof X3DObject)) throw new Error(`${C}: Model is required`);
      const env = (nodesOf(app2, a.Environment)[0] ?? (app2.scene as any).activeSimulationEnvironment ?? null) as Node | null;
      if (!(env instanceof Node)) throw new Error(`${C}: no simulation environment`);
      const data = simEnvironment(env);
      const cache = new Property(`${model.name}_Cache`, 'EnvironmentCache', []);   // inferred name
      (cache as any).model = model; (cache as any).environment = env; cache.parent = env;
      app2.record(C, () => data.caches.push(cache), () => { const i = data.caches.indexOf(cache); if (i >= 0) data.caches.splice(i, 1); });
      return cache;
    } });
}
