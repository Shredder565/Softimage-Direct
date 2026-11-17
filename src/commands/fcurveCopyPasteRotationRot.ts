// Ledger row CMD-B8c, rotation part: ConvertEulerToQuat, ConvertQuatToEuler, MakeRotationsContinuous.
// Brief: docs/ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md. Original code written from that prose contract
// only (see fcurveCopyPasteRotationTasks.ts for the mapping notes).
//
//  * The Euler rotation triple is kine.local rotx / roty / rotz, the rotation order kine.local rotorder. The
//    alternative triple of the contract (ids 0x0b..0x0d of the other kinematic state, Q8) and the custom
//    transform interface do not exist in this build; where the contract turns to them the command logs
//    "not yet attested" and leaves the object alone.
//  * The quaternion fcurve object is a QuatCurve in `app.fcurveCopyPasteRotation.quatSources`, linked to the three
//    parameters through outputs 0, 1, 2. It is evaluated on every frame change: spherical interpolation between
//    the two keys around the time, held before the first and after the last key (interpolation and extrapolation
//    kind inferred), converted back to Euler angles with the object's rotation order (use of the order inferred).
//  * Euler <-> matrix and the "closest Euler triple to a target" step use the textbook construction: the second
//    Euler solution (first and last angle + pi, middle angle pi - angle) and whole turns added per component.
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { Parameter } from '../core/params';
import { X3DObject, threeOrder } from '../core/scene';
import {
  Args, Quat, QuatCurve, S_OK, E_FAIL,
  stateOf, fail, setStatus, logNya, objectList, transact, refresh, putKeys,
} from './fcurveCopyPasteRotationShared';

const RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const KEY_TOL = 1e-6;
type Triple = [Parameter, Parameter, Parameter];
type V3 = [number, number, number];

const orderOf = (o: X3DObject): number => { const n = Number(o.kinematics.local.val('rotorder')); return n >= 0 && n <= 5 ? n : 0; };
function tripleOf(o: X3DObject): Triple | null {
  const l = o.kinematics.local; const x = l.get('rotx'), y = l.get('roty'), z = l.get('rotz');
  return x && y && z ? [x, y, z] : null;
}
function quatOfEuler(deg: V3, order: number): Quat {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg[0] * RAD, deg[1] * RAD, deg[2] * RAD, threeOrder(order)));
  return [q.x, q.y, q.z, q.w];
}
function eulerOfQuat(q: Quat, order: number): V3 {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q[0], q[1], q[2], q[3]), threeOrder(order));
  return [e.x / RAD, e.y / RAD, e.z / RAD];
}
/** The three outputs (degrees) of a quaternion fcurve object at a time. */
export function evalQuatCurve(c: QuatCurve, time: number): V3 {
  const ks = c.keys;
  if (!ks.length) return eulerOfQuat(c.constant ?? [0, 0, 0, 1], c.order);
  if (time <= ks[0].time) return eulerOfQuat(ks[0].q, c.order);
  if (time >= ks[ks.length - 1].time) return eulerOfQuat(ks[ks.length - 1].q, c.order);
  let i = 0; while (i + 1 < ks.length && ks[i + 1].time <= time) i++;
  const a = ks[i], b = ks[i + 1]; const t = (time - a.time) / (b.time - a.time);
  const q = new THREE.Quaternion(a.q[0], a.q[1], a.q[2], a.q[3]).slerp(new THREE.Quaternion(b.q[0], b.q[1], b.q[2], b.q[3]), t);
  return eulerOfQuat([q.x, q.y, q.z, q.w], c.order);
}
/** Drive the parameters connected to quaternion sources (frame listener). */
function driveQuatSources(app: App): void {
  const Q = stateOf(app).quatSources; if (!Q.size) return;
  const done = new Map<QuatCurve, V3>();
  for (const [p, link] of Q) {
    let e = done.get(link.curve); if (!e) { e = evalQuatCurve(link.curve, app.anim.frame); done.set(link.curve, e); }
    p.value = e[link.output];
  }
  app.events.emit('params');
}
const hasSource = (app: App, p: Parameter) => app.anim.fcurves.has(p) || app.anim.expression(p) !== undefined || stateOf(app).quatSources.has(p);
/** (time, value) of the keys of a parameter's source: its fcurve keys, or its output at the quaternion keys. */
function axisKeys(app: App, p: Parameter): { time: number; value: number }[] {
  const fc = app.anim.fcurves.get(p); if (fc) return fc.keys.map(k => ({ time: k.time, value: k.value }));
  const link = stateOf(app).quatSources.get(p);
  return link ? link.curve.keys.map(k => ({ time: k.time, value: eulerOfQuat(k.q, link.curve.order)[link.output] })) : [];
}
/** Union of key times, each time once, sorted. */
function unionTimes(lists: { time: number }[][]): number[] {
  const out: number[] = [];
  for (const l of lists) for (const k of l) if (!out.some(t => Math.abs(t - k.time) <= KEY_TOL)) out.push(k.time);
  return out.sort((a, b) => a - b);
}
function removeAnimation(app: App, tri: Triple): void { for (const p of tri) { app.anim.removeAnimation(p); stateOf(app).quatSources.delete(p); } }
/** The objects whose rotation triple carries animation; the others are reported (alternative triple, Q8). */
function convertible(app: App, command: string, spec: any): { o: X3DObject; tri: Triple }[] {
  const out: { o: X3DObject; tri: Triple }[] = [];
  for (const o of objectList(app, spec)) {
    const tri = tripleOf(o); if (!tri) continue;
    if (!tri.some(p => hasSource(app, p))) { logNya(app, command, `${o.name}: no animation on the Euler rotation parameters, the alternative rotation triple is not in this build; object left alone`, 'Q8'); continue; }
    out.push({ o, tri });
  }
  return out;
}
const NOTHING = (command: string) => fail(E_FAIL, `${command}: no object could be processed (XSIFCURVE message 0x24; text not yet attested, Q9)`);

