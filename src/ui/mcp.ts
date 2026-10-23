// Main Command Panel (MCP) — the Select / Transform / Snap / Constrain / Edit column on the right of Softimage's
// default layout, reproduced section by section from the real panel.
import { App } from '../core/commands';
import { tool } from './viewManager';
import { X3DObject, Model } from '../core/scene';

type Section = { el: HTMLElement; body: HTMLElement };
const button = (label: string, fn: (e: MouseEvent) => void, title = '', cls = '') => { const b = document.createElement('button'); b.className = 'mcp-btn ' + cls; b.textContent = label; b.title = title; b.onclick = fn; return b; };
const grid = (cols: number, ...els: HTMLElement[]) => { const r = document.createElement('div'); r.className = 'mcp-grid cols-' + cols; r.append(...els); return r; };
const section = (title: string, collapsed = new Set<string>(), onToggle = () => { }): Section => {
  const el = document.createElement('div'); el.className = 'mcp-sec';
  const head = document.createElement('div'); head.className = 'mcp-sec-head'; head.innerHTML = `<span class="tri">◣</span><span class="ttl">${title}</span>`;
  const body = document.createElement('div'); body.className = 'mcp-sec-body';
  head.onclick = () => { if (collapsed.has(title)) collapsed.delete(title); else collapsed.add(title); body.style.display = collapsed.has(title) ? 'none' : ''; head.querySelector('.tri')!.textContent = collapsed.has(title) ? '◢' : '◣'; onToggle(); };
  el.append(head, body); return { el, body };
};
/** Dark value field with the axis letter drawn inside on the right, as in Softimage's transform cells. */
const field = (axis: string, onCommit: (v: number) => void) => {
  const w = document.createElement('div'); w.className = 'mcp-field';
  const i = document.createElement('input'); i.type = 'text'; i.spellcheck = false; const a = document.createElement('span'); a.className = 'axis'; a.textContent = axis;
  i.onchange = () => { const v = Number(i.value); if (Number.isFinite(v)) onCommit(v); };
  i.onkeydown = (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const step = e.shiftKey ? 1 : 0.1; const v = Number(i.value) + (e.key === 'ArrowUp' ? step : -step); i.value = String(Math.round(v * 1000) / 1000); onCommit(v); } e.stopPropagation(); };
  w.append(i, a); return { w, i };
};

