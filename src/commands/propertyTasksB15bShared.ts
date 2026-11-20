// Shared helpers of ledger row CMD-B15b (`propertytasks.dll`): status codes, argument handlers, message logging and
// the small scene-walking utilities the three CMD-B15b files use. Brief: docs/ghidra/cmd-b15b-propertytasks.md
// ("Wire contract" of each command) and docs/re/WIRE_CORRECTIONS_B15.md items 22-26. Original code.
import { App } from '../core/commands';
import { Node, X3DObject, Property, Cluster, Material, Group, Layer, Partition } from '../core/scene';
import { Parameter, ParamSet } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import { findNode } from './viewEditPropertyHelpers';

export const ROW = 'CMD-B15b';
export const S_OK = 0, S_FALSE = 1;
export const E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_OUTOFMEMORY = 0x8007000e;
export const E_UNEXPECTED = 0x8000ffff, E_ACCESSDENIED = 0x80070005;
/** "cancelled by user" passthrough and "nothing to do" (logged, not an error). */
export const SI_CANCELLED = 0x562e80c7, SI_NOTHING = 0x562e80d2;

/** Retarget-mapping data of one object (the property behind `180064800`; its identity is not attested). */
export interface RetargetMapping { /** slot 9: S/R/T transform (item relative to its model owner). */ mapping: number[]; /** slot 7: P2M_ transform (owner relative to the rig root). */ p2m: number[] }
export interface RetargetRecord { name0: string; name1: string; chainType: number; members: { name: string; role: number }[] }
export interface PropertyTasksB15bState {
  /** Non-failing statuses (S_FALSE, "nothing to do", "cancelled") by command. */
  status: Record<string, number>;
  /** Global events fired (SI3D_KEYABLEPARAMETER_CHANGED). */
  events: string[];
  /** Preference TweakNormals.bleedselection: the user-normal commands' bleed flag when BleedSelection is not given. */
  bleedSelectionPref: boolean;
  /** RePackArg of the user-normal commands: the bleed flag written back to BleedSelection, by command. */
  bleedOut: Record<string, boolean>;
  /** The scene setting read at 0x180019140 (not identified): when on, FreezeObj runs after user normals are written. */
  freezeAfterWrite: boolean;
  /** Yes / No question of `Add property extended` (simsgcat 0x3c). null = interactive confirm(); batch = yes. */
  ask: ((command: string, text: string) => boolean) | null;
  retarget: WeakMap<X3DObject, RetargetMapping>;
  structure: WeakMap<X3DObject, RetargetRecord[]>;
  /** SIGetOriginalValueOfOverridden: the Time argument converted to seconds (UnPackArg). */
  lastTimeSeconds: number | null;
}
export function b15b(app: App): PropertyTasksB15bState {
  return ((app as any).propertyTasksB15b ??= {
    status: {}, events: [], bleedSelectionPref: false, bleedOut: {}, freezeAfterWrite: false, ask: null,
    retarget: new WeakMap(), structure: new WeakMap(), lastTimeSeconds: null,
  });
}
export const setStatus = (app: App, command: string, s: number) => { b15b(app).status[command] = s; };

const hex = (n: number) => '0x' + n.toString(16);
/** XSIPROPERTYTASKS message reference (texts are not in the repo). */
export const msg = (id: number) => `XSIPROPERTYTASKS message ${hex(id)}; text not in the repo`;
export const fail = (status: number, what: string, id?: number) => new SiStatusError(status, id === undefined ? what : `${what} (${msg(id)})`);
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export function warn(app: App, command: string, text: string, id: number) { app.logMsg('info', `WARNING : ${command}: ${text} (${msg(id)})`); }

export const unset = (v: any) => v === undefined || v === null || v === '';
export const listOf = (v: any): any[] => unset(v) ? [] : Array.isArray(v) ? v : typeof v === 'string' ? splitList(v) : [v];
/** Split a list string at commas that are not inside [...] (component lists "cube.pnt[1,2]"). */
function splitList(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '[') depth++; if (ch === ']') depth--; if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export const boolArg = (v: any, d = false): boolean => unset(v) ? d : typeof v === 'string' ? /^(true|1|yes|-1)$/i.test(v.trim()) : !!v;
/** ":siDouble:siVariantType" → "siDouble"; numbers and numeric strings → number. */
export function enumArg(v: any): string | number | null {
  if (unset(v)) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim(); const m = /^:([^:]+):/.exec(s); if (m) return m[1];
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
}

