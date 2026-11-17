// Ledger row CMD-B6b. Brief: docs/ghidra/cmd-b6b-uixsi-clips-display-addons.md, "Wire contract". Original code written from that contract only.
//
// 28 commands Softimage ships as VBScript procedures: image / model sources and clips (CreateImageClip2, AddImageSource,
// AddWritableImageSource, AddModelSource, CreateModelClip, AddModelClip), LoadPreset, InstallAddon, UnInstallAddon,
// CreateReferencePlane, SetTransientReferencePlane, the three preference inspectors, MoveCtr2Vertices, MatchTransform,
// SetTransformRefMode, Increase / DecreaseManipulatorSize, ToggleBackgroundColor, ToggleFullscreenLayout,
// RotoscopyOptions, SetLightingDisplayMode, the four SetNURBSDisplayQuality* commands and DisplayPortValues
// (src/commands/uixsiClipsDisplayAddonsPortValues.ts).
//
// How this build differs from a Softimage session, and why:
//
//  * Low-level commands. The C++ commands these wrappers call (image / model source and clip creation, preset loading,
//    reference planes) are other rows (Q7). Each call goes through `lowLevel`: the bus command when another row has
//    registered it, otherwise a documented, inferred stand-in that keeps the objects in this row's own store
//    (`app.uixsiClipsDisplayAddons`) and logs "not yet attested". Every call is listed in `state.calls`.
//  * Auto-inspection. The scripted auto-inspect command is not on the bus (the bus name is this build's toggle), so
//    the wrappers emit the inspect event when auto-inspection is on.
//  * Centre moves. The bus transform commands have no centre mode, so "move the centre, keep the geometry" is done
//    here: the object's transform changes and a Center operator / child offsets compensate.   // inferred
//  * In/out arguments. The bus passes arguments by value; what a command would write back is in `state.outputs`.
//  * Several registry entries share one scripting name (MoveCtr2Vertices, MatchTransform, SetTransformRefMode, the
//    manipulator size commands). One command per name is registered; the other entries are `state.entries`.
//  * Message boxes return at once (the bus is synchronous); without a user session they log "<title>: <prompt>".
import * as THREE from 'three';
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Property, Cluster, Model, Operator, geomPoints, threeOrder } from '../core/scene';
import { str, bool, int } from '../core/params';
import { siString } from '../ui/si';
import { sdkMsgBox } from '../ui/sdkHelpersModal';
import { floatingWindows } from '../ui/floating';
import { preferencesWindow, preferenceSets } from '../ui/prefs';
import { currentLayoutName, switchLayout, layoutByName } from '../ui/layout';
import { objs, nodes, unset, siConst, boolArg, setLocalMatrix, ensureLocal } from './viewEditPropertyHelpers';
import { startPickSession, interactive } from './miscDsScriptsPick';
import { registerDisplayPortValues, type PortValuesHost } from './uixsiClipsDisplayAddonsPortValues';

const NOTE = 'docs/ghidra/cmd-b6b-uixsi-clips-display-addons.md';
type V3 = [number, number, number];

// ------------------------------------------------------------------ session state
export interface RefPlane { name: string; inputs: string[]; matrix: number[] }
export interface LowLevelCall { command: string; by: string; args: Record<string, any>; ran: boolean }
export interface UixsiClipsDisplayAddonsState extends PortValuesHost {
  imageSources: Property[]; modelSources: Property[]; modelClips: Property[];
  refPlanes: Property[];
  /** The built-in transient plane "RefPlanes.Transform" as last redefined. */
  transientPlane: RefPlane | null;
  /** The current reference plane: a plane property, or the name of the transient plane. */
  currentRefPlane: Property | string | null;
  addons: { file: string; installPath: any }[];
  calls: LowLevelCall[];
  /** Values the in/out arguments would carry back, per command. */
  outputs: Record<string, Record<string, any>>;
  activeLayoutName(): string;
  /** Makes a layout the active one; false when there is no such layout. Replaceable (the default reloads the page). */
  setActiveLayout(name: string): boolean;
  /** Reference part and modifier part of the transform reference preference. */
  transformRef(): { value: number; reference: number; modifiers: number };
  /** The other registry entries of the multi-entry scripting names (key-assignable UI entries). */
  entries: Record<string, () => any>;
}
const stateOf = (app: App): UixsiClipsDisplayAddonsState => (app as any).uixsiClipsDisplayAddons;

// ------------------------------------------------------------------ small helpers
/** Commands of other rows this row delegates to (names kept out of quoted literals). */
const [SI_CREATE_IMAGE_CLIP2, SI_ADD_IMAGE_SOURCE, SI_ADD_WRITABLE_IMAGE_SOURCE, SI_ADD_MODEL_SOURCE, SI_CREATE_MODEL_CLIP, SI_ADD_MODEL_CLIP, SI_LOAD_PRESET,
  SI_CREATE_REF_PLANE, SET_REFERENCE_PLANE, SET_CURRENT_REFERENCE_PLANE, GET_VIEW_CAMERA]
  = 'SICreateImageClip2 SIAddImageSource SIAddWritableImageSource SIAddModelSource SICreateModelClip SIAddModelClip SILoadPreset SICreateRefPlane SetReferencePlane SetCurrentReferencePlane GetViewCamera'.split(' ');
const TRANSIENT_PLANE = 'RefPlanes.Transform';
const PREF_TRANSFORM_REF = '3D_TRANSFO_REFERENTIAL_CHANGED';

const logNya = (app: App, command: string, what: string, question = '') => app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
const nameOf = (x: any): string => String(x?.fullName ?? x?.name ?? x ?? '');

/** Run a low-level command of another row, or this row's stand-in when it is not on the bus (or the bus only has a
 *  placeholder that returns { command, args }). */