// ------------------------------------------------------------------ ConvertEulerToQuat
function convertEulerToQuat(app: App, a: Args): void {
  const todo = convertible(app, 'ConvertEulerToQuat', a.InputObjs);
  if (!todo.length) throw NOTHING('ConvertEulerToQuat');
  const Q = stateOf(app).quatSources;
  transact(app, 'ConvertEulerToQuat', todo.flatMap(x => x.tri), () => {
    for (const { o, tri } of todo) {
      const order = orderOf(o);
      const per = tri.map(p => axisKeys(app, p));
      const times = unionTimes(per);
      const last = tri.map(p => Number(p.value)) as V3;   // an axis without a key keeps the last value used
      const curve: QuatCurve = { keys: [], constant: null, order, params: tri };
      if (!times.length) curve.constant = quatOfEuler(last, order);
      for (const t of times) {
        per.forEach((ks, i) => { const k = ks.find(x => Math.abs(x.time - t) <= KEY_TOL); if (k) last[i] = k.value; });
        curve.keys.push({ time: t, q: quatOfEuler(last, order) });
      }
      removeAnimation(app, tri);
      tri.forEach((p, i) => Q.set(p, { curve, output: i as 0 | 1 | 2 }));   // outputs 0, 1, 2 -> X, Y, Z
    }
  }, { values: true });
  refresh(app);
  setStatus(app, 'ConvertEulerToQuat', S_OK);
}

// ------------------------------------------------------------------ ConvertQuatToEuler
function convertQuatToEuler(app: App, a: Args): void {
  const todo = convertible(app, 'ConvertQuatToEuler', a.InputObjs);
  if (!todo.length) throw NOTHING('ConvertQuatToEuler');
  transact(app, 'ConvertQuatToEuler', todo.flatMap(x => x.tri), () => {
    for (const { tri } of todo) {
      const pairs = tri.map(p => axisKeys(app, p));   // recorded before the animation is removed
      removeAnimation(app, tri);
      for (const i of [1, 2, 0]) {   // written in the order Y, Z, X
        const p = tri[i]; const fc = app.anim.fcurve(p, true)!;   // a new standard fcurve on the parameter
        // No recorded pair: the current value stays as the curve's constant value (an fcurve without keys).
        putKeys(app, p, pairs[i].map(k => ({ time: k.time, value: k.value, left: k.value, right: k.value, interp: fc.interp })));
      }
    }
  }, { values: true });
  refresh(app);
  setStatus(app, 'ConvertQuatToEuler', S_OK);
}

