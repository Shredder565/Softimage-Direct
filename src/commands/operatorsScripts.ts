// Ledger row CMD-B6d. Brief: docs/ghidra/cmd-b6d-operators-scripts.md, "Wire contract". Original code written from that contract only.
//
// 19 scripting names Softimage ships as VBScript procedures that apply operators: AddEdge, SplitPolygon,
// InsertCurveKnot, DuplicateMeshComponent, MeshSubdivideWithCenter, DuplicateUsingGeomApprox, TrimWith, Convert,
// CreateClusterCenter, CreateClusterCenterWithNull, CreateNonOverlappingCluster, CreateSimulationBracket,
// ApplyDeformBySpine, ApplySpringOp, InspectSpringPropertiesProc, BurnAndDeleteGATOROperator,
// ChangeVertexColorDatatype, SetSymmetrizePolygonOpRefPlane, SetRefPlaneFromSymmetrizePolygonOp.
// (The cluster, simulation, spring, GATOR, vertex colour and symmetrize commands are in operatorsScriptsMore.ts.)
//
// How this build differs from a Softimage session, and why:
//
//  * One command per scripting name. Where the registry has several entries, the scripted entry is registered and
//    the key-assignable UI entries are functions: `app.operatorsScripts.ui.<name>(args)`.
//  * Output and in/out arguments. The bus passes arguments by value, so their final values are kept in
//    `app.operatorsScripts.outputs[<command>]` (a collection passed as an array is also updated in place).
//  * Delegated C++ commands that are not on the bus (GetConnectionSet, ApplyOperator, SIConvert, siTrimWith, ...).
//    Each is called when another row has registered it; otherwise a documented, inferred stand-in runs
//    (operatorsScriptsOps.ts) or the step logs "not yet attested".
//  * AutoInspect <objects>. The bus command of that name is this build's preference toggle, so inspection is done
//    here: when auto-inspect is on, the first object is sent to the property editor.
//  * Picking and message boxes need a user session; with `app.Interactive === false` a pick counts as cancelled and
//    a message box is the log line "<title>: <prompt>".
//  * Log severities. Warnings are logged as info with the prefix "WARNING : ".
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Operator, Primitive, Property, construction, REGIONS, makeTopologyOperator, makeDisplay, makeGeomApprox } from '../core/scene';
import { siMsgBox } from '../ui/msgBox';
import { siString } from '../ui/si';
import { FrozenGeomOperator } from './model';
import { isGenerator, genOwner } from './optasksB12eShared';
import { siConst, unset, copyProperty } from './viewEditPropertyHelpers';
import { startPickSession, interactive } from './miscDsScriptsPick';
import {
  type CsItem, collectionItems, connectionGroups, groupsText, compSelOf, ownerObject, meshOf, outConnections,
  AddEdgeOp, SplitPolygonOp, InsertCrvKnotOp, MeshSubdivideWithCenterOp,
} from './operatorsScriptsOps';
import { registerOperatorsScriptsMore } from './operatorsScriptsMore';

export const NOTE = 'docs/ghidra/cmd-b6d-operators-scripts.md';

// ------------------------------------------------------------------ translated texts (dictionary XSISCRIPTS)
const XSISCRIPTS_TEXT: Record<number, string> = {
  1092: 'Please tag some points or select a cluster first.',
  1094: 'Select Curve To Trim With',   // inferred: id 1094 is not decoded (Q2); worded after 1095
  1095: 'Deselect Curve To Trim With',
};
export const opsText = (id: number): string => siString('XSISCRIPTS', id) ?? XSISCRIPTS_TEXT[id] ?? '';

// ------------------------------------------------------------------ session state
export interface OperatorsScriptsState {
  /** Key-assignable UI entries of the scripting names that have several registry entries. */
  ui: Record<string, (args?: Record<string, any>) => any>;
  /** Final values of the output / in-out arguments of the last run of each command. */
  outputs: Record<string, Record<string, any>>;
  /** Preferences the scripts read that have no store in this build.   // inferred defaults */
  prefs: { duplicate: Record<string, number> };
  /** Reference planes ("RefPlanes.<name>") by name, created on first use.   // inferred */
  refPlanes: Map<string, Property>;
  currentReferencePlane: string | null;
  /** The low-level trim call TrimWith built last. */
  lastTrimWith: { InputObjs: string; TrimWithCrvIndexArray: number[]; TrimWithGlobalToLocalBool: boolean; applied: boolean } | null;
  /** Operators hanging on a node that has no geometry stack here (null, ICE property, kinematic state). */
  outConnections(target: object): Operator[];
}
export const stateOf = (app: App): OperatorsScriptsState => (app as any).operatorsScripts;

