// Ledger row CMD-B12a (optasks.dll): ICE compound editing commands.
//   AddExposedParamToICECompoundNode EditExposedParamInICECompoundNode RemoveExposedParamFromICECompoundNode
//   RemoveExposedPortPassThrough GetICECompoundPortProperties MoveICECompoundPort MoveICECompoundPortsAndLayoutGroups
//   CreateLayoutGroupInICECompoundNode RenameICEPPGLayoutGroup HideAllPortValues PrivateGetCompoundConstructionMode
//   ReplaceICECompoundNode
// Brief: docs/ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md, section 3. Original code from that prose only.
// Graph model: optasksB12iceModel.ts. Gaps filled by reasoning are marked `// inferred`; branches the note leaves open
// log "not yet attested".
import { App, CommandDef } from '../core/commands';
import { hostFs } from '../core/sdkHelpersHostFs';
import { installPath } from './tasksB11cShared';
import {
  S_OK, S_FALSE, E_INVALIDARG, E_FAIL, IcePortB12, IceNodeB12, IceCompoundB12, type LayoutItem,
  stateOf, fail, setStatus, raise, logNya, edit, iceArg, listArg, editableCompound, lockCheck, dropFromLayout, findLayout,
  uniqueGroupName, blankExposed, unset, makeCompound,
} from './optasksB12iceModel';

const ROW = 'CMD-B12a';
const nya = (app: App, c: string, what: string) => logNya(app, c, what, ROW);
const str = (v: any) => unset(v) ? '' : String(v);
const intArg = (v: any, d: number) => { if (unset(v)) return d; const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : NaN; };

/** UnPackArg of the compound commands: the compound-node interface, not read-only; else 0x80004005. */
function compoundArg(app: App, C: string, v: any): IceCompoundB12 {
  const c = editableCompound(iceArg(app, v));
  if (!c) throw fail(E_FAIL, `${C}: ${unset(v) ? 'no compound given' : `"${String(v)}" is not an editable ICE compound node`}`);
  return c;
}
/** An exposed port argument and its compound (UnPackArg resolves the compound from the port; none -> 0x80004005). */
function exposedArg(app: App, C: string, v: any): { port: IcePortB12; c: IceCompoundB12 } {
  const p = iceArg(app, v);
  const c = p instanceof IcePortB12 ? editableCompound(p.node) : null;
  if (!c || !(p instanceof IcePortB12)) throw fail(E_FAIL, `${C}: ${unset(v) ? 'no port given' : `"${String(v)}" is not an exposed port of an editable compound`}`);
  return { port: p, c };
}
/** Array argument (vt 8204): an array, else 0x80070057. Strings with commas are accepted as the scripting spelling. */
function namesArg(C: string, v: any): string[] {
  if (Array.isArray(v)) return v.map(x => x instanceof IcePortB12 ? x.name : String(x)).filter(Boolean);
  if (typeof v === 'string' && v) return v.split(',').map(s => s.trim()).filter(Boolean);   // inferred: scripting spelling of a string array
  throw fail(E_INVALIDARG, `${C}: Names must be an array`);
}
/** Take the named layout items out of the layout (port names and group names), in list order. */
function takeItems(c: IceCompoundB12, names: string[]): LayoutItem[] {
  const out: LayoutItem[] = [];
  for (const n of names) {
    let hit = findLayout(c.layout, n);
    if (!hit) { const port = c.inputs.find(p => p.name === n); if (port) { out.push({ kind: 'port', port }); continue; } }   // inferred: an input not yet in the layout
    if (!hit) continue;   // inferred: unknown names are ignored
    hit.list.splice(hit.list.indexOf(hit.item), 1); out.push(hit.item);
  }
  return out;
}

