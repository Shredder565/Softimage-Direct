// Ledger row CMD-B7b. Brief: docs/ghidra/cmd-b7b-syflex-scripts.md, "Wire contract". Original code written from that contract only.
//
// 47 scripting names of the Syflex add-on: 46 script commands (cloth creation, cloth flags and maps, forces,
// collisions, constraints, operator cluster get / set, cache, state) and the C++ command SyCmdSaveCache.
// Every script command takes no argument, works on the selection, changes it and returns nothing.
//
// How this build differs from a Softimage session, and why:
//
//  * The `sy*` operators are not in the install (row CMD-B7b-OPS), so the commands create stand-in operators
//    (syflexScriptsOps.ts) with the parameters and ports the contract names. Nothing simulates; an evaluation logs
//    "not yet attested".
//  * Host commands. The scripts drive SelectObj with wildcard paths, CreateCluster / SIAddToCluster /
//    SIRemoveFromCluster / CreateWeightMap / ApplyOperator / GetPrim / SetKey with argument shapes the bus commands
//    of this build do not take, so those steps are done on the scene directly (syflexScriptsOps.ts). ToggleVisibility,
//    ApplyGenOp, DeactivateAbove, SetSelFilter and SyCmdSaveCache go through the bus.
//  * Selection. Tagged components and selected nodes live side by side: the object that carries the tagged
//    components counts as the sub-component item (`pntSubComponent` / `polySubComponent`).
//  * Script errors. Where the script has no error handling, a failing statement throws (the bus logs it as an
//    error); what the earlier statements made stays in the scene, as it does when a script stops.
//  * The message of the undefined constant IDS_SELECT_SYCLOTH (Q1) is logged as "not yet attested".
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Operator, Cluster } from '../core/scene';
import {
  NOTE, type SubKind, type SyItem, type SyflexScriptsState, SyOperator, isSy, SY_PRESETS, EXTSYFLEX, setLogSink, stateOf,
  logText, logNya, logUndefinedId, scriptError, record, beginCommand, applySyOperator, selItems, selectNodes, selectChildNodes, ownerObject,
  clothNodes, selectCloth, clusterMaps, createCluster, rename, createWeightMap, setValue, setValueQuiet, setKey, createNull,
  setNullDisplay, pointPosition, bboxCentre, positionArray, componentCount, compKindOf,
} from './syflexScriptsOps';

// ------------------------------------------------------------------ shared script helpers
/** The first selected item; an empty selection fails the statement that reads it.   // inferred */
function firstItem(app: App, command: string): SyItem {
  const it = selItems(app)[0]; if (!it) throw scriptError(command, 'the selection is empty');
  return it;
}
/** SelectChildNodes, then the first selected item as the object. */
function objectOfSelection(app: App, command: string): X3DObject {
  const o = selectChildNodes(app)[0]; if (!o) throw scriptError(command, 'the selection is empty');
  return o;
}
/** The object's cloth operator where the script has no error handling: no match is a script error. */
function clothOrError(app: App, command: string, obj: X3DObject | null): Operator {
  const op = selectCloth(app, obj); if (!op) throw scriptError(command, `SelectObj "${obj?.name ?? ''}.*.syCloth*": no such object`);
  return op;
}
/**
 * The start both `syGetCloth` (state.vbs) and `syCreateForce` (force.vbs) share: SelectChildNodes, cloth operator of
 * the first item (message 1002 when the lookup raises), type check (undefined-id message).
 */
function clothWithMessages(app: App, command: string): Operator | null {
  const obj = selectChildNodes(app)[0] ?? null;
  const op = selectCloth(app, obj);
  if (!op) { logText(app, 1002); return null; }
  if (op.type !== 'syCloth') { logUndefinedId(app, command); return null; }
  return op;
}
/** syCreateForce(preset): the preset on the cloth operator, the new operator selected. Callers cannot see a failure. */
function createForce(app: App, command: string, preset: string) {
  const cloth = clothWithMessages(app, command); if (!cloth) return;
  try { selectNodes(app, [applySyOperator(app, command, preset, ownerObject(cloth), [cloth])]); } catch { /* errors are suppressed: the selection stays on the cloth operator */ }
}
const kineOf = (o: X3DObject | null): Node | null => o?.kinematics ?? null;

