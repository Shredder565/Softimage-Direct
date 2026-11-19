// Ledger row CMD-B11b: PickElement, PickObject, EnumElements and "Obstalce Pop-up Menu" (tasks.dll).
// Brief: docs/ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md, section 3. Original code from the prose contract.
//
// The command bus is synchronous and cannot block on a pick, so the pick session is the hook
// `app.tasksB11b.pickHook` (scripts, checks and UI code install it). Without a hook in a user session the pick is
// reported as nothing picked and the missing blocking session is logged as "not yet attested".
import type { App } from '../core/commands';
import { Node, Property, X3DObject } from '../core/scene';
import { interactive } from './miscDsScriptsPick';
import { openSiMenu } from '../ui/si';
import {
  b11b, fail, setStatus, logNya, outputs, tasksText, unset, objectArg, listArg, nameOf,
  E_INVALIDARG, E_POINTER, S_OK, S_FALSE,
} from './tasksB11bShared';

const REGION_AMBIENT = 'SI3D_RECTSEL_REGION_MODE';
const RIGHT_PROMPT_ID = 0x40f; // XSITASKS: right-button prompt
const INSPECT_KEYWORDS = 'General';

// ------------------------------------------------------------------ pick
/** ButtonPressed from the raw pick flags: 0x2 cancelled -> 0, 0x10 middle -> 2, 0x1 / default -> 1; an item of kind 2
 *  answers its own button query instead (0 -> 1, 1 -> 2). */
export function buttonOf(flags: number, kind?: number, itemButton?: number): number {
  if (kind === 2 && itemButton !== undefined) return itemButton === 1 ? 2 : 1;
  if (flags & 0x2) return 0;
  if (flags & 0x10) return 2;
  return 1;
}
/** ModifierPressed bits: 1 Shift (0x4), 2 Ctrl (0x8), 4 Alt (0x80). */
export function modifierOf(flags: number): number { return (flags & 0x4 ? 1 : 0) | (flags & 0x8 ? 2 : 0) | (flags & 0x80 ? 4 : 0); }

/** "{guid}:name" -> name; a filter object -> its name. */
function filterName(f: any): string {
  if (typeof f === 'string') { const m = /^\{[^}]*\}:(.*)$/.exec(f.trim()); return m ? m[1] : f.trim(); }
  return String(f?.name ?? f);
}

function pick(app: App, C: string, a: Record<string, any>, hasRegion: boolean) {
  const st = b11b(app);
  // UnPackArg
  if (unset(a.SelFilter)) throw fail(E_INVALIDARG, `${C}: SelFilter does not give a selection filter`);
  const filter = filterName(a.SelFilter);
  const left = a.LeftMessage, middle = a.MiddleMessage;
  if (typeof left !== 'string' || typeof middle !== 'string') throw fail(E_INVALIDARG, `${C}: LeftMessage and MiddleMessage must be strings`);
  let region = 0; let unpackStatus = S_OK;
  if (hasRegion && !unset(a.SelRegionMode)) {
    const r = a.SelRegionMode;
    if (typeof r === 'number' && Number.isInteger(r)) region = r >= 1 && r <= 6 ? r : 0;
    else unpackStatus = E_INVALIDARG; // a non-integer variant: the result becomes E_INVALIDARG, parsing continues
  }
  if (unpackStatus !== S_OK) throw fail(unpackStatus, `${C}: SelRegionMode must be an integer`);

  const none = () => outputs(app, C, { PickedElement: undefined, ButtonPressed: 0, ModifierPressed: 0 });
  // Do
  if (!interactive(app)) { setStatus(app, C, S_OK); return none(); } // no interaction possible (inferred: batch / no UI)
  const right = tasksText(RIGHT_PROMPT_ID);
  const old = st.ambient[REGION_AMBIENT] ?? 0;
  const swap = region !== 0 && region !== old;
  if (swap) st.ambient[REGION_AMBIENT] = region;
  let res: ReturnType<NonNullable<typeof st.pickHook>> = null;
  try {
    if (st.pickHook) res = st.pickHook(filter, left, middle, right, swap ? region : old);
    else logNya(app, C, `a blocking pick session on the synchronous command bus (filter "${filter}", left "${left}", middle "${middle}", right "${right}"); install app.tasksB11b.pickHook to answer picks. Nothing was picked`);
  } finally { if (swap) st.ambient[REGION_AMBIENT] = old; }
  setStatus(app, C, S_OK);
  // RePackArg
  const list = res?.picked ?? [];
  if (!res || !list.length) return none();
  return outputs(app, C, { PickedElement: list[0], ButtonPressed: buttonOf(res.flags, res.kind, res.itemButton), ModifierPressed: modifierOf(res.flags) });
}

// ------------------------------------------------------------------ EnumElements
/** inferred: the element hierarchy of this build is the Explorer hierarchy (Node.explorerChildren / Node.parent). */
function enumChildren(n: Node): Node[] { return n.explorerChildren(); }
function enumParents(n: Node): Node[] { const p = n.parent; return p instanceof Node ? [p] : []; }

