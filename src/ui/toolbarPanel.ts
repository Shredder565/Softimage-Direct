// Toolbar Panel: the module dropdown (Model / Animate / ...) and the menu tree extracted from Softimage's
// toolbarobj.dll. Leaf items dispatch to commands through the menu-id -> command map.
import { App } from '../core/commands';
import menus from '../data/menus.json';
import menuCommands from '../data/menu_commands.json';

type MenuItem = { label?: string; id?: number; items?: MenuItem[]; separator?: boolean };
const MENUS = menus as Record<string, MenuItem[]>;
const CMDS = menuCommands as unknown as Record<string, { cmd: string; name: string; args: [string, any][] }>;

export function toolbarPanel(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'toolbar-panel ' + app.module;
  const sel = document.createElement('select'); sel.className = 'module-select ' + app.module;
  for (const m of ['Model', 'Animate', 'Render', 'Simulate', 'ICE', 'Hair']) { const o = document.createElement('option'); o.value = m; o.textContent = m + (MENUS[m] ? '' : ' (not extracted)'); sel.appendChild(o); }
  sel.value = app.module;
  sel.onchange = () => { app.module = sel.value as any; app.events.emit('module'); };
  const scroll = document.createElement('div'); scroll.className = 'tb-scroll';
  root.appendChild(sel); root.appendChild(scroll); host.appendChild(root);

  const render = () => {
    root.className = 'toolbar-panel ' + app.module; sel.className = 'module-select ' + app.module; sel.value = app.module;
    scroll.innerHTML = '';
    const tree = MENUS[app.module];
    if (!tree) { scroll.innerHTML = '<div class="view-placeholder">Menu tree for this module not extracted yet.</div>'; return; }
    for (const top of tree) {
      const g = document.createElement('div'); g.className = 'tb-group'; g.textContent = top.label ?? ''; scroll.appendChild(g);
      for (const sub of top.items ?? []) {
        if (sub.separator) continue;
        const b = document.createElement('button'); b.className = 'tb-btn'; b.textContent = sub.label ?? '';
        b.onclick = (e) => { const r = b.getBoundingClientRect(); openMenu(app, sub.items ?? [{ label: sub.label, id: sub.id }], r.right + 2, r.top, [top.label!, sub.label!]); e.stopPropagation(); };
        scroll.appendChild(b);
      }
    }
  };
  render();
  app.events.on('module', render);
}

let openMenus: HTMLElement[] = [];
function closeMenus(from = 0) { openMenus.splice(from).forEach(m => m.remove()); }
document.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('.menu')) closeMenus(); });

export function openMenu(app: App, items: MenuItem[], x: number, y: number, path: string[], level = 0) {
  closeMenus(level);
  const m = document.createElement('div'); m.className = 'menu';
  for (const it of items) {
    if (it.separator) { const s = document.createElement('div'); s.className = 'menu-sep'; m.appendChild(s); continue; }
    const row = document.createElement('div'); row.className = 'menu-item'; row.textContent = it.label ?? '';
    const bound = it.id !== undefined ? CMDS[String(it.id)] : undefined;
    const def = bound ? app.commands.get(bound.cmd) : undefined;
    const implemented = !!def && (!def.canRun || def.canRun(buildArgs(it, bound!, [...path, it.label ?? ''])));
    if (it.items) {
      row.classList.add('has-sub');
      row.onpointerenter = () => { const r = row.getBoundingClientRect(); openMenu(app, it.items!, r.right - 2, r.top - 2, [...path, it.label!], level + 1); };
    } else {
      if (!implemented) row.classList.add('disabled');
      row.title = bound ? `${bound.cmd}(${bound.args.map(a => a[0] + (a[1] !== null && a[1] !== '' ? '=' + JSON.stringify(a[1]) : '')).join(', ')})${implemented ? '' : '  — not implemented yet'}` : 'no command mapped (tool/toggle)';
      row.onpointerenter = () => closeMenus(level + 1);
      row.onclick = () => { closeMenus(); runMenuItem(app, it, bound, [...path, it.label!]); };
    }
    m.appendChild(row);
  }
  document.body.appendChild(m);
  const mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.min(x, window.innerWidth - mw - 4) + 'px';
  m.style.top = Math.min(y, window.innerHeight - mh - 4) + 'px';
  openMenus[level] = m;
}

