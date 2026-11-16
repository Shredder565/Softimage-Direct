// CMD-01b support: a minimal modal dialog for the SDK helper commands (LargeMsgBox, PickFolder, XSIInputBox,
// PackageAddonUI). The command bus is synchronous and the Property Editor has no modal mode that reports
// OK / Cancel, so these commands open this dialog and hand back a Promise.
//
// The chrome (floating window, OK / Cancel row) is AfterImage's own. What comes from the contract
// (docs/ghidra/cmd-01b-sdk-helpers.md) is only the content: which parameters, labels, groups and control kinds.
// The folder-picker and file-path controls are plain text fields here: there is no host file dialog yet.
import { openFloating, type Floating } from './floating';
import type { ParamSet } from '../core/params';

/** One layout item of a modal page. A superset of the `param` / `group` nodes the Property Editor layouts use. */
export interface SdkDlgItem {
  /** Static text line(s). */
  text?: string;
  spacer?: boolean;
  /** Group box; '' = unnamed group. */
  group?: string; items?: SdkDlgItem[];
  param?: string; label?: string;
  control?: 'string' | 'multiline' | 'folder' | 'file' | 'bool' | 'rgba';
  height?: number; filter?: string; opts?: string[];
}

export interface SdkModalResult { ok: boolean; win: Floating }

let modalDepth = 0;
export function sdkModalOpen(): boolean { return modalDepth > 0; }

/** Open a modal window; `build` fills the body. Resolves true on OK, false on Cancel or when the window is closed. */
export function sdkModal(title: string, build: (body: HTMLElement) => void, opts: { w?: number; cancel?: boolean; cls?: string } = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const back = document.createElement('div'); back.className = 'sdkh-modal-backdrop';
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.15)';
    (document.getElementById('app') ?? document.body).appendChild(back);
    let done = false; let result = false;
    const w = opts.w ?? 420;
    const win = openFloating(title, (body) => {
      body.classList.add('sdkh-modal');
      const content = document.createElement('div'); content.className = 'sdkh-modal-content'; content.style.cssText = 'padding:8px 10px';
      build(content);
      const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:center;gap:8px;padding:4px 0 10px';
      const ok = document.createElement('button'); ok.className = 'sdkh-modal-ok'; ok.textContent = 'OK'; ok.style.minWidth = '72px';
      ok.onclick = () => { result = true; finish(); };
      row.appendChild(ok);
      if (opts.cancel !== false) {
        const cancel = document.createElement('button'); cancel.className = 'sdkh-modal-cancel'; cancel.textContent = 'Cancel'; cancel.style.minWidth = '72px';
        cancel.onclick = () => { result = false; finish(); };
        row.appendChild(cancel);
      }
      body.append(content, row);
      setTimeout(() => ok.focus());
    }, { w, x: Math.max(40, Math.round(window.innerWidth / 2 - w / 2)), y: Math.max(40, Math.round(window.innerHeight / 4)), cls: 'sdkh-modal-window ' + (opts.cls ?? '') });
    back.style.zIndex = win.el.style.zIndex;
    win.el.parentElement?.insertBefore(back, win.el);
    modalDepth++;
    const close = win.close;
    function finish() { if (done) return; done = true; modalDepth--; back.remove(); close(); resolve(result); }
    win.close = finish;   // the title-bar close button and Window > Close All count as Cancel
    win.el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && opts.cancel !== false) { result = false; finish(); } });
  });
}

/** A message box that can be awaited (OK only). `critical` marks the siMsgCritical flag on the window. */
export function sdkMsgBox(text: string, title = 'AfterImage', critical = false): Promise<boolean> {
  return sdkModal(title, (body) => {
    const msg = document.createElement('div'); msg.className = 'sdkh-msg-text'; msg.textContent = text; msg.style.cssText = 'white-space:pre-wrap;padding:6px 6px 4px';
    body.appendChild(msg);
  }, { w: 340, cancel: false, cls: critical ? 'sdkh-msg sdkh-msg-critical' : 'sdkh-msg' });
}

/** Render `items` over the parameters of `set`. Edits write straight to the parameters (no undo entries: the page is temporary). */
export function renderSdkLayout(host: HTMLElement, set: ParamSet, items: SdkDlgItem[], onChange?: (param: string) => void): void {
  for (const it of items) {
    if (it.text !== undefined) {
      const t = document.createElement('div'); t.className = 'sdkh-static'; t.textContent = it.text; t.style.cssText = 'white-space:pre-wrap;padding:2px 0';
      host.appendChild(t);
    } else if (it.spacer) {
      const s = document.createElement('div'); s.className = 'sdkh-spacer'; s.style.height = '8px'; host.appendChild(s);
    } else if (it.group !== undefined) {
      const g = document.createElement('fieldset'); g.className = 'sdkh-group'; g.dataset.group = it.group; g.style.cssText = 'margin:4px 0;padding:4px 8px';
      if (it.group) { const l = document.createElement('legend'); l.textContent = it.group; g.appendChild(l); }
      renderSdkLayout(g, set, it.items ?? [], onChange);
      host.appendChild(g);
    } else if (it.param) {
      const p = set.get(it.param); if (!p) continue;
      const noLabel = !!it.opts?.some(o => String(o).toLowerCase() === 'nolabel');
      const kind = it.control ?? (p.def.type === 'bool' ? 'bool' : 'string');
      const r = document.createElement('div'); r.className = 'sdkh-row'; r.dataset.param = p.name; r.dataset.control = kind;
      r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0';
      const label = document.createElement('label'); label.textContent = it.label ?? p.label ?? p.name; label.style.cssText = 'flex:0 0 130px';
      const commit = (v: any) => { p.value = v; onChange?.(p.name); };
      if (kind === 'bool') {
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!p.value; c.onchange = () => commit(c.checked);
        r.append(c, label); label.style.flex = '1 1 auto';
      } else if (kind === 'multiline') {
        const t = document.createElement('textarea'); t.value = String(p.value ?? ''); t.style.cssText = `box-sizing:border-box;flex:1 1 auto;width:100%;height:${it.height ?? 60}px;resize:none`;
        t.onchange = () => commit(t.value); t.oninput = () => { p.value = t.value; };
        if (!noLabel) r.appendChild(label); r.appendChild(t);
      } else {
        const t = document.createElement('input'); t.type = 'text'; t.value = String(p.value ?? ''); t.style.cssText = 'flex:1 1 auto;min-width:0';
        t.onchange = () => commit(t.value); t.oninput = () => { p.value = t.value; };
        if (!noLabel) r.appendChild(label); r.appendChild(t);
        if (kind === 'folder' || kind === 'file') {
          // Softimage shows a browse button here; there is no host file dialog in this build, so it is disabled.
          const b = document.createElement('button'); b.className = 'sdkh-browse'; b.textContent = '...'; b.disabled = true;
          b.title = kind === 'folder' ? 'Folder browser: not available in this build' : `File browser (${it.filter ?? ''}): not available in this build`;
          if (it.filter) r.dataset.filter = it.filter;
          r.appendChild(b);
        }
      }
      host.appendChild(r);
    }
  }
}
