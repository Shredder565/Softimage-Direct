// Ledger row CMD-B11f, shape / deform part: CopyShape, CreateShapeGroup, SetShapeGroup, StripDeformOperators,
// Open SE for Link With Deform. Brief: docs/ghidra/cmd-b11f-action-speech-shape-effects-binary.md, section 3.
// Original code written from that prose contract only.
//
// Model mapping: StoreShapeKey of this build keeps shape keys on the object; such a key counts as owned by the
// object's complete point cluster (the stand-in for the shape cluster). Keys owned by a real point cluster are used as is.
import { App } from '../core/commands';
import { Cluster, Model, Operator, Property, X3DObject, construction } from '../core/scene';
import { str, int, num } from '../core/params';
import { ensureShapeBase, ensureShapeOperator } from '../core/shape';
import { pref } from './uixsiKeysSourcesMaterialsShared';
import {
  E_POINTER, E_INVALIDARG, S_OK, S_FALSE, INFO_EFFECT, stateOf, setStatus, subtask, fail, logNya, unset, truthy, listOf, lockLevel, isRefModel, findObject,
} from './actionB11fModel';

// ------------------------------------------------------------------ shape keys and clusters
type ShapeOwner = { kind: 'cluster'; cluster: Cluster; obj: X3DObject } | { kind: 'object'; obj: X3DObject };
const isShapeKey = (x: any): x is Property => x instanceof Property && x.type === 'shapekey';
function allShapeKeys(app: App): Property[] {
  const out: Property[] = [];
  for (const o of app.scene.allObjects()) { out.push(...o.properties.filter(isShapeKey)); for (const c of o.clusters) out.push(...c.properties.filter(isShapeKey)); }
  return out;
}
function findShapeKey(app: App, v: any): Property | undefined {
  if (isShapeKey(v)) return v;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const s = v.trim();
  const names = (k: Property) => { const w = ownerOfKey(k); if (!w) return [k.fullName]; const base = w.kind === 'cluster' ? [`${w.obj.name}.cls.${w.cluster.name}.${k.name}`, `${w.obj.name}.${w.cluster.name}.${k.name}`] : []; return [k.fullName, `${w.obj.name}.${k.name}`, ...base]; };
  return allShapeKeys(app).find(k => names(k).includes(s)) ?? allShapeKeys(app).find(k => k.name === s);
}
function ownerOfKey(k: Property): ShapeOwner | null {
  const p: any = k.parent;
  if (p instanceof Cluster) { const o = p.obj; return o ? { kind: 'cluster', cluster: p, obj: o } : null; }
  if (p instanceof X3DObject) return { kind: 'object', obj: p };
  return null;
}
const pointCount = (o: X3DObject) => (o.primitive?.mesh()?.positions.length ?? 0) / 3;
const elementCount = (w: ShapeOwner) => (w.kind === 'cluster' ? w.cluster.elements.size : pointCount(w.obj));
function findClusterTarget(app: App, v: any): ShapeOwner | null {
  if (v instanceof Cluster) { const o = v.obj; return o && v.compKind === 'pnt' ? { kind: 'cluster', cluster: v, obj: o } : null; }
  if (v instanceof X3DObject) return v.primitive?.mesh() ? { kind: 'object', obj: v } : null;
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim(); const o = findObject(app, s);
  if (o) return o.primitive?.mesh() ? { kind: 'object', obj: o } : null;
  const parts = s.split('.'); const obj = findObject(app, parts[0]); const name = parts[parts.length - 1];
  const c = obj?.clusters.find(x => x.name === name && x.compKind === 'pnt');
  return obj && c ? { kind: 'cluster', cluster: c, obj } : null;
}