// ------------------------------------------------------------------ small helpers
export const logNya = (app: App, command: string, what: string, question = '') => app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
export const logWarning = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);
export class Cancelled extends Error {
  readonly siErrCancelled = true;
  constructor(command: string) { super(`${command} cancelled (siErrCancelled)`); this.name = 'siErrCancelled'; }
}
/** Run a delegated command of another row when it is on the bus. */
export function delegate(app: App, name: string, args: Record<string, any>): { done: boolean; result?: any } {
  if (!app.commands.has(name)) return { done: false };
  const result = app.run(name, args);
  if (result && typeof result === 'object' && (result as any).command === name && 'args' in result) return { done: false };   // placeholder stub
  return { done: true, result };
}
/** SIMsgBox: a message box in a user session, the log line "<title>: <prompt>" otherwise. */
export function scriptMsgBox(app: App, prompt: string, title: string) {
  if (interactive(app)) { try { siMsgBox(prompt, title); return; } catch { /* no window: fall through to the log */ } }
  app.logMsg('info', `${title}: ${prompt}`);
}
/** AutoInspect <objects>. */
let uiAutoInspect: boolean | null = null;
export function autoInspect(app: App, nodes: any[]) { const n = nodes.find(x => x instanceof Node); if ((uiAutoInspect ?? app.autoInspect) && n) app.events.emit('inspect', n); }
/**
 * Run a UI entry. It is called outside the bus, so the commands it delegates to would each be a top-level command
 * and the bus would auto-inspect what they return; only the script's own AutoInspect calls may open the editor.
 */
export function asUi<T>(app: App, f: () => T): T {
  const real = app.autoInspect; app.autoInspect = false; uiAutoInspect = real;
  try { return f(); } finally { app.autoInspect = real; uiAutoInspect = null; }
}
export const setOut = (app: App, command: string, values: Record<string, any>) => { stateOf(app).outputs[command] = { ...values }; };
export function setOp(app: App, command: string, op: Node, name: string, value: any) {
  const p = op.get(name);
  if (p) app.setParam(p, value); else logNya(app, command, `${op.name} has no "${name}" parameter in this build; the value ${String(value)} was not written`);
}

// siOperationMode / siGeneratorInputsDisposalMode / siConstructionMode. inferred numeric values: the public SDK enums.
const IMMEDIATE = 'siImmediateOperation', PERSISTENT = 'siPersistentOperation';
const isImmediate = (v: any) => { const c = siConst(v); return c === IMMEDIATE || c === 1; };
// siGenOpInputsDisposalMode: 0 keep, 1 delete, 2 hide (GetGeneratorInputsForDisposal, cmd-b12e batch-13 addendum Q23).
// The modeling.geninputmgt preference numbers them differently: 0 keep, 1 hide, 2 delete (C3DPrefsModeling SPDL items).
const DISPOSAL = ['siKeepGenOpInputs', 'siDeleteGenOpInputs', 'siHideGenOpInputs'];
const DEL = 1, HIDE = 2;
const PREF_TO_DISPOSAL = [0, HIDE, DEL];
const disposalOf = (v: any): number => { const c = siConst(v); return typeof c === 'number' ? c : Math.max(0, DISPOSAL.indexOf(String(c))); };
const MODES: Record<string, typeof REGIONS[number] | null> = { siConstructionModeModeling: 'modeling', siConstructionModePrimaryShape: 'shape', siConstructionModeAnimation: 'animation', siConstructionModeSecondaryShape: 'secondaryshape', siConstructionModeDefault: null };
/** The construction region a ConstructionMode argument names; null = default / not given. */
export function constructionModeOf(v: any): typeof REGIONS[number] | null {
  const c = siConst(v); if (c === null) return null;
  if (typeof c === 'number') return REGIONS[c] ?? null;
  return MODES[c] ?? ((REGIONS as readonly string[]).includes(c.toLowerCase()) ? c.toLowerCase() as any : null);
}
export function setConstructionMode(app: App, mode: typeof REGIONS[number]) { if (construction.mode !== mode) { construction.mode = mode; app.events.emit('module'); } }
/** GetUserPref "OperationMode": the Immed flag of the MCP. */
const prefImmediate = (app: App) => !!(app as any).immediate;
const setPrefImmediate = (app: App, v: boolean) => { (app as any).immediate = v; app.events.emit('selection'); };

/** FreezeModeling <operators>, , siUnspecified: the bus command addresses the owning objects. */
function freezeOperators(app: App, ops: Operator[]) {
  const owners: X3DObject[] = [];
  for (const op of ops) { const o = ownerObject(op); if (o && o.primitive?.operators.includes(op) && !owners.includes(o)) owners.push(o); }
  if (owners.length) app.run('FreezeModeling', { InputObjs: owners });
}

