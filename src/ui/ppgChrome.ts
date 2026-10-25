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
    set(el, '--ppg-title-fg', (t as { ppgTitleText?: string }).ppgTitleText ?? '#E4E6EA');
    set(el, '--ppg-chrome-face', (t as { ppgChromeFace?: string }).ppgChromeFace ?? '#ABA8A6');
    set(el, '--ppg-chrome-mid', (t as { ppgChromeMid?: string }).ppgChromeMid ?? '#9E9B99');
    set(el, '--ppg-nav-w', `${PPG_CHROME.bitmaps.inspNav.peSize?.[0] ?? 71}px`);
    set(el, '--ppg-tools-w', `${PPG_CHROME.bitmaps.tools.peSize?.[0] ?? 66}px`);
    const xp = (PPG_CHROME as any).explorer?.tokens;
    if (xp) {
      set(el, '--xp-font', xp.fontFamily);
      set(el, '--xp-font-px', `${xp.fontPx}px`);
      set(el, '--xp-row-h', `${xp.rowHeightPx}px`);
      set(el, '--xp-btn-font', `${xp.headBtnFontPx}px`);
      set(el, '--xp-search-bg', xp.searchBg);
    }
    const pr = (PPG_CHROME as any).preferences?.tokens;
    if (pr) {
      set(el, '--prefs-font', pr.fontFamily);
      set(el, '--prefs-font-px', `${pr.fontPx}px`);
      set(el, '--prefs-tree-w', `${pr.treeWidthPx}px`);
      set(el, '--prefs-label-w', `${pr.labelWidthPx}px`);
    }
    const se = (PPG_CHROME as any).scriptEditor?.tokens;
    if (se) {
      set(el, '--script-font', `${se.fontPx}px ${se.fontFamily}`);
      set(el, '--script-font-family', se.fontFamily);
      set(el, '--script-font-px', `${se.fontPx}px`);
      set(el, '--script-tab', String(se.tabSize));
      set(el, '--script-float-w', `${se.floatDefaultWidthPx}px`);
      set(el, '--script-float-h', `${se.floatDefaultHeightPx}px`);
      document.body.classList.toggle('script-linenum', !!se.lineNumbers);
    }
    const sd = (PPG_CHROME as any).softDialog?.tokens;
    if (sd) {
      set(el, '--dlg-font', sd.fontFamily);
      set(el, '--dlg-font-px', `${sd.fontPx}px`);
      set(el, '--dlg-btn-w', `${sd.btnMinWidthPx}px`);
      set(el, '--dlg-btn-h', `${sd.btnMinHeightPx}px`);
      set(el, '--dlg-pad', `${sd.padPx}px`);
      set(el, '--dlg-label-w', `${sd.labelColPx}px`);
    }
    const pe394 = (PPG_CHROME as any).propertyPage394?.tokens;
    if (pe394) {
      set(el, '--pe394-font', pe394.fontFamily);
      set(el, '--pe394-font-px', `${pe394.fontPx}px`);
      set(el, '--pe394-w', `${pe394.widthPx}px`);
      set(el, '--pe394-h', `${pe394.heightPx}px`);
      set(el, '--pe394-stub-x', `${pe394.stubXPx}px`);
      set(el, '--pe394-stub-y', `${pe394.stubYPx}px`);
      set(el, '--pe394-stub-w', `${pe394.stubWPx}px`);
      set(el, '--pe394-stub-h', `${pe394.stubHPx}px`);
    }
  };
  apply(root);
  if (host) apply(host);
  return PPG_CHROME;
}

/** Softimage XSI.exe RT_DIALOG 394 Property Page stub (title + TODO string only — no invent Layout). */
export function pe394StubChrome(): {
  title: string;
  stubText: string;
  dialogId: number;
  rva: number;
  size: number;
  menus: string[];
} {
  const pe = (PPG_CHROME as any).propertyPage394;
  return {
    title: pe?.tokens?.title ?? pe?.dialog?.title ?? 'Property Page',
    stubText: pe?.tokens?.stubText ?? pe?.dialog?.stub?.text ?? 'TODO: layout property page',
    dialogId: pe?.dialog?.id ?? 394,
    rva: pe?.dialog?.rva ?? 19961344,
    size: pe?.dialog?.size ?? 158,
    menus: pe?.menus ?? ['PPG_CONTEXT_MENU', 'PPG_ANIM_CONTEXT_MENU'],
  };
}