// ------------------------------------------------------------------ CopyShape
/** Source reference mode (siShapeReferenceMode: 0 local, 1 absolute, 2 object) -> shape reference; key kind per shape reference. */
const SHAPE_REF: Record<number, number> = { 0: 2, 1: 0, 2: 1 };
const KEY_KIND: Record<number, number> = { 1: 5, 2: 3, 0: 6 };
function copyShape(app: App, a: Record<string, any>) {
  const C = 'CopyShape';
  if (unset(a.Source)) throw fail(E_POINTER, `${C}: Source is required`);
  if (unset(a.Target)) throw fail(E_POINTER, `${C}: Target is required`);
  const sk = findShapeKey(app, Array.isArray(a.Source) ? a.Source[0] : a.Source);
  const owner = sk ? ownerOfKey(sk) : null;
  if (!sk || !owner) { app.logMsg('error', `${C}: the source is not a shape key of a cluster (error 100)`); setStatus(app, C, S_FALSE); return null; }
  const srcCount = elementCount(owner);
  const refMode = Number(sk.val('refmode') ?? (sk as any).refMode ?? 0);   // keys of this build are local (relative) keys
  const shapeRef = SHAPE_REF[refMode];
  if (shapeRef === undefined) throw fail(0x80004005, `${C}: unknown shape reference mode ${refMode}`);
  const wantKind = KEY_KIND[shapeRef];
  const out: Property[] = [];
  for (const t of listOf(a.Target)) {
    const tgt = findClusterTarget(app, t);
    if (!tgt) { app.logMsg('info', `${C}: ${String((t as any)?.name ?? t)} is not a point cluster`); continue; }
    if (elementCount(tgt) !== srcCount) { app.logMsg('error', `${C}: the element counts of the source and target clusters differ (error 101)`); continue; }
    const host: { properties: Property[]; addProperty(p: Property): Property; removeProperty(p: Property): void } = tgt.kind === 'cluster' ? tgt.cluster : tgt.obj;
    // result cluster key (F3DGetResultClusterKey): fetched or created by an add-property sub-task
    let rk = host.properties.find(p => p.type === 'resultclusterkey');
    if (!rk) {
      const made = new Property('ResultClusterKey', 'resultclusterkey', [int('kind', wantKind, 'Kind', { readOnly: true, animatable: false })]);
      app.record('Add result cluster key', () => { if (!host.properties.includes(made)) host.addProperty(made); }, () => host.removeProperty(made));
      subtask(app, C, 'AddProperty', `${tgt.obj.name}: ResultClusterKey`);
      rk = made;
    }
    if (Number(rk.val('kind')) !== wantKind) { app.logMsg('error', `${C}: the result cluster key of ${tgt.obj.name} does not match the reference mode (error 102)`); continue; }
    // store-shape sub-task: a new key with the source points, element layout and name
    const key = new Property(sk.name, 'shapekey', [
      str('data', String(sk.val('data') ?? '[]'), 'Positions', { readOnly: true }),
      int('points', Number(sk.val('points') ?? srcCount), 'Points', { readOnly: true }),
      num('weight', 0, 'Weight', { min: 0, max: 1, keyable: true }),
    ]);
    if (sk.get('refmode')) key.add({ ...sk.get('refmode')!.def, value: refMode });
    (key as any).elements = tgt.kind === 'cluster' ? [...tgt.cluster.elements] : null;
    if (tgt.kind === 'object') { const m = tgt.obj.primitive!.mesh()!; ensureShapeBase(tgt.obj, m.positions); ensureShapeOperator(tgt.obj); }
    app.record('Copy shape', () => { if (!host.properties.includes(key)) host.addProperty(key); }, () => host.removeProperty(key));
    subtask(app, C, 'StoreShapeKey', `${tgt.obj.name}: ${key.name}`);
    out.push(key);
  }
  setStatus(app, C, out.length ? S_OK : S_FALSE);
  return out;
}

// ------------------------------------------------------------------ shape groups
const groupOf = (k: Property): string => String((k as any).shapeGroup ?? '');
function setGroups(app: App, keys: Property[], name: string, label: string) {
  const before = keys.map(groupOf);   // old group names saved first (undo recording)
  app.record(label, () => keys.forEach(k => { (k as any).shapeGroup = name; }), () => keys.forEach((k, i) => { (k as any).shapeGroup = before[i]; }));
}
/** inferred (helper 0x18002dac0 unread): shape keys of the input, objects and clusters giving their keys. */
function collectKeys(app: App, v: any): Property[] {
  const out: Property[] = [];
  for (const x of listOf(v)) {
    const k = findShapeKey(app, x); if (k) { out.push(k); continue; }
    const o = x instanceof X3DObject ? x : typeof x === 'string' ? findObject(app, x) : undefined;
    if (o) { out.push(...o.properties.filter(isShapeKey)); for (const c of o.clusters) out.push(...c.properties.filter(isShapeKey)); continue; }
    if (x instanceof Cluster) out.push(...x.properties.filter(isShapeKey));
  }
  return [...new Set(out)];
}
function createShapeGroup(app: App, a: Record<string, any>) {
  const C = 'CreateShapeGroup';
  if (unset(a.InputObj) || a.Name === undefined || a.Name === null) { setStatus(app, C, S_OK); return null; }   // nothing done
  const keys = collectKeys(app, a.InputObj);
  if (!keys.length) { setStatus(app, C, S_OK); return null; }
  // name resolution (helper 0x18002d320 unread, open question 3): inferred unique name when empty or taken
  logNya(app, C, 'the group name rule (helper 0x18002d320); an empty name becomes "ShapeGroup", a name used by other keys gets a numeric suffix');
  const others = new Set(allShapeKeys(app).filter(k => !keys.includes(k)).map(groupOf).filter(Boolean));
  const base = String(a.Name) || 'ShapeGroup';
  let name = base; for (let i = 1; others.has(name); i++) name = `${base}${i}`;
  setGroups(app, keys, name, 'Create shape group');
  setStatus(app, C, S_OK);
  return name;
}
function setShapeGroup(app: App, a: Record<string, any>) {
  const C = 'SetShapeGroup';
  if (unset(a.InputObj) || a.Name === undefined || a.Name === null) throw fail(E_POINTER, `${C}: InputObj and Name are required`);
  if (String(a.Name) === '') throw fail(E_INVALIDARG, `${C}: Name is empty`);
  const keys: Property[] = [];
  for (const x of listOf(a.InputObj)) { const k = findShapeKey(app, x); if (!k) throw fail(E_POINTER, `${C}: ${String((x as any)?.name ?? x)} is not a shape key`); keys.push(k); }
  setGroups(app, keys, String(a.Name), 'Set shape group');
  setStatus(app, C, S_OK);
  return keys.length;
}

