// Model half of ledger row CMD-12a (texture projection / texture support script commands).
// Brief: docs/ghidra/cmd-12a-texture-projection-scripts.md, "Shared facts" and "Wire contract". Original code written
// from that note only.
//
// The 12 script commands are thin layers over C++ texture task commands whose behaviour the note leaves to a later
// row (Q4, CMD-12b); only their call shapes are attested. The functions in the "task stand-ins" section below take
// those call shapes and do the work with this build's existing projection model (src/core/texturing.ts: a
// `uvprojection` property on the object's sample cluster, driven by a `texturesupport` object). Everything a stand-in
// decides beyond the call shape is marked `// inferred`.
import * as THREE from 'three';
import { App } from './commands';
import { Node, X3DObject, Cluster, Property, Camera, Operator, threeOrder } from './scene';
import { ParamSet, num, int, bool, str, enumP } from './params';
import { MeshData } from './geometry';
import { meshEdges, toPolys } from './topology';
import { projectSamples, sampleOffsets, supportOf } from './texturing';
import { makeImplicit } from './scene2';

export const NOTE = 'docs/ghidra/cmd-12a-texture-projection-scripts.md';

// ------------------------------------------------------------------ enum values (note, "Shared facts")
export const siProjPlanar = 0, siProjCylindrical = 1, siProjSpherical = 2, siProjLollipop = 3, siProjSpatial = 4, siProjCubic = 5;
export const siPlaneXY = 0, siPlaneXZ = 1, siPlaneYZ = 2;
export const siRelDefault = 0, siRelBestFit = 1, siRelObject = 2, siRelWorld = 3, siRelObjectPosObject = 4, siRelWorldPosObject = 5;
export const siUVPropertyID = 235, siViewID = 134, siErrCancelled = 0x4C7;
const ENUMS: Record<string, number> = {
  siProjPlanar, siProjCylindrical, siProjSpherical, siProjLollipop, siProjSpatial, siProjCubic,
  siPlaneXY, siPlaneXZ, siPlaneYZ,
  siRelDefault, siRelBestFit, siRelObject, siRelWorld, siRelObjectPosObject, siRelWorldPosObject,
};
/** A registry default such as ":siProjPlanar:siTxtProjType", an enum name or a number, as a number. */
export function enumValue(v: any, fallback: number): number {
  if (typeof v === 'number') return v;
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v).trim(); const n = Number(s); if (s !== '' && Number.isFinite(n)) return n;
  for (const part of s.split(':')) if (part in ENUMS) return ENUMS[part];
  return fallback;
}

/** "not yet attested" line in the log (the unknown branch of a command says so instead of guessing silently). */
export function notAttested(app: App, command: string, what: string, question: string) {
  app.logMsg('info', `${command}: not yet attested: ${what} (${NOTE} ${question})`);
}

// ------------------------------------------------------------------ input items
export type CompTok = 'poly' | 'pnt' | 'edge' | 'sample';
/** A sub-component collection item ("cube.poly[0,2]"); edges are indices into meshEdges(). */
export interface SubComponent { readonly kind: 'subcomponent'; obj: X3DObject; compKind: CompTok; elements: number[]; fullName?: string; }
/** A sub-component item that prints as "obj.poly[0,2]" in the command log. */
export function subComponent(obj: X3DObject, compKind: CompTok, elements: number[]): SubComponent { return { kind: 'subcomponent', obj, compKind, elements, fullName: `${obj.name}.${compKind}[${elements.join(',')}]` }; }
export type Item = Node | SubComponent | string;

