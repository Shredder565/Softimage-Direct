// Texture layers, texture layer ports and shader connection points (ledger row CMD-01c).
// Brief: docs/ghidra/cmd-01c-texture-layers.md ("Shared facts", "Shared script helpers", "Wire contract").
// Original code written from that note; nothing here is copied from Softimage.
//
// This module is the model half (no command bus, no undo): the layer lists of each container, the merged
// layer order, the move / insert rules, connection-point ("port") resolution, the preset -> shader table and
// the default-texture-port lookup. src/commands/textureLayers.ts wraps every mutation in app.record.
//
// The scene model (src/core/scene.ts) is not edited: layer lists, nested shaders, image-clip connections and
// extra material connections live in WeakMaps keyed by the node they belong to.
//
// ---------------------------------------------------------------------------------------------------------
// Connection points ("ports")
// A port is a shader parameter: PortRef = { owner, name } where owner is a Shader, a Material or a TextureLayer.
// resolvePort() accepts
//   - a PortRef-like object { owner: Node, name: string };
//   - a Parameter object (its owner must be a Shader, Material or TextureLayer);
//   - a path string, in any of these forms (segments are separated by dots):
//       Sources.Materials.DefaultLib.<Material>.<Shader>.<param>      library path
//       <Material>.<Shader>.<param>                                   material by name
//       <obj>.Material.<Shader>.<param>                               the object's current material
//       <obj>.<MaterialName>.<Shader>.<param>                         (an inherited material resolves too)
//       <Material>.<port>                                             a material port (surface, shadow, ...)
//       ...<Shader or Material>.<Layer>.<param>                       a texture layer parameter (color, weight, ...)
//       <Node.fullName of a shader or layer>.<param>                  the path the app itself prints
//     Shaders are looked up by name anywhere in the material (Softimage nests every shader of a render tree
//     directly under its material), so `Material.Image.tex` and `Material.Phong.Image.tex` both resolve.
// resolveNode() accepts a Node, or the same path forms without the trailing parameter, an object name, a
// material name or an image clip name.
// ---------------------------------------------------------------------------------------------------------
import { Node, Shader, Material, Property, X3DObject, Light, Camera, Pass, Scene, makeSiShader } from './scene';
import { Parameter, num, int, type ParamDef } from './params';
import { SI_SHADERS, TEXTURE_NODES, MATERIAL_PRESETS, type SiShaderDef, type SiShaderParam } from './shaders';

// ------------------------------------------------------------------ attested constants (note, "Shared facts")

export const siBlendInPreset = 0, siReplaceAndBlendInPreset = 1, siReplaceNoBlend = 2;
export const siBlendInTextureLayers = 0, siReplaceAndBlendInTextureLayers = 1, siReplaceAndNoBlendInTextureLayers = 2;
export const siShaderCnxPointNone = 0, siShaderCnxPointBasePorts = 1, siShaderCnxPointTextureLayerPorts = 2, siShaderCnxPointAll = 65535;
export const siShaderDataTypeBoolean = 0, siShaderDataTypeScalar = 2, siShaderDataTypeVector3 = 4, siShaderDataTypeColor4 = 10;
/** Public SDK value (xsi_decl.h siShaderParameterDataType); not in the note's table. Used only to tell integers apart (Q16). */
export const siShaderDataTypeInteger = 1; // inferred
/** Not a Softimage value: "some other type" (string, texture, reference, matrix, ...). */
export const SHADER_DATA_TYPE_OTHER = -1;
/** Not a Softimage value: an image clip / texture reference (the `tex` parameter of an Image shader). */
export const SHADER_DATA_TYPE_TEXTURE = -2;
export const siShaderTypeShader = 1;
export const siMaterialID = 64, siShaderID = 52, siTextureLayerID = 126, siTextureLayerPortID = 127;

export const GUID_SHADER_TYPE_KEY = '{22E89E70-B25F-11d3-AE58-00A0C96E63E1}';
export const GUID_MIX_8COLORS = '{3A3BD020-A9BD-11D3-AE56-00A0C96E63E1}';
export const GUID_TEXTURE_LAYER_CLASS = '{F3DFBA8B-22AD-48FD-A156-EBFCEAED29DD}';
export const GUID_TEXTURE_LAYER_PORT_CLASS = '{C14BEAF3-6116-414C-AF0F-010F1DAED3BC}';

export type TextureMapping = 'ambient' | 'diffuse' | 'transparency' | 'reflection';
export const MAPPING_GUIDS: Record<TextureMapping, string> = {
  ambient: '{3515CC71-082C-11D0-91DE-00A024C78EE3}',
  diffuse: '{3515CC72-082C-11D0-91DE-00A024C78EE3}',
  transparency: '{D97375C6-05AE-11D0-91DE-00A024C78EE3}',
  reflection: '{D97375C7-05AE-11D0-91DE-00A024C78EE3}',
};
const STD_MAPPING: Record<string, TextureMapping> = { ambient: 'ambient', diffuse: 'diffuse', transparency: 'transparency', reflectivity: 'reflection' };
/** Default-texture mapping attribute per shader definition: the `ui "mapping"` values of the project's extracted
 *  SPDL files (data/si/shaders/*.spdl) that are one of the four mapping GUIDs above. Keyed by SPDL file name. */
