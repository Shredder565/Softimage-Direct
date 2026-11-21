// Ledger row CMD-B19c (optasks.dll): static ICE attributes and ICE compound commands.
//   AddStaticICEAttribute RemoveStaticICEAttribute RenameStaticICEAttribute SetStaticICEAttributeType
//   ToggleICEAttributeAlwaysEvaluated CreateICECompoundNode ExplodeICECompoundNode ExportICECompoundNode
//   EditICECompoundProperties
// Brief: docs/ghidra/cmd-b19c-optasks-ice-cns-envelope.md sections 2, 3 and 5 (items 1-5); shared conventions in
// optasksB19cShared.ts. Original code from that prose only. These replace the earlier iceModule.ts registrations
// (attributes as object properties, a Comment-node "compound", a JSON export) and add EditICECompoundProperties.
//
// The build's geometry has no ICE attribute table. A stand-in table lives on each Primitive (`attributeTable`):
// intrinsic attributes (PointPosition ...) are owned by the geometry's data and are not persisted; attributes added with
// AddStaticICEAttribute are persisted ("static"). ICE compounds are the CMD-B12a graph model (optasksB12iceModel.ts).
import { App, CommandDef } from '../core/commands';
import { X3DObject, Primitive, Node } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { installPath } from './tasksB11cShared';
import { findNode } from './viewEditPropertyHelpers';
import {
  IceNodeB12, IceCompoundB12, IcePortB12, IceGraphB12, type IceLinkB12, DATA_TYPE, DATA_CONTEXT, DATA_STRUCTURE, enumArg,
  edit, iceArg, listArg, lockCheck, makeCompound, blankExposed, stateOf as b12State,
} from './optasksB12iceModel';
import {
  S_OK, S_FALSE, E_INVALIDARG, E_POINTER, E_FAIL, E_ACCESSDENIED, E_RESTRICTED, stateOf, fail, setStatus, setOut, subtask,
  errorMsg, warn, nya, str, boolOf, unset, deleteObjSubtask,
} from './optasksB19cShared';

// ====================================================================== static ICE attributes
/** Attribute descriptor: siComponentDataType / Context / Structure bits, the String sub-type mark and the context's
 *  secondary field (compared only when the context is not Singleton). */
export interface AttrDesc { type: number; context: number; structure: number; stringSub: boolean; secondary: number }
export class IceAttributeDefB19c {
  /** "Force evaluation" flag of the multi-data container (ToggleICEAttributeAlwaysEvaluated). */
  forceEval = false;
  /** Owner / reference count (definition table slot 14); RemoveStaticICEAttribute needs exactly 1. */
  owners = 1;
  /** Type before a reset: kept when the current type is not fully defined. */
  typeBeforeReset: AttrDesc | null = null;
  constructor(public name: string, public desc: AttrDesc, public persisted: boolean, public ownedByData = false) {}
}
export interface AttributeTable { defs: IceAttributeDefB19c[]; multiData: boolean }
const TABLES = new WeakMap<Primitive, AttributeTable>();
const V3 = DATA_TYPE.siComponentDataTypeVector3, LONG = DATA_TYPE.siComponentDataTypeLong;
// inferred: the intrinsic attributes this build's geometry carries (owned by the geometry data, not persisted)
const INTRINSIC: [string, number, number][] = [
  ['PointPosition', V3, 2], ['PointNormal', V3, 2], ['NbPoints', LONG, 1], ['NbPolygons', LONG, 1], ['PolygonNormal', V3, 8],
];
export function attributeTable(prim: Primitive): AttributeTable {
  let t = TABLES.get(prim);
  if (!t) {
    t = { defs: INTRINSIC.map(([n, ty, cx]) => new IceAttributeDefB19c(n, { type: ty, context: cx, structure: 1, stringSub: false, secondary: 0 }, false, true)), multiData: false };
    TABLES.set(prim, t);
  }
  return t;
}
/** Case-sensitive name lookup in the attribute-definition table. */
const findDef = (t: AttributeTable, name: string) => t.defs.find(d => d.name === name) ?? null;
const sameDesc = (a: AttrDesc, b: AttrDesc) => a.structure === b.structure && a.type === b.type && a.stringSub === b.stringSub && a.context === b.context
  && (a.context === DATA_CONTEXT.siComponentDataContextSingleton || a.secondary === b.secondary);