// ------------------------------------------------------------------ cloth creation (cloth.vbs)
/** Steps shared by cloth / skin / flesh: point cluster "ClothCls" with MassMap and StiffMap. */
function clothCluster(app: App, obj: X3DObject) {
  const cls = createCluster(app, obj, 'pnt', '*'); rename(app, cls, 'ClothCls');
  const mass = createWeightMap(app, cls, 'MassMap'), stiff = createWeightMap(app, cls, 'StiffMap');
  return { cls, mass, stiff };
}
function syCreateCloth(app: App) {
  const C = 'SyCreateCloth'; const obj = objectOfSelection(app, C);
  if (obj.type !== 'polymsh') { logText(app, 1003); return; }
  const { mass, stiff } = clothCluster(app, obj);
  const cloth = applySyOperator(app, C, 'syCloth', obj, [obj, mass, stiff]);
  applySyOperator(app, C, 'syProperties', obj, [cloth]);
  selectNodes(app, [cloth]);
  setValue(app, C, cloth, 'FirstFrame', app.anim.startFrame);   // PlayControl.In
  setKey(app, C, cloth, 'Update', 1, 1);
}
function syCreateSkin(app: App) {
  const C = 'SyCreateSkin'; const objs = selectChildNodes(app); const n = objs.length;
  app.run('ToggleVisibility', { InputObjs: objs });
  const merged = app.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: objs });   // no other argument: acts on the selection
  // Q10: what ApplyGenOp returns. Here it is the merged object; `tolerance` is written where the parameter is found.
  const gen = merged instanceof X3DObject ? merged.primitive?.operators[0] : null;
  const tol = [merged, gen].find((x): x is Node => x instanceof Node && !!x.get('tolerance'));
  if (tol) setValue(app, C, tol, 'tolerance', 0); else logNya(app, C, 'the merge generator of this build has no "tolerance" parameter; the value 0 was not written', 'Q10');
  const obj = ownerObject(merged); if (!obj) throw scriptError(C, 'ApplyGenOp "MeshMerge" returned nothing');
  selectNodes(app, [obj]);
  const { mass, stiff } = clothCluster(app, obj);
  const cloth = applySyOperator(app, C, 'syCloth', obj, [obj, mass, stiff]);
  applySyOperator(app, C, 'syProperties', obj, [cloth]);
  const skin = applySyOperator(app, C, 'syPropertiesSkin', obj, [cloth]);
  setValue(app, C, skin, 'NbLevels', n);
  setValue(app, C, cloth, 'ClothType', 1);
  selectNodes(app, [cloth]);
  setKey(app, C, cloth, 'Update', 1, 1);
}
function syCreateFlesh(app: App) {
  const C = 'SyCreateFlesh'; const obj = objectOfSelection(app, C);
  if (obj.type !== 'polymsh') { logText(app, 1003); return; }
  const { cls, mass, stiff } = clothCluster(app, obj);
  createWeightMap(app, cls, 'WrinkleMap');   // made, but handed to no operator
  const cloth = applySyOperator(app, C, 'syCloth', obj, [obj, mass, stiff]);
  applySyOperator(app, C, 'syProperties', obj, [cloth]);
  applySyOperator(app, C, 'syPropertiesFlesh', obj, [cloth]);
  setValue(app, C, cloth, 'ClothType', 2);
  selectNodes(app, [cloth]);
  setKey(app, C, cloth, 'Update', 1, 1);
}

// ------------------------------------------------------------------ cloth operator flags and maps (cloth.vbs)
/** SelectChildNodes, one SelectObj of the cloth operator (1002 when it raises), one quiet parameter write. */
function clothFlag(app: App, command: string, param: string, value: number) {
  const obj = selectChildNodes(app)[0] ?? null;
  const op = selectCloth(app, obj); if (!op) { logText(app, 1002); return; }
  setValueQuiet(app, command, op, param, value);
}
function selectClothMap(app: App, map: string) {
  const obj = selectChildNodes(app)[0] ?? null;
  const maps = clusterMaps(obj, 'ClothCls', map, true); if (!maps.length) { logText(app, 1002); return; }
  selectNodes(app, maps);
}
function sySaveCache(app: App) {
  const C = 'sySaveCache'; const obj = objectOfSelection(app, C);
  const positions = positionArray(obj); if (!positions) throw scriptError(C, `"${obj.name}" has no geometry to read point positions from`);
  const cloth = clothOrError(app, C, obj);
  const p = cloth.get('Cache'); if (!p) throw scriptError(C, `GetValue: "${cloth.name}" has no parameter "Cache"`);
  app.run('SyCmdSaveCache', { arg0: p.value, arg1: positions });
}
/**
 * SyCmdSaveCache (C++, SPEC-PARTIAL): only the two arguments are known. Nothing is written.
 * // inferred: the file name is arg0 as text followed by the current frame as four digits; the result is a boolean.
 */