function lowLevel<T>(app: App, by: string, name: string, args: Record<string, any>, standIn: () => T): T {
  const st = stateOf(app);
  if (app.commands.has(name)) {
    const r = app.run(name, args);
    if (!(r && typeof r === 'object' && (r as any).command === name && 'args' in r)) { st.calls.push({ command: name, by, args, ran: true }); return r as T; }
  }
  st.calls.push({ command: name, by, args, ran: false });
  return standIn();
}
/** AutoInspect <object>: nothing when auto-inspection is off. */
function autoInspect(app: App, n: any) { if (n instanceof Node && app.autoInspect) queueMicrotask(() => app.events.emit('inspect', n)); }
const selectObj = (app: App, n: Node, branch = false) => app.select(branch && n instanceof X3DObject ? [n, ...n.descendants()] : [n]);
/** The message-box helper: a box in a user session, otherwise a log line "<title>: <prompt>". */
function msgBox(app: App, prompt: string, title: string) {
  if (interactive(app)) void sdkMsgBox(prompt, title); else app.logMsg('info', `${title}: ${prompt}`);
}
function addToStore(app: App, list: Property[], p: Property) { app.record('Add ' + p.name, () => { list.push(p); }, () => { const i = list.indexOf(p); if (i >= 0) list.splice(i, 1); }); }
const baseName = (file: string) => (file.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_]/g, '_') || 'noname');
const uniqueIn = (list: { name: string }[], base: string) => { if (!list.some(x => x.name === base)) return base; let i = 1; while (list.some(x => x.name === `${base}${i}`)) i++; return `${base}${i}`; };
const findIn = (list: Property[], x: any): Property | null => x instanceof Property ? x : (typeof x === 'string' && x ? list.find(p => p.name === x || p.fullName === x || x.endsWith('.' + p.name)) ?? null : null);

// ------------------------------------------------------------------ stand-ins: sources and clips   // inferred (Q7)
function imageSourceStandIn(app: App, by: string, file: string, name: string, extra: Record<string, any> | null): Property | null {
  if (!file) { logNya(app, by, 'an empty file name (file browsing belongs to the low-level command); no source was produced', 'Q7'); return null; }
  const st = stateOf(app);
  if (extra?.UseExisting) { const old = st.imageSources.find(s => s.val('FileName') === file); if (old) return old; }
  const p = new Property(uniqueIn(st.imageSources, name || baseName(file)), 'imagesource', [str('FileName', file, 'File Name')]);
  if (extra) {
    p.add(int('Width', Number(extra.Width) || 0, 'Width')); p.add(int('Height', Number(extra.Height) || 0, 'Height'));
    p.add(str('Type', String(siConst(extra.Type) ?? ''), 'Type')); p.add(bool('Writable', true, 'Writable'));
  }
  addToStore(app, st.imageSources, p);
  logNya(app, by, `the low-level source command; an image source "${p.name}" for "${file}" was added to this build's source store (the file is not read)`, 'Q7');
  return p;
}
function imageClipStandIn(app: App, by: string, file: string, name: string): Property[] {
  if (!file) { logNya(app, by, 'an empty file name (file browsing belongs to the low-level command); no clip was produced', 'Q7'); return []; }
  const st = stateOf(app);
  let source = st.imageSources.find(s => s.val('FileName') === file) ?? null;
  if (!source) { source = new Property(uniqueIn(st.imageSources, baseName(file)), 'imagesource', [str('FileName', file, 'File Name')]); addToStore(app, st.imageSources, source); }
  // same shape as the image clips the texturing commands of this build read (a root property of type imageclip)
  const clip = new Property(app.scene.uniqueName(name || baseName(file)), 'imageclip', [str('filename', file, 'File Name'), bool('enabled', true, 'Enabled')]);
  (clip as any).source = source;
  app.record('Image clip', () => app.scene.root.addProperty(clip), () => app.scene.root.removeProperty(clip));
  logNya(app, by, `the low-level clip command; an image clip "${clip.name}" on source "${source.name}" was created (the file is not read)`, 'Q7');
  return [clip];
}
function modelSourceStandIn(app: App, by: string, file: string, name: string, resolution: any): Property | null {
  if (!file) { logNya(app, by, 'an empty file name; no model source was produced', 'Q7'); return null; }
  const st = stateOf(app);
  const p = new Property(uniqueIn(st.modelSources, name || baseName(file)), 'modelsource', [str('FileName', file, 'File Name'), int('Resolution', Number(resolution) || 0, 'Resolution')]);
  addToStore(app, st.modelSources, p);
  logNya(app, by, `the low-level model source command; a model source "${p.name}" for "${file}" was added to this build's source store (the file is not read)`, 'Q7');
  return p;
}
function modelClipStandIn(app: App, by: string, source: Property | null, name: string): { Clip: Property | null } {
  if (!source) return { Clip: null };
  const st = stateOf(app);
  const clip = new Property(uniqueIn(st.modelClips, name || source.name), 'modelclip', [str('Source', source.name, 'Source')]);
  (clip as any).source = source;
  addToStore(app, st.modelClips, clip);
  logNya(app, by, `the low-level model clip command; a model clip "${clip.name}" on source "${source.name}" was added to this build's store`, 'Q7');
  return { Clip: clip };
}
/** XSIFileService.ReferenceModel stand-in (Q8): an empty model carrying this build's referenced-model marker.   // inferred */
function referenceModel(app: App, by: string, clip: any): Model | null {
  if (!(clip instanceof Property)) { logNya(app, by, 'no clip was produced, so no referenced model was instantiated', 'Q8'); return null; }
  const fs: any = (app as any).XSIFileService;
  if (fs && typeof fs.ReferenceModel === 'function') return fs.ReferenceModel(clip) ?? null;
  const source: Property | undefined = (clip as any).source; const file = String(source?.val('FileName') ?? '');
  const model = new Model(app.scene.uniqueName(clip.name));
  (model as any).ref = { file, resolution: Number(source?.val('Resolution') ?? 1) || 1, resolutions: [file] }; (model as any).clip = clip;
  const root = app.scene.root;
  app.record('Add ' + model.name, () => root.addChild(model), () => root.removeChild(model));
  logNya(app, by, `what the file service instantiates for a model clip; an empty referenced model "${model.name}" was created under the scene root, the content of "${file}" is not loaded`, 'Q8');
  return model;
}