const copyDesc = (d: AttrDesc): AttrDesc => ({ ...d });
/** The descriptor an attribute is kept / re-added with: its type, or the type before reset when the type is undefined. */
const keptDesc = (d: IceAttributeDefB19c): AttrDesc | null => d.desc.type ? copyDesc(d.desc) : d.typeBeforeReset ? copyDesc(d.typeBeforeReset) : null;

const TYPE_MASK = 0xfcbff, CONTEXT_MASK = 0x10003f, STRUCTURE_MASK = 0x3;
const CONTEXTS = new Set([1, 2, 4, 8, 16, 32, 0x100000]);
const singleBit = (v: number) => Number.isInteger(v) && v > 0 && (v & (v - 1)) === 0;
/** UnPack validation of one enum value (a single bit in the mask; 0 accepted when `noneOk`). */
function checkEnum(app: App, C: string, v: any, names: Record<string, number>, mask: number, id: number, noneOk: boolean): number {
  const n = enumArg(v, { ...names, siComponentDataTypeNone: 0, siComponentDataContextNone: 0, siComponentDataStructureNone: 0 });
  if (n === 0 && noneOk) return 0;
  if (n === null || !singleBit(n) || (n & mask) !== n) { errorMsg(app, C, id); throw fail(C, E_INVALIDARG, `invalid value ${String(v)} [XSIOPTASKS 0x${id.toString(16)}]`); }
  return n;
}
/** `AttributeName` split on "," without trimming. inferred: an empty string is an empty list (Rename's "zero names"). */
const namesOf = (v: any): string[] => { const s = str(v); return s === '' ? [] : s.split(','); };

interface AttrTarget { obj: X3DObject | null; prim: Primitive; table: AttributeTable; geomName: string }
/** UnPack base: `Object` resolved to its geometry (a 3D object gives its active primitive); unset = the selection. */
function attrTarget(app: App, v: any): AttrTarget | null {
  const n: Node | undefined = unset(v) ? app.selectedObjects[0] : Array.isArray(v) ? findNode(app, v[0]) : findNode(app, v);
  const prim = n instanceof X3DObject ? n.primitive : n instanceof Primitive ? n : null;
  if (!prim) return null;
  const obj = n instanceof X3DObject ? n : ((prim.parent as any) instanceof X3DObject ? prim.parent as any as X3DObject : null);
  return { obj, prim, table: attributeTable(prim), geomName: prim.fullName };
}
/** After the edit loop: geometry dirty (method 0x388, arg 1) and F3DClearEvolveOpCache. */
function dirty(app: App, t: AttrTarget) { t.prim.dirty = true; stateOf(app).opCacheClears++; app.events.emit('scene'); }
const perAttr = (app: App, C: string, t: AttrTarget, id: number, name: string): never => {
  errorMsg(app, C, id, `${t.geomName}.${name}`);
  throw fail(C, E_INVALIDARG, `${t.geomName}.${name} [XSIOPTASKS 0x${id.toString(16)}]`);
};
/** inferred: F3DNormalizeAttrName accepts an identifier (letters, digits, "_", not starting with a digit), with an
 *  optional "Self." prefix dropped. Returns null when the name cannot be normalised. */
export function normalizeAttrName(s: string): string | null {
  const n = s.trim().replace(/^self\./i, '');
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : null;
}
function defineRec(app: App, t: AttrTarget, label: string, def: IceAttributeDefB19c) {
  const table = t.table; const hadMulti = table.multiData;
  app.record(label, () => { table.multiData = true; if (!table.defs.includes(def)) table.defs.push(def); }, () => { const i = table.defs.indexOf(def); if (i >= 0) table.defs.splice(i, 1); table.multiData = hadMulti; });
}

