// CMD-04b support: the modal option pages of the import / export script commands (docs/ghidra/cmd-04b-import-export-model-scripts.md).
// The chrome (floating modal window, OK / Cancel row) is the one the SDK helper commands use (sdkHelpersModal.ts). This file
// only adds a page renderer that knows tabs, groups, rows, radio groups, combos and enabled state, which those option pages need.
// What comes from the contract is the content: parameters, labels, groups, items. The look is AfterImage's own.
import type { ParamSet } from '../core/params';
import { sdkModal } from './sdkHelpersModal';

export interface IeDlgItem {
  tab?: string; group?: string; row?: boolean; items?: IeDlgItem[];
  text?: string;
  param?: string; label?: string;
  control?: 'string' | 'file' | 'check' | 'number' | 'radio' | 'combo' | 'static';
  /** Radio / combo items: [label, value]. */
  choices?: [string, number][];
  /** File-path control facts (kept as data attributes; there is no host file dialog in this build). */
  filter?: string; mode?: 'open' | 'save'; mustExist?: boolean; initialDir?: string;
}
export interface IePageHooks {
  /** Layout logic: called after a parameter was edited. Return true to redraw the enabled state of every control. */
  onChange?(param: string): boolean | void;
}

function control(set: ParamSet, it: IeDlgItem, redraw: () => void, hooks: IePageHooks): HTMLElement {
  const p = set.get(it.param!);
  const r = document.createElement('div'); r.className = 'iems-row'; r.dataset.param = it.param!;
  r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;flex:1 1 auto;min-width:0';
  const label = document.createElement('label'); label.textContent = it.label ?? p?.label ?? it.param!; label.style.cssText = 'flex:0 0 auto;min-width:90px';
  const kind = it.control ?? (p?.def.type === 'bool' ? 'check' : p?.def.type === 'int' || p?.def.type === 'double' ? 'number' : 'string');
  r.dataset.control = kind;
  if (!p) r.dataset.inert = '1';   // a control bound to a parameter the property does not have: drawn, inert
  const commit = (v: any) => { if (!p) return; p.value = v; if (hooks.onChange?.(p.name) !== false) redraw(); };
  if (kind === 'static') {
    const t = document.createElement('div'); t.className = 'iems-static'; t.textContent = String(p?.value ?? ''); t.style.whiteSpace = 'pre-wrap'; r.appendChild(t);
  } else if (kind === 'check') {
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!p?.value; c.onchange = () => commit(c.checked);
    label.style.flex = '1 1 auto'; r.append(c, label);
  } else if (kind === 'radio') {
    r.style.flexDirection = 'column'; r.style.alignItems = 'flex-start';
    for (const [text, value] of it.choices ?? []) {
      const l = document.createElement('label'); l.className = 'iems-choice'; l.dataset.value = String(value);
      const c = document.createElement('input'); c.type = 'radio'; c.name = `iems-${set.id}-${it.param}`; c.value = String(value); c.checked = !!p && Number(p.value) === value;
      c.onchange = () => { if (c.checked) commit(value); };
      l.append(c, document.createTextNode(' ' + text)); r.appendChild(l);
    }
  } else if (kind === 'combo') {
    const s = document.createElement('select');
    for (const [text, value] of it.choices ?? []) { const o = document.createElement('option'); o.value = String(value); o.textContent = text; s.appendChild(o); }
    s.value = String(Number(p?.value ?? 0)); s.onchange = () => commit(Number(s.value));
    r.append(label, s);
  } else {
    const t = document.createElement('input'); t.type = kind === 'number' ? 'number' : 'text'; t.value = String(p?.value ?? ''); t.style.cssText = 'flex:1 1 auto;min-width:0';
    if (kind === 'number' && p?.def.type === 'double') t.step = 'any';
    const read = () => kind === 'number' ? Number(t.value) : t.value;
    t.onchange = () => commit(read()); t.oninput = () => { if (p && kind !== 'number') p.value = t.value; };
    r.append(label, t);
    if (kind === 'file') {
      const b = document.createElement('button'); b.className = 'iems-browse'; b.textContent = '...'; b.disabled = true; b.title = `File browser (${it.filter ?? ''}): not available in this build`;
      if (it.filter) r.dataset.filter = it.filter; if (it.mode) r.dataset.mode = it.mode; if (it.initialDir) r.dataset.initialDir = it.initialDir;
      r.dataset.mustExist = it.mustExist ? '1' : '0';
      r.appendChild(b);
    }
  }
  return r;
}