export const DEFAULT_TEXTURE_MAPPING: Record<string, Record<string, TextureMapping>> = {
  'material-phong.spdl': STD_MAPPING, 'material-lambert.spdl': STD_MAPPING, 'material-blinn.spdl': STD_MAPPING,
  'material-cooktorr.spdl': STD_MAPPING, 'material-ward.spdl': STD_MAPPING,
  'material-constant.spdl': { color: 'ambient', transparency: 'transparency', reflectivity: 'reflection' },
  'material-strauss.spdl': { diffuse: 'diffuse', transparency: 'transparency', reflectivity: 'reflection' },
  'sib_illum_phong.spdl': { ambient: 'ambient', diffuse: 'diffuse' },
  'simple_phong.spdl': { ambient: 'ambient', diffuse: 'diffuse' },
};
/** The parameter flagged `UI "main input"` in the extracted SPDL files (InsertShader, E1). Keyed by SPDL file name. */
export const MAIN_INPUT: Record<string, string> = {
  'sib_color_hls_adjust.spdl': 'color', 'sib_color_invert.spdl': 'input', 'sib_color_math_basic.spdl': 'input1',
  'sib_color_to_scalar.spdl': 'input', 'sib_scalar_math_basic.spdl': 'input1', 'sib_scalar_to_color.spdl': 'input',
  'txt2d-image-explicit.spdl': 'tex',
};

// ------------------------------------------------------------------ model classes

/** A connection point: parameter `name` of `owner` (Shader, Material or TextureLayer). */
export interface PortRef { owner: Node; name: string }
export const samePort = (a: PortRef, b: PortRef) => a.owner === b.owner && a.name === b.name;

/** A texture layer (class id 126). It can sit in several containers at once (A1). */
export class TextureLayer extends Node {
  readonly classId = siTextureLayerID;
  readonly className = 'TextureLayer';
  /** What is connected to the layer's own parameters (the shader on `color`, ...). */
  readonly inputs = new Map<string, Node>();
  /** The layer's ports: the shader parameters it drives. */
  readonly ports: TextureLayerPort[] = [];
  /** The containers (materials / shaders) that hold this layer, in the order it was added. Empty = deleted or not added yet. */
  readonly containers: Node[] = [];
  locked = false;
  constructor(name: string) {
    // Attested parameters: `color`, `weight`, `maskmode` (B1, B2, D1). Their defaults are not attested.
    super(name, 'TextureLayer', 'property', [
      { name: 'color', label: 'color', type: 'color', value: [0, 0, 0, 0], animatable: false } as ParamDef, // inferred default
      num('weight', 1, 'weight'),   // inferred default
      int('maskmode', 0, 'maskmode'), // inferred default
    ]);
  }
  explorerChildren(): Node[] { return [...this.inputs.values(), ...this.ports]; }
}

/** A texture layer port (class id 127): the link from a layer to one shader parameter (A2). */
export class TextureLayerPort extends Node {
  readonly classId = siTextureLayerPortID;
  readonly className = 'TextureLayerPort';
  constructor(name: string, readonly layer: TextureLayer, readonly target: PortRef) { super(name, 'TextureLayerPort', 'property', []); this.parent = layer; }
}

// ------------------------------------------------------------------ side tables

const LAYERS = new WeakMap<Node, TextureLayer[]>();           // container -> ordered layers
const NESTED = new WeakMap<Node, Shader[]>();                 // shader container -> shaders created in it
const HOME = new WeakMap<Shader, Node>();                     // shader -> its shader container
const CLIP_INPUTS = new WeakMap<Node, Map<string, Node>>();   // shader -> non-shader sources (image clips) by port
const MAT_PORTS = new WeakMap<Material, Map<string, Shader>>(); // material -> shaders on ports other than `surface`
const PRESET_OF = new WeakMap<Shader, string>();              // shader -> canonical preset name it was made from
const PORT_INDEX = new WeakMap<Node, Set<TextureLayerPort>>(); // target owner -> layer ports that drive it

// ------------------------------------------------------------------ layer containers

/** "Supports texture layers" (shared helper): a material, or a shader whose shader type is siShader. Every Shader
 *  node of this app is a plain shader (no compounds or comments are modelled). */
export function supportsTextureLayers(n: any): n is Material | Shader { return n instanceof Material || n instanceof Shader; }
export const isLayerContainer = supportsTextureLayers;

export function layersOf(container: Node): readonly TextureLayer[] { return LAYERS.get(container) ?? []; }
/** Replace a container's ordered layer list and keep every layer's `containers` in step. */
export function setLayersOf(container: Node, list: readonly TextureLayer[]) {
  const old = LAYERS.get(container) ?? [];
  for (const l of old) if (!list.includes(l)) { const i = l.containers.indexOf(container); if (i >= 0) l.containers.splice(i, 1); l.parent = (l.containers[0] as any) ?? null; }
  for (const l of list) if (!l.containers.includes(container)) { l.containers.push(container); l.parent = l.containers[0] as any; }
  if (list.length) LAYERS.set(container, [...list]); else LAYERS.delete(container);
}
export type LayerGetter = (container: Node) => readonly TextureLayer[];

/** The containers reachable from `start` through shared layers (a layer in two containers ties them together). */
export function layerFamily(start: Iterable<Node>, get: LayerGetter = layersOf, containersOfLayer: (l: TextureLayer) => readonly Node[] = l => l.containers): Node[] {
  const out: Node[] = []; const todo = [...start];
  while (todo.length) {
    const c = todo.shift()!; if (out.includes(c)) continue; out.push(c);
    for (const l of get(c)) for (const d of containersOfLayer(l)) if (!out.includes(d)) todo.push(d);
  }
  return out;
}

/** One ordered list of every layer of `containers` that respects each container's own order (a stable
 *  topological merge; ties go to the layer seen first). `conflict` is true when two containers hold the same
 *  layers in contradicting orders (A1 step 3). */