function addStatic(app: App, a: Record<string, any>) {
  const C = 'AddStaticICEAttribute';
  const t = attrTarget(app, a.Object); if (!t) throw fail(C, E_POINTER, 'no object');
  const names = namesOf(a.AttributeName);
  for (const n of names) {
    const d = findDef(t.table, n);
    if (d && (d.persisted || d.ownedByData)) perAttr(app, C, t, 0x435, n);
  }
  const type = checkEnum(app, C, a.AttributeType, DATA_TYPE, TYPE_MASK, 0x431, false);
  const context = checkEnum(app, C, a.AttributeContext, DATA_CONTEXT, CONTEXT_MASK, 0x432, false);
  const structure = checkEnum(app, C, a.AttributeStructure, DATA_STRUCTURE, STRUCTURE_MASK, 0x433, false);
  // Do
  if (!(structure === 1 || structure === 2) || !CONTEXTS.has(context)) { setStatus(app, C, S_OK); return; }
  for (const n of names) {
    // inferred: the attribute-define method refuses a name F3DNormalizeAttrName refuses (first failure aborts)
    if (normalizeAttrName(n) !== n) throw fail(C, E_INVALIDARG, `cannot define ${t.geomName}.${n}`);
    const old = findDef(t.table, n);   // a non-persisted definition not owned by the data is replaced
    const def = new IceAttributeDefB19c(n, { type, context, structure, stringSub: type === DATA_TYPE.siComponentDataTypeString, secondary: 0 }, true);
    if (old) { const tb = t.table; const i = tb.defs.indexOf(old); app.record(C, () => { tb.defs.splice(tb.defs.indexOf(old), 1); }, () => { tb.defs.splice(i, 0, old); }); }
    defineRec(app, t, C, def);
  }
  dirty(app, t); setStatus(app, C, S_OK);
}

function removeStatic(app: App, a: Record<string, any>) {
  const C = 'RemoveStaticICEAttribute';
  const t = attrTarget(app, a.Object); if (!t) throw fail(C, E_POINTER, 'no object');
  const names = namesOf(a.AttributeName);
  for (const n of names) {
    const d = findDef(t.table, n);
    if (!d || !d.persisted) perAttr(app, C, t, 0x434, n);
    if (d!.owners !== 1) perAttr(app, C, t, 0x437, n);
  }
  const removed: { name: string; desc: AttrDesc }[] = [];
  for (const n of names) {
    const d = findDef(t.table, n); if (!d) continue;
    const kept = keptDesc(d); if (!kept) continue;   // no valid type: skipped silently
    const tb = t.table; const i = tb.defs.indexOf(d);
    app.record(C, () => { const k = tb.defs.indexOf(d); if (k >= 0) tb.defs.splice(k, 1); }, () => { tb.defs.splice(i, 0, d); });
    removed.push({ name: n, desc: kept });
  }
  setOut(app, C, { removed });
  dirty(app, t); setStatus(app, C, S_OK);
}

function renameStatic(app: App, a: Record<string, any>) {
  const C = 'RenameStaticICEAttribute';
  const t = attrTarget(app, a.Object); if (!t) throw fail(C, E_POINTER, 'no object');
  const names = namesOf(a.AttributeName);
  if (names.length !== 1) throw fail(C, E_INVALIDARG, 'AttributeName must name exactly one attribute');
  const from = names[0];
  const d = findDef(t.table, from);
  if (!d || !d.persisted) perAttr(app, C, t, 0x434, from);
  const to = normalizeAttrName(str(a.NewName));
  if (to === null) perAttr(app, C, t, 0x438, str(a.NewName));
  if (findDef(t.table, to!)) perAttr(app, C, t, 0x435, to!);
  // Do: define under the new name with the kept descriptor, remove the old one (worker 0x1800a4c40)
  const kept = keptDesc(d!) ?? copyDesc(d!.desc);
  const nd = new IceAttributeDefB19c(to!, kept, true); nd.forceEval = d!.forceEval; nd.owners = d!.owners;
  const tb = t.table; const i = tb.defs.indexOf(d!);
  app.record(C, () => { tb.defs.splice(tb.defs.indexOf(d!), 1, nd); tb.multiData = true; }, () => { tb.defs.splice(tb.defs.indexOf(nd), 1); tb.defs.splice(i, 0, d!); });
  dirty(app, t); setStatus(app, C, S_OK);
  return undefined;
}

