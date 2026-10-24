// Softimage-attested MCP / command enable matrix (headless dump pack).
// Source: softimage-pc ui/si_mcp_enabled_matrix.json — PE f_grayed defaults + XSIBATCH Command.Enabled.
// Null Enabled → fall back to Direct canRun (Ghidra GetEnabled model). No invented greying.

import type { App } from '../core/commands';
import matrix from '../data/si/mcp_enabled_matrix.json';

export type McpSelContext = 'empty' | 'single_mesh' | 'multi_mesh' | 'single_null' | 'mesh_points_attempt';

type MatrixFile = {
  meta: { softimage?: string; source?: string; mode?: string; note?: string };
  contexts: Record<string, { selection?: unknown; commands: Record<string, boolean | null> }>;
  pe_static_grayed: { menu: number; label: string; cmd: number | null; norm: string }[];
  bool_attested: string[];
};

const M = matrix as MatrixFile;

const GRAYED_NORMS = new Set(M.pe_static_grayed.map(r => r.norm));

function normLabel(s: string): string {
  return s.replace(/&/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Map Direct selection to Softimage dump contexts (XSIBATCH matrix keys). */
export function mcpSelectionContext(app: App): McpSelContext {
  const sel = app.selectedObjects;
  if (!sel.length) return 'empty';
  const mode = String(app.selMode ?? 'object').toLowerCase();
  const isMesh = (o: (typeof sel)[number]) =>
    !!o.primitive?.mesh?.() || /polymsh|polymesh|mesh/i.test(String(o.type ?? ''));
  const isNull = (o: (typeof sel)[number]) => /^null$/i.test(String(o.type ?? ''));
  if (sel.length === 1 && isMesh(sel[0]) && mode !== 'object') return 'mesh_points_attempt';
  if (sel.length === 1 && isNull(sel[0])) return 'single_null';
  if (sel.length === 1 && isMesh(sel[0])) return 'single_mesh';
  if (sel.length >= 2 && sel.every(isMesh)) return 'multi_mesh';
  if (sel.length === 1) return isMesh(sel[0]) ? 'single_mesh' : 'single_null';
  return 'multi_mesh';
}

/**
 * Softimage XSIBATCH Command.Enabled for the current selection context.
 * Returns null when the dump has no bool (most MCP leaves) — caller keeps canRun.
 */
export function matrixCommandEnabled(app: App, name: string): boolean | null {
  const ctx = mcpSelectionContext(app);
  const block = M.contexts[ctx];
  if (!block) return null;
  if (!(name in block.commands)) return null;
  const v = block.commands[name];
  return v === null || v === undefined ? null : !!v;
}

/** PE RT_MENU static f_grayed default (resource bit) — Softimage-attested grey seed. */
export function peMenuItemGrayed(label: string | undefined | null): boolean {
  if (!label) return false;
  return GRAYED_NORMS.has(normLabel(label));
}

export function mcpMatrixMeta() {
  return {
    softimage: M.meta.softimage ?? null,
    source: M.meta.source ?? null,
    boolAttested: [...(M.bool_attested ?? [])],
    peGrayedCount: M.pe_static_grayed.length,
    contexts: Object.keys(M.contexts),
  };
}
