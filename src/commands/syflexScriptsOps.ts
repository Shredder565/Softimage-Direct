// Ledger row CMD-B7b support (docs/ghidra/cmd-b7b-syflex-scripts.md): what the Syflex script commands stand on.
// Original code written from the prose contract only.
//
//  * Stand-in operators. None of the `sy*` operators ships with the install (row CMD-B7b-OPS, TODO), so there is no
//    solver. `SyOperator` is a pass-through node that carries exactly the parameters and input ports the contract
//    names, so that operator lookup, port connections, clusters, weight maps, messages and selection are real. Its
//    evaluation logs "not yet attested" once per operator and returns the geometry untouched.
//  * The script-side host layer: the selection as the scripts see it (objects, operators, clusters and tagged
//    components side by side), `SelectChildNodes`, the `<obj>.*.<pattern>` lookups, cluster / weight map creation and
//    the translated texts of dictionary EXTSYFLEX.
import * as THREE from 'three';
import type { App } from '../core/commands';
import { X3DObject, Node, Operator, Cluster, Property, Null } from '../core/scene';
import { num, int, bool, str, type ParamDef } from '../core/params';
import type { CompKind } from '../core/topology';

export const NOTE = 'docs/ghidra/cmd-b7b-syflex-scripts.md';
type V3 = [number, number, number];
export type SubKind = 'pnt' | 'edge' | 'poly';
const SUB: Record<CompKind, SubKind> = { point: 'pnt', edge: 'edge', polygon: 'poly' };
const COMP: Record<SubKind, CompKind> = { pnt: 'point', edge: 'edge', poly: 'polygon' };

// ------------------------------------------------------------------ translated texts (dictionary EXTSYFLEX)
export const EXTSYFLEX: Record<number, string> = {
  1000: 'Select 2 vertices of the cloth',
  1001: 'Select a %s',
  1002: 'Select a cloth',
  1003: 'Select a polymesh',
  1004: 'Select a syCache',
  1005: 'Select a syCloth',
  1006: 'Select cloth vertices',
  1007: 'Select the cloth and the collider',
  1008: 'Select the cloth points and the %s',
  1009: 'Select vertices of the cloth',
  1010: 'Select vertices of the cloth (or a point cluster) and a polymesh',
};
/** LogMessage XSIUtils.Translate(id, "EXTSYFLEX", substitution): default severity. */
export function logText(app: App, id: number, substitution?: string) {
  const t = EXTSYFLEX[id] ?? ''; app.logMsg('info', substitution === undefined ? t : t.replace('%s', substitution));
}
export const logNya = (app: App, command: string, what: string, question = '') => app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
/** The scripts translate a constant that no file defines; what the translator does with an empty id is open (Q1). */
export const logUndefinedId = (app: App, command: string) => logNya(app, command, 'the message of the undefined id IDS_SELECT_SYCLOTH (the intended text is probably id 1005 "Select a syCloth")', 'Q1');

// ------------------------------------------------------------------ script errors and partial work
/** A statement of the script failed where no error handling is active. */
export class SyScriptError extends Error {
  readonly syScriptError = true;
  constructor(command: string, what: string) { super(`${what} (script error in ${command})`); this.name = 'SyScriptError'; }
}
/**
 * A script that stops on an error keeps what its earlier statements made ("the null created in step 3 remains").
 * The bus rolls a failed command back, so steps recorded through `record` ignore that one synchronous rollback.
 * // inferred: what stays behind is then not on the undo stack.
 */
let run = { keep: false };
/** Called at the start of each script command: its recorded steps share one "keep on script error" flag. */
export function beginCommand() { run = { keep: false }; }
export function scriptError(command: string, what: string): SyScriptError {
  const r = run; r.keep = true; queueMicrotask(() => { r.keep = false; });
  return new SyScriptError(command, what);
}
export function record(app: App, label: string, redo: () => void, undo: () => void) { const r = run; app.record(label, redo, () => { if (!r.keep) undo(); }); }

// ------------------------------------------------------------------ session state
export interface SyflexScriptsState {
  note: string;
  registered: string[];
  /** Scripting names that were on the bus from an earlier batch and are replaced by the contract's behaviour. */
  replaced: string[];
  /** Number of stand-in operator evaluations (the solver does not exist). */
  evaluations: number;
  /** The last SyCmdSaveCache call: its arguments and the file name the command is inferred to build. Nothing is written. */
  lastSaveCache: { arg0: any; points: number; fileName: string; written: boolean } | null;
}
export const stateOf = (app: App): SyflexScriptsState => (app as any).syflexScripts;