function setStaticType(app: App, a: Record<string, any>) {
  const C = 'SetStaticICEAttributeType';
  const t = attrTarget(app, a.Object); if (!t) throw fail(C, E_POINTER, 'no object');
  const names = namesOf(a.AttributeName);
  for (const n of names) { const d = findDef(t.table, n); if (!d || !d.persisted) perAttr(app, C, t, 0x434, n); }
  const type = checkEnum(app, C, a.AttributeType, DATA_TYPE, TYPE_MASK, 0x431, true);
  const context = checkEnum(app, C, a.AttributeContext, DATA_CONTEXT, CONTEXT_MASK, 0x432, true);
  const structure = checkEnum(app, C, a.AttributeStructure, DATA_STRUCTURE, STRUCTURE_MASK, 0x433, true);
  const changes: { name: string; next: AttrDesc; old: AttrDesc }[] = [];
  for (const n of names) {
    const d = findDef(t.table, n); if (!d || !d.persisted) continue;
    const old = copyDesc(d.desc);
    const next: AttrDesc = { ...old };
    if (type) { next.type = type; next.stringSub = type === DATA_TYPE.siComponentDataTypeString; }
    if (context) next.context = context;
    if (structure) next.structure = structure;
    if (sameDesc(next, old)) continue;
    app.record(C, () => { d.desc = copyDesc(next); t.table.multiData = true; }, () => { d.desc = copyDesc(old); });
    changes.push({ name: n, next, old });
  }
  setOut(app, C, { changes });
  dirty(app, t); setStatus(app, C, S_OK);
}

function toggleAlwaysEvaluated(app: App, a: Record<string, any>) {
  const C = 'ToggleICEAttributeAlwaysEvaluated';
  const t = attrTarget(app, a.Object); if (!t) throw fail(C, E_POINTER, 'no object');
  const toggled: string[] = [];
  for (const n of namesOf(a.AttributeName)) {
    const d = findDef(t.table, n); if (!d) continue;   // unknown names skipped
    const tb = t.table; const hadMulti = tb.multiData;
    // Undo and Redo are the same toggle
    app.record(C, () => { tb.multiData = true; d.forceEval = !d.forceEval; }, () => { d.forceEval = !d.forceEval; tb.multiData = hadMulti; });
    toggled.push(n);
  }
  setOut(app, C, { toggled });
  dirty(app, t); setStatus(app, C, S_OK);
}

// ====================================================================== ICE compounds
const nodesOfArg = (app: App, v: any): IceNodeB12[] => listArg(app, v, true).map(x => x instanceof IcePortB12 ? null : x).filter((x): x is IceNodeB12 => x instanceof IceNodeB12);
const portName = (c: IceCompoundB12, base: string) => { let n = base, i = 1; while ([...c.inputs, ...c.outputs].some(q => q.name === n)) n = `${base}${i++}`; return n; };