// ------------------------------------------------------------------ RenameICEPPGLayoutGroup
function renameGroup(app: App, a: Record<string, any>) {
  const C = 'RenameICEPPGLayoutGroup';
  const c = compoundArg(app, C, a.Compound);
  const name = str(a.Name); const want = str(a.NewName);
  if (!name) throw fail(E_INVALIDARG, `${C}: Name is empty`);
  if (name.toLowerCase() === want.toLowerCase()) { setStatus(app, C, S_FALSE); return want; }
  lockCheck(app, C, c);
  const hit = findLayout(c.layout, name);
  if (!hit || hit.item.kind !== 'group') throw fail(E_INVALIDARG, `${C}: ${c.fullName} has no layout group "${name}"`);   // inferred: compound method failure
  const group = hit.item;
  // inferred: the compound makes the new name unique among the layout groups; an empty NewName keeps an empty name
  const final = want ? uniqueGroupName(c, want, name) : '';
  edit(app, C, [c.tree], () => { group.name = final; });
  a.NewName = final;
  setStatus(app, C, S_OK);
  return final;
}

// ------------------------------------------------------------------ CreateLayoutGroupInICECompoundNode
function createGroup(app: App, a: Record<string, any>) {
  const C = 'CreateLayoutGroupInICECompoundNode';
  const c = compoundArg(app, C, a.Compound);
  const names = namesArg(C, a.Names);
  if (!names.length) throw fail(E_INVALIDARG, `${C}: Names is empty`);
  const group = str(a.Group) || 'Group';
  lockCheck(app, C, c);
  const final = edit(app, C, [c.tree], () => {
    // inferred: the new group takes the place of the first listed item that is in the layout
    const first = names.map(n => findLayout(c.layout, n)).find(Boolean);
    const list = first ? first.list : c.layout; const at = first ? list.indexOf(first.item) : list.length;
    const nm = uniqueGroupName(c, group);   // inferred: made unique by the compound
    const items = takeItems(c, names);
    if (!items.length) throw fail(E_INVALIDARG, `${C}: none of the names is an exposed port or layout group of ${c.fullName}`);   // inferred
    list.splice(Math.min(at, list.length), 0, { kind: 'group', name: nm, items });
    return nm;
  });
  a.Value = final;
  setStatus(app, C, S_OK);
  return final;
}

