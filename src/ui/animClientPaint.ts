// Softimage Animation Mixer / Animation Editor / FCurve client GDI paint —
// Desktop modules-gdi DUMP_READY HWND PNG harvest. Dump-attested only. No invent.
import paint from '../data/si/anim_client_paint.json';

export type AnimClientPaint = typeof paint;

export const animClientPaint = paint as AnimClientPaint;

type MixerView = {
  hwnd_title?: string;
  png?: string;
  png_px?: number[];
  sha256?: string;
  menubar?: string[];
  toolbar_text?: string[];
  track_flags?: string[];
};
type EditorView = {
  hwnd_title?: string;
  png?: string;
  png_px?: number[];
  sha256?: string;
  menubar?: string[];
  toolbar_labels?: string[];
  fields?: string[];
  mode_combo?: string;
  explorer_w_px?: number;
  same_as?: string;
};

/** Apply Desktop-attested Mixer/FCurve client paint CSS vars (colors + explorer width). */
export function applyAnimClientPaintVars(el: HTMLElement | CSSStyleDeclaration = document.documentElement.style) {
  const style = el instanceof CSSStyleDeclaration ? el : el.style;
  const C = paint.colors as Record<string, string>;
  const L = paint.layout as Record<string, number | number[]>;
  if (C.panel_bg) style.setProperty('--anim-panel-bg', C.panel_bg);
  if (C.toolbar_bg) style.setProperty('--anim-toolbar-bg', C.toolbar_bg);
  if (C.client_bg) style.setProperty('--anim-client-bg', C.client_bg);
  if (C.list_bg) style.setProperty('--anim-list-bg', C.list_bg);
  if (C.track_bg) style.setProperty('--anim-track-bg', C.track_bg);
  if (C.clip_bg) style.setProperty('--anim-clip-bg', C.clip_bg);
  if (C.grid) style.setProperty('--anim-grid', C.grid);
  if (C.time_cursor) style.setProperty('--anim-cursor', C.time_cursor);
  if (C.border) style.setProperty('--anim-border', C.border);
  const expW = L.fcv_explorer_w_px ?? L.fcv_list_w_px;
  if (typeof expW === 'number') style.setProperty('--fcv-list-w', `${expW}px`);
  if (typeof L.fcv_toolbar_h_px === 'number') style.setProperty('--fcv-toolbar-h', `${L.fcv_toolbar_h_px}px`);
  if (typeof L.mixer_toolbar_h_px === 'number') style.setProperty('--mixer-toolbar-h', `${L.mixer_toolbar_h_px}px`);
  return paint;
}

export function mixerClientMenubar(): string[] {
  const v = (paint.views as Record<string, MixerView>)['Animation Mixer'];
  return [...(v?.menubar ?? [])];
}

export function mixerToolbarText(): string[] {
  const v = (paint.views as Record<string, MixerView>)['Animation Mixer'];
  return [...(v?.toolbar_text ?? [])];
}

export function mixerTrackFlags(): string[] {
  const v = (paint.views as Record<string, MixerView>)['Animation Mixer'];
  return [...(v?.track_flags ?? [])];
}

export function fcurveClientMenubar(): string[] {
  const v = (paint.views as Record<string, EditorView>)['Animation Editor'];
  return [...(v?.menubar ?? [])];
}

export function fcurveToolbarLabels(): string[] {
  const v = (paint.views as Record<string, EditorView>)['Animation Editor'];
  return [...(v?.toolbar_labels ?? [])];
}

export function fcurveFieldLabels(): string[] {
  const v = (paint.views as Record<string, EditorView>)['Animation Editor'];
  return [...(v?.fields ?? [])];
}

export function fcurveModeCombo(): string {
  const v = (paint.views as Record<string, EditorView>)['Animation Editor'];
  return v?.mode_combo ?? 'Absolute Offset';
}

