// A plain message box: text and an OK button. Used where a Softimage script shows a message and stops.
// The chrome is AfterImage's own; only the text comes from the caller (usually a dictionary string).
import { openFloating, type Floating } from './floating';

export function siMsgBox(text: string, title = 'AfterImage'): Floating {
  return openFloating(title, (body, win) => {
    body.classList.add('si-msgbox');
    const msg = document.createElement('div'); msg.className = 'si-msgbox-text'; msg.textContent = text;
    msg.style.cssText = 'white-space:pre-wrap;padding:14px 16px 10px';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:center;padding:0 0 10px';
    const ok = document.createElement('button'); ok.className = 'si-msgbox-ok'; ok.textContent = 'OK'; ok.style.minWidth = '72px';
    ok.onclick = () => win.close();
    row.appendChild(ok); body.append(msg, row);
    setTimeout(() => ok.focus());
  }, { w: 320, x: Math.max(40, Math.round(window.innerWidth / 2 - 160)), y: Math.max(40, Math.round(window.innerHeight / 2 - 60)), cls: 'si-msgbox-window' });
}
