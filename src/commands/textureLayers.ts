// Texture layer and shader blend-in commands (ledger row CMD-01c), 27 commands.
// Brief: docs/ghidra/cmd-01c-texture-layers.md, "Shared facts", "Shared script helpers" and "Wire contract"
// A1-A4, B1-B3, C1-C3, D1-D4, E1, F. Original code written from that note only; the model half is
// src/core/textureLayers.ts (layer lists, merged order, port resolution, preset table).
//
// Wired from the contract: groups A to E. Group F is wired as far as the note attests it (create a shader from a
// preset or ProgID, connect it, return it; colour <-> scalar converters) and says "not yet attested" for the rest.
//
// Known gaps (each is also logged or commented where it bites):
//  - Yes/No message boxes cannot block this synchronous command bus, so the two sharing questions always get the
//    script helper's batch default ("No"); the question is written to the log. Notices are shown with siMsgBox in
//    interactive mode and logged as `<title>: <prompt>` in batch mode (`Application.Interactive = false`).
//  - `MakeLocal` is not a command of this build; the local copy of a shared material is made by makeLocalMaterial().
//  - Cluster and group materials are not modelled, so cluster / group / polygon sub-component inputs of the
//    object-based commands (C2, D2, D4) are reported and skipped.
//  - "Is an image file" is decided by the file extension (the app cannot look at the disk).
//  - Items the note marks (B, inferred) or leaves open are implemented as reasoned readings and marked `// inferred`.
import { App, CommandDef } from '../core/commands';
import { Node, Shader, Material, X3DObject, Cluster, Group, Camera, Light, Null, Layer, Property } from '../core/scene';
import { siString } from '../ui/si';
import { siMsgBox } from '../ui/msgBox';
import { NotYetAttested } from './fbx';
import {
  TextureLayer, TextureLayerPort, type PortRef, type TextureSwitches, type TextureMapping,
  layersOf, setLayersOf, layerFamily, mergedLayerOrder, layerInsertIndex, nextLayerInContainer, moveInMergedOrder, layerSuitableFor,
  isLayerContainer, supportsTextureLayers, addLayerPort, removeLayerPort, layerPortsOn, layerPortName, isLayerablePort,
  portDataType, sourceDataType, portColor4, getSource, setSourceRaw, sourceUsers, wouldCycle,
  nestedShaders, nestShader, unnestShader, owningContainer, uniqueShaderContainer, uniqueNameIn, containerLayers,
  makePresetShader, makeProgIdShader, isShaderPreset, isMix8, mainInput, cloneShaderTree,
  defaultTexturePorts, currentMaterial, isLocalMaterial,
  looksLikeImageFile, clipNameForFile, isImageClip, isImageSource,
  resolvePort, resolveNode, listOf, nodePath, portPath,
  siShaderDataTypeColor4, siShaderDataTypeScalar, siShaderCnxPointAll,
} from '../core/textureLayers';

const NOTE = 'docs/ghidra/cmd-01c-texture-layers.md';

// ------------------------------------------------------------------ messages

/** XSISCRIPTS texts of the note (fallback when the committed strings.json lacks the record). */
const SCRIPT_TEXT: Record<number, string> = {
  1103: 'Cannot attach blender to input %s: invalid type',
  1104: 'You are about to modify a shared material.  Create local copies of this shared material?',
  1105: 'Shared Material',
  1106: 'You are about to modify shared materials.  Create local copies of these shared materials?',
  1107: 'Shared Materials',
  1108: 'The material " %s ", ',
  1109: 'used by 1 object in the selection list ( %s ',
  1110: 'used by %s objects in the selection list  ( %s and %s',
  1111: 'used by " %s " objects in the selection list  ( %s, %s...',
  1112: '), is a shared property.',
  1113: 'Create a local material for each of the %s objects in the selection that use this material?  ',
  1114: 'Create a local material for the object in the selection that uses this material?',
  1115: 'The preset(s) could not be applied to this selection',
  1116: 'Texturing',
  1195: 'The preset(s) could not be applied to this selection',
  1197: 'Texturing',
};
/** XSIMSGCAT texts logged by the group A tasks. */
const CAT_TEXT: Record<number, string> = {
  69: 'Connection of this shader would cause a cycle.',
  70: 'Type mismatch between shader and connection point.',
  72: 'This shader is already connected to another object.',
  413: 'The shader port cannot support a texture layer port. Only color, vector, scalar, integer and boolean shader ports supports texture layers.',
};
const fill = (text: string, ...args: (string | number)[]) => { let i = 0; return text.replace(/%s/g, () => String(args[i++] ?? '')); };
export function scriptText(id: number, ...args: (string | number)[]): string { return fill(siString('XSISCRIPTS', id) ?? SCRIPT_TEXT[id] ?? '', ...args); }
export function catText(id: number): string { return (siString('XSIMSGCAT', id) ?? '').replace(/^\d+\$/, '').trim() || CAT_TEXT[id] || ''; }
const warn = (app: App, text: string) => app.logMsg('info', 'WARNING : ' + text);
const isInteractive = (app: App) => (app as any).Interactive !== false;

/** The script message box helper (note, "Script message box helper"): batch mode logs `<title>: <prompt>` and
 *  returns the caller's default. Interactive mode shows notices; a Yes/No question cannot block the bus, so it is
 *  logged and answered with the same default (known gap, see header). */
function scriptMsgBox(app: App, prompt: string, title: string, buttons: 'OK' | 'YesNo', def: 'OK' | 'Yes' | 'No'): 'OK' | 'Yes' | 'No' {
  if (!isInteractive(app)) { app.logMsg('info', `${title}: ${prompt}`); return def; }
  if (buttons === 'OK') { try { siMsgBox(prompt, title || 'AfterImage'); } catch { app.logMsg('info', `${title}: ${prompt}`); } return def; }
  app.logMsg('info', `${title}: ${prompt}`);
  app.logMsg('info', `${title}: answered "${def}" (a Yes/No message box cannot block the command bus yet)`);
  return def;
}

// ------------------------------------------------------------------ argument helpers

const refs = (app: App, x: any): PortRef[] => {
  const out: PortRef[] = [];
  for (const it of listOf(x)) { const r = resolvePort(app.scene, it); if (r && !out.some(o => o.owner === r.owner && o.name === r.name)) out.push(r); }
  return out;
};
const nodes = (app: App, x: any): Node[] => {
  const out: Node[] = [];
  for (const it of listOf(x)) { const n = it instanceof Node ? it : resolveNode(app.scene, it); if (n && !out.includes(n)) out.push(n); }
  return out;
};
const layerArg = (app: App, x: any): TextureLayer | null => { const n = x instanceof Node ? x : resolveNode(app.scene, Array.isArray(x) ? x[0] : x); return n instanceof TextureLayer ? n : null; };
const layerArgs = (app: App, x: any): TextureLayer[] => nodes(app, x).filter((n): n is TextureLayer => n instanceof TextureLayer);
const splitNames = (x: any): string[] => x === null || x === undefined ? [] : String(x).split(',').map(s => s.trim()).filter(Boolean);
function enumArg(v: any, table: Record<string, number>, def: number): number {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return def;
  const s = String(v); if (/^-?\d+$/.test(s.trim())) return Number(s);
  for (const part of s.split(':')) if (part in table) return table[part];
  return def;
}
const PRESET_MODES = { siBlendInPreset: 0, siReplaceAndBlendInPreset: 1, siReplaceNoBlend: 2 };
const LAYER_MODES = { siBlendInTextureLayers: 0, siReplaceAndBlendInTextureLayers: 1, siReplaceAndNoBlendInTextureLayers: 2 };
const switchesOf = (a: Record<string, any>): TextureSwitches => ({ Ambient: !!a.Ambient, Diffuse: !!a.Diffuse, Transparency: !!a.Transparency, Reflection: !!a.Reflection });
const setVal = (app: App, n: Node, name: string, v: any) => { const p = n.get(name); if (p) app.setParam(p, v); };
const inspect = (app: App, n: Node | null | undefined) => { if (n) app.events.emit('inspect', n); };

