// Softimage render.region_hwnd_crop — Desktop modules-gdi DUMP_READY harvest.
// Dump-attested crop PNG + DsNewRegionButtonCtrl children + prefs region colors. No invent.
import crop from '../data/si/render_region_hwnd_crop.json';

export type RenderRegionHwndCrop = typeof crop;
export const RENDER_REGION_HWND_CROP = crop as RenderRegionHwndCrop;

type Rgba = { r: number; g: number; b: number; a: number; css: string };

const colors = (crop as { chrome_colors: Record<string, unknown> }).chrome_colors;

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

/** Apply attested region chrome colors as CSS custom properties. */
export function applyRenderRegionHwndChrome(host?: HTMLElement | null): void {
  const root = host ?? document.documentElement;
  root.style.setProperty('--si-region-border', regionBorderCss());
  root.style.setProperty('--si-region-handle', regionHandleCss());
  root.style.setProperty('--si-region-scale-bar', regionScaleBarCss());
  root.dataset.siRegionHwndCrop = (crop as { status: string }).status;
  root.dataset.siRegionHwndCount = String(
    (crop as { hwnd_children: { count: number } }).hwnd_children.count,
  );
}

/** Compact audit for __uiAudit / compare_render_fidelity / ui_smoke. */
export function renderRegionHwndChromeAudit(): Record<string, unknown> {
  const c = crop as {
    lock_id: string;
    status: string;
    softimage: string;
    crop: { png_px: number[] };
    desktop: { png_px: number[] };
    hwnd_children: { cls: string; count: number; children: { cls: string }[] };
    chrome_colors: { default: Rgba; handle: Rgba; scale_bar: Rgba; region_draw_tile_borders: boolean };
    handle_size_px: { status: string };
    harvest: { status: string };
  };
  const kids = c.hwnd_children.children;
  const allDs = kids.every(k => k.cls === 'DsNewRegionButtonCtrl');
  const cs = getComputedStyle(document.documentElement);
  const borderApplied = cs.getPropertyValue('--si-region-border').trim() === c.chrome_colors.default.css;
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
    handleSizePx: c.handle_size_px.status,
    borderApplied,
    ok:
      c.status === 'DUMP_READY' &&
      c.harvest.status === 'DUMP_READY' &&
      c.crop.png_px[0] === 450 &&
      c.crop.png_px[1] === 350 &&
      c.hwnd_children.count === 7 &&
      allDs &&
      c.chrome_colors.default.css === '#ffff00' &&
      c.chrome_colors.handle.css === '#0000ff' &&
      borderApplied,
  };
}
