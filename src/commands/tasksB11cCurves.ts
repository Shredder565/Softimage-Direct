// Ledger row CMD-B11c (tasks.dll), part 3: curve queries, reference planes, inspection history, Scene Explorer on an
// override parent and the particle pop-up menus.
//   GetCurveLength EvaluateCurveAt SICreateRefPlane InspectBrowse "Open SE on Override parent"
//   "Event Pop-up Menu" "Emission Pop-up Menu" "Force Pop-up Menu"
// Brief: docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md, section 3. Original code from that prose only.
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Operator, Property } from '../core/scene';
import { str } from '../core/params';
import { evalCurve, curveDomain, type CurveData } from '../core/curves';
import { boolArg, findNode } from './viewEditPropertyHelpers';
import {
  S_OK, S_FALSE, E_INVALIDARG, E_POINTER, E_NOINTERFACE,
  stateOf, fail, setStatus, logNya, text, unset, listOf, nodesArg, nodeArg, enumArg, uniqueIn,
} from './tasksB11cShared';

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => { const l = len(a); return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0]; };

// ------------------------------------------------------------------ curves
/** The NURBS curve of an object at the current time (first curve of a curve list); null = no curve interface. */
function curveOf(n: Node | null): { obj: X3DObject; curve: CurveData } | null {
  if (!(n instanceof X3DObject)) return null;
  const c = n.primitive?.curve?.() ?? null;
  return c && c.cvs?.length ? { obj: n, curve: c } : null;
}
/** Arc-length table of a curve: parameters and cumulative lengths (64 chords per span). */
function arcTable(c: CurveData): { u: number[]; s: number[] } {
  const [u0, u1] = curveDomain(c); const spans = c.closed ? c.cvs.length : Math.max(1, c.cvs.length - c.degree);
  const n = Math.max(64, spans * 64); const u: number[] = [], s: number[] = []; let prev = evalCurve(c, u0), acc = 0;
  for (let i = 0; i <= n; i++) { const t = u0 + ((u1 - u0) * i) / n; const p = evalCurve(c, t); if (i) acc += len(sub(p, prev)); prev = p; u.push(t); s.push(acc); }
  return { u, s };
}
export const totalLength = (c: CurveData) => { const t = arcTable(c); return t.s[t.s.length - 1]; };
/** Curve parameter at a normalised (arc-length) parameter f in [0, 1]. */
function paramAt(c: CurveData, f: number): number {
  const t = arcTable(c); const L = t.s[t.s.length - 1]; const target = f * L;
  if (L <= 0) return t.u[0];
  let i = 1; while (i < t.s.length - 1 && t.s[i] < target) i++;
  const s0 = t.s[i - 1], s1 = t.s[i]; const k = s1 > s0 ? (target - s0) / (s1 - s0) : 0;
  return t.u[i - 1] + (t.u[i] - t.u[i - 1]) * k;
}
/** Position, unit tangent and principal normal at curve parameter u (finite differences). */
function frameAt(c: CurveData, u: number): { p: V3; t: V3; n: V3 } {
  const [u0, u1] = curveDomain(c); const h = (u1 - u0) * 1e-4;
  const a = c.closed ? u - h : Math.max(u0, u - h), b = c.closed ? u + h : Math.min(u1 - 1e-9, u + h);
  const pa = evalCurve(c, a), pb = evalCurve(c, b), p = evalCurve(c, u);
  const t = unit(scale(sub(pb, pa), 1 / (b - a)));
  // second derivative on a centred stencil (shifted inside the domain at the ends)
  const m = c.closed ? u : Math.min(Math.max(u, u0 + h), u1 - h - 1e-9);
  const q0 = evalCurve(c, m - h), q1 = evalCurve(c, m), q2 = evalCurve(c, m + h);
  const d2: V3 = [(q0[0] - 2 * q1[0] + q2[0]) / (h * h), (q0[1] - 2 * q1[1] + q2[1]) / (h * h), (q0[2] - 2 * q1[2] + q2[2]) / (h * h)];
  const nrm = sub(d2, scale(t, dot(d2, t)));
  return { p, t, n: len(nrm) > 1e-6 * Math.max(1, len(d2)) ? unit(nrm) : [0, 0, 0] };
}