// ------------------------------------------------------------------ shaders and connections (undoable)

/** Connect `src` to a port (null disconnects) and return what was there. */
function connect(app: App, ref: PortRef, src: Node | null): Node | null {
  const old = getSource(ref); if (old === src) return old;
  app.record('Connect shader', () => setSourceRaw(ref, src), () => setSourceRaw(ref, old));
  return old;
}
function nest(app: App, container: Node, sh: Shader) { if (!nestedShaders(container).includes(sh)) app.record('Nest shader', () => nestShader(container, sh), () => unnestShader(container, sh)); }
/** "Create shader from preset name" in a container; null on failure. */
function createShader(app: App, container: Node, preset: any, name?: string): Shader | null {
  const sh = preset instanceof Shader ? null : makePresetShader(preset); if (!sh) return null;
  sh.name = uniqueNameIn(container, name || sh.name);
  nest(app, container, sh); return sh;
}
/** A displaced shader that nothing uses any more is deleted (taken out of its container); otherwise it stays. */
function deleteIfUnused(app: App, container: Node, sh: Shader) {
  if (sourceUsers(container, sh).length) return;
  if (nestedShaders(container).includes(sh)) app.record('Delete shader', () => unnestShader(container, sh), () => nestShader(container, sh));
}
/** The connection primitive behind SIConnectShaderToCnxPoint: connects `src` to the port, placing a converter in
 *  front when the types differ. Returns what ends up on the port, or null when no converter is known.
 *  Attested converters: `Conversion\Color2scalar` and `Conversion\Scalar2color` (they are the ones the scripts
 *  apply); every other mismatch returns null (Q14). */
function connectWithConverter(app: App, container: Node, src: Node, ref: PortRef, deleteOnLast: boolean): Node | null {
  if (wouldCycle(src, ref.owner)) throw new Error(catText(69)); // inferred: the cycle message of the layer tasks
  const pt = portDataType(ref), st = sourceDataType(src);
  let onPort: Node | null = null;
  if (ref.owner instanceof Material) onPort = src instanceof Shader ? src : null;
  else if (st === pt) onPort = src;
  else if ((st === siShaderDataTypeColor4 && pt === siShaderDataTypeScalar) || (st === siShaderDataTypeScalar && pt === siShaderDataTypeColor4)) {
    const conv = createShader(app, container, st === siShaderDataTypeColor4 ? 'Conversion\\Color2scalar' : 'Conversion\\Scalar2color');
    if (conv) { connect(app, { owner: conv, name: 'input' }, src); onPort = conv; }
  }
  if (!onPort) return null;
  if (src instanceof Shader) nest(app, container, src);
  const displaced = connect(app, ref, onPort);
  if (displaced instanceof Shader && displaced !== onPort) { if (deleteOnLast) deleteIfUnused(app, container, displaced); else nest(app, container, displaced); }
  return onPort;
}
/** The behaviour behind SIApplyShaderToCnxPoint: create a shader from a preset in the container, connect it to the ports, return it. */
function applyPreset(app: App, container: Node, preset: any, ports: PortRef[], name = '', deleteOnLast = true): Shader | null {
  const sh = createShader(app, container, preset, name || undefined); if (!sh) return null;
  for (const p of ports) if (!connectWithConverter(app, container, sh, p, deleteOnLast)) warn(app, `Cannot find a valid converter for ${nodePath(app.scene, sh)} when connecting to ${portPath(app.scene, p)}`);
  return sh;
}

// ------------------------------------------------------------------ image clips

/** "Create image clip from a file name" (shared helper): SICreateImageClip is `CreateImageClip` in this build. */
function clipFromFile(app: App, file: any): Property | null {
  if (!looksLikeImageFile(file)) return null;
  const sel = [...app.selection]; let clip: any = null;
  try { clip = app.run('CreateImageClip', { FileName: String(file).trim(), Name: clipNameForFile(String(file)) }); } catch { clip = null; }
  app.selection = sel;
  return isImageClip(clip) ? clip : null;
}
/** An image source turned into a clip (SIAddImageClip in Softimage). Image sources are not modelled; see core. */
function clipFromSource(app: App, src: Property): Property | null {
  const sel = [...app.selection]; let clip: any = null;
  try { clip = app.run('CreateImageClip', { FileName: String(src.val('filename') ?? src.val('FileName') ?? ''), Name: src.name }); } catch { clip = null; }
  app.selection = sel;
  return isImageClip(clip) ? clip : null;
}
const asClip = (app: App, x: any): Property | null => { const n = x instanceof Node ? x : resolveNode(app.scene, x); return isImageClip(n) ? n : isImageSource(n) ? clipFromSource(app, n) : null; };

// ------------------------------------------------------------------ A. texture layer tasks

function addTextureLayer(app: App, a: Record<string, any>): TextureLayer {
  const scene = app.scene;
  if (a.InputObjs === null || a.InputObjs === undefined || a.InputObjs === '') throw new Error('Argument InputObjs is required: the containers (materials or shaders) to add the texture layer to');
  const containers = nodes(app, a.InputObjs).filter(isLayerContainer); // other elements are skipped silently
  const existing = a.Object === null || a.Object === undefined || a.Object === '' ? null : layerArg(app, a.Object);
  if (!existing && a.Object !== null && a.Object !== undefined && a.Object !== '') throw new Error(`Object is not a texture layer: ${a.Object?.fullName ?? a.Object}`);
  const reference = a.Reference === null || a.Reference === undefined || a.Reference === '' ? null : layerArg(app, a.Reference);
  const after = a.After !== false && a.After !== 0 && a.After !== 'False' && a.After !== 'false';
  // 1. new layer: `Name`, or `Layer`. // inferred: numbered when the first container already has that name.
  const layer = existing ?? new TextureLayer(containers[0] ? uniqueNameIn(containers[0], String(a.Name || 'Layer')) : String(a.Name || 'Layer'));
  // 2. plan every insert on a working copy, so an abort leaves nothing behind (step 4).
  const work = new Map<Node, TextureLayer[]>();
  const get = (c: Node) => work.get(c) ?? layersOf(c);
  const holders: Node[] = [...layer.containers];
  for (const c of containers) {
    if ((c as any).locked) throw new Error(`Access denied: ${c.name} is locked`); // the lock error text is not attested
    if (!layerSuitableFor(scene, layer, c, holders)) throw new Error(catText(72));
    const list = [...get(c)];
    if (list.includes(layer)) throw new Error(`Unspecified failure: the texture layer ${layer.name} is already in ${c.name}`);
    const refMerged = reference && !list.includes(reference) ? mergedLayerOrder([...reference.containers], get).order : [];
    list.splice(layerInsertIndex(list, reference, after, refMerged), 0, layer);
    work.set(c, list); holders.push(c);
  }
  // 3. the merged order across the containers must still exist.
  const family = layerFamily(holders, get, l => l === layer ? holders : [...new Set([...l.containers, ...[...work.keys()].filter(c => work.get(c)!.includes(l))])]);
  if (mergedLayerOrder(family, get).conflict) throw new Error(catText(69)); // inferred reading of "reports a conflict"
  const before = new Map<Node, TextureLayer[]>(); for (const c of work.keys()) before.set(c, [...layersOf(c)]);
  if (work.size) app.record('AddTextureLayer', () => { for (const [c, l] of work) setLayersOf(c, l); }, () => { for (const [c, l] of before) setLayersOf(c, l); });
  return layer;
}