// ------------------------------------------------------------------ StripDeformOperators
/** Region markers and the cluster shape combiner are never stripped; `shapblend` is this build's shape combiner. */
const KEEP_TYPES = new Set(['shapblend']);
function stripDeformOperators(app: App, a: Record<string, any>) {
  const C = 'StripDeformOperators';
  const arg = Array.isArray(a.InputObj) ? a.InputObj[0] : a.InputObj;
  const o = unset(arg) ? app.selectedObjects[0] : findObject(app, arg);
  if (!o) { setStatus(app, C, S_OK); return 0; }
  const prim = o.primitive;
  if (!prim) throw fail(E_POINTER, `${C}: ${o.name} has no primitive`);
  const mode = construction.mode;   // context.constructionmode; 3 = secondary shape
  const mute = truthy(pref(app, 'Preferences.shape_animation.MuteDeformsOnShapeInstancing', false));
  if (mute) logNya(app, C, 'the effect of shape_animation.MuteDeformsOnShapeInstancing on the removal helper 0x180072140; operators are removed as with the preference off');
  const regions: Operator['region'][] = mode === 'secondaryshape' ? ['secondaryshape', 'modeling'] : ['modeling'];
  let removed = 0;
  for (const r of regions) {
    for (const op of [...prim.operators]) {
      if (op === prim.operators[0] && op.type === 'geom') continue;   // the generator at the bottom is the primitive, not a stack operator
      if ((op.region ?? 'modeling') !== r || KEEP_TYPES.has(op.type)) continue;
      if (op.val('mute') === true || (op as any).deactivated) continue;   // F3DIsDeactivated
      if (lockLevel(op) || lockLevel(o)) {
        const ref = isRefModel(o.model as Model | null) && !lockLevel(op);
        app.logMsg('info', `${C}: ${op.name} is locked and was not removed (${ref ? 'simsgcat 0xdc' : 'simsgcat 0xdd'})`);
        continue;
      }
      const at = prim.operators.indexOf(op);
      app.record('Strip deform operator', () => prim.removeOperator(op), () => { if (!prim.operators.includes(op)) { prim.operators.splice(Math.min(at, prim.operators.length), 0, op); op.parent = prim; prim.dirty = true; } });
      removed++;
    }
  }
  app.events.emit('scene');
  setStatus(app, C, S_OK);
  return removed;
}

// ------------------------------------------------------------------ Open SE for Link With Deform
function openSeForLinkWithDeform(app: App, a: Record<string, any>) {
  const C = 'Open SE for Link With Deform';
  const v = Array.isArray(a.Cluster) ? a.Cluster[0] : a.Cluster;
  const cl = v instanceof Cluster ? v : unset(v) ? app.selection.find(n => n instanceof Cluster) as Cluster | undefined : findClusterTarget(app, v);
  const cluster = cl instanceof Cluster ? cl : (cl as any)?.kind === 'cluster' ? (cl as any).cluster as Cluster : null;
  if (!cluster) return setStatus(app, C, S_FALSE);
  if (stateOf(app).noUI || (app as any).Interactive === false) return setStatus(app, C, S_OK);   // DSIsAppRunningWithoutUI: nothing shown
  const ori = truthy(a.LinkWithOri);
  stateOf(app).transientViews.push({ cluster: cluster.fullName, filter: ori ? 2 : 'all', attributes: [8, 3], mode: 2, flags: 0x601 });
  logNya(app, C, 'the transient schematic / explorer picker and the linker step that follows a pick (interface 0x180139140); no view is shown and nothing is picked');
  return setStatus(app, C, INFO_EFFECT);
}

export const SHAPE_HANDLERS: Record<string, (app: App, a: Record<string, any>) => any> = {
  CopyShape: copyShape,
  CreateShapeGroup: createShapeGroup,
  SetShapeGroup: setShapeGroup,
  StripDeformOperators: stripDeformOperators,
  'Open SE for Link With Deform': openSeForLinkWithDeform,
};
