// Ledger rows CMD-B18b / CMD-B18c (Face Robot JScript plug-ins PreparationTools.js, GameExport_EyelidTools.js,
// LipSynch.js, Tongue.js): helpers shared by src/commands/faceRobotB18b.ts and faceRobotB18c.ts.
// Briefs: docs/ghidra/cmd-b18b-fr-preparation-eyelid-scripts.md, docs/ghidra/cmd-b18c-fr-lipsynch-tongue-scripts.md,
// docs/ghidra/cmd-b18d-fr-small-scripts.md §2-3 (the MeshHelper.js polymesh helper and the keyword match rule) and
// docs/re/WIRE_CORRECTIONS_B18.md items 1, 2, 3, 8, 11. Original code written from that prose only; no golden exists.
//
// Mapping onto this build:
//  * Row state lives in `rowState(app, 'B18bc')` of the shared Face Robot store (faceRobotB14Shared.ts).
//  * A JScript runtime error that the notes infer is thrown as an Error whose message starts with the command name.
//  * siError log lines are logged with kind 'error', siWarning / siInfo lines with kind 'info' (text verbatim).
//  * Environment variables FACEROBOTROOT / FACEROBOTDATAROOT come from `state.env` (empty by default: this build has no
//    install folder; the folder helpers then report "Folder not found" as the scripts do).
//  * Interactive parts go through `state.hooks`: `pick` (PickPosition), `modal` (a modal InspectObj; default Cancel),
//    `cancelProgress` (progress bar cancel button). Message boxes use the shared FR `msgBox` (default button answers).
//  * Branches the notes leave open log "<command>: not yet attested: <what> (<row>)".
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property, Model, Cluster, Operator, Group } from '../core/scene';
import { Parameter, ParamDef } from '../core/params';
import {
  rowState, frStore, entryObject, findByName, propNamed, addProperty, addObject, logNya, unset, listOf, hostFs, isInScene,
  faceModel as frFaceModelB14, objArg,
} from './faceRobotB14Shared';
import { keywordsOf } from './faceRobotB14deShared';

export const ROW_B = 'CMD-B18b', ROW_C = 'CMD-B18c';
export const CAT = 'Custom';

export interface B18State {
  env: { FACEROBOTROOT: string; FACEROBOTDATAROOT: string; project: string };
  hooks: {
    /** PickPosition: return { button, pos } (button 0 = right click / cancel). Without a hook the pick is cancelled. */
    pick?: (index: number) => { button: number; pos: [number, number, number] } | null | undefined;
    /** Modal InspectObj (siModal): true = OK. Without a hook the dialog is cancelled. */
    modal?: (prop: Property) => boolean | undefined;
    /** Progress bar cancel test, called at every checkpoint with the caption. */
    cancelProgress?: (caption: string) => boolean | undefined;
  };
  /** Snapping preferences as set by the pick loop (stand-in for preferences.Snapping.*). */
  snapping: Record<string, number>;
  /** The MeshHelper.js plug-in-global cached helper (cmd-b18d §2.1); starts as an empty object. */
  helper: any;
  /** PreparationTools.js plug-in-global eye-socket collection (not reset between runs). */
  sockets: any[];
  /** Property pages inspected (newest last) with their mode. */
  inspected: { prop: Property; mode: string }[];
  /** SetValue targets this build has no object for (name -> value), e.g. clustershapecombiner.SoloIndex. */
  values: Record<string, any>;
  /** Commands run by the scripts (name + args), newest last. */
  calls: { name: string; args: Record<string, any> }[];
  /** Progress bar records. */
  progress: { caption: string; max: number; status: string[]; visible: boolean }[];
}
export function b18(app: App): B18State {
  return rowState<B18State>(app, 'B18bc', () => ({
    env: { FACEROBOTROOT: '', FACEROBOTDATAROOT: '', project: '' },
    hooks: {}, snapping: { Enable: 0, Enable0D: 1, Enable1D: 0, Enable2D: 0, EnableGrid: 0, Faces: 0, Surfaces: 0, IgnoreBackfacing: 0 },
    helper: {}, sockets: [], inspected: [], values: {}, calls: [], progress: [],
  }));
}
export const nyaB = (app: App, C: string, what: string) => logNya(app, C, what, ROW_B);
export const nyaC = (app: App, C: string, what: string) => logNya(app, C, what, ROW_C);
export const siError = (app: App, text: string) => app.logMsg('error', text);
export const siInfo = (app: App, text: string) => app.logMsg('info', text);
/** A JScript runtime error the note infers (the command ends with a script error). */
export const scriptError = (C: string, what: string) => new Error(`${C}: script error: ${what}`);

