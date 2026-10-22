// Explorer: Softimage-style scene explorer. Header: Scope dropdown + Filters / Show / Sort menus + search.
// Tree with per-type icons, parameter rows (with animation icons and inline editing), rename (F2 / double-click),
// drag-and-drop reparenting, keyboard navigation, track-selection and right-click context menus.
import { App } from '../core/commands';
import { Node, X3DObject, Scene, Layer, Material, MarkerNode, Property, Model, Camera, Light, Null } from '../core/scene';
import { Parameter } from '../core/params';

type Scope = 'Scene' | 'Layers' | 'Passes' | 'Materials' | 'Selection' | 'Application';
const FILTERS = ['All', 'All + Animatable Parameters', 'All except parameters', 'Objects only', 'Models only', 'Primitives and Properties', 'Geometry Operators', 'Materials and Shaders', 'Animated Parameters'] as const;
const SHOW_PARAMS = ['No Parameters', 'Animated Parameters', 'Animatable Parameters', 'Keyable Parameters', 'All Parameters'] as const;
const SORT = ['None (creation)', 'Alphabetical', 'Type + Alphabetical'] as const;
const FLATTEN = ['Flatten None', 'Flatten Parameters', 'Flatten Properties', 'Flatten All'] as const;

export function explorerView(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'explorer';
  const head = document.createElement('div'); head.className = 'explorer-head';
  const state = { scope: 'Scene' as Scope, filter: 'All except parameters' as (typeof FILTERS)[number], show: 'No Parameters' as (typeof SHOW_PARAMS)[number], sort: 'None (creation)' as (typeof SORT)[number], flatten: 'Flatten None' as (typeof FLATTEN)[number], track: true, lock: false, values: true, scriptNames: false };
  const menuBtn = (label: () => string, build: () => { label: string; checked?: boolean; sep?: boolean; fn?: () => void }[]) => {
    const b = document.createElement('button'); b.className = 'xp-btn'; const refreshLabel = () => { b.innerHTML = label() + '<span class="xp-arrow">▾</span>'; }; refreshLabel();
    b.onclick = (e) => { e.stopPropagation(); const r = b.getBoundingClientRect(); popup(build(), r.left, r.bottom); }; (b as any)._refresh = refreshLabel; return b;
  };
  const radio = <T extends string>(items: readonly T[], get: () => T, set: (v: T) => void) => items.map(i => ({ label: i, checked: get() === i, fn: () => { set(i); render(); } }));
  const SCOPES: Scope[] = ['Scene', 'Layers', 'Passes', 'Materials', 'Selection', 'Application'];
  const scopeLabel = () => state.scope === 'Scene' ? app.scene.root.name : state.scope;
  const scope = menuBtn(scopeLabel, () => radio(SCOPES, () => state.scope, v => { state.scope = v; }));
  const viewBtn = menuBtn(() => 'View', () => [...radio(SHOW_PARAMS, () => state.show, v => { state.show = v; }), { label: '', sep: true }, ...radio(SORT, () => state.sort, v => { state.sort = v; }), { label: '', sep: true }, ...radio(FLATTEN, () => state.flatten, v => { state.flatten = v; }), { label: '', sep: true }, { label: 'Parameter Values', checked: state.values, fn: () => { state.values = !state.values; render(); } }, { label: 'Use Script Names', checked: state.scriptNames, fn: () => { state.scriptNames = !state.scriptNames; render(); } }, { label: 'Track Selection', checked: state.track, fn: () => { state.track = !state.track; render(); } }, { label: '', sep: true }, { label: 'Expand All', fn: () => { expandAll(true); render(); } }, { label: 'Collapse All', fn: () => { expandAll(false); render(); } }]);
  const FILTER_SHORT: Record<string, string> = { 'All': 'All', 'All + Animatable Parameters': 'All + Anim. Params', 'All except parameters': 'All Except Params', 'Objects only': 'Objects', 'Models only': 'Models', 'Primitives and Properties': 'Prims & Props', 'Geometry Operators': 'Geom. Operators', 'Materials and Shaders': 'Materials', 'Animated Parameters': 'Animated Params' };
  const filtersBtn = menuBtn(() => FILTER_SHORT[state.filter] ?? state.filter, () => radio(FILTERS, () => state.filter, v => { state.filter = v; }));
  const icons = document.createElement('span'); icons.className = 'xp-icons';
  const lockBtn = document.createElement('span'); lockBtn.className = 'xp-ico'; lockBtn.textContent = '🔒'; lockBtn.title = 'Lock (keep the current scope when the selection changes)'; lockBtn.onclick = () => { state.lock = !state.lock; lockBtn.classList.toggle('on', state.lock); };
  const refreshBtn = document.createElement('span'); refreshBtn.className = 'xp-ico'; refreshBtn.textContent = '↻'; refreshBtn.title = 'Refresh'; refreshBtn.onclick = () => render();
  const helpBtn = document.createElement('span'); helpBtn.className = 'xp-ico'; helpBtn.textContent = '?'; helpBtn.title = 'Explorer: click to select, double-click a name to rename, drag onto an object to parent, right-click for commands';
  icons.append(lockBtn, refreshBtn, helpBtn);
  const search = document.createElement('input'); search.placeholder = 'find'; search.className = 'xp-search';
  head.append(scope, viewBtn, filtersBtn, icons, search);
  const body = document.createElement('div'); body.className = 'explorer-body'; body.tabIndex = 0;
  root.append(head, body); host.appendChild(root);
  const expanded = new Set<number>(); let first = true; let renaming: Node | null = null;
  const rows: { node: Node; el: HTMLElement }[] = [];

  const roots = (): Node[] => { const sc = app.scene; switch (state.scope) { case 'Layers': return sc.layers; case 'Passes': return sc.passes; case 'Materials': return sc.materials; case 'Selection': return app.selection.filter(n => n instanceof X3DObject); case 'Application': return [sc]; default: return [sc.root]; } };
  const expandAll = (on: boolean) => { const walk = (n: Node) => { if (on) expanded.add(n.id); else expanded.delete(n.id); for (const c of n.explorerChildren()) walk(c); }; for (const r of roots()) walk(r); if (!on) for (const r of roots()) expanded.add(r.id); };
  const passes = (n: Node): boolean => {
    switch (state.filter) {
      case 'Objects only': return n.kind === 'object' || n.kind === 'model';
      case 'Models only': return n.kind === 'model';
      case 'Primitives and Properties': return ['object', 'model', 'primitive', 'property', 'kinematics'].includes(n.kind);
      case 'Geometry Operators': return ['object', 'model', 'primitive', 'operator'].includes(n.kind);
      case 'Materials and Shaders': return ['object', 'model', 'material', 'shader'].includes(n.kind);
      case 'Animated Parameters': return true;
      default: return true;
    }
  };
  const paramsOf = (n: Node): Parameter[] => {
    const mode = state.filter === 'Animated Parameters' ? 'Animated Parameters' : state.filter === 'All + Animatable Parameters' ? 'Animatable Parameters' : state.filter === 'All except parameters' ? 'No Parameters' : state.show;
    switch (mode) { case 'No Parameters': return []; case 'Animated Parameters': return n.params.filter(p => app.anim.isAnimated(p)); case 'Animatable Parameters': return n.params.filter(p => p.animatable); case 'Keyable Parameters': return n.params.filter(p => p.keyable); default: return n.params; }
  };
  const sortKids = (kids: Node[]) => { if (state.sort === 'Alphabetical') return [...kids].sort((a, b) => a.name.localeCompare(b.name)); if (state.sort === 'Type + Alphabetical') return [...kids].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)); return kids; };
  const childrenOf = (n: Node): Node[] => {
    let kids = n.explorerChildren();
    if (n === app.scene.root && state.filter !== 'All') kids = kids.filter(k => k instanceof X3DObject); // Softimage lists only objects under Scene_Root
    if (state.flatten !== 'Flatten None' && n instanceof X3DObject) { // flatten: hide property/primitive layers, keep objects
      const keepProps = state.flatten === 'Flatten Parameters'; kids = kids.filter(k => k.kind === 'object' || k.kind === 'model' || (keepProps && k.kind !== 'kinematics')); }
    return sortKids(kids.filter(passes));
  };
  const flatParams = (n: Node): Parameter[] => { // with flatten, parameters of hidden children bubble up
    let ps = paramsOf(n); if (state.flatten === 'Flatten None' || !(n instanceof X3DObject)) return ps;
    const walk = (k: Node) => { if (k.kind === 'object' || k.kind === 'model') return; ps = ps.concat(paramsOf(k)); for (const c of k.explorerChildren()) walk(c); };
    for (const k of n.explorerChildren()) if (!(k.kind === 'object' || k.kind === 'model')) walk(k);
    return ps;
  };

  const render = () => {
    for (const b of [scope, viewBtn, filtersBtn]) (b as any)._refresh?.();
    if (first) { for (const r of roots()) expanded.add(r.id); first = false; }
    if (state.track) for (const n of app.selection) { let p = n.parent; while (p) { expanded.add(p.id); p = p.parent; } }
    body.innerHTML = ''; rows.length = 0;
    for (const r of roots()) body.appendChild(nodeEl(r, 0));
    const sel = body.querySelector('.tree-row.selected'); if (sel && state.track) (sel as HTMLElement).scrollIntoView({ block: 'nearest' });
  };
  const fmt = (v: any) => typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : Array.isArray(v) ? v.map(x => Math.round(x * 100) / 100).join(', ') : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v);

  const nodeEl = (n: Node, depth: number): HTMLElement => {
    const wrap = document.createElement('div'); wrap.className = 'tree-node';
    const kids = childrenOf(n); const params = flatParams(n); const q = search.value.trim().toLowerCase();
    const hasKids = kids.length > 0 || params.length > 0; const matches = !q || n.name.toLowerCase().includes(q);
    const row = document.createElement('div'); row.className = 'tree-row' + (app.selection.includes(n) ? ' selected' : '') + ' kind-' + n.kind + (n instanceof MarkerNode ? ' marker-' + n.mode : '') + (n instanceof Property && n.shared ? ' shared' : ''); row.style.paddingLeft = (depth * 16 + 2) + 'px'; row.draggable = n instanceof X3DObject && n !== app.scene.root;
    const tg = document.createElement('span'); tg.className = 'tree-toggle' + (hasKids ? ' has' : ''); tg.textContent = hasKids ? (expanded.has(n.id) || q ? '−' : '+') : '';
    tg.onclick = (e) => { e.stopPropagation(); if (expanded.has(n.id)) expanded.delete(n.id); else expanded.add(n.id); render(); };
    const ic = document.createElement('span'); ic.className = 'tree-icon ic-' + n.kind + (n instanceof X3DObject ? ' t-' + n.type : '') + (n instanceof MarkerNode ? ' ic-marker' : ''); ic.innerHTML = iconGlyph(n); ic.title = n.type;
    const nm = document.createElement('span'); nm.className = 'tree-name' + nameColor(n); nm.textContent = state.scriptNames ? n.name.replace(/ /g, '_') : n.name;
    if (n instanceof X3DObject && !n.visible) nm.classList.add('hidden-obj');
    row.append(tg, ic, nm);
    if (n.params.some(p => app.anim.isAnimated(p))) { const a = document.createElement('span'); a.className = 'tree-anim'; a.textContent = '◆'; a.title = 'animated'; row.appendChild(a); }
    if (n instanceof Layer) { const c = n.val('color') as number[]; const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = `rgb(${c.map(x => x * 255).join(',')})`; row.appendChild(sw); }
    row.onclick = (e) => { if (renaming) return; app.select([n], e.ctrlKey ? 'toggle' : e.shiftKey ? 'add' : 'replace'); body.focus(); };
    row.ondblclick = (e) => { if ((e.target as HTMLElement) === nm) startRename(n, nm); else { if (expanded.has(n.id)) expanded.delete(n.id); else expanded.add(n.id); render(); } };
    row.oncontextmenu = (e) => { e.preventDefault(); if (!app.selection.includes(n)) app.select([n]); contextMenu(app, n, e.clientX, e.clientY, () => startRename(n, nm)); };
    row.ondragstart = (e) => { e.dataTransfer?.setData('text/plain', String(n.id)); e.dataTransfer!.effectAllowed = 'move'; };
    if (n instanceof X3DObject) { row.ondragover = (e) => { e.preventDefault(); row.classList.add('drop'); }; row.ondragleave = () => row.classList.remove('drop'); row.ondrop = (e) => { e.preventDefault(); row.classList.remove('drop'); const id = Number(e.dataTransfer?.getData('text/plain')); const src = [...app.scene.allObjects()].find(o => o.id === id); if (src && src !== n && ![...src.descendants()].includes(n)) app.run('ParentObj', { Parent: n.fullName, Children: [src] }); }; }
    if (matches || q) { wrap.appendChild(row); rows.push({ node: n, el: row }); }
    if (expanded.has(n.id) || q) {
      const ch = document.createElement('div'); ch.className = 'tree-children';
      for (const p of params) ch.appendChild(paramRow(p, depth + 1));
      for (const k of kids) ch.appendChild(nodeEl(k, depth + 1));
      wrap.appendChild(ch);
    }
    return wrap;
  };
  const paramRow = (p: Parameter, depth: number) => {
    const pr = document.createElement('div'); pr.className = 'tree-row param' + (''); pr.style.paddingLeft = (depth * 14 + 2) + 'px';
    const dot = document.createElement('span'); const fc = app.anim.fcurve(p); dot.className = 'anim-dot small' + (fc?.keys.length ? (fc.hasKey(app.anim.frame) ? ' keyed' : ' animated') : ''); if (!p.animatable) dot.style.visibility = 'hidden';
    dot.onclick = (e) => { e.stopPropagation(); app.run(fc?.hasKey(app.anim.frame) ? 'RemoveKey' : 'SaveKey', { InputObjs: p.fullName }); };
    const pn = document.createElement('span'); pn.className = 'tree-pname'; pn.textContent = state.scriptNames ? p.name : p.label;
    pr.append(document.createElement('span'), dot, pn);
    if (state.values) { const pv = document.createElement('span'); pv.className = 'tree-pvalue'; pv.textContent = fmt(p.value); pv.title = 'click to edit'; pv.onclick = (e) => { e.stopPropagation(); editValue(p, pv); }; pr.appendChild(pv); }
    pr.onclick = () => { { const o = p.owner as unknown as Node; if ((o as any).kind) app.select([o]); }; };
    return pr;
  };
  const editValue = (p: Parameter, el: HTMLElement) => {
    if (p.def.readOnly) return;
    const i = document.createElement('input'); i.className = 'xp-edit'; i.value = p.def.type === 'bool' ? String(!!p.value) : String(p.value); el.replaceWith(i); i.focus(); i.select();
    const commit = () => { let v: any = i.value; if (p.def.type === 'double' || p.def.type === 'int') v = Number(v); else if (p.def.type === 'bool') v = /^(true|on|1)$/i.test(v); app.setParam(p, v); render(); };
    i.onkeydown = (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') render(); e.stopPropagation(); }; i.onblur = commit;
  };
  const startRename = (n: Node, nm: HTMLElement) => {
    if (!(n instanceof X3DObject) && n.kind !== 'layer' && n.kind !== 'material') return; renaming = n;
    const i = document.createElement('input'); i.className = 'xp-edit'; i.value = n.name; nm.replaceWith(i); i.focus(); i.select();
    const done = (apply: boolean) => { renaming = null; if (apply && i.value.trim() && i.value !== n.name) { if (n instanceof X3DObject) app.run('Rename', { InputObj: [n], Name: i.value.trim() }); else { const old = n.name; const nn = i.value.trim(); app.record('Rename', () => { n.name = nn; }, () => { n.name = old; }); } } render(); };
    i.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); }; i.onblur = () => done(true);
  };
  body.onkeydown = (e) => {
    if (renaming) return; const cur = app.selection[app.selection.length - 1]; const idx = rows.findIndex(r => r.node === cur);
    if (e.key === 'ArrowDown') { const r = rows[Math.min(rows.length - 1, idx + 1)]; if (r) app.select([r.node]); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { const r = rows[Math.max(0, idx - 1)]; if (r) app.select([r.node]); e.preventDefault(); }
    else if (e.key === 'ArrowRight' && cur) { expanded.add(cur.id); render(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' && cur) { expanded.delete(cur.id); render(); e.preventDefault(); }
    else if (e.key === 'F2' && cur) { const r = rows[idx]; const nm = r?.el.querySelector<HTMLElement>('.tree-name'); if (nm) startRename(cur, nm); e.preventDefault(); }
    else if (e.key === 'Delete') { app.run('DeleteObj'); }
    else if (e.key === 'Enter' && cur) { app.run('InspectObj'); }
  };
  search.oninput = render;
  render();
  app.events.on('scene', render); app.events.on('selection', () => { if (!state.lock) render(); }); app.events.on('params', render);
}

function iconLetter(n: Node) {
  if (n instanceof Scene) return 'S';
  if (n instanceof Material) return 'M';
  switch (n.kind) {
    case 'model': return '▣'; case 'kinematics': return 'K'; case 'property': return 'P'; case 'primitive': return n.type === 'crvlist' ? 'C' : n.type === 'surfmsh' ? 'S' : n.type === 'lattice' ? 'L' : 'G';
    case 'operator': return 'op'; case 'shader': return 'Sh'; case 'layer': return 'Ly'; case 'pass': return 'Ps';
    case 'object': { const t = n.type; return t === 'null' ? '+' : t === 'camera' ? '▶' : t === 'light' ? '✶' : t === 'bone' ? 'B' : t === 'root' ? 'R' : t === 'eff' ? 'E' : t === 'crvlist' ? '∿' : t === 'surfmsh' ? 'N' : t === 'lattice' ? '#' : t === 'implicit' ? 'I' : t === 'pointcloud' ? '∴' : '◆'; }
    default: return '·';
  }
}

let openPopup: HTMLElement | null = null;
/** Explorer glyphs (Unicode stand-ins for Softimage's icon set). */
function iconGlyph(n: Node): string {
  if (n instanceof MarkerNode) return '⚑';
  if (n.kind === 'folder') return '▭';
  if (n instanceof Scene || n instanceof Model) return '웃';
  if (n instanceof Camera) return '🎥';
  if (n instanceof Light) return '💡';
  if (n instanceof Null) return '▲';
  if (n instanceof X3DObject) { if (n.type === 'crvlist') return '∿'; if (n.type === 'surfmsh') return '▦'; if (n.type === 'bone' || n.type === 'root' || n.type === 'eff') return '⟋'; if (n.type === 'lattice') return '⌗'; return '⬚'; }
  if (n.kind === 'primitive') return '⬢'; if (n.kind === 'operator') return '⚙'; if (n.kind === 'kinematics') return 'K'; if (n.kind === 'material') return '●'; if (n.kind === 'shader') return '◐'; if (n.kind === 'property') return '▮'; if (n.kind === 'layer') return '▤'; if (n.kind === 'pass') return '▧';
  return '·';
}
/** Name colours as in Softimage's Explorer: models green, cameras blue, lights orange, markers by construction mode. */
function nameColor(n: Node): string {
  if (n instanceof Scene || n instanceof Model) return ' c-model';
  if (n instanceof Camera) return ' c-camera'; if (n instanceof Light) return ' c-light'; if (n instanceof Null) return ' c-null';
  return '';
}
function popup(items: { label: string; checked?: boolean; sep?: boolean; fn?: () => void }[], x: number, y: number) {
  openPopup?.remove(); const m = document.createElement('div'); m.className = 'menu'; m.style.left = x + 'px'; m.style.top = y + 'px';
  for (const it of items) { if (it.sep) { const s = document.createElement('div'); s.className = 'menu-sep'; m.appendChild(s); continue; } const r = document.createElement('div'); r.className = 'menu-item' + (it.fn ? '' : ' disabled'); r.textContent = (it.checked === undefined ? '' : it.checked ? '✓ ' : '   ') + it.label; if (it.fn) r.onclick = () => { m.remove(); openPopup = null; it.fn!(); }; m.appendChild(r); }
  document.body.appendChild(m); openPopup = m;
  const kill = () => { m.remove(); openPopup = null; document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc, true); };
  const close = (e: PointerEvent) => { if (!m.contains(e.target as any)) kill(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); kill(); } };
  setTimeout(() => { document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc, true); });
}

