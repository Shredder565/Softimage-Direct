// Ledger rows CMD-B12a / CMD-B12b (optasks.dll ICE compound / node / port commands): the graph model the commands edit.
// Briefs: docs/ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md and
//         docs/ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md ("Wire contract" per command).
// Original code written from those prose contracts only; no XSIBATCH golden exists for either row.
//
// Why a stand-in: the build's ICETreeOperator (src/core/ice.ts) is a flat node / link list evaluated per point. It has
// no compounds, exposed ports, PPG layout groups, port groups, port types, Set Data attribute lists or node comments.
// This file builds an `IceGraph` view next to each ICE tree:
//  * the tree's root graph mirrors the operator's flat nodes and links (kept in sync on every access, so nodes added by
//    AddICENode / ConnectICENodes show up), plus a root node standing for the ICE tree itself (input ports Port1..n);
//  * compounds own an inner graph; their inputs / outputs are the exposed ports; a compound keeps its PPG layout;
//  * every edit runs through `edit()`: a structural snapshot before and after, recorded with app.record, so Undo / Redo
//    restore the exact graph (the binary replays recorded sub-tasks; the resulting states are the same).
// Evaluation still uses the flat operator: moving nodes in or out of a compound keeps the flat links, so the result of
// the tree does not change, which is what the contract asks (connections are kept through exposed ports).
import { App } from '../core/commands';
import { Node, X3DObject } from '../core/scene';
import { ICETreeOperator, ICE_NODES, type IceNode } from '../core/ice';
import { SiStatusError } from './alembicSeqCam';
import { findNode, siConst, unset } from './viewEditPropertyHelpers';

export { unset };
export const NOTE_A = 'docs/ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md';
export const NOTE_B = 'docs/ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md';
export const S_OK = 0, S_FALSE = 1, SI_NOCHANGE = 0x562e80c7;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_UNEXPECTED = 0x8000ffff, E_ACCESSDENIED = 0x80070005;

// ------------------------------------------------------------------ public SDK enums (Softimage SDK reference, public docs)
/** siComponentDataType. Values from the public SDK reference. */
export const DATA_TYPE: Record<string, number> = {
  siComponentDataTypeNone: 0, siComponentDataTypeBool: 1, siComponentDataTypeLong: 2, siComponentDataTypeFloat: 4,
  siComponentDataTypeVector2: 8, siComponentDataTypeVector3: 16, siComponentDataTypeVector4: 32, siComponentDataTypeQuaternion: 64,
  siComponentDataTypeMatrix33: 128, siComponentDataTypeMatrix44: 256, siComponentDataTypeColor4: 512, siComponentDataTypeGeometry: 1024,
  siComponentDataTypeLocation: 2048, siComponentDataTypeExecute: 4096, siComponentDataTypeReference: 8192, siComponentDataTypeRotation: 16384,
  siComponentDataTypeShape: 32768, siComponentDataTypeString: 65536, siComponentDataTypeCustomType: 131072,
};
/** siComponentDataContext (public SDK reference). */
export const DATA_CONTEXT: Record<string, number> = {
  siComponentDataContextSingleton: 1, siComponentDataContextComponent0D: 2, siComponentDataContextComponent1D: 4,
  siComponentDataContextComponent2D: 8, siComponentDataContextComponent0D2D: 16,
};
/** siComponentDataStructure (public SDK reference). */
export const DATA_STRUCTURE: Record<string, number> = { siComponentDataStructureSingle: 1, siComponentDataStructureArray: 2 };
/** siNodePortDataInsertionLocation (public SDK reference). */
export const INSERT_LOC: Record<string, number> = { siNodePortDataInsertionLocationBefore: 0, siNodePortDataInsertionLocationAfter: 1 };
/** Masks the binary validates against (note B12b, section 2). */
export const TYPE_MASK = 0xfcbff, CONTEXT_MASK = 0x1f, STRUCTURE_MASK = 0x3;
export const oneBitIn = (v: number, mask: number) => Number.isInteger(v) && v > 0 && (v & (v - 1)) === 0 && (v & mask) === v;
/** An enum argument: a number, a numeric string, or a member name (":name:enum" registry spelling accepted). */
export function enumArg(v: any, names: Record<string, number>): number | null {
  const c = siConst(v); if (c === null) return null;
  if (typeof c === 'number') return c;
  const k = Object.keys(names).find(n => n.toLowerCase() === c.toLowerCase());
  return k === undefined ? null : names[k];
}

