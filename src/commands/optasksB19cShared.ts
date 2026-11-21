// Ledger row CMD-B19c: shared state and helpers of optasksB19cIce.ts and optasksB19c.ts.
// Brief: docs/ghidra/cmd-b19c-optasks-ice-cns-envelope.md (section 3 "Wire contracts", section 5) and the CMD-B19c
// section of docs/re/WIRE_CORRECTIONS_B19.md. Original code written from that prose only; no XSIBATCH golden exists.
//
// How the contracts are mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name, ends "(status 0x...)").
//    Statuses that are not failures (0, 1 = S_FALSE "nothing to do", 0x562e80d2) are kept in
//    `app.optasksB19c.status[<command>]`.
//  * Messages with a dictionary id (XSIOPTASKS / XSIPROPERTYTASKS; the texts are not in the repository) are logged with
//    their id: severity 2 as an error line, severity 4 as a "WARNING :" line.
//  * Sub-tasks the contracts run (DeleteObj, ApplyOperator, SetValue, AddICENode, AddExposedParam..., the shader
//    update task) are performed here as undoable steps and listed in `app.optasksB19c.subtasks` (newest last).
//  * Output arguments are kept in `app.optasksB19c.out[<command>]`; the command also returns the main output.
//  * What the contract marks (inferred) or what had to be reasoned is marked `// inferred`; branches the analyst could
//    not read log "<command>: not yet attested: <what> (CMD-B19c...)".
import { App } from '../core/commands';
import { Node, X3DObject, Operator, Property, Cluster, Primitive } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';
import { unset } from './viewEditPropertyHelpers';
import { outConnections } from './operatorsScriptsOps';
import { extraOperators } from './optasksB12cShared';

export { unset };
export const ROW = 'CMD-B19c';
export const NOTE = 'docs/ghidra/cmd-b19c-optasks-ice-cns-envelope.md';
export const S_OK = 0, S_FALSE = 1, SI_NOTHING = 0x562e80d2;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_NOTIMPL = 0x80004001,
  E_ACCESSDENIED = 0x80070005, E_PENDING = 0x8000000a, E_RESTRICTED = 0x80004021;

export interface B19cSubtask { command: string; task: string; args: Record<string, any> }
export interface OptasksB19cState {
  status: Record<string, number>;
  out: Record<string, Record<string, any>>;
  subtasks: B19cSubtask[];
  /** F3DClearEvolveOpCache calls of the static ICE attribute tasks. */
  opCacheClears: number;
  /** ICE compound refresh calls (ExportICECompoundNode: two per successful export). */
  compoundRefreshes: number;
  /** Compound library rescans (ExportICECompoundNode, generic object 8eeaf99d slot 6). */
  libraryRescans: number;
  /** SIGetAppMode slot 10 stand-in: the restricted application mode (inferred: the non-commercial edition). */
  restrictedMode: boolean;
  /** Message boxes shown (ExportICECompoundNode 0x427). */
  messageBoxes: { command: string; id: string }[];
  api: Record<string, any>;
}
export function stateOf(app: App): OptasksB19cState {
  const a = app as any;
  return (a.optasksB19c ??= {
    status: {}, out: {}, subtasks: [], opCacheClears: 0, compoundRefreshes: 0, libraryRescans: 0, restrictedMode: false,
    messageBoxes: [], api: {},
  } as OptasksB19cState);
}

