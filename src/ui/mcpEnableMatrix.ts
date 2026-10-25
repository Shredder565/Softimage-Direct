// Softimage-attested MCP / command enable matrix (headless dump pack).
// Source: softimage-pc ui/si_mcp_enabled_matrix.json — PE f_grayed defaults + XSIBATCH Command.Enabled.
// Null Enabled → fall back to Direct canRun (Ghidra GetEnabled model). No invented greying.
// PE grey: prefer RT_MENU cmd id; ambiguous short labels require cmd (avoids greying unrelated "Symmetry"/"Clear").

import type { App } from '../core/commands';
import matrix from '../data/si/mcp_enabled_matrix.json';

export type McpSelContext =
  | 'empty'
  | 'single_mesh'
  | 'multi_mesh'
  | 'single_null'
  | 'keyed_null'
  | 'mesh_skeleton'
  | 'mesh_points_attempt'
  | 'single_camera'
  | 'single_light'
  | 'parented_child'
  | 'group_selected'
  | 'multi_mixed';

type MatrixFile = {
  meta: { softimage?: string; source?: string; mode?: string; note?: string; pe_gray_policy?: string };
  contexts: Record<string, { selection?: unknown; commands: Record<string, boolean | null> }>;
  command_aliases?: Record<string, string>;
  pe_static_grayed: { menu: number; label: string; cmd: number | null; norm: string }[];
  pe_grayed_cmds?: number[];
  pe_grayed_safe_norms?: string[];
  pe_grayed_ambiguous_norms?: string[];
  bool_attested: string[];
  /** Optional Softimage Desktop / Script Editor HWND chrome overlay (null → canRun). */
  hwnd_buttons?: Record<string, Record<string, boolean | null>>;
};

const M = matrix as MatrixFile;

const GRAYED_CMDS = new Set<number>(
  (M.pe_grayed_cmds?.length ? M.pe_grayed_cmds : M.pe_static_grayed.map(r => r.cmd).filter((c): c is number => typeof c === 'number'))
);
const SAFE_NORMS = new Set<string>(
  M.pe_grayed_safe_norms?.length
    ? M.pe_grayed_safe_norms
    : M.pe_static_grayed.map(r => r.norm).filter(n => n && n.length >= 12)
);
const ALIASES: Record<string, string> = { ...(M.command_aliases ?? {}) };

