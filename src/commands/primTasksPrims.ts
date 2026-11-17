// Ledger row CMD-B8e. Brief: docs/ghidra/cmd-b8e-primtasks-prims-binary.md, "Shared facts" and the "Wire contract"
// sections. Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   primitive getters  SIGetRigidCns SIGetPrimLight SIGetPrimCamera SIGetPrimSpotLight SIGetPrimLattice
//                      SIGetPrimVolumeDeform SIAssembleNurbsMesh ImportEPS
//   instancing         SIInstantiate GetMaster GetInstances
//   queries            GetURLAt GetNbTriangles
//   (SIAssignMaterial: primtasks.dll is not its implementer and its contract is unread; the earlier inferred
//    registration in viewEditPropertyMore.ts stays as the stand-in and is only checked here.)
//
// How the contract is mapped onto this build:
//  * `SIGetPrim` (preset, name, parent, add to scene) is the local `getPrim`: it builds this build's object for the
//    preset (light, camera, lattice, null) and adds it under the parent, or under the scene root.
//  * Output arguments: a command hands its output arguments (and its return value, as `Value`) back as a list that is
//    also keyed by argument name (the output-argument collection of a scripting caller). A command with only a
//    return value returns that value; "Value left unset" is `undefined`.
//  * Task status codes that are not failures (0, 1, 0x562e80c7) are kept in `app.primTasksPrims.lastStatus`; failure
//    statuses are thrown as SiStatusError. Message texts are not resolved (Q12): lines carry the id.
//  * Files live in the session's virtual host file system (src/core/sdkHelpersHostFs.ts).
// Earlier inferred registrations of SIInstantiate, GetMaster and GetInstances (viewEditProperty.ts) are replaced here.
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Model, Null, Camera, Light, Primitive, Cluster, Constraint, Operator, makeDisplay } from '../core/scene';
import * as S2 from '../core/scene2';
import { CurveData, V3 } from '../core/curves';
import type { CompSel } from '../core/topology';
import { hostFs, HOSTFS_SEP } from '../core/sdkHelpersHostFs';
import * as TP from '../core/textureProjectionScripts';
import { applyAssembleNurbs } from '../ui/assembleNurbsDialog';
import { SiStatusError } from './alembicSeqCam';
import { CNS_PRESETS } from './constraints';
import { FrozenGeomOperator } from './model';
import { findObject, masterOfInstance, buildInstance, attach, boolArg } from './viewEditPropertyHelpers';
import { outputs, registerPrimTasksTextureCommands } from './primTasksTexture';

export const NOTE = 'docs/ghidra/cmd-b8e-primtasks-prims-binary.md';
export const S_OK = 0, S_FALSE = 1, S_NOTE = 0x562e80c7;
export const E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057;

/** An object that can answer GetURLAt (the interface {6e7e58d0-...} of the contract). Seam: nothing in this build implements it. */
export interface UrlProvider { urlAt(view: number, x: number, y: number): string | null }
export interface PrimTasksPrimsState {
  lastStatus: { command: string; status: number } | null;
  /** Install root used for `<factory path>\Application\spdl\<FileName>.spdl`. */
  factoryPath: string;
  /** Objects created with AddToScene false (they are in no hierarchy). */
  transient: X3DObject[];
}
export const stateOf = (app: App): PrimTasksPrimsState => (app as any).primTasksPrims;