// ------------------------------------------------------------------ graph model
export type Side = 'in' | 'out';
export interface ExposedProps { min: string; max: string; picking: string; description: string; exposeType: number; enumText: string; ppgGroup: string }
export class IcePortB12 {
  readonly kind = 'ICENodePort';
  /** siComponentDataType bits of the port; 0 = undefined (polymorphic). */
  type = 0;
  /** Structure field of the port type record (-1 = any). */
  structure = 0;
  allowedTypes = 0xfffff; allowedStructures = 0x3f;
  value: any = undefined;
  /** Value display in the ICE tree view (HideAllPortValues). */
  valueShown = true;
  /** Exposed-port properties (ports of a compound only). */
  exposed: ExposedProps | null = null;
  constructor(public name: string, public side: Side, public node: IceNodeB12, public group: string) {}
  get fullName(): string { return `${this.node.fullName}.${this.name}`; }
  get isExposed(): boolean { return this.node instanceof IceCompoundB12; }
  toString() { return this.fullName; }
}
export interface SetDataAttr { name: string; type: number; context: number; structure: number; port: IcePortB12 }
export class IceCommentB12 { readonly kind = 'ICENodeComment'; text = ''; constructor(public node: IceNodeB12) {} get fullName() { return `${this.node.fullName}.Comment`; } }
export class IceNodeB12 {
  readonly kind: string = 'ICENode';
  inputs: IcePortB12[] = []; outputs: IcePortB12[] = [];
  comment: IceCommentB12 | null = null;
  /** The graph the node lives in. Null for the tree root node and for deleted nodes. */
  parent: IceGraphB12 | null = null;
  /** Id of the mirrored node of the flat ICETreeOperator (root-graph nodes built from it). */
  flatId: number | null = null;
  /** The "port type can be set" query: a node with at least one undefined-type port. */
  polymorphic = false;
  /** The node's "editable" query (SetPortType step 2). */
  editable = true;
  /** The node belongs to a referenced model (HideAllPortValues skips it with XSIOPTASKS 0x425). */
  inReferencedModel = false;
  /** Set Data nodes: the attribute entries. */
  attributes: SetDataAttr[] | null = null;
  constructor(public name: string, public type: string, public tree: ICETreeOperator) {}
  get fullName(): string {
    if (!this.parent) return this.type === 'ICETree' ? this.tree.fullName : this.name;
    const owner = this.parent.owner;
    return `${owner ? owner.fullName : this.tree.fullName}.${this.name}`;
  }
  port(name: string, side?: Side): IcePortB12 | undefined { return [...(side !== 'out' ? this.inputs : []), ...(side !== 'in' ? this.outputs : [])].find(p => p.name === name); }
  toString() { return this.fullName; }
}
export type LayoutItem = { kind: 'port'; port: IcePortB12 } | { kind: 'group'; name: string; items: LayoutItem[] };
export class IceCompoundB12 extends IceNodeB12 {
  readonly kind = 'ICECompoundNode';
  graph: IceGraphB12;
  /** The PPG layout of the exposed input ports. */
  layout: LayoutItem[] = [];
  /** "is read-only / is a reference" (interface method 0xf8): such a compound is dropped by the commands. */
  readOnly = false;
  /** Lock levels set on the compound (0 = none). Any level makes the lock check fail with 0x80070005. */
  lockLevels = 0;
  /** Compound definition this node was made from, and its version. */
  defName: string; major = 1; minor = 0;
  constructionMode = -1;
  constructor(name: string, tree: ICETreeOperator) { super(name, 'Compound', tree); this.defName = name; this.graph = new IceGraphB12(tree, this); }
}
export interface IceLinkB12 { src: IcePortB12; dst: IcePortB12; flat?: boolean }
export class IceGraphB12 {
  nodes: IceNodeB12[] = [];
  links: IceLinkB12[] = [];
  constructor(public tree: ICETreeOperator, public owner: IceCompoundB12 | null) {}
  /** Root graph only: the node that stands for the ICE tree (its inputs are Port1..n). */
  root: IceNodeB12 | null = null;
  linksTo(p: IcePortB12) { return this.links.filter(l => l.dst === p); }
  linksFrom(p: IcePortB12) { return this.links.filter(l => l.src === p); }
  connect(src: IcePortB12, dst: IcePortB12) { this.links = this.links.filter(l => l.dst !== dst); this.links.push({ src, dst }); }
  disconnect(dst: IcePortB12) { this.links = this.links.filter(l => l.dst !== dst); }
  uniqueName(base: string, except?: IceNodeB12): string {
    const taken = (n: string) => this.nodes.some(x => x !== except && x.name === n);
    if (!taken(base)) return base; let i = 1; while (taken(`${base}${i}`)) i++; return `${base}${i}`;
  }
  /** Nodes of this graph and of every nested compound graph. */
  *allNodes(): Generator<IceNodeB12> { for (const n of this.nodes) { yield n; if (n instanceof IceCompoundB12) yield* n.graph.allNodes(); } }
}

