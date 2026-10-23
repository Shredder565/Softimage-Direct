// View > Layouts: switching between the shipped layouts, layout editing (reorder / hide / change the view of a frame,
// drag splitters), saving user layouts, New Blank Layout (Single / Dual Screen), New Layout From, Rename, Manage.
import { App } from '../core/commands';
import { LayoutEngine, LayoutNode, captureLayout, saveUserLayout, switchLayout, layoutNames, layoutByName, currentLayoutName, userLayouts } from './layout';

export function installLayoutEditing(app: App, layout: LayoutEngine, root: HTMLElement) {
  let editing = false; const overlays: HTMLElement[] = [];
  const views = () => [...layout.views.keys()].filter(v => v !== 'View Manager' && v !== 'MCP').sort();
  const overlayFor = (frame: HTMLElement) => {
    const o = document.createElement('div'); o.className = 'layout-edit';
    const name = document.createElement('span'); name.className = 'le-name'; name.textContent = `${frame.dataset.label ?? frame.dataset.view} (${frame.dataset.name})`;
    const btn = (l: string, t: string, fn: () => void) => { const b = document.createElement('button'); b.className = 'xp-btn'; b.textContent = l; b.title = t; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
    const sib = (d: number) => { const p = frame.parentElement!; const kids = Array.from(p.children).filter(c => !c.classList.contains('splitter')); const i = kids.indexOf(frame); const j = i + d; if (j < 0 || j >= kids.length) return; const other = kids[j] as HTMLElement; if (d < 0) p.insertBefore(frame, other); else p.insertBefore(other, frame); window.dispatchEvent(new Event('resize')); };
    const sel = document.createElement('select'); sel.className = 'le-view'; for (const v of ['— change view —', ...views()]) { const op = document.createElement('option'); op.textContent = v; sel.appendChild(op); }
    sel.onchange = () => { const v = sel.value; if (v.startsWith('—')) return; if (frame.dataset.view === 'View Manager') { app.logMsg('info', 'The View Manager frame cannot change its view'); sel.selectedIndex = 0; return; } const f = layout.views.get(v); if (!f) return; frame.innerHTML = ''; frame.dataset.view = v; frame.dataset.label = v; f(frame); frame.appendChild(o); name.textContent = `${v} (${frame.dataset.name})`; sel.selectedIndex = 0; };
    o.append(name, btn('◀', 'Move before the previous frame', () => sib(-1)), btn('▶', 'Move after the next frame', () => sib(1)), btn(frame.classList.contains('hidden') ? 'show' : 'hide', 'Hide / show this frame', () => { layout.setFrameVisible(frame.dataset.name!); o.querySelectorAll('button')[2].textContent = frame.classList.contains('hidden') ? 'show' : 'hide'; }), sel);
    return o;
  };
  const start = () => { if (editing) return; editing = true; root.classList.add('layout-editing'); for (const f of Array.from(root.querySelectorAll<HTMLElement>('.frame'))) { const o = overlayFor(f); f.appendChild(o); overlays.push(o); } app.logMsg('info', 'Layout editing: use the frame bars to reorder, hide or change views, drag splitters; View > Layouts > Save Layouts keeps the result'); };
  const stop = () => { editing = false; root.classList.remove('layout-editing'); overlays.splice(0).forEach(o => o.remove()); };
  const save = (name = currentLayoutName()) => { const tree = captureLayout(root); if (!tree) return; saveUserLayout(name, tree); app.logMsg('info', `Layout "${name}" saved`); };
  const blank = (dual: boolean): LayoutNode => { const vm = (n: string): LayoutNode => ({ kind: 'frame', name: n, view: 'View Manager', label: 'View Manager' }); const one: LayoutNode = { kind: 'frameset', orientation: 'horizontal', sizes: ['*', '135'], splitter: true, children: [vm('vm'), { kind: 'frame', name: 'mcp', view: 'MCP', label: 'MCP' }] }; return dual ? { kind: 'frameset', orientation: 'horizontal', sizes: ['50%', '50%'], children: [one, { kind: 'frame', name: 'explorer', view: 'Explorer', label: 'Explorer' }] } : one; };
  const handle = (label: string, path: string[]) => {
    if (path.includes('New Blank Layout')) { const n = prompt('New layout name:', 'MyLayout'); if (!n) return; saveUserLayout(n, blank(label === 'Dual Screen')); switchLayout(n); return; }
    if (path.includes('New Layout From')) { const src = layoutByName(label); if (!src) return; const n = prompt(`New layout from "${label}" — name:`, label + '_copy'); if (!n) return; saveUserLayout(n, JSON.parse(JSON.stringify(src))); switchLayout(n); return; }
    switch (label) {
      case 'Edit Current Layout': start(); return; case 'Exit Layout Editing': stop(); return; case 'Save Layouts': save(); stop(); return;
      case 'Manage...': { const u = userLayouts(); const names = Object.keys(u); if (!names.length) { alert('No user layouts to manage (shipped layouts cannot be deleted).'); return; } const r = prompt('Delete user layout:\n' + names.map((n, i) => `${i + 1}. ${n}`).join('\n'), ''); const n = /^\d+$/.test(r ?? '') ? names[Number(r) - 1] : r; if (n && u[n]) { saveUserLayout(n, null); app.logMsg('info', `Layout "${n}" deleted`); if (currentLayoutName() === n) switchLayout('Default'); } return; }
      case 'Rename Layout': { const cur = currentLayoutName(); const n = prompt('Rename layout:', cur); if (!n || n === cur) return; const t = layoutByName(cur); if (t) { saveUserLayout(n, t); if (userLayouts()[cur]) saveUserLayout(cur, null); switchLayout(n); } return; }
    }
    if (layoutNames().includes(label)) { if (label !== currentLayoutName()) switchLayout(label); return; }
    app.logMsg('info', `Layouts: ${label} not implemented`);
  };
  window.addEventListener('layoutmenu', (e: any) => handle(e.detail?.label ?? '', e.detail?.path ?? []));
  window.addEventListener('vmlayout', (e: any) => { const l = e.detail?.layout; if (typeof l === 'string' && layoutNames().includes(l) && l !== currentLayoutName()) switchLayout(l); });
  return { start, stop, save, isEditing: () => editing };
}
