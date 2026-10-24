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
  // Softimage module heads. PE trees from toolbarobj.dll live in `src/data/menus.json`
  // (Model 204, Animate 237, Render 234, Simulate 205 Rigid/Soft/Cloth, ICE 303 Particles/CrowdFX, Hair 297).
  for (const m of ['Model', 'Animate', 'Render', 'Simulate', 'ICE', 'Hair']) {
    const o = document.createElement('option'); o.value = m;
    o.textContent = MENUS[m] ? m : `${m} (menu not in install data yet)`;
    sel.appendChild(o);
  }
  sel.value = app.module;
  sel.onchange = () => { app.module = sel.value as any; app.events.emit('module'); };
  const scroll = document.createElement('div'); scroll.className = 'tb-scroll';
  root.appendChild(sel); root.appendChild(scroll); host.appendChild(root);

  const render = () => {
    root.className = 'toolbar-panel ' + app.module; sel.className = 'module-select ' + app.module; sel.value = app.module;
    scroll.innerHTML = '';
    const tree = MENUS[app.module];
    if (!tree) {
      scroll.innerHTML = `<div class="view-placeholder">Softimage <b>${app.module}</b> toolbar menu is not in the in-tree PE extract yet. UI shell still switches modules; menu leaves land when install data is scraped or a local Softimage dump is uploaded.</div>`;
      return;
    }
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.querySelector('.menu')) { closeMenus(); } }, true);