// ------------------------------------------------------------------ command calls
/** Run another command the way a script does; a missing command or a failure is logged and gives undefined. */
export function call(app: App, name: string, args: Record<string, any> = {}): any {
  b18(app).calls.push({ name, args });
  if (!app.commands.has(name)) { app.logMsg('info', `${name}: command not available in this build`); return undefined; }
  try { return app.run(name, args); } catch (e: any) { app.logMsg('info', `${name} failed: ${e?.message ?? e}`); return undefined; }
}
/** Run another command; failures propagate (the caller's try/catch decides). */
export function callStrict(app: App, name: string, args: Record<string, any> = {}): any {
  b18(app).calls.push({ name, args });
  if (!app.commands.has(name)) throw new Error(`${name}: command not available in this build`);
  return app.run(name, args);
}

// ------------------------------------------------------------------ objects, properties
export function inspect(app: App, prop: Property, mode = 'siLock') {
  b18(app).inspected.push({ prop, mode });
  app.events.emit('inspect', prop);
}
/** Modal InspectObj: true when the user pressed OK. */
export function inspectModal(app: App, prop: Property): boolean {
  b18(app).inspected.push({ prop, mode: 'siModal' });
  const ok = b18(app).hooks.modal?.(prop);
  if (ok === undefined) app.logMsg('info', `${prop.name}: modal dialog cancelled (no answer in this build)`);
  return !!ok;
}
export function newProp(name: string, defs: ParamDef[]): Property { return new Property(name, 'customparamset', defs); }
/** Get-or-add a custom property (§2 of cmd-b18c); with `doInspect` the page is opened with siLock. */
export function getOrAddProp(app: App, parent: X3DObject, name: string, defs: () => ParamDef[], doInspect = false): Property {
  const p = propNamed(parent, name) ?? addProperty(app, parent, newProp(name, defs()));
  if (doInspect) inspect(app, p);
  return p;
}
/** Add a parameter to an existing property when it is missing (undoable). */
export function ensureParam(app: App, prop: Property, def: ParamDef): Parameter {
  const have = prop.get(def.name); if (have) return have;
  let made: Parameter | null = null;
  app.record('AddParameter', () => { made = prop.add(def); }, () => { if (made) prop.removeParam(made); });
  return made!;
}
export function setVal(app: App, prop: Property | null | undefined, name: string, v: any) { const q = prop?.get(name); if (q) app.setParam(q, v); }
export function newModel(app: App, name: string, parent?: X3DObject | null): Model { const m = new Model(name); addObject(app, m, parent ?? null); return m; }
export const isPolymesh = (o: any): o is X3DObject => o instanceof X3DObject && o.type === 'polymsh';
export function objOrName(app: App, v: any): X3DObject | null { if (v instanceof X3DObject) return isInScene(app, v) ? v : null; return objArg(app, v); }
/** SetValue on a target this build may not model: run SetValue when it resolves, always record the value. */
export function setValue(app: App, target: string, value: any) {
  b18(app).values[target] = value;
  b18(app).calls.push({ name: 'SetValue', args: { Target: target, Value: value } });
}
export function addCluster(app: App, obj: X3DObject, name: string, kind: 'pnt' | 'edge' | 'poly', elements: Iterable<number | string>, complete = false): Cluster {
  const c = new Cluster(name, kind, new Set(elements)); if (complete) c.set('alwayscomplete', true);
  app.record('AddCluster ' + name, () => obj.addCluster(c), () => obj.removeCluster(c));
  return c;
}
export function addClusterProp(app: App, c: Cluster, p: Property) { app.record('AddProp ' + p.name, () => c.addProperty(p), () => c.removeProperty(p)); return p; }

// ------------------------------------------------------------------ keywords (cmd-b18d §3, FilterKeyed rule)
/** GetKeyed(keys, model): descendants of the model (face model when empty) that have at least one keyword and every key. */
export function getKeyedIn(app: App, keys: string[], model?: X3DObject | null): X3DObject[] {
  const m = model ?? faceModelB18(app, 'GetKeyed', true);
  if (!m) return [];
  const out: X3DObject[] = [];
  for (const o of m.descendants()) { const k = keywordsOf(o); if (k.length && keys.every(w => k.includes(w))) out.push(o); }
  return out;
}