// ------------------------------------------------------------------ topology apply helper
interface TopoResult { ops: Operator[]; text: string }
/** Items of one object -> the operator the preset creates on it (stand-in for ApplyOperator).   // inferred */
function topoOperator(preset: string, obj: X3DObject, items: CsItem[]): Operator | null {
  const subs = items.map(i => i.sub).filter((s): s is NonNullable<CsItem['sub']> => !!s);
  if (preset === 'InsertNurbsCrvKnot') return obj.primitive?.curve() ? new InsertCrvKnotOp() : null;
  if (!meshOf(obj)) return null;
  if (preset === 'AddEdge') {
    const points = subs.filter(s => s.kind === 'pnt').flatMap(s => s.indices), edges = subs.filter(s => s.kind === 'edge').flatMap(s => s.edges);
    return points.length || edges.length ? new AddEdgeOp(points, edges) : null;
  }
  if (preset === 'SplitPolygon') { const polys = subs.filter(s => s.kind === 'poly').flatMap(s => s.indices); return polys.length ? new SplitPolygonOp(polys) : null; }
  if (preset === 'ExtrudeComponentAxis') return subs.length ? makeTopologyOperator('Extrude Along Axis', compSelOf(subs[0])) : null;
  return null;
}
/**
 * The script's topology apply helper in the configuration all four commands use (persistent, auto-inspect disabled).
 * GetConnectionSet / ApplyOperator are not on the bus: the connection set is read here (an empty one is the
 * selection) and one operator is made per object named in it.   // inferred
 * The six operator class ids that make the helper clear the selection are not matched to presets (Q6): no clearing.
 */
function applyTopo(app: App, command: string, preset: string, connectionSet: any, isInteractive: boolean): TopoResult {
  if ((app as any).constructionAutoUpdate) setConstructionMode(app, 'modeling');   // preferences.modeling.constructionmodeautoupdate
  const groups = connectionGroups(app, connectionSet);
  const byObj = new Map<X3DObject, CsItem[]>();
  for (const it of groups.flat()) { const o = it.obj; if (!o) continue; if (!byObj.has(o)) byObj.set(o, []); byObj.get(o)!.push(it); }
  const ops: Operator[] = [];
  for (const [obj, items] of byObj) {
    const op = topoOperator(preset, obj, items); if (!op) continue;
    const prim = obj.primitive!;
    app.record(preset, () => prim.addOperator(op), () => prim.removeOperator(op));
    ops.push(op);
  }
  if (!ops.length) {
    if (isInteractive) logNya(app, command, 'picking the missing inputs is the connection-set command\'s; the pick is treated as cancelled', 'Q9');
    // inferred: the script has no guard, the statement after an empty connection set fails
    throw new Error(`${command}: the connection set for the ${preset} operator could not be resolved`);
  }
  return { ops, text: groupsText(groups) };
}
const evaluate = (op: Operator) => { ownerObject(op)?.primitive?.geom(); };

interface TopoSpec { command: string; preset: string; inspect: boolean; write(app: App, op: Operator, a: Record<string, any>): void; read?(ops: Operator[], out: Record<string, any>): void }
/** Shape shared by AddEdge / SplitPolygon / InsertCurveKnot / DuplicateMeshComponent (scripted and UI entries). */
function topoCommand(app: App, spec: TopoSpec, a: Record<string, any>, ui: boolean, inspectUi = spec.inspect): Operator[] | undefined {
  const out: Record<string, any> = {};
  spec.read?.([], out);   // outputs preset to -1
  const immediate = ui ? prefImmediate(app) : isImmediate(a.ImmediateMode);   // UI entries ignore the argument
  let done: TopoResult;
  try { done = applyTopo(app, spec.command, spec.preset, a.ConnectionSet, ui); }
  finally { setOut(app, spec.command, { ...out, ConnectionSet: a.ConnectionSet ?? '', ImmediateMode: immediate ? IMMEDIATE : PERSISTENT }); }
  for (const op of done.ops) spec.write(app, op, a);
  spec.read?.(done.ops, out);
  setOut(app, spec.command, { ...out, ConnectionSet: ui ? done.text : a.ConnectionSet ?? '', ImmediateMode: immediate ? IMMEDIATE : PERSISTENT });
  if (ui && inspectUi) autoInspect(app, done.ops);
  if (immediate) freezeOperators(app, done.ops);
  return !ui && immediate ? undefined : done.ops;
}