function buildArgs(it: MenuItem, bound: { cmd: string; name: string; args: [string, any][] }, path: string[]) {
  const args: Record<string, any> = {};
  for (const [k, v] of bound.args) if (v !== null && v !== '') args[k] = v;
  // Mesh/surface/curve primitives: the preset is the leaf label, the geometry type comes from the submenu.
  if (bound.cmd === 'CreatePrim' || bound.cmd === 'GetPrim') {
    if (!args.PresetObj) args.PresetObj = it.label;
    if (bound.cmd === 'GetPrim' && path.includes('Polygon Mesh') && it.label === 'Empty') args.PresetObj = 'EmptyPolygonMesh';
    if (bound.cmd === 'GetPrim' && path.includes('Point Cloud') && it.label === 'Empty') args.PresetObj = 'EmptyPointCloud';
    if (bound.cmd === 'CreatePrim' && !args.GeometryType) args.GeometryType = path.includes('Surface') ? 'NurbsSurface' : path.includes('Curve') ? 'NurbsCurve' : path.includes('Point Cloud') ? 'PointCloud' : 'MeshSurface';
  }
  if (['ApplyOp', 'ApplyTopoOp', 'ApplyGenOp', 'ApplyKinematicOp', 'ApplyPropVolumeOp', 'AddProp', 'GetPrimLight', 'GetPrimCamera'].includes(bound.cmd)) { args.Preset = args.PresetObj; args.PresetObj = bound.name.replace(/ Op$/, ''); if (bound.cmd === 'GetPrimLight' || bound.cmd === 'GetPrimCamera' || bound.name === 'Apply Topology Operator' || bound.name === 'Apply Operator') args.PresetObj = it.label; }
  if (!bound.cmd || bound.cmd === 'ApplyShader') { /* handled by aliases */ }
  if (bound.cmd === 'AddProp' && path.includes('Texture Projection')) { args.Type = it.label; }
  if (bound.cmd === 'SIApplyShader' || bound.cmd === 'ApplyShader') args.PresetObj = it.label;
  if (bound.cmd === 'GetPrimLight' && it.label === 'More...') args.PresetObj = 'Point';
  if (bound.cmd === 'AddProp' && !args.PresetObj) args.PresetObj = it.label;
  return args;
}

function runMenuItem(app: App, it: MenuItem, bound: { cmd: string; name: string; args: [string, any][] } | undefined, path: string[]) {
  if (!bound) { app.logMsg('info', `Menu ${path.join(' > ')}: no command mapped`); return; }
  const args = buildArgs(it, bound, path);
  if (!app.commands.has(bound.cmd)) { app.logMsg('error', `${path.join(' > ')} → ${bound.cmd}: not implemented yet`); return; }
  try { app.run(bound.cmd, args); } catch { /* logged */ }
}

/** For testing/status: every leaf of a module's menu with its command and whether it can run. */
export function menuStatus(app: App, module = 'Model') {
  const out: { path: string; label: string; id: number; cmd: string | null; implemented: boolean }[] = [];
  const walk = (items: MenuItem[], path: string[]) => { for (const it of items) { if (it.separator) continue; if (it.items) { walk(it.items, [...path, it.label!]); continue; } const bound = it.id !== undefined ? CMDS[String(it.id)] : undefined; const def = bound ? app.commands.get(bound.cmd) : undefined; const impl = !!def && (!def.canRun || def.canRun(buildArgs(it, bound!, [...path, it.label ?? '']))); out.push({ path: path.join(' > '), label: it.label ?? '', id: it.id ?? -1, cmd: bound?.cmd ?? null, implemented: impl }); } };
  walk(MENUS[module] ?? [], []); return out;
}
export function runMenuPath(app: App, module: string, path: string, label: string) {
  const walk = (items: MenuItem[], p: string[]): MenuItem | null => { for (const it of items) { if (it.separator) continue; if (it.items) { const r = walk(it.items, [...p, it.label!]); if (r) return r; continue; } if (p.join(' > ') === path && it.label === label) { runMenuItem(app, it, it.id !== undefined ? CMDS[String(it.id)] : undefined, [...p, label]); return it; } } return null; };
  return walk(MENUS[module] ?? [], []);
}
