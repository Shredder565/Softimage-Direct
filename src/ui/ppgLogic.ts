// Softimage GenPpg / sicoresdk PPG script logic — WR-06.
// Attested strings (genppg.dll Ghidra): OnInit, _OnChanged, PPGLayout, PPG_LOGIC_NOTIFY.
// Dispatch Softimage PPGEvent names only — no invent callback bodies / no Softimage C++ paste.
import type { App } from '../core/commands';
import type { Node } from '../core/scene';
import type { Parameter } from '../core/params';

export type PpgEventName = 'OnInit' | '_OnChanged' | 'PPG_LOGIC_NOTIFY';

export interface PpgEvent {
  /** Softimage PPGEvent name (genppg / CXSIPPGEventContextCore). */
  event: PpgEventName;
  node: Node;
  /** Parameter SN for _OnChanged (Softimage Parameter.Name). */
  param?: string;
  value?: unknown;
  /** Softimage PPGLayout presence (layout tabs/groups already on ParamSet). */
  hasLayout: boolean;
}

const g = () => globalThis as any;

/** Last PPG inspected node — Softimage property-page host state. */
export function getPpgLogicState(): { node: Node | null; inited: WeakSet<Node> } {
  if (!g().__siPpgLogic) {
    g().__siPpgLogic = { node: null as Node | null, inited: new WeakSet<Node>() };
  }
  return g().__siPpgLogic;
}

function hasPpgLayout(node: Node): boolean {
  const lay = (node as any).layout;
  return Array.isArray(lay) && lay.length > 0;
}

/** Softimage PPG OnInit — fired once per inspected node open (CDSPropertyFrame::OnInitDialog). */
export function dispatchPpgOnInit(app: App, node: Node | null | undefined) {
  if (!node) return;
  const st = getPpgLogicState();
  st.node = node;
  if (st.inited.has(node)) return;
  st.inited.add(node);
  const ev: PpgEvent = { event: 'OnInit', node, hasLayout: hasPpgLayout(node) };
  g().__siLastPpgEvent = ev;
  app.events.emit('ppg', ev);
  // Softimage PPG_LOGIC_NOTIFY after OnInit when layout present (genppg PPG_LOGIC_NOTIFY string).
  if (ev.hasLayout) {
    const notify: PpgEvent = { event: 'PPG_LOGIC_NOTIFY', node, hasLayout: true };
    g().__siLastPpgEvent = notify;
    app.events.emit('ppg', notify);
  }
}

/** Softimage parameter `_OnChanged` — fired when PPG edits a parameter (PropertyChanged). */
export function dispatchPpgOnChanged(app: App, param: Parameter) {
  const node = param.owner as unknown as Node | undefined;
  if (!node) return;
  const ev: PpgEvent = {
    event: '_OnChanged',
    node,
    param: param.name,
    value: param.value,
    hasLayout: hasPpgLayout(node),
  };
  g().__siLastPpgEvent = ev;
  app.events.emit('ppg', ev);
}

/** Compact audit for __uiAudit / behavioral axis E. */
export function ppgLogicAudit(): Record<string, unknown> {
  const last = g().__siLastPpgEvent as PpgEvent | undefined;
  return {
    wire: 'WR-06',
    attested: ['OnInit', '_OnChanged', 'PPGLayout', 'PPG_LOGIC_NOTIFY'],
    lastEvent: last?.event ?? null,
    lastParam: last?.param ?? null,
    lastHasLayout: last?.hasLayout ?? null,
  };
}
