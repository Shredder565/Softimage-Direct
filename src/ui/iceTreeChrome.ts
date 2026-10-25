// Softimage ICE Tree / ICE Attribute Editor chrome — xsivw shell + Desktop modules-gdi client GDI.
// Tour 12-ice-tree.png is Face Robot mislabel — never use for ICE Tree GDI.
import chrome from '../data/si/ice_view_chrome.json';

export type IceViewChrome = typeof chrome;

export const iceViewChromeTokens = chrome as IceViewChrome;

/** Apply Softimage ICE Tree float-size + Desktop-attested region/color CSS vars. */
export function applyIceTreeChromeVars(el: HTMLElement | CSSStyleDeclaration = document.documentElement.style) {
  const style = el instanceof CSSStyleDeclaration ? el : el.style;
  const tree = chrome.views['ICE Tree'];
  const attr = chrome.views['ICE Attribute Editor'];
  const ds = tree?.defaultsize;
  if (ds && ds.length >= 4) {
    style.setProperty('--ice-default-w', `${ds[2]}px`);
    style.setProperty('--ice-default-h', `${ds[3]}px`);
  }
  const ads = attr?.defaultsize;
  if (ads && ads.length >= 4) {
    style.setProperty('--ice-attr-default-w', `${ads[2]}px`);
    style.setProperty('--ice-attr-default-h', `${ads[3]}px`);
  }
  const gdi = chrome.client_gdi as {
    status: string;
    toolbar_h_px?: number;
    title_h_px?: number;
    menubar_h_px?: number;
    colors?: Record<string, string>;
    regions?: Record<string, number>;
  };
  const prefs = chrome.prefs_layout as {
    apply_as_css_vars?: boolean;
    preset_manager_size?: number;
    explorer_size?: number;
    leftcompoundbar_size?: number;
    rightcompoundbar_size?: number;
  };
  const colors = gdi.colors ?? {};
  if (colors.panel_bg) style.setProperty('--ice-panel-bg', colors.panel_bg);
  if (colors.toolbar_bg) style.setProperty('--ice-toolbar-bg', colors.toolbar_bg);
  if (colors.client_bg) style.setProperty('--ice-client-bg', colors.client_bg);
  if (colors.canvas_bg) style.setProperty('--ice-canvas-bg', colors.canvas_bg);
  if (colors.category_sel) style.setProperty('--ice-category-sel', colors.category_sel);
  if (colors.border) style.setProperty('--ice-border', colors.border);
  if (gdi.toolbar_h_px != null) style.setProperty('--ice-toolbar-h', `${gdi.toolbar_h_px}px`);
  if (gdi.menubar_h_px != null) style.setProperty('--ice-menubar-h', `${gdi.menubar_h_px}px`);
  if (gdi.title_h_px != null) style.setProperty('--ice-title-h', `${gdi.title_h_px}px`);
  const attrGdi = chrome.attr_client_gdi as { toolbar_h_px?: number; colors?: Record<string, string> } | undefined;
  if (attrGdi?.toolbar_h_px != null) style.setProperty('--ice-attr-toolbar-h', `${attrGdi.toolbar_h_px}px`);
  if (attrGdi?.colors?.body_bg) style.setProperty('--ice-attr-body-bg', attrGdi.colors.body_bg);
  if (prefs.apply_as_css_vars) {
    const preset = prefs.preset_manager_size ?? gdi.regions?.preset_manager_w;
    const explorer = prefs.explorer_size ?? gdi.regions?.explorer_w;
    const leftBar = prefs.leftcompoundbar_size ?? gdi.regions?.leftcompoundbar_w;
    const rightBar = prefs.rightcompoundbar_size ?? gdi.regions?.rightcompoundbar_w;
    if (preset != null) style.setProperty('--ice-preset-w', `${preset}px`);
    if (explorer != null) style.setProperty('--ice-explorer-w', `${explorer}px`);
    if (leftBar != null) style.setProperty('--ice-left-compoundbar-w', `${leftBar}px`);
    if (rightBar != null) style.setProperty('--ice-right-compoundbar-w', `${rightBar}px`);
  }
  return chrome;
}

export function iceViewDefaultSize(name: string): number[] | undefined {
  return (chrome.views as Record<string, { defaultsize?: number[] }>)[name]?.defaultsize;
}

export function iceToolbarShellLabels(): string[] {
  return [...((chrome.toolbar_shell as { attested?: string[] }).attested ?? [])];
}

export function iceToolbarTextLabels(): string[] {
  return [...((chrome.toolbar_shell as { toolbar_text?: string[] }).toolbar_text ?? [])];
}

export function icePaletteTabs(): string[] {
  return [...(((chrome.client_gdi as { palette?: { tabs?: string[] } }).palette?.tabs) ?? [])];
}

export function iceTaskCategoriesVisible(): string[] {
  return [...(((chrome.client_gdi as { palette?: { task_categories_visible?: string[] } }).palette?.task_categories_visible) ?? [])];
}

export function iceAttrToolbarLabels(): string[] {
  const v = chrome.views['ICE Attribute Editor'] as { toolbar_labels?: string[] };
  const g = chrome.attr_client_gdi as { toolbar_labels?: string[] } | undefined;
  return [...(v.toolbar_labels ?? g?.toolbar_labels ?? [])];
}