function createCompound(app: App, a: Record<string, any>) {
  const C = 'CreateICECompoundNode';
  const nodes = nodesOfArg(app, a.InputObj).filter(n => n.parent);
  const g = nodes[0]?.parent ?? null;
  // inferred: every node must live in the same containing graph (else there is no single container)
  if (!nodes.length || !g || nodes.some(n => n.parent !== g)) { errorMsg(app, C, 0x173); throw fail(C, E_INVALIDARG, 'no ICE nodes in one container [XSIOPTASKS 0x173]'); }
  if (g.owner) lockCheck(app, C, g.owner);
  const tree = nodes[0].tree;
  const name = str(a.Name) || 'CompoundNode';
  const inside = new Set<IceNodeB12>(nodes);
  const comp = edit(app, C, [tree], () => {
    // AddICENode sub-task (2ca63f7d, node class d33b77cb) in the container; the persisted name attribute = Name
    const c = makeCompound(tree, g, name);
    c.name = g.uniqueName(name.replace(/\s+/g, '_'), c); c.defName = name;
    subtask(app, C, 'AddICENode', { Container: g.owner?.fullName ?? tree.fullName, Name: c.name });
    // move the nodes inside
    for (const n of nodes) { g.nodes.splice(g.nodes.indexOf(n), 1); n.name = c.graph.uniqueName(n.name); n.parent = c.graph; c.graph.nodes.push(n); }
    // connections: inner ones move; the ones crossing the boundary go through exposed ports
    const inPorts = new Map<IcePortB12, IcePortB12>(), outPorts = new Map<IcePortB12, IcePortB12>();
    const keep: IceLinkB12[] = [];
    for (const l of g.links) {
      const si = inside.has(l.src.node), di = inside.has(l.dst.node);
      if (si && di) { c.graph.links.push({ src: l.src, dst: l.dst }); continue; }
      if (!si && di) {
        let p = inPorts.get(l.dst);
        if (!p) {
          p = new IcePortB12(portName(c, l.dst.name), 'in', c, l.dst.name); p.type = l.dst.type; p.value = l.dst.value; p.exposed = blankExposed();
          c.inputs.push(p); c.layout.push({ kind: 'port', port: p }); inPorts.set(l.dst, p); c.graph.links.push({ src: p, dst: l.dst });
          subtask(app, C, 'AddExposedParamToICECompoundNode', { Parameter: l.dst.fullName, Compound: c.fullName });
        }
        keep.push({ src: l.src, dst: p }); continue;
      }
      if (si && !di) {
        let p = outPorts.get(l.src);
        if (!p) {
          p = new IcePortB12(portName(c, l.src.name), 'out', c, l.src.name); p.type = l.src.type; p.exposed = blankExposed();
          c.outputs.push(p); outPorts.set(l.src, p); c.graph.links.push({ src: l.src, dst: p });
          subtask(app, C, 'AddExposedParamToICECompoundNode', { Parameter: l.src.fullName, Compound: c.fullName });
        }
        keep.push({ src: p, dst: l.dst }); continue;
      }
      keep.push(l);
    }
    g.links = keep;
    subtask(app, C, '749dcc61', { Compound: c.fullName });   // reconnect sub-task (unread)
    return c;
  });
  nya(app, C, 'exposed port names and order, the node gatherer and the reconnect sub-task 749dcc61 (one exposed port per boundary port, named after it)', 'Q1');
  setOut(app, C, { Operator: comp }); setStatus(app, C, S_OK);
  return comp;
}

function explodeCompound(app: App, a: Record<string, any>) {
  const C = 'ExplodeICECompoundNode';
  const items = listArg(app, a.InputObj, true);
  // UnPack: an input that is not a compound
  if (items.some(x => !(x instanceof IceCompoundB12))) { errorMsg(app, C, 0x1c3); throw fail(C, E_FAIL, 'the input is not an ICE compound node [XSIOPTASKS 0x1c3]'); }
  const comps = items as IceCompoundB12[];
  if (!comps.length) { errorMsg(app, C, 0x111); throw fail(C, E_INVALIDARG, 'no compound [XSIOPTASKS 0x111]'); }
  const out: IceNodeB12[] = [];
  for (const c of comps) {
    const g = c.parent; if (!g) continue;
    lockCheck(app, C, c);
    const moved = edit(app, C, [c.tree], () => {
      const inner = c.graph;
      // exposed parameters are removed, inputs then outputs; the inner nodes are reconnected to the outer graph
      const outerLinks: IceLinkB12[] = [];
      for (const p of c.inputs) {
        subtask(app, C, 'RemoveExposedParamFromICECompoundNode', { Parameter: p.fullName, Compound: c.fullName });
        const src = g.linksTo(p)[0]?.src ?? null;
        for (const l of inner.linksFrom(p)) { if (src) outerLinks.push({ src, dst: l.dst }); else l.dst.value = p.value; }
      }
      for (const p of c.outputs) {
        subtask(app, C, 'RemoveExposedParamFromICECompoundNode', { Parameter: p.fullName, Compound: c.fullName });
        const src = inner.linksTo(p)[0]?.src ?? null;
        if (src) for (const l of g.linksFrom(p)) outerLinks.push({ src, dst: l.dst });
      }
      subtask(app, C, '749dcc61', { Compound: c.fullName });
      const ports = new Set([...c.inputs, ...c.outputs]);
      const innerLinks = inner.links.filter(l => !ports.has(l.src) && !ports.has(l.dst));
      const nodes = [...inner.nodes];
      // the inner nodes move to the parent graph
      for (const n of nodes) { n.name = g.uniqueName(n.name); n.parent = g; g.nodes.push(n); }
      inner.nodes = []; inner.links = [];
      g.links = g.links.filter(l => !ports.has(l.src) && !ports.has(l.dst));
      for (const l of [...innerLinks, ...outerLinks]) g.connect(l.src, l.dst);
      // DeleteObj of the compound
      subtask(app, C, 'DeleteObj', { InputObj: [c.fullName] });
      g.nodes.splice(g.nodes.indexOf(c), 1); c.parent = null;
      return nodes;
    });
    out.push(...moved);
  }
  nya(app, C, 'the content of OutputObjs (here: the nodes moved out of the compound)', 'Q2');
  setOut(app, C, { OutputObjs: out }); setStatus(app, C, S_OK);
  return out;
}