export function mergedLayerOrder(containers: readonly Node[], get: LayerGetter = layersOf): { order: TextureLayer[]; conflict: boolean } {
  const all: TextureLayer[] = [];
  for (const c of containers) for (const l of get(c)) if (!all.includes(l)) all.push(l);
  const after = new Map<TextureLayer, Set<TextureLayer>>(); const indeg = new Map<TextureLayer, number>();
  for (const l of all) { after.set(l, new Set()); indeg.set(l, 0); }
  for (const c of containers) { const ls = get(c); for (let i = 0; i + 1 < ls.length; i++) { const s = after.get(ls[i])!; if (!s.has(ls[i + 1])) { s.add(ls[i + 1]); indeg.set(ls[i + 1], indeg.get(ls[i + 1])! + 1); } } }
  const order: TextureLayer[] = []; const left = [...all];
  while (left.length) {
    const i = left.findIndex(l => indeg.get(l) === 0);
    if (i < 0) return { order: [...order, ...left], conflict: true };
    const l = left.splice(i, 1)[0]; order.push(l);
    for (const n of after.get(l)!) indeg.set(n, indeg.get(n)! - 1);
  }
  return { order, conflict: false };
}

/** Index at which `layer` goes into `list` (A1 step 2). `refMerged` is the merged order of the reference's own
 *  containers; it is used only when the reference is not in `list`. */
export function layerInsertIndex(list: readonly TextureLayer[], reference: TextureLayer | null, after: boolean, refMerged: readonly TextureLayer[] = []): number {
  if (!reference) return after ? list.length : 0;
  const at = list.indexOf(reference);
  if (at >= 0) return after ? at + 1 : at;
  const from = refMerged.indexOf(reference);
  if (from >= 0) for (let i = from + 1; i < refMerged.length; i++) { const j = list.indexOf(refMerged[i]); if (j >= 0) return j; }
  return list.length;
}

/** The layer of `container` before which `layer` must go so the merged order is kept (A2 step 3), or null = at the end. */
export function nextLayerInContainer(layer: TextureLayer, container: Node, get: LayerGetter = layersOf): TextureLayer | null {
  const merged = mergedLayerOrder(layerFamily(layer.containers, get), get).order; const list = get(container);
  const from = merged.indexOf(layer); if (from < 0) return null;
  for (let i = from + 1; i < merged.length; i++) if (list.includes(merged[i])) return merged[i];
  return null;
}

/** A3: move `moving` by `offset` steps in the merged list `order` and return the new list.
 *  Negative = towards the head. A step counts only when the layer passed shares a container with the moved
 *  layer; the move stops at either end and when the next neighbour is itself a moved layer. // inferred (B) */
export function moveInMergedOrder(order: readonly TextureLayer[], moving: readonly TextureLayer[], offset: number, shares: (a: TextureLayer, b: TextureLayer) => boolean = (a, b) => a.containers.some(c => b.containers.includes(c))): TextureLayer[] {
  const list = [...order]; const steps = Math.abs(Math.trunc(offset)); if (!steps) return list;
  const dir = offset < 0 ? -1 : 1; const set = new Set(moving);
  const seq = list.filter(l => set.has(l)); if (dir > 0) seq.reverse(); // start from the end they move towards
  for (const l of seq) {
    let done = 0;
    while (done < steps) {
      const i = list.indexOf(l); const j = i + dir;
      if (j < 0 || j >= list.length) break;
      const n = list[j]; if (set.has(n)) break;
      list[j] = l; list[i] = n;
      if (shares(l, n)) done++;
    }
  }
  return list;
}

/** A1 "suitable for the container" (Q5): a layer that is in no container yet always is; a layer that already has
 *  containers is suitable only when those containers share one owner. // inferred: which owner is compared is not
 *  attested. Here the owner of a shader is the material that holds it and the owner of a material is its library
 *  (one library in this build), so a layer may sit on two materials, or on shaders of one material, and a layer
 *  that already spans shaders of two materials, or a material and one of its shaders, takes no further container. */
export function layerSuitableFor(scene: Scene, layer: TextureLayer, _container: Node, containersOfLayer: readonly Node[] = layer.containers): boolean {
  if (!containersOfLayer.length) return true;
  const owner = (c: Node): any => c instanceof Shader ? (shaderContainerOf(scene, c) ?? c) : c instanceof Material ? MATERIAL_LIBRARY : c;
  const o = owner(containersOfLayer[0]);
  return containersOfLayer.every(c => owner(c) === o);
}
export const MATERIAL_LIBRARY = 'Sources.Materials.DefaultLib';

// ------------------------------------------------------------------ layer ports

export function addLayerPort(port: TextureLayerPort) {
  if (!port.layer.ports.includes(port)) port.layer.ports.push(port);
  let s = PORT_INDEX.get(port.target.owner); if (!s) PORT_INDEX.set(port.target.owner, s = new Set()); s.add(port);
}
export function removeLayerPort(port: TextureLayerPort) {
  const i = port.layer.ports.indexOf(port); if (i >= 0) port.layer.ports.splice(i, 1);
  PORT_INDEX.get(port.target.owner)?.delete(port);
}
/** The live layer ports that drive a parameter. A port whose layer has been deleted (no container left) is not live. */
export function layerPortsOn(ref: PortRef): TextureLayerPort[] {
  return [...(PORT_INDEX.get(ref.owner) ?? [])].filter(p => p.target.name === ref.name && p.layer.containers.length > 0 && p.layer.ports.includes(p));
}
/** Name of a new layer port (Q8, not attested). // inferred: the script name of the target parameter, numbered when taken. */
export function layerPortName(layer: TextureLayer, target: PortRef): string {
  const taken = new Set(layer.ports.map(p => p.name)); if (!taken.has(target.name)) return target.name;
  let i = 1; while (taken.has(target.name + i)) i++; return target.name + i;
}

// ------------------------------------------------------------------ data types

