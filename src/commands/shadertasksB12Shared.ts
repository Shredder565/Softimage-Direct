// Ledger rows CMD-B12f / CMD-B12g (shadertasks.dll): shared state and helpers of shadertasksB12f.ts and
// shadertasksB12g.ts. Briefs: docs/ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md and
// docs/ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md ("Wire contract" per command). Original code written from
// those prose contracts only; no XSIBATCH golden exists for either row.
//
// How the contracts are mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name, ends "(status 0x...)").
//    Statuses that are not failures (0, 1 = S_FALSE, 0x562e80c7) are kept in `app.shadertasksB12.lastStatus`.
//  * Errors raised with an XSISHADERTASKS message id are logged as error lines carrying the id (texts not in the repo).
//  * Sub-tasks the note names (SIAddArrayElement, SIRemoveArrayElement, SetReference2, SetValue) are small internal steps
//    here, each recorded for undo like the note says. SetReference2 is served by tasks.dll, not shadertasks.dll
//    (CMD-B16c; its bus command is in tasksB16c.ts).
//  * Shader "object arrays", per-object instance values and the shader-compound library are stand-ins kept under
//    `app.shadertasksB12`. Shader compounds are modelled in src/core/shaderCompound.ts.
import { App } from '../core/commands';
import { Node, Shader, Material, X3DObject, Property, Cluster } from '../core/scene';
import { Parameter } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import { findNode, siConst, unset } from './viewEditPropertyHelpers';
import { isLocked } from './inferredB10Scene';
import {
  type PortRef, getSource, setSourceRaw, nestShader, unnestShader, nestedShaders, allMaterials, containerShaders,
  containerLayers, shaderContainerOf, resolvePort, resolveNode, nodePath, portExists, isImageClip, TextureLayer,
} from '../core/textureLayers';
import { ShaderCompound, CompoundPort, isCompound } from '../core/shaderCompound';

export { unset };
export const S_OK = 0, S_FALSE = 1, SI_ABORT = 0x562e80c7;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_UNEXPECTED = 0x8000ffff, E_ACCESSDENIED = 0x80070005;
export const NOTE_F = 'docs/ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md';
export const NOTE_G = 'docs/ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md';

export interface PopupRecord { command: string; anchor: { x: number; y: number }; items: string[]; picked: number | null; flags: number }
export interface LibraryEntry { type: string; name: string; path: string }
export interface ShadertasksB12State {
  lastStatus: { command: string; status: number } | null;
  /** Shader "objects" arrays (AddObjectsToShader): shader -> elements, each a referenced object or null. */
  objectArrays: Map<Shader, (Node | null)[]>;
  /** Per-object instance values (SetInstanceDataValue): holder -> owning object -> value. */
  instanceData: Map<Node, Map<Node, any>>;
  /** Preset / library registrations (ExportShaderCompound registers XSIRTCOMPOUND files). */
  library: LibraryEntry[];
  popups: PopupRecord[];
  pointer: { x: number; y: number };
  keyboard: { shift: boolean };
  hooks: {
    /** The shader pop-up menu (UIMapButton): return the 0-based picked item, or null for none. */
    popupMenu?: (items: string[], anchor: { x: number; y: number }, command: string) => number | null | undefined;
  };
  /** Folder that preset-name lookups search after the library (inferred). */
  readonly presetRoot: string;
  /** Helpers for scripts / checks. */
  objectsOf(sh: Shader): (Node | null)[];
  instanceValue(holder: Node, obj: Node): any;
}

export function stateOf(app: App): ShadertasksB12State {
  const a = app as any; if (a.shadertasksB12) return a.shadertasksB12;
  const st: ShadertasksB12State = {
    lastStatus: null, objectArrays: new Map(), instanceData: new Map(), library: [], popups: [], pointer: { x: 0, y: 0 }, keyboard: { shift: false }, hooks: {},
    get presetRoot() { return (a.sdkHelpers?.paths?.[1] ?? 'C:\\Users\\Default\\Autodesk\\Softimage_2015_SP2') + '\\Data\\DSPresets'; },
    objectsOf: sh => [...(st.objectArrays.get(sh) ?? [])],
    instanceValue: (h, o) => st.instanceData.get(h)?.get(o),
  };
  a.shadertasksB12 = st; return st;
}

