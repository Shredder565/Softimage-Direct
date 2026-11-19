// Shader compounds and the file stand-in of the shadertasks.dll rows CMD-B12f / CMD-B12g.
// Brief: docs/ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md (shared facts 2) and
// docs/ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md. Original code written from those prose contracts.
//
// The app had no model of a shader compound. This is a small original stand-in:
//  * A ShaderCompound is a Shader (so it can be plugged into a port like any node) whose inner shaders are nested in it
//    with nestShader() of src/core/textureLayers.ts. Its exposed ports are CompoundPort nodes kept in one ordered list.
//  * An input port is also a parameter of the compound, so the outside connection is an ordinary Render Tree input
//    (`compound.inputs.get(port.name)`); `port.inner` names the inner shader parameter it drives.
//  * An output port names the inner shader whose result leaves the compound; outside users connect to the compound
//    itself. `port.users` keeps the outside ports a command wired through that output (inferred: this build's
//    connections carry no output name, so a compound with several outputs needs the list to tell them apart).
//
// File formats (CMD-B12-SHADERHELPER, not read): the compound / shader tree / shader definition files written here use
// an ORIGINAL JSON layout documented below. It is a stand-in, marked inferred; it is not Softimage's file format.
//
//   { "format": "afterimage.shadertasks", "version": 1, "inferred": true,
//     "type": "XSIRTCOMPOUND" | "XSISHADERTREE" | "ShaderDefinition",
//     "compound":  CompoundRec,                         (XSIRTCOMPOUND)
//     "tree": { displayName, category, shaders: ShaderRec[], ports: [{ port, root }] },   (XSISHADERTREE)
//     "ShaderDefinition": DefinitionRec }                (ShaderDefinition)
//   ShaderRec   = { id, name, type, spdl: <SI_SHADERS key> | null, defs: ParamDef[], values: {name: value},
//                   inputs: { <port>: { shader: id } | { clip: name } }, compound?: CompoundRec, ref?: path }
//   CompoundRec = { name, props: CompoundProps, shaders: ShaderRec[], ports: PortRec[], embedded: boolean }
//   PortRec     = { name, displayName, direction, inner: { shader: id, port }, props: PortProps }
//   DefinitionRec = { progId, type, spdl, title, output, params: [{ name, type, dir, value, texturable }] }
import { Node, Shader } from './scene';
import type { ParamDef } from './params';
import { SI_SHADERS, type SiShaderDef } from './shaders';
import { nestShader, nestedShaders, getSource, setSourceRaw, type PortRef } from './textureLayers';

export const FILE_FORMAT = 'afterimage.shadertasks';
export const RT_COMPOUND_TAG = 'XSIRTCOMPOUND';   // attested preset type tag (note B12g, shared facts 2)
export const SHADER_TREE_TAG = 'XSISHADERTREE';   // inferred: the shader-tree preset family tag is not attested

export interface CompoundProps {
  Category: string; Description: string; Author: string; Date: string; VersionTag: string;
  VersionMajor: number; VersionMinor: number; PPGLogic: string; PPGLogicLanguage: string; BackgroundColor: number; Editable: boolean;
}
export interface PortProps {
  PPGMinValue: string; PPGMaxValue: string; PPGEnumValues: string; PPGLayoutVisible: boolean;
  PPGLayoutGroup: string; PPGLayoutTab: string; RTLayoutVisible: boolean; RTLayoutGroup: string;
}
/** SetShaderCompoundProperties field order (ModifyFlags bit i = field i). Field 0 is the name. */
export const COMPOUND_FIELDS = ['Name', 'Category', 'Description', 'Author', 'Date', 'VersionTag', 'VersionMajor', 'VersionMinor', 'PPGLogic', 'PPGLogicLanguage', 'BackgroundColor', 'Editable'] as const;
/** SetShaderCompoundPortProperties field order (ModifyFlags bit i = field i). */
export const PORT_FIELDS = ['PPGMinValue', 'PPGMaxValue', 'PPGEnumValues', 'PPGLayoutVisible', 'PPGLayoutGroup', 'PPGLayoutTab', 'RTLayoutVisible', 'RTLayoutGroup'] as const;

export const defaultCompoundProps = (): CompoundProps => ({ Category: '', Description: '', Author: '', Date: '', VersionTag: '', VersionMajor: 0, VersionMinor: 0, PPGLogic: '', PPGLogicLanguage: '', BackgroundColor: 0, Editable: true });
export const defaultPortProps = (): PortProps => ({ PPGMinValue: '', PPGMaxValue: '', PPGEnumValues: '', PPGLayoutVisible: true, PPGLayoutGroup: '', PPGLayoutTab: '', RTLayoutVisible: true, RTLayoutGroup: '' });   // inferred defaults

export class CompoundPort extends Node {
  displayName = '';
  props: PortProps = defaultPortProps();
  /** Outside ports wired through an output port (see header). */
  users: PortRef[] = [];
  constructor(name: string, readonly compound: ShaderCompound, readonly direction: 'input' | 'output', public inner: PortRef) { super(name, 'ShaderCompoundPort', 'shader'); this.parent = compound; }
}

