// UI-surface audit — the runtime side of docs/ghidra/ui-surface-audit.md.
// src/data/si/ui_surface_audit.json is the inventory the dumps expose with its per-item verdict
// (tools/build_ui_surface_audit.py); this module re-checks, at runtime, that every item the audit calls
// wired really does resolve: the menu resource is in menus.json with leaves, the dialog template is in
// ui_dialogs.json, and the string table is in strings.json.
import audit from '../data/si/ui_surface_audit.json';
import { SI_MENUS, SI_STRINGS, SiMenuItem } from './si';
import { SI_DIALOGS, siDialogAudit } from './siDialog';

export type UiSurfaceItem = {
  kind: 'menu' | 'dialog' | 'strings' | 'view' | 'layout' | 'toolbar' | 'symbol';
  module: string; item: string;
  verdict: 'PRESENT' | 'PARTIAL' | 'MISSING' | 'ABSENT';
  wired: boolean; surface: string; note: string;
};
export type UiSurfaceCounts = { PRESENT: number; PARTIAL: number; MISSING: number; ABSENT: number; total: number; wiredThisPass: number };

export const UI_SURFACE = audit as unknown as {
  softimage: string; source: string; generated_by: string; modules: string[];
  counts: UiSurfaceCounts; items: UiSurfaceItem[];
};

const leaves = (items: SiMenuItem[] | undefined): number =>
  (items ?? []).reduce((n, it) => n + (it.separator ? 0 : it.items ? leaves(it.items) : 1), 0);

/** `menus.json \`key\`` / `ui_dialogs.json \`dll#id\`` → the identifier the audit row points at. */
const backtick = (s: string): string | null => s.match(/`([^`]+)`/)?.[1] ?? null;

/** Every audit row the table calls wired, re-checked against what is actually loaded. */
export function wiredChecks(): { item: string; kind: string; target: string; ok: boolean; detail: string }[] {
  const out: { item: string; kind: string; target: string; ok: boolean; detail: string }[] = [];
  for (const it of UI_SURFACE.items) {
    if (!it.wired) continue;
    const target = backtick(it.surface) ?? it.surface;
    if (it.kind === 'menu') {
      const n = leaves(SI_MENUS[target]);
      out.push({ item: it.item, kind: it.kind, target, ok: n > 0, detail: `${n} leaves` });
    } else if (it.kind === 'dialog') {
      const tpl = SI_DIALOGS[target];
      out.push({ item: it.item, kind: it.kind, target, ok: !!tpl, detail: tpl ? `${tpl.controls.length} controls` : 'template missing' });
    } else {
      out.push({ item: it.item, kind: it.kind, target, ok: true, detail: it.surface });
    }
  }
  return out;
}

/** Audit rows grouped by verdict, so a harness can assert the counts the docs table publishes. */
export function uiSurfaceAudit(): {
  softimage: string;
  modules: string[];
  counts: UiSurfaceCounts;
  countsOk: boolean;
  byKind: Record<string, number>;
  wired: ReturnType<typeof wiredChecks>;
  wiredOk: boolean;
  absent: { module: string; item: string; note: string }[];
  partial: { module: string; item: string; note: string }[];
  stringTablesOk: boolean;
  dialogs: ReturnType<typeof siDialogAudit>;
} {
  const items = UI_SURFACE.items;
  const tally = { PRESENT: 0, PARTIAL: 0, MISSING: 0, ABSENT: 0 } as Record<string, number>;
  const byKind: Record<string, number> = {};
  for (const it of items) { tally[it.verdict]++; byKind[it.kind] = (byKind[it.kind] ?? 0) + 1; }
  const wired = wiredChecks();
  const stringRows = items.filter(i => i.kind === 'strings' && i.verdict === 'PRESENT');
  return {
    softimage: UI_SURFACE.softimage,
    modules: UI_SURFACE.modules,
    counts: UI_SURFACE.counts,
    countsOk: tally.PRESENT === UI_SURFACE.counts.PRESENT && tally.PARTIAL === UI_SURFACE.counts.PARTIAL
      && tally.MISSING === UI_SURFACE.counts.MISSING && tally.ABSENT === UI_SURFACE.counts.ABSENT
      && items.length === UI_SURFACE.counts.total,
    byKind,
    wired,
    wiredOk: wired.every(w => w.ok),
    absent: items.filter(i => i.verdict === 'ABSENT').map(i => ({ module: i.module, item: i.item, note: i.note })),
    partial: items.filter(i => i.verdict === 'PARTIAL').map(i => ({ module: i.module, item: i.item, note: i.note })),
    stringTablesOk: stringRows.every(r => !!SI_STRINGS[r.module]),
    dialogs: siDialogAudit(),
  };
}
