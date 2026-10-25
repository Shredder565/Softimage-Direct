// Softimage Animate chrome tokens (PE RT_DIALOG + dict) — clean-room CSS/layout.
// Built by tools/build_anim_chrome.py from softimage-pc anim PE dumps (no GUI takeover).
import chrome from '../data/si/anim_chrome.json';

export type AnimChrome = typeof chrome;

export const animChrome = chrome as AnimChrome;

/** Apply Softimage Animate CSS variables onto :root (or a host element). */
export function applyAnimChromeVars(el: HTMLElement | CSSStyleDeclaration = document.documentElement.style) {
  const style = el instanceof CSSStyleDeclaration ? el : el.style;
  const L = chrome.layout;
  const C = chrome.colors;
  const F = chrome.fonts;
  style.setProperty('--anim-font', F.editor);
  style.setProperty('--anim-font-px', `${F.editor_px}px`);
  style.setProperty('--anim-panel-font-px', `${F.panel_px}px`);
  style.setProperty('--anim-client-bg', C.client_bg);
  style.setProperty('--anim-list-bg', C.list_bg);
  style.setProperty('--anim-panel-bg', C.panel_bg);
  style.setProperty('--anim-toolbar-bg', C.toolbar_bg);
  style.setProperty('--anim-track-bg', C.track_bg);
  style.setProperty('--anim-clip-bg', C.clip_bg);
  style.setProperty('--anim-clip-sel', C.clip_sel);
  style.setProperty('--anim-key', C.key_diamond);
  style.setProperty('--anim-grid', C.grid);
  style.setProperty('--anim-cursor', C.time_cursor);
  style.setProperty('--fcv-list-w', `${L.fcv_list_w}px`);
  style.setProperty('--fcv-toolbar-h', `${L.fcv_toolbar_h}px`);
  style.setProperty('--fcv-ruler-h', `${L.fcv_ruler_h}px`);
  style.setProperty('--fcv-label-m', `${L.fcv_label_margin}px`);
  style.setProperty('--mixer-track-h', `${L.mixer_track_h}px`);
  style.setProperty('--mixer-clip-h', `${L.mixer_clip_h}px`);
  style.setProperty('--mixer-toolbar-h', `${L.mixer_toolbar_h}px`);
  style.setProperty('--kp-row-h', `${L.kp_row_h}px`);
  style.setProperty('--kp-num-w', `${L.kp_num_w}px`);
  style.setProperty('--kp-title-h', `${L.kp_title_h}px`);
  style.setProperty('--anim-layer-w', `${L.layer_mgr_w}px`);
}

export function animViewDefaultSize(name: string): number[] | undefined {
  return (chrome.views as Record<string, number[]>)[name];
}

export function mixerMenuLabels(): string[] {
  return chrome.menus.mixer;
}

export function fcurveMenuLabels(): string[] {
  return chrome.menus.fcurve;
}

/** Compact audit for ui_smoke / __uiAudit (PE pack + xsivw + PNG extras). */
export function animChromeAudit(): Record<string, unknown> {
  const cs = getComputedStyle(document.documentElement);
  const L = chrome.layout;
  const V = chrome.views as Record<string, number[]>;
  const bm = chrome.bitmaps as { wired?: string[]; png_extra_count?: number };
  const pngs = (bm.wired ?? []).filter((f) => f.endsWith('.png'));
  return {
    softimage: chrome.softimage,
    tokensApplied: cs.getPropertyValue('--fcv-list-w').trim() === `${L.fcv_list_w}px`,
    fcvListW: L.fcv_list_w,
    fcvToolbarH: L.fcv_toolbar_h,
    mixerTrackH: L.mixer_track_h,
    kpDefaultW: L.kp_default_w,
    layerMgrW: L.layer_mgr_w,
    fontPx: chrome.fonts.editor_px,
    aeFloat: V['Animation Editor'],
    mixerFloat: V['Animation Mixer'],
    dopeFloat: V['DopeSheet'] ?? V['Standalone DopeSheet'],
    kpFloat: V['Keying Panel'],
    layerFloat: V['Animation Layer Manager'],
    playbackFloat: V['Playback Panel'],
    mixerMenus: chrome.menus.mixer,
    fcurveMenus: chrome.menus.fcurve,
    bitmapWired: bm.wired?.length ?? 0,
    pngExtra: bm.png_extra_count ?? pngs.length,
    pngGlyphs: pngs,
    live: {
      listW: cs.getPropertyValue('--fcv-list-w').trim(),
      kp: !!document.querySelector('.kp.anim-keying'),
      kpToolbar: !!document.querySelector('.kp .kp-toolbar-strip'),
      mixer: !!document.querySelector('.mixer'),
      fcv: !!document.querySelector('.fcv'),
      layerMgr: !!document.querySelector('.anim-layer-mgr'),
      mixerIcons: document.querySelectorAll('.mixer .mixer-ico').length,
      autoKeyGlyph: !!document.querySelector('.kp.anim-keying button.anim-auto-key img'),
    },
  };
}