// ------------------------------------------------------------------ face model / meshes / controls (§2 of cmd-b18c)
/** Face-model lookup: fr_GetFaceModel(); when the command throws, the error line and the scene-root model `Face`
 *  (created when missing). An empty result is used as is (null). */
export function faceModelB18(app: App, C: string, quiet = false): X3DObject | null {
  void C; void quiet;
  try {
    if (!app.commands.has('fr_GetFaceModel')) throw new Error('missing');
    const m = app.run('fr_GetFaceModel', {});
    return m instanceof X3DObject ? m : null;
  } catch {
    siError(app, 'Face Robot FR.dll Failed to load properly. Command("fr_GetFaceModel") was not recognized!');
    let f = app.scene.root.children.find(c => c instanceof Model && c.name === 'Face') ?? null;
    if (!f) f = newModel(app, 'Face');
    return f;
  }
}
/** fr_sget("FaceModel") as an object (the registry value, else the B14 face-model rule). */
export function sgetFaceModel(app: App): X3DObject | null { return entryObject(app, '_', 'FaceModel') ?? frFaceModelB14(app); }
/** fr_sget("meshes", key) as an object. */
export const sgetMesh = (app: App, key: string) => entryObject(app, 'meshes', key);
/** Face mesh lookup (LipSynch.js). */
export function faceMeshB18(app: App, model: X3DObject | null): X3DObject | null {
  if (model) {
    const k = getKeyedIn(app, ['Face', 'Mesh'], model)[0]; if (k) return k;
    const fc = propNamed(model, 'FaceConnections'); const n = fc ? String(fc.val('Mesh') ?? '') : '';
    if (n) { const o = [...model.descendants()].find(c => c.name === n || c.fullName === n || `${model.name}.${c.name}` === n) ?? null; if (isPolymeshObj(o)) return o; }
  }
  return sgetMesh(app, 'Mesh');
}
const isPolymeshObj = (o: any): o is X3DObject => o instanceof X3DObject && o.type === 'polymsh';
/** All controls (LipSynch.js): Tongue+Control, Jaw+End+Control, Mouth+Control keyed objects of the face model. */
export function allControlsB18(app: App): X3DObject[] {
  const out: X3DObject[] = [];
  for (const keys of [['Tongue', 'Control'], ['Jaw', 'End', 'Control'], ['Mouth', 'Control']]) for (const o of getKeyedIn(app, keys)) if (!out.includes(o)) out.push(o);
  return out;
}

// ------------------------------------------------------------------ Face Robot folders (§2 of cmd-b18c)
export const SEP = '\\';
export function frFolder(app: App, root: 0 | 1 | 2, sub: string, make: boolean): string {
  const env = b18(app).env;
  let base = root === 0 ? env.FACEROBOTROOT : env.FACEROBOTDATAROOT;
  if (root === 2) base = base ? hostFs.parentPath(base) : '';
  const path = (base ? base.replace(/[\\/]+$/, '') : '') + SEP + sub;
  if (!folderExists(path)) {
    if (make) { try { hostFs.ensureFolder(path); } catch { siError(app, `\t${path} could not be made`); return ''; } }
    else { siError(app, `\t${path} Folder not found`); return ''; }
  }
  return path.replace(/[\\/]+$/, '') + SEP;
}
export function folderExists(p: string): boolean { try { return !!p && hostFs.isFolder(p.replace(/[\\/]+$/, '') || p); } catch { return false; } }
export function fileExists(p: string): boolean { try { return !!p && hostFs.isFile(p); } catch { return false; } }
export function listFiles(p: string): string[] { return hostFs.listFiles(p).slice().sort(); }
export function listFolders(p: string): string[] { return hostFs.listFolders(p).slice().sort(); }
export const join = (a: string, b: string) => hostFs.join(a, b);
export function makeFolder(p: string): boolean { try { hostFs.ensureFolder(p); return true; } catch { return false; } }
export function copyFile(from: string, to: string): boolean { try { hostFs.writeFile(to, hostFs.readFile(from)); return true; } catch { return false; } }
/** Text file read (LipSynch.js): null on a missing or unreadable file, with the script's error lines. */
export function readTextFile(app: App, f: string): string | null {
  if (!fileExists(f)) { siError(app, `File ${f} Not found`); return null; }
  try { return hostFs.readFile(f); } catch { siError(app, `Error Reading File ${f}`); return null; }
}
export function writeTextFile(app: App, f: string, text: string): boolean {
  try { hostFs.writeFile(f, text); return true; } catch { siError(app, `Error Writing File ${f}`); return false; }
}

