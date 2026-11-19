// Ledger row CMD-B14c (Face Robot `FR.dll`), part 2: region / stress / tendon maps, region paint, show-maps toggles,
// stress, normal map, region masks, remove tongue.
//   fr_MapRegion fr_MapStress fr_MapTendon fr_StartRegionPaint fr_ToggleShowMaps fr_ToggleShowMapsUnselected
//   fr_ApplyStress fr_MakeNormalMap fr_MakeRegionMasks fr_AnimateRegionMasks fr_RemoveTongue
// Brief: docs/ghidra/cmd-b14c-fr-eyes-jaw-regions.md §3. Original code written from that prose only; no golden.
// The weight map is a `weightmap` property (values: point -> weight) on cluster `WeightMapCls`; the map operator is a
// stand-in `fro_MapRegionStressTendonOp` whose ports are recorded (its _Update was not read: weights are not computed).
import { App } from '../core/commands';
import { Cluster, Group } from '../core/scene';
import { num, int } from '../core/params';
import {
  frStore, faceMesh, fail, failLog, logNya, progress, intArg, boolArg, msgBox, addProperty, propNamed, meshOf, X3DObject, Property, Node, unset,
  resolve, E_FAIL,
} from './faceRobotB14Shared';
import {
  ROW_C, E_UNEXPECTED, setStatus, frDesktop, selectObj, deleteObj, reparent, objOrName, FROp, addOp, opsOf, addClusterProp, setVal,
  progressCancelled,
} from './faceRobotB14bcShared';

const NYA = (app: App, c: string, what: string) => logNya(app, c, what, ROW_C);
const MAPS = ['RegionMap', 'StressMap', 'TendonStressMap'];

// ------------------------------------------------------------------ fr_MapRegion / fr_MapStress / fr_MapTendon
function mapPipeline(app: App, C: string, mode: number, a: Record<string, any>) {
  if (mode < 0 || mode > 2) throw fail(E_UNEXPECTED, `${C}: unknown mode ${mode}`);
  const face = objOrName(app, a.inFace);
  if (!face || !meshOf(face)) throw failLog(app, C, E_FAIL, 'inFace is not a polygon mesh');   // inferred failure of step 1
  const name = MAPS[mode];
  let wcls = face.cluster('WeightMapCls') ?? null;
  let map = wcls?.properties.find(p => p.name === name) ?? null;
  if (!map) {
    // 2. clusters
    const [word, legacyWord] = mode === 2 ? ['Tendon', 'Tendon'] : ['Region', 'Bulger'];
    const [type, legacy] = mode === 2 ? ['fro_TendonOp', 'Tendon'] : ['fro_RegionOp', 'Bulger'];
    const entries: { cluster: Cluster; op: FROp; prefix: string }[] = [];
    for (const c of face.clusters) {
      const ops = opsOf(face).filter(o => o instanceof FROp && o.cluster === c) as FROp[];
      const op = ops.find(o => o.type === type) ?? ops.find(o => o.type === legacy); if (!op) continue;
      const w = c.name.includes(word) ? word : c.name.includes(legacyWord) ? legacyWord : null; if (!w) continue;
      entries.push({ cluster: c, op, prefix: c.name.slice(0, c.name.indexOf(w)) });
    }
    // 3. port targets
    const per = entries.map(e => mode === 2
      ? { Cluster: e.cluster, Control: e.op.inputs[2] ?? null, Slider: e.op.inputs[4] ?? null, PercMap: e.op.inputs[8] ?? null, BaseLength: e.op.get('BaseDistance') ?? null }
      : { Cluster: e.cluster, Curve: e.op.inputs[2] ?? null, Slider: e.op.inputs[3] ?? null, PercMap: e.op.inputs[8] ?? null, BaseLength: e.op.get('BaseLength') ?? null, BaseMultiplier: e.op.get('BaseMultiplier') ?? null });
    const op0 = entries[0]?.op;
    const wrinkle = mode === 0 ? op0?.inputs[9] ?? null : null, multiplier = mode !== 2 ? op0?.inputs[10] ?? null : null, base = mode === 2 ? op0?.inputs[3] ?? null : null;
    // 4. the UI property
    const ui = addProperty(app, face, new Property(name, 'customparamset', entries.map(e => num(e.prefix, 1, e.prefix, { min: 0, max: 200, uimin: 0, uimax: 5 }))));
    // 5. the weight map
    if (!wcls) {
      const n = meshOf(face)!.positions.length / 3; const c = new Cluster('WeightMapCls', 'pnt', new Set([...Array(n).keys()])); c.set('alwayscomplete', true);
      app.record('CreateCluster', () => face.addCluster(c), () => face.removeCluster(c)); wcls = c;
    }
    const [r, g, b] = mode === 0 ? [0, 50, 255] : [255, 255, 255];
    map = new Property(name, 'weightmap', [num('min', 0, 'Minimum', { readOnly: true }), num('max', 1, 'Maximum', { readOnly: true }), int('red', r, 'red'), int('green', g, 'green'), int('blue', b, 'blue')]);
    (map as any).values = new Map<number, number>(); (map as any).label = 'Weight Map Property';
    addClusterProp(app, wcls, map);
    NYA(app, C, 'the call 0x1801a6a90 made on the new weight map (Q6)');
    // 6. the operator
    const op = new FROp('fro_MapRegionStressTendonOp', 'fro_MapRegionStressTendonOp', [int('Mode', mode, 'Mode', { min: 0, max: 2 })]);
    op.cluster = wcls;
    const input: Record<string, any> = { inUI: ui };
    if (mode === 0) input.inWrinkleMap = wrinkle;
    if (mode !== 2 && multiplier) input.inMultiplier = multiplier;
    if (mode === 2) input.inBase = base;
    const perCluster: Record<string, any> = {};
    per.forEach((p, i) => {
      perCluster[`${i}Cluster`] = p.Cluster; perCluster[`${i}Slider`] = p.Slider; perCluster[`${i}PercMap`] = p.PercMap; perCluster[`${i}BaseLength`] = p.BaseLength;
      if (mode === 2) perCluster[`${i}Control`] = (p as any).Control; else { perCluster[`${i}BaseMultiplier`] = (p as any).BaseMultiplier; perCluster[`${i}Curve`] = (p as any).Curve; }
    });
    op.ports = { MainGroup: { ioWeightMap: map }, InputGroup: input, InputGroupPerCluster: perCluster };
    addOp(app, face, op);
    NYA(app, C, 'the fro_MapRegionStressTendonOp update (0x18009d3b0); the map weights are not computed');
  }
  // 7.
  selectObj(app, [map]);
  const cv = frDesktop(app).camvis, K = 'Views.ViewB.*.camvis.objctrlpropmaps', had = cv.has(K), old = cv.get(K);
  app.record('SetValue ' + K, () => cv.set(K, true), () => { if (had) cv.set(K, !!old); else cv.delete(K); });
  return undefined;
}