// ------------------------------------------------------------------ stand-in operators
export interface SyPort { name: string; target: Node | null }
interface SySpec { params: ParamDef[]; ports: string[] }
const P = (...names: string[]) => names;
const reset = () => int('Reset', 0, 'Reset');            // inferred default 0 (the scripts only ever write 1)
const modifMap = () => int('ModifMap', 0, 'ModifMap');   // inferred default 0
/**
 * Parameters and input ports per preset, as the Dependencies table of the note lists them. A port the contract
 * does not name has an empty name and is reached by index only.
 * // inferred: defaults (0 / empty) and value types; which connection a named port is (taken from the order in which
 * the creating script hands its connections over).
 */
export const SY_PRESETS: Record<string, SySpec> = {
  syCloth: {
    params: [
      int('FirstFrame', 1, 'FirstFrame'), int('Update', 1, 'Update', { keyable: true }), int('ClothType', 0, 'ClothType'),
      int('ModifSpringMap', 0, 'ModifSpringMap'), int('ModifMassMap', 0, 'ModifMassMap'), int('ClearCache', 0, 'ClearCache'),
      int('SaveState', 0, 'SaveState'), str('Cache', '', 'Cache'),
    ],
    ports: P('', '', ''),
  },
  syProperties: { params: [], ports: P('') },
  syPropertiesSkin: { params: [int('NbLevels', 1, 'NbLevels')], ports: P('') },
  syPropertiesFlesh: { params: [], ports: P('') },
  syGravity: { params: [], ports: P('') }, syDamp: { params: [], ports: P('') }, syAir: { params: [], ports: P('') },
  syWind: { params: [], ports: P('') }, syTurbulence: { params: [], ports: P('') }, syVolume: { params: [], ports: P('') },
  sySpring: { params: [num('Length', 0, 'Length'), int('Point1', 0, 'Point1'), int('Point2', 0, 'Point2')], ports: P('') },
  syZipper: { params: [str('Points', '', 'Points'), reset()], ports: P('') },
  syCollide: { params: [reset()], ports: P('', 'CloPnts', '', '', 'ColPols', '') },   // Reset: written by SySetCollidePnts / SySetCollidePols
  sySelfCollide: { params: [reset()], ports: P('', '', 'Faces') },
  syCollidePla: { params: [], ports: P('', '', '') },
  syCollideSph: { params: [], ports: P('', '', '') },
  syNail: { params: [reset(), modifMap()], ports: P('', 'Cluster', '', '', '') },
  syPin: { params: [reset(), modifMap()], ports: P('', '', '', 'Points', '', '') },
  syMimic: { params: [reset(), modifMap()], ports: P('', '', '', 'Points', '', '') },
  syCache: { params: [int('Update', 1, 'Update', { keyable: true })], ports: P('', '', '') },
};

let sink: App | null = null;
export const setLogSink = (app: App) => { sink = app; };

/** A Syflex operator without its solver: parameters, input ports, pass-through evaluation. */
export class SyOperator extends Operator {
  readonly siType: string;
  readonly ports: SyPort[];
  private told = false;
  constructor(readonly preset: string, name: string, connections: (Node | null)[]) {
    super(name, preset, [...SY_PRESETS[preset].params.map(d => ({ ...d })), bool('mute', false, 'Mute')]);
    this.siType = preset;
    this.ports = SY_PRESETS[preset].ports.map((n, i) => ({ name: n, target: connections[i] ?? null }));
  }
  /** Operator.Port(name) of the object model: the input port of that name. */
  Port(name: string): SyPort | null { return name ? this.ports.find(p => p.name === name) ?? null : null; }
  /** Operator.InputPorts(index). */
  InputPorts(index: number): SyPort | null { return this.ports[index] ?? null; }
  apply(input: any): any {
    if (sink) {
      const s = stateOf(sink); if (s) s.evaluations++;
      if (!this.told) { this.told = true; logNya(sink, this.preset, `the evaluation of the ${this.preset} operator "${this.name}" (the Syflex operators are not in the install, ledger row CMD-B7b-OPS); the geometry passes through unchanged`, 'Q4'); }
    }
    return input;
  }
}
export const isSy = (n: any): n is SyOperator => n instanceof SyOperator;

function uniqueOpName(obj: X3DObject, base: string): string {
  const taken = new Set((obj.primitive?.operators ?? []).map(o => o.name.toLowerCase())); let n = base, i = 1;
  while (taken.has(n.toLowerCase())) n = `${base}${i++}`;
  return n;
}
/**
 * ApplyOperator <preset>, <connections>. The operator is put on the construction history of `host` (the cloth mesh).
 * // inferred: every Syflex operator sits in the stack of the mesh the cloth operator is on.
 */
export function applySyOperator(app: App, command: string, preset: string, host: X3DObject | null, connections: (Node | null)[]): SyOperator {
  const prim = host?.primitive;
  if (!SY_PRESETS[preset] || !host || !prim) throw scriptError(command, `ApplyOperator "${preset}": no geometry to put the operator on`);
  const op = new SyOperator(preset, uniqueOpName(host, preset), connections);
  record(app, `ApplyOperator ${preset}`, () => prim.addOperator(op), () => prim.removeOperator(op));
  return op;
}