function spdlParam(sh: Shader, name: string): SiShaderParam | undefined { return sh.spdl?.params.find(p => p.sn === name && p.dir === 'input'); }
function typeCode(t: string | undefined | null): number {
  switch (t) {
    case 'color': return siShaderDataTypeColor4;
    case 'scalar': return siShaderDataTypeScalar;
    case 'boolean': return siShaderDataTypeBoolean;
    case 'vector': return siShaderDataTypeVector3;
    case 'integer': return siShaderDataTypeInteger;
    case 'texture': case 'image': return SHADER_DATA_TYPE_TEXTURE;
    default: return SHADER_DATA_TYPE_OTHER;
  }
}
function defTypeCode(d: ParamDef | undefined): number {
  switch (d?.type) {
    case 'color': return siShaderDataTypeColor4;
    case 'double': return siShaderDataTypeScalar;
    case 'bool': return siShaderDataTypeBoolean;
    case 'int': case 'enum': return siShaderDataTypeInteger;
    default: return SHADER_DATA_TYPE_OTHER;
  }
}
/** siShaderParameterDataType of a port (10 colour4, 2 scalar, 4 vector3, 0 boolean), from the SPDL definition where there is one. */
export function portDataType(ref: PortRef): number {
  const o = ref.owner;
  if (o instanceof Shader) { const p = spdlParam(o, ref.name); if (p) return typeCode(p.type); return defTypeCode(o.get(ref.name)?.def); }
  if (o instanceof TextureLayer) return defTypeCode(o.get(ref.name)?.def);
  return SHADER_DATA_TYPE_OTHER; // material ports (surface, shadow, ...) are references
}
export function portExists(ref: PortRef): boolean {
  const o = ref.owner;
  if (o instanceof Shader) return !!spdlParam(o, ref.name) || !!o.get(ref.name);
  if (o instanceof Material || o instanceof TextureLayer) return !!o.get(ref.name);
  return false;
}
/** Output type of something that can be connected to a port. Shaders without an SPDL (the dump-backed Constant) count as colour. */
export function sourceDataType(src: Node): number {
  if (isImageClip(src)) return SHADER_DATA_TYPE_TEXTURE;
  if (src instanceof Shader) return src.spdl ? typeCode(src.spdl.output) : siShaderDataTypeColor4; // inferred for shaders without SPDL
  return SHADER_DATA_TYPE_OTHER;
}
/** A2 step 2: boolean, scalar, vector3 or colour4 on a layer container. The further boolean condition (Q6) is not identified and not applied. */
export function isLayerablePort(ref: PortRef): boolean {
  if (!isLayerContainer(ref.owner)) return false;
  const t = portDataType(ref);
  return t === siShaderDataTypeBoolean || t === siShaderDataTypeScalar || t === siShaderDataTypeVector3 || t === siShaderDataTypeColor4;
}
/** Value of a port as (r, g, b, a). A three-component colour takes its alpha from the SPDL default, else 1. */
export function portColor4(ref: PortRef): [number, number, number, number] {
  const v = (ref.owner as any).get?.(ref.name)?.value; const a = Array.isArray(v) ? v : [0, 0, 0];
  const dv = ref.owner instanceof Shader ? spdlParam(ref.owner, ref.name)?.value : undefined;
  const alpha = a.length > 3 ? a[3] : Array.isArray(dv) && dv.length > 3 ? dv[3] : 1;
  return [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0, Number(alpha)];
}

// ------------------------------------------------------------------ connections

function matPortShader(m: Material, port: string): Shader | null {
  const extra = MAT_PORTS.get(m)?.get(port); if (extra) return extra;
  return m.portConnections.has(port) ? m.surface : null;
}
/** What is connected to a port: a shader, an image clip, or null. */
export function getSource(ref: PortRef): Node | null {
  const o = ref.owner;
  if (o instanceof Shader) return o.inputs.get(ref.name) ?? CLIP_INPUTS.get(o)?.get(ref.name) ?? null;
  if (o instanceof TextureLayer) return o.inputs.get(ref.name) ?? null;
  if (o instanceof Material) return matPortShader(o, ref.name);
  return null;
}
/** Connect (or with null, disconnect) without undo. The caller records it. */
export function setSourceRaw(ref: PortRef, src: Node | null) {
  const o = ref.owner;
  if (o instanceof Shader) {
    const old = o.inputs.get(ref.name);
    o.inputs.delete(ref.name); CLIP_INPUTS.get(o)?.delete(ref.name);
    if (src instanceof Shader) { o.inputs.set(ref.name, src); if (!src.parent) src.parent = o; }
    else if (src) { let m = CLIP_INPUTS.get(o); if (!m) CLIP_INPUTS.set(o, m = new Map()); m.set(ref.name, src); }
    if (old && old !== src && old.parent === o && ![...o.inputs.values()].includes(old)) old.parent = null;
    const p = o.get(ref.name); if (p && p.def.type === 'string') (p as any)._value = src && !(src instanceof Shader) ? src.name : ''; // the clip name shows in the property page
  } else if (o instanceof TextureLayer) {
    if (src) o.inputs.set(ref.name, src); else o.inputs.delete(ref.name);
  } else if (o instanceof Material) {
    const sh = src instanceof Shader ? src : null;
    if (ref.name === 'surface') { o.setSurface(sh); MAT_PORTS.get(o)?.delete('surface'); return; }
    let m = MAT_PORTS.get(o); if (!m) MAT_PORTS.set(o, m = new Map());
    if (!sh) { m.delete(ref.name); o.portConnections.delete(ref.name); }
    else if (sh === o.surface) { m.delete(ref.name); o.portConnections.set(ref.name, 'out'); }
    else { m.set(ref.name, sh); o.portConnections.set(ref.name, 'out'); }
  }
}

