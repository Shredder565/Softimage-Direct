// Row CMD-B11a (part 1): pop-up menus, current pass / particle type, object queries and the scene-item reorder of
// tasks.dll. Brief: docs/ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md, section 3.
//
//   Particle Type Pop-up Menu, Goal Pop-up Menu, SIMatchSubComponent, FindObjects, GetCurrentPass, SetCurrentParType,
//   FilterPSet, ReorderSceneItem, CollapseOp
//
// How the contracts are mapped onto this build:
//  * Simulation operators are the legacy particle operators of particleScripts.ts (ParticlesOp / FluidOp /
//    ExplosionOp on a cloud). Port group 5 (particle types) is their `connections.particleTypes`; port group 7
//    (goals) is the ParticleGoal elements attached to the cloud (AddParticleGoal) plus `connections.goals` if present.
//  * InspectObj on a particle type or goal: the bus InspectObj resolves scene objects only, so the request is recorded
//    in `app.tasksB11a.inspected` and the `inspect` event opens the property editor (stand-in for the callee).
//  * The pop-up menu (TrackPopupMenu) is a DOM menu at the cursor; `app.tasksB11a.hooks.popupChoice` answers it
//    synchronously for scripts and checks.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Property, Operator, Pass, Layer } from '../core/scene';
import { currentPass } from './duplicateRenderingSimulationScriptsShared';
import { particleScripts } from './particleScripts';
import { collapseOperator } from './tasksB11aCollapse';
import {
  b11a, reg, fail, setStatus, logNya, interactive, unset, text, boolA, num, nodeArg, nodesArg, rawItems, isPass, isLayer, isParType, ownerModel, objOf,
  S_OK, S_FALSE, E_NOTIMPL, E_NOINTERFACE, E_FAIL, E_UNEXPECTED, E_INVALIDARG, type MenuRecord,
} from './tasksB11aShared';

// ------------------------------------------------------------------ class ids of the contracts
const CLS = {
  particleOpA: '3ee7b553-394f-11d3-8a80-00a024197c03', particleOpB: '71240cfd-8df9-11d3-ba02-08003639d903', particleOpC: 'c41aa2c3-b58a-11d4-a96f-00c04f8edeb9',
  pass: 'bfdaf164-5dd8-4422-9f1e-35527cdc2a02', layer: '479f2e10-3900-11d1-b0b3-00a024c79287', contentItem: 'a15b3913-073f-11d4-b7df-0008c7a011a6', parType: '4c038ff0-3b9b-11d3-a1f7-00a0248f9567',
};
// inferred: the pairing of the three particle simulation operator classes with this build's operator types
const SIM_OP_CLASS: Record<string, string> = { ParticlesOp: CLS.particleOpA, FluidOp: CLS.particleOpB, ExplosionOp: CLS.particleOpC };

/** The class id of a node, as far as the contracts name them (null: no class-id interface known to this build). */
function classIdOf(n: Node): string | null {
  if (n instanceof Pass) return CLS.pass;
  if (n instanceof Layer) return CLS.layer;
  if (isParType(n)) return CLS.parType;
  // a15b3913-073f-11d4-b7df-0008c7a011a6: named C3DReferencePlane by the B11c batch-12 answer (SPDL c3dreferenceplane.spdl);
  // the B11a answer leaves the class name open (inferred there: environment). This build follows the SPDL name.
  if (n instanceof Property && /refplane/i.test(n.type)) return CLS.contentItem;
  if (n instanceof Operator) return SIM_OP_CLASS[n.type] ?? null;
  return null;
}

// ------------------------------------------------------------------ pop-up menus
/** F3DGetSimulationOps: the simulation operators of an object (legacy particle operators on its primitive). */
function simulationOps(o: Node): Operator[] { return o instanceof X3DObject ? (o.primitive?.operators ?? []).filter(op => !!SIM_OP_CLASS[op.type]) : []; }
function cursorAnchor(): { x: number; y: number } {
  const W = window as any; const p = W.__lastMouse ?? { x: 0, y: 0 };
  // a BUTTON under the cursor: anchor at its right edge, one third down from its top
  const el = typeof document !== 'undefined' ? document.elementFromPoint?.(p.x, p.y) as HTMLElement | null : null;
  if (el && el.tagName === 'BUTTON') { const r = el.getBoundingClientRect(); return { x: r.right, y: r.top + r.height / 3 }; }
  return { x: p.x, y: p.y };
}
if (typeof window !== 'undefined') window.addEventListener('mousemove', e => { (window as any).__lastMouse = { x: e.clientX, y: e.clientY }; }, { passive: true });