function renderItems(host: HTMLElement, set: ParamSet, items: IeDlgItem[], redraw: () => void, hooks: IePageHooks) {
  for (const it of items) {
    if (it.text !== undefined) { const t = document.createElement('div'); t.className = 'iems-static'; t.textContent = it.text; t.style.cssText = 'white-space:pre-wrap;padding:2px 0'; host.appendChild(t); }
    else if (it.group !== undefined) {
      const g = document.createElement('fieldset'); g.className = 'iems-group'; g.dataset.group = it.group; g.style.cssText = 'margin:4px 0;padding:4px 8px';
      if (it.group) { const l = document.createElement('legend'); l.textContent = it.group; g.appendChild(l); }
      renderItems(g, set, it.items ?? [], redraw, hooks); host.appendChild(g);
    } else if (it.row) {
      const r = document.createElement('div'); r.className = 'iems-line'; r.style.cssText = 'display:flex;gap:10px';
      renderItems(r, set, it.items ?? [], redraw, hooks); host.appendChild(r);
    } else if (it.param) host.appendChild(control(set, it, redraw, hooks));
  }
}

/** Draw an option page over the parameters of `set`. Edits go straight to the parameters (the page is modal and temporary). */
export function renderIePage(host: HTMLElement, set: ParamSet, layout: IeDlgItem[], hooks: IePageHooks = {}): void {
  const redraw = () => {
    for (const r of Array.from(host.querySelectorAll<HTMLElement>('.iems-row'))) {
      const p = set.get(r.dataset.param!); const off = !p || !!p.def.readOnly;
      r.dataset.enabled = off ? '0' : '1'; r.style.opacity = off ? '0.5' : '';
      for (const c of Array.from(r.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select'))) c.disabled = off;
    }
  };
  const tabs = layout.filter(i => i.tab !== undefined);
  if (!tabs.length) renderItems(host, set, layout, redraw, hooks);
  else {
    const bar = document.createElement('div'); bar.className = 'iems-tabs'; bar.style.cssText = 'display:flex;gap:2px;margin-bottom:4px';
    host.appendChild(bar);
    tabs.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'iems-tab'; b.textContent = t.tab!; b.dataset.tab = t.tab!;
      const pane = document.createElement('div'); pane.className = 'iems-pane'; pane.dataset.tab = t.tab!; pane.style.display = i ? 'none' : '';
      renderItems(pane, set, t.items ?? [], redraw, hooks);
      b.onclick = () => { for (const x of Array.from(host.querySelectorAll<HTMLElement>('.iems-pane'))) x.style.display = x === pane ? '' : 'none'; };
      bar.appendChild(b); host.appendChild(pane);
    });
  }
  redraw();
}

/** Modal inspection of an option property. Resolves true on OK, false on Cancel / close. */
export function inspectIeModal(title: string, set: ParamSet, layout: IeDlgItem[], cls: string, hooks: IePageHooks = {}): Promise<boolean> {
  return sdkModal(title, (body) => renderIePage(body, set, layout, hooks), { w: 460, cls: 'iems-ppg ' + cls });
}

/** Yes / No message box. Resolves true on Yes. */
export function ieYesNo(text: string, caption: string): Promise<boolean> {
  return sdkModal(caption, (body) => {
    const msg = document.createElement('div'); msg.className = 'iems-msg-text'; msg.textContent = text; msg.style.cssText = 'white-space:pre-wrap;padding:6px 6px 4px';
    body.appendChild(msg);
    queueMicrotask(() => {   // the shared chrome labels its buttons OK / Cancel
      const w = body.parentElement; const y = w?.querySelector('.sdkh-modal-ok'); const n = w?.querySelector('.sdkh-modal-cancel');
      if (y) y.textContent = 'Yes'; if (n) n.textContent = 'No';
    });
  }, { w: 380, cls: 'iems-yesno' });
}
