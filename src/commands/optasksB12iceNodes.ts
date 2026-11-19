// Ledger row CMD-B12b (optasks.dll): ICE node / port / attribute / comment / simulation-state commands.
//   AddPortToICENode2 RemovePortFromICENode AddNodeToICECompoundNode RemoveNodeFromICECompoundNode
//   AddAttributeToSetDataICENode RemoveAttributeFromSetDataICENode SetPortType CleanDisconnectedICENodes
//   CreateICENodeComment SetICESimInitState RemoveICESimInitState TransferICETree
// Brief: docs/ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md, section 3. Original code from that prose only.
// Graph model: optasksB12iceModel.ts. Gaps filled by reasoning are marked `// inferred`; branches the note leaves open
// log "not yet attested".
import { App, CommandDef } from '../core/commands';
import { Node, Operator, X3DObject, construction } from '../core/scene';
import { ICETreeOperator } from '../core/ice';
import { boolArg } from './viewEditPropertyHelpers';
import {
  S_OK, S_FALSE, SI_NOCHANGE, E_INVALIDARG, E_FAIL, E_UNEXPECTED, E_POINTER, IcePortB12, IceNodeB12, IceCompoundB12, IceCommentB12,
  DATA_TYPE, DATA_CONTEXT, DATA_STRUCTURE, INSERT_LOC, TYPE_MASK, CONTEXT_MASK, STRUCTURE_MASK, oneBitIn, enumArg, blankExposed,
  stateOf, fail, setStatus, raise, logNya, edit, iceArg, listArg, editableCompound, nodeOfItem, dropFromLayout, graphOf, unset, type SimInitState,
} from './optasksB12iceModel';

const ROW = 'CMD-B12b';
const nya = (app: App, c: string, what: string) => logNya(app, c, what, ROW);
const str = (v: any) => unset(v) ? '' : String(v);
const invalid = (app: App, C: string, what: string) => { raise(app, C, '0x111'); return fail(E_INVALIDARG, `${C}: ${what}`); };

function portArg(app: App, C: string, v: any): IcePortB12 {
  const p = iceArg(app, v);
  if (!(p instanceof IcePortB12)) throw fail(E_INVALIDARG, `${C}: ${unset(v) ? 'no Port given' : `"${String(v)}" is not an ICE node port`}`);
  return p;
}
const uniquePortName = (n: IceNodeB12, base: string) => { const all = [...n.inputs, ...n.outputs]; if (!all.some(p => p.name === base)) return base; let i = 1; while (all.some(p => p.name === `${base}${i}`)) i++; return `${base}${i}`; };