// ------------------------------------------------------------------ fr_StartRegionPaint
function startRegionPaint(app: App, a: Record<string, any>) {
  const C = 'fr_StartRegionPaint';
  const mesh = objOrName(app, a.inMesh); const rn = unset(a.inRegionName) ? '' : String(a.inRegionName).toLowerCase();
  const c = mesh?.clusters.find(x => x.name.slice(0, rn.length).toLowerCase() === rn) ?? null;
  const perc = c?.properties.find(p => p.name === 'Perc') ?? null;
  if (!mesh || !c || !perc) throw failLog(app, C, E_FAIL, `no ${rn ? `"${a.inRegionName}" ` : ''}region cluster with a Perc property`);
  const d = frDesktop(app);
  d.selToolValue = 0; app.logMsg('info', 'ActivateObjectSelTool(0)');
  selectObj(app, [perc]); selectObj(app, [mesh]);
  if (d.tool !== 'BrushTool') {
    d.tool = 'BrushTool';
    if (app.commands.has('PaintTool')) { try { app.run('PaintTool'); } catch { /* the paint tool of this build needs a viewport */ } }
    else app.logMsg('info', 'PaintTool()');
  }
  return undefined;
}

// ------------------------------------------------------------------ fr_ToggleShowMaps*
function toggleShowMaps(app: App, C: string, attr: string) {
  const d = frDesktop(app); const v = d.views.get('frmviewmanager');
  if (!v) throw failLog(app, C, E_FAIL, 'view frmviewmanager not found');
  const cam = String(v.attrs['activecamera:b'] ?? '');
  if (!cam) { setStatus(app, C, 1); return undefined; }
  const target = ['User', 'Front', 'Top', 'Spot', 'Right'].includes(cam) ? `Views.ViewB.${cam}` : cam;
  const key = `${target}.camvis.${attr}`;
  const had = d.camvis.has(key), old = !!d.camvis.get(key);
  app.record('SetValue ' + key, () => d.camvis.set(key, !old), () => { if (had) d.camvis.set(key, old); else d.camvis.delete(key); });
  setStatus(app, C, 0);
  return undefined;
}

