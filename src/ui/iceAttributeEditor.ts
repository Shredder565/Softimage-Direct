// Softimage ICE Attribute Editor — xsivw shell + Desktop HWND client GDI (Gate B).
// Toolbar labels + body static from float_children_detail; grid cells LOCK.
import { App } from '../core/commands';
import iceViewChrome from '../data/si/ice_view_chrome.json';
import { applyIceTreeChromeVars, iceAttrToolbarLabels, iceAttrBodyStatic } from './iceTreeChrome';

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

/** Softimage OpenView("ICE Attribute Editor") — Desktop DUMP_READY client chrome. */
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
  root.dataset.siStatus = def?.status ?? 'CLIENT_GDI';
  root.dataset.siClientGdi = def?.client_gdi ?? 'DUMP_READY';

  const toolbar = el('div', 'ice-attr-toolbar');
  for (const label of iceAttrToolbarLabels()) {
    const b = el('button', 'xp-btn', label) as HTMLButtonElement;
    if (label === 'ICE Tree') {
      b.onclick = () => window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'ICE Tree' } }));
    }
    toolbar.appendChild(b);
  }
  root.appendChild(toolbar);

  const body = el('div', 'ice-attr-body');
  const msg = iceAttrBodyStatic();
  body.appendChild(el('div', 'ice-attr-body-static', msg));
  root.appendChild(body);
}
