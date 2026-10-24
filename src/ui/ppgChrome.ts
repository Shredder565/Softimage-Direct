// Softimage PPG / floating-dialog chrome tokens from PE (uiut host frames + RT_BITMAP sizes).
// Built by tools/build_ppg_chrome.py — clean-room CSS/layout application, no Softimage binary paste.
import chrome from '../data/si/ppg_chrome.json';

export type PpgChrome = typeof chrome;

export const PPG_CHROME = chrome as PpgChrome;

/** Apply Softimage PPG layout tokens as CSS custom properties on :root (and optional host). */
export function applyPpgChrome(host?: HTMLElement | null): PpgChrome {
  const t = PPG_CHROME.tokens;
  const root = document.documentElement;
  const set = (el: HTMLElement, k: string, v: string) => el.style.setProperty(k, v);
  const apply = (el: HTMLElement) => {
    set(el, '--ppg-font', t.fontFamily);
    set(el, '--ppg-font-pt', `${t.fontPtHost}px`);
    set(el, '--ppg-title-h', `${t.titleBarHeightPx}px`);
    set(el, '--ppg-toolbar-h', `${t.toolbarHeightPx}px`);
    set(el, '--ppg-tab-font', `${t.tabFontPx}px`);
    set(el, '--ppg-label-w', `${t.rowLabelWidthPx}px`);
    set(el, '--ppg-dot', `${t.animDotPx}px`);
    set(el, '--ppg-row-gap', `${t.rowGapPx}px`);
    set(el, '--ppg-body-pad', `${t.bodyPadPx}px`);
    set(el, '--ppg-group-border', t.groupHeadBorder);
    set(el, '--ppg-val-bg', t.valueFieldBg);
    set(el, '--ppg-val-fg', t.valueFieldFg);
    set(el, '--ppg-slider-top', t.sliderTrackTop);
    set(el, '--ppg-slider-bot', t.sliderTrackBot);
    set(el, '--ppg-slider-border', t.sliderBorder);
    set(el, '--ppg-slider-h', `${t.sliderHeightPx}px`);
    set(el, '--ppg-thumb-w', `${t.sliderThumbPx}px`);
    set(el, '--ppg-num-w', `${t.numFieldWidthPx}px`);
    set(el, '--ppg-input-h', `${t.inputHeightPx}px`);
    set(el, '--ppg-check', `${t.checkboxPx}px`);
    set(el, '--ppg-float-w', `${t.floatDefaultWidthPx}px`);
    set(el, '--ppg-float-border', t.floatBorder);
    set(el, '--ppg-float-title-top', t.floatTitleGradient[0]);
    set(el, '--ppg-float-title-bot', t.floatTitleGradient[1]);
    set(el, '--ppg-title-top', t.ppgTitleGradient[0]);
    set(el, '--ppg-title-bot', t.ppgTitleGradient[1]);
    set(el, '--ppg-nav-w', `${PPG_CHROME.bitmaps.inspNav.peSize?.[0] ?? 71}px`);
    set(el, '--ppg-tools-w', `${PPG_CHROME.bitmaps.tools.peSize?.[0] ?? 66}px`);
  };
  apply(root);
  if (host) apply(host);
  return PPG_CHROME;
}

/** Compact audit payload for ui_smoke / __uiAudit. */
export function ppgChromeAudit(root?: ParentNode | Document): Record<string, unknown> {
  const doc = root ?? document;
  const ppg = (doc as Document).querySelector?.('.ppg') ?? document.querySelector('.ppg');
  const nav = ppg?.querySelector('.ppg-bmp.nav') as HTMLElement | null;
  const tools = ppg?.querySelector('.ppg-bmp.tools') as HTMLElement | null;
  const floatBar = document.querySelector('.ppg-float-bar') as HTMLElement | null;
  const cs = getComputedStyle(document.documentElement);
  return {
    softimage: PPG_CHROME.softimage,
    hostDialog: PPG_CHROME.canonicalHostDialog,
    bitmapMatch: PPG_CHROME.bitmapMatch,
    navSize: PPG_CHROME.bitmaps.inspNav.peSize,
    toolsSize: PPG_CHROME.bitmaps.tools.peSize,
    tokensApplied: cs.getPropertyValue('--ppg-label-w').trim() === `${PPG_CHROME.tokens.rowLabelWidthPx}px`,
    navW: nav ? nav.getBoundingClientRect().width : null,
    toolsW: tools ? tools.getBoundingClientRect().width : null,
    titleBarH: floatBar ? floatBar.getBoundingClientRect().height : null,
    expectNavW: PPG_CHROME.bitmaps.inspNav.peSize?.[0] ?? 71,
    expectToolsW: PPG_CHROME.bitmaps.tools.peSize?.[0] ?? 66,
    expectTitleH: PPG_CHROME.tokens.titleBarHeightPx,
    fontHost: PPG_CHROME.tokens.fontPtHost,
    fontFamily: PPG_CHROME.tokens.fontFamily,
    hosts: Object.keys(PPG_CHROME.hosts),
  };
}