function normLabel(s: string): string {
  return s.replace(/&/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isMesh(o: { primitive?: { mesh?: () => unknown } | null; type?: string }): boolean {
  return !!o.primitive?.mesh?.() || /polymsh|polymesh|mesh/i.test(String(o.type ?? ''));
}
function isNull(o: { type?: string }): boolean {
  return /^null$/i.test(String(o.type ?? ''));
}
function isCamera(o: { type?: string }): boolean {
  return /camera/i.test(String(o.type ?? ''));
}
function isLight(o: { type?: string }): boolean {
  return /light|spot|point|infinite/i.test(String(o.type ?? ''));
}

/** Map Direct selection to Softimage dump contexts (XSIBATCH matrix keys). */
export function mcpSelectionContext(app: App): McpSelContext {
  const sel = app.selectedObjects;
  if (!sel.length) return 'empty';
  const mode = String(app.selMode ?? 'object').toLowerCase();
  if (sel.length === 1 && isMesh(sel[0]) && mode !== 'object') return 'mesh_points_attempt';
  if (sel.length === 1 && isCamera(sel[0])) return 'single_camera';
  if (sel.length === 1 && isLight(sel[0])) return 'single_light';
  if (sel.length === 1 && isNull(sel[0])) return 'single_null';
  if (sel.length === 1 && isMesh(sel[0])) return 'single_mesh';
  if (sel.length >= 2 && sel.every(isMesh)) return 'multi_mesh';
  if (sel.length >= 2 && sel.some(isMesh) && sel.some(o => !isMesh(o))) return 'multi_mixed';
  // Parented child: single non-root under another scene object (dump when PC expands).
  if (sel.length === 1 && sel[0].parentObj && sel[0].parentObj !== app.scene.root) return 'parented_child';
  if (sel.length === 1) return isMesh(sel[0]) ? 'single_mesh' : 'single_null';
  return 'multi_mesh';
}

/** Context fallbacks when an expanded dump key is not yet in the matrix. */
function contextFallbacks(ctx: McpSelContext): McpSelContext[] {
  switch (ctx) {
    case 'single_null':
      // Desktop Anim HWND: keyed_null (null + keys) attested mixer cmds
      return [ctx, 'keyed_null', 'empty'];
    case 'keyed_null':
      return [ctx, 'single_null', 'empty'];
    case 'mesh_skeleton':
      return [ctx, 'multi_mixed', 'multi_mesh', 'empty'];
    case 'single_camera':
    case 'single_light':
      return [ctx, 'single_null', 'keyed_null', 'empty'];
    case 'parented_child':
      return [ctx, 'single_null', 'keyed_null', 'single_mesh', 'empty'];
    case 'group_selected':
      return [ctx, 'multi_mesh', 'mesh_skeleton', 'empty'];
    case 'multi_mixed':
      return [ctx, 'mesh_skeleton', 'multi_mesh', 'empty'];
    case 'multi_mesh':
      return [ctx, 'mesh_skeleton', 'empty'];
    default:
      return [ctx];
  }
}

function lookupBool(ctx: string, name: string): boolean | null | undefined {
  const block = M.contexts[ctx];
  if (!block || !(name in block.commands)) return undefined;
  const v = block.commands[name];
  return v === null || v === undefined ? null : !!v;
}

/**
 * Softimage XSIBATCH Command.Enabled for the current selection context.
 * Returns null when the dump has no bool (most MCP leaves) — caller keeps canRun.
 * Tool aliases (TranslateTool→Translate) reuse attested base bools when the Tool
 * cell is null/missing (XSIBATCH often finds Tool names as hollow stubs).
 */
export function matrixCommandEnabled(app: App, name: string): boolean | null {
  const alias = ALIASES[name];
  for (const ctx of contextFallbacks(mcpSelectionContext(app))) {
    const direct = lookupBool(ctx, name);
    if (direct === true || direct === false) return direct;
    if (alias && alias !== name) {
      const via = lookupBool(ctx, alias);
      if (via === true || via === false) return via;
    }
    // Exact key present as null and no alias bool → attested null (fall back canRun).
    if (direct === null) return null;
  }
  return null;
}

/**
 * PE RT_MENU static f_grayed default (resource bit).
 * Prefer cmd id (Softimage menu item id). Ambiguous short labels only grey when cmd matches.
 */
export function peMenuItemGrayed(label: string | undefined | null, cmdId?: number | null): boolean {
  if (typeof cmdId === 'number' && GRAYED_CMDS.has(cmdId)) return true;
  if (!label) return false;
  const n = normLabel(label);
  if (!n) return false;
  // Cmd present but not in PE grey set: still allow unique long Softimage labels
  // (Direct menu ids sometimes differ from PE cmd, e.g. Create Cluster with Center).
  return SAFE_NORMS.has(n);
}

/** HWND / chrome button overlay (Desktop overnight or Script Editor paste). Null → canRun. */
export function hwndButtonEnabled(app: App, button: string): boolean | null {
  const hwnd = M.hwnd_buttons;
  if (!hwnd) return null;
  for (const ctx of contextFallbacks(mcpSelectionContext(app))) {
    const row = hwnd[ctx];
    if (!row || !(button in row)) continue;
    const v = row[button];
    return v === null || v === undefined ? null : !!v;
  }
  return null;
}

export function mcpMatrixMeta() {
  const animHwnd = (M.meta as { anim_hwnd_overlay?: unknown }).anim_hwnd_overlay;
  return {
    softimage: M.meta.softimage ?? null,
    source: M.meta.source ?? null,
    boolAttested: [...(M.bool_attested ?? [])],
    peGrayedCount: M.pe_static_grayed.length,
    peGrayedCmds: GRAYED_CMDS.size,
    peGrayedSafeNorms: SAFE_NORMS.size,
    peGrayPolicy: M.meta.pe_gray_policy ?? 'cmd_id_first_then_safe_norm',
    contexts: Object.keys(M.contexts),
    aliases: { ...ALIASES },
    hasHwndOverlay: !!M.hwnd_buttons && Object.keys(M.hwnd_buttons).length > 0,
    hasAnimHwndOverlay: !!animHwnd,
  };
}