const PORT_TYPE: Record<string, number> = { scalar: 4, vector: 16, bool: 1, any: 0 };
export const pathName = (s: string) => s.replace(/\s+/g, '_');
export function portsFromDef(n: IceNodeB12, type: string) {
  const def = ICE_NODES[type];
  if (!def) return;
  const mk = (name: string, side: Side, t: string) => { const p = new IcePortB12(name, side, n, name.replace(/\d+$/, '')); p.type = PORT_TYPE[t] ?? 0; return p; };
  n.inputs = def.inputs.map(p => mk(p.name, 'in', p.type));
  n.outputs = def.outputs.map(p => mk(p.name, 'out', p.type));
  n.polymorphic = [...n.inputs, ...n.outputs].some(p => p.type === 0);
}
/** A plain ICE node of a known type in `graph` (stand-in for a node added inside a compound). */
export function makeNode(tree: ICETreeOperator, graph: IceGraphB12, type: string, name = pathName(type)): IceNodeB12 {
  const n = new IceNodeB12(graph.uniqueName(name), type, tree); portsFromDef(n, type);
  if (type === 'Set Data') n.attributes = [];
  n.parent = graph; graph.nodes.push(n); return n;
}
/** Pass-through node (the node RemoveExposedPortPassThrough removes): one input, one output. */
export function makePassThrough(tree: ICETreeOperator, graph: IceGraphB12, name = 'Pass_Through'): IceNodeB12 {
  const n = new IceNodeB12(graph.uniqueName(name), 'Pass Through', tree);
  n.inputs = [new IcePortB12('In', 'in', n, 'In')]; n.outputs = [new IcePortB12('Out', 'out', n, 'Out')]; n.polymorphic = true;
  n.parent = graph; graph.nodes.push(n); return n;
}
/** A new compound node in `graph` with the given exposed ports (stand-in for a compound created by the ICE core). */
export function makeCompound(tree: ICETreeOperator, graph: IceGraphB12, name: string, inputs: string[] = [], outputs: string[] = []): IceCompoundB12 {
  const c = new IceCompoundB12(graph.uniqueName(pathName(name)), tree);
  c.defName = name;
  for (const p of inputs) { const port = new IcePortB12(p, 'in', c, p); port.exposed = blankExposed(); c.inputs.push(port); c.layout.push({ kind: 'port', port }); }
  for (const p of outputs) { const port = new IcePortB12(p, 'out', c, p); port.exposed = blankExposed(); c.outputs.push(port); }
  c.polymorphic = true;
  c.parent = graph; graph.nodes.push(c); return c;
}
export const blankExposed = (): ExposedProps => ({ min: '', max: '', picking: '', description: '', exposeType: 0, enumText: '', ppgGroup: '' });