/** Every port of a node that can carry a connection. */
function inputRefs(n: Node): PortRef[] {
  if (n instanceof Shader) return [...new Set([...n.inputs.keys(), ...(CLIP_INPUTS.get(n)?.keys() ?? [])])].map(name => ({ owner: n, name }));
  if (n instanceof TextureLayer) return [...n.inputs.keys()].map(name => ({ owner: n, name }));
  if (n instanceof Material) return [...new Set([...n.portConnections.keys(), ...(MAT_PORTS.get(n)?.keys() ?? [])])].map(name => ({ owner: n, name }));
  return [];
}
/** Every shader of a shader container: created in it, or reachable from its ports and its layers. */
export function containerShaders(container: Node): Shader[] {
  const out: Shader[] = []; const seenLayers = new Set<TextureLayer>();
  const visitLayers = (c: Node) => { for (const l of layersOf(c)) if (!seenLayers.has(l)) { seenLayers.add(l); for (const s of l.inputs.values()) visit(s); } };
  const visit = (n: Node | null) => {
    if (!(n instanceof Shader) || out.includes(n)) return;
    out.push(n); for (const s of n.inputs.values()) visit(s); visitLayers(n);
  };
  if (container instanceof Material) { visit(container.surface); for (const s of MAT_PORTS.get(container)?.values() ?? []) visit(s); }
  visitLayers(container);
  for (const s of NESTED.get(container) ?? []) visit(s);
  return out;
}
export function containerLayers(container: Node): TextureLayer[] {
  const out: TextureLayer[] = [];
  for (const c of [container, ...containerShaders(container)]) for (const l of layersOf(c)) if (!out.includes(l)) out.push(l);
  return out;
}
/** The ports of `container` (its own, its shaders' and its layers') that `src` is connected to. */
export function sourceUsers(container: Node, src: Node): PortRef[] {
  const out: PortRef[] = [];
  for (const n of [container, ...containerShaders(container), ...containerLayers(container)]) for (const r of inputRefs(n)) if (getSource(r) === src) out.push(r);
  return out;
}
/** True when connecting `src` to a port of `owner` would close a loop. */
export function wouldCycle(src: Node, owner: Node): boolean {
  if (!(src instanceof Shader)) return false;
  const seen = new Set<Node>(); const todo: Node[] = [src];
  while (todo.length) { const n = todo.pop()!; if (n === owner) return true; if (seen.has(n)) continue; seen.add(n); if (n instanceof Shader) { for (const s of n.inputs.values()) todo.push(s); for (const l of layersOf(n)) for (const s of l.inputs.values()) todo.push(s); } }
  return false;
}

// ------------------------------------------------------------------ shader containers

export function nestedShaders(container: Node): readonly Shader[] { return NESTED.get(container) ?? []; }
export function nestShader(container: Node, sh: Shader) { let l = NESTED.get(container); if (!l) NESTED.set(container, l = []); if (!l.includes(sh)) l.push(sh); HOME.set(sh, container); }
export function unnestShader(container: Node, sh: Shader) { const l = NESTED.get(container); const i = l ? l.indexOf(sh) : -1; if (i >= 0) l!.splice(i, 1); if (HOME.get(sh) === container) HOME.delete(sh); }
export function allMaterials(scene: Scene): Material[] {
  const out = [...scene.materials]; const add = (m: Material | null) => { if (m && !out.includes(m)) out.push(m); };
  add(scene.root.material); for (const o of scene.allObjects()) add(o.material);
  return out;
}
/** GetShaderContainer: the material (or light, camera, pass) a shader is nested in. */
export function shaderContainerOf(scene: Scene, sh: Shader): Node | null {
  const home = HOME.get(sh); if (home) return home;
  for (const m of allMaterials(scene)) if (containerShaders(m).includes(sh)) return m;
  for (const o of scene.allObjects()) if (o instanceof Light && (o as any).shader === sh) return o;
  return null;
}
/** "Owning container of a port" (shared helper): the shader, material, ... that owns the parameter; a texture layer hands over to its parent. */
export function owningContainer(ref: PortRef): Node | null {
  const o = ref.owner;
  if (o instanceof TextureLayer) return o.containers[0] ?? null;
  return o;
}
/** "Unique shader container" (shared helper) of ports and / or nodes; null = none. */
export function uniqueShaderContainer(scene: Scene, items: readonly (PortRef | Node)[]): Node | null {
  let found: Node | null = null;
  for (const it of items) {
    let n: Node | null = it instanceof Node ? it : owningContainer(it);
    if (n instanceof TextureLayer) n = n.containers[0] ?? null;
    let c: Node | null;
    if (n instanceof Shader) c = shaderContainerOf(scene, n);
    else if (n instanceof Material || n instanceof Light || n instanceof Camera || n instanceof Pass) c = n;
    else c = null;
    if (!c) return null;
    if (found && found !== c) return null;
    found = c;
  }
  return found;
}
/** A name not yet used by a shader or layer of the container: base, base1, base2, ... // inferred numbering */
export function uniqueNameIn(container: Node, base: string, extra: readonly string[] = []): string {
  const taken = new Set<string>(extra);
  for (const s of containerShaders(container)) taken.add(s.name);
  for (const l of containerLayers(container)) taken.add(l.name);
  if (!taken.has(base)) return base;
  let i = 1; while (taken.has(base + i)) i++; return base + i;
}

// ------------------------------------------------------------------ presets