export const isSubComponent = (x: any): x is SubComponent => !!x && x.kind === 'subcomponent' && x.obj instanceof X3DObject;
export const isUVProperty = (x: any): x is Property => x instanceof Property && x.type === 'uvprojection';
export const meshOf = (o: X3DObject | null | undefined): MeshData | null => o?.primitive?.mesh() ?? null;
export function itemText(it: any): string {
  if (isSubComponent(it)) return `${it.obj.name}.${it.compKind}[${it.elements.join(',')}]`;
  if (it instanceof Node) return it.fullName;
  return String(it);
}
/** Component kind of an item, or null for anything that is not a cluster / sub-component. */
export function compKindOf(it: any): CompTok | null {
  if (isSubComponent(it)) return it.compKind;
  if (it instanceof Cluster) return it.compKind;
  return null;
}
/** The 3D object an item belongs to. */
export function ownerOf(it: any): X3DObject | null {
  if (it instanceof X3DObject) return it;
  if (isSubComponent(it)) return it.obj;
  if (it instanceof Cluster) return it.obj;
  if (it instanceof Property) { let n: any = it.parent; while (n && !(n instanceof X3DObject)) n = n instanceof Cluster ? n.obj : n.parent; return n ?? null; }
  return null;
}
/** Elements of a cluster / sub-component as numbers (edges as meshEdges indices). */
export function elementsOf(it: SubComponent | Cluster): number[] {
  if (isSubComponent(it)) return it.elements;
  const m = meshOf(it.obj); const out: number[] = [];
  let edgeIndex: Map<string, number> | null = null;
  for (const e of it.elements) {
    if (typeof e === 'number') { out.push(e); continue; }
    if (!edgeIndex) { edgeIndex = new Map(); if (m) meshEdges(m).forEach(([a, b], i) => edgeIndex!.set(`${a}-${b}`, i)); }
    const [a, b] = String(e).split('-').map(Number); const i = edgeIndex.get(`${Math.min(a, b)}-${Math.max(a, b)}`); if (i !== undefined) out.push(i);
  }
  return out;
}

function splitTopLevel(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '[') depth++; else if (ch === ']') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(x => x.trim()).filter(Boolean);
}
function componentCount(o: X3DObject, k: CompTok): number {
  const m = meshOf(o); if (!m) return 0;
  return k === 'poly' ? m.polygons.length : k === 'pnt' ? m.positions.length / 3 : k === 'edge' ? meshEdges(m).length : sampleOffsets(m).total;
}
function parseIndices(text: string, count: number): number[] {
  const out: number[] = [];
  for (const part of text.split(',').map(x => x.trim()).filter(Boolean)) {
    if (part === '*') { for (let i = 0; i < count; i++) out.push(i); continue; }
    const r = /^(\d+|LAST)\s*-\s*(\d+|LAST)$/i.exec(part); const idx = (t: string) => /last/i.test(t) ? count - 1 : Number(t);
    if (r) { for (let i = idx(r[1]); i <= idx(r[2]); i++) out.push(i); } else if (/^\d+$/.test(part)) out.push(Number(part)); else if (/^last$/i.test(part)) out.push(count - 1);
  }
  return [...new Set(out)];
}
function resolveString(app: App, s: string): Item {
  const m = /^(.+)\.(poly|pnt|edge|sample)\[(.*)\]$/.exec(s);
  if (m) { const o = app.scene.find(m[1]); if (o) { const k = m[2] as CompTok; return subComponent(o, k, parseIndices(m[3], componentCount(o, k))); } return s; }
  const o = app.scene.find(s); if (o) return o;
  const tail = (full: string, name: string) => full === name || full.endsWith('.' + name);
  for (const x of app.scene.allObjects()) {
    for (const c of x.clusters) {
      if (c.fullName === s || s === `${x.name}.${c.name}` || (s.startsWith(x.name + '.') && tail(s, `cls.${c.name}`))) return c;
      for (const p of c.properties) if (p.fullName === s || s === `${x.name}.${c.name}.${p.name}` || (s.startsWith(x.name + '.') && tail(s, `${c.name}.${p.name}`)) || s === `${x.name}.${p.name}`) return p;
    }
    for (const p of x.properties) if (p.fullName === s || s === `${x.name}.${p.name}`) return p;
  }
  return s; // unresolved: kept as text so the commands can report it
}
/** The current selection as items: the component selection when there is one, else the selected nodes. */
export function selectionItems(app: App): Item[] {
  const c = app.compSel;
  if (c) {
    const m = meshOf(c.obj);
    if (c.kind === 'polygon' && c.polygons.size) return [subComponent(c.obj, 'poly', [...c.polygons])];
    if (c.kind === 'point' && c.points.size) return [subComponent(c.obj, 'pnt', [...c.points])];
    if (c.kind === 'edge' && c.edges.size && m) {
      const index = new Map<string, number>(); meshEdges(m).forEach(([a, b], i) => index.set(`${a}-${b}`, i));
      const els = [...c.edges].map(k => { const [a, b] = k.split('-').map(Number); return index.get(`${Math.min(a, b)}-${Math.max(a, b)}`); }).filter((i): i is number => i !== undefined);
      return [subComponent(c.obj, 'edge', els)];
    }
  }
  return [...app.selection];
}
/** Collection argument → items. Omitted (null / undefined / "") means the selection when `useSelection` is set. */
export function resolveItems(app: App, arg: any, useSelection = true): Item[] {
  if (arg === undefined || arg === null || arg === '') return useSelection ? selectionItems(app) : [];
  const list = Array.isArray(arg) ? arg : [arg]; const out: Item[] = [];
  for (const x of list) {
    if (x === undefined || x === null || x === '') continue;
    if (typeof x === 'string') { for (const part of splitTopLevel(x)) out.push(resolveString(app, part)); continue; }
    if (x instanceof Node || isSubComponent(x)) { out.push(x); continue; }
    if (x.obj instanceof X3DObject && x.sel) { // App.componentSel() shape
      const k: CompTok = x.sel.kind === 'polygon' ? 'poly' : x.sel.kind === 'point' ? 'pnt' : 'edge';
      if (k === 'edge') { const m = meshOf(x.obj); const index = new Map<string, number>(); if (m) meshEdges(m).forEach(([a, b], i) => index.set(`${a}-${b}`, i)); out.push(subComponent(x.obj, k, (x.sel.edges ?? []).map((e: number[]) => index.get(`${Math.min(e[0], e[1])}-${Math.max(e[0], e[1])}`)).filter((i: any) => i !== undefined))); }
      else out.push(subComponent(x.obj, k, [...x.sel.indices]));
      continue;
    }
    out.push(String(x));
  }
  return out;
}
/** SingleObj argument → the UV property (or null). Omitted means the first UV property of the selection. */
export function resolveUVProperty(app: App, arg: any): Property | null {
  const items = resolveItems(app, arg, true);
  return items.find(isUVProperty) ?? null;
}
export function resolveObject(app: App, arg: any): X3DObject | null {
  if (arg === undefined || arg === null || arg === '') return null;
  if (arg instanceof X3DObject) return arg;
  if (typeof arg === 'string') return app.scene.find(arg.trim()) ?? null;
  return null;
}

