// Runtime side of docs/ghidra/animate-surface-audit.md.
// Verdicts are the pre-pass inventory. This module checks that every row marked wired still resolves.
import audit from '../data/si/animate_surface_audit.json';
import { App } from '../core/commands';
import { SI_MENUS } from './si';
import { animChrome } from './animChrome';
import { CURRENT_TIME_DIALOG } from './animateDialogs';

export type AnimateVerdict = 'PRESENT' | 'PARTIAL' | 'MISSING' | 'ABSENT';
export type AnimateSurfaceItem = {
  kind: string;
  module: string;
  item: string;
  verdict: AnimateVerdict;
  wired: boolean;
  surface: string;
  note: string;
};
export type AnimateSurfaceCounts = {
  PRESENT: number; PARTIAL: number; MISSING: number; ABSENT: number; total: number; wiredThisPass: number;
};

export const ANIMATE_SURFACE = audit as unknown as {
  softimage: string;
  source: string;
  counts: AnimateSurfaceCounts;
  items: AnimateSurfaceItem[];
};

const TRACKS = ['Insert Animation Track', 'Insert Shape Track', 'Insert Audio Track'];

function rowOk(app: App, it: AnimateSurfaceItem): boolean {
  if (it.kind === 'command') return app.commands.has(it.item);
  if (it.kind === 'dialog') return !!CURRENT_TIME_DIALOG?.title;
  if (it.item.startsWith('Keying Panel')) return (SI_MENUS.keyingPanel?.length ?? 0) > 0;
  if (it.item.startsWith('Mixer Track')) return TRACKS.every(l => (animChrome.mixer_tools as string[]).includes(l)) && app.commands.has('AddTrack');
  return true;
}

export function animateSurfaceAudit(app: App) {
  const items = ANIMATE_SURFACE.items;
  const tally = { PRESENT: 0, PARTIAL: 0, MISSING: 0, ABSENT: 0 };
  for (const it of items) tally[it.verdict]++;
  const counts = ANIMATE_SURFACE.counts;
  const countsOk = tally.PRESENT === counts.PRESENT && tally.PARTIAL === counts.PARTIAL
    && tally.MISSING === counts.MISSING && tally.ABSENT === counts.ABSENT
    && items.length === counts.total;
  const wired = items.filter(it => it.wired).map(it => ({ item: it.item, kind: it.kind, ok: rowOk(app, it) }));
  const failed = wired.filter(w => !w.ok);
  const wiredOk = failed.length === 0;
  return {
    ok: countsOk && wiredOk,
    counts,
    countsOk,
    wiredOk,
    failed,
    absent: items.filter(i => i.verdict === 'ABSENT').map(i => ({ module: i.module, item: i.item, note: i.note })),
    partial: items.filter(i => i.verdict === 'PARTIAL').map(i => ({ item: i.item, note: i.note })),
  };
}

/** Layer create/delete plus the two commands the mixer and fcurve rows depend on. */
export function animateSurfaceSmoke(app: App) {
  const before = app.anim.layers.length;
  app.run('AddAnimationLayer', { Name: 'AuditLayer', MakeCurrent: false });
  const n = app.run('GetNumberOfAnimationLayers');
  const idx = app.anim.layers.findIndex(l => l.name === 'AuditLayer');
  if (idx >= 0) app.run('DeleteAnimationLayer', { Layer: idx });
  const surface = animateSurfaceAudit(app);
  const addTrack = app.commands.has('AddTrack');
  const evalFCurve = app.commands.has('EvalFCurve');
  const ok = n === before + 1 && app.anim.layers.length === before && addTrack && evalFCurve && surface.wiredOk && surface.countsOk;
  return { ok, layers: n, restored: app.anim.layers.length === before, addTrack, evalFCurve, wiredOk: surface.wiredOk, countsOk: surface.countsOk, failed: surface.failed };
}