// ------------------------------------------------------------------ status, errors, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
/** CSIErrorHandling::Raise with an XSISHADERTASKS id: an error line carrying the id (texts not in the repo). */
export function raise(app: App, command: string, id: number, detail = '') { app.logMsg('error', `${command}: [XSISHADERTASKS 0x${id.toString(16)}]${detail ? ' ' + detail : ''}`); }
export function logNya(app: App, command: string, what: string, note = NOTE_F) { app.logMsg('info', `${command}: not yet attested: ${what} (${note})`); }
export const text = (v: any): string => unset(v) ? '' : v instanceof Node ? v.name : String(v);
export const boolOf = (v: any, def: boolean) => unset(v) ? def : v === true || v === 1 || /^(true|1|-1)$/i.test(String(v));
export function intOf(v: any, def: number): number { const c = siConst(v); if (c === null) return def; const n = Number(c); return Number.isFinite(n) ? n : def; }

// ------------------------------------------------------------------ arguments
/** Items of a list argument: arrays flatten, strings split on commas outside brackets. */
export function listOf(v: any): any[] {
  if (unset(v)) return [];
  if (Array.isArray(v)) return v.flatMap(listOf);
  if (typeof v !== 'string') return [v];
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of v) { if (ch === '[') depth++; else if (ch === ']') depth = Math.max(0, depth - 1); if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(s => s.trim()).filter(Boolean);
}
/** Every shader of the scene, compounds' inner shaders included. */
export function allShaders(app: App): Shader[] {
  const out: Shader[] = [];
  const visit = (s: Shader) => { if (out.includes(s)) return; out.push(s); for (const x of s.inputs.values()) visit(x); if (s instanceof ShaderCompound) for (const x of s.shaders()) visit(x); for (const x of nestedShaders(s)) visit(x); };
  for (const m of allMaterials(app.scene)) for (const s of containerShaders(m)) visit(s);
  return out;
}
/** A node by object, path, library path or name: shaders (inner ones too), compound ports, materials, objects. */
export function nodeOf(app: App, x: any): Node | null {
  if (x instanceof Node) return x;
  if (x instanceof Parameter) return null;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim();
  const r = resolveNode(app.scene, s); if (r) return r;
  const shaders = allShaders(app);
  for (const sh of shaders) if (nodePath(app.scene, sh) === s || sh.fullName === s) return sh;
  for (const sh of shaders) if (sh instanceof ShaderCompound) for (const p of sh.exposed) if (`${nodePath(app.scene, sh)}.${p.name}` === s || `${sh.fullName}.${p.name}` === s) return p;
  const n = findNode(app, s); if (n) return n;
  const byName = shaders.filter(sh => sh.name === s); return byName.length === 1 ? byName[0] : null;
}
export function nodesOf(app: App, v: any): Node[] { const out: Node[] = []; for (const x of listOf(v)) { const n = nodeOf(app, x); if (n && !out.includes(n)) out.push(n); } return out; }
/** A connection point: PortRef / Parameter / path (also into compounds and their inner shaders). */
export function portOf(app: App, x: any): PortRef | null {
  const r = resolvePort(app.scene, x); if (r) return r;
  if (typeof x === 'string') {
    const i = x.lastIndexOf('.'); if (i <= 0) return null;
    const owner = nodeOf(app, x.slice(0, i)); const name = x.slice(i + 1);
    if (owner && (owner instanceof Shader || owner instanceof Material || owner instanceof TextureLayer)) { const ref = { owner, name }; if (portExists(ref)) return ref; }
  }
  return null;
}
/** Compound resolution (note B12g shared facts 2): exactly one item, which is (or carries) a shader compound. */
export function compoundOf(app: App, v: any): ShaderCompound | null {
  const items = listOf(v); if (items.length !== 1) return null;
  const n = nodeOf(app, items[0]);
  if (isCompound(n)) return n;
  if (n instanceof CompoundPort) return null;
  return null;
}
export function compoundPortOf(app: App, v: any): CompoundPort | null {
  const items = listOf(v); if (items.length !== 1) return null;
  const n = nodeOf(app, items[0]); return n instanceof CompoundPort ? n : null;
}