/** The graph view of an ICE tree, built on first use and synced with the flat operator on every access. */
export function graphOf(op: ICETreeOperator): IceGraphB12 {
  const o = op as any;
  let g: IceGraphB12 = o.__b12graph;
  if (!g) {
    g = new IceGraphB12(op, null);
    const root = new IceNodeB12('ICETree', 'ICETree', op); root.polymorphic = false;
    g.root = root; o.__b12graph = g;
  }
  syncFlat(g);
  return g;
}
function syncFlat(g: IceGraphB12) {
  const op = g.tree;
  const byFlat = new Map<number, IceNodeB12>();
  for (const n of g.allNodes()) if (n.flatId !== null) byFlat.set(n.flatId, n);
  const alive = new Set(op.nodes.map(n => n.id));
  // flat nodes removed elsewhere (DeleteObj on the tree view, ...) leave the root graph
  for (const n of [...g.nodes]) if (n.flatId !== null && !alive.has(n.flatId)) {
    g.nodes.splice(g.nodes.indexOf(n), 1); n.parent = null;
    g.links = g.links.filter(l => l.src.node !== n && l.dst.node !== n);
  }
  for (const fn of op.nodes) if (!byFlat.has(fn.id)) byFlat.set(fn.id, mirrorFlat(g, fn));
  // flat links between two root-graph nodes
  const want = new Set<string>();
  for (const l of op.links) {
    const a = byFlat.get(l.from), b = byFlat.get(l.to);
    if (!a || !b || a.parent !== g || b.parent !== g) continue;
    const sp = a.port(l.fromPort, 'out'), dp = b.port(l.toPort, 'in'); if (!sp || !dp) continue;
    want.add(`${l.from}:${l.fromPort}>${l.to}:${l.toPort}`);
    if (!g.links.some(x => x.src === sp && x.dst === dp)) { g.links = g.links.filter(x => x.dst !== dp); g.links.push({ src: sp, dst: dp, flat: true }); }
  }
  g.links = g.links.filter(l => !l.flat || want.has(`${l.src.node.flatId}:${l.src.name}>${l.dst.node.flatId}:${l.dst.name}`));
}
function mirrorFlat(g: IceGraphB12, fn: IceNode): IceNodeB12 {
  const n = new IceNodeB12(g.uniqueName(pathName(fn.type)), fn.type, g.tree);
  n.flatId = fn.id; portsFromDef(n, fn.type);
  if (fn.type === 'Set Data') {
    const ref = String(fn.params.get('reference')?.value ?? 'PointPosition');
    const port = n.inputs[0];
    n.attributes = port ? [{ name: `Self.${ref}`, type: ref === 'PointPosition' ? 16 : 4, context: 2, structure: 1, port }] : [];
    // inferred: the build's tree has no root ports; a Set Data node is an execute branch of the tree (one root port each)
    const root = g.root!;
    const rp = new IcePortB12(`Port${root.inputs.length + 1}`, 'in', root, 'Port'); rp.type = DATA_TYPE.siComponentDataTypeExecute;
    root.inputs.push(rp);
    if (n.outputs[0]) g.links.push({ src: n.outputs[0], dst: rp });
  }
  n.parent = g; g.nodes.push(n);
  return n;
}