export const hex = (n: number) => '0x' + (n >>> 0).toString(16);
export const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
export function setStatus(app: App, cmd: string, status: number) { stateOf(app).status[cmd] = status; }
export function setOut(app: App, cmd: string, values: Record<string, any>) { stateOf(app).out[cmd] = values; }
export function subtask(app: App, command: string, task: string, args: Record<string, any>) { stateOf(app).subtasks.push({ command, task, args }); }
/** A severity-2 message with its dictionary id. */
export function errorMsg(app: App, cmd: string, id: number, detail = '', dict = 'XSIOPTASKS') { app.logMsg('error', `${cmd}: [${dict} ${hex(id)}]${detail ? ' ' + detail : ''}`); }
/** A severity-4 message (warning) with its dictionary id. */
export function warn(app: App, cmd: string, id: number, detail = '', dict = 'XSIOPTASKS') { app.logMsg('info', `WARNING : ${cmd}: [${dict} ${hex(id)}]${detail ? ' ' + detail : ''}`); }
export function nya(app: App, cmd: string, what: string, question = '') { app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW}${question ? ', ' + question : ''})`); }
export const str = (v: any) => unset(v) ? '' : String(v);
export const boolOf = (v: any, d = false): boolean => unset(v) ? d : typeof v === 'string' ? /^(true|1|yes|-1)$/i.test(v.trim()) : !!v;
export const interactive = (app: App) => (app as any).Interactive !== false;

// ------------------------------------------------------------------ DeleteObj sub-task (dd531990)
/**
 * One DeleteObj sub-task over a list of items, every removal recorded for undo. The bus DeleteObj (tasksB16c.ts) deletes
 * objects, clusters, layers and passes; the items these contracts collect are properties (constraints, envelope weight
 * properties) and operators, which it does not handle, so the sub-task removes them here with the same undo rules.
 */
export function deleteObjSubtask(app: App, cmd: string, items: (Node | null | undefined)[]): number {
  const list = [...new Set(items.filter((x): x is Node => !!x))];
  subtask(app, cmd, 'DeleteObj', { InputObj: list.map(n => n.fullName) });
  let n = 0;
  for (const it of list) if (removeNode(app, it)) n++;
  app.events.emit('scene');
  return n;
}
function removeNode(app: App, it: Node): boolean {
  const parent: any = it.parent;
  if (it instanceof Operator) {
    if (parent instanceof Primitive) {
      const prim = parent; const i = prim.operators.indexOf(it); if (i < 0) return false;
      app.record('Delete ' + it.name, () => prim.removeOperator(it), () => { prim.operators.splice(i, 0, it); it.parent = prim; prim.dirty = true; });
      return true;
    }
    // stand-in operators that live outside a geometry stack (lock / map / derivator operators): the connection lists
    const owners = (it as any).__b19cOwners as object[] | undefined;
    const lists = (owners ?? (parent ? [parent] : [])).map(o => outConnections(o)).filter(l => l.includes(it));
    const wasExtra = extraOperators.has(it);
    if (!lists.length && !wasExtra) return false;
    const idx = lists.map(l => l.indexOf(it));
    app.record('Delete ' + it.name, () => { for (const l of lists) { const i = l.indexOf(it); if (i >= 0) l.splice(i, 1); } extraOperators.delete(it); },
      () => { lists.forEach((l, k) => l.splice(idx[k], 0, it)); if (wasExtra) extraOperators.add(it); });
    return true;
  }
  if (it instanceof Property && (parent instanceof X3DObject || parent instanceof Cluster)) {
    const owner = parent as X3DObject | Cluster; const i = owner.properties.indexOf(it); if (i < 0) return false;
    app.record('Delete ' + it.name, () => owner.removeProperty(it), () => { owner.properties.splice(i, 0, it); it.parent = owner as any; });
    return true;
  }
  if (it instanceof X3DObject && it.parentObj) {
    const p = it.parentObj; const i = p.children.indexOf(it);
    app.record('Delete ' + it.name, () => p.removeChild(it), () => { p.addChild(it); p.children.splice(p.children.indexOf(it), 1); p.children.splice(i, 0, it); });
    return true;
  }
  if (it instanceof Cluster && it.obj) {
    const o = it.obj;
    app.record('Delete ' + it.name, () => o.removeCluster(it), () => o.addCluster(it));
    return true;
  }
  nya(app, cmd(it), `deleting ${it.fullName} (kind ${it.kind}) through DeleteObj`);
  return false;
}
const cmd = (it: Node) => `DeleteObj(${it.name})`;
