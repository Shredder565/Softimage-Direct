// Softimage Layout HWND chrome from softimage-pc render-freeze harvest (2026-10-26).
// Spec only — Softimage-faithful original AfterImage CSS/layout. No Softimage paste.
import chrome from '../data/si/softimage_layout_hwnd_chrome.json';

export type SoftimageLayoutHwndChrome = typeof chrome;

export function softimageLayoutHwndChrome(): SoftimageLayoutHwndChrome {
  return chrome;
}

/** Apply Softimage Layout HWND-attested CSS variables to :root. */
export function applySoftimageLayoutHwndChrome(root: HTMLElement | CSSStyleDeclaration = document.documentElement): void {
  const m = chrome.main;
  const c = chrome.colors_sampled;
  const el = root instanceof CSSStyleDeclaration ? null : root;
  const style = el ? el.style : (root as CSSStyleDeclaration);
  const set = (k: string, v: string | number) => style.setProperty(k, typeof v === 'number' ? `${v}px` : v);

  set('--si-menubar-h', m.menubar_h);
  set('--si-status-h', m.status_h);
  set('--si-module-menu-w', m.module_menu_w);
  set('--si-toolbar-panel-w', m.toolbar_panel_w);
  set('--si-module-btn-w', m.module_btn_w);
  set('--si-module-btn-h', m.module_btn_h);
  set('--si-mcp-w', m.mcp_w);
  set('--si-timeline-h', m.timeline_h);
  set('--si-timerange-h', m.timerange_h);
  set('--si-bottom-row-h', m.bottom_row_h);
  set('--si-vp-head-h', m.viewport_head_h);
  set('--si-mcp-tray-btn-w', m.mcp_tray_btn_w);
  set('--si-mcp-tray-btn-h', m.mcp_tray_btn_h);
  set('--si-panel-switcher-w', m.panel_switcher_w);

  // Softimage Layout light scheme (dump-attested / Softimage 2015 sampled)
  set('--bg', c.bg);
  set('--bg2', c.bg2);
  set('--panel', c.bg);
  set('--vp-bg', c.vp_bg);
  set('--vp-head', c.vp_head);
  set('--btn-top', c.btn_top);
  set('--btn-bot', c.btn_bot);
  set('--line', c.line);
  set('--render', c.render_header);
  set('--model', c.model_header);
  set('--accent', c.accent);
}

export function softimageLayoutHwndAudit(): Record<string, unknown> {
  const m = chrome.main;
  const cs = typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  return {
    source: chrome.source,
    moduleMenuW: m.module_menu_w,
    mcpW: m.mcp_w,
    timelineH: m.timeline_h,
    timerangeH: m.timerange_h,
    menubarH: m.menubar_h,
    statusH: m.status_h,
    cssMenubar: cs?.getPropertyValue('--si-menubar-h').trim() || null,
    cssMcpW: cs?.getPropertyValue('--si-mcp-w').trim() || null,
  };
}