// ------------------------------------------------------------------ snapshots (undo / redo)
interface Snap {
  flat: { op: ICETreeOperator; nodes: IceNode[]; links: any[] }[];
  graphs: [IceGraphB12, IceNodeB12[], IceLinkB12[]][];
  nodes: [IceNodeB12, any][];
  ports: [IcePortB12, any][];
}
const copyLayout = (l: LayoutItem[]): LayoutItem[] => l.map(i => i.kind === 'port' ? { ...i } : { kind: 'group', name: i.name, items: copyLayout(i.items) });
export function snapshot(trees: ICETreeOperator[]): Snap {
  const s: Snap = { flat: [], graphs: [], nodes: [], ports: [] };
  const seenPort = new Set<IcePortB12>();
  const takeNode = (n: IceNodeB12) => {
    s.nodes.push([n, {
      name: n.name, parent: n.parent, inputs: [...n.inputs], outputs: [...n.outputs], comment: n.comment, commentText: n.comment?.text,
      attributes: n.attributes ? n.attributes.map(a => ({ ...a })) : null, editable: n.editable, inReferencedModel: n.inReferencedModel,
      layout: n instanceof IceCompoundB12 ? copyLayout(n.layout) : null, lockLevels: (n as any).lockLevels, readOnly: (n as any).readOnly,
    }]);
    for (const p of [...n.inputs, ...n.outputs]) if (!seenPort.has(p)) {
      seenPort.add(p);
      s.ports.push([p, { name: p.name, type: p.type, structure: p.structure, value: p.value, valueShown: p.valueShown, exposed: p.exposed ? { ...p.exposed } : null, group: p.group }]);
    }
  };
  const takeGraph = (g: IceGraphB12) => { s.graphs.push([g, [...g.nodes], [...g.links]]); for (const n of g.nodes) { takeNode(n); if (n instanceof IceCompoundB12) takeGraph(n.graph); } };
  for (const op of trees) {
    s.flat.push({ op, nodes: [...op.nodes], links: [...op.links] });
    const g = graphOf(op); if (g.root) takeNode(g.root); takeGraph(g);
  }
  return s;
}
export function restore(s: Snap) {
  for (const f of s.flat) { f.op.nodes = [...f.nodes]; f.op.links = [...f.links]; f.op.touch(); }
  for (const [g, nodes, links] of s.graphs) { g.nodes = [...nodes]; g.links = [...links]; }
  for (const [n, d] of s.nodes) {
    n.name = d.name; n.parent = d.parent; n.inputs = [...d.inputs]; n.outputs = [...d.outputs]; n.comment = d.comment;
    if (n.comment) n.comment.text = d.commentText ?? '';
    n.attributes = d.attributes ? d.attributes.map((a: SetDataAttr) => ({ ...a })) : null; n.editable = d.editable; n.inReferencedModel = d.inReferencedModel;
    if (n instanceof IceCompoundB12) { n.layout = copyLayout(d.layout); n.lockLevels = d.lockLevels; n.readOnly = d.readOnly; }
  }
  for (const [p, d] of s.ports) { p.name = d.name; p.type = d.type; p.structure = d.structure; p.value = d.value; p.valueShown = d.valueShown; p.exposed = d.exposed ? { ...d.exposed } : null; p.group = d.group; }
}

// ------------------------------------------------------------------ state, status, errors
export interface SimInitState { object: X3DObject; frame: number; seconds: number; positions: number[] | null }
export interface CompoundDef { name: string; major: number; minor: number; inputs: string[]; outputs: string[]; constructionMode?: number }
export interface OptasksB12State {
  lastStatus: { command: string; status: number } | null;
  /** Compound definitions known to ReplaceICECompoundNode (stand-in for the compound search path). */
  library: CompoundDef[];
  /** Initial states stored by SetICESimInitState (stand-in for the simulation service). */
  simInitStates: Map<X3DObject, SimInitState>;
  /** ICE tree view refreshes requested by HideAllPortValues. */
  refreshes: number;
  /** HideAllPortValues "refresh" flag. */
  refreshFlag: boolean;
  graphOf: typeof graphOf; makeCompound: typeof makeCompound; makePassThrough: typeof makePassThrough; makeNode: typeof makeNode;
  classes: Record<string, any>;
}
export function stateOf(app: App): OptasksB12State {
  const a = app as any;
  if (a.optasksB12) return a.optasksB12;
  const st: OptasksB12State = {
    lastStatus: null, library: [], simInitStates: new Map(), refreshes: 0, refreshFlag: true,
    graphOf, makeCompound, makePassThrough, makeNode,
    classes: { IcePortB12, IceNodeB12, IceCompoundB12, IceGraphB12, IceCommentB12 },
  };
  a.optasksB12 = st;
  return st;
}
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
/** A message raised with an XSIOPTASKS / task id (texts not in the repo). Severity 2 = error line, else warning. */
export function raise(app: App, command: string, id: string, severity = 2, detail = '') {
  app.logMsg(severity === 2 ? 'error' : 'info', `${command}: [${id}]${severity !== 2 ? ' warning' : ''}${detail ? ' ' + detail : ''}`);
}
export function logNya(app: App, command: string, what: string, row: 'CMD-B12a' | 'CMD-B12b') { app.logMsg('info', `${command}: not yet attested: ${what} (${row})`); }
/** Run one graph edit as one undoable step: snapshot, edit, snapshot. */
export function edit<T>(app: App, label: string, trees: ICETreeOperator[], fn: () => T): T {
  const before = snapshot(trees);
  let after: Snap | null = null; let out!: T;
  app.record(label, () => { if (!after) { try { out = fn(); } catch (e) { restore(before); throw e; } after = snapshot(trees); for (const t of trees) t.touch(); } else restore(after); }, () => restore(before));
  app.events.emit('scene');
  return out;
}