// ------------------------------------------------------------------ centre moves   // inferred
/** The operator a centre move leaves in the construction history: points are re-expressed in the moved centre's space. */
export class CenterOperator extends Operator {
  readonly siType = 'centerop';
  constructor(readonly matrix: THREE.Matrix4) { super('Center', 'centerop', []); }
  apply(input: any) {
    if (!input) return input;
    const m = this.matrix, v = new THREE.Vector3();
    const tp = (c: number[]) => { v.set(c[0], c[1], c[2]).applyMatrix4(m); return [v.x, v.y, v.z, ...c.slice(3)]; };
    if (input.cvs) return { ...input, cvs: input.cvs.map(tp) };
    if (input.sub && input.points) return { ...input, points: input.points.map(tp) };
    if (input.positions) {
      const src = input.positions as Float32Array; const p = new Float32Array(src.length);
      for (let i = 0; i < src.length; i += 3) { v.set(src[i], src[i + 1], src[i + 2]).applyMatrix4(m); p[i] = v.x; p[i + 1] = v.y; p[i + 2] = v.z; }
      const out: any = { ...input, positions: p };
      if (Array.isArray(input.nurbs?.cps)) out.nurbs = { ...input.nurbs, cps: input.nurbs.cps.map(tp) };
      return out;
    }
    return input;
  }
}
const parentGlobal = (o: X3DObject) => o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4();
/** Give the object a new global transform; with `centre` its geometry and children stay where they are. */
function setGlobal(app: App, o: X3DObject, gNew: THREE.Matrix4, centre: boolean, label: string) {
  if (!centre) { setLocalMatrix(app, o, parentGlobal(o).invert().multiply(gNew), label); return; }
  const fix = gNew.clone().invert().multiply(o.globalMatrix());
  const kids = o.children.map(c => ({ c, local: fix.clone().multiply(c.kinematics.localMatrix()) }));
  setLocalMatrix(app, o, parentGlobal(o).invert().multiply(gNew), label);
  for (const k of kids) setLocalMatrix(app, k.c, k.local, label);
  const prim = o.primitive;
  if (prim && prim.operators.length) { const op = new CenterOperator(fix); app.record('Center', () => prim.addOperator(op), () => prim.removeOperator(op)); }
}
/** Translate <object>, x, y, z, siAbsolute, siGlobal, siCtr, siXYZ */
function moveCentreTo(app: App, o: X3DObject, t: V3) { setGlobal(app, o, o.globalMatrix().setPosition(t[0], t[1], t[2]), true, 'Translate'); }

/** Global positions of the object's points (all of them, or the listed indices). */
function globalPoints(o: X3DObject, indices: number[] | null): THREE.Vector3[] {
  const pts = geomPoints(o.primitive?.geom()); if (!pts) return [];
  const g = o.globalMatrix(); const n = pts.length / 3; const out: THREE.Vector3[] = [];
  for (const i of indices ?? Array.from({ length: n }, (_, k) => k)) if (i >= 0 && i < n) out.push(new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]).applyMatrix4(g));
  return out;
}
function centreTarget(pts: THREE.Vector3[], boundingBox: boolean): V3 | null {
  if (boundingBox) {
    // running extremes start at +/-10,000,000, so no points gives the origin
    const lo = [1e7, 1e7, 1e7], hi = [-1e7, -1e7, -1e7];
    for (const p of pts) [p.x, p.y, p.z].forEach((v, k) => { if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; });
    return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  }
  if (!pts.length) return null;
  const s = new THREE.Vector3(); for (const p of pts) s.add(p); s.divideScalar(pts.length); return [s.x, s.y, s.z];
}

// ------------------------------------------------------------------ MoveCtr2Vertices input
interface SubComp { obj: X3DObject; kind: 'pnt' | 'edge' | 'poly' | 'sample'; items: (number | string)[] }
const SUB_RE = /^(.+?)\.(pnt|edge|poly|sample)\[(.*)\]$/;
const COMP_KIND: Record<string, SubComp['kind']> = { point: 'pnt', edge: 'edge', polygon: 'poly', sample: 'sample' };
function findCluster(app: App, x: string): Cluster | null {
  for (const o of app.scene.allObjects()) for (const c of o.clusters) if (c.fullName === x || x === `${o.name}.${c.name}` || x === `${o.name}.cls.${c.name}` || (x.startsWith(o.name + '.') && x.endsWith('.cls.' + c.name))) return c;
  return null;
}
function splitInput(app: App, arg: any): { objects: X3DObject[]; clusters: Cluster[]; subs: SubComp[] } {
  const out = { objects: [] as X3DObject[], clusters: [] as Cluster[], subs: [] as SubComp[] };
  const push = (raw: any) => {
    if (raw instanceof Cluster) { out.clusters.push(raw); return; }
    if (raw instanceof X3DObject) { out.objects.push(raw); return; }
    const s = String(raw ?? '').trim(); if (!s) return;
    const m = SUB_RE.exec(s);
    if (m) {
      const obj = app.scene.find(m[1]); if (!obj) return;
      const items: (number | string)[] = []; const n = (geomPoints(obj.primitive?.geom())?.length ?? 0) / 3;
      for (const part of m[3].split(',').map(t => t.trim()).filter(Boolean)) {
        const rg = /^(\d+)\s*-\s*(\d+)$/.exec(part);
        if (part === '*' && m[2] === 'pnt') for (let i = 0; i < n; i++) items.push(i);
        else if (rg) for (let i = Number(rg[1]); i <= Number(rg[2]); i++) items.push(i);
        else items.push(/^\d+$/.test(part) ? Number(part) : part);
      }
      out.subs.push({ obj, kind: m[2] as SubComp['kind'], items }); return;
    }
    const c = findCluster(app, s); if (c) { out.clusters.push(c); return; }
    const o = app.scene.find(s); if (o) out.objects.push(o);
  };
  if (unset(arg)) {
    const c = app.compSel; const set: Set<any> | null = c ? (c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons) : null;
    if (c && set && set.size) out.subs.push({ obj: c.obj, kind: COMP_KIND[c.kind] ?? 'pnt', items: [...set] });   // tagged components
    else for (const n of app.selection) push(n);
  } else if (Array.isArray(arg)) arg.forEach(push);
  else if (typeof arg === 'string') { let depth = 0, cur = ''; for (const ch of arg + ',') { if (ch === '[') depth++; else if (ch === ']') depth--; if (ch === ',' && depth === 0) { push(cur); cur = ''; } else cur += ch; } }
  else push(arg);
  return out;
}