// ------------------------------------------------------------------ MakeRotationsContinuous
/** The Euler triple (radians, x / y / z components) of a rotation matrix that is closest to a target triple. */
function closestEuler(m: THREE.Matrix4, order: THREE.EulerOrder, target: V3): V3 {
  const e = new THREE.Euler().setFromRotationMatrix(m, order);
  const first: V3 = [e.x, e.y, e.z];
  const mid = 'XYZ'.indexOf(order[1]);
  const second = first.map((v, i) => i === mid ? Math.PI - v : v + Math.PI) as V3;
  const near = (c: V3) => c.map((v, i) => v + TWO_PI * Math.round((target[i] - v) / TWO_PI)) as V3;
  const dist = (c: V3) => c.reduce((s, v, i) => s + (v - target[i]) ** 2, 0);
  const p = near(first), q = near(second);
  return dist(q) < dist(p) ? q : p;
}
function makeRotationsContinuous(app: App, a: Args): void {
  const A = app.anim;
  const todo: { o: X3DObject; tri: Triple }[] = [];
  for (const o of objectList(app, a.InputObjs)) { const tri = tripleOf(o); if (tri && tri.some(p => A.fcurves.get(p)?.keys.length)) todo.push({ o, tri }); }
  logNya(app, 'MakeRotationsContinuous', 'the alternative rotation triple (processed as well by the task) is not in this build; only kine.local rotx / roty / rotz are processed', 'Q8');
  if (!todo.length) throw NOTHING('MakeRotationsContinuous');
  transact(app, 'MakeRotationsContinuous', todo.flatMap(x => x.tri), () => {
    for (const { o, tri } of todo) {
      const order = threeOrder(orderOf(o));
      const fcs = tri.map(p => A.fcurves.get(p));
      const times = unionTimes(fcs.map(fc => fc?.keys ?? []));
      const keyAt = (i: number, t: number) => fcs[i]?.keys.find(k => Math.abs(k.time - t) <= KEY_TOL);
      // The first key time only seeds the reference; an axis without a key there starts from its curve's value
      // at that time, or from the parameter value when it has no fcurve (inferred).
      let ref = tri.map((p, i) => (keyAt(i, times[0])?.value ?? (fcs[i]?.keys.length ? fcs[i]!.eval(times[0]) : Number(p.value))) * RAD) as V3;
      for (const t of times.slice(1)) {
        const cur = tri.map((_, i) => { const k = keyAt(i, t); return k ? k.value * RAD : ref[i]; }) as V3;
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(cur[0], cur[1], cur[2], order));
        const next = closestEuler(m, order, ref);
        if (next.some((v, i) => Math.abs(v - cur[i]) >= 1e-12)) {
          tri.forEach((_, i) => {
            const k = keyAt(i, t); if (!k) return;
            const v = next[i] / RAD, d = v - k.value;
            k.value = v; if (k.left !== undefined) k.left += d; if (k.right !== undefined) k.right += d;
          });
        }
        ref = next;
      }
    }
  });
  refresh(app);
  setStatus(app, 'MakeRotationsContinuous', S_OK);
}

const arg = (name: string, dflt: any = null) => ({ name, default: dflt });
export function registerFcurveRotationCommands(app: App): void {
  const reg = (def: CommandDef) => app.register({ category: 'Animation', ...def });
  app.anim.onFrame(() => driveQuatSources(app));
  reg({
    name: 'ConvertEulerToQuat', label: 'Convert Euler Rotation FCurves To Quaternion FCurves', description: 'Convert Euler rotation fcurves to quaternion fcurves',
    args: [arg('InputObjs')], execute: (host, a) => convertEulerToQuat(host, a),
  });
  reg({
    name: 'ConvertQuatToEuler', label: 'Convert Quaternion Rotation FCurves To Euler FCurves', description: 'Convert quaternion rotation fcurves to Euler fcurves',
    args: [arg('InputObjs')], execute: (host, a) => convertQuatToEuler(host, a),
  });
  reg({
    name: 'MakeRotationsContinuous', label: 'Make Rotation Keys Continuous', description: 'Process rotations keys to make Euler angles continuous between successive keyframes',
    args: [arg('InputObjs')], execute: (host, a) => makeRotationsContinuous(host, a),
  });
}
