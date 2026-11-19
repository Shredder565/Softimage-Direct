// Ledger row CMD-B11b: GetNumberOfKnots, GetCurvePercentageAtKnotIndex, GetExternalReferences,
// UpdateExternalReference, ImportCustomFile, SetReferencePlane, GetUnevaluatedPrimitiveForConstructionHistory (tasks.dll).
// Brief: docs/ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md, section 3. Original code from the prose contract.
import * as THREE from 'three';
import type { App } from '../core/commands';
import { Node, Property, X3DObject, Model, Primitive, geomPoints } from '../core/scene';
import { CurveData, curveDomain, evalCurve } from '../core/curves';
import { hostFs } from '../core/sdkHelpersHostFs';
import {
  b11b, fail, setStatus, logNya, outputs, tasksText, msgText, unset, splitList, objectArg, listArg, findObj, nameOf,
  E_INVALIDARG, E_POINTER, E_NOINTERFACE, S_OK, S_FALSE, SI_SUCCESS_INFO, EVT_FILE_PRE, EVT_FILE_POST, EVT_CUSTOM_CONVERTER, FILE_TYPE_CUSTOM,
} from './tasksB11bShared';

type Reg = (name: string, def: { description?: string; undoable?: boolean; execute: (app: App, a: Record<string, any>) => any }) => void;

// ------------------------------------------------------------------ curve knots
/** The curve geometry of an object at the current time (the primitive is evaluated at the current frame). */
function curveOf(C: string, n: Node | undefined): CurveData {
  if (!(n instanceof X3DObject)) throw fail(E_INVALIDARG, `${C}: InputObj is not a 3D object`);
  const c = n.primitive?.curve();
  if (!c) throw fail(E_NOINTERFACE, `${C}: ${n.name} has no curve geometry`);
  return c;
}
/** The Softimage knot vector of a curve: an open curve drops the first and last entries of the full clamped vector
 *  (nbCVs + degree - 1 knots), a closed curve keeps the knots of its domain (nbCVs + 1). inferred: the convention of
 *  Softimage's NurbsCurve knot vector (SDK documentation), the note only says "the knot count". */
export function siKnots(c: CurveData): number[] {
  if (!c.closed) return c.knots.slice(1, -1);
  const [u0, u1] = curveDomain(c); return c.knots.filter(k => k >= u0 - 1e-9 && k <= u1 + 1e-9);
}
/** Length percentage (0..100) of the curve at parameter u: arc length from the start of the domain over the total
 *  length. inferred: the 0..100 scale of Softimage's curve percentage arguments; the arc length is measured on a
 *  dense polyline (64 segments per knot span). */
export function percentageAt(c: CurveData, u: number): number {
  const [u0, u1] = curveDomain(c); if (u1 <= u0) return 0;
  const spans = Math.max(1, c.closed ? c.cvs.length : c.cvs.length - c.degree); const n = spans * 64;
  const t = Math.max(u0, Math.min(u1, u)); let total = 0, upto = 0; let prev = evalCurve(c, u0);
  for (let i = 1; i <= n; i++) {
    const ui = u0 + ((u1 - u0) * i) / n; const p = evalCurve(c, i === n && !c.closed ? u1 : ui);
    const d = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]); total += d;
    const ua = u0 + ((u1 - u0) * (i - 1)) / n;
    if (ui <= t) upto += d; else if (ua < t) upto += d * ((t - ua) / (ui - ua));
    prev = p;
  }
  return total > 0 ? (upto / total) * 100 : 0;
}

// ------------------------------------------------------------------ external references
interface RefRecord { file: string; resolution: number; resolutions: string[]; switching?: boolean }
const refOf = (n: any): RefRecord | null => n && n.ref && Array.isArray(n.ref.resolutions) ? n.ref as RefRecord : null;
/** Objects exposing the resolution interface in this build: the referenced models (their `ref` record). */
function* resolutionObjects(app: App): Generator<X3DObject> { yield app.scene.root; yield* app.scene.allObjects(); }

