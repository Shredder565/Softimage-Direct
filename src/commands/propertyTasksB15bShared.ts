// Ledger row CMD-B15b (propertytasks.dll): shared state and helpers of propertyTasksB15b*.ts.
// Brief: docs/ghidra/cmd-b15b-propertytasks.md, "Shared facts" (2) and "Contracts" (3), with items 22-26 of
// docs/re/WIRE_CORRECTIONS_B15.md. Original code written from that prose only; no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build (stand-in models, all ORIGINAL; none of them is attested beyond the note):
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name). The last status of each
//    command is kept in `app.propertyTasksB15b.lastStatus`; the S_FALSE-like "1" of the note is recorded there too.
//  * Message ids of the XSIPROPERTYTASKS dictionary are not resolved (their texts are not in the repository): log
//    lines carry the id, e.g. "XSIPROPERTYTASKS message 0x2b".
//  * Sub-tasks the note names (SICreateCluster, SIAddProp, SIAddToCluster, ApplyOperator, SetValue, FreezeObj...)
//    are done by the small recorded steps of these files, or run through the bus when it has the command.
//  * A cluster property with per-element values (the "User Normal Property", weight maps...) keeps them in
//    `values: Map<elementIndex, number | number[]>` like the build's existing weight map / vertex colour properties.
import { App } from '../core/commands';
import { Node, X3DObject, Property, Cluster } from '../core/scene';
import { Parameter } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import { unset, listOf } from './tasksB11cShared';

export { unset, listOf };
export const ROW = 'CMD-B15b';
export const NOTE = 'docs/ghidra/cmd-b15b-propertytasks.md';
export const S_OK = 0, S_FALSE = 1;
export const E_OUTOFMEMORY = 0x8007000e, E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_ACCESSDENIED = 0x80070005;
export const S_NOTHING_TO_DO = 0x562e80d2, S_CANCELLED = 0x562e80c7;
/** The "leave unchanged" sentinel SetClusterPropertyValues stores for an empty value item. */
export const DBL_MAX = Number.MAX_VALUE;

/** A user-normal / retarget / override stand-in model hung on the app. */
export interface OverrideEntry {
  kind: 0 | 1 | 2;                 // 0 connection / shader entry, 1 property entry, 2 parameter value entry
  path: string;                    // path of the overridden parameter / property relative to the objects it applies to
  param: Parameter;                // the entry parameter living on the override property
  shaderClass?: string;            // kind 0 only
  value?: any;                     // kind 2 only
}
export interface PropertyTasksState {
  lastStatus: { command: string; status: number } | null;
  /** Scene setting behind 0x180019140 (freeze after the user-normal commands). The note could not identify it. */
  freezeAfterUserNormals: boolean;
  /** Names of global events the custom-parameter task fires (SI3D_KEYABLEPARAMETER_CHANGED). */
  events: string[];
  /** Override entries by entry parameter. */
  entries: Map<Parameter, { override: Property; entry: OverrideEntry }>;
  /** Interactive answers (no UI in the command bus): the entry-type question of the override task, the yes/no question of Add property extended. */
  hooks: { askEntryType?: (p: Parameter) => 0 | 2 | undefined; confirmAnimated?: (names: string[]) => boolean };
  /** Sub-task trace (names in the order the contracts name them). */
  trace: string[];
}
export function stateOf(app: App): PropertyTasksState {
  const a: any = app;
  return (a.propertyTasksB15b ??= { lastStatus: null, freezeAfterUserNormals: false, events: [], entries: new Map(), hooks: {}, trace: [] } as PropertyTasksState);
}

export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export function logMsgId(app: App, command: string, id: number, kind: 'info' | 'error' = 'info') { app.logMsg(kind, `${command}: XSIPROPERTYTASKS message 0x${id.toString(16)}`); }
export function trace(app: App, name: string) { const t = stateOf(app).trace; t.push(name); if (t.length > 200) t.shift(); }
export function failMsg(app: App, command: string, status: number, id: number, extra = ''): SiStatusError {
  logMsgId(app, command, id, 'error');
  return fail(status, `${command}: XSIPROPERTYTASKS message 0x${id.toString(16)}${extra ? ` (${extra})` : ''}`);
}

export const ownerObject = (n: any): X3DObject | null => { let p: any = n; while (p && !(p instanceof X3DObject)) p = p.owner ?? p.parent ?? null; return p ?? null; };
export const isParameter = (x: any): x is Parameter => !!x && typeof x === 'object' && 'def' in x && 'owner' in x;
/** The numeric value of an enum argument given as a number, a numeric string or the ":siName:siType" default text. */
export function enumArg(v: any, names: Record<string, number>, fallback: number): number {
  if (unset(v)) return fallback;
  if (typeof v === 'number') return v;
  const s = String(v); if (/^-?\d+$/.test(s.trim())) return Number(s);
  const m = /^:?([A-Za-z0-9_]+)(?::|$)/.exec(s.trim()); return m && names[m[1]] !== undefined ? names[m[1]] : fallback;
}
export const toNumber = (v: any, fallback = 0): number => { const n = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v); return Number.isFinite(n) ? n : fallback; };
/** The scene lock level of a node, read from the node or its owners (`lockLevel`, `locked` parameter). */
export function lockLevel(n: any): number {
  for (let p = n; p; p = p.parent) { const l = Number(p.lockLevel ?? (p.val?.('locked') ? 1 : 0)); if (l) return l; }
  return 0;
}
/** Number of values per element of a cluster property (slot 18 of the property interface). */
export function valueDimension(p: Property): number {
  const d = (p as any).dimension; if (typeof d === 'number' && d > 0) return d;
  if (p.type === 'UserNormalProperty' || p.type === 'vertexcolor') return 3;
  return 1;
}
export const clusterOf = (p: Property): Cluster | null => (p.parent instanceof Cluster ? p.parent : null);
/** The cluster's elements in ascending order: the numbering SetClusterPropertyValues offsets refer to. */
export const sortedElements = (c: Cluster): number[] => [...c.elements].map(Number).sort((x, y) => x - y);

/** A node argument: Node instances, scene names, dotted property paths. */
export function nodeArg(app: App, x: any): Node | Parameter | null {
  if (x instanceof Node || isParameter(x)) return x;
  if (typeof x !== 'string' || !x) return null;
  const o = app.scene.find(x.trim()) ?? (x.trim() === app.scene.root.name ? app.scene.root : undefined); if (o) return o;
  const parts = x.trim().split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    const owner = app.scene.find(parts.slice(0, i).join('.')); if (!owner) continue;
    const rest = parts.slice(i).join('.');
    for (const c of owner.clusters) for (const pr of c.properties) if (rest === `${c.name}.${pr.name}` || rest === `cls.${c.name}.${pr.name}`) return pr;
    const pr = owner.allProperties().find(q => q.name === rest || q.type === rest); if (pr) return pr;
    const c = owner.clusters.find(k => k.name === rest); if (c) return c;
    const pm = owner.property(rest) ?? owner.allProperties().find(q => q.name === parts[i]);
    if (pm && parts.length - i === 2) { const prm = pm.get(parts[i + 1]); if (prm) return prm; }
  }
  return null;
}
export function nodesArg(app: App, v: any, selectionDefault = true): (Node | Parameter)[] {
  if (unset(v)) return selectionDefault ? [...app.selection] : [];
  const out: (Node | Parameter)[] = [];
  for (const x of listOf(v)) { const n = nodeArg(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