// ------------------------------------------------------------------ compound properties (EditICECompoundProperties)
export interface CompoundProps {
  category: string; tasks: string; author: string; description: string; url: string; versionTag: string;
  modeForApplyICEOp: number; backgroundColor: number; ppgLogic: string; ppgLogicLanguage: string;
}
const PROPS = new WeakMap<IceCompoundB12, CompoundProps>();
/** The compound's descriptive fields (defaults when absent: mode 4, colour 0x66bc9a). */
export function compoundProps(c: IceCompoundB12): CompoundProps {
  let p = PROPS.get(c);
  if (!p) PROPS.set(c, p = { category: '', tasks: '', author: '', description: '', url: '', versionTag: '', modeForApplyICEOp: 4, backgroundColor: 0x66bc9a, ppgLogic: '', ppgLogicLanguage: '' });
  return p;
}
function editCompoundProps(app: App, a: Record<string, any>) {
  const C = 'EditICECompoundProperties';
  const n = iceArg(app, unset(a.Compound) ? app.selection[app.selection.length - 1] : a.Compound);
  const c = n instanceof IceCompoundB12 && !n.readOnly ? n : null;
  if (!c) { setStatus(app, C, S_FALSE); return undefined; }   // nothing to edit
  lockCheck(app, C, c);
  const mask = Number(unset(a.SetMask) ? 0 : a.SetMask) >>> 0;
  const want = (bit: number) => mask === 0 || (mask & bit) !== 0;
  const p = compoundProps(c);
  const old = { name: c.name, ...p, major: c.major, minor: c.minor };   // old values first (undo)
  const changed: string[] = [];
  const field = (bit: number, key: keyof CompoundProps, v: any) => {
    if (!want(bit) || v === undefined) return;
    if ((p as any)[key] === v) return;
    const before = (p as any)[key];
    app.record(C, () => { (p as any)[key] = v; }, () => { (p as any)[key] = before; });
    changed.push(key);
  };
  // 0x2 Name: SetValue sub-task on the persisted name attribute
  if (want(0x2) && str(a.Name) && str(a.Name) !== c.name) {
    const nm = str(a.Name); const bn = c.name, bd = c.defName;
    subtask(app, C, 'SetValue', { Target: `${c.fullName}.Name`, Value: nm });
    app.record(C, () => { c.name = nm; c.defName = nm; }, () => { c.name = bn; c.defName = bd; });
    changed.push('name');
  }
  field(0x4, 'category', str(a.Category)); field(0x8, 'tasks', str(a.Tasks)); field(0x10, 'author', str(a.Author));
  field(0x20, 'description', str(a.Description)); field(0x40, 'url', str(a.URL));
  if (want(0x80)) {
    const M = Math.trunc(Number(a.VersionMajor) || 0), m = Math.trunc(Number(a.VersionMinor) || 0);
    if (M !== c.major || m !== c.minor) { const bM = c.major, bm = c.minor; app.record(C, () => { c.major = M; c.minor = m; }, () => { c.major = bM; c.minor = bm; }); changed.push('version'); }
  }
  field(0x100, 'versionTag', str(a.VersionTag));
  field(0x200, 'modeForApplyICEOp', unset(a.ModeForApplyICEOp) ? 4 : Number(a.ModeForApplyICEOp));
  field(0x400, 'backgroundColor', unset(a.BackgroundColor) ? 0x66bc9a : Number(a.BackgroundColor) >>> 0);
  field(0x800, 'ppgLogic', str(a.PPGLogic));
  if (want(0x1000)) {
    const lang = str(a.PPGLogicLanguage);
    if (lang === '' || /^(vbscript|jscript)$/i.test(lang) || lang.includes('Python')) field(0x1000, 'ppgLogicLanguage', lang);
    else warn(app, C, 0x1a6, `${C} ${lang}`);   // language left unchanged, other fields applied
  }
  setOut(app, C, { old, changed }); setStatus(app, C, S_OK);
  app.events.emit('scene');
  return undefined;
}

