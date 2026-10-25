// Softimage Hair Panel view shell — hairpanel.xsivw dump tokens only.
// Client GDI body stays LOCK (no invent). FROST Character Hair wizard remains parallel.
import { App } from '../core/commands';
import hairViewChrome from '../data/si/hair_view_chrome.json';

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

type HairViewDef = {
  category?: string;
  defaultsize?: number[];
  clsid?: string;
  supportedtypes?: string;
  maxinstances?: string;
  private?: string;
  acceptfocus?: string;
  status?: string;
  client_gdi?: string;
  note?: string;
};

/** Softimage OpenView("Hair Panel") — xsivw shell chrome; body awaits Desktop/GDI harvest. */
export function hairPanelView(_app: App, host: HTMLElement) {
  const root = el('div', 'hair-panel');
  host.appendChild(root);
  const def = (hairViewChrome as { views?: Record<string, HairViewDef> }).views?.['Hair Panel'];
  if (def?.category) root.dataset.siCategory = def.category;
  if (def?.defaultsize) root.dataset.siDefaultsize = def.defaultsize.join(',');
  if (def?.clsid) root.dataset.siClsid = def.clsid;
  if (def?.supportedtypes) root.dataset.siSupportedtypes = def.supportedtypes;
  if (def?.maxinstances) root.dataset.siMaxinstances = def.maxinstances;
  if (def?.private) root.dataset.siPrivate = def.private;
  if (def?.acceptfocus) root.dataset.siAcceptfocus = def.acceptfocus;
  root.dataset.siStatus = def?.status ?? 'SHELL';
  root.dataset.siClientGdi = def?.client_gdi ?? 'LOCK';

  const title = el('div', 'hair-panel-title', 'Hair Panel');
  root.appendChild(title);
  const meta = el('div', 'hair-panel-meta');
  meta.append(
    el('span', 'hair-panel-meta-row', `category=${def?.category ?? ''}`),
    el('span', 'hair-panel-meta-row', `defaultsize=${(def?.defaultsize ?? []).join(',')}`),
    el('span', 'hair-panel-meta-row', `maxinstances=${def?.maxinstances ?? ''} private=${def?.private ?? ''}`),
    el('span', 'hair-panel-meta-row', `supportedtypes=${def?.supportedtypes ?? ''} (Hair)`),
  );
  root.appendChild(meta);
  const note = el('div', 'view-placeholder deferred');
  note.innerHTML =
    `<div class="view-placeholder-title">Hair Panel client GDI LOCK</div>` +
    `<p>${def?.note ?? 'xsivw shell only — no invent client chrome.'}</p>`;
  root.appendChild(note);
}
