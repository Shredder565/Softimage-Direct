// Softimage dialog templates (RT_DIALOG) rendered from the committed PE dump: title, dialog-unit rect,
// font and per-control text/class/style come from src/data/si/ui_dialogs.json
// (tools/build_ui_surface_audit.py). Positions are converted dialog-unit → pixel with the Win32 rule
// (x·baseX/4, y·baseY/8), where the base units are measured from the template's own font.
//
// Like genppg, a control whose class the renderer does not know is skipped rather than guessed at
// (Softimage logs "Ignoring dscontrol with unrecognized class" — XSIGENPPG 3522).
import uiDialogs from '../data/si/ui_dialogs.json';
import { openFloating } from './floating';

export type SiDialogControl = { cls: string; text: string; id: number; dlu: [number, number, number, number]; style: number };
export type SiDialogTemplate = {
  dll: string; id: string; title: string; rectDlu: [number, number, number, number];
  font: [number, string]; surface: string; controls: SiDialogControl[];
};

export const SI_DIALOGS = (uiDialogs as unknown as { dialogs: Record<string, SiDialogTemplate> }).dialogs;

/** Win32 button styles the dump uses in its low nibble (BS_*). */
const BS = { PUSH: 0, DEFPUSH: 1, CHECK: 2, AUTOCHECK: 3, RADIO: 4, THREE: 5, AUTOTHREE: 6, GROUPBOX: 7, USER: 8, AUTORADIO: 9, OWNERDRAW: 11 } as const;
const ES_MULTILINE = 0x0004;
const WS_DISABLED = 0x08000000;

/** Classic Win32 dialog base units for 8pt MS Sans Serif (6 × 13) — the fallback when no canvas is available. */
const FALLBACK_BASE: [number, number] = [6, 13];

const baseCache = new Map<string, [number, number]>();
/** Dialog base units: average character width and line height of the template font (GetDialogBaseUnits). */
function baseUnits(font: [number, string]): [number, number] {
  const [pt, family] = font;
  const key = `${pt}|${family}`;
  const hit = baseCache.get(key);
  if (hit) return hit;
  let base = FALLBACK_BASE;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      const px = pt * (96 / 72);
      ctx.font = `${px}px "${family}", "MS Sans Serif", Arial, sans-serif`;
      const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      base = [ctx.measureText(alpha).width / alpha.length, px * 1.18];
    }
  } catch { /* no canvas (node harness) — keep the classic base units */ }
  baseCache.set(key, base);
  return base;
}

export function dialogFontPx(font: [number, string]): number { return Math.round(font[0] * (96 / 72)); }

/** Dialog-unit rect → pixel rect for one template. */
export function dluToPx(font: [number, string], dlu: [number, number, number, number]): [number, number, number, number] {
  const [bx, by] = baseUnits(font);
  return [
    Math.round((dlu[0] * bx) / 4), Math.round((dlu[1] * by) / 8),
    Math.round((dlu[2] * bx) / 4), Math.round((dlu[3] * by) / 8),
  ];
}

/** Pixel size of a template's own client rect — what the floating window opens at. */
export function dialogSizePx(tpl: SiDialogTemplate): { w: number; h: number } {
  const [, , w, h] = dluToPx(tpl.font, tpl.rectDlu);
  return { w: w + 16, h: h + 36 };
}

export type SiDialogHandle = {
  tpl: SiDialogTemplate;
  root: HTMLElement;
  /** Controls by their RT_DIALOG control id (ids 1 = OK, 2 = Cancel, 9 = Help as Win32 defines them). */
  byId: Map<number, HTMLElement>;
  /** Controls whose class the renderer does not know — reported, never guessed at. */
  unknownClasses: string[];
  value(id: number): string;
  setValue(id: number, v: string): void;
  /** Checkbox / radio state (BS_AUTOCHECKBOX, BS_AUTORADIOBUTTON controls). */
  checked(id: number): boolean;
  setChecked(id: number, v: boolean): void;
  on(id: number, fn: (el: HTMLElement) => void): void;
  /** `change` on an edit / combo / check, or `pick` on a list. */
  onChange(id: number, fn: (el: HTMLElement) => void): void;
  fillList(id: number, items: string[], selected?: number): void;
  selected(id: number): string;
  /** Replace a control's label text (statics the dialog fills from code). */
  setText(id: number, text: string): void;
  enable(id: number, on: boolean): void;
};

