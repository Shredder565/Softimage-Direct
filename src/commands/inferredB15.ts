// Batch 15 commands that no analyst note covers. INFERRED: each registration below is reasoned from the command table
// (data/commands_full.json: name, description, tooltip, category, argument list) and from how closely related commands
// of this build behave. No Softimage code or golden backs them. Branches that inference cannot settle log
// "<command>: not yet attested: <what> (inferred, CMD-B15f worker)" and change nothing.
//
//   tools / modes:  BoneCreateTool CrowdCreateDirectionalEmitterTool CrowdCreateWallTool
//                   "Turn ON Interactive SRT" "Turn OFF Interactive SRT" "Transform Set New " (inert, CMD-B16a §7)
//   (the toolmanager.dll tool commands that were here are wired by CMD-B16a in toolsB16a.ts)
//   edits:          "Delete Selected Branch" "Freeze Selected" (PaintWeights: CMD-B16e)
//                   (CopyPaste, DeleteCurrentLayer: CMD-B16c, tasksB16c.ts; SISwapArrayElements, SIAppendBone: shadertasksB16b.ts)
//   rendering/sim:  CreateEnvironmentCache
// CMD-B16d moved CopyPartition, RegenerateMaps, "Dice Object/Polygons" and "Mesh Filter" to filterMapB16d.ts (contract).
import { App, type CommandDef } from '../core/commands';
import { Node, X3DObject, Property, Pass, Model } from '../core/scene';
import { Parameter } from '../core/params';
import { Effector, ChainRoot } from '../core/scene2';
import * as THREE from 'three';
import { stateOf as pluginsB13eState } from './pluginsB13eShared';
import { simEnvironment } from './duplicateRenderingSimulationScriptsSimulation';
import { appendBoneStandIn } from './miscDsScripts';
import { copyPaste, deleteObjList, LAYERS_CURRENT } from './tasksB16c';

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

  // inferred: switch the interactive SRT (live transform update while dragging) flag.
  for (const [name, on] of [['Turn ON Interactive SRT', true], ['Turn OFF Interactive SRT', false]] as const)
    reg({ name, label: name, category: '', description: name, undoable: false, args: [],
      execute(app2) { toolState(app2).interactiveSRT = on; app2.events.emit('selection'); return undefined; } });

  // CMD-B16a §7 / WIRE_CORRECTIONS_B16 item 9: the registry handler CLSID is GUID_NULL and no DLL serves it; an inert
  // entry that creates nothing (no log).
  reg({ name: 'Transform Set New ', label: 'Transform Set New ', category: '', undoable: false, args: [], execute: () => undefined });
  // `XYZ Transform `, DoNothing, `Add Surface Point Tool`, CursorTransformTool, `MoveComponent Tool`, `Pick Session Tool`,
  // ToggleProjectionTool: toolmanager.dll commands (CMD-B16a, toolsB16a.ts).

  // CMD-B16c (tasks.dll 2c8a5f31): Source (or _Source) xor FileName, Target (or _Target), Mode 0..3 -> paste operation
  // 8 / 4 / 2 (0 = the service default); the user clipboard is not touched. Body: tasksB16c.ts copyPaste.
  reg({ name: 'CopyPaste', label: 'CopyPaste', category: 'Edit', description: 'This task copy and paste something.  This copy / paste in one command does not affect the current copied items.',
    args: [{ name: 'Source', default: null }, { name: 'FileName', default: '' }, { name: 'Target', default: null }, { name: 'Mode', default: 0 }, { name: '_Source', default: null }, { name: '_Target', default: null }],
    execute(app2, a) { return copyPaste(app2, a); } });

  // inferred: delete each selected object together with its branch (DeleteObj removes the whole sub-tree here).
  reg({ name: 'Delete Selected Branch', label: 'Delete Selected Branch', category: '', description: 'Delete Selected Branch', args: [],
    execute(app2) { const sel = app2.selectedObjects; if (!sel.length) return undefined; return delegate(app2, 'Delete Selected Branch', 'DeleteObj', { InputObj: sel }).result; } });

  // CMD-B16c: the tasks.dll DeleteObj handler (dd531990) on InputObj, default the current layer (not DeleteLayer).
  reg({ name: 'DeleteCurrentLayer', label: 'Delete Current Layer', category: '', args: [{ name: 'InputObj', default: LAYERS_CURRENT }],
    execute(app2, a) { deleteObjList(app2, 'DeleteCurrentLayer', a.InputObj); } });

  // inferred: freeze the operator stack of the selected objects (FreezeObj on the selection).
  reg({ name: 'Freeze Selected', label: 'Freeze Selected', category: '', args: [],
    execute(app2) { const sel = app2.selectedObjects; if (!sel.length) return undefined; return app2.run('FreezeObj', { InputObjs: sel }); } });

  // PaintWeights: row CMD-B16e (src/commands/b16eActioncoreOptasksGap.ts, gap.dll contract).

  // SISwapArrayElements and SIAppendBone: wired from their contracts in shadertasksB16b.ts (row CMD-B16b).

  // inferred: the C++ worker other simulation scripts call: a cache record for Model in the environment's cache list
  // (the record shape of duplicateRenderingSimulationScriptsSimulation.ts), returned to the caller.
  // CMD-B16d (correction 35): the cache is the output argument `Source` (registry flags 513); it is written back into
  // the argument record and kept in `app.inferredB15.out.CreateEnvironmentCache`, and also returned. The serving DLL
  // (environments.dll / simulationop.dll) is still unlocated, so the record shape stays inferred.
  reg({ name: 'CreateEnvironmentCache', label: 'CreateEnvironmentCache', category: 'Simulation',
    args: [{ name: 'Model', default: null }, { name: 'Environment', default: null }, { name: 'Source', default: null }],
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
      a.Source = cache; (toolState(app2) as any).out = { ...((toolState(app2) as any).out ?? {}), [C]: { Source: cache } };
      return cache;
    } });
}