function paramDefsFrom(d: SiShaderDef): ParamDef[] {
  const out: ParamDef[] = [];
  for (const p of d.params) {
    if (p.dir !== 'input') continue;
    const base = { name: p.sn, label: p.label ?? p.sn } as Partial<ParamDef>;
    if (p.type === 'color') out.push({ ...base, type: 'color', value: Array.isArray(p.value) ? [...p.value] : [0, 0, 0], animatable: false } as ParamDef);
    else if (p.type === 'scalar') out.push({ ...base, type: 'double', value: typeof p.value === 'number' ? p.value : 0, animatable: true } as ParamDef);
    else if (p.type === 'integer') out.push({ ...base, type: 'int', value: typeof p.value === 'number' ? p.value : 0, animatable: true } as ParamDef);
    else if (p.type === 'boolean') out.push({ ...base, type: 'bool', value: p.value === 'on' || p.value === true, animatable: true } as ParamDef);
  }
  return out;
}
/** `Mixers\Mix_8colors`: `base_color` and seven layers `color<i>`, `weight<i>`, `alpha<i>`, `mode<i>`, `inuse<i>` (C1).
 *  The project has no SPDL for it; the parameter list is taken from the bundled two-colour mixer SPDL, which carries
 *  the same seven layers. // inferred: defaults other than what C1 sets, and every layer input being connectable. */
function mix8Def(): SiShaderDef {
  const base = SI_SHADERS['sib_color_2mix'];
  let params: SiShaderParam[];
  if (base) params = base.params.map(p => ({ ...p, value: p.sn === 'mixersize' ? 8 : p.value, texturable: p.dir === 'input' && p.sn !== 'mixersize' ? true : p.texturable }));
  else {
    params = [{ sn: 'out', type: 'color', dir: 'output' }, { sn: 'base_color', type: 'color', value: [0, 0, 0, 1], texturable: true, dir: 'input' }];
    for (let i = 1; i <= 7; i++) params.push(
      { sn: `color${i}`, type: 'color', value: [1, 1, 1, 1], texturable: true, dir: 'input' }, { sn: `mode${i}`, type: 'integer', value: 1, texturable: true, dir: 'input' },
      { sn: `weight${i}`, type: 'color', value: [0.5, 0.5, 0.5, 0.5], texturable: true, dir: 'input' }, { sn: `alpha${i}`, type: 'boolean', value: 'off', texturable: true, dir: 'input' },
      { sn: `inuse${i}`, type: 'boolean', value: 'off', texturable: true, dir: 'input' });
  }
  return { file: 'sib_color_8mix.spdl', propset: 'sib_color_8mix_params', title: 'Mix_8colors', output: 'color', params, layout: base?.layout };
}
/** `Conversion\Color2scalar`, from data/si/shaders/sib_color_to_scalar.spdl: colour `input` (1,1,1,1), scalar output. */
function color2scalarDef(): SiShaderDef {
  return { file: 'sib_color_to_scalar.spdl', propset: 'sib_color_to_scalar_params', title: 'Color2scalar', output: 'scalar', params: [
    { sn: 'out', type: 'scalar', dir: 'output' }, { sn: 'input', label: 'Input', type: 'color', value: [1, 1, 1, 1], texturable: true, dir: 'input' }] };
}
const OWN_DEFS: Record<string, () => SiShaderDef> = { Mix_8colors: mix8Def, Color2scalar: color2scalarDef };
const SPDL_PRESETS: Record<string, string> = { Mix_2colors: 'sib_color_2mix', Scalar2color: 'sib_scalar_to_color' };
const PROGID_KEYS: Record<string, string> = { sib_color_8mix: 'Mix_8colors', sib_color_to_scalar: 'Color2scalar' };

/** Canonical preset name: `Mixers\Mix_2colors`, `Shaders\Texture\Image.Preset` -> `Mix_2colors`, `Image`; null when unknown. */
export function canonicalPreset(preset: any): string | null {
  if (preset === null || preset === undefined) return null;
  const base = String(preset).trim().replace(/\.preset$/i, '').split(/[\\/]/).pop() ?? ''; if (!base) return null;
  const known = [...Object.keys(OWN_DEFS), ...Object.keys(SPDL_PRESETS), ...Object.keys(TEXTURE_NODES), ...Object.keys(MATERIAL_PRESETS), 'Constant', ...Object.keys(SI_SHADERS)];
  return known.find(k => k === base) ?? known.find(k => k.toLowerCase() === base.toLowerCase()) ?? null;
}
export const isShaderPreset = (preset: any) => canonicalPreset(preset) !== null;
/** "Create shader from preset name" (shared helper), not yet nested anywhere; null on any failure. The default
 *  name is the preset's own name (`Image`), which is what makes the D2 layer name `Image_Layer`. */
export function makePresetShader(preset: any, name?: string): Shader | null {
  const key = canonicalPreset(preset); if (!key) return null;
  let sh: Shader | null;
  if (OWN_DEFS[key]) { const d = OWN_DEFS[key](); sh = new Shader(name || key, key, paramDefsFrom(d), d); }
  else sh = makeSiShader(SPDL_PRESETS[key] ?? key, name || key);
  if (sh) PRESET_OF.set(sh, key);
  return sh;
}
/** A shader from a ProgID such as `Softimage.txt2d-image-explicit.1` (SIApplyShaderToCnxPoint2). // inferred: the
 *  middle part is the SPDL / shader definition name. */
