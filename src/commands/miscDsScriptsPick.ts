// Ledger row CMD-B5f support: pick sessions for the interactive script commands (docs/ghidra/cmd-b5f-misc-dsscripts.md,
// "Pick-position loop" and the pick paths of SelectUVRow / RetargetTagRig / RetargetRigToRig). Original code.
//
// Softimage's pick calls block and report { ButtonPressed, value, ModifierPressed }. The command bus here is
// synchronous and cannot block, so a session installs a viewport tool and hands every pick to a callback:
//   button   0 = right button / Escape (ends the session), 1 = left, 2 = middle
//   modifier 0 = none, 1 = Shift, 2 = Ctrl, 3 = Shift+Ctrl
// The session is also reachable as `app.miscDsScripts.session` so scripts and checks can feed picks:
// `session.pick(value, button, modifier)` / `session.cancel()`.
// inferred: the viewport reports left clicks only, so a middle-button pick is available through `session.pick`.
import type { App, InteractiveTool } from '../core/commands';
import type { X3DObject } from '../core/scene';

type V3 = [number, number, number];
type ToolPick = { obj: X3DObject; kind: 'point' | 'edge' | 'polygon'; item: number | string; worldPoint: V3 } | null;

export interface PickSession {
  command: string;
  kind: 'position' | 'element';
  /** Selection filter of an element pick ("Point", "Model"). */
  filter: string;
  prompt: string;
  middlePrompt: string;
  active: boolean;
  /** Number of picks handled so far. */
  picks: number;
  pick(value: any, button?: number, modifier?: number): void;
  cancel(): void;
}
export interface PickSessionSpec {
  command: string;
  kind: 'position' | 'element';
  filter?: string;
  prompt: string;
  middlePrompt?: string;
  pickKind?: 'point' | 'edge' | 'polygon';
  /** Also treat a selection change (explorer pick) as a left-button pick of the last selected node. */
  followSelection?: boolean;
  /** Value of a viewport click; null = nothing picked. */
  fromClick(p: V3, pick: ToolPick, e: { shift: boolean; ctrl: boolean }): any;
  /** Handle one pick; return true to ask again, false to end the session. */
  onPick(value: any, button: number, modifier: number): boolean;
  onEnd?(): void;
}

export const interactive = (app: App) => (app as any).Interactive !== false;

/** Start a pick session. Returns null (after logging) when there is no user session: the pick counts as cancelled. */
export function startPickSession(app: App, spec: PickSessionSpec): PickSession | null {
  if (!interactive(app)) {
    app.logMsg('info', `${spec.command}: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscripts.md Q4)`);
    return null;
  }
  const state = (app as any).miscDsScripts as { session: PickSession | null } | undefined;
  let busy = false; let off: (() => void) | null = null;
  const end = () => {
    if (!session.active) return;
    session.active = false; off?.();
    if (state && state.session === session) state.session = null;
    if (app.activeTool === tool) { app.activeTool = null; app.events.emit('selection'); }
    spec.onEnd?.();
  };
  const session: PickSession = {
    command: spec.command, kind: spec.kind, filter: spec.filter ?? '', prompt: spec.prompt, middlePrompt: spec.middlePrompt ?? '', active: true, picks: 0,
    pick(value, button = 1, modifier = 0) {
      if (!session.active || busy) return;
      if (button === 0) { end(); return; }
      busy = true; let again = true;
      try { session.picks++; again = spec.onPick(value, button, modifier); } finally { busy = false; }
      if (!again) end();
    },
    cancel: end,
  };
  const tool: InteractiveTool = {
    name: spec.command,
    prompt: spec.middlePrompt ? `${spec.prompt} / ${spec.middlePrompt}` : spec.prompt,
    pickKind: spec.pickKind,
    onClick(p, pick, e) {
      const button = (e as any).button === 1 ? 2 : 1;
      session.pick(spec.fromClick(p, pick, e), button, (e.shift ? 1 : 0) | (e.ctrl ? 2 : 0));
    },
    onFinish() { end(); },   // right click / Enter
    onCancel() { end(); },   // Escape, or another tool taking over
  };
  state?.session?.cancel();
  app.setTool(tool);
  if (state) state.session = session;
  if (spec.followSelection) {
    // Only a node that newly became the last selected one counts as a pick (unrelated selection events are ignored).
    let seen: any = app.selection[app.selection.length - 1] ?? null;
    off = app.events.on('selection', () => {
      const cur: any = app.selection[app.selection.length - 1] ?? null;
      if (cur === seen) return; seen = cur;
      if (cur && session.active && !busy) { session.pick(cur, 1, 0); seen = app.selection[app.selection.length - 1] ?? null; }
    }) as any;
  }
  return session;
}