export function mcpPanel(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'mcp';
  host.appendChild(root);
  const collapsed = new Set<string>();
  const A = app as any; A.centerMode ??= false; A.groupMode ??= false; A.symmetry ??= false; A.cog ??= false; A.immediate ??= false; A.cnsComp ??= false; A.childComp ??= false;
  (tool as any).ref ??= 'Global'; (tool as any).snap ??= { on: false, point: true, curve: false, midpoint: false, grid: false };

  // ---------------------------------------------------------------- Select
  const sel = section('Select', collapsed);
  const arrow = document.createElement('button'); arrow.className = 'mcp-arrow'; arrow.title = 'Select tool (Esc) · right-click: selection filter'; arrow.innerHTML = '<span class="cur">➤</span>';
  arrow.onclick = () => { tool.setMode('select'); app.setSelMode('object'); };
  arrow.oncontextmenu = (e) => { e.preventDefault(); openFilterMenu(e.clientX, e.clientY); };
  const groupB = button('Group', () => { A.groupMode = !A.groupMode; upd(); }, 'Group selection mode: picking an object selects its model/branch');
  const centerB = button('Center', () => { A.centerMode = !A.centerMode; upd(); }, 'Center mode: transform the object centre (pivot) instead of the geometry');
  const stack = document.createElement('div'); stack.className = 'mcp-stack'; stack.append(groupB, centerB);
  sel.body.appendChild(grid(2, arrow, stack));
  const modes: { m: 'object' | 'point' | 'edge' | 'polygon'; l: string; k: string }[] = [{ m: 'object', l: 'Object', k: 'Space' }, { m: 'point', l: 'Point', k: 'T' }, { m: 'edge', l: 'Edge', k: 'E' }, { m: 'polygon', l: 'Polygon', k: 'Y' }];
  const modeBtns = modes.map(md => { const b = button(md.l, () => app.setSelMode(md.m), `${md.l} selection (${md.k})`); (b as any)._m = md.m; return b; });
  sel.body.appendChild(grid(2, ...modeBtns));
  const sampleB = button('Sample', () => app.logMsg('info', 'Sample selection applies to ICE point clouds (not available on polygon meshes).'), 'Sample selection mode (ICE) ▸', 'wide has-menu');
  sel.body.appendChild(grid(1, sampleB));
  // filter combo (dark) — Softimage's selection filter list
  const FILTERS = ['Object', 'Point', 'Edge', 'Polygon', 'Knot', 'Isopoint', 'Sample', 'Subcurve', 'Boundary', 'Hull', 'Null', 'Light', 'Camera', 'Model', 'Chain Element', 'Bone', 'Effector', 'Root', 'Group', 'Cluster', 'Property', 'Operator'];
  const filterSel = document.createElement('select'); filterSel.className = 'mcp-combo'; for (const f of FILTERS) { const o = document.createElement('option'); o.textContent = f; filterSel.appendChild(o); }
  filterSel.onchange = () => { const f = filterSel.value; if (['Object', 'Point', 'Edge', 'Polygon'].includes(f)) app.setSelMode(f.toLowerCase() as any); else { app.setSelMode('object'); A.selFilter = f; app.logMsg('info', `Selection filter: ${f}`); } };
  sel.body.appendChild(grid(1, filterSel));
  const openFilterMenu = (x: number, y: number) => { const m = document.createElement('div'); m.className = 'menu'; m.style.left = x + 'px'; m.style.top = y + 'px'; for (const f of FILTERS) { const it = document.createElement('div'); it.className = 'menu-item'; it.textContent = f; it.onclick = () => { filterSel.value = f; filterSel.onchange!(new Event('change')); m.remove(); }; m.appendChild(it); } document.body.appendChild(m); const close = (e: PointerEvent) => { if (!m.contains(e.target as any)) { m.remove(); document.removeEventListener('pointerdown', close); } }; setTimeout(() => document.addEventListener('pointerdown', close)); };
  // select-by-name field with up/down cycling
  const nameW = document.createElement('div'); nameW.className = 'mcp-namefield';
  const nameI = document.createElement('input'); nameI.type = 'text'; nameI.placeholder = ''; nameI.title = 'Select by name — wildcards allowed (e.g. cube*), Enter to select, ▲▼ cycle through matches';
  let matches: X3DObject[] = [], mi = -1;
  const findMatches = () => { const q = nameI.value.trim().toLowerCase(); if (!q) return []; const re = new RegExp('^' + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); return [...app.scene.allObjects()].filter(o => re.test(o.name) || re.test(o.fullName)); };
  nameI.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { matches = findMatches(); mi = -1; if (matches.length) app.select(matches); else app.logMsg('info', `No object matches "${nameI.value}"`); } };
  const cycle = (d: number) => { if (!matches.length) matches = findMatches(); if (!matches.length) return; mi = (mi + d + matches.length) % matches.length; app.select([matches[mi]]); };
  const ud = document.createElement('div'); ud.className = 'mcp-updown'; const up = button('▲', () => cycle(-1), 'Previous match', 'tiny'), dn = button('▼', () => cycle(1), 'Next match', 'tiny'); ud.append(up, dn);
  nameW.append(nameI, ud); sel.body.appendChild(nameW);
  const showExplorer = (scope: string) => { const bar = document.querySelector<HTMLElement>('.switcher-bar'); const b = bar && Array.from(bar.children).find(c => c.textContent === 'Explorer') as HTMLElement | undefined; b?.click(); (window as any).__explorerScope?.(scope); };
  sel.body.appendChild(grid(2, button('Explore', () => showExplorer('Scene'), 'Open an Explorer (8)', 'has-menu'), button('Scene', () => showExplorer('Scene'), 'Explorer scoped to the scene')));
  sel.body.appendChild(grid(2, button('Selection', () => showExplorer('Selection'), 'Explorer scoped to the current selection', 'has-menu'), button('Clusters', () => showExplorer('Selection'), 'Clusters of the selected object')));
  root.appendChild(sel.el);

  // ------------------------------------------------------------- Transform
  const tr = section('Transform', collapsed);
  const tmodes: { m: typeof tool.mode; l: string; k: string; prefix: string }[] = [{ m: 'scale', l: 's', k: 'X', prefix: 'scl' }, { m: 'rotate', l: 'r', k: 'C', prefix: 'rot' }, { m: 'translate', l: 't', k: 'V', prefix: 'pos' }];
  const modeB: HTMLElement[] = [], axisB: Record<string, HTMLElement[]> = {}, fields: Record<string, HTMLInputElement[]> = {};
  const setMode = (m: typeof tool.mode) => { tool.mode = m; modeB.forEach(b => b.classList.toggle('on', (b as any)._m === m)); app.events.emit('selection'); };
  tool.setMode = setMode;
  const setAxis = (ax: 'x' | 'y' | 'z', on: boolean) => { (tool.axes as any)[ax] = on; for (const k in axisB) axisB[k].forEach(b => { if ((b as any)._ax === ax) b.classList.toggle('on', on); }); };
  const OPTIONS: Record<string, string[]> = { scale: ['Uniform Scaling', 'Add', 'Volume', 'Scale Relative to Center'], rotate: ['Add', 'Increment 15°', 'Increment 45°', 'Interactive'], translate: ['Add', 'Planar XY', 'Planar YZ', 'Planar XZ', 'Snap to Pivot'] };
  for (const md of tmodes) {
    const mb = button(md.l, () => setMode(tool.mode === md.m ? 'select' : md.m), `${md.m[0].toUpperCase() + md.m.slice(1)} tool (${md.k})`, 'mode'); (mb as any)._m = md.m; modeB.push(mb);
    axisB[md.m] = (['x', 'y', 'z'] as const).map(ax => { const b = button(ax, () => setAxis(ax, !(tool.axes as any)[ax]), `Manipulate the ${ax.toUpperCase()} axis only — click several to combine`, 'axis on'); (b as any)._ax = ax; return b; });
    const opt = button('≡', (e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); const m = document.createElement('div'); m.className = 'menu'; m.style.left = r.left + 'px'; m.style.top = r.bottom + 'px'; for (const o of OPTIONS[md.m]) { const it = document.createElement('div'); it.className = 'menu-item'; it.textContent = o; it.onclick = () => { app.logMsg('info', `${md.m}: ${o}`); m.remove(); }; m.appendChild(it); } document.body.appendChild(m); const close = (ev: PointerEvent) => { if (!m.contains(ev.target as any)) { m.remove(); document.removeEventListener('pointerdown', close); } }; setTimeout(() => document.addEventListener('pointerdown', close)); }, 'Options', 'tiny');
    tr.body.appendChild(grid(5, mb, ...axisB[md.m], opt));
    fields[md.m] = (['x', 'y', 'z'] as const).map(ax => { const f = field(ax, v => { for (const o of app.selectedObjects) app.setParam(o.kinematics.local.get(md.prefix + ax)!, v, md.m); }); return f; }).map(f => { tr.body.appendChild(f.w); return f.i; });
  }
  const REFS = ['Global', 'Local', 'View', 'Par', 'Ref', 'Plane'];
  const refB = REFS.map(r => button(r, () => { (tool as any).ref = r; refB.forEach(b => b.classList.toggle('on', b.textContent === r)); }, `${r} reference frame for manipulation`));
  refB[0].classList.add('on');
  tr.body.appendChild(grid(3, ...refB.slice(0, 3))); tr.body.appendChild(grid(3, ...refB.slice(3)));
  const cogB = button('COG', () => { A.cog = !A.cog; upd(); }, 'Transform multiple objects about their common centre of gravity');
  const propB = button('Prop', () => { app.proportional.on = !app.proportional.on; upd(); }, 'Proportional modeling (falloff)');
  const symB = button('Sym', () => { A.symmetry = !A.symmetry; upd(); }, 'Symmetry: mirror component edits across the X plane');
  tr.body.appendChild(grid(3, cogB, propB, symB));
  root.appendChild(tr.el);

  // ------------------------------------------------------------------- Snap
  const sn = section('Snap', collapsed);
  const S = (tool as any).snap;
  const snapOn = button('ON', () => { S.on = !S.on; upd(); }, 'Enable snapping (hold Ctrl while manipulating)');
  const snapKinds: [string, string, string][] = [['point', '•', 'Snap to points'], ['curve', '∿', 'Snap to curves / edges'], ['midpoint', '◌', 'Snap to midpoints'], ['grid', '▦', 'Snap to the grid']];
  const snapB = snapKinds.map(([k, g, t]) => { const b = button(g, () => { S[k] = !S[k]; upd(); }, t, 'icon'); (b as any)._k = k; return b; });
  sn.body.appendChild(grid(5, snapOn, ...snapB));
  root.appendChild(sn.el);

  // -------------------------------------------------------------- Constrain
  const cn = section('Constrain', collapsed);
  cn.body.appendChild(grid(2, button('Parent', () => { const objs = app.selectedObjects; if (objs.length < 2) { app.logMsg('info', 'Parent: select the children, then Shift-click the parent (or pick it) and click Parent'); return; } const parent = objs[objs.length - 1]; app.run('ParentObj', { Parent: parent.fullName, Children: objs.slice(0, -1) }); }, 'Parent: make the last-selected object the parent of the others'), button('Cut', () => app.run('CutObj'), 'Cut the hierarchical link (reparent to the scene root)')));
  const cnsB = button('CnsComp', () => { A.cnsComp = !A.cnsComp; upd(); }, 'Constraint compensation'), chdB = button('ChldComp', () => { A.childComp = !A.childComp; upd(); }, 'Child transform compensation (children keep their global pose when the parent moves)');
  cn.body.appendChild(grid(2, cnsB, chdB));
  root.appendChild(cn.el);

  // ------------------------------------------------------------------- Edit
  const ed = section('Edit', collapsed);
  ed.body.appendChild(grid(2, button('Freeze', () => app.run('FreezeObj'), 'Freeze: collapse the construction history'), button('Group', () => app.run('CreateGroup'), 'Group the selected objects')));
  const immB = button('Immed', () => { A.immediate = !A.immediate; upd(); }, 'Immediate mode: operators are applied and frozen right away');
  ed.body.appendChild(grid(2, button('Freeze M', () => app.run('FreezeModeling'), 'Freeze Modeling: freeze operators below the Modeling marker'), immB));
  root.appendChild(ed.el);

  // --------------------------------------------------------------- updates
  const upd = () => {
    modeBtns.forEach(b => { const on = (b as any)._m === app.selMode; b.classList.toggle('on', on); });
    groupB.classList.toggle('on', !!A.groupMode); centerB.classList.toggle('on', !!A.centerMode);
    const o = app.selectedObjects[0];
    for (const md of tmodes) fields[md.m].forEach((i, k) => { if (document.activeElement === i) return; i.value = o ? String(Math.round(o.kinematics.local.val(md.prefix + 'xyz'[k]) * 1000) / 1000) : ''; });
    cogB.classList.toggle('on', !!A.cog); propB.classList.toggle('on', !!app.proportional.on); symB.classList.toggle('on', !!A.symmetry);
    snapOn.classList.toggle('on', !!S.on); snapB.forEach(b => b.classList.toggle('on', !!S[(b as any)._k]));
    cnsB.classList.toggle('on', !!A.cnsComp); chdB.classList.toggle('on', !!A.childComp); immB.classList.toggle('on', !!A.immediate);
  };
  upd(); app.events.on('selection', upd); app.events.on('params', upd); app.events.on('scene', upd); app.events.on('frame', upd);

  // ---------------------------------------------------------------- hotkeys
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement; if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
    if (app.activeTool && (e.key === 'Enter' || e.key === 'Escape')) return;
    const k = e.key.toLowerCase();
    if (k === 'x') setMode('scale'); else if (k === 'c') setMode('rotate'); else if (k === 'v') setMode('translate'); else if (k === 'escape') { setMode('select'); app.setSelMode('object'); }
    else if (k === 't') app.setSelMode('point'); else if (k === 'e') app.setSelMode('edge'); else if (k === 'y') app.setSelMode('polygon'); else if (k === ' ') { e.preventDefault(); app.setSelMode('object'); }
    else if (k === 'delete') app.run('DeleteObj'); else if (k === 'h') app.run('ToggleVisibility'); else if (k === 'k') app.run('SaveKey');
    else if (k === 'z' && e.ctrlKey) { e.preventDefault(); app.undo(); } else if (k === 'y' && e.ctrlKey) { e.preventDefault(); app.redo(); }
    else if (k === 'd' && e.ctrlKey) { e.preventDefault(); app.run('Duplicate'); }
    else if (k === '1') { app.module = 'Model' as any; app.events.emit('module'); } else if (k === '2') { app.module = 'Animate' as any; app.events.emit('module'); } else if (k === '3') { app.module = 'Render' as any; app.events.emit('module'); } else if (k === '4') { app.module = 'Simulate' as any; app.events.emit('module'); }
    else if (k === 'arrowright') app.run('NextFrame'); else if (k === 'arrowleft') app.run('PrevFrame');
    else if (k === '8') showExplorer('Scene');
    else if (k === 'f' && !e.ctrlKey) window.dispatchEvent(new CustomEvent('framesel'));
    else if (k === 'a' && e.ctrlKey && e.shiftKey) { e.preventDefault(); app.compSel = null; app.select([]); }
    else if (k === 'a' && !e.ctrlKey) window.dispatchEvent(new CustomEvent('frameall'));
  });
  void Model;
}