function syCmdSaveCache(app: App, a: Record<string, any>): boolean {
  const rows: any[] = Array.isArray(a.arg1) ? a.arg1 : []; const points = Array.isArray(rows[0]) ? rows[0].length : 0;
  const frame = Math.max(0, Math.round(Number(app.anim.frame) || 0));
  const fileName = `${a.arg0 === undefined || a.arg0 === null ? '' : String(a.arg0)}${String(frame).padStart(4, '0')}`;
  stateOf(app).lastSaveCache = { arg0: a.arg0 ?? null, points, fileName, written: false };
  logNya(app, 'SyCmdSaveCache', `the cache file layout, the source of the four-digit number, the open mode and the return value; no file was written (inferred name "${fileName}", ${points} points)`, 'Q3');
  return false;
}

// ------------------------------------------------------------------ forces (force.vbs)
function syCreateSpring(app: App) {
  const C = 'SyCreateSpring'; const items = selItems(app); const it = items[0];
  if (items.length !== 1 || it.type !== 'pntSubComponent' || it.sub!.indices.length !== 2) { logText(app, 1000); return; }
  const [i1, i2] = it.sub!.indices; const a = pointPosition(it.obj!, i1), b = pointPosition(it.obj!, i2);
  if (!a || !b) throw scriptError(C, 'a tagged point has no position');
  const length = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);   // object space
  createForce(app, C, 'sySpring');
  const target = selItems(app)[0]?.node ?? null;   // the new operator, or whatever is first when applying failed
  setValue(app, C, target, 'Length', length); setValue(app, C, target, 'Point1', i1); setValue(app, C, target, 'Point2', i2);
}
function syCreateZipper(app: App) {
  const C = 'SyCreateZipper'; const items = selItems(app); const it = items[0];
  if (items.length !== 1 || it.type !== 'pntSubComponent') { logText(app, 1006); return; }
  const text = it.sub!.indices.map(i => `${i} `).join('');
  createForce(app, C, 'syZipper');
  const target = selItems(app)[0]?.node ?? null;
  setValue(app, C, target, 'Points', text); setValue(app, C, target, 'Reset', 1);
}