/** Sample (polygon node) indices named by an item on mesh `m`. Whole object: every sample. */
export function samplesOfItem(it: X3DObject | Cluster | SubComponent, m: MeshData): number[] {
  const { start, total } = sampleOffsets(m);
  if (it instanceof X3DObject) return Array.from({ length: total }, (_, i) => i);
  const k = compKindOf(it)!; const els = elementsOf(it);
  if (k === 'sample') return els.filter(i => i >= 0 && i < total);
  if (k === 'poly') { const out: number[] = []; for (const pi of els) { const f = m.polygons[pi]; if (f) for (let i = 0; i < f.length; i++) out.push(start[pi] + i); } return out; }
  const verts = new Set<number>();
  if (k === 'pnt') els.forEach(v => verts.add(v));
  else { const edges = meshEdges(m); for (const e of els) { const ab = edges[e]; if (ab) { verts.add(ab[0]); verts.add(ab[1]); } } } // inferred: an edge names the samples of its two end points
  const out: number[] = []; m.polygons.forEach((f, pi) => f.forEach((v, i) => { if (verts.has(v)) out.push(start[pi] + i); }));
  return out;
}
/** Vertex indices touched by an item (for fitting a support). */
function vertsOfItem(it: X3DObject | Cluster | SubComponent, m: MeshData): number[] {
  if (it instanceof X3DObject) return Array.from({ length: m.positions.length / 3 }, (_, i) => i);
  const k = compKindOf(it)!; const els = elementsOf(it); const out = new Set<number>();
  if (k === 'pnt') els.forEach(v => out.add(v));
  else if (k === 'poly') els.forEach(pi => m.polygons[pi]?.forEach(v => out.add(v)));
  else if (k === 'edge') { const edges = meshEdges(m); els.forEach(e => { const ab = edges[e]; if (ab) { out.add(ab[0]); out.add(ab[1]); } }); }
  else { const wanted = new Set(els); let s = 0; for (const f of m.polygons) for (const v of f) { if (wanted.has(s)) out.add(v); s++; } }
  return [...out];
}