// ------------------------------------------------------------------ locks
/** Lock check (level mask 0xFFFF): the node, the parameter, or the shader container that owns it. */
export function lockedAny(app: App, ...xs: any[]): boolean { return xs.some(x => x !== null && x !== undefined && isLocked(app, x, 0xffff)); }
export function portLocked(app: App, ref: PortRef): boolean { return lockedAny(app, ref.owner, ref.owner.get(ref.name)); }
export function lockError(app: App, command: string, what: string) { app.logMsg('error', `${command}: ${what} is locked`); }

// ------------------------------------------------------------------ undoable primitives
/** Connect (null: disconnect) and record; returns what was there. */
export function connectRec(app: App, ref: PortRef, src: Node | null): Node | null {
  const old = getSource(ref); if (old === src) return old;
  app.record('Connect shader', () => setSourceRaw(ref, src), () => setSourceRaw(ref, old));
  return old;
}
export function nestRec(app: App, container: Node, sh: Shader) {
  if (nestedShaders(container).includes(sh)) return;
  const oldParent = sh.parent;
  app.record('Nest shader', () => { nestShader(container, sh); if (container instanceof ShaderCompound) sh.parent = container; }, () => { unnestShader(container, sh); sh.parent = oldParent; });
}
export function unnestRec(app: App, container: Node, sh: Shader) {
  if (!nestedShaders(container).includes(sh)) return;
  const oldParent = sh.parent;
  app.record('Unnest shader', () => { unnestShader(container, sh); if (sh.parent === container) sh.parent = null; }, () => { nestShader(container, sh); sh.parent = oldParent; });
}
export function renameRec(app: App, n: { name: string }, name: string) { const old = n.name; if (old === name) return; app.record('Rename', () => { n.name = name; }, () => { n.name = old; }); }
export function setFieldRec<T extends object>(app: App, obj: T, key: keyof T, v: any) { const old = obj[key]; if (old === v) return; app.record('Set property', () => { (obj as any)[key] = v; }, () => { (obj as any)[key] = old; }); }

/** Every port in the scene that `src` is connected to (materials, their shaders and layers, compounds' insides). */
export function usersOf(app: App, src: Node): PortRef[] {
  const out: PortRef[] = []; const seen = new Set<string>();
  const add = (r: PortRef) => { const k = `${(r.owner as any).id}:${r.name}`; if (!seen.has(k)) { seen.add(k); out.push(r); } };
  const owners: Node[] = [...allMaterials(app.scene), ...allShaders(app)];
  for (const m of allMaterials(app.scene)) for (const l of containerLayers(m)) owners.push(l);
  for (const o of owners) {
    const names = new Set<string>([...o.params.map(p => p.name), ...(o instanceof Shader ? o.inputs.keys() : []), ...(o instanceof TextureLayer ? o.inputs.keys() : [])]);
    if (o instanceof Material) for (const k of o.portConnections.keys()) names.add(k);
    for (const name of names) { const r = { owner: o, name }; if (getSource(r) === src) add(r); }
  }
  return out;
}
/** The shader container (material, compound, ...) of a shader; null when it hangs nowhere. */
export function containerOf(app: App, sh: Shader): Node | null { return shaderContainerOf(app.scene, sh); }
/** Delete a shader: disconnect it from every user and take it out of its container (recorded). */
export function deleteShaderRec(app: App, sh: Shader) {
  for (const r of usersOf(app, sh)) connectRec(app, r, null);
  const c = containerOf(app, sh); if (c) unnestRec(app, c, sh);
  // a shader that was only reachable through the ports just cut is gone with them
}
/** The X3DObject an item belongs to (an object, or the object owning a cluster / property). */
export function owningObject(n: Node | null): X3DObject | null {
  for (let p: any = n; p; p = p.parent) { if (p instanceof X3DObject) return p; if (p instanceof Cluster) return p.obj; }
  return null;
}
export const isShaderLike = (n: any) => n instanceof Shader || n instanceof TextureLayer || isImageClip(n);
export { Property };