// ------------------------------------------------------------------ collisions (collid.vbs)
function syCreateCollideMesh(app: App) {
  const C = 'SyCreateCollideMesh'; const items = selItems(app);
  if (items.length !== 2) { logText(app, 1007); return; }
  const o1 = items[0].obj, o2 = items[1].obj;
  let clothObj: X3DObject | null = null, collider: X3DObject | null = null; let cloth: Operator | null = null;
  const single = (o: X3DObject | null) => { const found = clothNodes(o); return found.length === 1 ? found[0] : null; };   // "exactly one item is selected"
  if ((cloth = single(o1))) { clothObj = o1; collider = o2; } else if ((cloth = single(o2))) { clothObj = o2; collider = o1; }
  if (!cloth || !clothObj) { logText(app, 1007); return; }
  selectNodes(app, [cloth]);
  try {   // errors stay suppressed from here: a failing step is silent
    if (!collider) return;
    const pnts = createCluster(app, clothObj, 'pnt', '*'), pols = createCluster(app, collider, 'poly', '*');
    const op = applySyOperator(app, C, 'syCollide', clothObj, [cloth, pnts, collider, kineOf(collider), pols, kineOf(clothObj)]);
    selectNodes(app, [op]);
    rename(app, pnts, `${op.name}Pnts`); rename(app, pols, `${op.name}Pols`);
  } catch { /* silent */ }
}
function syCreateSelfCollide(app: App) {
  const C = 'SyCreateSelfCollide'; const obj = selectChildNodes(app)[0] ?? null;
  const found = clothNodes(obj);
  if (found.length !== 1) { if (found.length) selectNodes(app, found); logText(app, 1002); return; }
  const cloth = found[0]; selectNodes(app, [cloth]);
  if (cloth.type !== 'syCloth') { logUndefinedId(app, C); return; }
  // Q2: the script calls something named "echo" with the operator's full name; errors are suppressed, nothing is logged here.
  const deactivateAbove = (mute: boolean) => { try { app.run('DeactivateAbove', { Operator: cloth, Mute: mute }); } catch { /* errors are suppressed */ } };
  deactivateAbove(true);
  try {
    const cls = createCluster(app, obj!, 'poly', '*');
    const op = applySyOperator(app, C, 'sySelfCollide', obj, [cloth, obj, cls]);
    selectNodes(app, [op]); rename(app, cls, `${op.name}Cls`); setValueQuiet(app, C, op, 'Reset', 1);
  } catch { /* errors are suppressed */ }
  deactivateAbove(false);
}
function syCreateCollideShape(app: App, command: string, preset: string, icon: number, size: number | null) {
  const items = selItems(app);
  if (items.length !== 1) { logUndefinedId(app, command); return; }
  const obj = items[0].obj; if (!obj) throw scriptError(command, 'the selected item has no 3D object');
  const nul = createNull(app, obj);   // GetPrim "Null" with the selected item as parent
  setNullDisplay(app, command, nul, 'primary_icon', icon);
  if (size !== null) setNullDisplay(app, command, nul, 'size', size);
  const cloth = clothOrError(app, command, obj);   // no check: without a cloth operator the null stays
  const op = applySyOperator(app, command, preset, obj, [cloth, kineOf(nul), kineOf(obj)]);
  rename(app, nul, `${op.name}Pos`);
  selectNodes(app, [op]);
}
/** SyCollideGetMesh / SyPinGetMesh: the operator and the target of one of its input ports, selected together. */
function selectPortMesh(app: App, command: string, type: string, index: number) {
  const it = firstItem(app, command); const op = it.node;
  if (it.type !== type || !isSy(op)) return;   // no message
  const target = op.InputPorts(index)?.target; if (!target) throw scriptError(command, `input port ${index} of "${op.name}" is not connected`);
  selectNodes(app, [op, target]);
}

// ------------------------------------------------------------------ constraints (constr.vbs)
function syCreateNail(app: App) {
  const C = 'SyCreateNail'; const items = selItems(app); const it = items[0];
  if (items.length !== 1 || it.type !== 'pntSubComponent') { logText(app, 1009); return; }
  const obj = it.obj!; const centre = bboxCentre(obj, it.sub!.indices);
  const cls = createCluster(app, obj, 'pnt', it.sub!.indices);
  const nul = createNull(app, obj); selectNodes(app, [nul]);
  // Translate with no target acts on the selection (the new null): relative, local, by the centre of the box
  (['posx', 'posy', 'posz'] as const).forEach((n, k) => setValue(app, C, nul.kinematics.local, n, Number(nul.kinematics.local.val(n)) + centre[k]));
  const cloth = clothOrError(app, C, obj);   // no check: without a cloth operator the cluster and the null stay
  const map = createWeightMap(app, cls, 'Map');
  const op = applySyOperator(app, C, 'syNail', obj, [cloth, cls, kineOf(nul), kineOf(obj), map]);
  rename(app, cls, `${op.name}Cls`); rename(app, nul, `${op.name}Pos`);
  setValue(app, C, op, 'Reset', 1); selectNodes(app, [op]);
}
function syCreatePinLike(app: App, command: string, preset: string) {
  const items = selItems(app);
  if (items.length !== 2) { logText(app, 1010); return; }
  let mesh: SyItem, points: SyItem;
  if (items[0].type === 'polymsh') { mesh = items[0]; points = items[1]; }
  else if (items[1].type === 'polymsh') { mesh = items[1]; points = items[0]; }
  else { logText(app, 1010); return; }
  let cls: Cluster;
  if (points.type === 'pntSubComponent') cls = createCluster(app, points.obj!, 'pnt', points.sub!.indices);
  else if (items[1].type !== 'pnt') { logText(app, 1010); return; }   // the script always tests the second item here
  else if (!(points.node instanceof Cluster)) throw scriptError(command, 'the point cluster could not be read');
  else cls = points.node;
  const target = mesh.obj!;
  selectNodes(app, [cls]); const clothObj = selectChildNodes(app)[0] ?? null;
  const cloth = clothOrError(app, command, clothObj);
  const map = createWeightMap(app, cls, 'Map');
  const op = applySyOperator(app, command, preset, clothObj, [cloth, target, kineOf(target), cls, kineOf(clothObj), map]);
  rename(app, cls, `${op.name}Cls`);
  setValue(app, command, op, 'Reset', 1); selectNodes(app, [op]);
}
function sySetConstraintMap(app: App) {
  const C = 'SySetConstraintMap'; const it = firstItem(app, C);
  setValue(app, C, it.node, 'ModifMap', 1);
}