// ------------------------------------------------------------------ reference planes
export interface PlaneRecord { name: string; inputs: string[]; matrix: number[]; sizeU: number; sizeV: number; active: boolean; flags: number }
const TRANSIENT_PLANE = 'RefPlanes.Transform';
/** The reference-plane property of a target, as a get/set pair; null when the target does not expose it. The planes of
 *  this build: the transient plane and the reference-plane properties kept by the uixsiscripts row, and any property
 *  of type `refplane`. */
function planeSlot(app: App, target: any): { get(): PlaneRecord | null; set(v: PlaneRecord | null): void; name: string } | null {
  const ui: any = (app as any).uixsiClipsDisplayAddons;
  if (typeof target === 'string' && target.trim() === TRANSIENT_PLANE) {
    const holder = ui ?? b11b(app) as any;
    return { name: TRANSIENT_PLANE, get: () => holder.transientPlane ?? null, set: v => { holder.transientPlane = v; } };
  }
  let p: any = target;
  if (typeof target === 'string') p = (ui?.refPlanes ?? []).find((x: Node) => x.name === target.trim() || x.fullName === target.trim()) ?? findObj(app, target);
  if (p instanceof Property && /refplane/i.test(p.type)) {
    const q: any = p;
    return {
      name: p.name,
      get: () => q.matrix ? { name: q.name, inputs: [...(q.planeInputs ?? [])], matrix: [...q.matrix], sizeU: q.sizeU ?? 2, sizeV: q.sizeV ?? 2, active: q.active ?? true, flags: q.planeFlags ?? 1 } : null,
      set: v => { if (!v) { delete q.matrix; return; } q.matrix = [...v.matrix]; q.planeInputs = [...v.inputs]; q.sizeU = v.sizeU; q.sizeV = v.sizeV; q.active = v.active; q.planeFlags = v.flags; },
    };
  }
  return null;
}
/** Element of the InputObj list: kind 2 (object) or kind 6 (component string "obj.pnt[...]"). */
function elementOf(app: App, x: any): { kind: 2; obj: X3DObject; name: string } | { kind: 6; obj: X3DObject; sub: string; items: number[]; name: string } | { kind: 0; name: string } {
  if (x instanceof X3DObject) return { kind: 2, obj: x, name: x.name };
  const s = typeof x === 'string' ? x.trim() : nameOf(x);
  const m = /^(.*)\.(pnt|poly|edge|knot|iso\w*)\[([^\]]*)\]$/.exec(s);
  if (m) {
    const obj = findObj(app, m[1]);
    if (obj) return { kind: 6, obj, sub: m[2], items: m[3].split(',').map(t => Number(t.split('-')[0])).filter(Number.isFinite), name: `${obj.name}.${m[2]}[${m[3]}]` };
  }
  return { kind: 0, name: s };
}
function objectPlane(o: X3DObject): { matrix: THREE.Matrix4; sizeU: number; sizeV: number } {
  const pts = geomPoints(o.primitive?.geom()); const box = new THREE.Box3();
  if (pts) for (let i = 0; i < pts.length; i += 3) box.expandByPoint(new THREE.Vector3(pts[i], pts[i + 1], pts[i + 2]));
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  // inferred: U along the local X extent, V along the local Z extent (the plane lies in the transform's XZ plane)
  return { matrix: o.globalMatrix(), sizeU: Math.max(2, size.x / 2), sizeV: Math.max(2, size.z / 2) };
}

// ------------------------------------------------------------------ unevaluated primitive
/** The primitive of an object as it is at the base of its construction history (the generator only). */
export class UnevaluatedPrimitive extends Node {
  constructor(readonly source: Primitive) { super(source.name, source.type, 'primitive'); this.parent = source.parent; }
  geom(): any { const gen = this.source.operators[0]; try { return gen ? gen.apply(null) : null; } catch { return null; } }
}