function addTextureLayerPorts(app: App, a: Record<string, any>): TextureLayerPort[] {
  const layer = layerArg(app, a.InputObj);
  if (!layer) throw new Error('Argument InputObj is required: the texture layer');
  const out: TextureLayerPort[] = [];
  for (const item of listOf(a.InputObjs)) {
    const t = resolvePort(app.scene, item);
    // 1. the owner must be a texture layer container
    if (!t || !isLayerContainer(t.owner)) throw new Error(catText(70));
    // 2. layerable: boolean, scalar, vector3, colour4 (the further condition Q6 is not identified)
    if (!isLayerablePort(t)) { warn(app, `413 - ${catText(413)}`); continue; }
    // 3. the layer joins the target's container, before the next layer of the merged order that is in it
    if (!layersOf(t.owner).includes(layer)) {
      const next = nextLayerInContainer(layer, t.owner);
      app.run('AddTextureLayer', next ? { Object: layer, InputObjs: [t.owner], After: false, Reference: next } : { Object: layer, InputObjs: [t.owner], After: true });
    }
    // 4. the port. No duplicate check is made at this level (Q7).
    const port = new TextureLayerPort(layerPortName(layer, t), layer, t);
    app.record('AddTextureLayerPorts', () => addLayerPort(port), () => removeLayerPort(port));
    out.push(port);
  }
  return out;
}

function moveTextureLayers(app: App, a: Record<string, any>): void {
  const moving = layerArgs(app, a.InputObjs); const offset = Math.trunc(Number(a.Offset ?? -1)) || 0;
  if (!moving.length) return;
  const family = layerFamily(moving.flatMap(l => l.containers));
  const merged = mergedLayerOrder(family).order;
  const moved = moveInMergedOrder(merged, moving, offset);
  const before = new Map<Node, TextureLayer[]>(), afterMap = new Map<Node, TextureLayer[]>();
  for (const c of family) { const cur = [...layersOf(c)]; before.set(c, cur); afterMap.set(c, moved.filter(l => cur.includes(l))); }
  app.record('MoveTextureLayers', () => { for (const [c, l] of afterMap) setLayersOf(c, l); }, () => { for (const [c, l] of before) setLayersOf(c, l); });
}

function removeTextureLayers(app: App, a: Record<string, any>): void {
  const layers = layerArgs(app, a.InputObjs);
  const given = a.Container !== null && a.Container !== undefined && a.Container !== '';
  const container = given ? nodes(app, a.Container)[0] ?? null : null;
  if (given && !container) throw new Error(`Container not found: ${a.Container}`);
  const touched = new Set<Node>();
  const afterMap = new Map<Node, TextureLayer[]>();
  const list = (c: Node) => { if (!afterMap.has(c)) afterMap.set(c, [...layersOf(c)]); return afterMap.get(c)!; };
  const drop = (c: Node, l: TextureLayer) => { const ls = list(c); const i = ls.indexOf(l); if (i >= 0) ls.splice(i, 1); touched.add(c); };
  for (const l of layers) {
    if (container && !layersOf(container).includes(l)) continue; // not in the container: ignored
    if (l.locked) throw new Error(`Access denied: ${l.name} is locked`);
    // Container omitted: the layer is deleted, so it leaves all its containers (Q10 read literally).
    // Container given: removed from it; when that was its last container the layer is thereby deleted.
    for (const c of container ? [container] : [...l.containers]) drop(c, l);
  }
  if (!touched.size) return;
  const before = new Map<Node, TextureLayer[]>(); for (const c of touched) before.set(c, [...layersOf(c)]);
  // Ports stay on the layer object: they go with a deleted layer and stay on one that is only removed from one
  // of several containers (Q11, "presumably"). // inferred
  app.record('RemoveTextureLayers', () => { for (const c of touched) setLayersOf(c, afterMap.get(c)!); }, () => { for (const [c, l] of before) setLayersOf(c, l); });
}

// ------------------------------------------------------------------ B. layer creation wrappers

function renameLayer(app: App, layer: TextureLayer, name: string) {
  const old = layer.name; const c = layer.containers[0]; const nn = c ? uniqueNameIn(c, name, []) : name;
  app.record('Rename', () => { layer.name = nn; }, () => { layer.name = old; });
}
const layerArgsFrom = (a: Record<string, any>, containers: Node[]) => {
  const r: Record<string, any> = { InputObjs: containers, Name: a.Name ?? '', After: a.After ?? true };
  if (a.Reference !== null && a.Reference !== undefined && a.Reference !== '') r.Reference = a.Reference; // only when one was given
  return r;
};

function addPresetTextureLayer(app: App, a: Record<string, any>): TextureLayer | null {
  const containers = nodes(app, a.InputObjs);
  const sc = uniqueShaderContainer(app.scene, containers);
  if (!containers.length || !sc) throw new Error('The input objects are not within one shader container'); // B1 step 1: "the command fails" (text not attested, Q12)
  const sh = createShader(app, sc, a.PresetObj);
  if (!sh) { app.logMsg('error', 'Invalid preset provided.'); return null; }
  const layer: TextureLayer = app.run('AddTextureLayer', layerArgsFrom(a, containers));
  connect(app, { owner: layer, name: 'color' }, sh);
  if (!a.Name) renameLayer(app, layer, `${sh.name}_Layer`);
  return layer;
}
/** B2 from step 3 on, shared with B3. */
function clipLayer(app: App, clip: Property, a: Record<string, any>): TextureLayer | null {
  const containers = nodes(app, a.InputObjs);
  const layer: TextureLayer = app.run('AddTextureLayer', layerArgsFrom(a, containers));
  const sh: Shader | null = app.run('SIApplyShaderToCnxPoint', { PresetObj: 'Image', InputObjs: [{ owner: layer, name: 'color' }] });
  if (sh) app.run('SIConnectShaderToCnxPoint', { Source: clip, InputObjs: [{ owner: sh, name: 'tex' }], DeleteOnLastDisconnection: false });
  if (!a.Name) renameLayer(app, layer, `${clip.name}_Layer`);
  setVal(app, layer, 'maskmode', 0);
  return layer;
}
function addClipTextureLayer(app: App, a: Record<string, any>): TextureLayer | null {
  const clip = asClip(app, a.Clip);
  // Q12: as written the Softimage script then stops on a script error; here the command's own message is logged and nothing is returned.
  if (!clip) { app.logMsg('error', 'Invalid clip provided.'); return null; }
  return clipLayer(app, clip, a);
}
function addImageTextureLayer(app: App, a: Record<string, any>): TextureLayer | null {
  const clip = clipFromFile(app, a.FileName);
  if (!clip) { app.logMsg('error', 'Invalid image file provided.'); return null; }
  return clipLayer(app, clip, a);
}

// ------------------------------------------------------------------ C. blend presets through mixers

