// Modal wizard page for the CMD-10a script commands (FreezeClips / FreezeAndReplaceClips UI overloads, ClipMatch).
// The page is a plain list of the property's parameters with the attested labels; the preset layouts themselves
// are open question Q2 of docs/ghidra/cmd-10a-mixer-action-scripts.md.
import type { ParamSet } from '../core/params';
import { sdkModal } from './sdkHelpersModal';

/** Opens `set` modally. Resolves true on OK, false on Cancel / close. Edits write straight to the parameters. */
export function mixerWizardDialog(title: string, set: ParamSet, params: string[]): Promise<boolean> {
  return sdkModal(title, (body) => {
    body.classList.add('mixer-wizard');
    for (const name of params) {
      const p = set.get(name); if (!p) continue;
      const row = document.createElement('div'); row.className = 'mixer-wizard-row'; row.dataset.param = name;
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0';
      const label = document.createElement('label'); label.textContent = p.def.label ?? name; label.style.cssText = 'flex:0 0 220px';
      let ctl: HTMLElement;
      if (p.def.type === 'bool') {
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!p.value; c.onchange = () => { p.value = c.checked; }; ctl = c;
      } else if (p.def.type === 'enum') {
        const s = document.createElement('select');
        for (const it of p.def.items ?? []) { const o = document.createElement('option'); o.value = String(it.value); o.textContent = it.label; s.appendChild(o); }
        s.value = String(p.value); s.onchange = () => { p.value = Number(s.value); }; ctl = s;
      } else {
        const t = document.createElement('input'); t.type = 'text'; t.value = String(p.value ?? ''); t.style.cssText = 'flex:1 1 auto;min-width:0';
        t.readOnly = !!p.def.readOnly;
        t.onchange = () => {
          if (p.def.type === 'string') { p.value = t.value; return; }
          let v = Number(t.value); if (!Number.isFinite(v)) { t.value = String(p.value); return; }
          if (p.def.min !== undefined) v = Math.max(p.def.min, v);
          if (p.def.max !== undefined) v = Math.min(p.def.max, v);
          p.value = v; t.value = String(v);
        };
        ctl = t;
      }
      row.append(label, ctl); body.appendChild(row);
    }
  }, { w: 460, cls: 'mixer-wizard-window' });
}