export function animClientPaintPngUrl(view: 'Animation Mixer' | 'Animation Editor' | 'Fcurve Editor'): string {
  const v = (paint.views as Record<string, { png?: string }>)[view];
  const png = v?.png ?? '';
  // public/si/modules-gdi/X.png → si/modules-gdi/X.png for vite
  return png.replace(/^public\//, '');
}

/** Mark host with dump-attested client-paint dataset + HWND PNG underlay (MCP-style). */
export function attachAnimClientPaint(
  root: HTMLElement,
  view: 'Animation Mixer' | 'Animation Editor' | 'Fcurve Editor',
) {
  applyAnimClientPaintVars(root);
  const def = (paint.views as Record<string, MixerView & EditorView>)[view];
  root.dataset.siClientPaint = paint.status;
  root.dataset.siClientPaintWire = paint.wire;
  if (def?.hwnd_title) root.dataset.siHwndTitle = def.hwnd_title;
  if (def?.png_px) root.dataset.siPngPx = def.png_px.join('x');
  const url = animClientPaintPngUrl(view);
  if (url) {
    root.style.setProperty('--anim-client-paint-url', `url(${url})`);
    root.dataset.siClientPaintPng = url;
  }
}

/** Compact audit for __uiAudit / compare / ui_smoke. */
export function animClientPaintAudit(): Record<string, unknown> {
  const mixer = (paint.views as Record<string, MixerView>)['Animation Mixer'];
  const editor = (paint.views as Record<string, EditorView>)['Animation Editor'];
  const fcurve = (paint.views as Record<string, EditorView>)['Fcurve Editor'];
  const honest = paint.honest['animate.fcurve_mixer_client_paint'];
  const cs = getComputedStyle(document.documentElement);
  const mixerHost = document.querySelector('.mixer') as HTMLElement | null;
  const fcvHost = document.querySelector('.fcv') as HTMLElement | null;
  const shaMatch = (editor?.sha256 ?? '') === (fcurve?.sha256 ?? '') && !!(editor?.sha256);
  return {
    softimage: paint.softimage,
    utc: paint.utc,
    status: paint.status,
    wire: paint.wire,
    honestStatus: honest.status,
    honestWire: honest.wire,
    mixerTitle: mixer?.hwnd_title,
    mixerPngPx: mixer?.png_px,
    mixerMenubar: mixer?.menubar,
    mixerToolbarText: mixer?.toolbar_text,
    mixerTrackFlags: mixer?.track_flags,
    editorTitle: editor?.hwnd_title,
    editorPngPx: editor?.png_px,
    editorMenubar: editor?.menubar,
    editorExplorerW: editor?.explorer_w_px,
    editorModeCombo: editor?.mode_combo,
    fcurveSameAs: fcurve?.same_as,
    fcurveShaMatchesEditor: shaMatch,
    colors: {
      panel: (paint.colors as Record<string, string>).panel_bg,
      cursor: (paint.colors as Record<string, string>).time_cursor,
      clip: (paint.colors as Record<string, string>).clip_bg,
    },
    live: {
      panelBg: cs.getPropertyValue('--anim-panel-bg').trim(),
      cursor: cs.getPropertyValue('--anim-cursor').trim(),
      listW: cs.getPropertyValue('--fcv-list-w').trim(),
      mixer: !!mixerHost,
      mixerPaint: mixerHost?.dataset.siClientPaint ?? null,
      mixerHwnd: mixerHost?.dataset.siHwndTitle ?? null,
      mixerMenubar: mixerHost
        ? Array.from(mixerHost.querySelectorAll('.mixer-menubar > button.xp-btn')).map(b =>
            (b.textContent || '').replace(/▾$/, '').trim())
        : [],
      mixerToolbarText: mixerHost
        ? Array.from(mixerHost.querySelectorAll('.mixer-toolbar-text > button.xp-btn')).map(b =>
            (b.textContent || '').trim())
        : [],
      mixerTrackFlags: mixerHost?.querySelector('.mixer-track-flags')?.textContent?.replace(/\s+/g, '') ?? null,
      fcv: !!fcvHost,
      fcvPaint: fcvHost?.dataset.siClientPaint ?? null,
      fcvHwnd: fcvHost?.dataset.siHwndTitle ?? null,
      fcvMenubar: fcvHost
        ? Array.from(fcvHost.querySelectorAll('.fcv-menubar > button.xp-btn')).map(b =>
            (b.textContent || '').replace(/▾$/, '').trim())
        : [],
      fcvMode: fcvHost?.querySelector('.fcv-mode-combo')?.textContent?.trim() ?? null,
      fcvFields: fcvHost
        ? Array.from(fcvHost.querySelectorAll('.fcv-field-label')).map(s => (s.textContent || '').trim())
        : [],
    },
    ok:
      paint.status === 'DONE' &&
      paint.wire === 'HWND_PNG' &&
      honest.status === 'DONE' &&
      honest.wire === 'HWND_PNG' &&
      (mixer?.menubar?.length ?? 0) === 6 &&
      mixer?.menubar?.[4] === 'Mix' &&
      (editor?.menubar?.length ?? 0) >= 8 &&
      editor?.explorer_w_px === 195 &&
      shaMatch &&
      cs.getPropertyValue('--anim-cursor').trim() === '#ff0000',
  };
}