// ------------------------------------------------------------------ MoveICECompoundPortsAndLayoutGroups
function moveItems(app: App, a: Record<string, any>) {
  const C = 'MoveICECompoundPortsAndLayoutGroups';
  const c = compoundArg(app, C, a.Compound);
  const names = namesArg(C, a.Names);
  const marker = str(a.Marker);
  if (!names.length) throw fail(E_INVALIDARG, `${C}: Names is empty`);
  if (!marker) throw fail(E_INVALIDARG, `${C}: Marker is empty`);
  const action = intArg(a.MoveAction, 1);
  lockCheck(app, C, c);
  // inferred (open question 1): 0 = before the marker, 1 = after it
  if (action !== 0 && action !== 1) { nya(app, C, `MoveAction ${a.MoveAction} (only 0 = before and 1 = after are inferred); nothing was moved`); setStatus(app, C, S_FALSE); return; }
  if (names.includes(marker)) throw fail(E_INVALIDARG, `${C}: Marker "${marker}" is one of the moved items`);   // inferred
  if (!findLayout(c.layout, marker)) throw fail(E_INVALIDARG, `${C}: ${c.fullName} has no layout item "${marker}"`);   // inferred
  edit(app, C, [c.tree], () => {
    const items = takeItems(c, names);
    const m = findLayout(c.layout, marker)!;
    const i = m.list.indexOf(m.item);
    m.list.splice(action === 0 ? i : i + 1, 0, ...items);
  });
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ MoveICECompoundPort
function movePort(app: App, a: Record<string, any>) {
  const C = 'MoveICECompoundPort';
  const step = intArg(a.Step, 1);
  if (!step || !Number.isFinite(step)) throw fail(E_INVALIDARG, `${C}: Step must not be 0`);
  const p = iceArg(app, a.InputObj);
  if (!(p instanceof IcePortB12)) throw fail(E_INVALIDARG, `${C}: ${unset(a.InputObj) ? 'no port given' : `"${String(a.InputObj)}" is not a port`}`);
  const c = editableCompound(p.node);
  if (!c) throw fail(E_INVALIDARG, `${C}: ${p.fullName} has no editable owning compound`);
  lockCheck(app, C, c);
  const side = p.side === 'in' ? c.inputs : c.outputs;
  const from = side.indexOf(p);
  if (from < 0) throw fail(E_FAIL, `${C}: ${p.fullName} is not in the compound's port list`);
  // inferred: negative = towards the top, positive = towards the bottom, clamped to the list
  const to = Math.max(0, Math.min(side.length - 1, from + step));
  edit(app, C, [c.tree], () => {
    const list = p.side === 'in' ? c.inputs : c.outputs;
    list.splice(from, 1); list.splice(to, 0, p);
  });
  setStatus(app, C, S_OK);
  return to;
}

// ------------------------------------------------------------------ GetICECompoundPortProperties / EditExposedParamInICECompoundNode
function getPortProps(app: App, a: Record<string, any>) {
  const C = 'GetICECompoundPortProperties';
  const { port } = exposedArg(app, C, a.Parameter);
  const e = port.exposed ?? blankExposed();
  // inferred (open question 2): the order of EditExposedParamInICECompoundNode's arguments
  const out = [port.name, e.min, e.max, e.picking, e.description, e.exposeType, e.enumText, e.ppgGroup];
  nya(app, C, 'the list and order of the OutputArgs values; returned as Name, Min, Max, Picking, Description, ExposeType, Enum, PPGLayoutGroup');
  a.OutputArgs = out;
  setStatus(app, C, S_OK);
  return out;
}
function editExposed(app: App, a: Record<string, any>) {
  const C = 'EditExposedParamInICECompoundNode';
  const { port, c } = exposedArg(app, C, a.Parameter);
  lockCheck(app, C, c);   // inferred: the shared lock check of the compound edits
  const exposeType = intArg(a.ExposeType, 0);
  if (!Number.isFinite(exposeType)) throw fail(E_INVALIDARG, `${C}: ExposeType must be an integer`);
  edit(app, C, [c.tree], () => {
    const e = port.exposed ??= blankExposed();
    // inferred (open question 2): an empty string leaves that property unchanged
    const name = str(a.Name);
    if (name && name !== port.name) {
      let n = name, i = 1; const taken = (x: string) => [...c.inputs, ...c.outputs].some(q => q !== port && q.name === x);
      while (taken(n)) n = `${name}${i++}`;   // inferred: unique among the compound's ports
      port.name = n;
    }
    if (str(a.Min)) e.min = str(a.Min);
    if (str(a.Max)) e.max = str(a.Max);
    if (str(a.Picking)) e.picking = str(a.Picking);
    if (str(a.Description)) e.description = str(a.Description);
    e.exposeType = exposeType;
    if (str(a.Enum)) e.enumText = str(a.Enum);
    const grp = str(a.PPGLayoutGroup);
    if (grp && port.side === 'in') {
      // inferred: the port moves into that layout group (created at the end of the layout when missing)
      e.ppgGroup = grp;
      dropFromLayout(c.layout, port, false);
      const hit = findLayout(c.layout, grp);
      if (hit && hit.item.kind === 'group') hit.item.items.push({ kind: 'port', port });
      else c.layout.push({ kind: 'group', name: grp, items: [{ kind: 'port', port }] });
    }
  });
  nya(app, C, 'which empty strings mean "leave unchanged" (empty = unchanged here), the ExposeType values and the Enum string format');
  setStatus(app, C, S_OK);
  return port;
}

// ------------------------------------------------------------------ AddExposedParamToICECompoundNode
function addExposed(app: App, a: Record<string, any>) {
  const C = 'AddExposedParamToICECompoundNode';
  const c = compoundArg(app, C, a.Compound);
  const inner = iceArg(app, a.Parameter);
  if (!(inner instanceof IcePortB12)) throw fail(E_INVALIDARG, `${C}: ${unset(a.Parameter) ? 'no Parameter given' : `"${String(a.Parameter)}" is not an ICE node port`}`);
  // inferred: the port to expose belongs to a node directly inside the compound
  if (inner.node.parent !== c.graph) throw fail(E_INVALIDARG, `${C}: ${inner.fullName} is not a port of a node inside ${c.fullName}`);
  let existing: IcePortB12 | null = null;
  if (!unset(a.ExistingPort)) {
    const e = iceArg(app, a.ExistingPort);
    if (!(e instanceof IcePortB12) || e.node !== c || e.side !== inner.side) throw fail(E_INVALIDARG, `${C}: "${String(a.ExistingPort)}" is not an exposed ${inner.side === 'in' ? 'input' : 'output'} port of ${c.fullName}`);   // inferred
    existing = e;
  }
  lockCheck(app, C, c);
  const op = c.tree;
  const out = edit(app, C, [op], () => {
    let port = existing;
    if (!port) {
      // inferred (open question 3): an empty Name exposes the port under the inner port's name, made unique
      const base = str(a.Name) || inner.name;
      let n = base, i = 1; while ([...c.inputs, ...c.outputs].some(q => q.name === n)) n = `${base}${i++}`;
      port = new IcePortB12(n, inner.side, c, n); port.type = inner.type; port.value = inner.value; port.exposed = blankExposed();
      (inner.side === 'in' ? c.inputs : c.outputs).push(port);
      if (inner.side === 'in') c.layout.push({ kind: 'port', port });
    }
    if (inner.side === 'in') c.graph.connect(port, inner); else c.graph.connect(inner, port);
    return port;
  });
  a.NewPort = out; a.Operator = op;   // inferred: Operator receives the ICE tree that owns the compound
  nya(app, C, 'the worker (automatic naming, error cases, how Operator is filled); the exposed port takes the inner port name');
  setStatus(app, C, S_OK);
  return out;
}

// ------------------------------------------------------------------ RemoveExposedParamFromICECompoundNode
function removeExposed(app: App, a: Record<string, any>) {
  const C = 'RemoveExposedParamFromICECompoundNode';
  const c = compoundArg(app, C, a.Compound);
  const port = iceArg(app, a.Parameter);
  if (!(port instanceof IcePortB12)) { raise(app, C, 'XSIOPTASKS 0x111'); throw fail(E_INVALIDARG, `${C}: no Parameter`); }
  if (port.node !== c) { raise(app, C, 'XSIOPTASKS 0x174', 2, port.fullName); throw fail(E_INVALIDARG, `${C}: ${port.fullName} cannot be removed from ${c.fullName}`); }
  lockCheck(app, C, c);   // inferred: shared lock check
  const parent = c.parent;
  edit(app, C, [c.tree], () => {
    // 3. inner connections: input side first, then output side; inner ports fed by the port keep its value
    if (port.side === 'in') {
      for (const l of c.graph.linksFrom(port)) { c.graph.disconnect(l.dst); l.dst.value = port.value; }
    } else {
      c.graph.links = c.graph.links.filter(l => l.dst !== port);
    }
    // connections on the outside of the port go with it (no reconnection of other instances)
    if (parent) parent.links = parent.links.filter(l => l.src !== port && l.dst !== port);
    // 4. remove the port; 5. clean-up: an emptied layout group goes too (inferred)
    if (port.side === 'in') c.inputs = c.inputs.filter(p => p !== port); else c.outputs = c.outputs.filter(p => p !== port);
    dropFromLayout(c.layout, port, true);
  });
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ RemoveExposedPortPassThrough
function removePassThrough(app: App, a: Record<string, any>) {
  const C = 'RemoveExposedPortPassThrough';
  const port = iceArg(app, a.Port);
  if (unset(a.Port) || !(port instanceof IcePortB12)) throw fail(E_INVALIDARG, `${C}: ${unset(a.Port) ? 'no Port given' : `"${String(a.Port)}" is not a port`}`);   // required argument
  const c = editableCompound(port.node);
  if (!c) { setStatus(app, C, S_FALSE); return; }   // owner is not a compound: nothing to do
  const g = c.graph;
  // 1. the inner node attached to the exposed port
  const attached = port.side === 'in' ? g.linksFrom(port).map(l => l.dst.node) : g.linksTo(port).map(l => l.src.node);
  const pt = attached.find(n => n.type === 'Pass Through');
  if (!pt) { setStatus(app, C, S_OK); return; }
  lockCheck(app, C, c);   // inferred
  edit(app, C, [c.tree], () => {
    const ptIn = pt.inputs[0], ptOut = pt.outputs[0];
    // 2. upstream source of the pass-through; downstream ports it feeds (ending on the compound's port)
    const source = g.linksTo(ptIn)[0]?.src;
    const downstream = g.linksFrom(ptOut).map(l => l.dst);
    // 3. reconnect source -> downstream, disconnect the pass-through's input, delete it
    for (const d of downstream) { g.disconnect(d); if (source) g.connect(source, d); }
    g.disconnect(ptIn);
    g.links = g.links.filter(l => l.src.node !== pt && l.dst.node !== pt);
    g.nodes = g.nodes.filter(n => n !== pt); pt.parent = null;
  });
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ HideAllPortValues
function hideAll(app: App, a: Record<string, any>) {
  const C = 'HideAllPortValues';
  const nodes = listArg(app, a.InputObjs, true).filter((x): x is IceNodeB12 => x instanceof IceNodeB12);
  if (!nodes.length) { setStatus(app, C, S_FALSE); return; }
  const st = stateOf(app);
  const trees = [...new Set(nodes.map(n => n.tree))];
  edit(app, C, trees, () => {
    for (const n of nodes) {
      if (n.inReferencedModel) { raise(app, C, 'XSIOPTASKS 0x425', 1, n.fullName); continue; }
      // inferred (open question 4): every input port's value display is hidden
      for (const p of n.inputs) p.valueShown = false;
    }
  });
  nya(app, C, 'the per-node hide rule (every input port, connected or not, is hidden here)');
  if (st.refreshFlag) { st.refreshes++; window.dispatchEvent(new CustomEvent('ice-tree-refresh')); }
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ PrivateGetCompoundConstructionMode
/** siConstructionMode (public SDK reference). */
const CONSTRUCTION: Record<string, number> = { siConstructionModeDefault: -1, siConstructionModeModeling: 0, siConstructionModePrimaryShape: 1, siConstructionModeAnimation: 2, siConstructionModeSecondaryShape: 3 };
function resolveCompoundFile(app: App, file: string): string | null {
  if (file && hostFs.isFile(file)) return file;
  if (!file) return null;
  // inferred: the compound search path is <root>\Data\Compounds of the user, workgroup, factory and project roots
  const names = /\.xsicompound$/i.test(file) ? [file] : [file, file + '.xsicompound'];
  for (const t of [1, 2, 3, 0]) {
    const root = installPath(app, t); if (!root) continue;
    for (const n of names) { const f = hostFs.join(hostFs.join(root, 'Data\\Compounds'), n); if (hostFs.isFile(f)) return f; }
  }
  return null;
}
function getConstructionMode(app: App, a: Record<string, any>) {
  const C = 'PrivateGetCompoundConstructionMode';
  const file = str(a.File);
  const path = resolveCompoundFile(app, file);
  if (!path) throw fail(E_FAIL, `${C}: compound file "${file}" not found`);
  let text = '';
  try { text = hostFs.readFile(path); } catch { throw fail(E_FAIL, `${C}: cannot read "${path}"`); }
  // inferred: the header is the <xsi_file> element of the .xsicompound XML, its construction mode in "constructionmode"
  const head = /<xsi_file\b[^>]*>/i.exec(text);
  if (!head) throw fail(E_FAIL, `${C}: "${path}" has no compound header`);
  const m = /\bconstructionmode\s*=\s*"([^"]*)"/i.exec(head[0]);
  let mode = -1;
  if (m) { const v = m[1].trim(); mode = /^-?\d+$/.test(v) ? Number(v) : (CONSTRUCTION[v] ?? -1); }
  nya(app, C, 'the compound file header layout (read here from the constructionmode attribute of <xsi_file>)');
  a.Mode = mode;
  setStatus(app, C, S_FALSE);
  return mode;
}

// ------------------------------------------------------------------ ReplaceICECompoundNode
function replaceCompound(app: App, a: Record<string, any>) {
  const C = 'ReplaceICECompoundNode';
  const comps = listArg(app, a.InputObjs, true).filter((x): x is IceCompoundB12 => x instanceof IceCompoundB12);
  if (!comps.length) throw fail(E_FAIL, `${C}: no ICE compound node in InputObjs`);
  const items = str(a.Version).split(',');
  const st = stateOf(app);
  const out: IceCompoundB12[] = [];
  comps.forEach((c, i) => {
    const it = (items[i] ?? '').trim();
    let major = -1, minor = -1;
    if (it.includes('.')) { const [x, y] = it.split('.'); major = parseInt(x, 10); minor = parseInt(y, 10); if (!Number.isFinite(major)) major = -1; if (!Number.isFinite(minor)) minor = -1; }
    // inferred: -1 = the latest version of the compound's definition
    const defs = st.library.filter(d => d.name === c.defName).sort((p, q) => p.major - q.major || p.minor - q.minor);
    const def = major < 0 ? defs[defs.length - 1] : defs.find(d => d.major === major && d.minor === minor);
    if (!def) { nya(app, C, `how the definition of "${c.defName}" ${major < 0 ? '(latest)' : `${major}.${minor}`} is located; no such definition in this build's compound library, ${c.fullName} kept`); return; }
    const g = c.parent; if (!g) return;
    lockCheck(app, C, c);
    out.push(edit(app, C, [c.tree], () => {
      const name = c.name;
      const fresh = makeCompound(c.tree, g, def.name, def.inputs, def.outputs);
      g.nodes.splice(g.nodes.indexOf(fresh), 1);
      fresh.name = name; fresh.major = def.major; fresh.minor = def.minor; fresh.constructionMode = def.constructionMode ?? -1;
      g.nodes.splice(g.nodes.indexOf(c), 1, fresh); c.parent = null;
      // inferred (open question 3): connections and values carry over to ports of the same name
      // (links are replaced, not edited in place, so the undo snapshot keeps the old ones)
      g.links = g.links.map(l => {
        if (l.dst.node !== c && l.src.node !== c) return l;
        const dst = l.dst.node === c ? fresh.port(l.dst.name, 'in') : l.dst;
        const src = l.src.node === c ? fresh.port(l.src.name, 'out') : l.src;
        return dst && src ? { src, dst } : null;
      }).filter((l): l is NonNullable<typeof l> => !!l);
      for (const p of c.inputs) { const q = fresh.port(p.name, 'in'); if (q) q.value = p.value; }
      return fresh;
    }));
  });
  nya(app, C, 'the replace worker: definitions come from the stand-in library, connections and values carry over by port name');
  setStatus(app, C, S_OK);
  return out;
}

export function optasksB12CompoundDefs(): CommandDef[] {
  const sim = 'Simulation';
  return [
    { name: 'AddExposedParamToICECompoundNode', label: 'Add Exposed Parameter to a Compound', category: sim, description: 'Adds an exposed parameter to the compound',
      args: [{ name: 'Parameter', default: null }, { name: 'Compound', default: null }, { name: 'ExistingPort', default: null }, { name: 'Name', default: '' }, { name: 'Operator', default: null }],
      execute: (app, a) => addExposed(app, a) },
    { name: 'EditExposedParamInICECompoundNode', label: 'Edit Exposed Parameter in a Compound', category: sim, description: "Edits the exposed parameter's caracteristics in the compound",
      args: [{ name: 'Parameter', default: null }, { name: 'Name', default: '' }, { name: 'Min', default: '' }, { name: 'Max', default: '' }, { name: 'Picking', default: '' },
        { name: 'Description', default: '' }, { name: 'ExposeType', default: 0 }, { name: 'Enum', default: '' }, { name: 'PPGLayoutGroup', default: '' }],
      execute: (app, a) => editExposed(app, a) },
    { name: 'RemoveExposedParamFromICECompoundNode', label: 'Remove Exposed Parameter from a Compound', category: sim, description: 'Removes the exposed parameter from the compound',
      args: [{ name: 'Parameter', default: null }, { name: 'Compound', default: null }], execute: (app, a) => removeExposed(app, a) },
    { name: 'RemoveExposedPortPassThrough', label: 'Remove the pass through from an exposed port', category: sim, description: "Removes the pass through node from the compound's exposed port",
      args: [{ name: 'Port', default: null }], execute: (app, a) => removePassThrough(app, a) },
    { name: 'GetICECompoundPortProperties', label: "Get ICE Compound Port's Properties", category: sim, description: "Returns the ICE compound port's properties in a Safe Array", undoable: false,
      args: [{ name: 'Parameter', default: null }], execute: (app, a) => getPortProps(app, a) },
    { name: 'MoveICECompoundPort', label: 'Move ICE Compound Port', category: sim, description: 'Move an ICE compound port.',
      args: [{ name: 'InputObj', default: null }, { name: 'Step', default: 1 }], execute: (app, a) => movePort(app, a) },
    { name: 'MoveICECompoundPortsAndLayoutGroups', label: 'Move Compound Ports and PPG Layout Groups', category: sim, description: '',
      args: [{ name: 'Compound', default: null }, { name: 'Names', default: null }, { name: 'Marker', default: '' }, { name: 'MoveAction', default: 1 }], execute: (app, a) => moveItems(app, a) },
    { name: 'CreateLayoutGroupInICECompoundNode', label: 'Create Layout group in ICE Compound Node', category: sim, description: '',
      args: [{ name: 'Compound', default: null }, { name: 'Names', default: null }, { name: 'Group', default: 'Group' }], execute: (app, a) => createGroup(app, a) },
    { name: 'RenameICEPPGLayoutGroup', label: 'Rename ICE PPG Layout Group', category: sim, description: '',
      args: [{ name: 'Compound', default: null }, { name: 'Name', default: '' }, { name: 'NewName', default: '' }], execute: (app, a) => renameGroup(app, a) },
    { name: 'HideAllPortValues', label: 'Hide All Port Values', category: sim, description: '',
      args: [{ name: 'InputObjs', default: null }], execute: (app, a) => hideAll(app, a) },
    { name: 'PrivateGetCompoundConstructionMode', label: 'Get Construction Mode from Compound File', category: 'Edit', description: 'Gets the prefered construction mode from a compound file', undoable: false,
      args: [{ name: 'File', default: '' }], execute: (app, a) => getConstructionMode(app, a) },
    { name: 'ReplaceICECompoundNode', label: 'Replace Compound Node Version', category: 'Edit', description: 'Replace a compound node using another version of the file',
      args: [{ name: 'InputObjs', default: null }, { name: 'Version', default: '' }], execute: (app, a) => replaceCompound(app, a) },
  ];
}