// ------------------------------------------------------------------ UV properties
const KIND_ITEMS = ['UV', 'Planar XY', 'Planar YZ', 'Planar XZ', 'Cylindrical', 'Spherical', 'Cubic', 'Spatial', 'Camera Projection', 'Unique UVs'].map(k => ({ label: k, value: k }));
const LABEL: Record<string, string> = { pnt: 'Point', edge: 'Edge', poly: 'Polygon', sample: 'Sample' };
export function uniqueClusterName(o: X3DObject, base: string) { let n = base, i = 1; while (o.clusters.some(c => c.name === n)) n = `${base}${i++}`; return n; }
/** The complete sample cluster of an object, created on demand (undoable). */
export function sampleCluster(app: App, o: X3DObject): Cluster {
  const have = o.clusters.find(c => c.compKind === 'sample' && c.isComplete); if (have) return have;
  const m = meshOf(o); const n = m ? sampleOffsets(m).total : 0;
  const c = new Cluster(uniqueClusterName(o, LABEL.sample), 'sample', new Set(Array.from({ length: n }, (_, i) => i))); c.set('alwayscomplete', true);
  app.record('Create Cluster', () => o.addCluster(c), () => o.removeCluster(c)); return c;
}
/** Every UV property of an object's sample clusters. */
export function uvPropertiesOf(o: X3DObject): Property[] { return o.clusters.filter(c => c.compKind === 'sample').flatMap(c => c.properties.filter(isUVProperty)); }
/** Texture supports a UV property was built through (main support and sub-projection / UV-domain supports). */
export function supportsOfProperty(o: X3DObject, p: Property): X3DObject[] {
  const out: X3DObject[] = []; const main = supportOf(o, p); if (main) out.push(main);
  for (const s of ((p as any).supports ?? []) as X3DObject[]) if (!out.includes(s)) out.push(s);
  return out.filter(s => s.parentObj !== null);
}
function newUVProperty(app: App, o: X3DObject, name: string, kind: string, support: X3DObject | null, mainSupport = true): Property {
  const p = new Property(name, 'uvprojection', [enumP('kind', kind, KIND_ITEMS, 'Projection'), str('support', support && mainSupport ? support.name : '', 'Texture Support', { readOnly: true }),
    num('urepeat', 1, 'U Repeat', { min: 0.01 }), num('vrepeat', 1, 'V Repeat', { min: 0.01 }), num('uoffset', 0, 'U Offset'), num('voffset', 0, 'V Offset'), bool('swapuv', false, 'Swap UV')]);
  (p as any).supports = support ? [support] : [];
  const cl = sampleCluster(app, o); app.record('Projection', () => cl.addProperty(p), () => cl.removeProperty(p));
  return p;
}
/** The projection definition (`projdef`) of a UV property: U/V translation, scaling and rotation of the projection. */
export function projDefOf(p: Property): ParamSet {
  let d = (p as any).projdef as ParamSet | undefined;
  if (!d) {
    d = new ParamSet('projdef', 'projdef', [num('projtrsu', 0, 'Translation U'), num('projtrsv', 0, 'Translation V'), num('projsclu', 1, 'Scaling U'), num('projsclv', 1, 'Scaling V'), num('projrotu', 0, 'Rotation U'), num('projrotv', 0, 'Rotation V')]);
    d.parent = p; (p as any).projdef = d;
  }
  return d;
}
/** Per-sample UVs of one UV property (edited UVs when present, else the projection through its support). */
export function propertyUVs(o: X3DObject, p: Property): Float32Array | null {
  const m = meshOf(o); if (!m) return null; const { total } = sampleOffsets(m);
  const edited = (p as any).uvs as Float32Array | undefined; if (edited && edited.length === total * 2) return edited;
  const sup = supportOf(o, p); const space = sup ? sup.globalMatrix().invert().multiply(o.globalMatrix()) : null;
  const uv = projectSamples(m, String(p.val('kind')), space);
  const ur = Number(p.val('urepeat') ?? 1), vr = Number(p.val('vrepeat') ?? 1), uo = Number(p.val('uoffset') ?? 0), vo = Number(p.val('voffset') ?? 0);
  for (let i = 0; i < uv.length; i += 2) { uv[i] = uv[i] * ur + uo; uv[i + 1] = uv[i + 1] * vr + vo; }
  return uv;
}
/** Replace the explicit UVs of a property (undoable). */
function writeUVs(app: App, p: Property, next: Float32Array) {
  const old = (p as any).uvs as Float32Array | undefined;
  app.record('Edit UVs', () => { (p as any).uvs = next; (p as any)._uvcache = null; }, () => { (p as any).uvs = old; (p as any)._uvcache = null; });
}
/** UV bounding box of a set of samples. */
export function uvBounds(uv: Float32Array, samples: Iterable<number>): { umin: number; vmin: number; umax: number; vmax: number; count: number } {
  let umin = Infinity, vmin = Infinity, umax = -Infinity, vmax = -Infinity, count = 0;
  for (const s of samples) { const u = uv[s * 2], v = uv[s * 2 + 1]; if (u === undefined || v === undefined) continue; umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); count++; }
  return { umin, vmin, umax, vmax, count };
}
/** Relative UV translation of samples of a property (the TranslateUVW call shape: U, V; W is not modelled). */
export function translateUVs(app: App, p: Property, samples: number[], du: number, dv: number) {
  const o = ownerOf(p); const cur = o && propertyUVs(o, p); if (!cur) return;
  const next = Float32Array.from(cur); for (const s of new Set(samples)) { next[s * 2] += du; next[s * 2 + 1] += dv; }
  writeUVs(app, p, next);
}
/** Relative UV scaling of samples of a property (the ScaleUVW call shape). Without a pivot the scaling is about the
 *  centre of the samples' UV bounding box. */
