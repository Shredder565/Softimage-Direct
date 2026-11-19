// Ledger row CMD-B13e, part 2: CrowdFX FBX plotting (CrowdFX.64.dll).
//   CrowdFBXPlot_ExportMode CrowdFBXPlot_ExportBegin CrowdFBXPlot_ExportEnd FBXPlotAndExportCrowd
// Brief: docs/ghidra/cmd-b13e-small-plugins-binary.md, section 3. Original code from that prose only.
//
// The plug-in keeps one global export state (two reference lists and an int mode), created on first use and freed by
// the _Term shared by the three CrowdFBXPlot_* commands. Here it is `app.pluginsB13e.crowd`.
import { App } from '../core/commands';
import { Model, Group } from '../core/scene';
import { ICETreeOperator } from '../core/ice';
import {
  stateOf, fail, failLog, logNya, put, intArg, numArg, boolArg, arrayArg, resolve, unset, narrow,
  E_INVALIDARG, E_ABORT, X3DObject, Node, Property, PluginsB13eState,
} from './pluginsB13eShared';

function crowdState(app: App): NonNullable<PluginsB13eState['crowd']> {
  const st = stateOf(app);
  if (!st.crowd) st.crowd = { listA: [], listB: [], mode: 0, lastBegin: null, exports: [] };
  return st.crowd;
}
/** The shared _Term: frees the global export state. */
export function crowdFbxPlotTerm(app: App) { stateOf(app).crowd = null; }

const crowdProp = (o: X3DObject): Property | undefined => o.properties.find(p => p.name === 'CrowdFX');
/** Walk up the parents to a Model that is not the scene root and carries a property named CrowdFX. */
function crowdModelOf(app: App, n: Node): Model | null {
  let o: any = n;
  while (o && !(o instanceof X3DObject)) o = o.parent ?? null;
  while (o) {
    if (o instanceof Model && o !== app.scene.root && crowdProp(o)) return o;
    o = o.parentObj ?? null;
  }
  return null;
}
/** Members of the model's group with this name (groups whose parent is the model). */
function groupMembers(app: App, model: Model, name: string): X3DObject[] {
  const g = app.scene.groupList.find((x: Group) => x.parent === model && (x.name === name || x.name.endsWith('.' + name)));
  return g ? [...g.members] : [];
}

// ------------------------------------------------------------------ CrowdFBXPlot_ExportMode
function exportMode(app: App, a: Record<string, any>) {
  crowdState(app).mode = intArg(a.ExportAsGeometry, 0) >>> 0;   // stored as unsigned long
  return undefined;   // return value enabled, nothing put
}

// ------------------------------------------------------------------ CrowdFBXPlot_ExportBegin
function exportBegin(app: App, a: Record<string, any>) {
  const C = 'CrowdFBXPlot_ExportBegin';
  const st = crowdState(app);
  st.listA = []; st.listB = [];
  const L1: Node[] = [], L2: Node[] = [];
  const set = new Set<Node>(); const models: Model[] = [];
  for (const x of arrayArg(a.Selection)) {
    const n = resolve(app, x); if (!n) continue;
    const m = crowdModelOf(app, n);
    if (m) { if (!models.includes(m)) models.push(m); } else L1.push(n);
  }
  if (st.mode === 0) {
    for (const x of arrayArg(a.MeshesToCache)) {
      const n = resolve(app, x); if (!n) continue;
      set.add(n); L2.push(n); L1.push(n);
    }
    for (const m of models) for (const o of groupMembers(app, m, 'Actors_Copies')) if (!set.has(o)) { set.add(o); L2.push(o); L1.push(o); }
  } else if (st.mode === 2) {
    for (const m of models) for (const o of groupMembers(app, m, 'Mesh_Proxies')) {
      const tree = o.primitive?.operators.find(op => op instanceof ICETreeOperator && op.name === 'Set_Mesh_Proxy') as ICETreeOperator | undefined;
      if (!tree) continue;
      const compound = tree.nodes.find(nd => nd.type === 'Set Mesh Proxy' || (nd.params as any).name === 'Set Mesh Proxy');
      if (!compound) { logNya(app, C, `the compound "Set Mesh Proxy" of ${o.name}.Set_Mesh_Proxy (ICE compounds are not modelled)`); continue; }
      const link = tree.links.find(l => l.to === compound.id && l.toPort === 'In_Name');
      const provider = link && tree.nodes.find(nd => nd.id === link.from);
      const ref = provider?.params.val('reference');
      const obj = typeof ref === 'string' && ref ? app.scene.find(ref) : undefined;
      if (obj && !L1.includes(obj)) { L1.push(obj); st.listB.push(obj); }
    }
  }
  st.lastBegin = [L1, L2];
  return [L1, L2];
}

