// CMD-01e support: the two modal pages of the Alembic menu commands (options page, file browser).
//
// The command bus is synchronous and the Property Editor has no modal mode that reports OK / Cancel, so the
// menu commands open these pages through the modal chrome of src/ui/sdkHelpersModal.ts and get a Promise.
// What comes from the contract (docs/ghidra/cmd-01e-alembic.md) is the content: parameters, labels, groups,
// combo items, buttons, the browser's title / filter / initial directory. The chrome is AfterImage's own.
// There is no host file dialog in the renderer: the file browser is a page with a directory and a file-name
// field over the session's virtual host file system.
import type { ParamSet } from '../core/params';
import type { LayoutNode } from '../core/opdefs';
import { sdkModal } from './sdkHelpersModal';

/** A property-page layout node plus a static text line. */
export type AbcDlgItem = LayoutNode & { text?: string; items?: AbcDlgItem[] };

/** Render `items` over `set`. Edits write straight to the parameters. `onButton` gets the button id. */
export function renderAbcLayout(host: HTMLElement, set: ParamSet, items: AbcDlgItem[], onButton: (id: string) => void, rerender: () => void): void {
  for (const it of items) {
    if (it.text !== undefined) {
      const t = document.createElement('div'); t.className = 'abc-static'; t.textContent = it.text; t.style.cssText = 'white-space:pre-wrap;padding:2px 0';
      host.appendChild(t);
    } else if (it.group !== undefined) {
      const g = document.createElement('fieldset'); g.className = 'abc-group'; g.dataset.group = it.group; g.style.cssText = 'margin:4px 0;padding:4px 8px';
      if (it.group) { const l = document.createElement('legend'); l.textContent = it.group; g.appendChild(l); }
      renderAbcLayout(g, set, it.items ?? [], onButton, rerender);
      host.appendChild(g);
    } else if (it.button !== undefined) {
      const b = document.createElement('button'); b.className = 'abc-button'; b.dataset.button = it.button; b.textContent = it.label ?? it.button; b.style.marginRight = '6px';
      b.onclick = () => { onButton(it.button!); rerender(); };
      host.appendChild(b);
    } else if (it.param) {
      const p = set.get(it.param); if (!p) continue;
      const r = document.createElement('div'); r.className = 'abc-row'; r.dataset.param = p.name; r.dataset.control = p.def.type;
      r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0';
      const label = document.createElement('label'); label.textContent = it.label ?? p.label; label.style.cssText = 'flex:0 0 150px';
      if (p.def.type === 'bool') {
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!p.value; c.onchange = () => { p.value = c.checked; };
        label.style.flex = '1 1 auto'; r.append(c, label);
      } else if (p.def.type === 'enum') {
        const s = document.createElement('select'); s.style.cssText = 'flex:1 1 auto;min-width:0';
        (p.def.items ?? []).forEach((item, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = item.label; o.selected = item.value === p.value; s.appendChild(o); });
        s.onchange = () => { const item = (p.def.items ?? [])[Number(s.value)]; if (item) p.value = item.value; };
        r.append(label, s);
      } else {
        const t = document.createElement('input'); t.type = p.def.type === 'string' ? 'text' : 'number'; t.value = String(p.value ?? ''); t.style.cssText = 'flex:1 1 auto;min-width:0';
        const commit = () => { p.value = t.value; };
        t.onchange = commit; t.oninput = commit;
        r.append(label, t);
      }
      host.appendChild(r);
    }
  }
}

/** The modal options page. Resolves true on OK, false on Cancel / close. */
export function abcOptionsDialog(title: string, set: ParamSet, items: AbcDlgItem[], onButton: (id: string) => void, size: { w?: number; h?: number } = {}): Promise<boolean> {
  return sdkModal(title, (body) => {
    if (size.h) { body.style.minHeight = `${size.h}px`; body.dataset.viewHeight = String(size.h); }
    const draw = () => { body.textContent = ''; renderAbcLayout(body, set, items, onButton, draw); };
    draw();
  }, { w: size.w ?? 460, cls: `abc-ppg abc-${set.type}` });
}

export interface AbcBrowseRequest { title: string; filter: string; initialDirectory: string; save: boolean }

/** The file browser page. Resolves the full path, or '' when cancelled or no file name was given. */
export function abcFileBrowser(req: AbcBrowseRequest, join: (dir: string, name: string) => string): Promise<string> {
  let dir: HTMLInputElement, name: HTMLInputElement;
  return sdkModal(req.title, (body) => {
    body.dataset.filter = req.filter; body.dataset.mode = req.save ? 'save' : 'open';
    const row = (cls: string, text: string, value: string) => {
      const r = document.createElement('div'); r.className = cls; r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0';
      const l = document.createElement('label'); l.textContent = text; l.style.cssText = 'flex:0 0 90px';
      const t = document.createElement('input'); t.type = 'text'; t.value = value; t.style.cssText = 'flex:1 1 auto;min-width:0';
      r.append(l, t); body.appendChild(r); return t;
    };
    dir = row('abc-browse-dir', 'Look in', req.initialDirectory);
    name = row('abc-browse-name', 'File name', '');   // base name empty
    const f = document.createElement('div'); f.className = 'abc-browse-filter'; f.textContent = req.filter.split('|')[0]; f.style.cssText = 'padding:2px 0;opacity:0.8';
    body.appendChild(f);
  }, { w: 460, cls: `abc-filebrowser abc-filebrowser-${req.save ? 'save' : 'open'}` }).then((ok) => {
    const n = name.value.trim();
    if (!ok || n === '') return '';
    return /^([A-Za-z]:|\\\\|\/\/)/.test(n) ? n : join(dir.value.trim(), n);
  });
}