// ------------------------------------------------------------------ the selection as the scripts see it
export interface SyItem {
  /** The item's type name: `polymsh`, `null`, an operator type, `pnt` / `poly` for clusters, `pntSubComponent`, ... */
  type: string;
  node: Node | null; obj: X3DObject | null;
  sub: { kind: SubKind; indices: number[] } | null;
}
export const ownerObject = (n: any): X3DObject | null => {
  if (n instanceof Cluster) return n.obj;
  let x = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null;
};
const nodeItem = (n: Node): SyItem => ({ type: n.type, node: n, obj: ownerObject(n), sub: null });
/**
 * Selected nodes in selection order; the object that carries tagged components counts as one sub-component item.
 * // inferred: the element order of a sub-component is ascending index order (edges are not used by these scripts).
 */
export function selItems(app: App): SyItem[] {
  const c = app.compSel; let sub: SyItem | null = null;
  if (c && c.kind !== 'edge') {
    const set = c.kind === 'point' ? c.points : c.polygons;
    if (set.size) sub = { type: `${SUB[c.kind]}SubComponent`, node: null, obj: c.obj, sub: { kind: SUB[c.kind], indices: [...set].sort((a, b) => a - b) } };
  } else if (c && c.edges.size) sub = { type: 'edgeSubComponent', node: null, obj: c.obj, sub: { kind: 'edge', indices: [] } };
  const out: SyItem[] = []; let placed = false;
  for (const n of app.selection) { if (sub && n === sub.obj) { out.push(sub); placed = true; } else out.push(nodeItem(n)); }
  if (sub && !placed) out.unshift(sub);
  return out;
}
/** SelectObj <nodes>: replaces the selection (tagged components included). */
export function selectNodes(app: App, nodes: Node[]) { app.compSel = null; app.select(nodes); }
/**
 * SelectChildNodes with no argument: the selection becomes the 3D objects that own the selected items.
 * // inferred (Q5): the scripts only rely on the owning object coming first; child objects are not added.
 */
export function selectChildNodes(app: App): X3DObject[] {
  const objs: X3DObject[] = [];
  for (const it of selItems(app)) if (it.obj && !objs.includes(it.obj)) objs.push(it.obj);
  selectNodes(app, objs); return objs;
}

// ------------------------------------------------------------------ lookups by name pattern
const starts = (name: string, prefix: string) => name.toLowerCase().startsWith(prefix.toLowerCase());   // inferred: names compare without case
/** `<obj>.*.syCloth*`: operators of the object's geometry whose name starts with "syCloth" (name, not type). */
export function clothNodes(obj: X3DObject | null): Operator[] { return (obj?.primitive?.operators ?? []).filter(o => starts(o.name, 'syCloth')); }
/**
 * "The cloth operator of object X": SelectObj `<X>.*.syCloth*`, then the first selected item. Returns null when the
 * SelectObj raises (nothing matches); the selection is then left as it was.   // inferred: a failed SelectObj keeps the selection
 */
export function selectCloth(app: App, obj: X3DObject | null): Operator | null {
  const found = clothNodes(obj); if (!found.length) return null;
  selectNodes(app, found); return found[0];
}
/** `<obj>.*.cls.<cluster>*.<map>`: weight maps by cluster name prefix and map name (prefix when `mapPrefix`). */
export function clusterMaps(obj: X3DObject | null, clusterPrefix: string, map: string, mapPrefix: boolean): Property[] {
  const out: Property[] = [];
  for (const c of obj?.clusters ?? []) if (starts(c.name, clusterPrefix)) for (const p of c.properties) if (mapPrefix ? starts(p.name, map) : p.name.toLowerCase() === map.toLowerCase()) out.push(p);
  return out;
}

