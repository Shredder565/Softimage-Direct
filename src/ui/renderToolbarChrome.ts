// Softimage Render toolbar pixel chrome — PE RT_MENU/BITMAP W/H only
// (unlock render.toolbar_pixel_chrome). Eye chrome beyond attested W/H stays LOCK invent.
import chrome from '../data/si/render_toolbar_chrome.json';

export type RenderToolbarChrome = typeof chrome;
export const RENDER_TOOLBAR_CHROME = chrome as RenderToolbarChrome;

/** rendercore.dll sample toolbar bitmaps 105–108 — attested 22×22. */
export const RENDER_TOOLBAR_CELL_WH = RENDER_TOOLBAR_CHROME.toolbarCellWh as {
  w: number;
  h: number;
  source?: string;
};

/** Apply PE-attested Render toolbar cell W/H as CSS custom properties. */
export function applyRenderToolbarChrome(host?: HTMLElement | null): void {
  const root = host ?? document.documentElement;
  root.style.setProperty('--render-tb-cell-w', `${RENDER_TOOLBAR_CELL_WH.w}px`);
  root.style.setProperty('--render-tb-cell-h', `${RENDER_TOOLBAR_CELL_WH.h}px`);
}

/** Compact audit for __uiAudit / render fidelity — menus + bitmap W/H; eye LOCK explicit. */
export function renderToolbarChromeAudit(): Record<string, unknown> {
  const menus = RENDER_TOOLBAR_CHROME.menus as { pe: string; id: number; size: number }[];
  const bitmaps = RENDER_TOOLBAR_CHROME.bitmaps_wh as { pe: string; id: number; w: number; h: number }[];
  const sample = RENDER_TOOLBAR_CHROME.bitmapWhSample as { id: number; w: number; h: number }[];
  const eye = RENDER_TOOLBAR_CHROME.eyeChromeBeyondWh as { status: string; note: string };
  const cellOk =
    RENDER_TOOLBAR_CELL_WH.w === 22 &&
    RENDER_TOOLBAR_CELL_WH.h === 22 &&
    sample.length >= 4 &&
    sample.every(s => s.w === 22 && s.h === 22);
  return {
    lockId: RENDER_TOOLBAR_CHROME.lock_id,
    status: RENDER_TOOLBAR_CHROME.status,
    softimage: RENDER_TOOLBAR_CHROME.softimage,
    menuCount: menus.length,
    bitmapWhCount: bitmaps.length,
    toolbarCellWh: { w: RENDER_TOOLBAR_CELL_WH.w, h: RENDER_TOOLBAR_CELL_WH.h },
    toolbarCellOk: cellOk,
    sample22: sample.map(s => ({ id: s.id, w: s.w, h: s.h })),
    whHistogram: RENDER_TOOLBAR_CHROME.wh_histogram,
    eyeChromeBeyondWh: eye.status,
    eyeChromeNote: eye.note,
  };
}