function inspect(app: App, command: string, node: Node, keywords: string | null) {
  b11a(app).inspected.push({ via: 'InspectObj', command, nodes: [node], keywords });
  particleScripts(app).lastInspect = { via: 'InspectObj', nodes: [node], keywords: keywords ?? undefined };
  app.events.emit('inspect', node);
}
/** TrackPopupMenu (return command id, right button): the hook, else a DOM menu whose click runs the action. */
function trackPopup(app: App, rec: MenuRecord, onChoose: (i: number) => void) {
  const st = b11a(app);
  if (st.hooks.popupChoice) {
    const i = st.hooks.popupChoice(rec); rec.chosen = i === null || i === undefined || i < 0 || i >= rec.items.length ? null : i;
    if (rec.chosen !== null) onChoose(rec.chosen);
    return;
  }
  if (!interactive(app) || typeof document === 'undefined' || !rec.items.length) return; // nothing to show: same as cancel
  document.querySelector('.b11a-popup')?.remove();
  const m = document.createElement('div'); m.className = 'b11a-popup ctx-menu';
  m.style.cssText = `position:fixed;left:${rec.anchor.x}px;top:${rec.anchor.y}px;z-index:10000;background:var(--panel,#ddd);border:1px solid #777;padding:2px 0;font:12px sans-serif;min-width:120px`;
  rec.labels.forEach((label, i) => {
    const it = document.createElement('div'); it.textContent = label; it.style.cssText = 'padding:3px 14px;cursor:default';
    it.onmouseenter = () => { it.style.background = '#9ab'; }; it.onmouseleave = () => { it.style.background = ''; };
    it.onmouseup = (e) => { e.stopPropagation(); close(); rec.chosen = i; onChoose(i); };
    m.append(it);
  });
  const close = () => { m.remove(); window.removeEventListener('mousedown', outside, true); window.removeEventListener('keydown', esc, true); };
  const outside = (e: MouseEvent) => { if (!m.contains(e.target as any)) close(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  window.addEventListener('mousedown', outside, true); window.addEventListener('keydown', esc, true);
  document.body.append(m);
}

interface PopupKind { command: string; classes: string[]; entries(op: Operator, owner: X3DObject): Node[]; keywords: string | null }
const POPUPS: PopupKind[] = [
  {
    command: 'Particle Type Pop-up Menu', classes: [CLS.particleOpA, CLS.particleOpB, CLS.particleOpC], keywords: null,
    // port group 5, last port to first; connected objects exposing the particle type interface
    entries: (op) => [...((op as any).connections?.particleTypes ?? [])].reverse().filter(isParType),
  },
  {
    command: 'Goal Pop-up Menu', classes: [CLS.particleOpA], keywords: 'General',
    // port group 7 (sub-index 2), last port to first; connected objects exposing the goal interface
    entries: (op, owner) => [...((op as any).connections?.goals ?? []), ...owner.properties.filter(p => p.type === 'ParticleGoal')].reverse().filter((n, i, a) => n instanceof Node && a.indexOf(n) === i),
  },
];

function registerPopup(app: App, k: PopupKind) {
  reg(app, k.command, {
    undoable: false,
    execute(app, a) {
      const st = b11a(app); const C = k.command;
      const anchor = cursorAnchor(); const embedded = a.EmbeddedCommand ?? null; // stored, not used by the menu code
      const inputs = nodesArg(app, a.InputObjs);
      if (!inputs.length) { setStatus(app, C, S_FALSE); return; } // nothing to do
      const first = inputs[0]; const items: Node[] = [];
      const owner = first instanceof X3DObject ? first : null;
      for (const op of simulationOps(first)) {
        if (!k.classes.includes(classIdOf(op) ?? '')) continue; // operators of other classes are skipped
        for (const n of k.entries(op, owner!)) if (!items.includes(n)) items.push(n);
      }
      const rec: MenuRecord = { command: C, items, labels: items.map(n => n.name), anchor, embedded, chosen: null };
      st.menus.push(rec);
      trackPopup(app, rec, (i) => inspect(app, C, items[i], k.keywords));
      setStatus(app, C, S_OK);
    },
  });
}

// ------------------------------------------------------------------ SIMatchSubComponent
/** "obj.pnt[1,2]" / { obj } -> the owning object of a sub-component reference. */
function subComponentOwner(app: App, x: any): X3DObject | null {
  if (x instanceof X3DObject) return x;
  if (x && typeof x === 'object' && x.obj instanceof X3DObject) return x.obj;
  const s = text(Array.isArray(x) ? x[0] : x).trim(); if (!s) return null;
  const m = /^(.*?)\.(pnt|edge|poly|sample|knot|isopnt|isoline|subcrv|subsrf|bndry|nurbsbndry)\[/i.exec(s);
  const n = m ? app.scene.find(m[1]) : nodeArg(app, s);
  return n instanceof X3DObject ? n : n ? objOf(n) : null;
}

// ------------------------------------------------------------------ FindObjects
// class ids the contracts name; other GUIDs are not in this build's class table
const FIND_CLASSES: Record<string, (n: Node) => boolean> = {
  // CMD-B17b SetResolutionOfRefModels: the model class {0496EAB0-0ECF-11d1-ABF1-00A02485CECB} (inferred: every Model node)
  '0496eab0-0ecf-11d1-abf1-00a02485cecb': n => n instanceof Model,
  [CLS.pass]: n => n instanceof Pass, [CLS.layer]: n => n instanceof Layer, [CLS.parType]: n => isParType(n),
  [CLS.particleOpA]: n => n instanceof Operator && n.type === 'ParticlesOp', [CLS.particleOpB]: n => n instanceof Operator && n.type === 'FluidOp', [CLS.particleOpC]: n => n instanceof Operator && n.type === 'ExplosionOp',
};
function* everyNode(app: App): Generator<Node> {
  const S = app.scene; yield S.root;
  for (const o of S.allObjects()) {
    yield o; yield o.kinematics; for (const p of o.allProperties()) yield p;
    if (o.primitive) { yield o.primitive; for (const op of o.primitive.operators) yield op; }
    if (o.material) yield o.material;
  }
  for (const p of S.root.properties) yield p;
  yield* S.passes; yield* S.layers; yield* S.materials; yield* S.groupList; yield* particleScripts(app).particleTypes;
}
/** The owning model's flag parameter (GUID 0x18009d938 in the note). inferred stand-in: a `flags` field or a `Flags`
 *  parameter on the model; 0 when the build keeps neither. */
export const modelFlags = (m: Model): number => Number((m as any).flags ?? m.val?.('Flags') ?? 0) | 0;
/** Variant type 0x60 conversion of `Type` to a class id: a GUID (braces optional); null when it is not one. */
const guidOf = (s: string): string | null => { const m = /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i.exec(s.trim()); return m ? m[1].toLowerCase() : null; };

// ------------------------------------------------------------------ FilterPSet
// siPSetRelationship: the numeric values are not in the repo (note Q5). inferred bit values, matched by name or number.
const PSET_REL: Record<string, number> = { siContainedPSet: 1, siSharedPSet: 2, siInheritedPSet: 4 };
function relationshipFlags(p: Property): number { return p.shared ? PSET_REL.siSharedPSet : PSET_REL.siContainedPSet; }
function relationshipArg(v: any): number {
  if (typeof v === 'number') return v;
  const s = text(v).trim(); const m = /^:?([^:]+)/.exec(s); const name = m ? m[1] : s;
  if (PSET_REL[name] !== undefined) return PSET_REL[name];
  const n = Number(name); return Number.isFinite(n) ? n : 0;
}

// ------------------------------------------------------------------ ReorderSceneItem
// inferred: MoveAction 0 = first child, 1 = before Marker, 2 = after Marker, 3 = last child
function moveInHier(parent: X3DObject, item: X3DObject, action: number, marker: X3DObject | null): { prevParent: X3DObject | null; prevIndex: number } | null {
  const prevParent = item.parentObj; const prevIndex = prevParent ? prevParent.children.indexOf(item) : -1;
  if ((action === 1 || action === 2) && (!marker || marker.parentObj !== parent || marker === item)) return null;
  if (item === parent || [...item.descendants()].includes(parent)) return null;
  if (item.parentObj !== parent) parent.addChild(item); // SIMoveObjectInHier also moves the item under Parent (inferred)
  const kids = parent.children; kids.splice(kids.indexOf(item), 1);
  const at = action === 0 ? 0 : action === 3 ? kids.length : kids.indexOf(marker!) + (action === 2 ? 1 : 0);
  kids.splice(at, 0, item);
  return { prevParent, prevIndex };
}
function restorePlace(item: X3DObject, prevParent: X3DObject | null, prevIndex: number) {
  if (!prevParent) { item.parentObj?.removeChild(item); return; }
  if (item.parentObj !== prevParent) prevParent.addChild(item);
  const kids = prevParent.children; kids.splice(kids.indexOf(item), 1); kids.splice(Math.min(prevIndex, kids.length), 0, item);
}

export function registerTasksB11aMenus(app: App) {
  for (const k of POPUPS) registerPopup(app, k);

  reg(app, 'SIMatchSubComponent', {
    undoable: false,
    execute(app, a) {
      const C = 'SIMatchSubComponent';
      if (unset(a.InputObj)) throw fail(E_INVALIDARG, `${C}: InputObj is required`);
      if (unset(a.SubComp)) throw fail(E_INVALIDARG, `${C}: SubComp is required`);
      const obj = nodeArg(app, a.InputObj); if (!(obj instanceof X3DObject)) throw fail(E_INVALIDARG, `${C}: InputObj is not a component hierarchy object`);
      const owner = subComponentOwner(app, a.SubComp);
      if (!owner) throw fail(E_FAIL, `${C}: SubComp is not an element reference`);
      // F3DMatchSubComponent: S_OK exactly when it matches. inferred rule: the sub-component belongs to InputObj
      logNya(app, C, 'the matching rule of F3DMatchSubComponent; a sub-component matches when it belongs to InputObj');
      const result = owner === obj;
      setStatus(app, C, S_FALSE); // on success Do returns 1
      return result;
    },
  });

  reg(app, 'FindObjects', {
    undoable: false,
    execute(app, a) {
      // Batch 12 (note Q2): Type is converted to a class id (DS variant type 0x60); no class-name lookup. 0x3eb is the
      // error code raised with severity 2 and a literal text: "Both path and type given" / the (empty) Type string.
      const C = 'FindObjects'; const path = text(a.Path), type = text(a.Type);
      // (the bus logs the raised text as an error line, i.e. severity 2)
      if (path && type) throw fail(E_INVALIDARG, `${C}: Both path and type given`);
      if (!type) throw fail(E_NOTIMPL, `${C}: ${type}`);
      const guid = guidOf(type);
      if (!guid) { setStatus(app, C, S_FALSE); return undefined; } // failed conversion: S_FALSE, no list written
      const match = FIND_CLASSES[guid] ?? null;
      if (!match) { logNya(app, C, `the objects of class {${guid}} (not in this build's class table)`); setStatus(app, C, S_FALSE); return []; }
      const out: Node[] = [];
      for (const n of everyNode(app)) {
        if (out.includes(n) || !match(n)) continue;
        const m = ownerModel(n); if (m && (modelFlags(m) & 0x8)) continue; // owning model's flag parameter, bit 0x8 set: skipped
        out.push(n);
      }
      setStatus(app, C, S_FALSE);
      return out;
    },
  });

  reg(app, 'GetCurrentPass', {
    undoable: false,
    execute(app, a) {
      const C = 'GetCurrentPass'; setStatus(app, C, S_OK);
      if (boolA(a.Type)) return ((app as any).currentLayer as Layer | undefined) ?? app.scene.layers[0] ?? null;
      return currentPass(app) ?? null;
    },
  });

  reg(app, 'SetCurrentParType', {
    execute(app, a) {
      const C = 'SetCurrentParType'; const st = b11a(app); const type = Math.trunc(num(a.Type, 3));
      if (unset(a.Value)) throw fail(E_INVALIDARG, `${C}: Value is required`);
      const v = nodeArg(app, a.Value); if (!v) throw fail(E_INVALIDARG, `${C}: Value "${text(a.Value)}" not found`);
      const want = [CLS.pass, CLS.layer, CLS.contentItem, CLS.parType][type];
      if (want) {
        const cls = classIdOf(v);
        if (cls === null && !(v instanceof X3DObject) && !(v instanceof Property)) throw fail(E_NOINTERFACE, `${C}: ${v.name} has no class id`);
        if (cls !== want) throw fail(E_FAIL, `${C}: ${v.name} is not of the class Type ${type} asks for`);
      }
      const S = app.scene as any, A = app as any;
      let get: () => Node | null, set: (n: Node | null) => void;
      switch (type) {
        case 0: get = () => currentPass(app) ?? null; set = n => { S.currentPass = n; }; break;
        case 1: get = () => A.currentLayer ?? app.scene.layers[0] ?? null; set = n => { A.currentLayer = n; }; break;
        // Type 2: current item of the 3D content container's sub-container (GUID pair 0x18009d8f8 / 0x18009d848); no events
        case 2: get = () => st.currentContentItem; set = n => { st.currentContentItem = n; }; break;
        case 3: get = () => st.currentParType; set = n => { st.currentParType = n as Property | null; }; break;
        default: throw fail(E_UNEXPECTED, `${C}: Type ${type} is not 0..3`); // not rejected by UnPackArg: Do returns E_UNEXPECTED, nothing changes
      }
      const old = get();
      const apply = (from: Node | null, to: Node | null, fire: boolean) => {
        if (type === 0 && fire) st.events.push([0x20510029, from?.name ?? '', to?.name ?? '']);
        set(to);
        if (type === 0 && fire) st.events.push([0x2051002a, from?.name ?? '', to?.name ?? '']);
        app.events.emit('scene'); // the 3D content container refreshes
      };
      app.record(C, () => apply(old, v, true), () => apply(v, old, false));
      setStatus(app, C, S_OK);
    },
  });

  reg(app, 'FilterPSet', {
    undoable: false,
    execute(app, a) {
      const C = 'FilterPSet'; const rel = relationshipArg(a.Relationship); const include = boolA(a.Include ?? true);
      logNya(app, C, 'the numeric values of siPSetRelationship (siContainedPSet = 1, siSharedPSet = 2, siInheritedPSet = 4 are used)');
      const out: Node[] = [];
      for (const n of nodesArg(app, a.InputObjs)) {
        if (!(n instanceof Property)) continue; // inferred: an object without property relationship flags is not kept
        const hit = (relationshipFlags(n) & rel) !== 0;
        if (include ? !hit : hit) continue;
        if (include && n.shared && Number((n as any).owners?.length ?? 1) >= 3) continue; // multi-owner shared property
        out.push(n);
      }
      setStatus(app, C, S_FALSE);
      return out;
    },
  });

  reg(app, 'ReorderSceneItem', {
    execute(app, a) {
      const C = 'ReorderSceneItem'; const action = Math.trunc(num(a.MoveAction, 0));
      const parent = nodeArg(app, a.Parent), item = nodeArg(app, a.InputObj);
      if (!(parent instanceof X3DObject) || !(item instanceof X3DObject)) throw fail(E_INVALIDARG, `${C}: Parent and InputObj are required`);
      if (action < 0 || action > 3) { setStatus(app, C, S_OK); return; } // other actions do nothing
      let marker: X3DObject | null = null;
      if (action === 1 || action === 2) { const m = nodeArg(app, a.Marker); if (!(m instanceof X3DObject)) throw fail(E_INVALIDARG, `${C}: MoveAction ${action} requires a Marker`); marker = m; }
      if ((item as any).locked) throw fail(E_FAIL, `${C}: ${item.name} is locked`);
      let prev: { prevParent: X3DObject | null; prevIndex: number } | null = null;
      const probe = moveInHier.bind(null, parent, item, action, marker);
      app.record(C, () => { const r = probe(); if (!prev) prev = r; app.events.emit('scene'); }, () => { if (prev) restorePlace(item, prev.prevParent, prev.prevIndex); app.events.emit('scene'); });
      if (!prev) throw fail(E_FAIL, `${C}: ${item.name} cannot be moved there`);
      setStatus(app, C, S_OK);
    },
  });

  reg(app, 'CollapseOp', {
    execute(app, a) {
      // Batch 12 (note Q5): the per-operator step (task slot 15) is tasksB11aCollapse.ts. Each operator that can be
      // collapsed gives its "Offsets" shape key in the output list (inferred: what "resulting objects" are).
      const C = 'CollapseOp'; const relative = boolA(a.Relative ?? true);
      const ops = nodesArg(app, a.InputObjs).filter((n): n is Operator => n instanceof Operator);
      const out: Node[] = [];
      for (const op of ops) { const r = collapseOperator(app, op, relative); if (r) out.push(r.key); }
      app.events.emit('scene');
      setStatus(app, C, S_OK);
      a.Value = out; // RePackArg writes the list to the argument named Value
      return out;
    },
  });
}