/** Build one attested template into `host`. Pure layout — callers attach behaviour through the handle. */
export function renderSiDialog(tpl: SiDialogTemplate, host: HTMLElement): SiDialogHandle {
  const [, , w, h] = dluToPx(tpl.font, tpl.rectDlu);
  const root = document.createElement('div');
  root.className = 'si-dlg';
  root.dataset.dll = tpl.dll;
  root.dataset.dialog = tpl.id;
  root.style.cssText = `width:${w}px;height:${h}px;font:${dialogFontPx(tpl.font)}px "${tpl.font[1]}", "MS Sans Serif", Arial, sans-serif`;
  const byId = new Map<number, HTMLElement>();
  const unknownClasses: string[] = [];

  for (const c of tpl.controls) {
    const [x, y, cw, ch] = dluToPx(tpl.font, c.dlu);
    const el = control(c);
    if (!el) { if (!unknownClasses.includes(c.cls)) unknownClasses.push(c.cls); continue; }
    el.classList.add('si-dlg-ctl');
    el.dataset.dlgId = String(c.id);
    el.dataset.cls = c.cls;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.style.width = `${cw}px`;
    // Group boxes and multi-line statics keep their template height; single-line controls use it as a minimum
    // so a CSS-rendered control is never clipped below the Win32 metric.
    el.style.height = `${ch}px`;
    if (c.style & WS_DISABLED) el.classList.add('disabled');
    root.appendChild(el);
    byId.set(c.id, el);
  }
  host.appendChild(root);

  const field = (id: number) => byId.get(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
  const box = (id: number) => byId.get(id)?.querySelector<HTMLInputElement>('input[type=checkbox], input[type=radio]') ?? undefined;
  return {
    tpl, root, byId, unknownClasses,
    value: (id) => { const f = field(id); return f ? String(f.value ?? '') : ''; },
    setValue: (id, v) => { const f = field(id); if (f) f.value = v; },
    checked: (id) => !!box(id)?.checked,
    setChecked: (id, v) => { const b = box(id); if (b) b.checked = v; },
    on: (id, fn) => { const el = byId.get(id); if (el) el.addEventListener('click', () => fn(el)); },
    onChange: (id, fn) => {
      const el = byId.get(id);
      if (!el) return;
      el.addEventListener(el.classList.contains('si-dlg-list') ? 'pick' : 'change', () => fn(el));
    },
    setText: (id, text) => {
      const el = byId.get(id);
      if (!el) return;
      const span = el.querySelector('span');
      if (span) span.textContent = text; else el.textContent = text;
    },
    enable: (id, on) => {
      const el = byId.get(id);
      if (!el) return;
      el.classList.toggle('disabled', !on);
      const f = el as HTMLInputElement;
      if ('disabled' in f) f.disabled = !on;
      const b = box(id); if (b) b.disabled = !on;
    },
    fillList: (id, items, selected = -1) => {
      const el = byId.get(id);
      if (!el) return;
      if (el instanceof HTMLSelectElement) {
        el.innerHTML = '';
        for (const t of items) { const o = document.createElement('option'); o.textContent = t; el.appendChild(o); }
        if (selected >= 0) el.selectedIndex = selected;
        return;
      }
      el.innerHTML = '';
      items.forEach((t, i) => {
        const r = document.createElement('div');
        r.className = 'si-dlg-item' + (i === selected ? ' selected' : '');
        r.textContent = t;
        r.onclick = () => {
          for (const s of Array.from(el.children)) s.classList.remove('selected');
          r.classList.add('selected');
          el.dispatchEvent(new CustomEvent('pick', { detail: t }));
        };
        el.appendChild(r);
      });
    },
    selected: (id) => {
      const el = byId.get(id);
      if (!el) return '';
      if (el instanceof HTMLSelectElement) return el.value;
      return el.querySelector('.si-dlg-item.selected')?.textContent ?? '';
    },
  };
}

function control(c: SiDialogControl): HTMLElement | null {
  const text = c.text;
  switch (c.cls) {
    case 'static': {
      const d = document.createElement('div');
      d.className = 'si-dlg-static';
      d.textContent = text;
      return d;
    }
    case 'button': {
      const kind = c.style & 0x0f;
      if (kind === BS.GROUPBOX) {
        const g = document.createElement('fieldset');
        g.className = 'si-dlg-group';
        const l = document.createElement('legend'); l.textContent = text.trim();
        g.appendChild(l);
        return g;
      }
      if (kind === BS.CHECK || kind === BS.AUTOCHECK || kind === BS.THREE || kind === BS.AUTOTHREE
        || kind === BS.RADIO || kind === BS.AUTORADIO) {
        const wrap = document.createElement('label');
        wrap.className = 'si-dlg-check';
        const i = document.createElement('input');
        i.type = kind === BS.RADIO || kind === BS.AUTORADIO ? 'radio' : 'checkbox';
        i.name = `dlg-${c.id}`;
        wrap.append(i, Object.assign(document.createElement('span'), { textContent: amp(text) }));
        return wrap;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'si-dlg-btn' + (kind === BS.DEFPUSH ? ' default' : '');
      b.textContent = amp(text);
      return b;
    }
    case 'edit': {
      if (c.style & ES_MULTILINE) {
        const t = document.createElement('textarea');
        t.className = 'si-dlg-edit multiline';
        t.spellcheck = false;
        t.value = text;
        t.onkeydown = e => e.stopPropagation();
        return t;
      }
      const i = document.createElement('input');
      i.type = 'text';
      i.className = 'si-dlg-edit';
      i.value = text;
      i.onkeydown = e => e.stopPropagation();
      return i;
    }
    case 'combobox': {
      const s = document.createElement('select');
      s.className = 'si-dlg-combo';
      return s;
    }
    case 'listbox':
    case 'SysListView32':
    case 'SysTreeView32':
    case 'DSGrid': {
      const d = document.createElement('div');
      d.className = 'si-dlg-list';
      return d;
    }
    default:
      // genppg behaviour: an unrecognised dscontrol class is dropped, not approximated.
      return null;
  }
}

/** Win32 "&Mnemonic" → plain label ("&&" is a literal ampersand). */
function amp(s: string): string { return s.replace(/&&/g, '\u0000').replace(/&/g, '').replace(/\u0000/g, '&'); }

/** Open an attested template as a floating Softimage dialog. `key` is `<dll>#<id>`. */
export function openSiDialog(
  key: string,
  opts: { title?: string; onReady?: (dlg: SiDialogHandle, close: () => void) => void } = {},
): SiDialogHandle | null {
  const tpl = SI_DIALOGS[key];
  if (!tpl) return null;
  const { w, h } = dialogSizePx(tpl);
  let handle: SiDialogHandle | null = null;
  openFloating(opts.title ?? tpl.title, (body, win) => {
    body.classList.add('si-dlg-host');
    handle = renderSiDialog(tpl, body);
    // Win32 dialog conventions: id 1 closes with OK, id 2 cancels.
    handle.on(2, () => win.close());
    opts.onReady?.(handle, () => win.close());
  }, { w, h, key: 'sidlg:' + key });
  return handle;
}

/** Inventory for __uiAudit: every template, its control census and the classes the renderer skips. */
export function siDialogAudit(): {
  count: number;
  dialogs: { key: string; title: string; dll: string; controls: number; px: [number, number]; surface: string }[];
  unknownClasses: string[];
} {
  const unknown = new Set<string>();
  const dialogs = Object.entries(SI_DIALOGS).map(([key, tpl]) => {
    for (const c of tpl.controls) if (!control(c)) unknown.add(c.cls);
    const { w, h } = dialogSizePx(tpl);
    return { key, title: tpl.title, dll: tpl.dll, controls: tpl.controls.length, px: [w, h] as [number, number], surface: tpl.surface };
  });
  return { count: dialogs.length, dialogs, unknownClasses: [...unknown].sort() };
}