// ------------------------------------------------------------------ ExportICECompoundNode
const xmlAttr = (s: any) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** inferred: the file body. The .xsicompound layout is not part of the contract; this build writes its own XML with the
 *  compound header fields (read back by PrivateGetCompoundConstructionMode) and the exposed ports. */
function compoundFileText(c: IceCompoundB12, priv: boolean, embedded: boolean): string {
  const p = compoundProps(c);
  const ports = [...c.inputs.map(q => `  <port name="${xmlAttr(q.name)}" dir="in" type="${q.type}"/>`), ...c.outputs.map(q => `  <port name="${xmlAttr(q.name)}" dir="out" type="${q.type}"/>`)];
  return [`<?xml version="1.0" encoding="iso-8859-1"?>`,
    `<xsi_file type="CompoundNode" name="${xmlAttr(c.defName)}" category="${xmlAttr(p.category)}" tasks="${xmlAttr(p.tasks)}" author="${xmlAttr(p.author)}" url="${xmlAttr(p.url)}" ` +
    `compoundversion="${c.major}.${c.minor}" versiontag="${xmlAttr(p.versionTag)}" constructionmode="${c.constructionMode}" backgroundcolor="${p.backgroundColor}" private="${priv ? 1 : 0}" embedded="${embedded ? 1 : 0}">`,
    ...ports, `  <nodes count="${c.graph.nodes.length}"/>`, `</xsi_file>`, ''].join('\n');
}
function exportCompound(app: App, a: Record<string, any>) {
  const C = 'ExportICECompoundNode'; const st = stateOf(app);
  const items = listArg(app, a.Compound, true);
  const c = items.length === 1 && items[0] instanceof IceCompoundB12 ? items[0] as IceCompoundB12 : null;
  if (!c) { setStatus(app, C, S_FALSE); return ''; }   // exactly one compound, else nothing is exported
  const priv = boolOf(a.Private), embedded = boolOf(a.ForceEmbedded);
  if (priv && st.restrictedMode) {
    st.messageBoxes.push({ command: C, id: 'XSIOPTASKS 0x427' }); warn(app, C, 0x427);
    throw fail(C, E_RESTRICTED, 'private compounds cannot be exported in this application mode [XSIOPTASKS 0x427]');
  }
  let path = str(a.FullPath);
  if (!path) {
    // inferred: user preference path (2, 0x19) = the user Compounds folder
    const dir = str(a.Directory) || hostFs.join(installPath(app, 1), 'Data\\Compounds');
    const name = str(a.Name) || c.name;
    if (name.toLowerCase() !== c.name.toLowerCase()) { c.name = name; c.defName = name; }   // renames the compound
    let M = c.major, m = c.minor;
    const v = str(a.Version);
    if (v) { const [x, y] = v.split('.'); const nx = parseInt(x, 10), ny = parseInt(y ?? '0', 10); if (Number.isFinite(nx)) M = nx; if (Number.isFinite(ny)) m = ny; }
    if (M !== c.major || m !== c.minor) { c.major = M; c.minor = m; }   // written to the compound
    path = dir + (/[\\/]$/.test(dir) ? '' : '\\') + name + (M === 1 && m === 0 ? '' : `.${M}.${m}`) + (priv ? '.xsicompoundp' : '.xsicompound');
  }
  try { hostFs.ensureFolder(hostFs.parentPath(path)); hostFs.writeFile(path, compoundFileText(c, priv, embedded)); } catch {
    errorMsg(app, C, 0x422, path); throw fail(C, E_FAIL, `cannot write ${path} [XSIOPTASKS 0x422]`);
  }
  st.compoundRefreshes += 2;
  // the compound library is rescanned (inferred: preset-manager refresh); the B12a stand-in library learns the definition
  st.libraryRescans++;
  const lib = b12State(app).library;
  if (!lib.some(d => d.name === c.defName && d.major === c.major && d.minor === c.minor)) lib.push({ name: c.defName, major: c.major, minor: c.minor, inputs: c.inputs.map(p => p.name), outputs: c.outputs.map(p => p.name), constructionMode: c.constructionMode });
  setOut(app, C, { Output: path }); setStatus(app, C, S_OK);
  return path;
}