// ------------------------------------------------------------------ argument resolution
export function* allTrees(app: App): Generator<ICETreeOperator> {
  for (const o of app.scene.allObjects()) for (const op of o.primitive?.operators ?? []) if (op instanceof ICETreeOperator) yield op;
}
export type IceObj = IcePortB12 | IceNodeB12 | IceCommentB12;
/** Every ICE graph object of the scene by path (`<tree>.<node>[.<node>...][.<port>]`). */
function lookupPath(app: App, path: string): IceObj | ICETreeOperator | undefined {
  const want = pathName(path.trim());
  for (const op of allTrees(app)) {
    const g = graphOf(op);
    if (pathName(op.fullName) === want) return op;
    if (!want.startsWith(pathName(op.fullName) + '.')) continue;
    for (const p of g.root!.inputs) if (pathName(p.fullName) === want) return p;
    for (const n of g.allNodes()) {
      if (pathName(n.fullName) === want) return n;
      for (const p of [...n.inputs, ...n.outputs]) if (pathName(p.fullName) === want) return p;
      if (n.comment && pathName(n.comment.fullName) === want) return n.comment;
    }
  }
  return undefined;
}
export function iceArg(app: App, v: any): IceObj | ICETreeOperator | Node | undefined {
  if (unset(v)) return undefined;
  if (v instanceof IcePortB12 || v instanceof IceNodeB12 || v instanceof IceCommentB12 || v instanceof ICETreeOperator) return v;
  if (Array.isArray(v)) return iceArg(app, v[0]);
  if (typeof v === 'string') return lookupPath(app, v) ?? findNode(app, v);
  if (v instanceof Node) return v;
  return undefined;
}
/** Items of a list argument: arrays, comma-separated strings, single objects. */
export function listArg(app: App, v: any, selectionDefault: boolean): any[] {
  if (unset(v)) return selectionDefault ? [...app.selection] : [];
  if (Array.isArray(v)) return v.flatMap(x => listArg(app, x, false));
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean).map(s => iceArg(app, s) ?? s);
  return [iceArg(app, v) ?? v];
}
/** The compound-node interface + "is read-only" test: an editable compound, or null (dropped). */
export function editableCompound(x: any): IceCompoundB12 | null { return x instanceof IceCompoundB12 && !x.readOnly ? x : null; }
/** The lock check every compound edit makes (all lock levels, 0xffff). */
export function lockCheck(app: App, command: string, c: IceCompoundB12) {
  if (c.lockLevels & 0xffff) { app.logMsg('error', `${command}: ${c.fullName} is locked`); throw fail(E_ACCESSDENIED, `${command}: ${c.fullName} is locked`); }
}
/** The ICE node of an item (an ICE node, or the node owning a port). */
export function nodeOfItem(x: any): IceNodeB12 | null { return x instanceof IceNodeB12 ? x : x instanceof IcePortB12 ? x.node : null; }
/** Remove a port from a compound's PPG layout; empty groups left behind are removed too. */
export function dropFromLayout(items: LayoutItem[], port: IcePortB12, pruneEmpty: boolean): boolean {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'port' && it.port === port) { items.splice(i, 1); return true; }
    if (it.kind === 'group' && dropFromLayout(it.items, port, pruneEmpty)) { if (pruneEmpty && !it.items.length) items.splice(i, 1); return true; }
  }
  return false;
}
/** Find a layout item by name (port name or group name) with its container. */
export function findLayout(items: LayoutItem[], name: string): { list: LayoutItem[]; item: LayoutItem } | null {
  for (const it of items) {
    if ((it.kind === 'port' ? it.port.name : it.name) === name) return { list: items, item: it };
    if (it.kind === 'group') { const r = findLayout(it.items, name); if (r) return r; }
  }
  return null;
}
export function layoutGroups(items: LayoutItem[], out: string[] = []): string[] { for (const it of items) if (it.kind === 'group') { out.push(it.name); layoutGroups(it.items, out); } return out; }
export function uniqueGroupName(c: IceCompoundB12, base: string, except = ''): string {
  const taken = new Set(layoutGroups(c.layout).filter(n => n !== except).map(n => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base; let i = 1; while (taken.has(`${base}${i}`.toLowerCase())) i++; return `${base}${i}`;
}