export function scaleUVs(app: App, p: Property, samples: number[], su: number, sv: number, pivot: [number, number] | null) {
  const o = ownerOf(p); const cur = o && propertyUVs(o, p); if (!cur) return;
  const set = new Set(samples); let pu = pivot?.[0] ?? 0, pv = pivot?.[1] ?? 0;
  if (!pivot) { const b = uvBounds(cur, set); if (!b.count) return; pu = (b.umin + b.umax) / 2; pv = (b.vmin + b.vmax) / 2; } // inferred: default pivot of ScaleUVW
  const next = Float32Array.from(cur); for (const s of set) { next[s * 2] = pu + (next[s * 2] - pu) * su; next[s * 2 + 1] = pv + (next[s * 2 + 1] - pv) * sv; }
  writeUVs(app, p, next);
}

// ------------------------------------------------------------------ task stand-ins (call shapes of the note; behaviour Q4)
/** SIFindUniqueTextureName: a UV property name not yet used on any of the objects. */
export function findUniqueTextureName(objs: X3DObject[], proposed: string): string {
  const base = proposed || 'Texture_Projection'; // inferred: name used when none is proposed
  const taken = new Set<string>(); for (const o of objs) for (const c of o.clusters) for (const p of c.properties) taken.add(p.name);
  if (!taken.has(base)) return base;
  let i = 1; while (taken.has(`${base}${i}`)) i++; return `${base}${i}`; // inferred: numbering scheme
}

const KIND_OF_TYPE: Record<number, string> = { [siProjPlanar]: 'Planar XY', [siProjCylindrical]: 'Cylindrical', [siProjSpherical]: 'Spherical', [siProjLollipop]: 'Spherical', [siProjSpatial]: 'Spatial', [siProjCubic]: 'Cubic' };
const SHAPE_OF_TYPE: Record<number, string> = { [siProjPlanar]: 'Square', [siProjCylindrical]: 'Cylinder', [siProjSpherical]: 'Sphere', [siProjLollipop]: 'Sphere', [siProjSpatial]: 'Cube', [siProjCubic]: 'Cube' };
const TYPE_LABEL: Record<number, string> = { [siProjPlanar]: 'Planar', [siProjCylindrical]: 'Cylindrical', [siProjSpherical]: 'Spherical', [siProjLollipop]: 'Lollipop', [siProjSpatial]: 'Spatial', [siProjCubic]: 'Cubic' };
const PLANE_LABEL = ['XY', 'XZ', 'YZ'];