export function iceAttrBodyStatic(): string {
  const v = chrome.views['ICE Attribute Editor'] as { body_static?: string };
  const g = chrome.attr_client_gdi as { body_static?: string } | undefined;
  return v.body_static ?? g?.body_static ?? '';
}

/** Compact audit for compare_ice_module / __uiAudit. */
export function iceTreeChromeAudit(): Record<string, unknown> {
  const cs = getComputedStyle(document.documentElement);
  const tree = chrome.views['ICE Tree'];
  const attr = chrome.views['ICE Attribute Editor'];
  const prefs = chrome.prefs_layout as {
    status: string;
    apply_as_css_vars: boolean;
    preset_manager_size: number;
    explorer_size: number;
    leftcompoundbar_size: number;
    rightcompoundbar_size: number;
    create_node_mode: number;
  };
  const gdi = chrome.client_gdi as { status: string; toolbar_h_px?: number; regions?: Record<string, number> };
  const attrGdi = chrome.attr_client_gdi as { status?: string } | undefined;
  const host = document.querySelector('.rtree.icetree') as HTMLElement | null;
  const attrHost = document.querySelector('.ice-attr-editor') as HTMLElement | null;
  return {
    softimage: chrome.softimage,
    tokensApplied: cs.getPropertyValue('--ice-default-w').trim() === `${tree.defaultsize[2]}px`,
    regionCssApplied: prefs.apply_as_css_vars && cs.getPropertyValue('--ice-preset-w').trim() === `${prefs.preset_manager_size}px`,
    iceDefaultW: tree.defaultsize[2],
    iceDefaultH: tree.defaultsize[3],
    iceAttrDefaultW: attr.defaultsize[2],
    iceAttrDefaultH: attr.defaultsize[3],
    category: tree.category,
    clsid: tree.clsid,
    cmdmap: (tree as { cmdmap?: string }).cmdmap,
    toolbar: iceToolbarShellLabels(),
    toolbarText: iceToolbarTextLabels(),
    toolbarDesktopPng: (chrome.toolbar_shell as { desktop_png?: string }).desktop_png,
    prefsLayoutStatus: prefs.status,
    prefsApplyCss: prefs.apply_as_css_vars,
    prefsSizes: {
      preset_manager_size: prefs.preset_manager_size,
      explorer_size: prefs.explorer_size,
      leftcompoundbar_size: prefs.leftcompoundbar_size,
      rightcompoundbar_size: prefs.rightcompoundbar_size,
      create_node_mode: prefs.create_node_mode,
    },
    clientGdi: gdi.status,
    attrClientGdi: (attr as { client_gdi?: string }).client_gdi ?? attrGdi?.status,
    attrStatus: (attr as { status?: string }).status,
    toolbarH: gdi.toolbar_h_px,
    regions: gdi.regions,
    paletteTabs: icePaletteTabs(),
    taskCategoriesVisible: iceTaskCategoriesVisible(),
    attrToolbar: iceAttrToolbarLabels(),
    attrBodyStatic: iceAttrBodyStatic(),
    live: {
      iceDefaultW: cs.getPropertyValue('--ice-default-w').trim(),
      iceDefaultH: cs.getPropertyValue('--ice-default-h').trim(),
      icePresetW: cs.getPropertyValue('--ice-preset-w').trim(),
      iceExplorerW: cs.getPropertyValue('--ice-explorer-w').trim(),
      iceToolbarH: cs.getPropertyValue('--ice-toolbar-h').trim(),
      icePanelBg: cs.getPropertyValue('--ice-panel-bg').trim(),
      host: !!host,
      hostCategory: host?.dataset.siCategory ?? null,
      hostDefaultsize: host?.dataset.siDefaultsize ?? null,
      hostClsid: host?.dataset.siClsid ?? null,
      hostCmdmap: host?.dataset.siCmdmap ?? null,
      hostClientGdi: host?.dataset.siClientGdi ?? null,
      hostCreateNodeMode: host?.dataset.siCreateNodeMode ?? null,
      bodyLayout: !!host?.querySelector('.ice-body'),
      palette: !!host?.querySelector('.ice-palette'),
      explorer: !!host?.querySelector('.ice-explorer'),
      menubar: host
        ? Array.from(host.querySelectorAll('.ice-menubar > button.xp-btn')).map(b => (b.textContent || '').replace(/▾$/, '').trim())
        : [],
      toolbarLabels: host
        ? Array.from(host.querySelectorAll('.ice-toolbar-text > button.xp-btn, .xp-head > button.xp-btn')).map(b => (b.textContent || '').replace(/▾$/, '').trim())
        : [],
      attrHost: !!attrHost,
      attrCategory: attrHost?.dataset.siCategory ?? null,
      attrDefaultsize: attrHost?.dataset.siDefaultsize ?? null,
      attrStatus: attrHost?.dataset.siStatus ?? null,
      attrClientGdi: attrHost?.dataset.siClientGdi ?? null,
      attrToolbar: attrHost
        ? Array.from(attrHost.querySelectorAll('.ice-attr-toolbar > button.xp-btn')).map(b => (b.textContent || '').replace(/▾$/, '').trim())
        : [],
      attrBody: attrHost?.querySelector('.ice-attr-body')?.textContent?.trim() ?? null,
    },
  };
}
