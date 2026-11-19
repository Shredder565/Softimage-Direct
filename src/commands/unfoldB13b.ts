// Ledger row CMD-B13b: the 12 commands of the Unfold3D add-on (Unfold3D.64.dll).
//   UnfoldApply UnfoldApplySel UnfoldAddToCut UnfoldRemoveFromCut UnfoldSetCut UnfoldClearCut UnfoldSelectCut
//   UnfoldUpdate UnfoldPackUpdate UnfoldAdjustUpdate UnfoldRegularize UnfoldRelax
// Brief: docs/ghidra/cmd-b13b-unfold3d-binary.md, section 3. Original code from that prose only.
import { App } from '../core/commands';
import {
  S_OK, E_INVALIDARG, E_FAIL, F_UNFOLD, F_ADJUST, F_PACK, F_ISLANDSEL, F_RELAX, F_REFRESH,
  stateOf, fail, failLog, setStatus, logNya, licenceCheck, text, unset, itemsArg, expand, ownerObject, hostOf, hostProperties,
  isCustomProperty, isUnfoldProperty, isProjection, makeUnfoldProperty, buildRecords, cutClusterFor, findCutCluster, hasUVs,
  addIslandFrontiers, addToCluster, removeFromCluster, relabel, inspect,
  X3DObject, Cluster, Property, Operator, Group, Node, type EdgeSub,
} from './unfoldB13bShared';
import { solverDriver } from './unfoldB13bSolver';
import { int, num, str } from '../core/params';

const FRONTIERS = 'AddIslandFrontiersFromUVCoords';
const isSub = (x: any): x is EdgeSub => !!x && !(x instanceof Node) && x.obj instanceof X3DObject;