/** C1 step 3: one shader per name, created once in the container and shared by all ports. */
function createPresetShaders(app: App, container: Node, names: string[]): Shader[] {
  const out: Shader[] = [];
  for (const name of names) {
    let sh = isShaderPreset(name) ? createShader(app, container, name) : null;
    if (!sh) { const clip = clipFromFile(app, name); if (clip) { sh = createShader(app, container, 'Image', 'Image'); if (sh) connect(app, { owner: sh, name: 'tex' }, clip); } }
    if (!sh) { warn(app, `Could not create preset or image '${name}'`); continue; }
    out.push(sh);
  }
  return out;
}
const layerIsFree = (app: App, m: Shader, i: number) => { const p = m.get(`inuse${i}`); return !!p && !getSource({ owner: m, name: `inuse${i}` }) && !app.anim.isAnimated(p) && !app.anim.expression(p) && p.value === false; };
const firstFreeLayer = (app: App, m: Shader) => { for (let i = 1; i <= 7; i++) if (layerIsFree(app, m, i)) return i; return 0; };
/** Taking a free layer resets it (C1, algorithm step 1). */
function takeLayer(app: App, m: Shader, i: number): PortRef {
  for (const n of ['color', 'weight', 'alpha', 'mode']) {
    const ref = { owner: m, name: `${n}${i}` };
    if (getSource(ref)) connect(app, ref, null); // disconnected, not deleted
    const p = m.get(ref.name); if (p && (app.anim.isAnimated(p) || app.anim.expression(p))) app.anim.removeAnimation(p);
  }
  setVal(app, m, `weight${i}`, [1, 1, 1, 0.5]); setVal(app, m, `alpha${i}`, true); setVal(app, m, `mode${i}`, 1); setVal(app, m, `inuse${i}`, true);
  return { owner: m, name: `color${i}` };
}
function newMixer(app: App, container: Node, name: string): Shader | null {
  const m = createShader(app, container, 'Mixers\\Mix_8colors', name);
  if (!m) { warn(app, "Couldn't create Mix_8colors"); return null; }
  for (let i = 1; i <= 7; i++) setVal(app, m, `inuse${i}`, false);
  return m;
}
/** A new mixer on the port; what was on the port moves under it (algorithm step 3). */
function mixerOnPort(app: App, container: Node, port: PortRef, name: string): Shader | null {
  const old = getSource(port); const restore = () => { if (getSource(port) !== old) connect(app, port, old); };
  const mixer = newMixer(app, container, name); if (!mixer) return null;
  if (portDataType(port) === siShaderDataTypeColor4) {
    if (old) connect(app, port, null);
    setVal(app, mixer, 'base_color', portColor4(port)); // colours carry no animation in this app's parameter model
    if (old) connectWithConverter(app, container, old, { owner: mixer, name: 'base_color' }, false);
    connect(app, port, mixer);
  } else {
    const s2c = applyPreset(app, container, 'Conversion\\Scalar2color', [{ owner: mixer, name: 'base_color' }], '', false);
    if (!s2c) { warn(app, 'Could not create Scalar2color'); restore(); return null; }
    setVal(app, s2c, 'alpha', 1);
    const from = (port.owner as any).get?.(port.name), to = s2c.get('input');
    if (from && to) { app.setParam(to, Number(from.value) || 0); const fc = app.anim.fcurve(from); if (fc?.keys.length) for (const k of fc.keys) app.anim.setKey(to, k.time, k.value); }
    if (old) connectWithConverter(app, container, old, { owner: s2c, name: 'input' }, false);
    const c2s = applyPreset(app, container, 'Conversion\\Color2scalar', [port], '', false);
    if (!c2s) { warn(app, "Couldn't create Color2scalar"); restore(); return null; }
    connect(app, { owner: c2s, name: 'input' }, mixer);
  }
  return mixer;
}
/** "Finding or creating free mixer inputs on a port" (C1). Returns the `color<i>` inputs, in order; null = port skipped. */
function freeMixerInputs(app: App, container: Node, port: PortRef, count: number, name: string): PortRef[] | null {
  const src = getSource(port);
  let mixer: Shader | null = isMix8(src) && firstFreeLayer(app, src) ? src : null; // step 2: reuse
  if (!mixer) mixer = mixerOnPort(app, container, port, name);                     // step 3: new mixer
  if (!mixer) return null;
  const taken: PortRef[] = [];
  for (let guard = 0; taken.length < count && guard < 64; guard++) {
    for (let i = firstFreeLayer(app, mixer); taken.length < count && i; i = firstFreeLayer(app, mixer)) taken.push(takeLayer(app, mixer, i));
    if (taken.length >= count) break;
    // step 4: the mixer is full. One already taken input is given up and a further mixer goes on it.
    const given = taken.pop(); if (!given) break; // inferred: the input given up is the last one taken
    const next = newMixer(app, container, name); if (!next) { taken.push(given); break; }
    connect(app, given, next); mixer = next;
  }
  return taken;
}
/** C1 steps 4 and 5. */
function blendShadersOnPorts(app: App, container: Node, shaders: Shader[], ports: PortRef[]) {
  if (!shaders.length) return;
  for (const port of ports) {
    const t = portDataType(port);
    if (t !== siShaderDataTypeColor4 && t !== siShaderDataTypeScalar) { scriptMsgBox(app, scriptText(1103, portPath(app.scene, port)), 'Warning', 'OK', 'OK'); continue; }
    const inputs = freeMixerInputs(app, container, port, shaders.length, `${port.name}_blend`);
    if (!inputs) continue;
    inputs.forEach((inp, i) => connect(app, inp, shaders[i]));
  }
}
function blendInPresetsWithPorts(app: App, a: Record<string, any>): Shader[] {
  const ports = refs(app, a.InputObjs); const container = ports.length ? uniqueShaderContainer(app.scene, ports) : null;
  if (!ports.length || !container) return [];
  const names = splitNames(a.PresetNames); if (!names.length) return [];
  const shaders = createPresetShaders(app, container, names); if (!shaders.length) return [];
  blendShadersOnPorts(app, container, shaders, ports);
  return shaders;
}

// ---- material list with sharing resolution (shared helper)

/** `MakeLocal` is not registered in this build: the local copy is made here. // inferred: the copy keeps the
 *  material's name (numbered by the scene) and its shader tree; texture layers of the shared material are not copied. */