export function makeProgIdShader(progId: any, name?: string): Shader | null {
  const parts = String(progId ?? '').trim().split('.'); if (parts.length < 2) return null;
  const mid = parts.slice(1, /^\d+$/.test(parts[parts.length - 1]) ? (parts.length > 3 && /^\d+$/.test(parts[parts.length - 2]) ? -2 : -1) : undefined).join('.');
  const own = PROGID_KEYS[mid]; if (own) return makePresetShader(own, name);
  if (!SI_SHADERS[mid]) return null;
  const preset = Object.entries(TEXTURE_NODES).find(([, v]) => v === mid)?.[0] ?? Object.entries(SPDL_PRESETS).find(([, v]) => v === mid)?.[0] ?? Object.entries(MATERIAL_PRESETS).find(([, v]) => v === mid)?.[0];
  if (preset) return makePresetShader(preset, name);
  const sh = makeSiShader(mid, name); if (sh) PRESET_OF.set(sh, mid); return sh;
}
export function presetOf(sh: Shader): string | undefined { return PRESET_OF.get(sh); }
/** The 8-colour mixer. Softimage recognises it by the type attribute GUID; here by the definition it was built from. */
export function isMix8(n: any): n is Shader { return n instanceof Shader && (PRESET_OF.get(n) === 'Mix_8colors' || n.spdl?.file === 'sib_color_8mix.spdl'); }
export function shaderTypeGuid(sh: Shader): string | undefined { return isMix8(sh) ? GUID_MIX_8COLORS : undefined; }
/** The shader's main input: the first parameter whose definition is flagged as the main port (E1). */
export function mainInput(sh: Shader): string | null { const n = sh.spdl ? MAIN_INPUT[sh.spdl.file] : undefined; return n && portExists({ owner: sh, name: n }) ? n : null; }
/** A copy of a shader tree (used for the local copy of a shared material). Image clips stay shared. */
export function cloneShaderTree(s: Shader, done = new Map<Shader, Shader>()): Shader {
  const hit = done.get(s); if (hit) return hit;
  const n = new Shader(s.name, s.type, s.params.map(p => ({ ...p.def, value: Array.isArray(p.value) ? [...p.value] : p.value })), s.spdl); n.layout = s.layout; done.set(s, n);
  const key = PRESET_OF.get(s); if (key) PRESET_OF.set(n, key);
  for (const r of inputRefs(s)) { const src = getSource(r); if (src) setSourceRaw({ owner: n, name: r.name }, src instanceof Shader ? cloneShaderTree(src, done) : src); }
  return n;
}

// ------------------------------------------------------------------ default-texturable ports

export interface TextureSwitches { Ambient: boolean; Diffuse: boolean; Transparency: boolean; Reflection: boolean }
const SWITCH_OF: Record<TextureMapping, keyof TextureSwitches> = { ambient: 'Ambient', diffuse: 'Diffuse', transparency: 'Transparency', reflection: 'Reflection' };
/** The default-texture mapping of a parameter, or null. */
export function portMapping(ref: PortRef): TextureMapping | null {
  const o = ref.owner; if (!(o instanceof Shader)) return null;
  if (o.spdl) return DEFAULT_TEXTURE_MAPPING[o.spdl.file]?.[ref.name] ?? null;
  return o.get(ref.name) ? STD_MAPPING[ref.name] ?? null : null; // inferred: shaders without an SPDL (dump-backed Constant, unlocked mia) go by parameter name
}
function isTexturable(sh: Shader, name: string): boolean { const p = spdlParam(sh, name); return p ? !!p.texturable : !!sh.get(name); }
/** "Default-texturable ports of a material" (shared helper): only the shaders directly on `surface` and `shadow`. */
export function defaultTexturePorts(m: Material, sw: TextureSwitches): { ref: PortRef; mapping: TextureMapping }[] {
  const shaders: Shader[] = [];
  for (const port of ['surface', 'shadow']) { const s = matPortShader(m, port); if (s && !shaders.includes(s)) shaders.push(s); }
  const out: { ref: PortRef; mapping: TextureMapping }[] = [];
  for (const sh of shaders) {
    const names = sh.spdl ? sh.spdl.params.filter(p => p.dir === 'input').map(p => p.sn) : sh.params.map(p => p.name);
    for (const name of names) {
      const mapping = portMapping({ owner: sh, name }); if (!mapping || !isTexturable(sh, name) || !sw[SWITCH_OF[mapping]]) continue;
      out.push({ ref: { owner: sh, name }, mapping });
    }
  }
  return out;
}

// ------------------------------------------------------------------ materials of objects

/** The object's current material: its own, else the nearest ancestor's (the scene root holds Scene_Material). */
export function currentMaterial(scene: Scene, o: X3DObject): Material | null {
  let n: X3DObject | null = o; while (n) { if (n.material) return n.material; n = n.parentObj; }
  return scene.root.material;
}
/** Objects that own the material directly (the library is the implicit first owner). */
export function materialOwners(scene: Scene, m: Material): X3DObject[] {
  const out: X3DObject[] = []; if (scene.root.material === m) out.push(scene.root);
  for (const o of scene.allObjects()) if (o.material === m) out.push(o);
  return out;
}
/** "Local to the object": exactly two owners (the library and one object) and the second is that object. */
export function isLocalMaterial(scene: Scene, m: Material, o: X3DObject): boolean { const ow = materialOwners(scene, m); return ow.length === 1 && ow[0] === o; }

// ------------------------------------------------------------------ image clips

const IMAGE_EXT = /\.(pic|jpe?g|png|tga|tiff?|bmp|gif|exr|hdr|sgi|rgb|rgba|psd|dds|map|iff|cin|dpx|pict?|ppm|yuv|ct|als|memmap)$/i;
/** // inferred: the app cannot stat files, so "is an image file" means "has an image file extension". */
export function looksLikeImageFile(name: any): boolean { return typeof name === 'string' && IMAGE_EXT.test(name.trim()); }
/** // inferred from the public naming of clips: `noIcon.pic` -> `noIcon_pic`. */
export function clipNameForFile(file: string): string { const base = file.trim().split(/[\\/]/).pop() ?? file; return base.replace(/\./g, '_') || 'ImageClip'; }
export function isImageClip(n: any): n is Property { return n instanceof Property && n.type === 'imageclip'; }
/** Image sources are not modelled by the app; a property of type `imagesource` is treated as one. */
export function isImageSource(n: any): n is Property { return n instanceof Property && n.type === 'imagesource'; }
export function imageClips(scene: Scene): Property[] { return scene.root.properties.filter(isImageClip); }

