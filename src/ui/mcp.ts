// Main Command Panel (MCP) — the Select / Transform / Snap / Constrain / Edit column on the right of Softimage's
// default layout, reproduced section by section from the real panel.
import { App } from '../core/commands';
import { tool } from './viewManager';
import { siFilterNames, SI_MENUS, SiMenuItem, openSiMenu } from './si';
import { X3DObject, Model } from '../core/scene';
import { commandEnabled, mcpSampleEnabled } from './cmdEnable';
import { hwndButtonEnabled } from './mcpEnableMatrix';

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

/** The full MCP, or (with `only`) one of its sections as a standalone view: Selection / Transformation / Snap / Edit Panel, Mini Transform Panel. */
export function mcpPanel(app: App, host: HTMLElement, opts: { only?: string[]; cls?: string } = {}) {
  const root = document.createElement('div'); root.className = 'mcp ' + (opts.cls ?? '');
  const want = (t: string) => !opts.only || opts.only.includes(t);
  const add = (t: string, el: HTMLElement) => { if (want(t)) root.appendChild(el); };
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
  const FILTERS = ['Object', 'Point', 'Edge', 'Polygon', 'Knot', 'Isopoint', 'Sample', 'Subcurve', 'Boundary', 'Hull', 'Polynode', 'Domainpoint', 'Surfacecurve', 'Trimboundary', ...siFilterNames().filter(f => !['Objects'].includes(f)), 'Model', 'Chain Element', 'Effector', 'Root', 'Cluster', 'Property', 'Operator'].filter((f, i, a) => a.indexOf(f) === i);
  const filterSel = document.createElement('select'); filterSel.className = 'mcp-combo'; for (const f of FILTERS) { const o = document.createElement('option'); o.textContent = f; filterSel.appendChild(o); }
  filterSel.onchange = () => {
    const f = filterSel.value;
    if (['Object', 'Point', 'Edge', 'Polygon'].includes(f)) { A.selFilter = f; app.setSelMode(f.toLowerCase() as any); }
    else { A.selFilter = f; app.setSelMode('object'); app.logMsg('info', `Selection filter: ${f}`); app.events.emit('selection'); }
  };
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
  const exploreB = button('Explore', (e) => { e.stopPropagation(); const r = (e.target as HTMLElement).getBoundingClientRect(); const items = (SI_MENUS.mcpExplore ?? []).map(it => it.label?.startsWith('TITLE:') ? { label: it.label.slice(6), items: [] as SiMenuItem[], title: true } as any : it); openSiMenu(items, r.left, r.bottom, (it) => { const l = it.label ?? ''; const scope = ['Layers', 'Passes', 'Materials', 'Groups', 'Application'].includes(l) ? l : /Current|Scene|Environment|Lights|Cameras|Operators|Shaders|Images|Animation|Audio|Sources|Mixers|Constraints|Property|Custom|Texture/.test(l) ? 'Scene' : 'Scene'; showExplorer(scope); }, { enabled: it => !(it as any).title }); }, 'Open an Explorer (8)', 'has-menu');
  sel.body.appendChild(grid(2, exploreB, button('Scene', () => showExplorer('Scene'), 'Explorer scoped to the scene')));
  sel.body.appendChild(grid(2, button('Selection', () => showExplorer('Selection'), 'Explorer scoped to the current selection', 'has-menu'), button('Clusters', () => showExplorer('Selection'), 'Clusters of the selected object')));
  add('Select', sel.el);

  // ------------------------------------------------------------- Transform
  const tr = section('Transform', collapsed);
  const tmodes: { m: typeof tool.mode; l: string; k: string; prefix: string }[] = [{ m: 'scale', l: 's', k: 'X', prefix: 'scl' }, { m: 'rotate', l: 'r', k: 'C', prefix: 'rot' }, { m: 'translate', l: 't', k: 'V', prefix: 'pos' }];
  const modeB: HTMLElement[] = [], axisB: Record<string, HTMLElement[]> = {}, fields: Record<string, HTMLInputElement[]> = {};
  const setMode = (m: typeof tool.mode) => { tool.mode = m; modeB.forEach(b => b.classList.toggle('on', (b as any)._m === m)); app.events.emit('selection'); };
  tool.setMode = setMode;
  const setAxis = (ax: 'x' | 'y' | 'z', on: boolean) => { (tool.axes as any)[ax] = on; for (const k in axisB) axisB[k].forEach(b => { if ((b as any)._ax === ax) b.classList.toggle('on', on); }); };
  // The ≡ option menus are Softimage's own TRANSLATE / ROTATE / SCALE tool menus (viewinteraction.dll resources).
  const OPTIONS: Record<string, SiMenuItem[]> = { scale: SI_MENUS.toolScale ?? [], rotate: SI_MENUS.toolRotate ?? [], translate: SI_MENUS.toolTranslate ?? [] };
  // Softimage viewinteraction.dll menus 530–532 leaf handlers (PE-attested labels; no invent plane chrome).
  const pickOption = (m: string, label: string) => {
    const refs: Record<string, string> = { Global: 'Global', Local: 'Local', View: 'View', Parent: 'Par', Ref: 'Ref', Plane: 'Plane' };
    if (refs[label]) { refB.find(b => b.textContent === refs[label])?.click(); return; }
    if (label === 'COG') cogB.click();
    else if (label === 'Prop') propB.click();
    else if (label === 'Sym') symB.click();
    else if (label === 'Uniform') { (tool as any).uniform = !(tool as any).uniform; (tool as any).volume = false; }
    else if (label === 'Volume') { (tool as any).volume = !(tool as any).volume; if ((tool as any).volume) (tool as any).uniform = false; }
    else if (label === 'Add') { (tool as any).addRotate = !(tool as any).addRotate; app.logMsg('info', `Rotate Add ${((tool as any).addRotate ? 'ON' : 'OFF')} (Softimage additive rotate ref)`); }
    else if (label === 'Edit Pivot') { A.editPivot = !A.editPivot; A.centerMode = !!A.editPivot; app.logMsg('info', `Edit Pivot ${A.editPivot ? 'ON' : 'OFF'}`); app.events.emit('selection'); }
    else if (label === 'Lock Pivot' || label === 'Lock') { A.pivotLocked = !A.pivotLocked; app.logMsg('info', `Lock Pivot ${A.pivotLocked ? 'ON' : 'OFF'}`); }
    else if (label === 'Reset Pivot' || label === 'Reset') {
      if (A.pivotLocked) { app.logMsg('info', 'Reset Pivot: pivot is locked'); return; }
      for (const o of app.selectedObjects) for (const ax of ['x', 'y', 'z']) app.setParam(o.kinematics.local.get('ppos' + ax)!, 0);
    }
    else if (label === 'Slide Components') { A.slideMode = !A.slideMode; app.logMsg('info', `Slide components ${A.slideMode ? 'ON' : 'OFF'}`); }
    else if (label === 'Weld Points') app.run('WeldPoints');
    else if (label === 'Translate' || label === 'Rotate' || label === 'Scale') setMode(label.toLowerCase() as any);
    else if (label === 'Points' || label === 'Edges' || label === 'Polygons') app.setSelMode(label.slice(0, -1).toLowerCase() as any);
    else if (label === 'Points + Edges' || label === 'Tweak All') { app.setSelMode('point'); A.tweakAll = label === 'Tweak All'; }
    else if (label === 'Next Manipulator') setMode(tool.mode === 'translate' ? 'rotate' : tool.mode === 'rotate' ? 'scale' : 'translate');
    else if (label === 'Prev Manipulator') setMode(tool.mode === 'translate' ? 'scale' : tool.mode === 'scale' ? 'rotate' : 'translate');
    else if (label === 'Toggle Manipulator') { A.hideManip = !A.hideManip; app.events.emit('selection'); }
    else if (label === 'Proportional Settings...' || label === 'Last Proportional Operator...') {
      const o = app.selectedObjects[0];
      const op = o?.primitive?.operators.slice().reverse().find(x => x.type === 'movecomponent' || /prop/i.test(x.name));
      if (op) app.events.emit('inspect', op); else app.run('SetProportionalRadius', { Radius: app.proportional.radius });
    }
    else if (label === 'Create Grid And Connect') app.logMsg('info', 'Knife: click two points to cut; tag polygons first to limit the cut');
    else if (label === 'Inspect Operator...') { const o = app.selectedObjects[0]; const op = o?.primitive?.operators.slice(-1)[0]; if (op) app.events.emit('inspect', op); }
    else app.logMsg('info', `${m}: ${label} not implemented`);
  };
  const optionChecked = (it: { label?: string }) => {
    const l = it.label ?? '';
    if (['Global', 'Local', 'View', 'Parent', 'Ref', 'Plane'].includes(l)) return ((tool as any).ref ?? 'Global') === (l === 'Parent' ? 'Par' : l);
    if (l === 'COG') return !!A.cog;
    if (l === 'Prop') return !!app.proportional.on;
    if (l === 'Sym') return !!A.symmetry;
    if (l === 'Uniform') return !!(tool as any).uniform;
    if (l === 'Volume') return !!(tool as any).volume;
    if (l === 'Add') return !!(tool as any).addRotate;
    if (l === 'Lock Pivot' || l === 'Lock') return !!A.pivotLocked;
    if (l === 'Edit Pivot') return !!A.editPivot;
    return undefined;
  };
  for (const md of tmodes) {
    const mb = button(md.l, () => setMode(tool.mode === md.m ? 'select' : md.m), `${md.m[0].toUpperCase() + md.m.slice(1)} tool (${md.k})`, 'mode'); (mb as any)._m = md.m; modeB.push(mb);
    axisB[md.m] = (['x', 'y', 'z'] as const).map(ax => { const b = button(ax, () => setAxis(ax, !(tool.axes as any)[ax]), `Manipulate the ${ax.toUpperCase()} axis only — click several to combine`, 'axis on'); (b as any)._ax = ax; return b; });
    const opt = button('≡', (e) => { e.stopPropagation(); const r = (e.target as HTMLElement).getBoundingClientRect(); openSiMenu(OPTIONS[md.m], r.left, r.bottom, (it) => pickOption(md.m, it.label!), { checked: optionChecked }); }, 'Options', 'tiny');
    tr.body.appendChild(grid(5, mb, ...axisB[md.m], opt));
    fields[md.m] = (['x', 'y', 'z'] as const).map(ax => { const f = field(ax, v => { for (const o of app.selectedObjects) app.setParam(o.kinematics.local.get(md.prefix + ax)!, v, md.m); }); return f; }).map(f => { tr.body.appendChild(f.w); return f.i; });
  }
  const REFS = ['Global', 'Local', 'View', 'Par', 'Ref', 'Plane'];
  const refB = REFS.map(r => button(r, () => { (tool as any).ref = r; refB.forEach(b => b.classList.toggle('on', b.textContent === r)); }, `${r} reference frame for manipulation`));
  refB[0].classList.add('on');
  tr.body.appendChild(grid(3, ...refB.slice(0, 3))); tr.body.appendChild(grid(3, ...refB.slice(3)));
  const cogB = button('COG', () => { A.cog = !A.cog; upd(); }, 'Transform multiple objects about their common centre of gravity');
  const propB = button('Prop', () => { app.proportional.on = !app.proportional.on; upd(); }, 'Proportional modeling (falloff)');
  const symB = button('Sym', () => { A.symmetry = !A.symmetry; upd(); }, 'Symmetry Mode. Right-click to popup menu.');
  symB.oncontextmenu = (e) => { e.preventDefault(); openSiMenu(SI_MENUS.mcpSymmetry ?? [], e.clientX, e.clientY, (it) => { if (['YZ', 'XZ', 'XY'].includes(it.label!)) { A.symPlane = it.label; A.symmetry = true; upd(); } else { const o = app.selectedObjects.find(x => x.primitive?.mesh()); if (o) { const p = o.property('symmetrymap') ?? app.run('CreateSymmetryMap', { InputObj: [o] }); if (p) app.events.emit('inspect', p); } else app.logMsg('info', 'Symmetry Properties: select a polygon mesh'); } }, { checked: it => ['YZ', 'XZ', 'XY'].includes(it.label!) ? (A.symPlane ?? 'YZ') === it.label : undefined }); };
  (window as any).__mcp = (k: string, v: any) => {
    if (k === 'ref') refB.find(b => b.textContent === v)?.click();
    else if (k === 'axis') { (tool.axes as any)[v] = !(tool.axes as any)[v]; app.events.emit('selection'); }
    else if (k === 'prop') propB.click(); else if (k === 'cog') cogB.click(); else if (k === 'sym') symB.click();
    else if (k === 'snap') { const b = snapB.find(x => (x as any)._k === v); if (b) b.click(); else if (v === 'on') snapOn.click(); }
    else if (k === 'pivot') pickOption('translate', 'Edit Pivot');
    else if (k === 'lockpivot') pickOption('translate', 'Lock Pivot');
    else if (k === 'manip') { A.hideManip = !v; app.events.emit('selection'); }
    else if (k === 'selmode') { (window as any).__selShape = v; app.logMsg('info', `${v} select mode`); }
    else if (k === 'vol') pickOption('scale', 'Volume');
    else if (k === 'pick') pickOption(String(v?.m ?? 'translate'), String(v?.label ?? ''));
  };
  tr.body.appendChild(grid(3, cogB, propB, symB));
  add('Transform', tr.el);

  // ------------------------------------------------------------------- Snap
  const sn = section('Snap', collapsed);
  const S = (tool as any).snap;
  const snapOn = button('ON', () => { S.on = !S.on; upd(); }, 'Enable snapping (hold Ctrl while manipulating)');
  const snapKinds: [string, string, string][] = [['point', '•', 'Snap to points'], ['curve', '∿', 'Snap to curves / edges'], ['midpoint', '◌', 'Snap to midpoints'], ['grid', '▦', 'Snap to the grid']];
  const snapB = snapKinds.map(([k, g, t]) => { const b = button(g, () => { S[k] = !S[k]; upd(); }, t, 'icon'); (b as any)._k = k; return b; });
  sn.body.appendChild(grid(5, snapOn, ...snapB));
  add('Snap', sn.el);

  // -------------------------------------------------------------- Constrain
  const cn = section('Constrain', collapsed);
  const parentB = button('Parent', () => { const objs = app.selectedObjects; if (objs.length < 2) { app.logMsg('info', 'Parent: select the children, then Shift-click the parent (or pick it) and click Parent'); return; } const parent = objs[objs.length - 1]; app.run('ParentObj', { Parent: parent.fullName, Children: objs.slice(0, -1) }); }, 'Parent: make the last-selected object the parent of the others');
  const cutB = button('Cut', () => app.run('CutObj'), 'Cut the hierarchical link (reparent to the scene root)');
  cn.body.appendChild(grid(2, parentB, cutB));
  const cnsB = button('CnsComp', () => { A.cnsComp = !A.cnsComp; upd(); }, 'Constraint compensation'), chdB = button('ChldComp', () => { A.childComp = !A.childComp; upd(); }, 'Child transform compensation (children keep their global pose when the parent moves)');
  cn.body.appendChild(grid(2, cnsB, chdB));
  add('Constrain', cn.el);

  // ------------------------------------------------------------------- Edit
  const ed = section('Edit', collapsed);
  const freezeB = button('Freeze', () => app.run('FreezeObj'), 'Freeze: collapse the construction history');
  const groupEditB = button('Group', () => app.run('CreateGroup'), 'Group the selected objects');
  ed.body.appendChild(grid(2, freezeB, groupEditB));
  const immB = button('Immed', () => { A.immediate = !A.immediate; upd(); }, 'Immediate mode: operators are applied and frozen right away');
  const freezeMB = button('Freeze M', () => app.run('FreezeModeling'), 'Freeze Modeling: freeze operators below the Modeling marker');
  ed.body.appendChild(grid(2, freezeMB, immB));
  add('Edit', ed.el);

  // --------------------------------------------------------------- updates
  // Softimage MCP greying: EnableMenuItem/EnableWindow track CommandCore GetEnabled
  // (Ghidra getenabled-callpath). Buttons that map to commands read commandEnabled;
  // Sample is a filter mode (mcpSampleEnabled). Optional hwnd_buttons overlay from Script Editor paste.
  const btnEn = (key: string, fallback: boolean) => {
    const h = hwndButtonEnabled(app, key);
    return h === null ? fallback : h;
  };
  const upd = () => {
    modeBtns.forEach(b => { const on = (b as any)._m === app.selMode; b.classList.toggle('on', on); });
    groupB.classList.toggle('on', !!A.groupMode); centerB.classList.toggle('on', !!A.centerMode);
    const sel = app.selectedObjects;
    const o = sel[0];
    sampleB.disabled = !btnEn('sample', mcpSampleEnabled(app));
    parentB.disabled = !btnEn('parent', commandEnabled(app, 'ParentObj'));
    cutB.disabled = !btnEn('cut', commandEnabled(app, 'CutObj'));
    freezeB.disabled = !btnEn('freeze', commandEnabled(app, 'FreezeObj'));
    groupEditB.disabled = !btnEn('group', commandEnabled(app, 'CreateGroup'));
    freezeMB.disabled = !btnEn('freezeM', commandEnabled(app, 'FreezeModeling'));
    for (const md of tmodes) fields[md.m].forEach((i, k) => { if (document.activeElement === i) return; i.value = o ? String(Math.round(o.kinematics.local.val(md.prefix + 'xyz'[k]) * 1000) / 1000) : ''; });
    cogB.classList.toggle('on', !!A.cog); propB.classList.toggle('on', !!app.proportional.on); symB.classList.toggle('on', !!A.symmetry);
    snapOn.classList.toggle('on', !!S.on); snapB.forEach(b => b.classList.toggle('on', !!S[(b as any)._k]));
    cnsB.classList.toggle('on', !!A.cnsComp); chdB.classList.toggle('on', !!A.childComp); immB.classList.toggle('on', !!A.immediate);
  };
  upd(); app.events.on('selection', upd); app.events.on('params', upd); app.events.on('scene', upd); app.events.on('frame', upd);

  void Model;
}