// ------------------------------------------------------------------ small helpers
const unset = (v: any) => v === undefined || v === null || v === '';
const text = (v: any) => (unset(v) ? '' : typeof v === 'string' ? v : v instanceof Node ? v.name : String(v));
const hex = (n: number) => '0x' + (n >>> 0).toString(16);
const msgId = (id: number) => `message ${hex(id)}; text not yet attested, Q12`;
function fail(status: number, what: string, id?: number): SiStatusError { return new SiStatusError(status, id === undefined ? what : `${what} (${msgId(id)})`); }
function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
function logNya(app: App, command: string, what: string, question = '') { app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`); }
/** Preset argument -> preset name ("Point.Preset", a path or a bare name); null when none is given. */
function presetOf(v: any): string | null {
  if (unset(v)) return null;
  const s = text(v).split(/[\\/]/).pop()!.replace(/\.preset$/i, '').replace(/_/g, ' ').trim();
  return s || null;
}
function requirePreset(C: string, v: any): string { const p = presetOf(v); if (!p) throw fail(E_POINTER, `${C}: no preset`); return p; }
/** An object argument (object or name) -> the 3D object, or null. */
function objectOf(app: App, v: any): X3DObject | null { return v instanceof X3DObject ? v : typeof v === 'string' && v.trim() ? findObject(app, v.trim()) ?? null : null; }
/** A list argument as raw items; an unset list stands for the selection (inferred: the collection argument handler). */
function rawList(app: App, arg: any): any[] {
  if (unset(arg)) return [...app.selection];
  return (Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg]).map((x: any) => (typeof x === 'string' ? findObject(app, x) ?? x : x));
}
function addToScene(app: App, o: X3DObject, parent: X3DObject | null) { const p = parent ?? app.scene.root; app.record(`Add ${o.name}`, () => { p.addChild(o); }, () => { p.removeChild(o); }); }
function setGlobalPosition(o: X3DObject, v: [number, number, number]) {
  const q = new THREE.Vector3(v[0], v[1], v[2]); if (o.parentObj) q.applyMatrix4(o.parentObj.globalMatrix().invert());
  const l = o.kinematics.local; l.set('posx', q.x); l.set('posy', q.y); l.set('posz', q.z);
}

// ------------------------------------------------------------------ SIGetPrim (shared sub-task)
/** The SIGetPrim sub-task: (preset, name, parent, add to scene 1) -> the 3D object; its primitive is `object.primitive`. */
function getPrim(app: App, C: string, preset: string, name: string, parent: X3DObject | null): X3DObject {
  let o: X3DObject;
  const lightKind = S2.LIGHT_PRESETS[preset] ?? (/^light$/i.test(preset) ? 'point' : undefined);
  // inferred: default object names (the name is used only when it is not empty; the preset's own default name is not in the contract)
  if (lightKind) {
    o = new Light(app.scene.uniqueName(name || preset.toLowerCase().replace(/ /g, '_')), lightKind === 'area' ? 'point' : lightKind);
    if (lightKind === 'area') o.primitive!.name = preset;
  } else if (preset === 'Camera' || preset in S2.CAMERA_PRESETS) {
    o = new Camera(app.scene.uniqueName(name || 'Camera'));
    if (preset in S2.CAMERA_PRESETS && S2.CAMERA_PRESETS[preset]) o.primitive!.set('fov', S2.CAMERA_PRESETS[preset]);
  } else if (/^lattice$/i.test(preset)) o = S2.makeLatticeObject(app.scene.uniqueName(name || 'lattice'));
  else if (/^null$/i.test(preset)) o = new Null(app.scene.uniqueName(name || 'null'));
  else {
    logNya(app, C, `the primitive of preset "${preset}" (not modelled in this build); a placeholder object carrying a primitive of that preset is created`);
    o = placeholder(app, name || preset, preset, preset.replace(/\s+/g, ''));
  }
  addToScene(app, o, parent);
  return o;
}
/** A locator-like object with a primitive node of the given type (for primitives this build does not draw). */
function placeholder(app: App, name: string, primName: string, type: string): X3DObject {
  const o = new Null(app.scene.uniqueName(name)); (o as any).type = type;
  o.setPrimitive(new Primitive(primName, type));
  return o;
}

// ------------------------------------------------------------------ camera / spot light template
const AIM = {
  Camera: { interestType: 'CameraInterest', position: [0, 2, 20] as [number, number, number] },
  Spot: { interestType: 'SpotInterest', position: [3, 3, 3] as [number, number, number] },
};
/** Steps 2 to 4 of the camera / spot template: the interest (a sibling of the main object), the direction constraint
 *  and the pose (main object at the class default position, interest at the origin, up (0, 1, 0)). */
function addInterest(app: App, C: string, kind: 'Camera' | 'Spot', main: X3DObject, interestName: string, parent: X3DObject | null): X3DObject {
  const d = AIM[kind];
  const interest = placeholder(app, interestName || d.interestType, `${kind} Interest`, d.interestType); // inferred: default interest name
  interest.addProperty(makeDisplay());
  addToScene(app, interest, parent);
  const cns = new Constraint('Direction Cns', 'dircns', CNS_PRESETS.Direction.defs(), [interest]); (cns as any).direction = [0, 0, -1];
  app.record('Apply Constraint', () => { main.addProperty(cns); }, () => { main.removeProperty(cns); });
  logNya(app, C, 'the constraint parameter with id 4 that the pose setup sets to true (name not resolved)', 'open question 4');
  setGlobalPosition(main, d.position); // F3DSetPoseFromLookat: the orientation follows from the direction constraint
  setGlobalPosition(interest, [0, 0, 0]);
  (main as any).lookat = { position: d.position, interest: [0, 0, 0], up: [0, 1, 0] };
  return interest;
}
function getPrimWithInterest(app: App, C: string, kind: 'Camera' | 'Spot', a: Record<string, any>): { main: X3DObject; interest: X3DObject } {
  const preset = requirePreset(C, a.PresetObj);
  const parent = objectOf(app, a.Parent); // the result is not checked: an absent or non-object value means "no parent"
  const main = getPrim(app, C, preset, text(a.Name), parent);
  const interest = addInterest(app, C, kind, main, text(a.InterestName), parent);
  return { main, interest };
}

// ------------------------------------------------------------------ deformer getters
function fitToInputs(inputs: X3DObject[]): THREE.Box3 {
  const bb = new THREE.Box3();
  for (const o of inputs) { const m = o.primitive?.mesh(); if (!m) continue; const M = o.globalMatrix(); for (let i = 0; i < m.positions.length; i += 3) bb.expandByPoint(new THREE.Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(M)); }
  return bb;
}
type DeformItem = X3DObject | Cluster;
/** Sub-component selections become clusters (cluster-creation tasks recorded), then the items an operator can connect
 *  to are kept. inferred: the deform operators connect to anything on an object with point geometry. */
function deformInputs(app: App, arg: any): { valid: DeformItem[]; rejected: number } {
  const given = TP.resolveItems(app, arg, false); const valid: DeformItem[] = []; let rejected = 0;
  for (const it of given) {
    let item: any = it;
    if (TP.isSubComponent(it)) {
      const c = new Cluster(TP.uniqueClusterName(it.obj, it.compKind === 'pnt' ? 'Point' : it.compKind === 'poly' ? 'Polygon' : it.compKind === 'edge' ? 'Edge' : 'Sample'), it.compKind, new Set<number | string>(it.elements)); const o = it.obj;
      app.record('Create Cluster', () => o.addCluster(c), () => o.removeCluster(c)); item = c;
    }
    const owner = TP.ownerOf(item);
    if ((item instanceof X3DObject || item instanceof Cluster) && owner && owner.primitive?.mesh()) valid.push(item); else rejected++;
  }
  return { valid, rejected };
}
function selOf(it: DeformItem): CompSel | null {
  if (!(it instanceof Cluster)) return null;
  const indices = TP.elementsOf(it);
  return it.compKind === 'pnt' ? { kind: 'point', indices } : it.compKind === 'poly' ? { kind: 'polygon', indices } : null; // inferred: other cluster kinds deform the whole object
}
function applyRefDeform(app: App, preset: 'by Lattice' | 'by Volume', it: DeformItem, ref: X3DObject): Operator | null {
  const o = TP.ownerOf(it)!; const prim = o.primitive!; const op = S2.makeRefDeformOperator(preset, [ref], () => o, selOf(it));
  if (!op) return null;
  app.record(`Deform ${preset}`, () => prim.addOperator(op), () => prim.removeOperator(op));
  return op;
}

// ------------------------------------------------------------------ ImportEPS: path reader
interface EpsPath { segments: { kind: 'line' | 'curve'; pts: [number, number][] }[]; start: [number, number]; closed: boolean }
/** Reads path construction operators. Which operators the two parser passes of the contract understand is not read;
 *  this reader takes the path operators documented in the PostScript Language Reference (moveto, lineto, curveto,
 *  closepath) and their Adobe Illustrator file format short forms (m, l/L, c/C, v/V, y/Y; s and b close the path). */
function readEpsPaths(source: string): EpsPath[] {
  const paths: EpsPath[] = []; let cur: EpsPath | null = null; let at: [number, number] = [0, 0]; const stack: number[] = [];
  const take = (n: number): number[] | null => (stack.length >= n ? stack.splice(stack.length - n, n) : null);
  for (const line of source.split(/\r?\n/)) {
    const code = line.replace(/%.*$/, '');
    for (const tok of code.split(/\s+/).filter(Boolean)) {
      if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(tok)) { stack.push(Number(tok)); continue; }
      switch (tok) {
        case 'moveto': case 'm': { const p = take(2); if (p) { at = [p[0], p[1]]; cur = { segments: [], start: at, closed: false }; paths.push(cur); } break; }
        case 'lineto': case 'l': case 'L': { const p = take(2); if (p && cur) { cur.segments.push({ kind: 'line', pts: [at, [p[0], p[1]]] }); at = [p[0], p[1]]; } break; }
        case 'curveto': case 'c': case 'C': { const p = take(6); if (p && cur) { cur.segments.push({ kind: 'curve', pts: [at, [p[0], p[1]], [p[2], p[3]], [p[4], p[5]]] }); at = [p[4], p[5]]; } break; }
        case 'v': case 'V': { const p = take(4); if (p && cur) { cur.segments.push({ kind: 'curve', pts: [at, at, [p[0], p[1]], [p[2], p[3]]] }); at = [p[2], p[3]]; } break; }
        case 'y': case 'Y': { const p = take(4); if (p && cur) { cur.segments.push({ kind: 'curve', pts: [at, [p[0], p[1]], [p[2], p[3]], [p[2], p[3]]] }); at = [p[2], p[3]]; } break; }
        case 'closepath': case 's': case 'b': if (cur) { cur.closed = true; at = cur.start; } stack.length = 0; break;
        default: stack.length = 0; // any other operator consumes its operands
      }
    }
  }
  return paths.filter(p => p.segments.length > 0);
}
/** One sub-path as a curve: a polyline when it has only lines, else a cubic made of Bezier spans (knots of multiplicity 3). */
function epsCurve(path: EpsPath, map: (p: [number, number]) => V3): CurveData {
  const segs = [...path.segments]; const last = segs[segs.length - 1].pts; const end = last[last.length - 1];
  if (path.closed && (end[0] !== path.start[0] || end[1] !== path.start[1])) segs.push({ kind: 'line', pts: [end, path.start] });
  if (segs.every(s => s.kind === 'line')) {
    const pts = [segs[0].pts[0], ...segs.map(s => s.pts[1])].map(map); const n = pts.length;
    return { degree: 1, closed: false, cvs: pts.map(p => [p[0], p[1], p[2], 1]), knots: [0, ...Array.from({ length: n }, (_, i) => i), n - 1] };
  }
  const cvs: [number, number][] = [segs[0].pts[0]];
  for (const s of segs) {
    if (s.kind === 'curve') cvs.push(s.pts[1], s.pts[2], s.pts[3]);
    else { const [a, b] = s.pts; cvs.push([a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + 2 * (b[0] - a[0]) / 3, a[1] + 2 * (b[1] - a[1]) / 3], b); }
  }
  const knots = [0, 0, 0, 0]; for (let i = 1; i < segs.length; i++) knots.push(i, i, i); knots.push(segs.length, segs.length, segs.length, segs.length);
  return { degree: 3, closed: false, cvs: cvs.map(map).map(p => [p[0], p[1], p[2], 1]), knots };
}

// ------------------------------------------------------------------ registration
export function registerPrimTasksPrimsCommands(app: App) {
  const st: PrimTasksPrimsState = { lastStatus: null, factoryPath: 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2', transient: [] };
  (app as any).primTasksPrims = st;
  const reg = (def: CommandDef) => app.register(def);

  reg({
    name: 'SIGetRigidCns', label: 'Get Rigid Constraint', category: 'Primitive',
    description: 'Creates a primitive from a preset (a rigid constraint object), optionally with a SPDL file, optionally added to the scene.',
    args: [{ name: 'PresetObj', default: null }, { name: 'FileName', default: '' }, { name: 'Name', default: '' }, { name: 'Parent', default: null }, { name: 'AddToScene', default: true }, { name: 'Value', default: null }, { name: 'Primitive', default: null }],
    execute(app, a) {
      const C = 'SIGetRigidCns'; const preset = requirePreset(C, a.PresetObj);
      const fileName = text(a.FileName); const name = text(a.Name) || fileName;
      // DSCreateObjectFromPreset + F3DCreate3DObjectFromPrimitive. inferred: with no name at all the object takes the preset's name
      const o = placeholder(app, name || preset, preset, preset.replace(/\s+/g, '')); (o as any).preset = preset; o.addProperty(makeDisplay());
      const prim = o.primitive!;
      logNya(app, C, `the primitive class behind preset "${preset}" (rigid constraint primitives are not modelled in this build); a placeholder object carrying a primitive of that preset is created`);
      if (fileName) {
        const dir = [st.factoryPath, 'Application', 'spdl'].join(HOSTFS_SEP);
        hostFs.ensureFolder(dir); // the spdl directory is created if it does not exist
        (prim as any).spdlFile = dir + HOSTFS_SEP + fileName + '.spdl';
        logNya(app, C, 'what the primitive does with the SPDL path (writes the file or only registers it); the path is recorded on the primitive', 'open question 1');
      }
      if (boolArg(a.AddToScene)) addToScene(app, o, objectOf(app, a.Parent)); else st.transient.push(o);
      setStatus(app, C, S_OK);
      return outputs({ Value: o, Primitive: prim });
    },
  });

  reg({
    name: 'SIAssembleNurbsMesh', label: 'Assemble Nurbs Mesh', category: 'Modeling|Generator', description: 'Build SCM Topology',
    args: [{ name: 'InputObj', default: null }, { name: 'Tolerance', default: 0.15 }, { name: 'CopyUserCluster', default: false }, { name: 'CopyMaterial', default: false }, { name: 'CenterGeomCenter', default: true }, { name: 'OutputObj', default: null }],
    execute(app, a) {
      const C = 'SIAssembleNurbsMesh';
      // input filter: whole objects (a surface sub-component item is not modelled in this build) that yield NURBS surface mesh geometry
      const inputs: X3DObject[] = []; for (const x of rawList(app, a.InputObj)) if (x instanceof X3DObject && (x.primitive?.type ?? x.type) === 'surfmsh' && !inputs.includes(x)) inputs.push(x);
      setStatus(app, C, S_OK);
      if (!inputs.length) return outputs({ OutputObj: null }); // nothing is created
      logNya(app, C, 'the assembly itself and its three follow-up stages (cluster copy, material copy, centring); the surface-mesh merge of this build is used with the same four options', 'open question 2');
      const before = new Set(app.scene.allObjects()); const savedSelection = [...app.selection];
      app.select(inputs);
      applyAssembleNurbs(app, { toleranceText: String(Number(a.Tolerance)), copyClusters: boolArg(a.CopyUserCluster), copyMats: boolArg(a.CopyMaterial), center: boolArg(a.CenterGeomCenter) });
      const made = [...app.scene.allObjects()].filter(o => !before.has(o));
      const obj = made.find(o => (o.primitive?.type ?? o.type) === 'surfmsh') ?? made[0] ?? null;
      app.select(savedSelection.filter(n => !(n instanceof X3DObject) || n.parentObj !== null || n === app.scene.root)); // the task does not select
      return outputs({ OutputObj: obj });
    },
  });

  reg({
    name: 'SIGetPrimLight', label: 'Get Light', category: 'Primitive|Rendering', description: 'Creates a light from a preset; a spot light also gets its interest.',
    args: [{ name: 'PresetObj', default: null }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { name: '3DObject', default: null }, { name: '3DObjSpotInterest', default: null }, { name: 'PrimObj', default: null }, { name: 'PrimObjSpotInterest', default: null }],
    execute(app, a) {
      const C = 'SIGetPrimLight'; const preset = requirePreset(C, a.PresetObj); const name = text(a.Name);
      let parent: X3DObject | null = null;
      if (!unset(a.Parent)) { parent = objectOf(app, a.Parent); if (!parent) throw fail(E_FAIL, `${C}: no object named ${text(a.Parent)}`); } // a failed lookup aborts (inferred: the status)
      const light = getPrim(app, C, preset, name, parent);
      let interest: X3DObject | null = null;
      // parameter id 2 with value 2 (inferred: light type = spot)
      if (Number(light.primitive?.val('Type')) === 2) interest = addInterest(app, C, 'Spot', light, name + '_Interest', parent);
      setStatus(app, C, S_OK);
      return outputs({ '3DObject': light, '3DObjSpotInterest': interest, PrimObj: light.primitive, PrimObjSpotInterest: interest?.primitive ?? null });
    },
  });

  reg({
    name: 'SIGetPrimCamera', label: 'Get Camera', category: 'Primitive', description: 'Creates a camera and its interest from a preset.',
    args: [{ name: 'PresetObj', default: null }, { name: 'Name', default: '' }, { name: 'InterestName', default: '' }, { name: 'Parent', default: null },
      { name: '3DObjCamera', default: null }, { name: '3DObjCameraInterest', default: null }, { name: 'PrimObjCamera', default: null }, { name: 'PrimObjCameraInterest', default: null }],
    execute(app, a) {
      const C = 'SIGetPrimCamera'; const { main, interest } = getPrimWithInterest(app, C, 'Camera', a);
      // the three output-format preferences copied onto the camera primitive; the parameters are known by GUID only
      const prefs = (app as any).prefValues ?? {}; const prefOf = (k: string) => { const hit = Object.keys(prefs).find(x => x.toLowerCase() === k); return hit === undefined ? undefined : prefs[hit]; };
      const prim = main.primitive!; let copied = 0;
      for (const [key, param] of [['output_format.picture_ratio', 'aspect'], ['output_format.roto_pixel_ratio', 'pixelratio'], ['output_format.picture_standard', 'std']] as const) { // inferred: the parameter behind each GUID
        const v = prefOf(key); const p = prim.get(param); if (v === undefined || !p) continue;
        app.setParam(p, Number(v), 'SetValue'); copied++;
      }
      if (copied < 3) logNya(app, C, `the camera parameters that receive the output-format preferences (known by GUID only); ${copied} of 3 copied`, 'step 5');
      (prim as any).lookat = (main as any).lookat; // the look-at triple pushed into the camera primitive
      setStatus(app, C, S_OK);
      return outputs({ '3DObjCamera': main, '3DObjCameraInterest': interest, PrimObjCamera: prim, PrimObjCameraInterest: interest.primitive });
    },
  });

  reg({
    name: 'SIGetPrimSpotLight', label: 'Spot Light', category: 'Primitive|Rendering', description: 'Creates a spot light and its interest from a preset.',
    args: [{ name: 'PresetObj', default: null }, { name: 'Name', default: '' }, { name: 'InterestName', default: '' }, { name: 'Parent', default: '' },
      { name: '3DObjSpot', default: null }, { name: '3DObjSpotInterest', default: null }, { name: 'PrimObjSpot', default: null }, { name: 'PrimObjSpotInterest', default: null }],
    execute(app, a) {
      const C = 'SIGetPrimSpotLight'; const { main, interest } = getPrimWithInterest(app, C, 'Spot', a);
      setStatus(app, C, S_OK);
      return outputs({ '3DObjSpot': main, '3DObjSpotInterest': interest, PrimObjSpot: main.primitive, PrimObjSpotInterest: interest.primitive });
    },
  });

  const DEFORMER_ARGS = [{ name: 'PresetObj', default: null }, { name: 'InputObjs', default: null }, { name: 'Name', default: '' }, { name: 'Parent', default: null }, { name: 'PrimObj', default: null }];
  reg({
    name: 'SIGetPrimLattice', label: 'Get lattice', category: 'Primitive|Deformation', description: 'Creates a lattice; with inputs it is fitted to them and deforms them.',
    args: DEFORMER_ARGS,
    execute(app, a) {
      const C = 'SIGetPrimLattice'; const preset = requirePreset(C, a.PresetObj);
      const given = !unset(a.InputObjs); let valid: DeformItem[] = [];
      setStatus(app, C, S_OK);
      if (given) {
        const f = deformInputs(app, a.InputObjs); valid = f.valid;
        // (a failing filter, 0x80004005 with message 0x2e, has no counterpart here: the filter of this build only rejects)
        if (f.rejected) { app.logMsg('info', `${C}: ${f.rejected} input item(s) cannot be deformed by a lattice (${msgId(0x2d)})`); setStatus(app, C, S_FALSE); }
      }
      const lattice = getPrim(app, C, preset, text(a.Name), null); // no parent at creation
      if (valid.length) {
        // the lattice primitive is given the inputs first. inferred: it is fitted to them (the arguments of that call were not read: Q5)
        const bb = fitToInputs([...new Set(valid.map(it => TP.ownerOf(it)!))]); const g = lattice.primitive!.operators[0];
        if (!bb.isEmpty() && g) {
          const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
          g.set('sizex', Math.max(0.01, s.x)); g.set('sizey', Math.max(0.01, s.y)); g.set('sizez', Math.max(0.01, s.z)); setGlobalPosition(lattice, [c.x, c.y, c.z]);
        }
        for (const it of valid) applyRefDeform(app, 'by Lattice', it, lattice); // connection set {input, lattice object}
      }
      const parent = objectOf(app, a.Parent);
      // with no InputObjs at all the parent is ignored; a reference object is not a valid parent (no references in this build)
      if (given && parent) { const world = lattice.globalMatrix(); const old = lattice.parentObj!; app.record('Parent', () => { parent.addChild(lattice); }, () => { old.addChild(lattice); }); const p = new THREE.Vector3().setFromMatrixPosition(world); setGlobalPosition(lattice, [p.x, p.y, p.z]); }
      return outputs({ PrimObj: lattice.primitive, Value: lattice });
    },
  });

  reg({
    name: 'SIGetPrimVolumeDeform', label: 'Get Volume Deform', category: 'Primitive|Deformation', description: 'Creates a volume deform control object; with inputs it deforms them.',
    args: DEFORMER_ARGS,
    execute(app, a) {
      const C = 'SIGetPrimVolumeDeform'; const preset = requirePreset(C, a.PresetObj);
      setStatus(app, C, S_OK);
      // (UnPackArg passes the list through a list-conversion service first; inferred to expand the selection, not modelled)
      const f = unset(a.InputObjs) ? { valid: [] as DeformItem[], rejected: 0 } : deformInputs(app, a.InputObjs);
      if (f.rejected) { app.logMsg('info', `${C}: ${f.rejected} input item(s) cannot take the volume deform operator (${msgId(0x29)})`); setStatus(app, C, S_FALSE); }
      // inferred: the volume control of this build is a locator (ApplyPropVolumeOp); it carries a primitive node of the preset
      const volume = placeholder(app, text(a.Name) || 'volume', preset, 'volumedeform'); (volume as any).type = 'null'; volume.addProperty(makeDisplay());
      addToScene(app, volume, objectOf(app, a.Parent)); // here the parent is honoured at creation
      const created: Operator[] = [];
      if (f.valid.length) {
        logNya(app, C, 'the helper sub-task that receives the primitive and the inputs (presumably sizing the volume to them); the volume keeps its default pose and size', 'open question 6');
        for (const it of f.valid) { const op = applyRefDeform(app, 'by Volume', it, volume); if (op) created.push(op); } // the PropVolume command preset, connection set {input, volume object}
        if (created.length) {
          if (app.commands.has('InitPropVolume')) app.run('InitPropVolume', { InputObjs: created });
          else logNya(app, C, 'InitPropVolume (not on the command bus); the created volume properties are left as created');
        }
      }
      return outputs({ PrimObj: volume.primitive, Value: volume });
    },
  });

  reg({
    name: 'SIInstantiate', label: 'Low Level Instantiate Command', category: 'Edit', description: 'Creates instances of the input models',
    args: [{ name: 'InputObjs', default: null }, { name: 'NbItems', default: 1 }, { name: 'Name', default: '' }],
    execute(app, a) {
      const C = 'SIInstantiate'; const n = Number(a.NbItems);
      if (!Number.isFinite(n) || n < 1) throw fail(E_INVALIDARG, `${C}: NbItems ${a.NbItems}`);
      // input filter: non-models are dropped, an instance is replaced by its master
      const masters: Model[] = []; for (const x of rawList(app, a.InputObjs)) if (x instanceof Model && x !== app.scene.root) masters.push(masterOfInstance(x) ?? x);
      if (!masters.length) { app.logMsg('error', `${C}: ${msgId(0x1c)}`); throw fail(E_FAIL, `${C}: the input is not a model`, 0x1c); }
      const made: Model[] = []; const name = text(a.Name);
      for (const master of masters) {
        const parent = master.parentObj ?? app.scene.root; // the instances go under the master's parent
        for (let i = 0; i < Math.trunc(n); i++) { const inst = buildInstance(app, master, name || undefined); attach(app, inst, parent, C); made.push(inst); } // name: Name, or <master name>_Instance
      }
      logNya(app, C, 'the property {11ebe301-...} added to each instance with four boolean parameters set to true, and the two binding tasks (names not resolved); the instance points at its master through `instanceMaster`', 'open question 7');
      setStatus(app, C, S_OK);
      return made;
    },
  });

  reg({
    name: 'GetMaster', label: 'Find Master of Instance Command', category: 'Edit', description: 'Returns the master model of the first input when it is an instance', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const C = 'GetMaster'; const first = rawList(app, a.InputObjs)[0];
      if (first === undefined) throw fail(E_INVALIDARG, `${C}: empty input list`, 0x3fc);
      setStatus(app, C, S_OK);
      return first instanceof X3DObject ? masterOfInstance(first) ?? undefined : undefined; // not an instance: Value is left unset
    },
  });

  reg({
    name: 'GetInstances', label: 'Get Instances of Master Command', category: 'Edit', description: 'Returns the instances of the first input when it is a master model', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const C = 'GetInstances'; const first = rawList(app, a.InputObjs)[0];
      if (first === undefined) throw fail(E_INVALIDARG, `${C}: empty input list`, 0x3fc);
      setStatus(app, C, S_OK);
      if (!(first instanceof Model)) return undefined;
      // the first owner relation of kind 2 (inferred: the instance group of the master); none = nothing written back
      const instances = [...app.scene.allObjects()].filter(o => masterOfInstance(o) === first);
      return instances.length ? instances : undefined;
    },
  });

  reg({
    name: 'GetURLAt', label: 'Get URL At', category: 'Primitive', description: 'The URL an object shows at a view position.', undoable: false,
    args: [{ name: 'InputObjs', default: null }, { name: 'View', default: 0 }, { name: 'X', default: -1 }, { name: 'Y', default: -1 }],
    execute(app, a) {
      const C = 'GetURLAt'; const short = (v: any) => (Math.trunc(Number(v) || 0) << 16) >> 16; // low 16 bits, sign-extended (width as read; unverified, Q9)
      const items = rawList(app, a.InputObjs);
      if (!items.length) { setStatus(app, C, S_NOTE); return ''; }
      // the URL interface is looked for on the item itself, then on the primitive of the item's object
      const providers: UrlProvider[] = [];
      for (const it of items) { const p = typeof it?.urlAt === 'function' ? it : it instanceof X3DObject && typeof (it.primitive as any)?.urlAt === 'function' ? it.primitive : null; if (p) providers.push(p as UrlProvider); }
      if (!providers.length) throw fail(E_FAIL, `${C}: none of the inputs can answer a URL request`);
      setStatus(app, C, S_OK);
      for (const p of providers) { const url = p.urlAt(short(a.View), short(a.X), short(a.Y)); if (typeof url === 'string') return url; } // the first one that answers
      return '';
    },
  });

  reg({
    name: 'ImportEPS', label: 'Import EPS File', category: 'File', description: 'Import an EPS file into the scene as a curvelist object',
    args: [{ name: 'FileName', default: null }, { name: 'Parent', default: null }, { name: 'UpdateSelection', default: true }, { name: 'Value', default: null }],
    execute(app, a) {
      const C = 'ImportEPS'; const file = text(a.FileName);
      let source: string;
      try { source = hostFs.readFile(file); } catch { setStatus(app, C, S_FALSE); return outputs({ Value: null }); } // cannot be opened: status 1, no message, nothing created
      logNya(app, C, 'the two parser passes and the curve builder (which operators are understood, degree and closing of the curves); the documented PostScript / Illustrator path operators are read, lines become polylines and curves cubic Bezier spans', 'open question 10');
      const paths = readEpsPaths(source);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of paths) for (const s of p.segments) for (const q of s.pts) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
      // name: the file name without directory, a trailing .eps / .ai removed (any case)
      const name = file.split(/[\\/]/).pop()!.replace(/\.(eps|ai)$/i, '');
      const o = new X3DObject(app.scene.uniqueName(name), 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist');
      // scale 0.05, offset (-(minX+maxX)/2, -(minY+maxY)/2): the drawing is centred on the origin. inferred: in the XY plane
      const ox = -(minX + maxX) / 2, oy = -(minY + maxY) / 2; const map = (p: [number, number]): V3 => [(p[0] + ox) * 0.05, (p[1] + oy) * 0.05, 0];
      const curves = paths.map(p => epsCurve(p, map));
      prim.addOperator(new FrozenGeomOperator(curves.length ? { ...curves[0], subcurves: curves.slice(1) } : null, 'Curve'));
      o.setPrimitive(prim); o.addProperty(makeDisplay());
      addToScene(app, o, objectOf(app, a.Parent));
      app.select([o]); // selected whatever UpdateSelection says
      setStatus(app, C, S_OK);
      return outputs({ Value: o });
    },
  });

  reg({
    name: 'GetNbTriangles', label: 'Get Number Of Triangles', category: '', description: 'The number of triangles of the input geometry.', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const C = 'GetNbTriangles'; const items = rawList(app, a.InputObjs);
      // SIValidateObjects(list, "geometry"): the items that are geometry
      const valid = items.filter((x): x is X3DObject => x instanceof X3DObject && !!x.primitive?.mesh());
      if (!valid.length) { app.logMsg('info', `${C}: no geometry in the input (${msgId(0x4b)})`); setStatus(app, C, S_NOTE); return 0; } // returns without counting
      if (valid.length < items.length) { app.logMsg('info', `${C}: some input items are not geometry (${msgId(0x4b)})`); setStatus(app, C, S_FALSE); } else setStatus(app, C, S_OK);
      let count = 0; for (const o of new Set(valid)) for (const f of o.primitive!.mesh()!.polygons) count += Math.max(0, f.length - 2);
      return count;
    },
  });
}

/** Rows CMD-B8d and CMD-B8e: the texture and primitive task commands of primtasks.dll (the single entry main.ts calls). */
export function registerPrimTasksCommands(app: App) {
  registerPrimTasksTextureCommands(app);
  registerPrimTasksPrimsCommands(app);
}