function contextMenu(app: App, n: Node, x: number, y: number, rename: () => void) {
  const items: { label: string; sep?: boolean; fn?: () => void }[] = [];
  items.push({ label: 'Inspect', fn: () => app.run('InspectObj', { InputObjs: [n] }) });
  if (n instanceof X3DObject) {
    items.push({ label: 'Rename', fn: rename }, { label: 'Duplicate', fn: () => app.run('Duplicate', { InputObjs: [n] }) }, { label: n.visible ? 'Hide' : 'Unhide', fn: () => app.run('ToggleVisibility', { InputObjs: [n] }) }, { label: 'Select Children', fn: () => app.run('SelectChildNodes', { InputObjs: [n] }) }, { label: 'Cut Hierarchical Link', fn: n.parentObj && n.parentObj !== app.scene.root ? () => app.run('CutObj', { Children: [n] }) : undefined }, { label: 'Freeze Construction History', fn: n.primitive ? () => app.run('FreezeObj', { InputObjs: [n] }) : undefined }, { label: '', sep: true }, { label: 'Delete', fn: n !== app.scene.root ? () => app.run('DeleteObj', { InputObj: [n] }) : undefined });
  }
  if (n.kind === 'operator' && n.type !== 'geom') items.push({ label: 'Delete Operator', fn: () => { app.select([n]); app.run('DeleteOp', { Operator: n }); } });
  if (n.kind === 'material') items.push({ label: 'Assign to Selection', fn: () => app.run('AssignMaterial', { InputObjs: app.selectedObjects, Material: n.name }) }, { label: 'Rename', fn: rename });
  if (n.kind === 'layer') items.push({ label: 'Rename', fn: rename });
  popup(items, x, y);
}