function setLocalFromGlobal(o: X3DObject, parent: X3DObject, global: THREE.Matrix4) {
  const local = parent.globalMatrix().invert().multiply(global);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); local.decompose(p, q, s);
  const l = o.kinematics.local; const e = new THREE.Euler().setFromQuaternion(q, threeOrder(l.val('rotorder'))); const r = 180 / Math.PI;
  l.set('posx', p.x); l.set('posy', p.y); l.set('posz', p.z); l.set('rotx', e.x * r); l.set('roty', e.y * r); l.set('rotz', e.z * r); l.set('sclx', s.x); l.set('scly', s.y); l.set('sclz', s.z);
}
/** A texture support object: an implicit shape spanning -1..1 in its own frame (GeoX/Y/Z = 2), fitted by its transform. */
function makeSupport(app: App, name: string, type: number, plane: number, parent: X3DObject, frame: THREE.Matrix4, mn: number[], mx: number[], visible: boolean): X3DObject {
  const sup = makeImplicit(app.scene.uniqueName(name || 'Texture_Support'), SHAPE_OF_TYPE[type] ?? 'Square'); // inferred: default support name
  (sup as any).type = 'texturesupport'; (sup as any).projectionKind = type === siProjPlanar ? `Planar ${PLANE_LABEL[plane] ?? 'XY'}` : TYPE_LABEL[type]; (sup as any).projectionType = type; (sup as any).projectionPlane = plane;
  const prim = sup.primitive!; prim.set('size', 2);
  for (const ax of ['GeoX', 'GeoY', 'GeoZ']) prim.add(num(ax, 2, ax, { readOnly: true })); // inferred: the support's own extent, before scaling
  const ctr = [0, 1, 2].map(k => (mn[k] + mx[k]) / 2), half = [0, 1, 2].map(k => Math.max(1e-3, (mx[k] - mn[k]) / 2));
  // the support's local XY plane is the projection plane: XZ turns local Y onto Z, YZ turns local X onto Z (inferred orientation)
  const rot = new THREE.Matrix4(); let scl = half;
  if (plane === siPlaneXZ) { rot.makeRotationX(Math.PI / 2); scl = [half[0], half[2], half[1]]; }
  else if (plane === siPlaneYZ) { rot.makeRotationY(-Math.PI / 2); scl = [half[2], half[1], half[0]]; }
  const g = frame.clone().multiply(new THREE.Matrix4().makeTranslation(ctr[0], ctr[1], ctr[2])).multiply(rot).multiply(new THREE.Matrix4().makeScale(scl[0], scl[1], scl[2]));
  if (!visible) sup.property('visibility')?.set('viewvis', false);
  app.record('Texture Support', () => parent.addChild(sup), () => parent.removeChild(sup));
  setLocalFromGlobal(sup, parent, g);
  return sup;
}

export interface BasicGeoArgs { command: string; input: Item[]; supportName: string; propertyName: string; parent: X3DObject | null; type: number; plane: number; visible: boolean; existing: Property | null; fitting: number; }
/**
 * SICreateTextureBasicGeo: creates one texture support for the input and a UV property projected through it; with an
 * existing UV property, adds a sub-projection of the input's samples to that property instead.
 */