// ------------------------------------------------------------------ CrowdFBXPlot_ExportEnd
function exportEnd(app: App, a: Record<string, any>) {
  const C = 'CrowdFBXPlot_ExportEnd';
  const st = crowdState(app);
  if (st.mode === 0) return undefined;
  const ptrs = arrayArg(a.Ptrs);
  // Ptrs[0] / Ptrs[1] are raw 64-bit native pointers (an FBX SDK object and a second native object); this build has no
  // FBX SDK scene to receive them.
  st.exports.push({ command: C, ptrs: ptrs.slice(0, 2), listB: [...st.listB], meshProxies: st.mode === 2 });
  logNya(app, C, 'the FBX node / skin builder (0x1800093e0) that bakes the crowd into the FBX scene');
  return undefined;
}

// ------------------------------------------------------------------ FBXPlotAndExportCrowd
function plotAndExport(app: App, a: Record<string, any>) {
  const C = 'FBXPlotAndExportCrowd';
  // inferred: the Collection argument handler reads the selection when Models is omitted
  let models = arrayArg(unset(a.Models) ? [...app.selection] : (typeof a.Models === 'string' ? a.Models.split(',') : a.Models))
    .map(x => resolve(app, typeof x === 'string' ? x.trim() : x)).filter((n): n is Model => n instanceof Model);
  if (!models.length) {
    const found = [app.scene.root, ...app.scene.allObjects()].find(o => o instanceof Model && !!crowdProp(o) && boolArg(crowdProp(o)!.val('IsActive'), false));
    if (found) models = [found as Model];
  }
  if (!models.length) {
    app.logMsg('error', `${C}: [XSICROWDFX 1]`);
    logNya(app, C, 'the text of the translated string XSICROWDFX 1');
    throw fail(E_INVALIDARG, `${C}: no active crowd model`);
  }
  let file = narrow(a.FilePathName, 1024);
  if (!file) {
    const st = stateOf(app); const title = 'Export FBX file';
    const filter = 'FBX (*.fbx)|*.fbx||';   // inferred filter
    const got = st.hooks.fileDialog?.(C, title, filter);
    if (got === undefined) logNya(app, C, 'the save file dialog (no dialog host); cancelled');
    if (!got) throw fail(E_ABORT, `${C}: cancelled`);
    file = String(got);
  }
  const rec = { command: C, file, models, start: numArg(a.StartFrame, 1), end: numArg(a.EndFrame, 100), format: 'FBX201400', options: { 0x10: boolArg(a.ExportGeom, false) } };
  crowdState(app).exports.push(rec);
  logNya(app, C, 'the FBX-XSI exporter run (CreateFbxXsiObjectExporter); no file is written');
  put(app, C, true);
  return true;   // true exactly when the status is OK
}

export function registerPluginsB13eCrowdCommands(app: App) {
  const cat = 'Custom';
  app.register({
    name: 'CrowdFBXPlot_ExportMode', label: 'CrowdFBXPlot_ExportMode', category: cat, description: 'Export mode',
    args: [{ name: 'ExportAsGeometry', default: 0 }], undoable: false, execute: exportMode,
  });
  app.register({
    name: 'CrowdFBXPlot_ExportBegin', label: 'CrowdFBXPlot_ExportBegin', category: cat, description: 'Crowd plotting into FBX file pre-export step',
    args: [{ name: 'Selection', default: null }, { name: 'MeshesToCache', default: null }], undoable: false, execute: exportBegin,
  });
  app.register({
    name: 'CrowdFBXPlot_ExportEnd', label: 'CrowdFBXPlot_ExportEnd', category: cat, description: 'Export Crowd as FBX',
    args: [{ name: 'Ptrs', default: null }], undoable: false, execute: exportEnd,
  });
  app.register({
    name: 'FBXPlotAndExportCrowd', label: 'FBXPlotAndExportCrowd', category: cat, description: 'Export Crowd as FBX',
    args: [{ name: 'FilePathName', default: '' }, { name: 'StartFrame', default: 1 }, { name: 'EndFrame', default: 100 }, { name: 'Models', default: null }, { name: 'ExportGeom', default: false }],
    undoable: false, execute: plotAndExport,
  });
}