// ------------------------------------------------------------------ MatchTransform
// inferred (Q4): the channel test is read by constant name; the numeric values of the filter constants are not attested.
const CHANNELS: Record<string, [boolean, boolean, boolean]> = {
  siScl: [true, false, false], siRot: [false, true, false], siTrn: [false, false, true], siSRT: [true, true, true],
  siSR: [true, true, false], siST: [true, false, true], siRT: [false, true, true],
};
interface Srt { pos: THREE.Vector3; quat: THREE.Quaternion; scl: THREE.Vector3 }
const D2R = Math.PI / 180;
function srtOf(o: X3DObject, local: boolean): Srt {
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  if (!local) { o.globalMatrix().decompose(pos, quat, scl); return { pos, quat, scl }; }
  const l = o.kinematics.local;
  pos.set(l.val('posx'), l.val('posy'), l.val('posz')); scl.set(l.val('sclx'), l.val('scly'), l.val('sclz'));
  quat.setFromEuler(new THREE.Euler(l.val('rotx') * D2R, l.val('roty') * D2R, l.val('rotz') * D2R, threeOrder(l.val('rotorder'))));
  return { pos, quat, scl };
}
function matchChannel(app: App, o: X3DObject, target: X3DObject, channel: 0 | 1 | 2, local: boolean, centre: boolean) {
  const t = srtOf(target, local), cur = srtOf(o, local);
  const label = ['Scale', 'Rotate', 'Translate'][channel];
  if (channel === 0) cur.scl.copy(t.scl); else if (channel === 1) cur.quat.copy(t.quat); else cur.pos.copy(t.pos);
  const l = o.kinematics.local;
  if (local && !centre) {
    // SetValue on the three local parameters (scaling, translation); Rotate ... siAbsolute, siLocal, siObj (rotation)
    if (channel === 0) ['x', 'y', 'z'].forEach((ax, i) => app.setParam(l.get('scl' + ax)!, cur.scl.getComponent(i), label));
    else if (channel === 2) ['x', 'y', 'z'].forEach((ax, i) => app.setParam(l.get('pos' + ax)!, cur.pos.getComponent(i), label));
    else {
      // inferred: the target's orientation is kept when the two rotation orders differ (the angles are re-expressed)
      const e = new THREE.Euler().setFromQuaternion(cur.quat, threeOrder(l.val('rotorder')));
      [e.x, e.y, e.z].forEach((v, i) => app.setParam(l.get('rot' + 'xyz'[i])!, v / D2R, label));
    }
    return;
  }
  const m = new THREE.Matrix4().compose(cur.pos, cur.quat, cur.scl);
  setGlobal(app, o, local ? parentGlobal(o).multiply(m) : m, centre, label);
}