// ------------------------------------------------------------------ fr_ApplyStress
function applyStress(app: App, a: Record<string, any>) {
  const C = 'fr_ApplyStress';
  const mesh = objOrName(app, a.StressMesh);
  const fm = frStore(app).raw('_', 'FaceModel'); const fs = fm instanceof X3DObject ? propNamed(fm, 'FaceScale') : undefined;
  const scale = Number(fs?.val('Scale') ?? 1); void scale;
  const ops = (mesh ? opsOf(mesh).filter(o => o.type === 'fro_RegionOp') : []) as FROp[];
  const saved: { op: FROp; base: any; fr: Property | null; strength: any }[] = [];
  if (ops.length) NYA(app, C, 'the BaseLength solver 0x18018bda0 (Q8); BaseLength is rewritten with its current value');
  for (const op of ops) {
    const base = op.val('BaseLength');
    app.logMsg('info', `Evaluating Op ${op.fullName}`);
    const nb = base;   // solver unread
    setVal(app, op, 'BaseLength', nb);
    app.logMsg('info', `dBaseLength>>> ${base}`); app.logMsg('info', `  NBaseLength>>> ${nb}`);
    const fr = op.cluster?.properties.find(p => p.name === 'FaceRegionProperties') ?? null;   // inferred: the region cluster's set
    const strength = fr?.val('Strength');
    if (fr && Number(strength) > 1) setVal(app, fr, 'Strength', 1);
    saved.push({ op, base, fr, strength });
  }
  if (boolArg(a.OutPutMesh, true)) {
    NYA(app, C, 'the stress-mesh duplicator 0x1801768d0 (Q8)');
    const st = frStore(app); const old = st.raw('_', 'StressMesh');
    if (mesh) app.record('fr_sput StressMesh', () => st.put('_', 'StressMesh', mesh), () => { if (old === undefined) st.delete('_', 'StressMesh'); else st.put('_', 'StressMesh', old); });
    for (const s of saved) { setVal(app, s.op, 'BaseLength', s.base); if (s.fr && s.strength !== undefined) setVal(app, s.fr, 'Strength', s.strength); }
  }
  return undefined;
}

// ------------------------------------------------------------------ fr_MakeNormalMap / fr_MakeRegionMasks / fr_AnimateRegionMasks
function propArg(app: App, v: any): Property | null { if (v instanceof Property) return v; if (unset(v)) return null; const n = resolve(app, v); return n instanceof Property ? n : null; }
function makeNormalMap(app: App, a: Record<string, any>) {
  const C = 'fr_MakeNormalMap';
  const exp = objOrName(app, a.xExportMesh), game = propArg(app, a.gameProp);
  if (!exp) { app.logMsg('error', 'FR Game Export mesh not found'); return undefined; }
  const g = (n: string) => game?.val(n);
  if (!['Generate_Stress_Mesh', 'Generate_Stress', 'Generate_Rest'].some(n => !!g(n))) { app.logMsg('error', 'Check At least one of the Generation Options'); return undefined; }
  const face = faceMesh(app);
  if (!face) { app.logMsg('error', 'Face Robot mesh not found, open a valid Face Robot Scene and try again'); return undefined; }
  const sm = frStore(app).raw('_', 'StressMesh');
  if (g('Use_Custom_Mesh') && !(sm instanceof X3DObject)) {
    if (msgBox(app, ' Custom Stress Mesh NOT FOUND, Do you want to generate it ?', 4) !== 6) return undefined;
  }
  NYA(app, C, 'the normal-map worker 0x18018e610 (Ultimapper property, TangentOp3_cpp maps, FindUltimapperDistance / GenerateUltimapper for the rest and stress maps, fr_ResetRetarget)');
  return undefined;
}
const MASK_NAMES = ['ForeHead_R0', 'LCheek_G0', 'LNose_B0', 'RCheek_R1', 'RNose_G1', 'Brow_B1', 'LJaw_R2', 'RJaw_G2', 'Chin_B2'];
function makeRegionMasks(app: App, a: Record<string, any>) {
  const C = 'fr_MakeRegionMasks';
  const mesh = objOrName(app, a.xLowResMesh), game = propArg(app, a.gameProp);
  const masks = intArg(game?.val('Masks'), 1);
  if (!mesh) { NYA(app, C, 'the branch without a low-resolution mesh'); return []; }
  // inferred: one parameter per region name (the nine names of the three-mask layout)
  if (!propNamed(mesh, 'RegionMasks')) addProperty(app, mesh, new Property('RegionMasks', 'customparamset', MASK_NAMES.map(n => num(n, 0, n, { min: 0, max: 1 }))));
  NYA(app, C, `the worker 0x180192f80 (RegionMask_* vertex colour maps, channel layout for Masks = ${masks}, fr_ResetRetarget) and the array it returns`);
  return [];
}
function animateRegionMasks(app: App, a: Record<string, any>) {
  const C = 'fr_AnimateRegionMasks';
  const caption = 'Plotting Masks Animation'; progress(app, caption);
  const mesh = objOrName(app, a.xExportMesh), game = propArg(app, a.gameProp);
  const masks = intArg(game?.val('Masks'), 1);
  NYA(app, C, 'the name-table filler 0x180191490');
  const rm = mesh ? propNamed(mesh, 'RegionMasks') : undefined;
  const params = rm?.params.slice(0, 9) ?? [];
  const start = intArg(a.Start, 0), end = intArg(a.End, 0);
  let step = 0;
  for (let i = 0; i < 9; i++) {
    if ((i >= 3 && masks < 2) || (i >= 6 && masks < 3)) continue;
    if (params[i]) NYA(app, C, `the per-mask plotter 0x180191f00 for ${params[i].name} over frames ${start}..${end}`);
    step++;
    if (progressCancelled(app, caption, step)) throw failLog(app, C, E_FAIL, 'cancelled');
  }
  return undefined;
}