export function createTextureBasicGeo(app: App, a: BasicGeoArgs): { support: X3DObject | null; properties: Property[] } {
  const usable = a.input.filter((it): it is X3DObject | Cluster | SubComponent => (it instanceof X3DObject || it instanceof Cluster || isSubComponent(it)) && !!meshOf(ownerOf(it)));
  if (usable.length < a.input.length) notAttested(app, a.command, `texture projection on ${a.input.filter(it => !usable.includes(it as any)).map(itemText).join(', ')} (not a mesh or surface, or not found); skipped`, 'Q4');
  if (!usable.length) return { support: null, properties: [] };
  const type = a.type in KIND_OF_TYPE ? a.type : siProjPlanar;
  if (type === siProjLollipop) notAttested(app, a.command, 'the lollipop mapping; the spherical mapping is used', 'Q4');
  const first = ownerOf(usable[0])!;
  // ---- fit: bounding box of the components in the fitting frame (inferred reading of siTxtProjFitMethod; Q4)
  const world = a.fitting === siRelWorld || a.fitting === siRelWorldPosObject; const whole = a.fitting === siRelObject || a.fitting === siRelObjectPosObject;
  if (world) notAttested(app, a.command, 'the world-relative fitting methods; a world-aligned bounding box is used', 'Q4');
  const frame = world ? new THREE.Matrix4() : first.globalMatrix(); const toFrame = world ? null : frame.clone().invert();
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const it of usable) {
    const o = ownerOf(it)!; const m = meshOf(o)!; const { verts } = toPolys(m); const mat = toFrame ? toFrame.clone().multiply(o.globalMatrix()) : o.globalMatrix();
    for (const vi of vertsOfItem(whole ? o : it, m)) { const q = new THREE.Vector3(verts[vi][0], verts[vi][1], verts[vi][2]).applyMatrix4(mat); const c = [q.x, q.y, q.z]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], c[k]); mx[k] = Math.max(mx[k], c[k]); } }
  }
  if (!Number.isFinite(mn[0])) { for (let k = 0; k < 3; k++) { mn[k] = -1; mx[k] = 1; } }
  const parent = a.parent ?? app.scene.root; // inferred (Q1): scene root when no parent is passed
  const support = makeSupport(app, a.supportName, type, a.plane, parent, frame, mn, mx, a.visible);
  const kind = KIND_OF_TYPE[type]; const properties: Property[] = [];
  if (a.existing) {
    // ---- sub-projection: the input's samples of the existing property take the mapping through the new support
    const o = ownerOf(a.existing); const m = meshOf(o);
    if (o && m) {
      const cur = propertyUVs(o, a.existing)!; const next = Float32Array.from(cur);
      const proj = projectSamples(m, kind, support.globalMatrix().invert().multiply(o.globalMatrix())); const samples = new Set<number>();
      for (const it of usable) if (ownerOf(it) === o) for (const s of samplesOfItem(it, m)) samples.add(s);
      for (const s of samples) { next[s * 2] = proj[s * 2]; next[s * 2 + 1] = proj[s * 2 + 1]; }
      writeUVs(app, a.existing, next);
      const prop = a.existing as any; const oldSup = prop.supports ?? [], oldSub = prop.subprojections ?? [];
      const sub = { support, type, plane: a.plane, samples: [...samples] };
      app.record('Subprojection', () => { prop.supports = [...oldSup, support]; prop.subprojections = [...oldSub, sub]; }, () => { prop.supports = oldSup; prop.subprojections = oldSub; });
      properties.push(a.existing);
    }
  } else {
    const owners: X3DObject[] = []; for (const it of usable) { const o = ownerOf(it)!; if (!owners.includes(o)) owners.push(o); }
    for (const o of owners) properties.push(newUVProperty(app, o, a.propertyName || findUniqueTextureName([o], ''), kind, support)); // inferred: a component input still gets a property over the whole object
  }
  return { support, properties };
}

/** 3D objects with a mesh among the items (owning objects of clusters / sub-components are not included). */
function meshObjects(items: Item[]): X3DObject[] { return items.filter((it): it is X3DObject => it instanceof X3DObject && !!meshOf(it)); }