// ====================================================================== definitions
export function optasksB19cIceDefs(): CommandDef[] {
  const OBJ = { name: 'Object', default: null }, NAME = { name: 'AttributeName', default: '' };
  return [
    { name: 'AddStaticICEAttribute', label: 'Add Static ICE Attribute', category: 'ICE', description: 'Adds a persisted ICE attribute to the geometry of the object',
      args: [OBJ, NAME, { name: 'AttributeType', default: ':siComponentDataTypeFloat:siComponentDataType' },
        { name: 'AttributeContext', default: ':siComponentDataContextSingleton:siComponentDataContext' }, { name: 'AttributeStructure', default: ':siComponentDataStructureSingle:siComponentDataStructure' }],
      execute: (app, a) => addStatic(app, a) },
    { name: 'RemoveStaticICEAttribute', label: 'Remove Static ICE Attribute', category: 'ICE', args: [OBJ, NAME], execute: (app, a) => removeStatic(app, a) },
    { name: 'RenameStaticICEAttribute', label: 'Rename Static ICE Attribute', category: 'ICE', args: [OBJ, NAME, { name: 'NewName', default: '' }], execute: (app, a) => renameStatic(app, a) },
    { name: 'SetStaticICEAttributeType', label: 'Set Static ICE Attribute Type', category: 'ICE',
      args: [OBJ, NAME, { name: 'AttributeType', default: ':siComponentDataTypeNone:siComponentDataType' },
        { name: 'AttributeContext', default: ':siComponentDataContextNone:siComponentDataContext' }, { name: 'AttributeStructure', default: ':siComponentDataStructureNone:siComponentDataStructure' }],
      execute: (app, a) => setStaticType(app, a) },
    { name: 'ToggleICEAttributeAlwaysEvaluated', label: 'Toggle ICE Attribute Always Evaluated', category: 'ICE', args: [OBJ, NAME], execute: (app, a) => toggleAlwaysEvaluated(app, a) },
    { name: 'CreateICECompoundNode', label: 'Create ICE Compound Node', category: 'Simulation', args: [{ name: 'InputObj', default: null }, { name: 'Name', default: '' }], execute: (app, a) => createCompound(app, a) },
    { name: 'ExplodeICECompoundNode', label: 'Explode ICE Compound Node', category: 'Simulation', args: [{ name: 'InputObj', default: null }, { name: 'OutputObjs', default: null }], execute: (app, a) => explodeCompound(app, a) },
    { name: 'ExportICECompoundNode', label: 'Export ICE Compound', category: 'Edit', undoable: false,
      args: [{ name: 'Compound', default: null }, { name: 'FullPath', default: '' }, { name: 'Directory', default: '' }, { name: 'Name', default: '' }, { name: 'Version', default: '' },
        { name: 'Private', default: false }, { name: 'ForceEmbedded', default: false }, { name: 'Output', default: '' }],
      execute: (app, a) => exportCompound(app, a) },
    { name: 'EditICECompoundProperties', label: 'Edit Compound Properties', category: 'Simulation',
      // SetMask is the registry's hidden argument (flags 3), after the catalogue list
      args: [{ name: 'Compound', default: null }, { name: 'Name', default: '' }, { name: 'Category', default: '' }, { name: 'Tasks', default: '' }, { name: 'Author', default: '' },
        { name: 'Description', default: '' }, { name: 'URL', default: '' }, { name: 'VersionMajor', default: 0 }, { name: 'VersionMinor', default: 0 }, { name: 'VersionTag', default: '' },
        { name: 'ModeForApplyICEOp', default: 4 }, { name: 'BackgroundColor', default: 6732954 }, { name: 'PPGLogic', default: '' }, { name: 'PPGLogicLanguage', default: '' },
        { name: 'SetMask', default: 0 }],
      execute: (app, a) => editCompoundProps(app, a) },
  ];
}
export { IceGraphB12, E_ACCESSDENIED };