// ------------------------------------------------------------------ fr_RemoveTongue
function removeTongue(app: App, a: Record<string, any>) {
  const C = 'fr_RemoveTongue'; const st = frStore(app);
  const drop = (sec: string, key: string) => { const old = st.raw(sec, key); if (old !== undefined) app.record('fr_sdelete', () => st.delete(sec, key), () => st.put(sec, key, old)); };
  const tv = st.raw('meshes', 'Tongue'); const tongue = tv instanceof X3DObject ? tv : typeof tv === 'string' ? objOrName(app, tv) : null;
  for (const k of ['TongueBack_Control', 'TongueFront_Control', 'TongueTip_Control', 'TongueBase_Control']) {
    const v = st.raw('controls', k); if (v === undefined) continue;
    const o = v instanceof X3DObject ? v : objOrName(app, v);
    if (o) deleteObj(app, o);
    drop('controls', k);
  }
  if (tongue) {
    if (boolArg(a.DeleteMesh, false)) deleteObj(app, tongue);
    else {
      const old = (tongue as any).userKeywords;
      app.record('ClearUserKeyword', () => { delete (tongue as any).userKeywords; }, () => { if (old !== undefined) (tongue as any).userKeywords = old; });
      app.logMsg('info', `ClearUserKeyword("${tongue.fullName}")`);
      reparent(app, tongue, app.scene.root);
    }
  }
  const gv = st.raw('groups', 'Tongue');
  if (gv instanceof Group) { const old = [...gv.members]; app.record('RemoveFromGroup', () => { gv.members.length = 0; }, () => { gv.members.push(...old); }); }
  drop('meshes', 'Tongue');
  NYA(app, C, 'the call 0x180118890 (inferred UI refresh)');
  return true;
}

export function registerFaceRobotB14cMapCommands(app: App) {
  const reg = (name: string, description: string, args: [string, any][], execute: (app: App, a: Record<string, any>) => any) =>
    app.register({ name, label: name, category: 'Face Robot', description, args: args.map(([n, d]) => ({ name: n, default: d })), execute });
  reg('fr_MapRegion', '', [['inFace', null]], (app, a) => mapPipeline(app, 'fr_MapRegion', 0, a));
  reg('fr_MapStress', '', [['inFace', null]], (app, a) => mapPipeline(app, 'fr_MapStress', 1, a));
  reg('fr_MapTendon', '', [['inFace', null]], (app, a) => mapPipeline(app, 'fr_MapTendon', 2, a));
  reg('fr_StartRegionPaint', '', [['inMesh', null], ['inRegionName', null]], startRegionPaint);
  reg('fr_ToggleShowMaps', 'Toggle Show Maps For Selected Objects', [], (app) => toggleShowMaps(app, 'fr_ToggleShowMaps', 'attrselpropertymaps'));
  reg('fr_ToggleShowMapsUnselected', 'Toggle Show Maps For Unselected Objects', [], (app) => toggleShowMaps(app, 'fr_ToggleShowMapsUnselected', 'attrunselpropertymaps'));
  reg('fr_ApplyStress', '', [['StressMesh', null], ['OutPutMesh', true]], applyStress);
  reg('fr_MakeNormalMap', '', [['xExportMesh', null], ['uvProp', null], ['gameProp', null]], makeNormalMap);
  reg('fr_MakeRegionMasks', '', [['xLowResMesh', null], ['uvProp', null], ['gameProp', null]], makeRegionMasks);
  reg('fr_AnimateRegionMasks', '', [['xExportMesh', null], ['gameProp', null], ['Start', null], ['End', null]], animateRegionMasks);
  reg('fr_RemoveTongue', '', [['DeleteMesh', false]], removeTongue);
  void Node;
}