/** SICameraTextureProj(objects, name, camera) → { PropertyName, camera } or null. */
export function cameraTextureProj(app: App, command: string, items: Item[], name: string, cameraArg: any): { PropertyName: string; camera: X3DObject } | null {
  const objs = meshObjects(items); if (!objs.length) return null;
  let cam = resolveObject(app, cameraArg);
  if (cam && !(cam instanceof Camera)) cam = null;
  if (!cam) cam = [...app.scene.allObjects()].find(o => o instanceof Camera) ?? null; // inferred: with no camera passed, the first scene camera
  if (!cam) { notAttested(app, command, 'the camera used when none is passed and the scene has none; nothing created', 'Q4'); return null; }
  const prop = findUniqueTextureName(objs, name);
  for (const o of objs) newUVProperty(app, o, prop, 'Camera Projection', cam);
  return { PropertyName: prop, camera: cam };
}
/** SIConnectToSupport(objects, name, support) → { PropertyName, support } or null. */
export function connectToSupport(app: App, command: string, items: Item[], name: string, supportArg: any): { PropertyName: string; support: X3DObject } | null {
  const objs = meshObjects(items); const sup = resolveObject(app, supportArg);
  if (!sup || (sup as any).type !== 'texturesupport') { notAttested(app, command, 'what the task does without an existing texture support; nothing created', 'Q4'); return null; }
  if (!objs.length) return null;
  const kind = String((sup as any).projectionKind ?? 'Planar XY'); const known = KIND_ITEMS.some(k => k.value === kind);
  const type = (sup as any).projectionType as number | undefined;
  const prop = findUniqueTextureName(objs, name);
  for (const o of objs) newUVProperty(app, o, prop, type !== undefined ? KIND_OF_TYPE[type] : known ? kind : 'Planar XY', sup);
  return { PropertyName: prop, support: sup };
}
/** SICreateTextureSpatial(objects, name) → { PropertyName, CreatedObj } or null. */
export function createTextureSpatialTask(app: App, items: Item[], name: string): { PropertyName: string; CreatedObj: X3DObject | null } | null {
  const objs = meshObjects(items); if (!objs.length) return null;
  const prop = findUniqueTextureName(objs, name);
  for (const o of objs) newUVProperty(app, o, prop, 'Spatial', null);
  return { PropertyName: prop, CreatedObj: null }; // inferred: no support object is made for a spatial projection
}
/** SICreateTextureUVDomain(preset, objects, supportName, propertyName, visibility): UV-domain supports for surfaces. */
export function createTextureUVDomainTask(app: App, command: string, preset: string, items: Item[], supportName: string, propertyName: string, visible: boolean): { supports: X3DObject[]; properties: Property[] } {
  const out = { supports: [] as X3DObject[], properties: [] as Property[] };
  for (const it of items) {
    if (!(it instanceof X3DObject) || it.primitive?.type !== 'surfmsh' || !meshOf(it)) { notAttested(app, command, `a UV-domain support for ${itemText(it)} (not a NURBS surface); skipped`, 'Q4'); continue; }
    const sup = makeImplicit(app.scene.uniqueName(supportName || 'Texture_Support'), 'Square'); // inferred: default support name
    (sup as any).type = 'texturesupport'; (sup as any).projectionKind = 'UV'; (sup as any).preset = preset; sup.primitive!.set('size', 2);
    if (!visible) sup.property('visibility')?.set('viewvis', false);
    const parent = it; app.record('Texture Support', () => parent.addChild(sup), () => parent.removeChild(sup)); // inferred: the support is a child of its surface
    const p = newUVProperty(app, it, findUniqueTextureName([it], propertyName), 'UV', sup, false);
    out.supports.push(sup); out.properties.push(p);
  }
  return out;
}
/** SIGetTextureUVDomains(objects): the texture support objects used by the input. */
export function getTextureUVDomains(items: Item[]): X3DObject[] {
  const out: X3DObject[] = [];
  for (const it of items) {
    const o = ownerOf(it); if (!o) continue; // inferred: a cluster / property / sub-component stands for its object
    for (const p of uvPropertiesOf(o)) for (const s of supportsOfProperty(o, p)) if ((s as any).type === 'texturesupport' && !out.includes(s)) out.push(s);
  }
  return out;
}

// ------------------------------------------------------------------ contour stretching operator
/** The operators applied to a UV property (contour stretching). */
export function uvOperatorsOf(p: Property): Operator[] { return ((p as any).operators ?? []) as Operator[]; }
export function makeContourStretchingOp(preset: string): Operator {
  return new Operator(preset, preset, [int('method', 0, 'Method'), bool('maintainaspect', false, 'Maintain Aspect')]);
}