const ADD_EDGE: TopoSpec = {
  command: 'AddEdge', preset: 'AddEdge', inspect: true,
  write: (app, op, a) => setOp(app, 'AddEdge', op, 'ratioedge', Number(a.Ratio) || 0),
  read: (ops, out) => {
    out.NewPointID = -1; out.NewEdgeID = -1;
    if (ops.length === 1) { evaluate(ops[0]); out.NewPointID = Number(ops[0].val('newptid')); out.NewEdgeID = Number(ops[0].val('newedgeid')); }
  },
};
const SPLIT_TYPES = ['siByTheVertices', 'siByTheEdgesMidPoints', 'siCross'];   // inferred names / values: C3DSplitPolygonOp.spdl items 0, 1, 2 (Q8)
const splitTypeOf = (v: any): number => { const c = siConst(v); return typeof c === 'number' ? c : Math.max(0, SPLIT_TYPES.indexOf(String(c))); };
const SPLIT_POLYGON: TopoSpec = {
  command: 'SplitPolygon', preset: 'SplitPolygon', inspect: true,
  write: (app, op, a) => {
    setOp(app, 'SplitPolygon', op, 'tanx', Number(a.TanX) || 0); setOp(app, 'SplitPolygon', op, 'tany', Number(a.TanY) || 0); setOp(app, 'SplitPolygon', op, 'tanz', Number(a.TanZ) || 0);
    setOp(app, 'SplitPolygon', op, 'splittype', splitTypeOf(a.SplitPolygonType));
  },
  read: (ops, out) => { out.NewPointID = -1; if (ops.length === 1) { evaluate(ops[0]); out.NewPointID = Number(ops[0].val('newptid')); } },
};
const INSERT_KNOT: TopoSpec = {
  command: 'InsertCurveKnot', preset: 'InsertNurbsCrvKnot', inspect: false,   // neither entry inspects
  write: (app, op, a) => setOp(app, 'InsertCurveKnot', op, 'Multiplicity', Number(a.Multiplicity) || 1),
};
const EXTRUDE_ORDER: [string, string][] = [['subdivs', 'NbSubdivs'], ['length', 'Length'], ['merge', 'Merge'], ['sx', 'Sx'], ['sy', 'Sy'], ['sz', 'Sz'], ['rx', 'Rx'], ['ry', 'Ry'], ['rz', 'Rz'], ['tx', 'Tx'], ['ty', 'Ty'], ['tz', 'Tz'], ['duplicate', 'DuplicatePolygons']];
const boolish = (v: any) => typeof v === 'string' ? /^(true|1)$/i.test(v.trim()) : !!v;
const DUPLICATE: TopoSpec = {
  command: 'DuplicateMeshComponent', preset: 'ExtrudeComponentAxis', inspect: false,
  write: (app, op, a) => { for (const [param, arg] of EXTRUDE_ORDER) setOp(app, 'DuplicateMeshComponent', op, param, param === 'merge' || param === 'duplicate' ? boolish(a[arg]) : Number(a[arg]) || 0); },
};
const TRANSFORM_ARGS = ['Sx', 'Sy', 'Sz', 'Rx', 'Ry', 'Rz', 'Tx', 'Ty', 'Tz'];
/** The two UI entries of DuplicateMeshComponent ("Multiple" inspects, "Single" does not). */
function duplicateUi(app: App, args: Record<string, any>, multiple: boolean): Operator[] | undefined {
  const a: Record<string, any> = multiple
    ? { ConnectionSet: '', ImmediateMode: PERSISTENT, Length: 1, NbSubdivs: 5, Merge: true, Tx: 0, Ty: 0, Tz: 0, Rx: 0, Ry: 0, Rz: 0, Sx: 0, Sy: 0, Sz: 0, DuplicatePolygons: false, ...args }
    : { ConnectionSet: '', ImmediateMode: PERSISTENT, Length: 0, NbSubdivs: 0, Merge: true, Tx: 0, Ty: 0, Tz: 0, Rx: 0, Ry: 0, Rz: 0, Sx: 1, Sy: 1, Sz: 1, DuplicatePolygons: false, ...args };
  const pref = stateOf(app).prefs.duplicate;
  if (!(Number(a.NbSubdivs) || 0)) Object.assign(a, { Sx: 1, Sy: 1, Sz: 1, Rx: 0, Ry: 0, Rz: 0, Tx: 0, Ty: 0, Tz: 0 });
  else for (const k of TRANSFORM_ARGS) a[k] = pref[k.toLowerCase()];   // Preferences.Duplicate.Transform.*
  const polygonsPref = Number(pref.polygons) === 0;                    // Preferences.Duplicate.polygons = 0
  if (multiple || !boolish(a.DuplicatePolygons)) a.DuplicatePolygons = polygonsPref;
  const ops = topoCommand(app, DUPLICATE, a, true, multiple);
  const o = stateOf(app).outputs.DuplicateMeshComponent;
  for (const k of [...TRANSFORM_ARGS, 'DuplicatePolygons']) o[k] = a[k];   // written back to the caller by both procedures
  return ops;
}