function makeLocalMaterial(app: App, o: X3DObject, m: Material): Material {
  const copy = new Material(app.scene.uniqueName(m.name)); copy.setSurface(m.surface ? cloneShaderTree(m.surface) : null);
  const old = o.material; const mats = app.scene.materials;
  app.record('MakeLocal', () => { mats.push(copy); o.setMaterial(copy); }, () => { const i = mats.indexOf(copy); if (i >= 0) mats.splice(i, 1); o.setMaterial(old); });
  return copy;
}
/** Objects of an InputObjs collection for the object-based commands (C2, D2, D4). */
function objectsOf(app: App, x: any, cmd: string): X3DObject[] {
  const out: X3DObject[] = [];
  for (const it of listOf(x)) {
    if (typeof it === 'string' && /\.(poly|pnt|edge|sample|subsrf|knot|isopnt)\[/.test(it)) {
      // Step 2: polygon / sub-surface selections become a cluster with its own shader; sample, point and edge ones are ignored.
      if (/\.(poly|subsrf)\[/.test(it)) app.logMsg('info', `${cmd}: ${it}: cluster materials are not modelled in this build; the sub-component selection is skipped`);
      continue;
    }
    const n = it instanceof Node ? it : resolveNode(app.scene, it) ?? app.scene.find(String(it)) ?? null;
    if (n instanceof X3DObject) { if (!out.includes(n)) out.push(n); } // step 1: duplicates are dropped
    else if (n instanceof Cluster || n instanceof Group) app.logMsg('info', `${cmd}: ${n.name}: cluster and group materials are not modelled in this build; skipped`);
  }
  return out;
}
function materialList(app: App, objs: X3DObject[], action: number, sw: TextureSwitches): Material[] {
  const scene = app.scene;
  type Entry = { mat: Material; makeLocal: X3DObject[] };
  const kept: Entry[] = [];
  // 3. each distinct material once, only when it has a qualifying default-texturable port
  for (const o of objs) {
    const m = currentMaterial(scene, o); if (!m) continue;
    let e = kept.find(k => k.mat === m);
    if (!e) { if (!defaultTexturePorts(m, sw).length) continue; kept.push(e = { mat: m, makeLocal: [] }); }
    if (!isLocalMaterial(scene, m, o)) e.makeLocal.push(o);
  }
  // 4. SharedMatAction
  const shared = kept.filter(e => e.makeLocal.length);
  let beginner: boolean | null = null;
  const out: Material[] = [];
  for (const e of kept) {
    let local = false;
    if (e.makeLocal.length) {
      if (action === 1) local = true;
      else if (action === 2) {
        if (beginner === null) {
          if (kept.length === 1 && e.mat.name.toLowerCase() !== 'scenematerial') beginner = true;
          else beginner = scriptMsgBox(app, scriptText(shared.length === 1 ? 1104 : 1106), scriptText(shared.length === 1 ? 1105 : 1107), 'YesNo', 'No') === 'Yes';
        }
        local = beginner;
      } else if (action === 3) {
        const n = e.makeLocal.length, names = e.makeLocal.map(o => o.name);
        const used = n === 1 ? scriptText(1109, names[0]) : n === 2 ? scriptText(1110, n, names[0], names[1]) : scriptText(1111, n, names[0], names[1]);
        const prompt = scriptText(1108, e.mat.name) + used + scriptText(1112) + '\n\n' + (n === 1 ? scriptText(1114) : scriptText(1113, n));
        local = scriptMsgBox(app, prompt, '', 'YesNo', 'No') === 'Yes'; // the title's lookup key is empty in the script (Q4)
      }
    }
    // 5. local copies, or the shared material once
    if (local) for (const o of e.makeLocal) out.push(makeLocalMaterial(app, o, e.mat));
    else out.push(e.mat);
    if (local && e.makeLocal.length < objs.filter(o => currentMaterial(scene, o) === e.mat).length && !out.includes(e.mat)) out.push(e.mat); // it was already local to one of the objects
  }
  return out;
}
/** The `usealphatrans` / `inverttrans` / `usealpharefl` step of the replace modes (C2 step 3, D2). */
function alphaFlags(app: App, port: PortRef, mapping: TextureMapping, sw: TextureSwitches) {
  const o = port.owner;
  if (sw.Transparency && mapping === 'transparency') { if (o.get('usealphatrans') && o.get('inverttrans')) { setVal(app, o, 'usealphatrans', true); setVal(app, o, 'inverttrans', true); } }
  else if (sw.Reflection && mapping === 'reflection') { if (o.get('usealpharefl')) setVal(app, o, 'usealpharefl', true); }
}
function blendInPresets(app: App, a: Record<string, any>, cmd: string): Shader[] {
  const names = splitNames(a.PresetNames); const objs = objectsOf(app, a.InputObjs, cmd);
  if (!names.length || !objs.length) return [];
  const sw = switchesOf(a); const mode = enumArg(a.Mode, PRESET_MODES, 0);
  const result: Shader[] = [];
  for (const m of materialList(app, objs, Number(a.SharedMatAction ?? 3), sw)) {
    const found = defaultTexturePorts(m, sw); if (!found.length) continue;
    const ports = found.map(f => f.ref);
    if (mode === 1 || mode === 2) for (const f of found) { if (getSource(f.ref)) connect(app, f.ref, null); alphaFlags(app, f.ref, f.mapping, sw); }
    const shaders = createPresetShaders(app, m, names); if (!shaders.length) continue;
    if (mode === 2) {
      for (const p of ports) connectWithConverter(app, m, shaders[0], p, false); // the first preset goes directly on each port
      blendShadersOnPorts(app, m, shaders.slice(1), ports);
    } else blendShadersOnPorts(app, m, shaders, ports);
    result.push(...shaders);
  }
  if (a.NotifyNoResult === true && !result.length) scriptMsgBox(app, scriptText(1115), scriptText(1116), 'OK', 'OK');
  return result;
}
function connectShaderWithBlends(app: App, a: Record<string, any>): Shader | null {
  const ports = refs(app, a.InputObjs); if (!ports.length) return null;
  const container = uniqueShaderContainer(app.scene, ports); if (!container) return null;
  let shader: Shader | null = null;
  for (const port of ports) {
    const [r, g, b] = portColor4(port);
    const mixer = applyPreset(app, container, a.Mixer, [port], 'mixer'); if (!mixer) continue;
    const c1 = { owner: mixer, name: 'color1' };
    if (!shader) shader = applyPreset(app, container, a.PresetObj, [c1], 'Shader'); else connectWithConverter(app, container, shader, c1, true);
    const cur = mixer.val('color2'); setVal(app, mixer, 'color2', Array.isArray(cur) && cur.length > 3 ? [r, g, b, cur[3]] : [r, g, b]);
  }
  return shader;
}

// ------------------------------------------------------------------ D. blend presets / clips as layers

/** D1 step 2: ports grouped by their owning container; containers that do not support layers are dropped. */
function portsByContainer(app: App, ports: PortRef[]): Map<Node, PortRef[]> | null {
  const groups = new Map<Node, PortRef[]>();
  for (const p of ports) {
    const c = owningContainer(p);
    if (!c || !supportsTextureLayers(c)) { warn(app, `Could not add layers to ${portPath(app.scene, p)}`); continue; }
    if (!groups.has(c)) groups.set(c, []); groups.get(c)!.push(p);
  }
  if (!groups.size || !uniqueShaderContainer(app.scene, [...groups.keys()])) return null;
  return groups;
}
function layersForNames(app: App, names: string[], groups: Map<Node, PortRef[]>): TextureLayer[] {
  const out: TextureLayer[] = [];
  for (const name of names) for (const [c, ps] of groups) {
    let layer: TextureLayer | null = null;
    if (isShaderPreset(name)) layer = app.run('AddPresetTextureLayer', { PresetObj: name, InputObjs: [c], Name: '', After: true });
    else if (looksLikeImageFile(name)) layer = app.run('AddImageTextureLayer', { FileName: name, InputObjs: [c], Name: '', After: true });
    if (!layer) { warn(app, `Could not create preset or image '${name}'`); continue; }
    setVal(app, layer, 'weight', 1);
    app.run('AddTextureLayerPorts', { InputObj: layer, InputObjs: ps });
    out.push(layer);
  }
  return out;
}
function blendInTextureLayersWithPorts(app: App, a: Record<string, any>): TextureLayer[] {
  const ports = refs(app, a.InputObjs); const names = splitNames(a.PresetNames);
  if (!ports.length || !names.length) return [];
  const groups = portsByContainer(app, ports); if (!groups) return [];
  return layersForNames(app, names, groups);
}
/** RemoveAllShadersFromCnxPoint with siShaderCnxPointAll: the shader connection and every texture layer port on the port. */
function removeAllFromPort(app: App, port: PortRef, what = siShaderCnxPointAll) {
  if (what & 1) if (getSource(port)) connect(app, port, null);
  if (what & 2) for (const lp of layerPortsOn(port)) app.record('Remove texture layer port', () => removeLayerPort(lp), () => addLayerPort(lp));
}
function blendInTextureLayers(app: App, a: Record<string, any>, cmd: string): (TextureLayer | Shader)[] {
  const names = splitNames(a.PresetNames); const objs = objectsOf(app, a.InputObjs, cmd);
  if (!names.length || !objs.length) return [];
  const sw = switchesOf(a); const mode = enumArg(a.Mode, LAYER_MODES, 0);
  const result: (TextureLayer | Shader)[] = [];
  for (const m of materialList(app, objs, Number(a.SharedMatAction ?? 2), sw)) {
    const found = defaultTexturePorts(m, sw); if (!found.length) continue;
    const ports = found.map(f => f.ref);
    if (mode === 1 || mode === 2) for (const f of found) { removeAllFromPort(app, f.ref); alphaFlags(app, f.ref, f.mapping, sw); }
    const groups = portsByContainer(app, ports); if (!groups) continue;
    let rest = names;
    if (mode === 2) {
      // the first preset is a plain shader, once per container, directly on that container's ports
      for (const [, ps] of groups) {
        const sh = createPresetShaders(app, m, [names[0]])[0]; if (!sh) continue;
        for (const p of ps) connectWithConverter(app, m, sh, p, false);
        result.push(sh);
      }
      rest = names.slice(1);
    }
    result.push(...layersForNames(app, rest, groups));
  }
  if (a.NotifyNoResult === true && !result.length) scriptMsgBox(app, scriptText(1195), scriptText(1197), 'OK', 'OK');
  return result;
}
function blendClipsInTextureLayersWithPorts(app: App, a: Record<string, any>): TextureLayer[] {
  const ports = refs(app, a.InputObjs); const clipItems = listOf(a.ClipList);
  if (!ports.length || !clipItems.length) return [];
  const groups = portsByContainer(app, ports); if (!groups) return [];
  const out: TextureLayer[] = [];
  for (const item of clipItems) for (const [c, ps] of groups) {
    let layer: TextureLayer | null = null;
    try { layer = app.run('AddClipTextureLayer', { Clip: item, InputObjs: [c], Name: '', After: true }); } catch { layer = null; }
    if (!layer) { warn(app, `Could not blend in clip '${item?.name ?? item}'`); continue; }
    setVal(app, layer, 'weight', 1);
    app.run('AddTextureLayerPorts', { InputObj: layer, InputObjs: ps });
    out.push(layer);
  }
  return out;
}
/** The shader a D result stands for: the shader itself, or for a layer the shader on its `color`. */
const shaderOfResult = (r: TextureLayer | Shader | undefined): Shader | null => r instanceof Shader ? r : r instanceof TextureLayer ? (getSource({ owner: r, name: 'color' }) as Shader | null) : null;
function blendClipsInTextureLayers(app: App, a: Record<string, any>, cmd: string): (TextureLayer | Shader)[] {
  const clips: Property[] = [];
  for (const item of listOf(a.ClipList)) {
    const clip = asClip(app, item);
    if (!clip) { app.logMsg('info', `${item?.fullName ?? item} is not a valid clip or source.`); continue; }
    clips.push(clip);
  }
  // As written the script builds n - 1 presets for n >= 2 clips and runs out of results (Q13): only the one-clip case is wired.
  if (clips.length >= 2) throw new NotYetAttested(cmd, 'the result with two or more clips', 'Q13 (cmd-01c)');
  const result = blendInTextureLayers(app, { ...a, PresetNames: clips.map(() => 'Image').join(',') }, cmd);
  clips.forEach((clip, i) => { const sh = shaderOfResult(result[i]); if (sh) connect(app, { owner: sh, name: 'tex' }, clip); });
  return result;
}

// ------------------------------------------------------------------ E. insert

function insertShader(app: App, a: Record<string, any>): Shader[] | undefined {
  const ports = refs(app, a.InputObjs);
  const container = ports.length ? uniqueShaderContainer(app.scene, ports) : null;
  if (!container) { app.logMsg('error', 'Failed to insert a shaderbecause the targeted ports are not within the same shader container.'); return undefined; } // spelled as shipped
  // 2. group by the shader currently connected; unconnected ports each form their own group
  const groups: { old: Node | null; ports: PortRef[] }[] = [];
  for (const p of ports) { const old = getSource(p); const g = old ? groups.find(x => x.old === old) : undefined; if (g) g.ports.push(p); else groups.push({ old, ports: [p] }); }
  const out: Shader[] = [];
  for (const g of groups) {
    const sh = createShader(app, container, a.PresetObj, a.Name || undefined);
    if (!sh) { app.logMsg('error', 'Invalid preset: shader not found'); break; }
    const main = mainInput(sh);
    if (g.old && main) connectWithConverter(app, container, g.old, { owner: sh, name: main }, false);
    // every connection is made with "delete on last disconnection" false: the displaced shader survives
    const onPort = connectWithConverter(app, container, sh, g.ports[0], false);
    if (!onPort) { warn(app, `Cannot find a valid converter for ${nodePath(app.scene, sh)} when connecting to ${portPath(app.scene, g.ports[0])}`); break; }
    for (const p of g.ports.slice(1)) connectWithConverter(app, container, onPort, p, false);
    out.push(sh);
  }
  return out;
}

// ------------------------------------------------------------------ F. connection primitives and pop-ups

function applyShaderToCnxPoint(app: App, a: Record<string, any>, cmd: string, make: (x: any) => Shader | null, what: string): Shader | null {
  if (a.Value !== true && a.Value !== undefined) app.logMsg('info', `${cmd}: not yet attested: the meaning of Value (${NOTE} Q14); treated as its default, true`);
  const ports = refs(app, a.InputObjs);
  const given = what === 'preset' ? a.PresetObj : a.ProgID;
  if (given === null || given === undefined || given === '' || !ports.length) { app.logMsg('info', `${cmd}: nothing applied: ${!ports.length ? 'no connection point given' : `no ${what} given`}`); return null; }
  const container = uniqueShaderContainer(app.scene, ports);
  if (!container) { app.logMsg('error', `${cmd}: the connection points are not within one shader container`); return null; }
  const sh = given instanceof Shader ? given : make(given);
  if (!sh) { app.logMsg('error', `${cmd}: could not create a shader from ${what} '${given}'`); return null; }
  if (!(given instanceof Shader)) sh.name = uniqueNameIn(container, a.Name || sh.name);
  nest(app, container, sh);
  for (const p of ports) if (!connectWithConverter(app, container, sh, p, true)) // inferred: the displaced shader goes when nothing else uses it, as with the default of SIConnectShaderToCnxPoint
    warn(app, `${cmd}: no converter from ${nodePath(app.scene, sh)} to ${portPath(app.scene, p)}; not yet attested which converters exist (${NOTE} Q14)`);
  return sh;
}
function connectShaderToCnxPoint(app: App, a: Record<string, any>): Node | null {
  const cmd = 'SIConnectShaderToCnxPoint';
  let src: Node | null = null;
  for (const it of listOf(a.Source)) { const n = it instanceof Node ? it : resolveNode(app.scene, it); if (n instanceof Shader || isImageClip(n)) { src = n; break; } if (isImageSource(n)) { src = clipFromSource(app, n); if (src) break; } }
  const ports = refs(app, a.InputObjs);
  if (!src || !ports.length) { app.logMsg('info', `${cmd}: nothing connected: ${!src ? 'Source is not a shader or an image clip' : 'no connection point given'}`); return null; }
  const container = uniqueShaderContainer(app.scene, ports);
  if (!container) { app.logMsg('error', `${cmd}: the connection points are not within one shader container`); return null; }
  const del = a.DeleteOnLastDisconnection !== false && a.DeleteOnLastDisconnection !== 0;
  let first: Node | null = null, converter: Node | null = null;
  ports.forEach((p, i) => {
    // inferred: with several ports a converter is created once and shared by the ports that need it
    let on: Node | null = converter && sourceDataType(converter) === portDataType(p) ? connectWithConverter(app, container, converter, p, del) : connectWithConverter(app, container, src!, p, del);
    if (on && on !== src) converter = on;
    if (!on) warn(app, `${cmd}: no converter from ${src!.name} to ${portPath(app.scene, p)}; not yet attested which converters exist (${NOTE} Q14)`);
    if (i === 0) first = on;
  });
  return first;
}

/** The selection filter that is the default of `EmbeddedCommand` on the two pop-up commands. */
export const TEXTURE_POPUP_FILTER = 'sceneobject,cluster,group,layer,~chain_element,~camera,~control_object,~curve,~light,~null,min=1';
function filterKinds(n: Node): string[] {
  const k: string[] = []; const t = String(n.type ?? '').toLowerCase();
  if (n instanceof Cluster) k.push('cluster');
  if (n instanceof Group) k.push('group');
  if (n instanceof Layer) k.push('layer');
  if (n instanceof X3DObject) {
    k.push('sceneobject');
    if (n instanceof Camera) k.push('camera');
    if (n instanceof Light) k.push('light');
    if (n instanceof Null || t === 'null') k.push('null');
    if (/chain|bone|^eff|root$/.test(t) && !(n instanceof Null)) k.push('chain_element');
    if (/crvlist|curve/.test(t)) k.push('curve');
    if (/control|lattice|wave|force|fan|gravity|wind|vortex|drag|eddy|turbulence|attractor|toric|spot_?interest|camera_?interest/.test(t)) k.push('control_object');
  }
  return k;
}
/** Evaluate a selection filter string of the `a,b,~c,min=N` form against a list of nodes. */
export function applySelectionFilter(filter: string, items: Node[]): { accepted: Node[]; min: number; ok: boolean } {
  const allow: string[] = [], deny: string[] = []; let min = 0;
  for (const tok of String(filter).split(',').map(s => s.trim()).filter(Boolean)) { const m = /^min=(\d+)$/.exec(tok); if (m) min = Number(m[1]); else if (tok.startsWith('~')) deny.push(tok.slice(1)); else allow.push(tok); }
  const accepted = items.filter(n => { const k = filterKinds(n); return k.some(x => allow.includes(x)) && !k.some(x => deny.includes(x)); });
  return { accepted, min, ok: accepted.length >= min };
}
function popupInputs(app: App, a: Record<string, any>): { accepted: Node[]; min: number; ok: boolean } {
  const items = listOf(a.InputObjs).length ? nodes(app, a.InputObjs) : [...app.selection];
  return applySelectionFilter(typeof a.EmbeddedCommand === 'string' && a.EmbeddedCommand ? a.EmbeddedCommand : TEXTURE_POPUP_FILTER, items);
}

// ------------------------------------------------------------------ registration

const NONE = null; // registry default "none"
const LAYER_TAIL = [{ name: 'InputObjs', default: NONE }, { name: 'Name', default: '' }, { name: 'After', default: true }, { name: 'Reference', default: NONE }];
const OBJ_TAIL = (shared: number, mode: string) => [{ name: 'InputObjs', default: NONE }, { name: 'SharedMatAction', default: shared }, { name: 'NotifyNoResult', default: false }, { name: 'Mode', default: mode },
  { name: 'Ambient', default: true }, { name: 'Diffuse', default: true }, { name: 'Transparency', default: false }, { name: 'Reflection', default: false }];
const PRESET_MODE_DEFAULT = ':siBlendInPreset:siBlendInPresetModes';
const LAYER_MODE_DEFAULT = ':siBlendInTextureLayers:siBlendInTextureLayersModes';

export const TEXTURE_LAYER_COMMANDS = [
  'AddTextureLayer', 'AddTextureLayerPorts', 'MoveTextureLayers', 'RemoveTextureLayers',
  'AddPresetTextureLayer', 'AddImageTextureLayer', 'AddClipTextureLayer',
  'BlendInPresets', 'BlendInPresetsInsp', 'BlendInPresetsWithPorts', 'BlendInPresetsWithPortsInsp', 'SIConnectShaderWithBlendsInsp',
  'BlendInTextureLayers', 'BlendInTextureLayersInsp', 'BlendInTextureLayersWithPorts', 'BlendInTextureLayersWithPortsInsp',
  'BlendClipsInTextureLayers', 'BlendClipsInTextureLayersInsp', 'BlendClipsInTextureLayersWithPorts', 'BlendClipsInTextureLayersWithPortsInsp',
  'InsertShader', 'SIApplyShaderToCnxPoint', 'SIApplyShaderToCnxPoint2', 'SIConnectShaderToCnxPoint', 'UIApplyShaderToCnxPoints',
  'Texture Pop-up Menu', 'Modify Texture Pop-up Menu',
] as const;

export function registerTextureLayerCommands(app: App) {
  // None of the 27 has a category in the registry.
  const reg = (name: string, label: string, description: string, args: CommandDef['args'], execute: CommandDef['execute'], extra: Partial<CommandDef> = {}) =>
    app.register({ name, label, category: '', description, args, execute, ...extra });

  // ---- A
  reg('AddTextureLayer', 'AddTextureLayer', 'Add a texture layer to a shaders/materials.',
    [{ name: 'Object', default: NONE }, ...LAYER_TAIL], (app, a) => addTextureLayer(app, a));
  reg('AddTextureLayerPorts', 'AddTextureLayerPorts', 'Add port connections to a texture layer.',
    [{ name: 'InputObj', default: NONE }, { name: 'InputObjs', default: NONE }], (app, a) => addTextureLayerPorts(app, a));
  reg('MoveTextureLayers', 'MoveTextureLayers', 'Move texture layers up or down.',
    [{ name: 'InputObjs', default: NONE }, { name: 'Offset', default: -1 }], (app, a) => moveTextureLayers(app, a));
  reg('RemoveTextureLayers', 'RemoveTextureLayers', 'Remove texture layers from a container.',
    [{ name: 'InputObjs', default: NONE }, { name: 'Container', default: NONE }], (app, a) => removeTextureLayers(app, a));

  // ---- B
  reg('AddPresetTextureLayer', 'AddPresetTextureLayer', 'Add a texture layer with a preset to a shaders/materials.',
    [{ name: 'PresetObj', default: 'Image' }, ...LAYER_TAIL], (app, a) => addPresetTextureLayer(app, a));
  reg('AddImageTextureLayer', 'AddImageTextureLayer', 'Add a texture layer with an image to a shaders/materials.',
    [{ name: 'FileName', default: '' }, ...LAYER_TAIL], (app, a) => addImageTextureLayer(app, a));
  reg('AddClipTextureLayer', 'AddClipTextureLayer', 'Add a texture layer with a clip to a shaders/materials.',
    [{ name: 'Clip', default: NONE }, ...LAYER_TAIL], (app, a) => addClipTextureLayer(app, a));

  // ---- C
  const presetObjArgs = [{ name: 'PresetNames', default: 'Image' }, ...OBJ_TAIL(3, PRESET_MODE_DEFAULT)];
  const presetPortArgs = [{ name: 'PresetNames', default: 'Image' }, { name: 'InputObjs', default: NONE }];
  reg('BlendInPresets', 'Blend in Presets to Default Texture Ports - Do Not Inspect', 'Connect several shaders through blenders to all the default texture ports of several objects',
    presetObjArgs, (app, a) => blendInPresets(app, a, 'BlendInPresets'));
  reg('BlendInPresetsInsp', 'Blend in Presets to Default Texture Ports', 'Connect several shaders through blenders to all the default texture ports of several objects, inspect',
    presetObjArgs, (app, a) => { const r = blendInPresets(app, a, 'BlendInPresetsInsp'); r.forEach(s => inspect(app, s)); return r; });
  reg('BlendInPresetsWithPorts', 'Blend in Presets with Ports - Do Not Inspect', 'Connect several shaders through blenders to the provided texture ports',
    presetPortArgs, (app, a) => blendInPresetsWithPorts(app, a));
  reg('BlendInPresetsWithPortsInsp', 'Blend in Presets with Ports', 'Connect several shaders through blenders to the provided texture ports and inspect',
    presetPortArgs, (app, a) => { const r = blendInPresetsWithPorts(app, a); r.forEach(s => inspect(app, s)); return r; });
  // The registry says this command hands nothing back although its script produces the shader (Q3): nothing is returned.
  reg('SIConnectShaderWithBlendsInsp', 'Connect Shader With Blends and Inspect', 'Connect a shader through several mixers to several inputs and inspect shader',
    [{ name: 'PresetObj', default: 'Image' }, { name: 'Mixer', default: 'Mixers\\Mix_2colors' }, { name: 'InputObjs', default: NONE }],
    (app, a) => { inspect(app, connectShaderWithBlends(app, a)); });

  // ---- D
  const layerObjArgs = [{ name: 'PresetNames', default: 'Image' }, ...OBJ_TAIL(2, LAYER_MODE_DEFAULT)];
  const clipObjArgs = [{ name: 'ClipList', default: NONE }, ...OBJ_TAIL(2, LAYER_MODE_DEFAULT)];
  const clipPortArgs = [{ name: 'ClipList', default: NONE }, { name: 'InputObjs', default: NONE }];
  const inspectLayers = (app: App, r: (TextureLayer | Shader)[]) => { for (const x of r) inspect(app, shaderOfResult(x)); return r; };
  reg('BlendInTextureLayers', 'Blend in Texture Layers to Default Texture Ports - Do Not Inspect', 'Add new layers to the default texture ports of several objects with the provided presets and inspect',
    layerObjArgs, (app, a) => blendInTextureLayers(app, a, 'BlendInTextureLayers'));
  reg('BlendInTextureLayersInsp', 'Blend in Texture Layers to Default Texture Ports and Inspect', 'Add new layers to the default texture ports of several objects with the provided presets and inspect',
    layerObjArgs, (app, a) => inspectLayers(app, blendInTextureLayers(app, a, 'BlendInTextureLayersInsp')));
  reg('BlendInTextureLayersWithPorts', 'Blend in Texture Layers with Ports - Do Not Inspect', 'Add new layers to the provided texture ports with the provided presets',
    presetPortArgs, (app, a) => blendInTextureLayersWithPorts(app, a));
  reg('BlendInTextureLayersWithPortsInsp', 'Blend in Texture Layers with Ports and Inspect', 'Add new layers to the provided texture ports with the provided presets and inspect',
    presetPortArgs, (app, a) => inspectLayers(app, blendInTextureLayersWithPorts(app, a)));
  reg('BlendClipsInTextureLayers', 'Blend Clips in Texture Layers to Default Texture Ports - Do Not Inspect', 'Add new layers to the default texture ports of several objects with the provided clips and inspect',
    clipObjArgs, (app, a) => blendClipsInTextureLayers(app, a, 'BlendClipsInTextureLayers'));
  reg('BlendClipsInTextureLayersInsp', 'Blend in Clip Texture Layers to Default Texture Ports and Inspect', 'Add new layers to the default texture ports of several objects with the provided clips and inspect',
    clipObjArgs, (app, a) => inspectLayers(app, blendClipsInTextureLayers(app, a, 'BlendClipsInTextureLayersInsp')));
  reg('BlendClipsInTextureLayersWithPorts', 'Blend Clips in Texture Layers with Ports - Do Not Inspect', 'Add new layers to the provided texture ports with the provided clips',
    clipPortArgs, (app, a) => blendClipsInTextureLayersWithPorts(app, a));
  reg('BlendClipsInTextureLayersWithPortsInsp', 'Blend clips in Texture Layers with Ports and Inspect', 'Add new layers to the provided texture ports with the provided clips and inspect',
    clipPortArgs, (app, a) => inspectLayers(app, blendClipsInTextureLayersWithPorts(app, a)));

  // ---- E
  reg('InsertShader', 'Insert shader', 'Insert a shader between two shaders',
    [{ name: 'PresetObj', default: NONE }, { name: 'InputObjs', default: NONE }, { name: 'Name', default: '' }], (app, a) => insertShader(app, a));

  // ---- F (binary not traced: wired as far as the registry and the scripts' call shapes attest)
  reg('SIApplyShaderToCnxPoint', 'Apply Shader Preset to Component', 'Apply the specified shader preset to the specified components',
    [{ name: 'PresetObj', default: NONE }, { name: 'InputObjs', default: NONE }, { name: 'Name', default: '' }, { name: 'Value', default: true }],
    (app, a) => applyShaderToCnxPoint(app, a, 'SIApplyShaderToCnxPoint', x => makePresetShader(x), 'preset'));
  reg('SIApplyShaderToCnxPoint2', 'Apply ProgID to Component', 'Apply the specified shader progid to the specified components',
    [{ name: 'ProgID', default: '' }, { name: 'InputObjs', default: NONE }, { name: 'Name', default: '' }, { name: 'Value', default: true }],
    (app, a) => applyShaderToCnxPoint(app, a, 'SIApplyShaderToCnxPoint2', x => makeProgIdShader(x), 'ProgID'));
  reg('SIConnectShaderToCnxPoint', 'Connect shader', 'Connect the specified shader to the specified components',
    [{ name: 'Source', default: NONE }, { name: 'InputObjs', default: NONE }, { name: 'DeleteOnLastDisconnection', default: true }], (app, a) => connectShaderToCnxPoint(app, a));
  reg('UIApplyShaderToCnxPoints', 'UIApplyShaderToCnxPoints', 'Applies a shader to mulitple connection points',
    [{ name: 'InputObj', default: NONE }, { name: 'InputObjs', default: NONE }, { name: 'X', default: 0 }, { name: 'Y', default: 0 }],
    (app, a) => {
      // Attested: the registry entry and the task ProgID only. What the command shows at (X, Y) and what a pick runs is Q15.
      const ports = refs(app, a.InputObjs); const x = Number(a.X) || 0, y = Number(a.Y) || 0;
      app.logMsg('error', `UIApplyShaderToCnxPoints: not yet attested: the menu shown at (${x}, ${y}) and what a pick applies to the ${ports.length} connection point(s) given (${NOTE} Q15); nothing was applied`);
    }, { undoable: false });
  reg('Texture Pop-up Menu', 'Texture Pop-up Menu', 'Pop-up a menu of available textures',
    [{ name: 'InputObjs', default: NONE }, { name: 'ShaderName', default: '' }, { name: 'ClipList', default: NONE }, { name: 'Mode', default: ':siReplaceAndNoBlendInTextureLayers:siBlendInTextureLayersModes' }, { name: 'EmbeddedCommand', default: TEXTURE_POPUP_FILTER }],
    (app, a) => {
      const f = popupInputs(app, a); const mode = enumArg(a.Mode, LAYER_MODES, 2);
      if (!f.ok) app.logMsg('info', `Texture Pop-up Menu: the selection filter needs at least ${f.min} scene object, cluster, group or layer (no chain element, camera, control object, curve, light or null); ${f.accepted.length} given`);
      app.logMsg('error', `Texture Pop-up Menu: not yet attested: the menu contents and what a pick runs (${NOTE} Q15); no menu was opened (${f.accepted.length} input(s) accepted by the filter, Mode ${mode})`);
      return null;
    }, { undoable: false });
  reg('Modify Texture Pop-up Menu', 'Modify Texture Pop-up Menu', 'Pop-up a menu of available textures and list of connected shaders',
    [{ name: 'InputObjs', default: NONE }, { name: 'EmbeddedCommand', default: TEXTURE_POPUP_FILTER }],
    (app, a) => {
      const f = popupInputs(app, a);
      if (!f.ok) app.logMsg('info', `Modify Texture Pop-up Menu: the selection filter needs at least ${f.min} scene object, cluster, group or layer (no chain element, camera, control object, curve, light or null); ${f.accepted.length} given`);
      app.logMsg('error', `Modify Texture Pop-up Menu: not yet attested: the menu contents, the list of connected shaders and what a pick runs (${NOTE} Q15); no menu was opened (${f.accepted.length} input(s) accepted by the filter)`);
    }, { undoable: false });

  // Scripting / test access to the model half (window.Application.textureLayers).
  (app as any).textureLayers = {
    TextureLayer, TextureLayerPort, layersOf, layerPortsOn, getSource, containerLayers, nestedShaders, mergedLayerOrder, layerFamily,
    defaultTexturePorts, resolvePort: (x: any) => resolvePort(app.scene, x), resolveNode: (x: any) => resolveNode(app.scene, x),
    portPath: (r: PortRef) => portPath(app.scene, r), nodePath: (n: Node) => nodePath(app.scene, n), portDataType, isMix8, currentMaterial: (o: X3DObject) => currentMaterial(app.scene, o),
    uniqueShaderContainer: (items: any[]) => uniqueShaderContainer(app.scene, items), applySelectionFilter, scriptText, catText,
  };
}
