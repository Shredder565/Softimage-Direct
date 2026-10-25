// Softimage ICE Attribute Editor view shell — iceattributeeditor.xsivw dump tokens only.
// Editor body / client GDI stay LOCK (no invent).
import { App } from '../core/commands';
import iceViewChrome from '../data/si/ice_view_chrome.json';
import { applyIceTreeChromeVars } from './iceTreeChrome';

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

type IceViewDef = {
  category?: string;
  defaultsize?: number[];
  clsid?: string;
  cmdmap?: string;
  supportedtypes?: string;
  maxinstances?: string;
  private?: string;
  acceptfocus?: string;
  status?: string;
  client_gdi?: string;
  note?: string;
};

/** Softimage OpenView("ICE Attribute Editor") — xsivw shell chrome; body awaits Desktop/GDI harvest. */
export function iceAttributeEditorView(_app: App, host: HTMLElement) {
  applyIceTreeChromeVars();
  const root = el('div', 'ice-attr-editor');
  host.appendChild(root);
  const def = (iceViewChrome as { views?: Record<string, IceViewDef> }).views?.['ICE Attribute Editor'];
  if (def?.category) root.dataset.siCategory = def.category;
  if (def?.defaultsize) root.dataset.siDefaultsize = def.defaultsize.join(',');
  if (def?.clsid) root.dataset.siClsid = def.clsid;
  if (def?.cmdmap) root.dataset.siCmdmap = def.cmdmap;
  if (def?.supportedtypes) root.dataset.siSupportedtypes = def.supportedtypes;
  if (def?.maxinstances) root.dataset.siMaxinstances = def.maxinstances;
  if (def?.private) root.dataset.siPrivate = def.private;
  if (def?.acceptfocus) root.dataset.siAcceptfocus = def.acceptfocus;
  root.dataset.siStatus = def?.status ?? 'SHELL_ONLY';
  root.dataset.siClientGdi = def?.client_gdi ?? 'LOCK';

  root.appendChild(el('div', 'ice-attr-title', 'ICE Attribute Editor'));
  const meta = el('div', 'ice-attr-meta');
  meta.append(
    el('span', 'ice-attr-meta-row', `category=${def?.category ?? ''}`),
    el('span', 'ice-attr-meta-row', `defaultsize=${(def?.defaultsize ?? []).join(',')}`),
    el('span', 'ice-attr-meta-row', `clsid=${def?.clsid ?? ''}`),
    el('span', 'ice-attr-meta-row', `supportedtypes=${def?.supportedtypes ?? ''} maxinstances=${def?.maxinstances ?? ''}`),
  );
  root.appendChild(meta);
  const note = el('div', 'view-placeholder deferred');
  note.innerHTML =
    `<div class="view-placeholder-title">ICE Attribute Editor client GDI LOCK</div>` +
    `<p>${def?.note ?? 'xsivw shell only — no invent editor body.'}</p>`;
  root.appendChild(note);
}