export function openMenu(app: App, items: MenuItem[], x: number, y: number, path: string[], level = 0) {
  closeMenus(level);
  const m = document.createElement('div'); m.className = 'menu';
  for (const it of items) {
    if (it.separator) { const s = document.createElement('div'); s.className = 'menu-sep'; m.appendChild(s); continue; }
    const row = document.createElement('div'); row.className = 'menu-item'; row.textContent = it.label ?? '';
    const bound = it.id !== undefined ? CMDS[String(it.id)] : undefined;
    const def = bound ? app.commands.get(bound.cmd) : undefined;
    const implemented = !!def && (!def.canRun || def.canRun(buildArgs(it, bound!, [...path, it.label ?? ''], app.module)));
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

function buildArgs(it: MenuItem, bound: { cmd: string; name: string; args: [string, any][] }, path: string[], module?: string) {
  const args: Record<string, any> = {};
  for (const [k, v] of bound.args) if (v !== null && v !== '') args[k] = v;
  // Mesh/surface/curve primitives: the preset is the leaf label, the geometry type comes from the submenu.
  if (bound.cmd === 'CreatePrim' || bound.cmd === 'GetPrim') {
    if (!args.PresetObj) args.PresetObj = it.label;
    if (bound.cmd === 'GetPrim' && path.includes('Polygon Mesh') && it.label === 'Empty') args.PresetObj = 'EmptyPolygonMesh';
    if (bound.cmd === 'GetPrim' && path.includes('Point Cloud') && it.label === 'Empty') args.PresetObj = 'EmptyPointCloud';
    if (bound.cmd === 'CreatePrim' && !args.GeometryType) args.GeometryType = path.includes('Surface') ? 'NurbsSurface' : path.includes('Curve') ? 'NurbsCurve' : path.includes('Point Cloud') ? 'PointCloud' : 'MeshSurface';
  }
  if (['ApplyOp', 'ApplyTopoOp', 'ApplyGenOp', 'ApplyKinematicOp', 'ApplyPropVolumeOp', 'AddProp', 'GetPrimLight', 'GetPrimCamera', 'ApplyCns'].includes(bound.cmd)) { args.Preset = args.Preset ?? args.PresetObj; args.PresetObj = bound.name.replace(/ Op$/, ''); if (bound.cmd === 'GetPrimLight' || bound.cmd === 'GetPrimCamera' || bound.name === 'Apply Topology Operator' || bound.name === 'Apply Operator') args.PresetObj = it.label; if (bound.cmd === 'ApplyCns') { args.Preset = args.Preset ?? args.PresetObj ?? it.label; args.PresetObj = args.Preset; } }
  if (!bound.cmd || bound.cmd === 'ApplyShader') { /* handled by aliases */ }
  if (bound.cmd === 'AddProp' && path.includes('Texture Projection')) { args.Type = it.label; }
  if (bound.cmd === 'SIApplyShader' || bound.cmd === 'ApplyShader') args.PresetObj = it.label;
  if (bound.cmd === 'GetPrimLight' && it.label === 'More...') args.PresetObj = 'Point';
  if (bound.cmd === 'AddProp' && !args.PresetObj) args.PresetObj = it.label;
  // Softimage toolbar enable can be module-context; commands may read `_module` from args.
  if (module) args._module = module;
  return args;
}

function runMenuItem(app: App, it: MenuItem, bound: { cmd: string; name: string; args: [string, any][] } | undefined, path: string[]) {
  if (!bound) { app.logMsg('info', `Menu ${path.join(' > ')}: no command mapped`); return; }
  const args = buildArgs(it, bound, path, app.module);
  if (!app.commands.has(bound.cmd)) { app.logMsg('error', `${path.join(' > ')} → ${bound.cmd}: not implemented yet`); return; }
  try { app.run(bound.cmd, args); } catch { /* logged */ }
}

/** For testing/status: every leaf of a module's menu with its command and whether it can run. */
export function menuStatus(app: App, module = 'Model') {
  const out: { path: string; label: string; id: number; cmd: string | null; implemented: boolean }[] = [];
  const walk = (items: MenuItem[], path: string[]) => { for (const it of items) { if (it.separator) continue; if (it.items) { walk(it.items, [...path, it.label!]); continue; } const bound = it.id !== undefined ? CMDS[String(it.id)] : undefined; const def = bound ? app.commands.get(bound.cmd) : undefined; const impl = !!def && (!def.canRun || def.canRun(buildArgs(it, bound!, [...path, it.label ?? ''], module))); out.push({ path: path.join(' > '), label: it.label ?? '', id: it.id ?? -1, cmd: bound?.cmd ?? null, implemented: impl }); } };
  walk(MENUS[module] ?? [], []); return out;
}

/**
 * Softimage Model vs Animate Get is a shared PE surface (170 common leaves; Model-only Toric).
 * Direct enable rules are module-aware via `_module` but GetPrim/CreatePrim stay module-independent —
 * so shared Get leaves must enable identically under both modules. Softimage interactive Enabled
 * deltas (if any) remain observation-blocked.
 */
export function getEnableParity(app: App) {
  const model = menuStatus(app, 'Model').filter(x => x.path === 'Get' || x.path.startsWith('Get >'));
  const animate = menuStatus(app, 'Animate').filter(x => x.path === 'Get' || x.path.startsWith('Get >'));
  const byId = new Map(model.map(x => [x.id, x]));
  const shared: { id: number; path: string; label: string; cmd: string | null; model: boolean; animate: boolean }[] = [];
  const mismatches: typeof shared = [];
  for (const a of animate) {
    const m = byId.get(a.id);
    if (!m) continue;
    const row = { id: a.id, path: a.path, label: a.label, cmd: a.cmd, model: m.implemented, animate: a.implemented };
    shared.push(row);
    if (m.implemented !== a.implemented) mismatches.push(row);
  }
  const modelOnly = model.filter(m => !animate.some(a => a.id === m.id)).map(m => ({ id: m.id, path: m.path, label: m.label }));
  return {
    modelGet: model.length,
    animateGet: animate.length,
    shared: shared.length,
    mismatches,
    modelOnly,
    ok: mismatches.length === 0 && shared.length === Math.min(model.length, animate.length),
  };
}
export function runMenuPath(app: App, module: string, path: string, label: string) {
  const walk = (items: MenuItem[], p: string[]): MenuItem | null => { for (const it of items) { if (it.separator) continue; if (it.items) { const r = walk(it.items, [...p, it.label!]); if (r) return r; continue; } if (p.join(' > ') === path && it.label === label) { runMenuItem(app, it, it.id !== undefined ? CMDS[String(it.id)] : undefined, [...p, label]); return it; } } return null; };
  return walk(MENUS[module] ?? [], []);
}
