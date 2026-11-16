// Shared helpers for the inferred Viewing / Edit / Property / Constraint / Transport / General command batch
// (src/commands/viewEditProperty.ts, viewEditPropertyMore.ts). No analyst note exists for these commands: names,
// argument lists and defaults come from data/commands_full.json, behaviour is reasoned from the registry
// descriptions, publicly documented Softimage scripting semantics and the related commands already on the bus.
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { X3DObject, Node, Property, Material, Operator, Primitive, Constraint, Model, makeDisplay, makeGeomApprox, threeOrder } from '../core/scene';
import type { Parameter } from '../core/params';
import { NotYetAttested } from './fbx';

/** NotYetAttested (class shared with the FBX row) with a message that does not cite the FBX note. */
export function nya(command: string, what: string, question: string): NotYetAttested {
  const e = new NotYetAttested(command, what, question);
  e.message = `not yet attested: ${what} (${command}; inferred batch, ${question})`;
  return e;
}
/** Log (do not throw) an unattested branch of a command whose known part still ran. */
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what}`); }

/** Bookkeeping the check script reads: which names this batch registered and which it left to another module. */
export interface BatchInfo { registered: string[]; skipped: string[] }
export function batchInfo(app: App): BatchInfo { return ((app as any).viewEditPropertyCommands ??= { registered: [], skipped: [] }); }
/** Register unless another module already owns the name (this batch never re-registers a command). */
export function reg(app: App, def: CommandDef) {
  const info = batchInfo(app);
  if (app.commands.has(def.name)) { info.skipped.push(def.name); return; }
  app.register(def); info.registered.push(def.name);
}

export const unset = (v: any) => v === undefined || v === null || v === '';
/** ":siNoParent:siDupParent" (registry default spelling) or "siNoParent" → "siNoParent"; numbers pass through. */
export function siConst(v: any): string | number | null {
  if (unset(v)) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim(); const m = /^:([^:]+):/.exec(s);
  if (m) return m[1];
  return /^-?\d+$/.test(s) ? Number(s) : s;
}
export const numArg = (v: any): number | null => { if (unset(v)) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
export const boolArg = (v: any): boolean => typeof v === 'string' ? /^(true|1|yes)$/i.test(v.trim()) : !!v;
const listOf = (arg: any): any[] => Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg];

/** Scene objects named by a Collection argument; unset (or the registry's ".[obj]." selection wildcard) = the selection. */
export function objs(app: App, arg: any): X3DObject[] {
  if (unset(arg) || arg === '.[obj].') return app.selectedObjects;
  const out: X3DObject[] = [];
  for (const x of listOf(arg)) { const o = x instanceof X3DObject ? x : typeof x === 'string' ? findObject(app, x) : undefined; if (o && !out.includes(o)) out.push(o); }
  return out;
}
export function findObject(app: App, name: string): X3DObject | undefined {
  if (name === app.scene.root.name) return app.scene.root;
  return app.scene.find(name) ?? app.scene.find(name.replace(/^Scene_Root\./, ''));
}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The material an object renders with: its own, else the nearest ancestor's (Scene_Root owns Scene_Material). */
export function materialOf(app: App, o: X3DObject): Material | null {
  let n: X3DObject | null = o; while (n) { if (n.material) return n.material; n = n.parentObj; }
  return app.scene.root.material;
}
export function findMaterial(app: App, x: any): Material | undefined {
  if (x instanceof Material) return x;
  if (typeof x !== 'string' || !x) return undefined;
  const leaf = x.split('.').pop()!;
  const m = app.scene.materials.find(k => k.name === x) ?? app.scene.materials.find(k => k.name === leaf);
  if (m) return m;
  if (/\.material$/i.test(x)) { const o = findObject(app, x.replace(/\.material$/i, '')); if (o) return materialOf(app, o) ?? undefined; }
  return undefined;
}
export function findProperty(o: X3DObject, key: string): Property | undefined {
  return o.properties.find(p => same(p.type, key) || same(p.name, key)) ?? o.allProperties().find(p => same(p.type, key) || same(p.name, key));
}
export function findOperator(prim: Primitive | null | undefined, x: any): Operator | undefined {
  if (!prim) return undefined;
  if (x instanceof Operator) return prim.operators.includes(x) ? x : undefined;
  if (typeof x !== 'string' || !x) return undefined;
  const leaf = x.split('.').pop()!;
  return prim.operators.find(op => same(op.name, leaf) || same(op.type, leaf) || same(op.name.replace(/ /g, ''), leaf) || same(op.name.replace(/ /g, '_'), leaf));
}
/** Any scene node named by an argument: a Node instance, an object, a material, "obj.property", "obj.polymsh.operator". */
export function findNode(app: App, x: any): Node | undefined {
  if (x instanceof Node) return x;
  if (typeof x !== 'string' || !x) return undefined;
  const o = findObject(app, x); if (o) return o;
  const m = findMaterial(app, x); if (m) return m;
  const parts = x.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    const owner = findObject(app, parts.slice(0, i).join('.')); if (!owner) continue;
    const rest = parts.slice(i);
    if (rest.length === 1) { const p = findProperty(owner, rest[0]); if (p) return p; if (owner.primitive && (same(owner.primitive.type, rest[0]) || same(owner.primitive.name, rest[0]))) return owner.primitive; }
    const op = findOperator(owner.primitive, rest[rest.length - 1]); if (op) return op;
    const c = owner.clusters.find(k => k.name === rest[rest.length - 1]); if (c) return c;
  }
  return app.scene.groupList.find(g => g.name === x) ?? app.scene.layers.find(l => l.name === x);
}
export function nodes(app: App, arg: any): Node[] {
  if (unset(arg)) return [...app.selection];
  const out: Node[] = []; for (const x of listOf(arg)) { const n = findNode(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}

/** A parameter of an object by its path relative to the object ("visibility.viewvis", "kine.local.posx", "polymsh.geom.radius"). */
export function paramOf(o: X3DObject, rel: string): Parameter | undefined {
  let parts = rel.split('.').filter(Boolean);
  if (parts.length > 1 && (parts[0] === o.name)) parts = parts.slice(1);
  const pname = parts[parts.length - 1]; const mid = parts.slice(0, -1).join('.');
  if (!pname) return undefined;
  if (same(mid, 'kine.local')) return o.kinematics.local.get(pname);
  if (same(mid, 'kine.global')) return o.kinematics.global.get(pname);
  if (mid) {
    const pr = findProperty(o, mid); if (pr) return pr.get(pname);
    if (o.primitive) { if (same(mid, o.primitive.type) || same(mid, o.primitive.name)) return o.primitive.get(pname); const op = findOperator(o.primitive, mid); if (op) return op.get(pname); }
    return undefined;
  }
  return o.get(pname) ?? o.kinematics.local.get(pname) ?? o.properties.map(p => p.get(pname)).find(Boolean);
}
/** Parameters named by "Params"-style arguments: full paths ("cube.kine.local.posx") or paths relative to each input object. */
export function paramsOf(app: App, targets: X3DObject[], list: any): { found: Parameter[]; missing: string[] } {
  const found: Parameter[] = [], missing: string[] = [];
  for (const raw of listOf(list)) {
    if (raw && typeof raw === 'object' && 'def' in raw && 'owner' in raw) { found.push(raw as Parameter); continue; }
    const s = String(raw); let hit = false;
    const first = s.split('.')[0]; const named = s.includes('.') ? findObject(app, first) : undefined;
    if (named) { const p = paramOf(named, s.split('.').slice(1).join('.')); if (p) { found.push(p); hit = true; } }
    else for (const o of targets) { const p = paramOf(o, s); if (p && !found.includes(p)) { found.push(p); hit = true; } }
    if (!hit) missing.push(s);
  }
  return { found, missing };
}

/** Copy of a property (same name, type, values, layout), as the existing Duplicate command builds them. */
export function copyProperty(p: Property): Property {
  const np = new Property(p.name, p.type, p.params.map(x => ({ ...x.def, value: x.value })));
  np.layout = p.layout; np.shared = p.shared; return np;
}
/** The object's own, local (non-shared) property of a type; a shared or inherited one is made local first (undoable). */
export function ensureLocal(app: App, o: X3DObject, type: 'display' | 'geomapprox'): Property {
  const own = o.properties.find(p => p.type === type);
  if (own) { if (own.shared) app.record('Make local', () => { own.shared = false; }, () => { own.shared = true; }); return own; }
  let src: Property | undefined; for (let n = o.parentObj; n && !src; n = n.parentObj) src = n.properties.find(p => p.type === type);
  const np = type === 'display' ? makeDisplay(false) : makeGeomApprox(false);
  if (src) for (const q of src.params) { const d = np.get(q.name); if (d) d.value = q.value; }
  np.shared = false;
  app.record('Make local', () => { o.addProperty(np); }, () => { o.removeProperty(np); });
  return np;
}
/** Remove a property from its owner with index-preserving undo. */
export function removeProp(app: App, o: X3DObject, p: Property) {
  const idx = o.properties.indexOf(p); if (idx < 0) return;
  app.record('Remove ' + p.name, () => { o.removeProperty(p); }, () => { o.addProperty(p); o.properties.splice(o.properties.indexOf(p), 1); o.properties.splice(idx, 0, p); });
}

const parentGlobal = (p: X3DObject | null) => p ? p.globalMatrix() : new THREE.Matrix4();
/** Reparent with index-preserving undo; `keepGlobal` rewrites the local transform so the global pose is unchanged. */
export function reparent(app: App, c: X3DObject, p: X3DObject, keepGlobal = false) {
  const old = c.parentObj; if (old === p) return;
  const idx = old ? old.children.indexOf(c) : -1;
  let local: THREE.Matrix4 | null = null;
  if (keepGlobal) {
    const a = parentGlobal(old), b = parentGlobal(p);
    if (a.elements.some((v, i) => Math.abs(v - b.elements[i]) > 1e-9)) local = b.clone().invert().multiply(a.multiply(c.kinematics.localMatrix()));
  }
  app.record('Parent', () => { p.addChild(c); }, () => { if (old) { old.addChild(c); old.children.splice(old.children.indexOf(c), 1); old.children.splice(idx, 0, c); } else p.removeChild(c); });
  if (local) setLocalMatrix(app, c, local);
}
export function setLocalMatrix(app: App, o: X3DObject, m: THREE.Matrix4, label = 'Transform') {
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(pos, q, s);
  const l = o.kinematics.local, r = 180 / Math.PI; const e = new THREE.Euler().setFromQuaternion(q, threeOrder(l.val('rotorder')));
  const vals: Record<string, number> = { posx: pos.x, posy: pos.y, posz: pos.z, rotx: e.x * r, roty: e.y * r, rotz: e.z * r, sclx: s.x, scly: s.y, sclz: s.z };
  for (const [k, v] of Object.entries(vals)) { const p = l.get(k)!; if (Math.abs(Number(p.value) - v) > 1e-9) app.setParam(p, Math.abs(v) < 1e-12 ? 0 : v, label); }
}
export function isDescendant(o: X3DObject, of: X3DObject) { for (let n: X3DObject | null = o; n; n = n.parentObj) if (n === of) return true; return false; }

// ------------------------------------------------------------------ clones / instances

/** Generator of a clone: the master's evaluated geometry, re-read whenever the master's result changes.
 *  Stands in for Softimage's copy operator on a clone (operators applied to the clone stack on top of it). */
export class CopyOperator extends Operator {
  readonly siType = 'copyop';
  constructor(readonly master: X3DObject) { super('Copy Op', 'geom', []); this.region = 'modeling'; }
  apply() { const g = this.master.primitive?.geom(); if (!g) return null; try { return structuredClone(g); } catch { return { ...g }; } }
  depStamp() { const p = this.master.primitive; if (!p) return ''; p.geom(); return String(p.version); }
}
export const masterOfClone = (o: X3DObject): X3DObject | null => { const g = o.primitive?.operators[0]; return g instanceof CopyOperator ? g.master : null; };
export const hasGeometry = (o: X3DObject) => !!o.primitive && o.primitive.operators.length > 0;

/** New, unattached node with the source's transform and (non-constraint) properties. `clone` shares the master's geometry. */
export function copyNode(app: App, o: X3DObject, opts: { clone: boolean; name?: string; asModel?: boolean }): X3DObject {
  const name = app.scene.uniqueName(opts.name || o.name);
  const c = opts.asModel ? new Model(name) : new X3DObject(name, o.type);
  for (const p of o.kinematics.local.params) c.kinematics.local.get(p.name)!.value = p.value;
  c.properties.splice(0);
  for (const p of o.properties) if (!(p instanceof Constraint)) c.addProperty(copyProperty(p));
  if (o.primitive) {
    const prim = new Primitive(o.primitive.name, o.primitive.type);
    if (opts.clone && hasGeometry(o)) prim.addOperator(new CopyOperator(o));
    else for (const q of o.primitive.params) { const d = prim.get(q.name) ?? prim.add({ ...q.def }); d.value = q.value; }
    c.setPrimitive(prim);
  }
  if (o.material) c.setMaterial(o.material);
  return c;
}
/** Softimage model instances: a model node that points at its master. The viewport has no instance primitive, so the
 *  instance carries clones of the master's hierarchy (geometry follows the master; later hierarchy edits do not). */
export const masterOfInstance = (o: X3DObject): Model | null => ((o as any).instanceMaster as Model | undefined) ?? null;
export function buildInstance(app: App, master: Model, name?: string): Model {
  const inst = copyNode(app, master, { clone: false, name: name || master.name + '_Instance', asModel: true }) as Model;
  (inst as any).instanceMaster = master;
  const taken = new Set<string>([inst.name]);
  const fill = (src: X3DObject, dst: X3DObject) => {
    for (const ch of src.children) {
      let nm = app.scene.uniqueName(ch.name); for (let i = 1; taken.has(nm); i++) nm = app.scene.uniqueName(`${ch.name}_${i}`);
      taken.add(nm);
      const cc = copyNode(app, ch, { clone: true, name: nm, asModel: ch instanceof Model }); cc.name = nm; (cc as any).instanceContent = true;
      dst.addChild(cc); fill(ch, cc);
    }
  };
  fill(master, inst);
  return inst;
}
/** Attach a freshly built node under a parent (undoable). */
export function attach(app: App, c: X3DObject, parent: X3DObject, label = 'Add') { app.record(`${label} ${c.name}`, () => { parent.addChild(c); }, () => { parent.removeChild(c); }); }