// ------------------------------------------------------------------ AddPortToICENode2 / RemovePortFromICENode
function addPort(app: App, a: Record<string, any>) {
  const C = 'AddPortToICENode2';
  const port = portArg(app, C, a.Port);
  const loc = enumArg(a.InsertLocation, INSERT_LOC);
  if (loc !== 0 && loc !== 1) throw fail(E_INVALIDARG, `${C}: InsertLocation must be siNodePortDataInsertionLocationBefore or ...After`);   // inferred
  const n = port.node;
  const created = edit(app, C, [n.tree], () => {
    const list = port.side === 'in' ? n.inputs : n.outputs;
    // a new instance of the port's group, inserted before / after the given instance
    // inferred: the new instance is named after the group with the next free number
    const fresh = new IcePortB12(uniquePortName(n, `${port.group}${list.filter(p => p.group === port.group).length + 1}`), port.side, n, port.group);
    fresh.type = port.type; fresh.structure = port.structure; fresh.allowedTypes = port.allowedTypes; fresh.allowedStructures = port.allowedStructures;
    if (port.exposed) fresh.exposed = blankExposed();
    list.splice(list.indexOf(port) + (loc === 1 ? 1 : 0), 0, fresh);
    if (n instanceof IceCompoundB12 && fresh.side === 'in') n.layout.push({ kind: 'port', port: fresh });   // inferred: listed in the PPG layout
    return [fresh];
  });
  a.NewPorts = created;
  setStatus(app, C, S_OK);
  return created;
}
function removePort(app: App, a: Record<string, any>) {
  const C = 'RemovePortFromICENode';
  const port = portArg(app, C, a.Port);
  const n = port.node;
  const list = port.side === 'in' ? n.inputs : n.outputs;
  if (list.filter(p => p.group === port.group).length <= 1) {
    nya(app, C, `removing the last instance of the port group "${port.group}" of ${n.fullName} (Do 0x1800bffd0 not read); nothing was removed`);
    setStatus(app, C, S_FALSE); return;
  }
  edit(app, C, [n.tree], () => {
    if (port.side === 'in') n.inputs = n.inputs.filter(p => p !== port); else n.outputs = n.outputs.filter(p => p !== port);
    // inferred: connections on the removed instance are dropped (both sides of an exposed port)
    for (const g of [n.parent, n instanceof IceCompoundB12 ? n.graph : null]) if (g) g.links = g.links.filter(l => l.src !== port && l.dst !== port);
    if (n instanceof IceCompoundB12) dropFromLayout(n.layout, port, false);
  });
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ AddNodeToICECompoundNode / RemoveNodeFromICECompoundNode
const newExposed = (c: IceCompoundB12, side: 'in' | 'out', like: IcePortB12) => {
  const p = new IcePortB12(uniquePortName(c, like.name), side, c, like.name.replace(/\d+$/, '') || like.name);
  p.type = like.type; p.value = like.value; p.exposed = blankExposed();
  if (side === 'in') { c.inputs.push(p); c.layout.push({ kind: 'port', port: p }); } else c.outputs.push(p);
  return p;
};
/** Shared mover (direction "into"): crossing connections are kept through exposed ports of the compound. */
function moveInto(c: IceCompoundB12, nodes: IceNodeB12[]) {
  const G = c.parent!, I = c.graph; const M = new Set(nodes);
  const ins = new Map<IcePortB12, IcePortB12>(), outs = new Map<IcePortB12, IcePortB12>();
  const keep: typeof G.links = [];
  for (const l of G.links) {
    const sm = M.has(l.src.node), dm = M.has(l.dst.node);
    if (sm && dm) { I.links.push({ src: l.src, dst: l.dst }); continue; }
    if (sm) {
      if (l.dst.node === c) { for (const il of I.linksFrom(l.dst)) { I.disconnect(il.dst); I.links.push({ src: l.src, dst: il.dst }); } continue; }   // inferred
      let q = outs.get(l.src); if (!q) { q = newExposed(c, 'out', l.src); outs.set(l.src, q); I.links.push({ src: l.src, dst: q }); }
      keep.push({ src: q, dst: l.dst }); continue;
    }
    if (dm) {
      if (l.src.node === c) { const s = I.linksTo(l.src)[0]?.src; if (s) I.links.push({ src: s, dst: l.dst }); continue; }   // inferred
      let p = ins.get(l.src); if (!p) { p = newExposed(c, 'in', l.dst); ins.set(l.src, p); keep.push({ src: l.src, dst: p }); }
      I.links.push({ src: p, dst: l.dst }); continue;
    }
    keep.push(l);
  }
  G.links = keep;
  for (const n of nodes) { G.nodes.splice(G.nodes.indexOf(n), 1); n.name = I.uniqueName(n.name); n.parent = I; I.nodes.push(n); }
}
/** Shared mover (direction "out"): crossing connections are kept through the compound's exposed ports. */
function moveOut(c: IceCompoundB12, nodes: IceNodeB12[]) {
  const G = c.parent!, I = c.graph; const M = new Set(nodes);
  const ins = new Map<IcePortB12, IcePortB12>(), outs = new Map<IcePortB12, IcePortB12>();
  const keep: typeof I.links = [];
  for (const l of I.links) {
    const sm = M.has(l.src.node), dm = M.has(l.dst.node);
    if (sm && dm) { G.links.push({ src: l.src, dst: l.dst }); continue; }
    if (sm) {
      if (l.dst.node === c) { const q = l.dst; G.links = G.links.map(ol => ol.src === q ? { src: l.src, dst: ol.dst } : ol); continue; }   // inferred: outer users of the output now read the node
      let p = ins.get(l.src); if (!p) { p = newExposed(c, 'in', l.src); ins.set(l.src, p); G.links.push({ src: l.src, dst: p }); }
      keep.push({ src: p, dst: l.dst }); continue;
    }
    if (dm) {
      if (l.src.node === c) { const s = G.linksTo(l.src)[0]?.src; if (s) G.links.push({ src: s, dst: l.dst }); continue; }   // inferred
      let q = outs.get(l.src); if (!q) { q = newExposed(c, 'out', l.dst); outs.set(l.src, q); keep.push({ src: l.src, dst: q }); }
      G.links.push({ src: q, dst: l.dst }); continue;
    }
    keep.push(l);
  }
  I.links = keep;
  for (const n of nodes) { I.nodes.splice(I.nodes.indexOf(n), 1); n.name = G.uniqueName(n.name); n.parent = G; G.nodes.push(n); }
}
function addNodes(app: App, a: Record<string, any>) {
  const C = 'AddNodeToICECompoundNode';
  const c = editableCompound(iceArg(app, a.Compound));
  if (!c || !c.parent) throw fail(E_FAIL, `${C}: ${unset(a.Compound) ? 'no Compound given' : `"${String(a.Compound)}" is not an editable ICE compound node`}`);
  if (unset(a.InputObj)) throw invalid(app, C, 'no node list');
  const kept: IceNodeB12[] = [];
  for (const x of listArg(app, a.InputObj, false)) { const n = nodeOfItem(x); if (n && n !== c && n.parent === c.parent && !kept.includes(n)) kept.push(n); }   // other graphs: skipped
  if (!kept.length) { setStatus(app, C, S_OK); return; }
  edit(app, C, [c.tree], () => moveInto(c, kept));
  setStatus(app, C, S_OK);
}
function removeNodes(app: App, a: Record<string, any>) {
  const C = 'RemoveNodeFromICECompoundNode';
  if (unset(a.InputObj)) throw fail(E_FAIL, `${C}: no node given`);
  let c: IceCompoundB12 | null = null; const kept: IceNodeB12[] = [];
  for (const x of listArg(app, a.InputObj, false)) {
    const n = nodeOfItem(x); const owner = n?.parent?.owner ?? null;
    if (!n || !owner) continue;
    if (!c) { if (!editableCompound(owner)) continue; c = owner; }
    if (owner === c && !kept.includes(n)) kept.push(n);
  }
  if (!c || !c.parent) throw fail(E_FAIL, `${C}: no item is inside an editable ICE compound node`);
  edit(app, C, [c.tree], () => moveOut(c!, kept));
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ Set Data attributes
function setDataArg(app: App, C: string, v: any): IceNodeB12 {
  const n = iceArg(app, v);
  // inferred: anything but a Set Data node is an argument failure
  if (!(n instanceof IceNodeB12) || n.type !== 'Set Data') throw fail(E_INVALIDARG, `${C}: ${unset(v) ? 'no SetDataNode given' : `"${String(v)}" is not a Set Data ICE node`}`);
  n.attributes ??= [];
  return n;
}
function addAttribute(app: App, a: Record<string, any>) {
  const C = 'AddAttributeToSetDataICENode';
  const n = setDataArg(app, C, a.SetDataNode);
  const type = enumArg(a.AttributeType, DATA_TYPE) ?? NaN;
  if (!oneBitIn(type, TYPE_MASK)) { raise(app, C, 'XSIOPTASKS 0x41C'); throw fail(E_INVALIDARG, `${C}: invalid AttributeType ${a.AttributeType}`); }
  const ctx = enumArg(a.AttributeContext, DATA_CONTEXT) ?? NaN;
  if (!oneBitIn(ctx, CONTEXT_MASK)) { raise(app, C, 'XSIOPTASKS 0x41D'); throw fail(E_INVALIDARG, `${C}: invalid AttributeContext ${a.AttributeContext}`); }
  const struct = enumArg(a.AttributeStructure, DATA_STRUCTURE) ?? NaN;
  if (!oneBitIn(struct, STRUCTURE_MASK)) { raise(app, C, 'XSIOPTASKS 0x41E'); throw fail(E_INVALIDARG, `${C}: invalid AttributeStructure ${a.AttributeStructure}`); }
  const name = str(a.AttributeName);
  const attr = edit(app, C, [n.tree], () => {
    // inferred: the new input port is named after the attribute's last name segment ("Value" for an empty name)
    const port = new IcePortB12(uniquePortName(n, name.split('.').pop() || 'Value'), 'in', n, 'Attribute');
    port.type = type; port.structure = struct;
    n.inputs.push(port);
    const at = { name, type, context: ctx, structure: struct, port };
    n.attributes!.push(at);
    return at;
  });
  setStatus(app, C, S_OK);
  return attr.port;
}
function removeAttribute(app: App, a: Record<string, any>) {
  const C = 'RemoveAttributeFromSetDataICENode';
  const n = setDataArg(app, C, a.SetDataNode);
  const name = str(a.AttributeName);
  const at = n.attributes!.find(x => x.name === name) ?? n.attributes!.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!at) { nya(app, C, `the behaviour with an unknown attribute name ("${name}" is not on ${n.fullName}); nothing was removed`); setStatus(app, C, S_FALSE); return; }
  edit(app, C, [n.tree], () => {
    n.attributes = n.attributes!.filter(x => x !== at);
    n.inputs = n.inputs.filter(p => p !== at.port);
    if (n.parent) n.parent.links = n.parent.links.filter(l => l.dst !== at.port);
  });
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ SetPortType
function setPortType(app: App, a: Record<string, any>) {
  const C = 'SetPortType';
  const type = enumArg(a.Type, DATA_TYPE) ?? NaN;
  if (!oneBitIn(type, TYPE_MASK)) { raise(app, C, 'XSIOPTASKS 0x42E'); throw fail(E_INVALIDARG, `${C}: invalid Type ${a.Type}`); }
  let port = portArg(app, C, a.Port);
  // 1. an exposed port is followed to the inner node's port
  if (port.node instanceof IceCompoundB12) {
    const g = port.node.graph;
    const inner = port.side === 'in' ? g.linksFrom(port)[0]?.dst : g.linksTo(port)[0]?.src;
    if (!inner) throw fail(E_FAIL, `${C}: ${port.fullName} is not connected to an inner node port`);
    port = inner;
  }
  // 2. the owning node must exist and be editable
  const n = port.node;
  if (!n || !n.editable) throw fail(E_FAIL, `${C}: the node of ${port.fullName} is not editable`);
  // 3. a node whose type is defined (not polymorphic): nothing changes
  if (!n.polymorphic) { raise(app, C, 'XSIOPTASKS 0x42F'); setStatus(app, C, SI_NOCHANGE); return SI_NOCHANGE; }
  // 4. the port's allowed types
  if (!(type & port.allowedTypes)) { raise(app, C, 'XSIOPTASKS 0x430'); setStatus(app, C, SI_NOCHANGE); return SI_NOCHANGE; }
  // 5. / 6. the new record: type, structure "any" (-1) for bit 0x10000 else 0
  const p = port;
  edit(app, C, [n.tree], () => { p.type = type; p.structure = type & 0x10000 ? -1 : 0; });
  setStatus(app, C, S_OK);
  return S_OK;
}

// ------------------------------------------------------------------ CleanDisconnectedICENodes
function cleanDisconnected(app: App, a: Record<string, any>) {
  const C = 'CleanDisconnectedICENodes';
  const op = iceArg(app, a.ICETree);
  if (!(op instanceof Operator)) throw fail(E_INVALIDARG, `${C}: ${unset(a.ICETree) ? 'no ICETree given' : `"${String(a.ICETree)}" is not an operator`}`);
  if (!(op instanceof ICETreeOperator)) throw fail(E_INVALIDARG, `${C}: ${op.fullName} has no ICE graph`);   // inferred
  const g = graphOf(op);
  // inferred (open question 5): a node is connected when it feeds the tree's root node, directly or through other nodes
  const live = new Set<IceNodeB12>();
  const visit = (n: IceNodeB12) => { if (live.has(n)) return; live.add(n); for (const p of n.inputs) for (const l of g.linksTo(p)) visit(l.src.node); };
  if (g.root) for (const p of g.root.inputs) for (const l of g.linksTo(p)) visit(l.src.node);
  const dead = g.nodes.filter(n => !live.has(n));
  if (!dead.length) { setStatus(app, C, S_OK); return []; }
  const names = dead.map(n => n.fullName);
  edit(app, C, [op], () => {
    for (const n of dead) {
      g.nodes = g.nodes.filter(x => x !== n); n.parent = null;
      g.links = g.links.filter(l => l.src.node !== n && l.dst.node !== n);
      if (n.flatId !== null) { op.nodes = op.nodes.filter(x => x.id !== n.flatId); op.links = op.links.filter(l => l.from !== n.flatId && l.to !== n.flatId); }
    }
  });
  setStatus(app, C, S_OK);
  return names;
}

// ------------------------------------------------------------------ CreateICENodeComment
function createComment(app: App, a: Record<string, any>) {
  const C = 'CreateICENodeComment';
  const n = listArg(app, a.InputObj, false).find((x): x is IceNodeB12 => x instanceof IceNodeB12);
  if (!n) throw fail(E_UNEXPECTED, `${C}: no ICE node in InputObj`);
  if (n.comment) throw invalid(app, C, `${n.fullName} already has a comment`);
  const comment = edit(app, C, [n.tree], () => {
    if (n.comment) throw invalid(app, C, `${n.fullName} already has a comment`);
    n.comment = new IceCommentB12(n);
    return n.comment;
  });
  if (!comment) throw fail(E_POINTER, `${C}: no comment was created`);
  a.Value = comment;
  setStatus(app, C, S_OK);
  return comment;
}

// ------------------------------------------------------------------ SetICESimInitState / RemoveICESimInitState
const simObjects = (app: App, v: any) => listArg(app, v, true).map(x => x instanceof Node ? x : typeof x === 'string' ? app.scene.find(x) : x).filter((x): x is X3DObject => x instanceof X3DObject);
function setSimInit(app: App, a: Record<string, any>) {
  const C = 'SetICESimInitState';
  const objs = simObjects(app, a.InputObj);
  const frame = unset(a.Time) ? app.anim.frame : Number(a.Time);
  if (!Number.isFinite(frame)) throw fail(E_INVALIDARG, `${C}: Time must be a frame number`);
  const seconds = frame / (app.anim.fps || 30);
  const st = stateOf(app);
  const before = new Map(objs.map(o => [o, st.simInitStates.get(o)]));
  const after = new Map<X3DObject, SimInitState>();
  for (const o of objs) {
    let positions: number[] | null = null;
    try { const m = o.primitive?.mesh(); if (m) positions = Array.from(m.positions); } catch { /* no geometry */ }
    after.set(o, { object: o, frame, seconds, positions });
  }
  app.record(C, () => { for (const [o, s] of after) st.simInitStates.set(o, s); }, () => { for (const [o, s] of before) { if (s) st.simInitStates.set(o, s); else st.simInitStates.delete(o); } });
  nya(app, C, 'the simulation service: the property that stores the initial state and the behaviour on non-simulated objects (kept here as a point snapshot per object)');
  setStatus(app, C, S_OK);
  return [...after.values()];
}
function removeSimInit(app: App, a: Record<string, any>) {
  const C = 'RemoveICESimInitState';
  const objs = simObjects(app, a.InputObj);
  const st = stateOf(app);
  const had = objs.map(o => [o, st.simInitStates.get(o)] as const).filter(([, s]) => !!s);
  app.record(C, () => { for (const [o] of had) st.simInitStates.delete(o); }, () => { for (const [o, s] of had) st.simInitStates.set(o, s!); });
  nya(app, C, 'the simulation service side of the removal (the stand-in initial state is dropped)');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ TransferICETree
function transferTree(app: App, a: Record<string, any>) {
  const C = 'TransferICETree';
  const mode = unset(a.Mode) ? 0 : a.Mode;
  if (typeof mode !== 'number' || !Number.isInteger(mode) || (mode !== 0 && mode !== 1)) throw fail(E_INVALIDARG, `${C}: Mode must be 0 or 1`);
  const branch = boolArg(a.Branch);
  const op = iceArg(app, a.Operator);
  if (!(op instanceof ICETreeOperator)) throw fail(E_INVALIDARG, `${C}: ${unset(a.Operator) ? 'no Operator given' : `"${String(a.Operator)}" is not an ICE tree operator`}`);
  const target = iceArg(app, a['3DObject']);
  if (!(target instanceof X3DObject)) throw fail(E_INVALIDARG, `${C}: ${unset(a['3DObject']) ? 'no 3DObject given' : `"${String(a['3DObject'])}" is not a 3D object`}`);
  // A tree is moved onto 3DObject's stack when 3DObject has geometry. With Branch it becomes a branch tree of 3DObject
  // (inferred: it applies to 3DObject's branch); the build evaluates a tree only on the object whose stack holds it, so a
  // branch tree given a target without geometry (a null, a model) stays on its object and records 3DObject as its branch
  // host (fields `branch` / `branchHost`, the ones the CMD-B6c stand-in uses).
  if (!target.primitive && !branch) throw fail(E_INVALIDARG, `${C}: "${target.fullName}" has no geometry to hold an ICE tree`);
  const from = op.parent as any; const to = target.primitive;
  const move = !!to && from !== to;
  const o = op as any; const oldBranch = { branch: o.branch, host: o.branchHost };
  const oldIdx = from ? from.operators.indexOf(op) : -1; const oldRegion = op.region; const oldOwner = op.owner;
  // inferred: Mode 0 keeps the operator's construction region, Mode 1 puts it in the current construction mode's region
  const region = mode === 1 ? construction.mode : oldRegion;
  if (!move && !branch) { setStatus(app, C, S_OK); a.Value = op; return op; }
  app.record('Move ICETree', () => {
    if (move) {
      if (from) { from.operators.splice(from.operators.indexOf(op), 1); from.dirty = true; }
      op.region = region; to!.addOperator(op); o.owner = () => target;
    }
    if (branch) { o.branch = true; o.branchHost = target; }
    op.touch();
  }, () => {
    if (move) {
      to!.operators.splice(to!.operators.indexOf(op), 1); to!.dirty = true;
      op.region = oldRegion; o.owner = oldOwner;
      if (from) { from.operators.splice(Math.max(0, oldIdx), 0, op); op.parent = from; from.dirty = true; }
    }
    if (branch) { o.branch = oldBranch.branch; o.branchHost = oldBranch.host; }
    op.touch();
  });
  if (branch) nya(app, C, `Branch = true: ${op.name} is a branch tree of ${target.name}${move ? '' : ' and still evaluates on the object that holds it'} (the branch evaluation is not in this build)`);
  app.events.emit('scene');
  a.Value = op;
  setStatus(app, C, S_OK);
  return op;
}

export function optasksB12NodeDefs(): CommandDef[] {
  return [
    { name: 'AddPortToICENode2', label: 'Add Port to ICENode', category: 'Edit', description: 'Adds a node port at the specified location.',
      args: [{ name: 'Port', default: null }, { name: 'InsertLocation', default: ':siNodePortDataInsertionLocationBefore:siNodePortDataInsertionLocation' }],
      execute: (app, a) => addPort(app, a) },
    { name: 'RemovePortFromICENode', label: 'Remove Port from ICENode', category: 'Edit', description: 'Remove the specified node port.',
      args: [{ name: 'Port', default: null }], execute: (app, a) => removePort(app, a) },
    { name: 'AddNodeToICECompoundNode', label: 'Add Node To ICE Compound', category: 'Simulation', description: '',
      args: [{ name: 'InputObj', default: null }, { name: 'Compound', default: null }], execute: (app, a) => addNodes(app, a) },
    { name: 'RemoveNodeFromICECompoundNode', label: 'Remove Node From ICE Compound', category: 'Simulation', description: "Moves a graph node from the compound node into the parent's container",
      args: [{ name: 'InputObj', default: null }], execute: (app, a) => removeNodes(app, a) },
    { name: 'AddAttributeToSetDataICENode', label: 'Add Attribute to SetData Node', category: 'Edit', description: 'Add a new attribute to the specified SetData node.',
      args: [{ name: 'SetDataNode', default: null }, { name: 'AttributeName', default: '' }, { name: 'AttributeType', default: ':siComponentDataTypeFloat:siComponentDataType' },
        { name: 'AttributeContext', default: ':siComponentDataContextComponent0D:siComponentDataContext' }, { name: 'AttributeStructure', default: ':siComponentDataStructureSingle:siComponentDataStructure' }],
      execute: (app, a) => addAttribute(app, a) },
    { name: 'RemoveAttributeFromSetDataICENode', label: 'Remove Attribute from SetData Node', category: 'Edit', description: 'Removes an existing attribute from a set data node.',
      args: [{ name: 'SetDataNode', default: null }, { name: 'AttributeName', default: '' }], execute: (app, a) => removeAttribute(app, a) },
    { name: 'SetPortType', label: 'Set Port Type', category: 'Simulation', description: 'Set specific port type.',
      args: [{ name: 'Port', default: null }, { name: 'Type', default: ':siComponentDataTypeFloat:siComponentDataType' }], execute: (app, a) => setPortType(app, a) },
    { name: 'CleanDisconnectedICENodes', label: 'Clean Disconnected Nodes', category: 'Edit', description: 'Clean the nodes that are not connected in the node tree.',
      args: [{ name: 'ICETree', default: null }], execute: (app, a) => cleanDisconnected(app, a) },
    { name: 'CreateICENodeComment', label: 'Create ICENode Comment', category: 'Simulation', description: 'Creates a comment on the ICENode',
      args: [{ name: 'InputObj', default: null }], execute: (app, a) => createComment(app, a) },
    { name: 'SetICESimInitState', label: 'Set Simulation Init State', category: 'Simulation', description: 'Set the current state of the point cloud as the simulation initial state',
      args: [{ name: 'InputObj', default: null }, { name: 'Time', default: null }], execute: (app, a) => setSimInit(app, a) },
    { name: 'RemoveICESimInitState', label: 'Remove Simulation Init State', category: 'Simulation', description: 'Remove the simulation initial state of the point cloud ',
      args: [{ name: 'InputObj', default: null }], execute: (app, a) => removeSimInit(app, a) },
    { name: 'TransferICETree', label: 'Move ICETree', category: 'Edit', description: 'Move the ICETree to an other object',
      args: [{ name: 'Operator', default: null }, { name: '3DObject', default: null }, { name: 'Mode', default: 0 }, { name: 'Branch', default: false }],
      execute: (app, a) => transferTree(app, a) },
  ];
}