// ------------------------------------------------------------------ items
/** A parameter named by a path "obj.prop.param" (or a Parameter). */
export function resolveParam(app: App, x: any): Parameter | null {
  if (x instanceof Parameter) return x;
  if (typeof x !== 'string' || !x.includes('.')) return null;
  const i = x.lastIndexOf('.');
  const owner = findNode(app, x.slice(0, i));
  if (owner instanceof ParamSet) return owner.get(x.slice(i + 1)) ?? null;
  // a path through a parameter set that findNode does not name (kinematics, clusters): search the owning object
  const parts = x.split('.');
  for (let k = parts.length - 1; k >= 1; k--) {
    const o = findNode(app, parts.slice(0, k).join('.'));
    if (o instanceof X3DObject) return paramAt(o, parts.slice(k).join('.')) ?? null;
  }
  return null;
}
/** One item of an argument: a node, a parameter, or a component string kept as text. */
export function resolveItem(app: App, x: any): any {
  if (x instanceof Node || x instanceof Parameter) return x;
  if (x && typeof x === 'object') return x;
  if (typeof x !== 'string') return null;
  if (/\.(pnt|poly|edge|sample)\[/.test(x)) return x;
  return findNode(app, x) ?? resolveParam(app, x);
}
/** Argument handler "Collection": an argument that is not given stands for the selection (SDK ArgumentHandler). */
export function collectionArg(app: App, v: any): any[] {
  if (unset(v)) return [...app.selection];
  return listOf(v).map(x => resolveItem(app, x)).filter(x => x !== null && x !== undefined);
}
/** Argument handler "SingleObj": the first selected item when not given. */
export function singleObjArg(app: App, v: any): any {
  if (unset(v)) return app.selection[0] ?? null;
  const first = listOf(v)[0];
  return first === undefined ? null : resolveItem(app, first);
}
/** Argument handler "MarkedParameters": the marked parameters when not given. */
export function markedArg(app: App, v: any): any[] {
  if (unset(v)) return [...app.anim.marked];
  return listOf(v).map(x => resolveItem(app, x)).filter(x => x !== null && x !== undefined);
}

/** The 3D object a node or parameter belongs to. */
export function ownerObject(x: any): X3DObject | null {
  let n: any = x instanceof Parameter ? x.owner : x;
  while (n && !(n instanceof X3DObject)) n = n.parent ?? null;
  return n ?? null;
}
/** Every parameter set below an object (kinematics, primitive and its operators, properties, clusters and their
 *  properties, material). */
export function paramSetsOf(o: X3DObject): ParamSet[] {
  const out: ParamSet[] = [o, o.kinematics, o.kinematics.local, o.kinematics.global];
  if (o.primitive) out.push(o.primitive, ...o.primitive.operators);
  out.push(...o.properties);
  for (const c of o.clusters) out.push(c, ...c.properties);
  if (o.material) { out.push(o.material); if (o.material.surface) out.push(o.material.surface); }
  return out;
}
/** Path of a parameter set or a parameter relative to its object ("Visibility.viewvis", "Kinematics.Local.posx"). */
export function relPath(x: Parameter | ParamSet, o: X3DObject): string {
  const full = x.fullName, base = o.fullName + '.';
  return full.startsWith(base) ? full.slice(base.length) : full;
}
/** The parameter at a relative path on an object (case-insensitive). */
export function paramAt(o: X3DObject, path: string): Parameter | undefined {
  const want = path.toLowerCase();
  for (const s of paramSetsOf(o)) for (const p of s.params) if (relPath(p, o).toLowerCase() === want) return p;
  return undefined;
}
/** The parameter set at a relative path on an object. */
export function setAt(o: X3DObject, path: string): ParamSet | undefined {
  const want = path.toLowerCase();
  return paramSetsOf(o).find(s => s !== o && relPath(s, o).toLowerCase() === want);
}
/** Objects a container node stands for: the object itself, or the members of a group / layer / partition. */
export function objectsOf(n: any): X3DObject[] {
  if (n instanceof X3DObject) return [n];
  if (n instanceof Group) return [...n.members];
  if (n instanceof Layer || n instanceof Partition) return [...n.members];
  return [];
}
export const isOverride = (n: any): boolean => n instanceof Property && (/^override$/i.test(n.type) || n.type === 'Override');
export { Node, X3DObject, Property, Cluster, Material, Parameter, ParamSet };

/** Remove a parameter from a set (the param system has no remove; the private name index is updated too). */
export function removeParam(s: ParamSet, p: Parameter) {
  const i = s.params.indexOf(p); if (i < 0) return -1;
  s.params.splice(i, 1); (s as any).byName?.delete(p.name);
  return i;
}
/** Put a parameter back at an index (undo of removeParam). */
export function insertParam(s: ParamSet, p: Parameter, at: number) {
  if (s.params.includes(p)) return;
  s.params.splice(Math.max(0, Math.min(at, s.params.length)), 0, p); (s as any).byName?.set(p.name, p);
}