/** Render attested PE 394 stub chrome into a host (metrics/strings only). */
export function renderPe394Stub(host: HTMLElement): HTMLElement {
  applyPpgChrome(host);
  const pin = pe394StubChrome();
  host.classList.add('pe394-stub');
  host.dataset.peDialog = String(pin.dialogId);
  host.dataset.peRva = String(pin.rva);
  host.dataset.peSize = String(pin.size);
  host.replaceChildren();
  const label = document.createElement('div');
  label.className = 'pe394-stub-text';
  label.textContent = pin.stubText;
  host.appendChild(label);
  return host;
}

/** Compact audit payload for ui_smoke / __uiAudit. */
export function ppgChromeAudit(root?: ParentNode | Document): Record<string, unknown> {
  const doc = root ?? document;
  const ppg = (doc as Document).querySelector?.('.ppg') ?? document.querySelector('.ppg');
  const nav = ppg?.querySelector('.ppg-bmp.nav') as HTMLElement | null;
  const tools = ppg?.querySelector('.ppg-bmp.tools') as HTMLElement | null;
  const floatBar = document.querySelector('.ppg-float-bar') as HTMLElement | null;
  const cs = getComputedStyle(document.documentElement);
  const tok = PPG_CHROME.tokens as {
    rowLabelWidthPx: number;
    titleBarHeightPx: number;
    fontPtHost: number;
    fontFamily: string;
    ppgTitleGradient: string[];
    ppgTitleText?: string;
    ppgChromeFace?: string;
    ppgChromeMid?: string;
  };
  const titleCr = (PPG_CHROME as { titleColorref?: { status?: string; wire?: string; hover?: { status?: string }; tokens?: Record<string, string> } }).titleColorref;
  return {
    softimage: PPG_CHROME.softimage,
    hostDialog: PPG_CHROME.canonicalHostDialog,
    bitmapMatch: PPG_CHROME.bitmapMatch,
    navSize: PPG_CHROME.bitmaps.inspNav.peSize,
    toolsSize: PPG_CHROME.bitmaps.tools.peSize,
    tokensApplied: cs.getPropertyValue('--ppg-label-w').trim() === `${tok.rowLabelWidthPx}px`,
    navW: nav ? nav.getBoundingClientRect().width : null,
    toolsW: tools ? tools.getBoundingClientRect().width : null,
    titleBarH: floatBar ? floatBar.getBoundingClientRect().height : null,
    expectNavW: PPG_CHROME.bitmaps.inspNav.peSize?.[0] ?? 71,
    expectToolsW: PPG_CHROME.bitmaps.tools.peSize?.[0] ?? 66,
    expectTitleH: tok.titleBarHeightPx,
    fontHost: tok.fontPtHost,
    fontFamily: tok.fontFamily,
    titleColorref: {
      status: titleCr?.status ?? null,
      wire: titleCr?.wire ?? null,
      hover: titleCr?.hover?.status ?? 'LOCK',
      titleFill: tok.ppgTitleGradient?.[0] ?? null,
      titleText: tok.ppgTitleText ?? null,
      chromeFace: tok.ppgChromeFace ?? null,
      chromeMid: tok.ppgChromeMid ?? null,
      cssTitleTop: cs.getPropertyValue('--ppg-title-top').trim(),
      cssTitleFg: cs.getPropertyValue('--ppg-title-fg').trim(),
      cssChromeFace: cs.getPropertyValue('--ppg-chrome-face').trim(),
      tokensApplied:
        cs.getPropertyValue('--ppg-title-top').trim().toLowerCase() === String(tok.ppgTitleGradient?.[0] ?? '').toLowerCase() &&
        cs.getPropertyValue('--ppg-title-fg').trim().toLowerCase() === String(tok.ppgTitleText ?? '').toLowerCase() &&
        cs.getPropertyValue('--ppg-chrome-face').trim().toLowerCase() === String(tok.ppgChromeFace ?? '').toLowerCase(),
    },
    hosts: Object.keys(PPG_CHROME.hosts),
    explorer: {
      renameId: (PPG_CHROME as any).explorer?.renameDialog?.id,
      rowH: (PPG_CHROME as any).explorer?.tokens?.rowHeightPx,
      fontPx: (PPG_CHROME as any).explorer?.tokens?.fontPx,
      tokensApplied: cs.getPropertyValue('--xp-row-h').trim() === `${(PPG_CHROME as any).explorer?.tokens?.rowHeightPx ?? 16}px`,
      liveRowH: (document.querySelector('.explorer .tree-row') as HTMLElement | null)?.getBoundingClientRect().height ?? null,
    },
    preferences: {
      hostId: (PPG_CHROME as any).preferences?.hostDialog?.id,
      labelW: (PPG_CHROME as any).preferences?.tokens?.labelWidthPx,
      treeW: (PPG_CHROME as any).preferences?.tokens?.treeWidthPx,
      tokensApplied: cs.getPropertyValue('--prefs-label-w').trim() === `${(PPG_CHROME as any).preferences?.tokens?.labelWidthPx ?? 260}px`,
    },
    scriptEditor: {
      prefsSpdl: (PPG_CHROME as any).scriptEditor?.prefsSpdl,
      fontPx: (PPG_CHROME as any).scriptEditor?.tokens?.fontPx,
      tabSize: (PPG_CHROME as any).scriptEditor?.tokens?.tabSize,
      lineNumbers: (PPG_CHROME as any).scriptEditor?.tokens?.lineNumbers,
      floatW: (PPG_CHROME as any).scriptEditor?.tokens?.floatDefaultWidthPx,
      floatH: (PPG_CHROME as any).scriptEditor?.tokens?.floatDefaultHeightPx,
      tokensApplied: cs.getPropertyValue('--script-font-px').trim() === `${(PPG_CHROME as any).scriptEditor?.tokens?.fontPx ?? 10}px`,
      linenumClass: document.body.classList.contains('script-linenum'),
    },
    softDialog: {
      fontPt: (PPG_CHROME as any).softDialog?.tokens?.fontPt,
      btnWDlu: (PPG_CHROME as any).softDialog?.tokens?.btnWDlu,
      btnHDlu: (PPG_CHROME as any).softDialog?.tokens?.btnHDlu,
      btnMinW: (PPG_CHROME as any).softDialog?.tokens?.btnMinWidthPx,
      btnMinH: (PPG_CHROME as any).softDialog?.tokens?.btnMinHeightPx,
      tokensApplied: cs.getPropertyValue('--dlg-btn-w').trim() === `${(PPG_CHROME as any).softDialog?.tokens?.btnMinWidthPx ?? 75}px`,
      peFont: (PPG_CHROME as any).softDialog?.peAttest?.fontMostCommon,
      peBtnDlu: (PPG_CHROME as any).softDialog?.peAttest?.okCancelDluMostCommon,
    },
    propertyPage394: (() => {
      const pe = (PPG_CHROME as any).propertyPage394;
      const t = pe?.tokens;
      const stub = (doc as Document).querySelector?.('.pe394-stub') ?? document.querySelector('.pe394-stub');
      const stubText = stub?.querySelector?.('.pe394-stub-text') as HTMLElement | null;
      return {
        dialogId: pe?.dialog?.id ?? null,
        rva: pe?.dialog?.rva ?? null,
        size: pe?.dialog?.size ?? null,
        title: t?.title ?? null,
        stubText: t?.stubText ?? null,
        widthDlu: t?.widthDlu ?? null,
        heightDlu: t?.heightDlu ?? null,
        widthPx: t?.widthPx ?? null,
        heightPx: t?.heightPx ?? null,
        fontPt: t?.fontPt ?? null,
        menus: pe?.menus ?? null,
        strings: pe?.strings ?? null,
        tokensApplied: cs.getPropertyValue('--pe394-w').trim() === `${t?.widthPx ?? 315}px`,
        stubInDom: !!stub,
        stubDomText: stubText?.textContent ?? null,
        inventoryId: (PPG_CHROME as any).inventory?.propertyPage394 ? 394 : null,
      };
    })(),
  };
}