// ------------------------------------------------------------------ pop-up menus
const FIRST_CLASS = 'ParticlesOp';                       // inferred: class 3ee7b553-394f-11d3-...
const SECOND_CLASS = ['FluidOp', 'ExplosionOp'];         // inferred: class 71240cfd-8df9-11d3-...
const THIRD_CLASS = /cloth|softbody|syflex/i;            // inferred: class c41aa2c3-b58a-11d4-... (Force only)
type PopKind = 'Event' | 'Emission' | 'Force';
/** Connected ports of a port group (inferred mapping: 1 emitters, 3 forces, 4 forces of the third class, 6 events). */
function portGroup(op: Operator, group: number): Node[] {
  const c = (op as any).connections ?? {};
  switch (group) {
    case 1: return [...(c.emitters ?? [])];
    case 3: return [...(c.forces ?? [])];
    case 4: return [...((op as any).forces ?? [])];
    case 6: {
      const out: Node[] = [];
      for (const h of [...(c.particleTypes ?? []), ...(c.obstacles ?? [])] as Node[]) {
        const els: Node[] = [...((h as any).particleElements ?? []), ...(h instanceof X3DObject ? h.properties : [])];
        for (const e of els) if (e.type === 'ParticleEvent' && !out.includes(e)) out.push(e);
      }
      return out;
    }
    default: return [];
  }
}
function collect(kind: PopKind, op: Operator): Node[] {
  const first = op.type === FIRST_CLASS, particle = first || SECOND_CLASS.includes(op.type);
  if (kind === 'Event') return particle ? portGroup(op, 6) : [];
  if (kind === 'Emission') return particle ? [...portGroup(op, 1), ...(first ? portGroup(op, 6) : [])] : [];
  if (particle) return portGroup(op, 3);
  return THIRD_CLASS.test(op.type) ? portGroup(op, 4) : [];
}
function simulationOps(n: Node): Operator[] {
  if (n instanceof Operator) return [n];
  if (n instanceof X3DObject) return (n.primitive?.operators ?? []).filter(op => op.type === FIRST_CLASS || SECOND_CLASS.includes(op.type) || THIRD_CLASS.test(op.type));
  return [];
}
function popupMenu(app: App, kind: PopKind, a: Record<string, any>) {
  const C = `${kind} Pop-up Menu`; const st = stateOf(app);
  // anchor: the cursor, or the right edge of a button under it at a third of its height
  let anchor = { ...st.pointer };
  try {
    const el = document.elementFromPoint(anchor.x, anchor.y)?.closest('button');
    if (el) { const r = el.getBoundingClientRect(); anchor = { x: r.right, y: r.top + r.height / 3 }; }
  } catch { /* no DOM */ }
  const inputs = nodesArg(app, a.InputObjs);
  if (!inputs.length) { setStatus(app, C, S_FALSE); return; }
  const items: Node[] = [];
  for (const n of inputs) for (const op of simulationOps(n)) for (const e of collect(kind, op)) if (!items.includes(e)) items.push(e);
  if (!items.length) { setStatus(app, C, S_FALSE); return; }
  const labels = items.map(e => e.fullName);
  const rec = { command: C, anchor, items: labels, picked: null as number | null }; st.popups.push(rec);
  let picked: number | null | undefined = null;
  if (st.hooks.popupMenu) picked = st.hooks.popupMenu(labels, anchor, C);
  else logNya(app, C, 'the blocking pop-up menu (TrackPopupMenu); no item was picked');
  if (picked === null || picked === undefined || picked < 0 || picked >= items.length) { setStatus(app, C, S_OK); return; }
  rec.picked = picked;
  const cmd = a.EmbeddedCommand; const name = typeof cmd === 'string' ? cmd : cmd?.name ?? cmd?.Name ?? '';
  if (!name || !app.commands.has(name)) { logNya(app, C, `the embedded command "${text(name)}" is not on the bus`); setStatus(app, C, S_OK); return; }
  app.run(name, { InputObjs: [items[picked]], Keywords: 'General' });   // the internal flag is 0 in this build: Keywords = "General"
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ inspection history
// inferred: siInspectBrowseMode members (the binary accepts 1..4)
const BROWSE_MODE: Record<string, number> = { siNext: 1, siPrevious: 2, siFirst: 3, siLast: 4 };
function hookInspect(app: App) {
  const h = stateOf(app).inspect;
  app.events.on('inspect', (n: any) => {
    if (h.browsing || !(n instanceof Node)) return;
    if (h.history[h.index] === n) return;
    h.history = h.history.slice(0, h.index + 1); h.history.push(n); h.index = h.history.length - 1;
  });
}
function inspectBrowse(app: App, a: Record<string, any>) {
  const C = 'InspectBrowse';
  const mode = enumArg(a.Mode, BROWSE_MODE); const length = unset(a.Length) ? 1 : Math.trunc(Number(a.Length));
  if (mode === null || mode < 1 || mode > 4 || !Number.isFinite(length) || length < 0) throw fail(E_INVALIDARG, `${C}: Mode must be 1..4 and Length >= 0`);
  const h = stateOf(app).inspect;
  if (!h.history.length) {
    // the history's state question answers "none yet": open one (inferred) on the selection
    const n = app.selection[0];
    if (n) app.events.emit('inspect', n); else logNya(app, C, 'opening an inspection history with nothing selected');
    setStatus(app, C, S_OK); return;
  }
  const last = h.history.length - 1;
  const i = mode === 1 ? Math.min(last, h.index + length) : mode === 2 ? Math.max(0, h.index - length) : mode === 3 ? 0 : last;
  if (i !== h.index) { h.index = i; h.browsing = true; try { app.events.emit('inspect', h.history[i]); } finally { h.browsing = false; } }
  setStatus(app, C, S_OK);
  return h.history[h.index];
}

// ------------------------------------------------------------------ registration
export function registerTasksB11cCurveCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  hookInspect(app);

  reg({
    name: 'GetCurveLength', label: 'Get Curve Length', category: '', description: 'Get the length of a nurbs curve', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'Length', default: 0 }],
    execute(app, a) {
      const C = 'GetCurveLength';
      const c = curveOf(nodeArg(app, a.InputObj));
      if (!c) throw fail(E_NOINTERFACE, `${C}: the input is not a NURBS curve`);
      a.Length = totalLength(c.curve); setStatus(app, C, S_OK);
      return { Length: a.Length };
    },
  });
  reg({
    name: 'EvaluateCurveAt', label: 'EvaluateCurveAt', category: '', description: 'Evaluates the curve position, tangency and normal at a given length or ratio', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'Value', default: 0 }, { name: 'Local', default: true },
      ...['PosX', 'PosY', 'PosZ', 'TanX', 'TanY', 'TanZ', 'NorX', 'NorY', 'NorZ'].map(name => ({ name, default: 0 }))],
    execute(app, a) {
      const C = 'EvaluateCurveAt';
      const out: Record<string, number> = { PosX: 0, PosY: 0, PosZ: 0, TanX: 0, TanY: 0, TanZ: 0, NorX: 0, NorY: 0, NorZ: 0 };
      Object.assign(a, out);
      const c = curveOf(nodeArg(app, a.InputObj));
      if (!c) throw fail(E_NOINTERFACE, `${C}: the input is not a NURBS curve`);
      const value = Number(a.Value) || 0;
      let f: number;
      if (!boolArg(a.Local)) { const L = totalLength(c.curve); f = L < 1e-12 ? 0 : value / L; } else f = value;
      f = c.curve.closed ? ((f % 1) + 1) % 1 : Math.max(0, Math.min(1, f));   // inferred: clamp (open) / wrap (closed)
      const { p, t, n } = frameAt(c.curve, paramAt(c.curve, f));
      const M = c.obj.globalMatrix(); const N = new THREE.Matrix3().getNormalMatrix(M);   // inverse-transpose of the 3x3 part
      const P = new THREE.Vector3(...p).applyMatrix4(M), T = new THREE.Vector3(...t).applyMatrix3(N), Nn = new THREE.Vector3(...n).applyMatrix3(N);
      Object.assign(out, { PosX: P.x, PosY: P.y, PosZ: P.z, TanX: T.x, TanY: T.y, TanZ: T.z, NorX: Nn.x, NorY: Nn.y, NorZ: Nn.z });
      Object.assign(a, out); setStatus(app, C, S_OK);
      return out;
    },
  });
  reg({
    name: 'SICreateRefPlane', label: 'Create Reference Plane', category: 'Modeling',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const C = 'SICreateRefPlane';
      const items: any[] = unset(a.InputObjs) ? [...app.selection] : listOf(a.InputObjs);
      if (!items.length) { setStatus(app, C, S_OK); return []; }
      const store: Property[] = (app as any).uixsiClipsDisplayAddons?.refPlanes ?? stateOf(app).refPlanes;
      const planes: Property[] = [];
      for (const it of items) {
        const nameOfItem = it instanceof Node ? it.name : text(it);
        const host = it instanceof Node ? it : findNode(app, nameOfItem) ?? findNode(app, nameOfItem.split(/[.[]/)[0]);
        const obj = host instanceof X3DObject ? host : host && (host as any).parent instanceof X3DObject ? (host as any).parent : null;
        const p = new Property(uniqueIn([...store, ...planes], 'RefPlane'), 'refplane', [str('inputs', nameOfItem, 'Inputs')]);
        (p as any).matrix = (obj ? obj.globalMatrix() : new THREE.Matrix4()).toArray();   // per-item helper (inferred: aligns the plane on the input)
        planes.push(p);
      }
      logNya(app, C, 'what the per-plane helper sets on the plane; it is placed on the input object\'s transform');
      app.record('SICreateRefPlane', () => { for (const p of planes) if (!store.includes(p)) store.push(p); }, () => { for (const p of planes) { const i = store.indexOf(p); if (i >= 0) store.splice(i, 1); } });
      a.Value = planes; setStatus(app, C, S_OK);
      return planes;
    },
  });
  reg({
    name: 'InspectBrowse', label: 'Next Inspected Node', category: 'Property|Edit', description: 'Display the next node in the chronology of inspected nodes', undoable: false,
    args: [{ name: 'Mode', default: ':siNext:siInspectBrowseMode' }, { name: 'Length', default: 1 }],
    execute: (app, a) => inspectBrowse(app, a),
  });
  // the second registry entry of the name ("Previous Inspected Node"): same task, Mode defaults to siPrevious
  (stateOf(app) as any).previousInspectedNode = (args: Record<string, any> = {}) => app.run('InspectBrowse', { Mode: ':siPrevious:siInspectBrowseMode', Length: 1, ...args });

  reg({
    name: 'Open SE on Override parent', label: 'Open SE on Override parent', category: 'Property', description: 'Open SE on Override parent', undoable: false,
    args: [{ name: 'CmdID', default: '{00000000-0000-0000-0000-000000000000}' }, { name: 'Clsid', default: '{00000000-0000-0000-0000-000000000000}' }, { name: 'InspectedObjectsArray', default: null }],
    execute(app, a) {
      const C = 'Open SE on Override parent';
      const list = listOf(a.InspectedObjectsArray);
      if (!list.length) { setStatus(app, C, S_FALSE); return; }
      const n = list[0] instanceof Node ? list[0] : findNode(app, list[0]);
      if (!n) throw fail(E_NOINTERFACE, `${C}: the first inspected item is not an object`);
      const parent = n.parent instanceof Node ? n.parent : null;
      if (!parent) throw fail(E_POINTER, `${C}: ${n.fullName} has no parent`);
      logNya(app, C, 'the explorer task 0x180063400 with filter 0x19f2 (mode 10); the XSI Explorer is opened on the parent instead');
      if (app.commands.has('OpenXSIExplorer')) app.run('OpenXSIExplorer', { InputObjs: [parent] });
      setStatus(app, C, S_OK);
      return parent;
    },
  });

  for (const kind of ['Event', 'Emission', 'Force'] as PopKind[]) reg({
    name: `${kind} Pop-up Menu`, label: `${kind} Pop-up Menu`, category: '', description: `Pop-up a menu of connected ${kind === 'Force' ? 'forces' : kind + 's'}`, undoable: false,
    args: [{ name: 'InputObjs', default: null }, { name: 'EmbeddedCommand', default: null }],
    execute: (app, a) => popupMenu(app, kind, a),
  });
}
