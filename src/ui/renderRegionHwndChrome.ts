// Softimage render.region_hwnd_crop + closer95 render.region_handle_wh.
// Dump-attested crop PNG + DsNewRegionButtonCtrl children/W/H + prefs region colors. No invent.
import crop from '../data/si/render_region_hwnd_crop.json';

export type RenderRegionHwndCrop = typeof crop;
export const RENDER_REGION_HWND_CROP = crop as RenderRegionHwndCrop;

type Rgba = { r: number; g: number; b: number; a: number; css: string };
type HandleWh = { w_px: number; h_px: number; rect: number[] };

const colors = (crop as { chrome_colors: Record<string, unknown> }).chrome_colors;
const handleSize = (crop as {
  handle_size_px: {
    lock_id: string;
    status: string;
    cls: string;
    count: number;
    handles: HandleWh[];
  };
}).handle_size_px;

/** Softimage preferences.rendering region_color_default → CSS (Desktop prefs dump). */
export function regionBorderCss(): string {
  return (colors.default as Rgba).css;
}

/** Softimage preferences.rendering region_color_handle → CSS (Desktop prefs dump). */
export function regionHandleCss(): string {
  return (colors.handle as Rgba).css;
}

/** Softimage preferences.rendering region_color_scale_bar → CSS (tile borders). */
export function regionScaleBarCss(): string {
  return (colors.scale_bar as Rgba).css;
}

export function regionDrawTileBorders(): boolean {
  return !!(colors.region_draw_tile_borders as boolean);
}

/** closer95 DUMP_READY Softimage Name DsNewRegionButtonCtrl handle W/H metrics. */
export function regionHandleWhMetrics(): HandleWh[] {
  return handleSize.handles.slice();
}

export function regionHandleWhStatus(): string {
  return handleSize.status;
}

/** Apply attested region chrome colors + handle W/H dump status as CSS custom properties. */
export function applyRenderRegionHwndChrome(host?: HTMLElement | null): void {
  const root = host ?? document.documentElement;
  root.style.setProperty('--si-region-border', regionBorderCss());
  root.style.setProperty('--si-region-handle', regionHandleCss());
  root.style.setProperty('--si-region-scale-bar', regionScaleBarCss());
  root.style.setProperty('--si-region-handle-wh-count', String(handleSize.count));
  root.style.setProperty('--si-region-handle-wh-status', handleSize.status);
  // Softimage Name: dump-attested DsNewRegionButtonCtrl W/H list (closer95) — no invent single grip px.
  root.dataset.siRegionHandleWhList = handleSize.handles.map(h => `${h.w_px}x${h.h_px}`).join(',');
  root.dataset.siRegionHwndCrop = (crop as { status: string }).status;
  root.dataset.siRegionHwndCount = String(
    (crop as { hwnd_children: { count: number } }).hwnd_children.count,
  );
  root.dataset.siRegionHandleWh = handleSize.status;
  root.dataset.siRegionHandleWhCount = String(handleSize.count);
}

/** Compact audit for __uiAudit / compare_render_fidelity / ui_smoke. */
export function renderRegionHwndChromeAudit(): Record<string, unknown> {
  const c = crop as {
    lock_id: string;
    status: string;
    softimage: string;
    crop: { png_px: number[] };
    desktop: { png_px: number[] };
    hwnd_children: { cls: string; count: number; children: { cls: string; w_px: number; h_px: number }[] };
    chrome_colors: { default: Rgba; handle: Rgba; scale_bar: Rgba; region_draw_tile_borders: boolean };
    handle_size_px: {
      lock_id: string;
      status: string;
      cls: string;
      count: number;
      handles: HandleWh[];
    };
    harvest: { status: string };
  };
  const kids = c.hwnd_children.children;
  const allDs = kids.every(k => k.cls === 'DsNewRegionButtonCtrl');
  const hs = c.handle_size_px;
  const expectedWh: Array<[number, number]> = [
    [576, 61],
    [646, 50],
    [203, 367],
    [194, 432],
    [194, 74],
    [196, 122],
    [194, 124],
  ];
  const whMatch =
    hs.count === 7 &&
    hs.handles.length === 7 &&
    hs.handles.every((h, i) => h.w_px === expectedWh[i][0] && h.h_px === expectedWh[i][1]);
  const hwndWhMatch =
    kids.length === 7 &&
    kids.every((k, i) => k.w_px === expectedWh[i][0] && k.h_px === expectedWh[i][1]);
  const cs = getComputedStyle(document.documentElement);
  const borderApplied = cs.getPropertyValue('--si-region-border').trim() === c.chrome_colors.default.css;
  const handleWhApplied =
    cs.getPropertyValue('--si-region-handle-wh-status').trim() === 'DUMP_READY' &&
    cs.getPropertyValue('--si-region-handle-wh-count').trim() === '7';
  return {
    lockId: c.lock_id,
    status: c.status,
    softimage: c.softimage,
    harvestStatus: c.harvest.status,
    cropPng: c.crop.png_px,
    desktopPng: c.desktop.png_px,
    hwndCls: c.hwnd_children.cls,
    hwndCount: c.hwnd_children.count,
    hwndAllDsNewRegionButtonCtrl: allDs,
    borderCss: c.chrome_colors.default.css,
    handleCss: c.chrome_colors.handle.css,
    scaleBarCss: c.chrome_colors.scale_bar.css,
    drawTileBorders: c.chrome_colors.region_draw_tile_borders,
    handleSizePx: hs.status,
    handleWhLockId: hs.lock_id,
    handleWhCls: hs.cls,
    handleWhCount: hs.count,
    handleWh: hs.handles.map(h => [h.w_px, h.h_px]),
    handleWhMatch: whMatch,
    hwndWhMatch,
    borderApplied,
    handleWhApplied,
    ok:
      c.status === 'DUMP_READY' &&
      c.harvest.status === 'DUMP_READY' &&
      c.crop.png_px[0] === 450 &&
      c.crop.png_px[1] === 350 &&
      c.hwnd_children.count === 7 &&
      allDs &&
      c.chrome_colors.default.css === '#ffff00' &&
      c.chrome_colors.handle.css === '#0000ff' &&
      borderApplied &&
      hs.status === 'DUMP_READY' &&
      hs.lock_id === 'render.region_handle_wh' &&
      hs.cls === 'DsNewRegionButtonCtrl' &&
      whMatch &&
      hwndWhMatch &&
      handleWhApplied,
  };
}