// ------------------------------------------------------------------ path resolution

function objectByName(scene: Scene, name: string): X3DObject | null {
  if (name === scene.root.name) return scene.root;
  return scene.find(name) ?? null;
}
/** Walk `segs` down from a material, shader or layer. On the last segment a parameter wins over a child node of the
 *  same name when `preferParam` is set, and the other way round otherwise. */
function walk(container: Node | null, start: Node, segs: string[], preferParam: boolean): { node: Node; param?: string } | null {
  let cur: Node = start; let home: Node | null = container;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]; const last = i === segs.length - 1; let next: Node | null = null;
    if (cur instanceof Material) { home = cur; next = layersOf(cur).find(l => l.name === seg) ?? containerShaders(cur).find(s => s.name === seg) ?? null; }
    else if (cur instanceof Shader) next = layersOf(cur).find(l => l.name === seg) ?? [...cur.inputs.values()].find(s => s.name === seg) ?? (home ? containerShaders(home).find(s => s.name === seg) ?? null : null);
    else if (cur instanceof TextureLayer) next = cur.ports.find(p => p.name === seg) ?? [...cur.inputs.values()].find(s => s.name === seg) ?? null;
    const isParam = last && portExists({ owner: cur, name: seg });
    if (isParam && (preferParam || !next)) return { node: cur, param: seg };
    if (!next) return null;
    cur = next;
  }
  return { node: cur };
}
/** Resolve a path to a node, or to a node and a parameter name. See the header for the accepted forms. */
export function resolvePath(scene: Scene, path: string, preferParam = true): { node: Node; param?: string } | null {
  const segs = String(path).trim().split('.').filter(s => s.length); if (!segs.length) return null;
  const mats = allMaterials(scene);
  const tryFrom = (m: Material | null | undefined, rest: string[]) => m ? walk(m, m, rest, preferParam) : null;
  // Sources.Materials.DefaultLib.<Material>...
  if (segs.length >= 4 && segs.slice(0, 3).join('.').toLowerCase() === MATERIAL_LIBRARY.toLowerCase()) { const r = tryFrom(mats.find(m => m.name === segs[3]), segs.slice(4)); if (r) return r; }
  // <Material>...
  { const r = tryFrom(mats.find(m => m.name === segs[0]), segs.slice(1)); if (r) return r; }
  // <obj>.Material... / <obj>.<MaterialName>... (the object name may itself be a dotted model path)
  for (let n = Math.min(segs.length, 4); n >= 1; n--) {
    const o = objectByName(scene, segs.slice(0, n).join('.')); if (!o) continue;
    if (segs.length === n) return { node: o };
    const m = currentMaterial(scene, o);
    if (m && (segs[n].toLowerCase() === 'material' || segs[n] === m.name)) { const r = tryFrom(m, segs.slice(n + 1)); if (r) return r; }
  }
  // the app's own fullName of a shader or a layer
  for (const m of mats) for (const node of [...containerShaders(m), ...containerLayers(m)] as Node[]) {
    const fn = node.fullName; if (path === fn) return { node };
    if (path.startsWith(fn + '.')) { const r = walk(m, node, path.slice(fn.length + 1).split('.'), preferParam); if (r) return r; }
  }
  // an image clip by name
  if (segs.length === 1) { const c = scene.root.properties.find(p => (isImageClip(p) || isImageSource(p)) && p.name === segs[0]); if (c) return { node: c }; }
  return null;
}
/** A connection point from a PortRef, a Parameter or a path; null when it does not resolve to an existing parameter. */
export function resolvePort(scene: Scene, x: any): PortRef | null {
  if (x === null || x === undefined || x === '') return null;
  if (x instanceof Parameter) { const o = x.owner as any; return o instanceof Shader || o instanceof Material || o instanceof TextureLayer ? { owner: o, name: x.name } : null; }
  if (typeof x === 'string') { const r = resolvePath(scene, x); return r && r.param ? { owner: r.node, name: r.param } : null; }
  if (typeof x === 'object' && x.owner !== undefined && typeof x.name === 'string') {
    const owner = x.owner instanceof Node ? x.owner : resolveNode(scene, x.owner); if (!owner) return null;
    const ref = { owner, name: x.name }; return portExists(ref) ? ref : null;
  }
  return null;
}
/** A node from a Node or a path / name; null when it does not resolve to a node. */
export function resolveNode(scene: Scene, x: any): Node | null {
  if (x instanceof Node) return x;
  if (typeof x !== 'string' || !x.trim()) return null;
  const r = resolvePath(scene, x, false); return r && !r.param ? r.node : null;
}
/** Flatten a collection argument: an array, a comma-separated string, or one item. */
export function listOf(x: any): any[] {
  if (x === null || x === undefined || x === '') return [];
  if (Array.isArray(x)) return x.flatMap(listOf);
  if (typeof x === 'string') return x.split(',').map(s => s.trim()).filter(Boolean);
  return [x];
}
/** Library path of a node: `Sources.Materials.DefaultLib.<Material>.<Shader>[.<Layer>]`. */
export function nodePath(scene: Scene, n: Node): string {
  if (n instanceof Material) return `${MATERIAL_LIBRARY}.${n.name}`;
  if (n instanceof Shader) { const c = shaderContainerOf(scene, n); return c ? `${nodePath(scene, c)}.${n.name}` : n.name; }
  if (n instanceof TextureLayer) return n.containers[0] ? `${nodePath(scene, n.containers[0])}.${n.name}` : n.name;
  if (n instanceof TextureLayerPort) return `${nodePath(scene, n.layer)}.${n.name}`;
  return n.fullName;
}
export function portPath(scene: Scene, ref: PortRef): string { return `${nodePath(scene, ref.owner)}.${ref.name}`; }