// ------------------------------------------------------------------ generator apply helper
interface GenResult { ops: Operator[]; objects: X3DObject[]; text: string; immediate: boolean; all: Operator[] }
const GEN_PRESET = 'MeshSubdivideWithCenter';
function freezeGenerated(app: App, o: X3DObject) {
  const prim = o.primitive; const mesh = prim?.mesh(); if (!prim || !mesh) return;
  const old = [...prim.operators]; const frozen = new FrozenGeomOperator(mesh); frozen.region = 'modeling';
  app.record('Freeze', () => { prim.operators.splice(0, prim.operators.length, frozen); frozen.parent = prim; prim.dirty = true; }, () => { prim.operators.splice(0, prim.operators.length, ...old); prim.dirty = true; });
}
/**
 * The script's generator apply helper. Stand-ins: the connection set is read here, the generated object is a new
 * polygon mesh under the scene root named "polymsh", the inputs to dispose of are the inputs themselves.   // inferred
 */
function applyGen(app: App, command: string, preset: string, connectionSet: any, immediate: boolean, disposal: number, isInteractive: boolean, autoTranslate: boolean): GenResult | null {
  const presetName = String(preset ?? '').replace(/^.*[\\/]/, '').replace(/\.preset$/i, '');
  const groups = connectionGroups(app, connectionSet);
  const inputs = groups.flat().map(i => i.node).filter((n): n is X3DObject => n instanceof X3DObject && n.primitive?.type === 'polymsh' && !!meshOf(n));
  if (!inputs.length) { if (isInteractive) logNya(app, command, 'picking the generator inputs is the connection-set command\'s; nothing was applied', 'Q9'); return null; }
  if (presetName !== GEN_PRESET) { logNya(app, command, `generator preset "${presetName}"; only ${GEN_PRESET} is applied by this row`, 'Q9'); return null; }
  const ops: Operator[] = [], objects: X3DObject[] = [];
  for (const input of inputs) {
    const gen = new MeshSubdivideWithCenterOp(input);
    const obj = new X3DObject(app.scene.uniqueName('polymsh'), 'polymsh'); const prim = new Primitive('Polygon Mesh', 'polymsh');
    prim.addOperator(gen); obj.setPrimitive(prim); obj.addProperty(makeDisplay()); obj.addProperty(makeGeomApprox());
    const root = app.scene.root; app.record('Add ' + obj.name, () => root.addChild(obj), () => root.removeChild(obj));
    ops.push(gen); objects.push(obj);
  }
  if (!immediate && disposal === DEL) { logWarning(app, 'siPersistentOperation ignored with siDeleteGenOpInputs, switching to siImmediateOperation'); immediate = true; }
  const dispose = disposal === DEL || disposal === HIDE ? [...inputs] : [];   // GetGeneratorInputsForDisposal, before any freeze
  let live = ops;
  if (immediate) {
    autoInspect(app, ops);
    for (const o of objects) freezeGenerated(app, o);
    live = ops.filter(op => (op.parent as any)?.operators?.includes(op));
  }
  if (autoTranslate) objects.forEach((o, i) => {
    const l = inputs[i].kinematics.local; const d = ['posx', 'posy', 'posz'].map(n => Number(l.val(n)) || 0);
    if (d.some(v => v !== 0)) app.run('Translate', { InputObj: [o], X: d[0], Y: d[1], Z: d[2], Mode: 'siRelative' });   // Translate <output>, dx, dy, dz, 0
  });
  if (disposal === DEL) app.run('DeleteObj', { InputObj: dispose });
  else if (disposal === HIDE) app.run('HideAndUnselect', { Target: dispose });
  return { ops: live, objects, text: groupsText([inputs.map(o => ({ raw: o, text: o.fullName, node: o, obj: o, sub: null }))]), immediate, all: ops };
}
/** A property an object uses: its own, else the nearest ancestor's. */
function inherited(o: X3DObject, type: string): Property | undefined {
  for (let n: X3DObject | null = o; n; n = n.parentObj) { const p = n.properties.find(x => x.type === type); if (p) return p; }
  return undefined;
}