export class ShaderCompound extends Shader {
  props: CompoundProps = defaultCompoundProps();
  /** Exposed ports, in the compound's port order. */
  readonly exposed: CompoundPort[] = [];
  /** The file the compound was imported from (a non-embedded sub-compound is saved as a reference to it). */
  sourceFile: string | null = null;
  constructor(name: string) { super(name, 'ShaderCompound', []); }
  /** Texturable parameters: the exposed input ports. */
  ports(): string[] { return this.exposed.filter(p => p.direction === 'input').map(p => p.name); }
  shaders(): readonly Shader[] { return nestedShaders(this); }
  explorerChildren(): Node[] { return [...this.shaders(), ...this.inputs.values()]; }
  port(name: string): CompoundPort | undefined { return this.exposed.find(p => p.name === name); }
  /** A port name not yet used on this compound: base, base1, base2, ... // inferred numbering */
  uniquePortName(base: string, except?: CompoundPort): string {
    const taken = new Set(this.exposed.filter(p => p !== except).map(p => p.name));
    if (!taken.has(base)) return base; let i = 1; while (taken.has(base + i)) i++; return base + i;
  }
  /** Add / remove the parameter that carries an input port (no undo; callers record). */
  addPortParam(port: CompoundPort) {
    if (port.direction !== 'input' || this.get(port.name)) return;
    const inner = port.inner.owner.get(port.inner.name);
    const def: ParamDef = inner ? { ...inner.def, name: port.name, label: port.displayName || port.name, value: Array.isArray(inner.value) ? [...inner.value] : inner.value } : { name: port.name, label: port.displayName || port.name, type: 'string', value: '' };
    this.add(def);
  }
  removePortParam(name: string) {
    const p = this.get(name); if (!p) return;
    this.params.splice(this.params.indexOf(p), 1); (this as any).byName.delete(name);
  }
  /** Rename the parameter of an input port, keeping its value and its outside connection. */
  renamePortParam(port: CompoundPort, oldName: string) {
    if (port.direction !== 'input' || oldName === port.name) return;
    const p = this.get(oldName); const src = this.inputs.get(oldName) ?? getSource({ owner: this, name: oldName });
    const def: ParamDef | null = p ? { ...p.def, name: port.name } : null; const v = p?.value;
    if (src) setSourceRaw({ owner: this, name: oldName }, null);
    this.removePortParam(oldName);
    if (def) { const np = this.add(def); np.value = v; }
    if (src) setSourceRaw({ owner: this, name: port.name }, src);
  }
}
export const isCompound = (n: any): n is ShaderCompound => n instanceof ShaderCompound;
export const isCompoundPort = (n: any): n is CompoundPort => n instanceof CompoundPort;

// ------------------------------------------------------------------ definitions

/** SI_SHADERS key of a shader's SPDL definition, or null. */
export function spdlKey(sh: Shader): string | null {
  if (!sh.spdl) return null;
  for (const [k, d] of Object.entries(SI_SHADERS)) if (d === sh.spdl || d.file === sh.spdl.file) return k;
  return null;
}
/** Identity of a shader's definition (ReplaceShadersDefinition: "all instances share one definition"). */
export function definitionId(sh: Shader): string { return sh.spdl ? `spdl:${sh.spdl.file}` : `type:${sh.type}`; }
/** The ProgID of a definition. // inferred spelling Softimage.<spdl name>.1.0 (the CMD-01c ProgID reader accepts it). */
export function progIdOf(sh: Shader): string { const k = spdlKey(sh); return `Softimage.${k ?? sh.type}.1.0`; }

export interface DefinitionRec { progId: string; type: string; spdl: string | null; title: string; output: string | null; params: { name: string; type: string; dir: string; value: any; texturable: boolean }[]; defs?: ParamDef[] }
export function definitionOf(sh: Shader): DefinitionRec {
  const d: SiShaderDef | undefined = sh.spdl;
  const params = d ? d.params.map(p => ({ name: p.sn, type: p.type ?? '', dir: p.dir, value: p.value ?? null, texturable: !!p.texturable }))
    : sh.params.map(p => ({ name: p.name, type: p.def.type, dir: 'input', value: p.def.value, texturable: true }));
  return { progId: progIdOf(sh), type: sh.type, spdl: spdlKey(sh), title: d?.title ?? sh.type, output: d?.output ?? null, params, defs: sh.params.map(p => cloneDef(p.def)) };
}
export const cloneDef = (d: ParamDef): ParamDef => JSON.parse(JSON.stringify(d));

// ------------------------------------------------------------------ serialisation (stand-in format, see header)