export function registerTasksB11bScene(app: App, reg: Reg) {
  reg('GetNumberOfKnots', {
    description: 'Gets the number of knots the on a curve', undoable: false,
    execute(app, a) {
      const C = 'GetNumberOfKnots'; const c = curveOf(C, objectArg(app, a.InputObj));
      setStatus(app, C, S_OK);
      return outputs(app, C, { NbItems: siKnots(c).length });
    },
  });
  reg('GetCurvePercentageAtKnotIndex', {
    description: 'Gets the length percentage of the curve at the given knot index', undoable: false,
    execute(app, a) {
      const C = 'GetCurvePercentageAtKnotIndex'; const c = curveOf(C, objectArg(app, a.InputObj));
      const index = unset(a.Index) ? 0 : Number(a.Index) >>> 0; // unsigned long
      const k = siKnots(c); let pct = 0;
      if (index < k.length) pct = percentageAt(c, k[index]); // out of range: nothing computed, no error
      setStatus(app, C, S_OK);
      return outputs(app, C, { Percentage: pct });
    },
  });

  reg('GetExternalReferences', {
    description: 'Find all object using external references', undoable: false,
    execute(app) {
      const C = 'GetExternalReferences'; const st = b11b(app); const list: Node[] = [];
      for (const o of resolutionObjects(app)) {
        const r = refOf(o); if (!r) continue;
        st.switching.add(o); // F3DSetSwitchingResolutionGlobalFlag(1) around the query
        try { const switching = !!r.switching; if (!switching && r.resolutions.length > 0 && !list.includes(o)) list.push(o); } // the model carries the reference itself
        finally { st.switching.delete(o); }
      }
      setStatus(app, C, S_OK);
      return list;
    },
  });

  reg('UpdateExternalReference', {
    description: 'Update External Reference',
    execute(app, a) {
      const C = 'UpdateExternalReference';
      const paths = unset(a.InputObjs) ? [] : Array.isArray(a.InputObjs) ? a.InputObjs.map(String) : splitList(String(a.InputObjs));
      if (!paths.length) { setStatus(app, C, S_FALSE); return undefined; } // nothing to change
      const target = unset(a.Target) ? undefined : objectArg(app, a.Target);
      for (const p of paths) {
        // inferred: a reference path is valid when it is a non-empty name without the characters a file path cannot hold
        if (!p.trim() || /[<>"|?*]/.test(p)) { app.logMsg('error', `Invalid reference [${p}]`); throw fail(E_INVALIDARG, `${C}: Invalid reference [${p}]`); }
      }
      if (!target) throw fail(E_INVALIDARG, `${C}: no target`);
      const r = refOf(target);
      if (!r) { app.logMsg('info', `${tasksText(0x42f)} ${target.name}`.trim()); setStatus(app, C, S_OK); return undefined; } // no external-reference sub-object
      if (paths.length !== r.resolutions.length) throw fail(E_INVALIDARG, `${C}: ${paths.length} reference path(s) for ${r.resolutions.length} resolution(s) of ${target.name}`);
      const old = [...r.resolutions]; const oldFile = r.file;
      const apply = (list: string[], file: string) => { for (let i = 0; i < list.length; i++) r.resolutions[i] = list[i]; r.file = file; app.events.emit('scene'); };
      const idx = old.indexOf(oldFile); const newFile = idx >= 0 ? paths[idx] : oldFile;
      app.record('Update External Reference', () => apply(paths, newFile), () => apply(old, oldFile));
      setStatus(app, C, S_OK);
      return undefined; // Value is not written
    },
  });

  reg('ImportCustomFile', {
    description: 'Custom File Import', undoable: false,
    execute(app, a) {
      const C = 'ImportCustomFile'; const st = b11b(app);
      // UnPackArg (no failures propagated)
      const file = unset(a.FileName) ? '' : String(a.FileName);
      const reference = !!a.Reference && a.Reference !== 'false';
      const name = unset(a.Name) ? '' : String(a.Name);
      const frame = Math.trunc(Number(a.Frame)) || 0; // read as a long
      const userData = a.UserData;
      const dot = file.lastIndexOf('.'); const ext = dot >= 0 ? file.slice(dot + 1) : '';
      if (!file || !hostFs.exists(file)) { const m = msgText(0x11c, file); app.logMsg('error', m); throw fail(E_INVALIDARG, `${C}: ${m}`); } // SIValidateFile
      const conv = st.converters.get(ext.toLowerCase());
      if (!conv) { const m = `${tasksText(0x426)}${ext}`; app.logMsg('error', m); throw fail(E_INVALIDARG, `${C}: ${m}`); }
      const target = (unset(a.Target) ? null : objectArg(app, a.Target)) ?? app.scene.root;
      if (target instanceof Model && refOf(target) && (target as any).refQueued) logNya(app, C, 'property propagation on a queued referenced model (C3DRefModelInstaller); the import goes ahead without it');
      const fire = (id: number, args: any[]) => { const e = { id, args }; st.events.push(e); let ans: any; for (const h of st.fileEvents) { const r = h(e); if (r !== undefined) ans = r; } return ans; };
      if (fire(EVT_FILE_PRE, [file, FILE_TYPE_CUSTOM, reference, name]) === SI_SUCCESS_INFO) { setStatus(app, C, SI_SUCCESS_INFO); return undefined; } // aborted by a pre handler
      st.events.push({ id: EVT_CUSTOM_CONVERTER, args: [ext, file, FILE_TYPE_CUSTOM, frame, userData] });
      const result = conv(file, FILE_TYPE_CUSTOM, frame, userData, { target, reference, name });
      fire(EVT_FILE_POST, [file, FILE_TYPE_CUSTOM, reference, name]);
      setStatus(app, C, S_OK);
      return result;
    },
  });

  reg('SetReferencePlane', {
    description: 'Set Reference Plane',
    execute(app, a) {
      const C = 'SetReferencePlane';
      const slot = unset(a.Target) ? null : planeSlot(app, a.Target);
      if (!slot) throw fail(E_NOINTERFACE, `${C}: ${unset(a.Target) ? 'no target' : nameOf(a.Target)} has no reference plane`);
      const first = listArg(app, a.InputObj)[0];
      if (first === undefined || first === null) { setStatus(app, C, S_FALSE); return undefined; } // NULL element
      const el = elementOf(app, first);
      let plane: { matrix: THREE.Matrix4; sizeU: number; sizeV: number };
      if (el.kind === 2) plane = objectPlane(el.obj);
      else if (el.kind === 6) {
        // Known part: the plane is built from the component frame. inferred: centred on the components' global centroid,
        // oriented like the object; the full component-frame path of the worker was not read.
        const pts = geomPoints(el.obj.primitive?.geom()); const g = el.obj.globalMatrix(); const c = new THREE.Vector3(); let n = 0;
        if (pts && el.sub === 'pnt') for (const i of el.items) if (i * 3 + 2 < pts.length) { c.add(new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]).applyMatrix4(g)); n++; }
        if (n) c.divideScalar(n); else c.setFromMatrixPosition(g);
        const q = new THREE.Quaternion(); g.decompose(new THREE.Vector3(), q, new THREE.Vector3());
        plane = { matrix: new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)), sizeU: 2, sizeV: 2 };
        logNya(app, C, `the component frame of ${el.name} (axes and sizes); the plane is centred on the components and oriented like ${el.obj.name}`);
      } else { logNya(app, C, `reference planes from an element of this kind (${el.name}); the plane is unchanged`); setStatus(app, C, S_FALSE); return undefined; }
      const old = slot.get();
      const next: PlaneRecord = { name: slot.name, inputs: [el.name], matrix: plane.matrix.toArray(), sizeU: plane.sizeU, sizeV: plane.sizeV, active: true, flags: 1 };
      app.record('Set reference plane', () => { slot.set(next); app.events.emit('scene'); }, () => { slot.set(old); app.events.emit('scene'); });
      setStatus(app, C, S_OK);
      return undefined;
    },
  });

  reg('GetUnevaluatedPrimitiveForConstructionHistory', {
    description: 'Get Unevaluated Primitive For Construction History', undoable: false,
    execute(app, a) {
      const C = 'GetUnevaluatedPrimitiveForConstructionHistory';
      const o = unset(a.X3DObject) ? undefined : objectArg(app, a.X3DObject);
      if (!(o instanceof X3DObject)) throw fail(E_POINTER, `${C}: X3DObject is not a 3D object`);
      setStatus(app, C, S_OK);
      if (!o.primitive) return null; // empty VT_DISPATCH
      return new UnevaluatedPrimitive(o.primitive);
    },
  });
}