// ------------------------------------------------------------------ progress bar
export class ProgressBar {
  rec: { caption: string; max: number; status: string[]; visible: boolean };
  constructor(private app: App, caption: string, max: number, private cancelEnabled: boolean) {
    this.rec = { caption, max, status: [], visible: true };
    b18(app).progress.push(this.rec);
  }
  step(status?: string) { if (status !== undefined) this.rec.status.push(status); }
  /** True when the cancel button was pressed (the bar is hidden). */
  cancelled(): boolean {
    if (!this.cancelEnabled) return false;
    const c = !!b18(this.app).hooks.cancelProgress?.(this.rec.status[this.rec.status.length - 1] ?? this.rec.caption);
    if (c) this.hide();
    return c;
  }
  hide() { this.rec.visible = false; }
}

// ------------------------------------------------------------------ geometry helpers
export type V3 = [number, number, number];
export function meshPositions(o: X3DObject): Float32Array | null { return o.primitive?.mesh()?.positions ?? null; }
export function worldPoints(o: X3DObject): THREE.Vector3[] {
  const pos = meshPositions(o); if (!pos) return []; const g = o.globalMatrix(); const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.length; i += 3) out.push(new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(g));
  return out;
}
/** 1-ring neighbour vertices per point. */
export function neighbours(polys: number[][], n: number): number[][] {
  const s: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (const f of polys) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (a < n && b < n) { s[a].add(b); s[b].add(a); } }
  return s.map(x => [...x].sort((a, b) => a - b));
}
/** Closest point on triangle (Ericson, Real-Time Collision Detection §5.1.5), returned as barycentric weights. */
export function closestBary(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): [number, number, number] {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap); if (d1 <= 0 && d2 <= 0) return [1, 0, 0];
  const bp = p.clone().sub(b); const d3 = ab.dot(bp), d4 = ac.dot(bp); if (d3 >= 0 && d4 <= d3) return [0, 1, 0];
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [1 - v, v, 0]; }
  const cp = p.clone().sub(c); const d5 = ab.dot(cp), d6 = ac.dot(cp); if (d6 >= 0 && d5 <= d6) return [0, 0, 1];
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [1 - w, 0, w]; }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [0, 1 - w, w]; }
  const den = 1 / (va + vb + vc); const v = vb * den, w = vc * den; return [1 - v - w, v, w];
}
/** Mapping template (GameExport_EyelidTools.js): for every point of A (its LOCAL positions) the closest location on B
 *  (B's points in world space): triangle vertex indices and barycentric weights. */
export function mappingTemplate(a: X3DObject, b: X3DObject): { tri: [number, number, number]; w: [number, number, number] }[] {
  const pa = meshPositions(a); const mb = b.primitive?.mesh(); if (!pa || !mb) return [];
  const wb = worldPoints(b); const out: { tri: [number, number, number]; w: [number, number, number] }[] = [];
  const tris: [number, number, number][] = []; for (let i = 0; i < mb.indices.length; i += 3) tris.push([mb.indices[i], mb.indices[i + 1], mb.indices[i + 2]]);
  for (let i = 0; i < pa.length; i += 3) {
    const p = new THREE.Vector3(pa[i], pa[i + 1], pa[i + 2]);
    let best = Infinity; let rec = { tri: [0, 0, 0] as [number, number, number], w: [1, 0, 0] as [number, number, number] };
    for (const t of tris) {
      const w = closestBary(p, wb[t[0]], wb[t[1]], wb[t[2]]);
      const q = wb[t[0]].clone().multiplyScalar(w[0]).addScaledVector(wb[t[1]], w[1]).addScaledVector(wb[t[2]], w[2]);
      const d = q.distanceToSquared(p); if (d < best) { best = d; rec = { tri: t, w }; }
    }
    out.push(rec);
  }
  return out;
}
export { THREE, X3DObject, Property, Model, Cluster, Operator, Group, frStore, entryObject, findByName, propNamed, addProperty, addObject, unset, listOf, hostFs, isInScene };