export interface ShaderRec { id: number; name: string; type: string; spdl: string | null; defs: ParamDef[]; values: Record<string, any>; inputs: Record<string, { shader?: number; clip?: string }>; compound?: CompoundRec; ref?: string }
export interface PortRec { name: string; displayName: string; direction: 'input' | 'output'; inner: { shader: number; port: string }; props: PortProps; outerSource?: number }
export interface CompoundRec { name: string; props: CompoundProps; shaders: ShaderRec[]; ports: PortRec[]; embedded: boolean }

/** Serialise a set of shaders (and everything upstream of them inside the set's scope). */
export class Writer {
  private ids = new Map<Shader, number>(); readonly recs: ShaderRec[] = [];
  constructor(readonly forceEmbedded: boolean, readonly scope: ((s: Shader) => boolean) | null = null) {}
  idOf(s: Shader): number {
    const hit = this.ids.get(s); if (hit !== undefined) return hit;
    const id = this.recs.length + 1; this.ids.set(s, id);
    const rec: ShaderRec = { id, name: s.name, type: s.type, spdl: spdlKey(s), defs: s.params.map(p => cloneDef(p.def)), values: {}, inputs: {} };
    this.recs.push(rec);
    for (const p of s.params) rec.values[p.name] = Array.isArray(p.value) ? [...p.value] : p.value;
    if (s instanceof ShaderCompound) {
      if (!this.forceEmbedded && s.sourceFile) rec.ref = s.sourceFile;   // inferred: ForceEmbedded=false keeps file sub-compounds as references
      rec.compound = writeCompound(s, this.forceEmbedded);
      rec.defs = []; rec.values = {};
    }
    for (const name of new Set([...s.inputs.keys(), ...s.params.map(p => p.name)])) {
      const src = getSource({ owner: s, name }); if (!src) continue;
      if (src instanceof Shader && (!this.scope || this.scope(src))) rec.inputs[name] = { shader: this.idOf(src) };
      else if (!(src instanceof Shader)) rec.inputs[name] = { clip: src.name };
    }
    return id;
  }
}
export function writeCompound(c: ShaderCompound, forceEmbedded: boolean): CompoundRec {
  const inner = new Set<Shader>(c.shaders());
  const w = new Writer(forceEmbedded, s => inner.has(s));
  for (const s of c.shaders()) w.idOf(s);
  const ports: PortRec[] = c.exposed.map(p => ({ name: p.name, displayName: p.displayName, direction: p.direction, inner: { shader: p.inner.owner instanceof Shader ? w.idOf(p.inner.owner) : 0, port: p.inner.name }, props: { ...p.props } }));
  return { name: c.name, props: { ...c.props }, shaders: w.recs, ports, embedded: forceEmbedded };
}
export function fileText(type: string, body: Record<string, any>): string { return JSON.stringify({ format: FILE_FORMAT, version: 1, inferred: true, type, ...body }, null, 1); }
export function parseFile(text: string): any | null {
  try { const d = JSON.parse(text); return d && d.format === FILE_FORMAT ? d : null; } catch { return null; }
}

/** Rebuild shaders from records. Returns them by id; connections between them are restored. Nothing is nested. */
export function readShaders(recs: ShaderRec[], loadRef?: (path: string) => CompoundRec | null): Map<number, Shader> {
  const out = new Map<number, Shader>();
  for (const r of recs) {
    let sh: Shader;
    const crec = r.compound ?? (r.ref && loadRef ? loadRef(r.ref) : null);
    if (crec) { const c = readCompound(crec, loadRef); c.name = r.name; if (r.ref) c.sourceFile = r.ref; sh = c; }
    else {
      const spdl = r.spdl ? SI_SHADERS[r.spdl] : undefined;
      sh = new Shader(r.name, r.type, r.defs.map(cloneDef), spdl);
      for (const [k, v] of Object.entries(r.values ?? {})) { const p = sh.get(k); if (p) p.value = Array.isArray(v) ? [...v] : v; }
    }
    out.set(r.id, sh);
  }
  for (const r of recs) {
    const sh = out.get(r.id)!;
    for (const [port, s] of Object.entries(r.inputs ?? {})) if (s.shader !== undefined && out.get(s.shader)) setSourceRaw({ owner: sh, name: port }, out.get(s.shader)!);
  }
  return out;
}
export function readCompound(rec: CompoundRec, loadRef?: (path: string) => CompoundRec | null): ShaderCompound {
  const c = new ShaderCompound(rec.name);
  c.props = { ...defaultCompoundProps(), ...(rec.props ?? {}) };
  const byId = readShaders(rec.shaders ?? [], loadRef);
  for (const s of byId.values()) { nestShader(c, s); s.parent = c; }
  for (const p of rec.ports ?? []) {
    const owner = byId.get(p.inner.shader); if (!owner) continue;
    const port = new CompoundPort(p.name, c, p.direction, { owner, name: p.inner.port });
    port.displayName = p.displayName ?? ''; port.props = { ...defaultPortProps(), ...(p.props ?? {}) };
    c.exposed.push(port); c.addPortParam(port);
  }
  return c;
}