// ================================================================== registration
export function registerUixsiClipsDisplayAddonsCommands(app: App) {
  const prefBag = (): Record<string, any> => ((app as any).userPrefs ??= {});
  const state: UixsiClipsDisplayAddonsState = {
    imageSources: [], modelSources: [], modelClips: [], refPlanes: [], transientPlane: null, currentRefPlane: null, addons: [], calls: [], outputs: {},
    portDisplays: new Map(), portDialog: null, showPortValues: async (a) => a, portValueRules: null as any,
    activeLayoutName: () => currentLayoutName(),
    setActiveLayout: (name) => { if (!layoutByName(name)) return false; return switchLayout(name); },
    transformRef: () => { const value = Number(prefBag()[PREF_TRANSFORM_REF]) || 0; return { value, reference: value & 15, modifiers: value & 4080 }; },
    entries: {},
  };
  (app as any).uixsiClipsDisplayAddons = state;
  const reg = (def: CommandDef) => app.register(def);
  const out = (command: string, values: Record<string, any>) => { state.outputs[command] = values; };

  // ---------------------------------------------------------------- image sources and clips
  reg({
    name: 'CreateImageClip2', label: 'Create Image Clip from File v2', category: 'File|Texturing', description: 'Create Image Clip from File v2',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }],
    execute(app, a) {
      const file = String(a.FileName ?? ''), name = String(a.Name ?? '');
      const clips = lowLevel<any>(app, 'CreateImageClip2', SI_CREATE_IMAGE_CLIP2, { FileName: file, Name: name }, () => imageClipStandIn(app, 'CreateImageClip2', file, name));
      const list: any[] = Array.isArray(clips) ? clips : clips ? [clips] : [];
      out('CreateImageClip2', { FileName: file });
      for (const c of list) autoInspect(app, c);   // no selection change
      return list;
    },
  });
  const addSource = (app: App, command: string, lowName: string, a: Record<string, any>, extra: Record<string, any> | null) => {
    const file = String(a.FileName ?? ''), name = String(a.Name ?? '');
    const r = lowLevel<any>(app, command, lowName, { FileName: file, Name: name, ...(extra ?? {}) }, () => ({ Source: imageSourceStandIn(app, command, file, name, extra) }));
    const source = r?.Source ?? null;
    out(command, { FileName: file });
    if (source) { selectObj(app, source); autoInspect(app, source); }
    return source ?? undefined;
  };
  reg({
    name: 'AddImageSource', label: 'Add Image Source from File', category: 'File|Texturing', description: 'Add Image Source from File',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }],
    execute(app, a) { return addSource(app, 'AddImageSource', SI_ADD_IMAGE_SOURCE, a, null); },
  });
  reg({
    name: 'AddWritableImageSource', label: 'Add Writable Image Source', category: 'File|Texturing', description: 'Add Writable Image Source',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }, { name: 'Width', default: 256 }, { name: 'Height', default: 256 }, { name: 'Type', default: ':siRenderChannelColorType:siRenderChannelType' }, { name: 'UseExisting', default: false }],
    execute(app, a) { return addSource(app, 'AddWritableImageSource', SI_ADD_WRITABLE_IMAGE_SOURCE, a, { Width: a.Width, Height: a.Height, Type: a.Type, UseExisting: boolArg(a.UseExisting) }); },
  });

  // ---------------------------------------------------------------- model sources and clips
  reg({
    name: 'AddModelSource', label: 'AddModelSource', category: 'File', description: 'Add Model Source from File',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }, { name: 'Resolution', default: 2 }],
    execute(app, a) {
      const file = String(a.FileName ?? ''), name = String(a.Name ?? '');
      const r = lowLevel<any>(app, 'AddModelSource', SI_ADD_MODEL_SOURCE, { FileName: file, Name: name, Resolution: a.Resolution }, () => ({ Source: modelSourceStandIn(app, 'AddModelSource', file, name, a.Resolution) }));
      const source = r?.Source ?? null;
      if (source) { selectObj(app, source); autoInspect(app, source); }
      return source ?? undefined;
    },
  });
  /** Steps 2 to 4 of the two model clip commands: the output list is the return value; the clip's model is selected in branch. */
  const finishModelClip = (app: App, command: string, list: any) => {
    const model = referenceModel(app, command, list?.Clip);
    if (model) { selectObj(app, model, true); autoInspect(app, model); }
    return list;
  };
  reg({
    name: 'CreateModelClip', label: 'CreateModelClip', category: 'File', description: 'Create Model Clip from File',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }],
    execute(app, a) {
      const file = String(a.FileName ?? ''), name = String(a.Name ?? '');
      const list = lowLevel<any>(app, 'CreateModelClip', SI_CREATE_MODEL_CLIP, { FileName: file, Name: name }, () => {
        if (!file) { logNya(app, 'CreateModelClip', 'an empty file name (file browsing belongs to the low-level command); no clip was produced', 'Q7'); return { Clip: null }; }
        const source = state.modelSources.find(s => s.val('FileName') === file) ?? modelSourceStandIn(app, 'CreateModelClip', file, '', 1);
        return modelClipStandIn(app, 'CreateModelClip', source, name);
      });
      out('CreateModelClip', { FileName: file });
      return finishModelClip(app, 'CreateModelClip', list);
    },
  });
  reg({
    name: 'AddModelClip', label: 'AddModelClip', category: 'File', description: 'Create Model Clip from Source',
    args: [{ name: 'Source', default: '' }, { name: 'Name', default: '' }],
    execute(app, a) {
      const list = lowLevel<any>(app, 'AddModelClip', SI_ADD_MODEL_CLIP, { Source: a.Source, Name: a.Name }, () => {
        const source = findIn(state.modelSources, a.Source);
        if (!source) logNya(app, 'AddModelClip', `"${nameOf(a.Source)}" is not a model source of this build's store; no clip was produced`, 'Q7');
        return modelClipStandIn(app, 'AddModelClip', source, String(a.Name ?? ''));
      });
      return finishModelClip(app, 'AddModelClip', list);
    },
  });

  // ---------------------------------------------------------------- LoadPreset
  reg({
    name: 'LoadPreset', label: 'Load Preset', category: 'File|Property', description: 'Load the preset in the object',
    args: [{ name: 'PresetObj', default: '' }, { name: 'InputObj', default: null }],
    execute(app, a) {
      let preset = a.PresetObj;
      for (const n of nodes(app, a.InputObj)) {
        // one low-level call per object; a preset name written back by a call is the one used for the next object
        const r = lowLevel<any>(app, 'LoadPreset', SI_LOAD_PRESET, { FileName: preset, InputObj: n }, () => {
          logNya(app, 'LoadPreset', `the low-level preset loader; preset "${nameOf(preset)}" was not loaded into ${nameOf(n)}`, 'Q7'); return undefined;
        });
        if (r && typeof r === 'object' && !unset(r.FileName)) preset = r.FileName;
      }
      out('LoadPreset', { PresetObj: preset });
    },
  });

  // ---------------------------------------------------------------- add-ons
  reg({
    name: 'InstallAddon', label: 'Install Addon', category: 'File', description: 'Install an Add-on file in Softimage', undoable: false,
    args: [{ name: 'FileName', default: '' }, { name: 'InstallPath', default: 7 }],
    execute(app, a) {
      const om: any = (app as any).InstallAddon;
      if (typeof om === 'function') { om.call(app, a.FileName, a.InstallPath); return; }   // Application.InstallAddon FileName, InstallPath
      const file = String(a.FileName ?? '');
      state.calls.push({ command: 'Application.InstallAddon', by: 'InstallAddon', args: { FileName: file, InstallPath: a.InstallPath }, ran: false });
      if (file) { const i = state.addons.findIndex(x => x.file === file); if (i >= 0) state.addons.splice(i, 1); state.addons.push({ file, installPath: a.InstallPath }); }
      logNya(app, 'InstallAddon', file ? `the object-model add-on installer; "${file}" was noted as installed (install path ${a.InstallPath}), nothing was unpacked` : 'the object-model add-on installer with an empty file name', 'Q5');
      out('InstallAddon', { FileName: file });
    },
  });
  reg({
    name: 'UnInstallAddon', label: 'UnInstall Addon', category: 'File', description: 'UnInstall an Add-on file from Softimage', undoable: false,
    args: [{ name: 'FileName', default: '' }],
    execute(app, a) {
      const om: any = (app as any).UnInstallAddon;
      if (typeof om === 'function') { om.call(app, a.FileName); return; }   // Application.UnInstallAddon FileName
      const file = String(a.FileName ?? '');
      state.calls.push({ command: 'Application.UnInstallAddon', by: 'UnInstallAddon', args: { FileName: file }, ran: false });
      const i = state.addons.findIndex(x => x.file === file); if (i >= 0) state.addons.splice(i, 1);
      logNya(app, 'UnInstallAddon', file ? `the object-model add-on uninstaller; "${file}" ${i >= 0 ? 'was removed from' : 'is not in'} this build's add-on list` : 'the object-model add-on uninstaller with an empty file name', 'Q5');
      out('UnInstallAddon', { FileName: file });
    },
  });

  // ---------------------------------------------------------------- reference planes
  const planeInputs = (app: App, arg: any): { names: string[]; first: X3DObject | null } => {
    const s = splitInput(app, arg);
    const names = [...s.subs.map(x => `${x.obj.name}.${x.kind}[${x.items.join(',')}]`), ...s.clusters.map(c => `${c.obj?.name ?? ''}.cls.${c.name}`), ...s.objects.map(o => o.name)];
    return { names, first: s.subs[0]?.obj ?? s.clusters[0]?.obj ?? s.objects[0] ?? null };
  };
  const setCurrentPlane = (app: App, by: string, plane: Property | string) =>
    lowLevel(app, by, SET_CURRENT_REFERENCE_PLANE, { Value: plane }, () => { const old = state.currentRefPlane; app.record('Set current reference plane', () => { state.currentRefPlane = plane; }, () => { state.currentRefPlane = old; }); });
  reg({
    name: 'CreateReferencePlane', label: 'Create Reference Plane', category: 'Modeling', description: 'Creates a reference plane from the given objects and makes it current',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const planes = lowLevel<any>(app, 'CreateReferencePlane', SI_CREATE_REF_PLANE, { InputObjs: a.InputObjs }, () => {
        // inferred (Q7): one plane per call, placed on the first input's transform
        const inp = planeInputs(app, a.InputObjs);
        if (!inp.first) { logNya(app, 'CreateReferencePlane', 'the low-level plane command with no input; no plane was created', 'Q7'); return []; }
        const p = new Property(uniqueIn(state.refPlanes, 'RefPlane'), 'refplane', [str('inputs', inp.names.join(','), 'Inputs')]);
        (p as any).matrix = inp.first.globalMatrix().toArray();
        addToStore(app, state.refPlanes, p);
        logNya(app, 'CreateReferencePlane', `the low-level plane command; plane "${p.name}" was created on the transform of ${inp.first.name} in this build's plane store`, 'Q7');
        return [p];
      });
      const list: any[] = Array.isArray(planes) ? planes : planes ? [planes] : [];
      for (const p of list) { if (!p) continue; setCurrentPlane(app, 'CreateReferencePlane', p); autoInspect(app, p); }
      return list;
    },
  });
  reg({
    name: 'SetTransientReferencePlane', label: 'Set Transient Reference Plane', category: 'Modeling', description: 'Redefines the transient reference plane from the given objects or components and makes it current',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      lowLevel(app, 'SetTransientReferencePlane', SET_REFERENCE_PLANE, { Target: TRANSIENT_PLANE, InputObj: a.InputObjs }, () => {
        const inp = planeInputs(app, a.InputObjs); const old = state.transientPlane;
        const plane: RefPlane = { name: TRANSIENT_PLANE, inputs: inp.names, matrix: (inp.first ? inp.first.globalMatrix() : new THREE.Matrix4()).toArray() };
        app.record('Set reference plane', () => { state.transientPlane = plane; }, () => { state.transientPlane = old; });
        logNya(app, 'SetTransientReferencePlane', `how the plane is derived from its inputs; ${TRANSIENT_PLANE} was redefined from [${inp.names.join(', ')}] on the first input's transform`, 'Q7');
      });
      setCurrentPlane(app, 'SetTransientReferencePlane', TRANSIENT_PLANE);
    },
  });

  // ---------------------------------------------------------------- preference inspectors
  const inspector = (name: string, label: string, description: string, target: string, page: string | null) => reg({
    name, label, category: 'Manipulation', description, args: [], undoable: false,
    execute(app) {
      // InspectObj "<target>" with the command's defaults. The preference pages of this build live in the Preferences window.
      if (page && preferenceSets(app).has(page)) {
        for (const f of floatingWindows()) if (f.body.classList.contains('prefs')) f.close();   // an open Preferences window is recycled
        preferencesWindow(app, page);
      }
      else logNya(app, name, `the property page of ${target} is not modelled in this build; nothing was opened`);
    },
  });
  inspector('InspectSnapProperties', 'Properties...', 'Inspect the snap settings', 'Preferences.SnapProperties', null);
  inspector('InspectTransformProperties', 'Properties...', 'Inspect the transform settings', 'Preferences.TransformProperties', 'C3DTransformProps');
  inspector('InspectViewCubeProperties', 'ViewCube Properties...', 'Inspect the ViewCube settings', 'Preferences.ViewCube', 'C3DPrefsViewCube');

  // ---------------------------------------------------------------- MoveCtr2Vertices
  reg({
    name: 'MoveCtr2Vertices', label: 'Move Center to Points', category: 'Manipulation|Transform', description: 'Moves the centre of an object to the middle of its points without moving the geometry',
    args: [{ name: 'InputObjs', default: null }, { name: 'BoundingBox', default: false }],
    execute(app, a) {
      const bb = boolArg(a.BoundingBox);
      const inp = splitInput(app, a.InputObjs);
      if (!inp.objects.length && !inp.clusters.length && !inp.subs.length) {
        // text 1014 is not in the decoded dictionary (Q3)
        const text = siString('XSISCRIPTS', 1014) ?? `[XSISCRIPTS 1014 IDS_SELECT_OBJ_AND_COMPONENTS: text not yet attested, ${NOTE} Q3]`;
        app.logMsg('info', text); msgBox(app, text, siString('XSISCRIPTS', 'Warning') ?? 'Warning');
        return;
      }
      const move = (o: X3DObject | null, indices: number[] | null) => {
        if (!o) return;
        const t = centreTarget(globalPoints(o, indices), bb);
        if (!t) { logNya(app, 'MoveCtr2Vertices', `${o.name} has no points; its centre was not moved`); return; }
        moveCentreTo(app, o, t);
      };
      if (!inp.clusters.length && !inp.subs.length) { for (const o of inp.objects) move(o, null); return; }
      // Tagged sub-components become temporary clusters (CreateClusterFromSubComponent <sub-components>, , False). Refresh is
      // not needed here: geometry is evaluated on demand.
      const temp = inp.subs.map(s => {
        const c = new Cluster(uniqueIn(s.obj.clusters, 'TempCluster'), s.kind, new Set(s.items)); const o = s.obj;
        app.record('Create Cluster', () => { o.addCluster(c); }, () => { o.removeCluster(c); });
        return c;
      });
      for (const c of temp) {
        if (c.compKind !== 'pnt') { app.logMsg('info', 'Tagged components are not valid for this operation.'); return; }   // ends the whole command
        const o = c.obj!;
        move(o, [...c.elements].map(Number));
        const idx = o.clusters.indexOf(c);
        app.record('Delete ' + c.name, () => { o.removeCluster(c); }, () => { o.clusters.splice(idx, 0, c); });
      }
      for (const c of inp.clusters) {
        if (c.compKind !== 'pnt') { app.logMsg('info', `Cluster ${c.fullName} is not valid for this operation.`); continue; }
        move(c.obj, [...c.elements].map(Number));
      }
    },
  });
  state.entries['Move Center to Points'] = () => app.run('MoveCtr2Vertices', { BoundingBox: false });
  state.entries['Move Center to Bounding Box'] = () => app.run('MoveCtr2Vertices', { BoundingBox: true });

  // ---------------------------------------------------------------- MatchTransform
  const resolveObject = (x: any): X3DObject | null => x instanceof X3DObject ? x : typeof x === 'string' && x ? (x === app.scene.root.name ? app.scene.root : app.scene.find(x) ?? null) : null;
  reg({
    name: 'MatchTransform', label: 'Match All Global Transforms', category: 'Manipulation|Transform', description: 'Copies transformations',
    args: [{ name: 'InputObjs', default: null }, { name: 'TargetObj', default: '' }, { name: 'Type', default: ':siSRT:siTransformFilter' }, { name: 'LocalReference', default: false }],
    execute(app, a) {
      const list = objs(app, a.InputObjs);
      if (!list.length) { app.logMsg('error', 'Please select an object first'); return; }
      if (unset(a.TargetObj)) {
        if (!interactive(app)) { logNya(app, 'MatchTransform', 'picking the target without a user session; nothing was matched', 'Q10'); return; }
        const sel = [...app.selection]; let done = false;
        startPickSession(app, {
          command: 'MatchTransform', kind: 'element', prompt: siString('XSISCRIPTS', 1159) ?? 'Pick an object to match pose to', followSelection: true,
          fromClick: (_p, pick) => pick?.obj ?? null,
          onPick: (v: any) => {
            const t = resolveObject(v); if (!t) return true;   // inferred: an empty pick asks again
            done = true;
            app.selection = sel; app.events.emit('selection');   // inferred: an explorer pick does not replace the selection
            out('MatchTransform', { TargetObj: t.name });
            try { app.run('MatchTransform', { InputObjs: list, TargetObj: t, Type: a.Type, LocalReference: a.LocalReference }); } catch { /* logged by the bus */ }
            return false;
          },
          onEnd: () => { if (!done) logNya(app, 'MatchTransform', 'a cancelled pick; nothing was matched', 'Q10'); },
        });
        return;
      }
      const target = resolveObject(a.TargetObj);
      if (!target) throw new Error(`MatchTransform: target "${nameOf(a.TargetObj)}" not found`);   // the reads fail on an empty target
      const type = siConst(a.Type); const ch = typeof type === 'string' ? CHANNELS[type] : undefined;
      if (!ch) { logNya(app, 'MatchTransform', `transform filter ${String(type)} (numeric values of the filter constants); nothing was matched`, 'Q4'); return; }
      const centre = !!(app as any).centerMode;   // user preference SI3D_SRT_CENTER = the centre manipulation mode of this build
      const local = boolArg(a.LocalReference);
      out('MatchTransform', { TargetObj: target.name });
      for (const o of list) {
        const model = o instanceof Model ? o : o.model; const referenced = !!(model as any)?.ref;
        ([0, 1, 2] as const).forEach((c) => {
          if (!ch[c]) return;
          // rotation in local space: the script switches the target's rotation order to XYZ for the read and restores it; the net
          // effect on the target is nil, the orientation read here is the same
          matchChannel(app, o, target, c, local, centre);
          if (referenced && app.scene.find(o.name) === o) {
            // referenced model: the local values of the channel are written back unchanged
            const pre = ['scl', 'rot', 'pos'][c]; const l = o.kinematics.local;
            for (const ax of 'xyz') app.run('SetValue', { Target: `${o.name}.kine.local.${pre}${ax}`, Value: l.val(pre + ax) });
          }
        });
      }
    },
  });
  for (const [label, type] of [['Match All Global Transforms', 'siSRT'], ['Match Global Scaling', 'siScl'], ['Match Global Rotation', 'siRot'], ['Match Global Translation', 'siTrn']] as const)
    state.entries[label] = () => app.run('MatchTransform', { Type: type });

  // ---------------------------------------------------------------- SetTransformRefMode
  reg({
    name: 'SetTransformRefMode', label: 'MCP Setting: Set Transform Ref/Modifier', category: 'Modeling|Animation|Property', description: 'Sets the transform reference mode or toggles a transform modifier', undoable: false,
    args: [{ name: 'Mode', default: 0 }],
    execute(app, a) {
      const mode = Number(a.Mode) || 0;
      const bag = prefBag(); const cur = Number(bag[PREF_TRANSFORM_REF]) || 0;   // inferred: an unset preference reads as 0
      const reference = cur & 15, modifiers = cur & 4080;
      let value: number;
      if (mode <= 15) value = mode + modifiers;                       // reference replaced, modifiers kept
      else if ((modifiers & mode) === mode) value = reference;        // already on: every modifier is dropped
      else value = mode + reference;                                  // turned on: the other modifiers are dropped
      bag[PREF_TRANSFORM_REF] = value;                                // always written
      app.events.emit('selection');
      // the procedure produces no value
    },
  });
  for (const [label, mode] of [['Set Transform Ref Global', 1], ['Set Transform Ref Local', 2], ['Set Transform Ref Reference', 3], ['Set Transform Ref View', 4], ['Set Transform Ref Parent', 6], ['Set Transform Ref Plane', 7],
    ['Set Transform Modifier COG', 16], ['Set Transform Modifier Scaling UNI', 256], ['Set Transform Modifier Scaling VOL', 1024], ['Set Transform Modifier Sym', 2048]] as const)
    state.entries[`MCP Setting: ${label}`] = () => app.run('SetTransformRefMode', { Mode: mode });

  // ---------------------------------------------------------------- manipulator size, background colour
  const manipulatorSize = (name: string, label: string, delta: number) => {
    reg({
      name, label, category: 'Viewing', description: `${delta > 0 ? 'Increases' : 'Decreases'} the transform manipulator size by 10`, args: [], undoable: false,
      execute(app) {
        const p = preferenceSets(app).get('C3DTransformProps')?.get('transformsize');   // Preferences.TransformProperties.transformsize
        if (!p) throw new Error(`${name}: Preferences.TransformProperties.transformsize not found`);
        const v = Number(p.value) + delta;
        if (delta > 0 ? v <= 100 : v > 0) p.value = v;   // outside the limits nothing is written (no clamping)
      },
    });
    state.entries[`${label} (alternate)`] = () => app.run(name);
  };
  manipulatorSize('IncreaseManipulatorSize', 'Increase Manipulator Size', 10);
  manipulatorSize('DecreaseManipulatorSize', 'Decrease Manipulator Size', -10);
  reg({
    name: 'ToggleBackgroundColor', label: 'Toggle Background Color', category: 'Viewing', description: 'Switches the scene background colour between black and mid grey', args: [], undoable: false,
    execute(app) {
      const p = preferenceSets(app).get('C3DSceneColors')?.get('backgroundcol');   // Preferences.SceneColors.backgroundcol
      if (!p) throw new Error('ToggleBackgroundColor: Preferences.SceneColors.backgroundcol not found');
      p.value = Number(p.value) === 0 ? 2139062271 : 0;   // 0x7F7F7FFF, mid grey
      app.events.emit('scene');
    },
  });

  // ---------------------------------------------------------------- ToggleFullscreenLayout
  reg({
    name: 'ToggleFullscreenLayout', label: 'Toggle Fullscreen Layout', category: 'Viewing', description: 'Switches between the Autohide layout and the Default layout', args: [], undoable: false,
    execute() {
      const want = state.activeLayoutName() === 'Autohide' ? 'Default' : 'Autohide';
      if (!state.setActiveLayout(want)) throw new Error(`ToggleFullscreenLayout: layout "${want}" not found`);
    },
  });

  // ---------------------------------------------------------------- view camera display
  /** GetViewCamera (default view), then that camera's display property. */
  const viewCameraDisplay = (app: App, command: string): { camera: string; disp: Property } => {
    const cam = app.commands.has(GET_VIEW_CAMERA) ? app.run(GET_VIEW_CAMERA, { View: -1 }) : undefined;
    const m = /^Views\.View([A-D])\./.exec(nameOf(cam));
    const vm: any = (globalThis as any).__vm; const vps: any[] = vm?.viewports?.() ?? [];
    // inferred: view letters A..D are the four viewports in order; a scene camera's own display property wins over the viewport's
    const vp = m ? vps[m[1].charCodeAt(0) - 65] : undefined;
    const sceneCam = cam instanceof X3DObject ? cam : vp ? app.scene.find(vp.name) : undefined;
    const disp: Property | undefined = sceneCam?.properties.find(p => p.type === 'camdisp') ?? vp?.x?.disp;
    if (!disp) throw new Error(`${command}: no view camera`);
    return { camera: nameOf(cam), disp };
  };
  reg({
    name: 'RotoscopyOptions', label: 'Rotoscopy Options', category: 'Viewing', description: 'Enables rotoscopy on the view camera and inspects its rotoscope options', args: [],
    execute(app) {
      const { camera, disp } = viewCameraDisplay(app, 'RotoscopyOptions');
      const p = disp.get('rotoenable'); if (!p) throw new Error('RotoscopyOptions: camdisp.rotoenable not found');
      if (!p.value) app.setParam(p, true);
      // InspectObj "<camera>.rotoscope": the rotoscope page of this build is the camera display property
      logNya(app, 'RotoscopyOptions', `the property page ${camera}.rotoscope is not modelled; the camera display property is inspected instead`);
      queueMicrotask(() => app.events.emit('inspect', disp));
    },
  });
  reg({
    name: 'SetLightingDisplayMode', label: 'Set Lighting Display Mode', category: 'Viewing', description: 'Turns the headlight of the view camera off', args: [],
    execute(app) {
      const { disp } = viewCameraDisplay(app, 'SetLightingDisplayMode');
      const p = disp.get('headlight'); if (!p) throw new Error('SetLightingDisplayMode: camdisp.headlight not found');
      if (p.value) app.setParam(p, false);   // never turned on
    },
  });

  // ---------------------------------------------------------------- NURBS display quality
  const geomApproxOf = (o: X3DObject): Property | undefined => { for (let n: X3DObject | null = o; n; n = n.parentObj) { const p = n.properties.find(q => q.type === 'geomapprox'); if (p) return p; } return undefined; };
  const nurbsQuality = (name: string, label: string, quality: number) => reg({
    name, label, category: 'Viewing', description: 'Sets the viewing step of the selected curves and surfaces',
    args: [{ name: 'Quality', default: quality }],
    execute(app, a) {
      const q = Number(a.Quality);
      const curveStep = q === 1 ? 3 : q === 3 ? 9 : 6, surfStep = q === 1 ? 1 : q === 3 ? 6 : 3;
      const sel = app.selectedObjects;
      const set = (o: X3DObject, names: string[], v: number) => {
        const cur = geomApproxOf(o);
        if (!cur) { logNya(app, name, `${o.name} has no geometry approximation property; skipped`); return; }
        if (!names.some(n => cur.get(n) && Number(cur.val(n)) !== v)) return;   // already at the wanted values: untouched
        // MakeLocal "<object>.geomapprox" (no confirmation is asked here, Q6; the selection is kept), then SetValue
        const local = ensureLocal(app, o, 'geomapprox');
        for (const n of names) { const p = local.get(n); if (p) app.setParam(p, v); }
      };
      for (const o of sel.filter(x => x.type === 'crvlist')) set(o, ['gapproxvwcustep'], curveStep);
      for (const o of sel.filter(x => x.type === 'surfmsh')) set(o, ['gapproxvwustep', 'gapproxvwvstep'], surfStep);
    },
  });
  nurbsQuality('SetNURBSDisplayQualityDefault', 'Set NURBS Display Quality Default', 0);
  nurbsQuality('SetNURBSDisplayQualityLow', 'Set NURBS Display Quality Low', 1);
  nurbsQuality('SetNURBSDisplayQualityMedium', 'Set NURBS Display Quality Medium', 2);
  nurbsQuality('SetNURBSDisplayQualityHigh', 'Set NURBS Display Quality High', 3);

  // ---------------------------------------------------------------- DisplayPortValues
  registerDisplayPortValues(app, state, reg);
}