// ------------------------------------------------------------------ clusters and weight maps
const KIND_LABEL: Record<string, string> = { pnt: 'Point', poly: 'Polygon', edge: 'Edge' };
function uniqueClusterName(o: X3DObject, base: string, self?: Cluster): string { let n = base, i = 1; while (o.clusters.some(c => c !== self && c.name === n)) n = `${base}${i++}`; return n; }
export function componentCount(o: X3DObject, kind: SubKind): number {
  const m = o.primitive?.mesh(); if (!m) return 0;
  return kind === 'pnt' ? m.positions.length / 3 : kind === 'poly' ? m.polygons.length : 0;
}
/** CreateCluster `<object>.pnt[*]` / `<object>.poly[*]` / a tagged-component item: the first cluster of the result. */
export function createCluster(app: App, o: X3DObject, kind: SubKind, indices: number[] | '*'): Cluster {
  const items = indices === '*' ? Array.from({ length: componentCount(o, kind) }, (_, i) => i) : indices;
  const c = new Cluster(uniqueClusterName(o, KIND_LABEL[kind]), kind as any, new Set<number | string>(items));
  record(app, 'CreateCluster', () => { o.addCluster(c); }, () => o.removeCluster(c));
  return c;
}
/** Renaming a node. // inferred: a cluster name that is taken on the object gets a numeric suffix. */
export function rename(app: App, n: Node, name: string) {
  const next = n instanceof Cluster && n.obj ? uniqueClusterName(n.obj, name, n) : name; const old = n.name;
  record(app, 'Rename', () => { n.name = next; }, () => { n.name = old; });
}
/**
 * CreateWeightMap "WeightMap", <cluster>, <name>, "Weight Map Property", 0, then `<map>.weightmapop.weight` = 1.
 * This build keeps the weight of a map on the map property itself (no separate weightmapop node).
 */
export function createWeightMap(app: App, c: Cluster, name: string): Property {
  let n = name, i = 1; while (c.properties.some(p => p.name === n)) n = `${name}${i++}`;
  const p = new Property(n, 'weightmap', [num('weight', 1, 'Default Weight', { min: 0, max: 1 }), bool('paintable', true, 'Paintable')]);
  (p as any).values = new Map<number, number>();
  record(app, 'CreateWeightMap', () => { c.addProperty(p); }, () => c.removeProperty(p));
  p.set('weight', 1);
  return p;
}

// ------------------------------------------------------------------ parameters, nulls, geometry
/** SetValue on a parameter of a node; a missing parameter is a script error. */
export function setValue(app: App, command: string, n: Node | null | undefined, name: string, value: any) {
  const p = n?.get(name);
  if (!n || !p) throw scriptError(command, `SetValue: ${n ? `"${n.name}" has no parameter "${name}"` : `nothing is selected to write "${name}" on`}`);
  const old = p.value; if (old === value) return;
  record(app, 'SetValue', () => { p.value = value; }, () => { p.value = old; });
  app.events.emit('params', p);
}
/** The same write where the script runs with errors suppressed: a failed write is silent. */
export function setValueQuiet(app: App, command: string, n: Node | null | undefined, name: string, value: any) { if (n?.get(name)) setValue(app, command, n, name, value); }
/** SetKey <operator>.<parameter>, time, value. */
export function setKey(app: App, command: string, n: Node, name: string, time: number, value: number) {
  const p = n.get(name); if (!p) throw scriptError(command, `SetKey: "${n.name}" has no parameter "${name}"`);
  const fc = app.anim.fcurve(p, true)!; const had = fc.keys.find(k => k.time === time); const old = p.value;
  record(app, 'SetKey', () => { fc.addKey(time, value); p.value = value; }, () => { fc.removeKey(time); if (had) fc.addKey(time, had.value); p.value = old; });
  app.events.emit('params', p);
}
/**
 * GetPrim "Null", , <parent>: a null as a child of the given object. The null's display parameters `primary_icon`
 * and `size` are not on this build's null, so they are added to it when a script writes them (the viewport does not
 * read them).   // inferred
 */
export function createNull(app: App, parent: X3DObject): Null {
  const n = new Null(app.scene.uniqueName('null'));
  record(app, 'GetPrim Null', () => { parent.addChild(n); }, () => { parent.removeChild(n); });
  return n;
}
export function setNullDisplay(app: App, command: string, n: Null, name: 'primary_icon' | 'size', value: number) {
  if (!n.get(name)) n.add(name === 'size' ? num('size', 1, 'Size') : int('primary_icon', 1, 'Primary Icon'));
  setValue(app, command, n, name, value);
}
export function pointPosition(o: X3DObject, i: number): V3 | null {
  const m = o.primitive?.mesh(); if (!m || i < 0 || i * 3 + 2 >= m.positions.length) return null;
  return [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
}
/** GetBBox of tagged points: centre of the box. // inferred: the box is reported in global coordinates. */
export function bboxCentre(o: X3DObject, indices: number[]): V3 {
  const g = o.globalMatrix(); const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const i of indices) {
    const p = pointPosition(o, i); if (!p) continue; const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(g); const a = [v.x, v.y, v.z];
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a[k]); hi[k] = Math.max(hi[k], a[k]); }
  }
  return lo[0] === Infinity ? [0, 0, 0] : [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
}
/** Geometry.Points.PositionArray: a 3 x N array (one row per axis). */
export function positionArray(o: X3DObject): number[][] | null {
  const m = o.primitive?.mesh(); if (!m) return null;
  const n = m.positions.length / 3; const rows: number[][] = [[], [], []];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) rows[k].push(m.positions[i * 3 + k]);
  return rows;
}
export const compKindOf = (k: SubKind): CompKind => COMP[k];
