// Floating windows (property editors, explorers, preferences…) like Softimage's view windows: a title bar you can
// drag, a close box, Window > Minimize/Restore/Close All support.
export interface Floating { el: HTMLElement; body: HTMLElement; setTitle(t: string): void; close(): void; data?: any }
const open: Floating[] = [];
let z = 50;

export function openFloating(title: string, build: (body: HTMLElement, win: Floating) => void, opts: { x?: number; y?: number; w?: number; h?: number; key?: string; cls?: string } = {}): Floating {
  if (opts.key) { const ex = open.find(f => f.data?.key === opts.key); if (ex) { ex.el.style.zIndex = String(++z); return ex; } }
  const el = document.createElement('div'); el.className = 'ppg-float ' + (opts.cls ?? ''); el.style.left = (opts.x ?? 60 + open.length * 24) + 'px'; el.style.top = (opts.y ?? 40 + open.length * 24) + 'px';
  if (opts.w) el.style.width = opts.w + 'px'; if (opts.h) el.style.height = opts.h + 'px'; el.style.zIndex = String(++z);
  const bar = document.createElement('div'); bar.className = 'ppg-float-bar'; const ttl = document.createElement('span'); ttl.className = 'ppg-float-title'; ttl.textContent = title;
  const min = document.createElement('span'); min.className = 'ppg-float-close'; min.textContent = '_'; min.title = 'Minimize';
  const close = document.createElement('span'); close.className = 'ppg-float-close'; close.textContent = '×'; close.title = 'Close'; bar.append(ttl, min, close);
  const body = document.createElement('div'); body.className = 'ppg-float-body'; el.append(bar, body);
  (document.getElementById('app') ?? document.body).appendChild(el);
  const win: Floating = { el, body, setTitle: (t) => { ttl.textContent = t; }, close: () => { el.remove(); const i = open.indexOf(win); if (i >= 0) open.splice(i, 1); }, data: { key: opts.key } };
  open.push(win); build(body, win);
  close.onclick = () => win.close(); min.onclick = () => el.classList.toggle('minimized');
  el.addEventListener('pointerdown', () => { el.style.zIndex = String(++z); });
  let drag: { x: number; y: number; l: number; t: number } | null = null;
  bar.onpointerdown = (e) => { if ((e.target as HTMLElement).classList.contains('ppg-float-close')) return; drag = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop }; bar.setPointerCapture(e.pointerId); };
  bar.onpointermove = (e) => { if (!drag) return; el.style.left = drag.l + e.clientX - drag.x + 'px'; el.style.top = drag.t + e.clientY - drag.y + 'px'; };
  bar.onpointerup = () => { drag = null; };
  return win;
}
export function floatingWindows() { return open.slice(); }
export function minimizeAll() { for (const f of open) f.el.classList.add('minimized'); }
export function restoreAll() { for (const f of open) f.el.classList.remove('minimized'); }
export function closeAll() { for (const f of open.slice()) f.close(); }
