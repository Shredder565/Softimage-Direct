// Floating windows (property editors, explorers, preferences…) like Softimage's view windows: a title bar you can
// drag, minimize (to the tray along the bottom), close, dock into any layout frame (⊡ then click a frame, or
// Ctrl+drop the title bar on a frame), Window > Minimize/Restore/Close All and the list of open windows.
export interface Floating { el: HTMLElement; body: HTMLElement; title: string; setTitle(t: string): void; close(): void; minimize(on?: boolean): void; focus(): void; dock(frame?: HTMLElement): boolean; data?: any }
const open: Floating[] = [];
let z = 50;
/** Installed by main.ts: dock a window's content into a layout frame; returns an undock function or null. */
let dockHook: ((win: Floating, frame: HTMLElement) => boolean) | null = null;
export function setDockHook(fn: typeof dockHook) { dockHook = fn; }
let picking: Floating | null = null;

const tray = () => { let t = document.getElementById('float-tray'); if (!t) { t = document.createElement('div'); t.id = 'float-tray'; (document.getElementById('app') ?? document.body).appendChild(t); } return t; };
const frameAt = (x: number, y: number): HTMLElement | null => { const els = document.elementsFromPoint(x, y); for (const e of els) { if ((e as HTMLElement).classList?.contains('ppg-float')) continue; const f = (e as HTMLElement).closest?.('.frame') as HTMLElement | null; if (f) return f; } return null; };
let hi: HTMLElement | null = null; const highlight = (f: HTMLElement | null) => { if (hi && hi !== f) hi.classList.remove('dock-target'); hi = f; if (f) f.classList.add('dock-target'); };

export function openFloating(title: string, build: (body: HTMLElement, win: Floating) => void, opts: { x?: number; y?: number; w?: number; h?: number; key?: string; cls?: string } = {}): Floating {
  if (opts.key) { const ex = open.find(f => f.data?.key === opts.key); if (ex) { ex.focus(); return ex; } }
  const el = document.createElement('div'); el.className = 'ppg-float ' + (opts.cls ?? ''); el.style.left = (opts.x ?? 60 + open.length * 24) + 'px'; el.style.top = (opts.y ?? 40 + open.length * 24) + 'px';
  if (opts.w) el.style.width = opts.w + 'px'; if (opts.h) el.style.height = opts.h + 'px'; el.style.zIndex = String(++z);
  const bar = document.createElement('div'); bar.className = 'ppg-float-bar'; const ttl = document.createElement('span'); ttl.className = 'ppg-float-title'; ttl.textContent = title;
  const dockB = document.createElement('span'); dockB.className = 'ppg-float-close'; dockB.textContent = '⊡'; dockB.title = 'Dock: click here, then click the layout frame to dock into (or Ctrl+drop the title bar on a frame)';
  const min = document.createElement('span'); min.className = 'ppg-float-close'; min.textContent = '_'; min.title = 'Minimize';
  const close = document.createElement('span'); close.className = 'ppg-float-close'; close.textContent = '×'; close.title = 'Close'; bar.append(ttl, dockB, min, close);
  const body = document.createElement('div'); body.className = 'ppg-float-body'; el.append(bar, body);
  (document.getElementById('app') ?? document.body).appendChild(el);
  const win: Floating = {
    el, body, title, setTitle: (t) => { ttl.textContent = t; win.title = t; },
    close: () => { el.remove(); const i = open.indexOf(win); if (i >= 0) open.splice(i, 1); window.dispatchEvent(new CustomEvent('floating-changed')); },
    minimize: (on) => { const v = on ?? !el.classList.contains('minimized'); el.classList.toggle('minimized', v); if (v) { tray().appendChild(el); el.style.left = el.style.top = ''; } else { (document.getElementById('app') ?? document.body).appendChild(el); el.style.left = (win.data?.pos?.l ?? 80) + 'px'; el.style.top = (win.data?.pos?.t ?? 60) + 'px'; win.focus(); } },
    focus: () => { if (el.classList.contains('minimized')) win.minimize(false); el.style.zIndex = String(++z); },
    dock: (frame) => { if (!dockHook) return false; if (!frame) { picking = win; document.body.classList.add('dock-picking'); return true; } const ok = dockHook(win, frame); if (ok) win.close(); return ok; },
    data: { key: opts.key, pos: { l: opts.x ?? 60, t: opts.y ?? 40 } },
  };
  open.push(win); build(body, win); window.dispatchEvent(new CustomEvent('floating-changed'));
  close.onclick = () => win.close(); min.onclick = () => { win.data.pos = { l: el.offsetLeft, t: el.offsetTop }; win.minimize(true); }; dockB.onclick = () => win.dock();
  el.addEventListener('pointerdown', () => { el.style.zIndex = String(++z); });
  let drag: { x: number; y: number; l: number; t: number } | null = null;
  bar.onpointerdown = (e) => { if ((e.target as HTMLElement).classList.contains('ppg-float-close')) return; if (el.classList.contains('minimized')) { win.minimize(false); return; } drag = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop }; bar.setPointerCapture(e.pointerId); };
  bar.onpointermove = (e) => { if (!drag) return; el.style.left = drag.l + e.clientX - drag.x + 'px'; el.style.top = drag.t + e.clientY - drag.y + 'px'; highlight(e.ctrlKey ? frameAt(e.clientX, e.clientY) : null); };
  bar.onpointerup = (e) => { if (!drag) return; drag = null; const f = e.ctrlKey ? frameAt(e.clientX, e.clientY) : null; highlight(null); if (f) win.dock(f); };
  bar.ondblclick = (e) => { if ((e.target as HTMLElement).classList.contains('ppg-float-close')) return; el.classList.toggle('maximized'); };
  return win;
}
document.addEventListener('pointermove', (e) => { if (picking) highlight(frameAt(e.clientX, e.clientY)); });
document.addEventListener('click', (e) => { if (!picking) return; const w = picking; picking = null; document.body.classList.remove('dock-picking'); highlight(null); const f = frameAt(e.clientX, e.clientY); if (f && !w.el.contains(e.target as Node)) { e.stopPropagation(); e.preventDefault(); w.dock(f); } }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picking) { picking = null; document.body.classList.remove('dock-picking'); highlight(null); } });

export function floatingWindows() { return open.slice(); }
export function minimizeAll() { for (const f of open) f.minimize(true); }
export function restoreAll() { for (const f of open) f.minimize(false); }
export function closeAll() { for (const f of open.slice()) f.close(); }