// ------------------------------------------------------------------ operator clusters (getset.vbs)
interface PortSpec { type: string; port: string; kind: 'pnt' | 'poly' }
const FILTER: Record<string, string> = { pnt: 'Point', poly: 'Polygon' };
function portCluster(command: string, op: SyOperator, spec: PortSpec): Cluster {
  const c = op.Port(spec.port)?.target;
  if (!(c instanceof Cluster) || !c.obj) throw scriptError(command, `port "${spec.port}" of "${op.name}" is not connected to a cluster`);
  return c;
}
function syGet(app: App, command: string, spec: PortSpec) {
  const it = firstItem(app, command); const op = it.node;
  if (it.type !== spec.type || !isSy(op)) { logText(app, 1001, spec.type); return; }
  const cls = portCluster(command, op, spec); const obj = cls.obj!;
  const elements = [...cls.elements].map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < componentCount(obj, spec.kind));
  selectNodes(app, []);
  // Q6: the component text of an empty cluster is a single space; here nothing is added then.   // inferred
  if (elements.length) app.selectComponents(obj, compKindOf(spec.kind), elements);
  try { app.run('SetSelFilter', { SelFilter: FILTER[spec.kind] }); } catch { app.setSelMode(compKindOf(spec.kind)); }
  app.select([op], 'add');
}
function sySet(app: App, command: string, spec: PortSpec) {
  const items = selItems(app); const want: SubKind = spec.kind;
  if (items.length !== 2 || items[1].type !== spec.type || !isSy(items[1].node) || items[0].type !== `${want}SubComponent`) { logText(app, 1008, spec.type); return; }
  const op = items[1].node as SyOperator; const comps = items[0];
  const cls = portCluster(command, op, spec); const obj = cls.obj!;
  if (comps.obj !== obj) throw scriptError(command, `SIAddToCluster: the selected components are not on "${obj.name}"`);
  const before = [...cls.elements]; const next = comps.sub!.indices;
  record(app, 'Replace cluster elements', () => { cls.elements.clear(); for (const i of next) cls.elements.add(i); }, () => { cls.elements.clear(); for (const i of before) cls.elements.add(i); });
  if (app.commands.has('ActivateObjectSelTool')) app.run('ActivateObjectSelTool'); else app.setSelMode('object');
  selectNodes(app, [op]);
  setValue(app, command, op, 'Reset', 1);
}

// ------------------------------------------------------------------ cache operator (cache.vbs)
function syCreateCache(app: App) {
  const C = 'syCreateCache'; const obj = objectOfSelection(app, C);
  if (obj.type !== 'polymsh') { logText(app, 1003); return; }
  const cls = createCluster(app, obj, 'pnt', '*');   // keeps the default point-cluster name ("Point...")
  const m1 = createWeightMap(app, cls, 'Map1'), m2 = createWeightMap(app, cls, 'Map2');
  const op = applySyOperator(app, C, 'syCache', obj, [obj, m1, m2]);
  selectNodes(app, [op]); setKey(app, C, op, 'Update', 1, 1);
}
function syCachePaint(app: App, map: string) {
  const obj = selectChildNodes(app)[0] ?? null;
  const maps = clusterMaps(obj, 'Point', map, false); if (!maps.length) { logText(app, 1004); return; }
  selectNodes(app, maps);   // nothing else: no paint tool is activated
}