// ================================================================== registration
export function registerOperatorsScriptsCommands(app: App) {
  const state: OperatorsScriptsState = {
    ui: {}, outputs: {},
    // inferred: the Duplicate Multiple options (Preferences.Duplicate) have no store here; identity transform, polygons 0
    prefs: { duplicate: { sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, tz: 0, polygons: 0 } },
    refPlanes: new Map(), currentReferencePlane: null, lastTrimWith: null, outConnections,
  };
  (app as any).operatorsScripts = state;
  const reg = (def: CommandDef) => app.register(def);
  const MODE_ARG = { name: 'ImmediateMode', default: ':siPersistentOperation:siOperationMode' };

  // ---------------------------------------------------------------- AddEdge
  reg({
    name: 'AddEdge', label: 'Add Edge', category: 'Modeling|Topology', description: 'Inserts a vertex on an edge / connects it to a point with the AddEdge operator',
    args: [{ name: 'ConnectionSet', default: null }, { name: 'Ratio', default: 0 }, MODE_ARG, { name: 'NewPointID', default: 0 }, { name: 'NewEdgeID', default: 0 }],
    execute: (app, a) => topoCommand(app, ADD_EDGE, a, false),
  });
  state.ui.AddEdge = (args = {}) => asUi(app, () => topoCommand(app, ADD_EDGE, { ConnectionSet: '', Ratio: 0, ...args }, true));

  // ---------------------------------------------------------------- SplitPolygon
  reg({
    name: 'SplitPolygon', label: 'Split Polygon', category: 'Modeling|Topology', description: 'Splits polygons around a new point with the SplitPolygon operator',
    args: [{ name: 'ConnectionSet', default: null }, { name: 'TanX', default: 0 }, { name: 'TanY', default: 0 }, { name: 'TanZ', default: 0 }, { name: 'SplitPolygonType', default: ':siByTheVertices:siSplitPolygonType' }, MODE_ARG, { name: 'NewPointID', default: 0 }],
    execute: (app, a) => topoCommand(app, SPLIT_POLYGON, a, false),
  });
  state.ui.SplitPolygon = (args = {}) => asUi(app, () => topoCommand(app, SPLIT_POLYGON, { ConnectionSet: '', TanX: 0, TanY: 0, TanZ: 0, SplitPolygonType: ':siByTheVertices:siSplitPolygonType', ...args }, true));

  // ---------------------------------------------------------------- InsertCurveKnot
  reg({
    name: 'InsertCurveKnot', label: 'Insert Curve Knot', category: 'Modeling|Topology', description: 'Inserts a knot on a curve with the InsertNurbsCrvKnot operator',
    args: [{ name: 'ConnectionSet', default: null }, { name: 'Multiplicity', default: 1 }, MODE_ARG],
    execute: (app, a) => topoCommand(app, INSERT_KNOT, a, false),
  });
  state.ui.InsertCurveKnot = (args = {}) => asUi(app, () => topoCommand(app, INSERT_KNOT, { ConnectionSet: '', Multiplicity: 3, ...args }, true));

  // ---------------------------------------------------------------- DuplicateMeshComponent
  reg({
    name: 'DuplicateMeshComponent', label: 'Duplicate Mesh Component', category: 'Modeling|Topology', description: 'Duplicates / extrudes polygon mesh components with the ExtrudeComponentAxis operator',
    args: [{ name: 'ConnectionSet', default: null }, MODE_ARG, { name: 'Length', default: 0 }, { name: 'NbSubdivs', default: 0 }, { name: 'Merge', default: true },
      { name: 'Tx', default: 0 }, { name: 'Ty', default: 0 }, { name: 'Tz', default: 0 }, { name: 'Rx', default: 0 }, { name: 'Ry', default: 0 }, { name: 'Rz', default: 0 },
      { name: 'Sx', default: 1 }, { name: 'Sy', default: 1 }, { name: 'Sz', default: 1 }, { name: 'DuplicatePolygons', default: false }],
    execute: (app, a) => topoCommand(app, DUPLICATE, a, false),
  });
  state.ui.DuplicateMeshComponentMultiple = (args = {}) => asUi(app, () => duplicateUi(app, args, true));
  state.ui.DuplicateMeshComponentSingle = (args = {}) => asUi(app, () => duplicateUi(app, args, false));

  // ---------------------------------------------------------------- MeshSubdivideWithCenter
  reg({
    name: 'MeshSubdivideWithCenter', label: 'PolyMesh Subdivide With Center', category: 'Modeling', description: 'Generates a subdivided copy of a polygon mesh at the place of its input',
    args: [{ name: 'PresetObj', default: 'MeshSubdivideWithCenter' }, { name: 'ConnectionSet', default: '' }, { name: 'ConnectType', default: 3 }, MODE_ARG, { name: 'GenOpInputsDisposal', default: ':siKeepGenOpInputs:siGeneratorInputsDisposalMode' }],
    execute(app, a) {
      let immediate = prefImmediate(app);                                   // the ImmediateMode argument is ignored
      let disposal = 0; let prefChanged = false;                            // so is GenOpInputsDisposal
      if (!app.run('AutoInspectEnabled')) {
        disposal = PREF_TO_DISPOSAL[Math.max(0, Math.min(2, Number((app as any).genInputMgt ?? 0) || 0))];   // modeling.geninputmgt (0 keep, 1 hide, 2 delete)
        if (disposal === DEL && !immediate) { immediate = true; setPrefImmediate(app, true); prefChanged = true; }
      }
      let r: GenResult | null = null;
      try {
        r = applyGen(app, 'MeshSubdivideWithCenter', a.PresetObj, a.ConnectionSet, immediate, disposal, true, true);
        setOut(app, 'MeshSubdivideWithCenter', { ConnectionSet: r?.text ?? '', ImmediateMode: immediate ? IMMEDIATE : PERSISTENT, GenOpInputsDisposal: DISPOSAL[disposal] });
        if (r?.objects.length) app.run('SelectObj', { InputObjs: r.objects });
        if (r?.ops.length && !immediate) autoInspect(app, r.ops);
      } finally { if (prefChanged) setPrefImmediate(app, false); }
      return undefined;
    },
  });

  // ---------------------------------------------------------------- DuplicateUsingGeomApprox
  reg({
    name: 'DuplicateUsingGeomApprox', label: 'Duplicate Using Geometry Approximation', category: 'Edit', description: 'Duplicates the selected object based on the subdivided geometry (poly meshes)',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const meshes = collectionItems(app, a.InputObjs).map(i => i.node).filter((n): n is X3DObject => n instanceof X3DObject && n.primitive?.type === 'polymsh');
      if (!meshes.length) { app.logMsg('info', 'You need to select one or more polygon meshes first.'); return undefined; }
      const result: X3DObject[] = [];
      for (const o of meshes) {
        const level = Number(inherited(o, 'geomapprox')?.val('gapproxmosl')) || 0;
        if (level <= 0) {
          // Duplicate <obj>, , 2, 1, 1, 0, 0, 1, 0, 1: the bus Duplicate takes the object and the copy count only
          const copies = app.run('Duplicate', { InputObjs: [o], NbCopies: 1 });
          for (const c of (Array.isArray(copies) ? copies : [copies]).filter((x: any): x is X3DObject => x instanceof X3DObject)) { app.run('FreezeObj', { InputObjs: [c] }); result.push(c); }
          continue;
        }
        const r = applyGen(app, 'DuplicateUsingGeomApprox', GEN_PRESET, [o], false, 0, false, true);
        const op = r?.ops[0], made = r?.objects[0]; if (!op || !made) continue;
        const prim = o.primitive!;
        if (prim.get('subdrule')) setOp(app, 'DuplicateUsingGeomApprox', op, 'SubdivisionRule', Number(prim.val('subdrule')) || 0);
        setOp(app, 'DuplicateUsingGeomApprox', op, 'SubdivisionDepth', level);
        if (prim.get('subdloop')) setOp(app, 'DuplicateUsingGeomApprox', op, 'useloop', !!prim.val('subdloop'));
        // TransferAllPropertiesAcrossGenOp <op>, <new object>, , True
        // CMD-B16e: the real command needs a generator with an input list; this build's subdivision operator has none
        const asGen = isGenerator(op) && genOwner(op) === made;
        if (!asGen || !delegate(app, 'TransferAllPropertiesAcrossGenOp', { Operator: op, Object: made, PropertyTransferType: '', ShareProperty: true }).done) {
          // inferred stand-in: the material and the object's own properties the new object lacks are copied
          const mat = o.material; if (mat) app.record('Transfer material', () => made.setMaterial(mat), () => made.setMaterial(null));
          for (const p of o.properties) if (p.type !== 'visibility' && !made.properties.some(q => q.type === p.type && q.name === p.name)) { const np = copyProperty(p); app.record('Transfer ' + p.name, () => { made.addProperty(np); }, () => made.removeProperty(np)); }
          logNya(app, 'DuplicateUsingGeomApprox', 'the property transfer across the generator is a C++ command; material and object properties were copied, cluster properties were not', 'Q9');
        }
        freezeGenerated(app, made);
        result.push(app.scene.find(made.name) ?? made);   // looked up again by name after the freeze
      }
      app.run('SelectObj', { InputObjs: result });
      return result;
    },
  });

  // ---------------------------------------------------------------- TrimWith
  reg({
    name: 'TrimWith', label: 'Trim With', category: 'Modeling', description: 'Chooses the surface curves a trim uses, by picking or from a list',
    args: [{ name: 'InputObjs', default: null }, { name: 'TrimWithSrfCrv', default: null }],
    execute(app, a) {
      const cmd = 'TrimWith';
      // The items that own a trimwithmode parameter (inferred: the trim operators, Q7). 0 = none, 2 = the given curves.
      const items = collectionItems(app, a.InputObjs, false);
      const modeParam = (it: CsItem) => it.node?.get('trimwithmode') ?? null;
      const missing = items.filter(it => !modeParam(it));
      if (missing.length || !items.length) logNya(app, cmd, `${items.length ? missing.map(i => i.text).join(', ') + ' has' : 'no input item, so nothing has'} a trimwithmode parameter; the mode is not written there`, 'Q7');
      const setMode = (it: CsItem, v: number) => { const p = modeParam(it); if (p) app.setParam(p, v); };
      const inputText = items.map(i => i.text).join(',');
      const isCurveList = (v: any) => !unset(v) && !(Array.isArray(v) && !v.length);
      const finish = (curves: any) => {
        const list: any[] = !isCurveList(curves) ? [] : Array.isArray(curves) ? curves : String(curves).split(/,(?![^\[]*\])/).map(s => s.trim()).filter(Boolean);
        const text = list.map(x => typeof x === 'string' ? x : x?.text ?? x?.fullName ?? String(x)).join(',');
        // sub-element indices of every srfcrvSubComponent item, in list order.   // inferred text form: "<surface>.srfcrv[i,j]"
        const indices: number[] = [];
        for (const x of list) {
          if (x && typeof x === 'object' && x.type === 'srfcrvSubComponent' && Array.isArray(x.indices)) { indices.push(...x.indices.map(Number)); continue; }
          const m = typeof x === 'string' ? /\.srfcrv\[([^\]]*)\]$/.exec(x) : null;
          if (m) for (const part of m[1].split(',').map(s => s.trim()).filter(Boolean)) { const rg = /^(\d+)\s*-\s*(\d+)$/.exec(part); if (rg) for (let i = Number(rg[1]); i <= Number(rg[2]); i++) indices.push(i); else if (/^\d+$/.test(part)) indices.push(Number(part)); }
        }
        setOut(app, cmd, { InputObjs: inputText, TrimWithSrfCrv: text });
        if (indices.length) {
          const call = { InputObjs: inputText, TrimWithCrvIndexArray: indices, TrimWithGlobalToLocalBool: true };
          const done = delegate(app, 'SITrimWith', call).done || delegate(app, 'siTrimWith', call).done;
          state.lastTrimWith = { ...call, applied: done };
          if (!done) logNya(app, cmd, `the low-level trim command is not available; SITrimWith "${inputText}", [${indices.join(',')}], True was not applied`, 'Q7');
          for (const it of items) setMode(it, 2);
        }
        app.run('DeselectAll');   // the selection filter stays on SurfaceCurve
      };
      if (isCurveList(a.TrimWithSrfCrv)) { finish(a.TrimWithSrfCrv); return undefined; }
      // interactive path
      const remembered = items.map(it => modeParam(it)?.value);
      for (const it of items) setMode(it, 0);
      app.run('SetSelFilter', { SelFilter: 'SurfaceCurve' }); app.run('DeselectAll');
      // inferred: surface curves are not selectable components here, the picked curves are kept in this list
      const picked: any[] = [];
      const afterPick = () => {
        if (!picked.length) items.forEach((it, i) => { if (remembered[i] !== undefined) setMode(it, remembered[i]); });   // each item gets its own value back (the script's one-slot store is not reproduced)
        finish(picked);
      };
      if (!interactive(app)) { logNya(app, cmd, 'picking surface curves needs a user session; the pick is treated as cancelled'); afterPick(); return undefined; }
      const session = startPickSession(app, {
        command: cmd, kind: 'element', filter: 'SurfaceCurve', prompt: opsText(1094), middlePrompt: opsText(1095),
        fromClick: () => null,   // the viewport does not report surface curves; picks arrive through session.pick
        onPick: (v: any, button: number) => {
          if (v === null || v === undefined) return true;
          const key = (x: any) => typeof x === 'string' ? x : JSON.stringify(x);
          const at = picked.findIndex(x => key(x) === key(v));
          if (button === 2) { if (at >= 0) picked.splice(at, 1); } else if (at < 0) picked.push(v);
          return true;
        },
        onEnd: afterPick,
      });
      if (!session) afterPick();
      return undefined;
    },
  });

  // ---------------------------------------------------------------- Convert
  reg({
    name: 'Convert', label: 'Convert', category: '', description: 'Converts geometry to another type and inspects the converter',
    args: [{ name: 'Target', default: '' }, { name: 'Source', default: '' }],
    execute(app, a) {
      const d = delegate(app, 'SIConvert', { Target: a.Target, Source: a.Source });
      if (!d.done) { logNya(app, 'Convert', `the conversion is the C++ command SIConvert, which is not available; SIConvert "${String(a.Target ?? '')}", "${String((a.Source as any)?.fullName ?? a.Source ?? '')}" was not run`, 'Q9'); return undefined; }
      // inferred: the two outputs of the delegated command as a record { CreatedObj, OutputObj }
      const created = d.result?.CreatedObj, output = d.result?.OutputObj;
      const some = (v: any) => !unset(v) && !(Array.isArray(v) && !v.length);
      if (some(output)) app.run('SelectObj', { InputObjs: output });
      if (some(created)) autoInspect(app, Array.isArray(created) ? created : [created]);
      return undefined;
    },
  });

  registerOperatorsScriptsMore(app, state);
}