// ------------------------------------------------------------------ UnfoldApply / UnfoldApplySel
function unfoldApply(app: App, a: Record<string, any>): Property[] {
  const C = 'UnfoldApply';
  licenceCheck(app, C);
  const inputs = itemsArg(app, a['Object(s) and/or group(s) and/or Texture Projection(s)']);
  const projections = inputs.filter((x): x is Property => isProjection(x));
  const targets: (Node | EdgeSub)[] = inputs.filter(x => !isProjection(x));
  const expanded = () => targets.flatMap(t => expand(t));
  for (const p of projections) { const o = ownerObject(p); if (o && !expanded().includes(o)) targets.push(o); }
  if (!targets.length) {
    app.logMsg('info', 'Unfold3D: Nothing unfoldable selected... Please select some object(s) and/or group(s) and/or Texture Projection(s) and retry');
    setStatus(app, C, S_OK); return [];
  }
  const out: Property[] = [];
  for (const t of targets) {
    if (!expand(t).length) continue;
    const host: Node | null = t instanceof Group || t instanceof X3DObject ? t : isSub(t) ? t.obj : ownerObject(t);
    if (!host) continue;
    const list = host instanceof X3DObject ? host.properties : hostProperties(host);
    let name = 'Unfold', i = 1; while (list.some(p => p.name === name)) name = `Unfold${i++}`;
    const prop = makeUnfoldProperty(name);
    if (host instanceof X3DObject) app.record('AddProp', () => host.addProperty(prop), () => host.removeProperty(prop));
    else app.record('AddProp', () => { list.push(prop); prop.parent = host; }, () => { const k = list.indexOf(prop); if (k >= 0) list.splice(k, 1); prop.parent = null; });
    buildRecords(app, prop, projections);   // failures show a message box; the property is still returned (inferred)
    relabel(app, prop);
    out.push(prop);
  }
  setStatus(app, C, S_OK);
  return out;
}
function unfoldApplySel(app: App) {
  const C = 'UnfoldApplySel';
  const sel = app.compSel ? [app.compSel.obj] : [...app.selection];
  if (!sel.length) {
    app.logMsg('info', 'Unfold3D: Nothing selected... Please select some object(s) and/or group(s) and/or Texture Projection(s) and retry');
    setStatus(app, C, S_OK); return;
  }
  const props: Property[] = app.run('UnfoldApply', { 'Object(s) and/or group(s) and/or Texture Projection(s)': sel }) ?? [];
  for (const p of props) inspect(app, p, '', 'Unfold3D parameters', 3, false);   // 3 = modal (inferred)
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ cut-line worker (UnfoldAddToCut / RemoveFromCut / SetCut)
function propertyArg(app: App, v: any): Node | EdgeSub | undefined { return unset(v) ? app.selection[0] : itemsArg(app, v)[0]; }
function cutWorker(mode: 'Add' | 'Remove' | 'Set', C: string) {
  return (app: App, a: Record<string, any>) => {
    const prop = propertyArg(app, a.UnfoldProperty);
    if (!isUnfoldProperty(prop)) throw failLog(app, C, E_INVALIDARG, 'Unfold: argument 1 must be an UnfoldProperty property');
    const edges = itemsArg(app, a['EdgeList(s)']).filter((x): x is EdgeSub => isSub(x) && x.kind === 'edge' && x.items.length > 0);
    if (!edges.length) throw failLog(app, C, E_INVALIDARG, 'Unfold: could not find edge subcomponents in argument 2');
    if (a.Options === FRONTIERS) addIslandFrontiers(app, prop);
    for (const e of edges) {
      const c = cutClusterFor(app, e.obj, prop);
      if (!c) throw fail(E_FAIL, `${C}: the cut cluster could not be created on ${e.obj.fullName}`);
      if (mode === 'Set') removeFromCluster(app, c, [...c.elements]);
      if (mode === 'Remove') removeFromCluster(app, c, e.items); else addToCluster(app, c, e.items);
    }
    buildRecords(app, prop);
    const r = hasUVs(app, prop) ? solverDriver(app, C, prop, F_REFRESH) : S_OK;
    setStatus(app, C, r);
  };
}

// ------------------------------------------------------------------ UnfoldClearCut
function clearCut(app: App, a: Record<string, any>) {
  const C = 'UnfoldClearCut';
  for (const prop of itemsArg(app, a['UnfoldProperty(s)'])) {
    if (!isUnfoldProperty(prop)) throw failLog(app, C, E_FAIL, 'Unfold: argument 1 must be UnfoldProperty property collection');
    for (const r of buildRecords(app, prop)) removeFromCluster(app, r.cutCluster, [...r.cutCluster.elements]);
    if (a.Options === FRONTIERS) addIslandFrontiers(app, prop);
    if (hasUVs(app, prop)) solverDriver(app, C, prop, F_REFRESH);
  }
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ UnfoldSelectCut
function selectCut(app: App, a: Record<string, any>) {
  const C = 'UnfoldSelectCut';
  const prop = propertyArg(app, a.UnfoldProperty);
  if (!isUnfoldProperty(prop)) throw failLog(app, C, E_INVALIDARG, 'Unfold: argument 1 must be an UnfoldProperty property');
  if (a.Options === FRONTIERS) addIslandFrontiers(app, prop);   // edits the scene although the command only selects
  // inferred: an omitted Object(s) argument is empty (not the selection), so the property's parent is expanded
  const given = unset(a['Object(s)']) ? [] : itemsArg(app, a['Object(s)']);
  const host = hostOf(prop);
  const objs = given.length ? given : host ? expand(host) : [];
  const id = Number(prop.val('UnfoldPropertyID'));
  let picked: { o: X3DObject; items: (number | string)[] } | null = null; let count = 0;
  for (const it of objs) {
    const o = it instanceof X3DObject ? it : isSub(it) ? it.obj : null; if (!o) continue;
    if (app.compSel?.obj === o && app.compSel.kind === 'edge') app.compSel.edges.clear();   // drop the object's selected edges
    const c = findCutCluster(o, id);
    if (c) { picked = { o, items: [...c.elements] }; count++; }
  }
  if (count > 1) logNya(app, C, 'an edge selection on several objects; this build keeps the last object\'s cut line');
  if (picked) app.selectComponents(picked.o, 'edge', picked.items, 'replace');
  app.run('SetSelFilter', { SelFilter: 'Edge' });
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ UnfoldUpdate / PackUpdate / AdjustUpdate
function update(app: App, a: Record<string, any>) {
  const C = 'UnfoldUpdate'; const opts = unset(a.Options) ? '' : String(a.Options);
  let flags = F_UNFOLD; if (opts.includes('DoPack')) flags = F_UNFOLD | F_PACK; if (opts.includes('UseIslandSelection')) flags |= F_ISLANDSEL;
  for (const prop of itemsArg(app, a['UnfoldProperty(s)'])) {
    if (!isUnfoldProperty(prop)) throw failLog(app, C, E_FAIL, 'Unfold: argument 1 must be UnfoldProperty property');
    solverDriver(app, C, prop, flags);
  }
  setStatus(app, C, S_OK);
}
function packUpdate(app: App, a: Record<string, any>) {
  const C = 'UnfoldPackUpdate';
  for (const prop of itemsArg(app, a['UnfoldProperty(s)'])) {
    if (!isCustomProperty(prop)) throw failLog(app, C, E_INVALIDARG, 'Unfold: argument 1 must be an array of UnfoldProperty');
    if (!isUnfoldProperty(prop)) throw failLog(app, C, E_INVALIDARG, 'Unfold: argument  1 must be an array of UnfoldProperty');
    solverDriver(app, C, prop, F_PACK);
  }
  setStatus(app, C, S_OK);
}
function adjustUpdate(app: App, a: Record<string, any>) {
  const C = 'UnfoldAdjustUpdate'; const opts = unset(a.Options) ? '' : String(a.Options);
  const flags = opts.includes('DoRelax') ? F_RELAX : F_ADJUST;
  for (const prop of itemsArg(app, a['UnfoldProperty(s)'])) {
    if (!isUnfoldProperty(prop)) throw fail(E_FAIL, `${C}: argument 1 is not an UnfoldProperty`);   // no log message (note)
    solverDriver(app, C, prop, flags);
  }
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ UnfoldRegularize / UnfoldRelax (note 2.10)
const className = (n: any) => n instanceof Cluster ? 'Cluster' : n instanceof X3DObject ? 'X3DObject' : n instanceof Property ? 'Property' : n instanceof Operator ? 'Operator' : n?.constructor?.name ?? 'null';
function applyOptimize(option: 'Relax' | 'Regularize', C: string, samplesArg: string) {
  return (app: App, a: Record<string, any>) => {
    const T = 'UnfoldApplyOptimizeOperator';
    const proj = propertyArg(app, a['Texture Projection']);
    if (!(proj instanceof Property) || !(proj.type === 'uvprojection' || proj.parent instanceof Cluster))
      throw failLog(app, C, E_INVALIDARG, `${T} : argument 0 must be a Texture Projection (ClusterProperty of SampleCluster)`);
    const cl = proj.parent;
    if (!(cl instanceof Cluster)) throw failLog(app, C, E_INVALIDARG, `${T} : Parent of arg 0 is not a Cluster : ${className(cl)}`);
    const prim = cl.obj?.primitive ?? null;
    if (!prim) throw failLog(app, C, E_INVALIDARG, `${T} : Grand Parent of arg 0 is not a Primitive ${className(cl.obj)}`);
    if (prim.type !== 'polymsh' || !prim.mesh())   // inferred: the order of "Unfold", the class name and the text
      throw failLog(app, C, E_INVALIDARG, `Unfold : Grand Parent of arg 0 is not a Primitive of type PolygonMesh. Given object's type : ${prim.type}`);
    const op = new Operator('UnfoldOptimizeOperator', 'UnfoldOptimizeOperator', [
      { ...int('Iterations', 2, 'Iterations', { min: 0, max: 10000, uimin: 0, uimax: 10, desc: 'Application algorithm number' }), animatable: false },
      { ...num('Power', 1.0, 'Power', { min: 0, max: 1, desc: 'Power of application' }), animatable: false },
      str('SampleSelectionSet', ' '), str('SamplePinnedSet', ' '), str('Options', ' '),
    ]);
    op.set('SampleSelectionSet', text(a[samplesArg])); op.set('SamplePinnedSet', text(a['Pinned Samples'])); op.set('Options', option);
    (op as any).alwaysEvaluate = true;
    (op as any).outputPorts = { TextureProjection: proj };
    (op as any).inputPorts = { TextureProjection: proj, SampleCluster: cl, Primitive: prim };
    const st = stateOf(app);
    app.record('UnfoldOptimizeOperator', () => { st.optimizeOps.push(op); (proj as any).optimizeOperators = [...((proj as any).optimizeOperators ?? []), op]; op.parent = proj as any; },
      () => { const i = st.optimizeOps.indexOf(op); if (i >= 0) st.optimizeOps.splice(i, 1); (proj as any).optimizeOperators = ((proj as any).optimizeOperators ?? []).filter((x: Operator) => x !== op); op.parent = null; });
    logNya(app, C, 'the UnfoldOptimizeOperator evaluation (Iterations / Power / sample sets); the projection\'s UVs are not changed');
    inspect(app, op, '', '', 0, false);   // InspectObj on the new operator, first argument only
    setStatus(app, C, S_OK);
    return op;
  };
}

export function registerUnfoldB13bCommands(app: App) {
  stateOf(app);
  const reg = (name: string, args: { name: string; default?: any }[], execute: (app: App, a: Record<string, any>) => any, description: string, undoable = true) =>
    app.register({ name, label: name, category: 'Texturing|Unfold3D', description, args, undoable, execute });
  reg('UnfoldApply', [{ name: 'Object(s) and/or group(s) and/or Texture Projection(s)' }], unfoldApply,
    'Adds an Unfold property (cut line, texture projection, Unfold operator) to objects, groups or texture projections.');
  reg('UnfoldApplySel', [], (app) => unfoldApplySel(app), 'Runs UnfoldApply on the selection and inspects the new properties.');
  reg('UnfoldAddToCut', [{ name: 'UnfoldProperty' }, { name: 'EdgeList(s)' }, { name: 'Options', default: FRONTIERS }], cutWorker('Add', 'UnfoldAddToCut'),
    'Adds edges to the Unfold cut line.');
  reg('UnfoldRemoveFromCut', [{ name: 'UnfoldProperty' }, { name: 'EdgeList(s)' }, { name: 'Options', default: FRONTIERS }], cutWorker('Remove', 'UnfoldRemoveFromCut'),
    'Removes edges from the Unfold cut line.');
  reg('UnfoldSetCut', [{ name: 'UnfoldProperty' }, { name: 'EdgeList(s)' }, { name: 'Options', default: '' }], cutWorker('Set', 'UnfoldSetCut'),
    'Sets the Unfold cut line from edges.');
  reg('UnfoldClearCut', [{ name: 'UnfoldProperty(s)' }, { name: 'Options', default: '' }], clearCut, 'Empties the Unfold cut lines.');
  reg('UnfoldSelectCut', [{ name: 'UnfoldProperty' }, { name: 'Object(s)' }, { name: 'Options', default: FRONTIERS }], selectCut, 'Selects the Unfold cut-line edges.');
  reg('UnfoldUpdate', [{ name: 'UnfoldProperty(s)' }, { name: 'Options', default: 'DoPack' }], update, 'Unfolds (and packs) the UVs of Unfold properties.');
  reg('UnfoldPackUpdate', [{ name: 'UnfoldProperty(s)' }], packUpdate, 'Packs the UV islands of Unfold properties.');
  reg('UnfoldAdjustUpdate', [{ name: 'UnfoldProperty(s)' }, { name: 'Options', default: 'DoRegularize' }], adjustUpdate, 'Regularizes or relaxes the selected UV samples.');
  reg('UnfoldRegularize', [{ name: 'Texture Projection' }, { name: 'Samples to Regularize' }, { name: 'Pinned Samples', default: '' }],
    applyOptimize('Regularize', 'UnfoldRegularize', 'Samples to Regularize'), 'Applies an UnfoldOptimizeOperator (Regularize) to a texture projection.');
  reg('UnfoldRelax', [{ name: 'Texture Projection' }, { name: 'Samples to Relax' }, { name: 'Pinned Samples', default: '' }],
    applyOptimize('Relax', 'UnfoldRelax', 'Samples to Relax'), 'Applies an UnfoldOptimizeOperator (Relax) to a texture projection.');
}