// ------------------------------------------------------------------ obstacle menu
/** Obstacles connected to the inputs: through their simulation operators (operators carrying `connections`, the
 *  legacy particle model); an obstacle-class entry (an obstacle property) stands for the item it is connected to. */
function connectedObstacles(app: App, C: string, inputs: any[]): Node[] {
  const out: Node[] = [];
  const add = (n: Node) => { if (!out.includes(n)) out.push(n); };
  for (const x of inputs) {
    const o = x instanceof X3DObject ? x : null; if (!o) continue;
    const simOps = (o.primitive?.operators ?? []).filter(op => (op as any).connections); // F3DGetSimulationOps
    for (const op of simOps) {
      for (const ob of ((op as any).connections.obstacles ?? []) as Node[]) {
        if (ob instanceof Property && /obstacle/i.test(ob.type)) { if (ob.parent instanceof Node) add(ob.parent); } // obstacle class -> connected item (inferred mapping)
        else if (ob instanceof Node) add(ob);
      }
    }
  }
  if (out.length) logNya(app, C, 'which of the three obstacle classes (3ee7b553 / 71240cfd kind 2 / c41aa2c3 kind 3) each entry belongs to; obstacle properties are listed by their owner');
  return out;
}

export function registerTasksB11bPick(app: App, reg: (name: string, def: { description?: string; undoable?: boolean; execute: (app: App, a: Record<string, any>) => any }) => void) {
  reg('PickElement', { description: 'Returns the element resulting of a picking session according a given selection filter', undoable: false, execute: (app, a) => pick(app, 'PickElement', a, true) });
  // Same task: SelFilter arrives as a string, no SelRegionMode (the ambient value is never touched).
  reg('PickObject', { description: 'Returns the object resulting of a picking session according a given selection filter', undoable: false, execute: (app, a) => pick(app, 'PickObject', a, false) });

  reg('EnumElements', {
    description: 'Enumerates the elements which are under a given component', undoable: false,
    execute(app, a) {
      const C = 'EnumElements';
      const o = objectArg(app, a.InputObj);
      if (!o) throw fail(E_POINTER, `${C}: no input element`);
      const caps = unset(a.Capabilities) ? 524288 : Number(a.Capabilities) >>> 0;
      if (caps !== 524288) logNya(app, C, `the meaning of Capabilities 0x${caps.toString(16)}; elements are not filtered by capability`);
      const children = a.EnumChildren === undefined || a.EnumChildren === null ? true : !!a.EnumChildren && a.EnumChildren !== 'false';
      const list = children ? enumChildren(o) : enumParents(o); // SIEnumElementChildren (inferred name) / SIEnumElementParents
      setStatus(app, C, S_OK);
      return list;
    },
  });

  // Track the cursor for the popup anchor (the binary reads the cursor position and the window under it).
  if (typeof document !== 'undefined') document.addEventListener('pointermove', e => { const c = b11b(app).cursor; c.x = e.clientX; c.y = e.clientY; c.target = e.target as Element; }, { passive: true, capture: true });

  reg('Obstalce Pop-up Menu', {
    description: 'Pop-up a menu of connected Obstacles', undoable: false,
    execute(app, a) {
      const C = 'Obstalce Pop-up Menu'; const st = b11b(app);
      // UnPackArg: keep EmbeddedCommand; anchor = cursor, or a button's right edge one third down
      const embedded = a.EmbeddedCommand ?? null;
      const anchor = { x: st.cursor.x, y: st.cursor.y };
      const under = st.cursor.target?.closest?.('button');
      if (under) { const r = under.getBoundingClientRect(); anchor.x = r.right; anchor.y = r.top + r.height / 3; }
      const inputs = listArg(app, a.InputObjs);
      if (!inputs.length) { setStatus(app, C, S_FALSE); return undefined; } // nothing to do
      // Do
      const items = connectedObstacles(app, C, inputs);
      const finish = () => {
        setStatus(app, C, S_OK);
        if (embedded && typeof embedded.notify === 'function') embedded.notify(); // the embedded command's slot 0x58
      };
      const inspect = (n: Node) => app.run('InspectObj', { InputObjs: n instanceof X3DObject ? n : nameOf(n), Keywords: INSPECT_KEYWORDS }); // mode field 0
      if (!items.length) { finish(); return undefined; } // inferred: an empty menu is not shown
      const labels = items.map(n => n.name);
      if (st.menuHook) { const i = st.menuHook(labels, anchor); if (i >= 0 && i < items.length) inspect(items[i]); finish(); return undefined; }
      if (!interactive(app) || typeof document === 'undefined') { logNya(app, C, 'the popup menu outside a user session; nothing was chosen'); finish(); return undefined; }
      openSiMenu(labels.map(label => ({ label })), anchor.x, anchor.y, (it: any) => { const i = labels.indexOf(it.label); if (i >= 0) inspect(items[i]); });
      finish();
      return undefined;
    },
  });
}