// ------------------------------------------------------------------ simulation state (state.vbs)
function syState(app: App, command: string, value: number) {
  const cloth = clothWithMessages(app, command); if (!cloth) return;
  setValue(app, command, cloth, 'SaveState', value);
}

// ------------------------------------------------------------------ registration
type Run = (app: App, a: Record<string, any>) => any;
const nail: PortSpec = { type: 'syNail', port: 'Cluster', kind: 'pnt' }, pin: PortSpec = { type: 'syPin', port: 'Points', kind: 'pnt' }, mimic: PortSpec = { type: 'syMimic', port: 'Points', kind: 'pnt' };
const colPnts: PortSpec = { type: 'syCollide', port: 'CloPnts', kind: 'pnt' }, colPols: PortSpec = { type: 'syCollide', port: 'ColPols', kind: 'poly' }, selfPols: PortSpec = { type: 'sySelfCollide', port: 'Faces', kind: 'poly' };

/** scripting name -> [display name, plugin file, handler]. */
const COMMANDS: Record<string, [string, string, Run]> = {
  // cloth.vbs
  SyCreateCloth: ['Create Cloth', 'cloth.vbs', app => syCreateCloth(app)],
  SyCreateSkin: ['Create Skin', 'cloth.vbs', app => syCreateSkin(app)],
  SyCreateFlesh: ['Create Flesh', 'cloth.vbs', app => syCreateFlesh(app)],
  SyGetSpringMap: ['Get Spring Map', 'cloth.vbs', app => selectClothMap(app, 'StiffMap')],
  SySetSpringMap: ['Set Spring Map', 'cloth.vbs', app => clothFlag(app, 'SySetSpringMap', 'ModifSpringMap', 1)],
  SyGetMassMap: ['Get Mass Map', 'cloth.vbs', app => selectClothMap(app, 'MassMap')],
  SySetMassMap: ['Set Mass Map', 'cloth.vbs', app => clothFlag(app, 'SySetMassMap', 'ModifMassMap', 1)],
  SyClearAllCache: ['Clear All Cache', 'cloth.vbs', app => clothFlag(app, 'SyClearAllCache', 'ClearCache', 2)],
  SyClearCache: ['Clear Cache', 'cloth.vbs', app => clothFlag(app, 'SyClearCache', 'ClearCache', 1)],
  sySaveCache: ['Save Cache', 'cloth.vbs', app => sySaveCache(app)],
  // force.vbs
  SyCreateGravity: ['Add Gravity', 'force.vbs', app => createForce(app, 'SyCreateGravity', 'syGravity')],
  SyCreateDamp: ['Add Damp', 'force.vbs', app => createForce(app, 'SyCreateDamp', 'syDamp')],
  SyCreateAir: ['Add Air', 'force.vbs', app => createForce(app, 'SyCreateAir', 'syAir')],
  SyCreateWind: ['Add Wind', 'force.vbs', app => createForce(app, 'SyCreateWind', 'syWind')],
  SyCreateTurbulence: ['Add Turbulence', 'force.vbs', app => createForce(app, 'SyCreateTurbulence', 'syTurbulence')],
  SyCreateVolume: ['Add Volume', 'force.vbs', app => createForce(app, 'SyCreateVolume', 'syVolume')],
  SyCreateSpring: ['Create Spring', 'force.vbs', app => syCreateSpring(app)],
  SyCreateZipper: ['Create Zipper', 'force.vbs', app => syCreateZipper(app)],
  // collid.vbs
  SyCreateCollideMesh: ['Collide Mesh', 'collid.vbs', app => syCreateCollideMesh(app)],
  SyCreateSelfCollide: ['Self Collide', 'collid.vbs', app => syCreateSelfCollide(app)],
  SyCollideGetMesh: ['Get Collide Mesh', 'collid.vbs', app => selectPortMesh(app, 'SyCollideGetMesh', 'syCollide', 2)],
  SyCreateCollideSph: ['Collide Sph', 'collid.vbs', app => syCreateCollideShape(app, 'SyCreateCollideSph', 'syCollideSph', 2, null)],
  SyCreateCollidePla: ['Collide Pla', 'collid.vbs', app => syCreateCollideShape(app, 'SyCreateCollidePla', 'syCollidePla', 6, 10)],
  // constr.vbs
  SyCreateNail: ['Create Nail', 'constr.vbs', app => syCreateNail(app)],
  SyCreatePin: ['Create Pin', 'constr.vbs', app => syCreatePinLike(app, 'SyCreatePin', 'syPin')],
  SyCreateMimic: ['Create Mimic', 'constr.vbs', app => syCreatePinLike(app, 'SyCreateMimic', 'syMimic')],
  SySetConstraintMap: ['Set Constraint Map', 'constr.vbs', app => sySetConstraintMap(app)],
  // getset.vbs
  SyGetNail: ['Get Nail', 'getset.vbs', app => syGet(app, 'SyGetNail', nail)],
  SySetNail: ['Set Nail', 'getset.vbs', app => sySet(app, 'SySetNail', nail)],
  SyGetPin: ['Get Pin', 'getset.vbs', app => syGet(app, 'SyGetPin', pin)],
  SySetPin: ['Set Pin', 'getset.vbs', app => sySet(app, 'SySetPin', pin)],
  SyGetMimic: ['Get Mimic', 'getset.vbs', app => syGet(app, 'SyGetMimic', mimic)],
  SySetMimic: ['Set Mimic', 'getset.vbs', app => sySet(app, 'SySetMimic', mimic)],
  SyGetCollidePnts: ['Get Cloth Points', 'getset.vbs', app => syGet(app, 'SyGetCollidePnts', colPnts)],
  SySetCollidePnts: ['Set Cloth Points', 'getset.vbs', app => sySet(app, 'SySetCollidePnts', colPnts)],
  SyGetCollidePols: ['Get Collide Polys', 'getset.vbs', app => syGet(app, 'SyGetCollidePols', colPols)],
  SySetCollidePols: ['Set Collide Polys', 'getset.vbs', app => sySet(app, 'SySetCollidePols', colPols)],
  SyGetSelfCollidePols: ['Get Self Polys', 'getset.vbs', app => syGet(app, 'SyGetSelfCollidePols', selfPols)],
  SySetSelfCollidePols: ['Set Self Polys', 'getset.vbs', app => sySet(app, 'SySetSelfCollidePols', selfPols)],
  SyPinGetMesh: ['Get Pin Mesh', 'getset.vbs', app => selectPortMesh(app, 'SyPinGetMesh', 'syPin', 1)],
  // cache.vbs
  syCreateCache: ['Create Cache', 'cache.vbs', app => syCreateCache(app)],
  syCachePaint1: ['Paint Map1', 'cache.vbs', app => syCachePaint(app, 'Map1')],
  syCachePaint2: ['Paint Map2', 'cache.vbs', app => syCachePaint(app, 'Map2')],
  // state.vbs
  syClearState: ['Reset State', 'state.vbs', app => syState(app, 'syClearState', -1)],
  sySetState: ['Set State', 'state.vbs', app => syState(app, 'sySetState', 1)],
  syClearVelocityState: ['Reset Velocities', 'state.vbs', app => syState(app, 'syClearVelocityState', -2)],
};

export function registerSyflexScriptsCommands(app: App) {
  const state: SyflexScriptsState = { note: NOTE, registered: [], replaced: [], evaluations: 0, lastSaveCache: null };
  (app as any).syflexScripts = state;
  (state as any).presets = Object.keys(SY_PRESETS); (state as any).texts = EXTSYFLEX;
  setLogSink(app);
  const reg = (def: CommandDef) => { if (app.commands.has(def.name)) state.replaced.push(def.name); app.register(def); state.registered.push(def.name); };
  for (const [name, [label, file, run]] of Object.entries(COMMANDS)) {
    reg({
      name, label, category: 'Custom', description: `Syflex add-on script command (${file})`, args: [],
      // a procedure without a result: the value handed back is empty
      execute(app, a) { beginCommand(); run(app, a); return undefined; },
    });
  }
  reg({
    name: 'SyCmdSaveCache', label: 'Cmd Save Cache', category: 'Custom', description: 'Syflex add-on command (syCmd.64.dll)',
    args: [{ name: 'arg0', default: null }, { name: 'arg1', default: null }], undoable: false,
    execute: (app, a) => syCmdSaveCache(app, a),
  });
}
