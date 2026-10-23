// Palettes (Application/toolbars/Palettes.xsitb: wire colours + object display types), the Scripts toolbar
// (ScriptCommands.xsitb, a user toolbar of script buttons), custom toolbars / shelves (View > New Custom Toolbar /
// New Custom Shelf, stored in localStorage) and the Customize Toolbars dialog (XSI.exe dialog 225: keyword filter,
// command categories, add to toolbar). Script buttons run their lines through runScriptLine.
import { App } from '../core/commands';
import { runScriptLine, SI_MENUS, openSiMenu } from './si';
import { openFloating } from './floating';
import { X3DObject, makeDisplay } from '../core/scene';

export const WIRE_COLORS: Record<string, [number, number, number]> = { Red: [1, 0, 0], 'Light Green': [0.5, 1, 0.5], Blue: [0, 0.3, 1], Orange: [1, 0.5, 0], Green: [0, 0.7, 0], Purple: [0.5, 0, 1], Fuschia: [1, 0, 0.7], Gold: [0.85, 0.65, 0.1], Teal: [0, 0.6, 0.6], Pink: [1, 0.6, 0.8], Yellow: [1, 1, 0], Brown: [0.5, 0.3, 0.1] };
const DISPLAY_TYPES: Record<string, number> = { 'Bounding Box': 0, Wireframe: 1, 'Hidden Line': 3, Constant: 5, Shaded: 7, Textured: 9, Default: 8 };

export function registerToolbarCommands(app: App) {
  for (const [name, rgb] of Object.entries(WIRE_COLORS)) app.register({ name: 'SetWireColor' + name.replace(/ /g, ''), label: 'Set Wire Color to ' + name, category: 'Palettes', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const d = disp(o); app.setParam(d.get('wirecol')!, true); app.setParam(d.get('wirecolorrgb')!, [...rgb]); } app.events.emit('scene'); } });
  app.register({ name: 'SetWireColorDefault', label: 'Set Wire Color to Default', category: 'Palettes', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const d = o.property('display'); if (d) app.setParam(d.get('wirecol')!, false); } app.events.emit('scene'); } });
  for (const [name, v] of Object.entries(DISPLAY_TYPES)) app.register({ name: 'SetObjectDisplay' + name.replace(/ /g, ''), label: 'Set Object Display to ' + name, category: 'Palettes', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const d = disp(o); for (const k of ['staticsel', 'intsel', 'statunselnear', 'intunselnear']) { const p = d.get(k); if (p) { if (!p.def.items?.some(i => i.value === v)) p.def.items = [...(p.def.items ?? []), { label: name, value: v }]; app.setParam(p, v); } } } app.events.emit('scene'); } });
  app.register({ name: 'SetWireColorRGB', label: 'Set Wire Color', category: 'Palettes', args: [{ name: 'R', default: 1 }, { name: 'G', default: 1 }, { name: 'B', default: 1 }, { name: 'InputObjs', default: '' }], execute(app, a) { for (const o of app.targets(a.InputObjs)) { const d = disp(o); app.setParam(d.get('wirecol')!, true); app.setParam(d.get('wirecolorrgb')!, [Number(a.R), Number(a.G), Number(a.B)]); } app.events.emit('scene'); } });
}
const disp = (o: X3DObject) => { let d = o.property('display'); if (!d || d.shared) { if (d) o.removeProperty(d); d = makeDisplay(false); o.addProperty(d); } return d!; };

// ---------------------------------------------------------------- Palettes view
export function palettesView(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'palettes'; host.appendChild(root);
  const head = (t: string) => { const h = document.createElement('div'); h.className = 'tb-group'; h.textContent = t; root.appendChild(h); };
  head('Wire Colors'); const grid = document.createElement('div'); grid.className = 'pal-grid'; root.appendChild(grid);
  for (const [name, rgb] of Object.entries(WIRE_COLORS)) { const b = document.createElement('button'); b.className = 'pal-swatch'; b.title = 'Set Wire Color to ' + name; b.style.background = `rgb(${rgb.map(x => Math.round(x * 255)).join(',')})`; b.onclick = () => app.run('SetWireColor' + name.replace(/ /g, '')); grid.appendChild(b); }
  const def = document.createElement('button'); def.className = 'xp-btn wide'; def.textContent = 'Default'; def.title = 'Set Wire Color to Default'; def.onclick = () => app.run('SetWireColorDefault'); root.appendChild(def);
  const custom = document.createElement('input'); custom.type = 'color'; custom.title = 'Custom wire colour'; custom.onchange = () => { const v = custom.value; app.run('SetWireColorRGB', { R: parseInt(v.slice(1, 3), 16) / 255, G: parseInt(v.slice(3, 5), 16) / 255, B: parseInt(v.slice(5, 7), 16) / 255 }); }; root.appendChild(custom);
  head('Display Types');
  for (const name of Object.keys(DISPLAY_TYPES)) { const b = document.createElement('button'); b.className = 'xp-btn wide'; b.textContent = name; b.title = 'Set Object Display to ' + name; b.onclick = () => app.run('SetObjectDisplay' + name.replace(/ /g, '')); root.appendChild(b); }
}

// ---------------------------------------------------------------- custom toolbars / shelves (user data)
export type TbItem = { type: 'command' | 'script' | 'separator'; label: string; name?: string; script?: string; tooltip?: string; lang?: string };
export type Toolbar = { name: string; kind: 'toolbar' | 'shelf'; tabs: { label: string; items: TbItem[] }[] };
export function userToolbars(): Toolbar[] { try { return JSON.parse(localStorage.getItem('si.toolbars') ?? '[]'); } catch { return []; } }
export function saveToolbars(t: Toolbar[]) { localStorage.setItem('si.toolbars', JSON.stringify(t)); window.dispatchEvent(new CustomEvent('toolbarschanged')); }
export function toolbarByName(name: string) { let t = userToolbars().find(x => x.name === name); if (!t && name === 'Scripts') { t = { name: 'Scripts', kind: 'toolbar', tabs: [{ label: 'DS Toolbar', items: [] }] }; saveToolbars([...userToolbars(), t]); } return t; }
export function newToolbar(app: App, kind: 'toolbar' | 'shelf') { const n = prompt(`New custom ${kind} name:`, kind === 'shelf' ? 'MyShelf' : 'MyToolbar'); if (!n) return null; const all = userToolbars(); if (all.some(t => t.name === n)) { app.logMsg('error', `A toolbar named "${n}" already exists`); return null; } const t: Toolbar = { name: n, kind, tabs: [{ label: kind === 'shelf' ? 'Tab 1' : 'DS Toolbar', items: [] }] }; saveToolbars([...all, t]); openToolbarWindow(app, n); return t; }
export function openToolbarWindow(app: App, name: string) { openFloating(name, (body) => toolbarView(app, body, name), { w: 220, h: 360, key: 'toolbar:' + name }); }

/** The Add Script Command dialog (XSI.exe 319) as a small form: button name, script text, tooltip. */
function addScriptDialog(app: App, tb: Toolbar, tab: number, existing?: TbItem): Promise<TbItem | null> {
  return new Promise(resolve => {
    openFloating(existing ? 'Edit Script Command' : 'Add Script Command', (body, win) => {
      body.innerHTML = `<div class="dlg"><label>Command / Button Name</label><input class="nm"><label>Scripting Language</label><select class="lang"><option>JScript</option><option>VBScript</option><option>Python</option></select><label>Script Command</label><textarea class="src" rows="8" spellcheck="false"></textarea><label>Tooltip</label><input class="tip"><div class="dlg-btns"><button class="ok">OK</button><button class="cancel">Cancel</button></div></div>`;
      const nm = body.querySelector<HTMLInputElement>('.nm')!, src = body.querySelector<HTMLTextAreaElement>('.src')!, tip = body.querySelector<HTMLInputElement>('.tip')!, lang = body.querySelector<HTMLSelectElement>('.lang')!;
      nm.value = existing?.label ?? 'Script'; src.value = existing?.script ?? 'CreatePrim "Sphere", "MeshSurface"'; tip.value = existing?.tooltip ?? ''; lang.value = existing?.lang ?? 'JScript';
      for (const el of [nm, src, tip]) el.onkeydown = e => e.stopPropagation();
      body.querySelector<HTMLButtonElement>('.ok')!.onclick = () => { const it: TbItem = { type: 'script', label: nm.value.trim() || 'Script', script: src.value, tooltip: tip.value, lang: lang.value }; win.close(); resolve(it); };
      body.querySelector<HTMLButtonElement>('.cancel')!.onclick = () => { win.close(); resolve(null); };
    }, { w: 320, h: 330 });
    void tb; void tab; void app;
  });
}

export function toolbarView(app: App, host: HTMLElement, name: string) {
  const root = document.createElement('div'); root.className = 'user-toolbar'; host.appendChild(root);
  let active = 0;
  const render = () => {
    root.innerHTML = ''; const tb = toolbarByName(name); if (!tb) { root.textContent = `Toolbar "${name}" not found`; return; }
    const tabs = document.createElement('div'); tabs.className = 'switcher-bar top';
    if (tb.kind === 'shelf') { tb.tabs.forEach((t, i) => { const b = document.createElement('button'); b.className = 'switcher-btn' + (i === active ? ' active' : ''); b.textContent = t.label; b.onclick = () => { active = i; render(); }; b.oncontextmenu = (e) => { e.preventDefault(); const n = prompt('Rename tab:', t.label); if (n) { t.label = n; save(tb); } }; tabs.appendChild(b); }); const add = document.createElement('button'); add.className = 'switcher-btn'; add.textContent = '+'; add.title = 'New tab'; add.onclick = () => { tb.tabs.push({ label: 'Tab ' + (tb.tabs.length + 1), items: [] }); active = tb.tabs.length - 1; save(tb); }; tabs.appendChild(add); root.appendChild(tabs); }
    const tab = tb.tabs[Math.min(active, tb.tabs.length - 1)];
    const list = document.createElement('div'); list.className = 'tb-items'; root.appendChild(list);
    tab.items.forEach((it, i) => {
      if (it.type === 'separator') { const h = document.createElement('div'); h.className = 'tb-group'; h.textContent = it.label; list.appendChild(h); return; }
      const b = document.createElement('button'); b.className = 'xp-btn wide'; b.textContent = it.label; b.title = it.tooltip || (it.type === 'command' ? it.name ?? '' : (it.script ?? '').split('\n')[0]);
      b.onclick = () => { try { if (it.type === 'command') app.run(it.name!); else for (const line of (it.script ?? '').split(/\r?\n/)) { const l = line.trim(); if (!l || /^(\/\/|')/.test(l)) continue; runScriptLine(app, l); } } catch (e: any) { app.logMsg('error', String(e?.message ?? e)); } };
      b.oncontextmenu = (e) => { e.preventDefault(); openSiMenu([{ label: 'Edit...' }, { label: 'Move Up' }, { label: 'Move Down' }, { separator: true }, { label: 'Remove' }], e.clientX, e.clientY, async (m) => { if (m.label === 'Remove') { tab.items.splice(i, 1); save(tb); } else if (m.label === 'Move Up' && i > 0) { [tab.items[i - 1], tab.items[i]] = [tab.items[i], tab.items[i - 1]]; save(tb); } else if (m.label === 'Move Down' && i < tab.items.length - 1) { [tab.items[i + 1], tab.items[i]] = [tab.items[i], tab.items[i + 1]]; save(tb); } else if (m.label === 'Edit...') { if (it.type === 'script') { const r = await addScriptDialog(app, tb, active, it); if (r) { tab.items[i] = r; save(tb); } } else { const n = prompt('Button label:', it.label); if (n) { it.label = n; save(tb); } } } }); };
      list.appendChild(b);
    });
    const foot = document.createElement('div'); foot.className = 'tb-foot';
    const addS = document.createElement('button'); addS.className = 'xp-btn'; addS.textContent = '+ Script'; addS.title = 'Add Script Command'; addS.onclick = async () => { const it = await addScriptDialog(app, tb, active); if (it) { tab.items.push(it); save(tb); } };
    const addC = document.createElement('button'); addC.className = 'xp-btn'; addC.textContent = '+ Command'; addC.title = 'Customize Toolbars: add commands'; addC.onclick = () => customizeToolbars(app, name);
    const addSep = document.createElement('button'); addSep.className = 'xp-btn'; addSep.textContent = '+ Group'; addSep.onclick = () => { const n = prompt('Group header:', 'Group'); if (n) { tab.items.push({ type: 'separator', label: n }); save(tb); } };
    foot.append(addS, addC, addSep); root.appendChild(foot);
  };
  const save = (tb: Toolbar) => { const all = userToolbars(); const i = all.findIndex(t => t.name === tb.name); if (i >= 0) all[i] = tb; else all.push(tb); saveToolbars(all); };
  render(); window.addEventListener('toolbarschanged', render);
}

/** Customize Toolbars (XSI.exe dialog 225): keyword filter + command categories; adds the picked command to a toolbar. */
export function customizeToolbars(app: App, target?: string) {
  openFloating('Customize Toolbars', (body) => {
    body.innerHTML = `<div class="dlg customize"><div class="row"><label>Keyword Filter:</label><input class="kw"></div><div class="row"><label>Group:</label><select class="cat"></select></div><div class="hint">Hint: After selecting a category, pick a tool from the list and click Add to put it on the toolbar.</div><select class="cmds" size="14"></select><div class="row"><label>Toolbar:</label><select class="tb"></select><button class="xp-btn add">Add</button><button class="xp-btn newtb">New...</button></div><div class="row"><label>Label:</label><input class="lbl"></div></div>`;
    const kw = body.querySelector<HTMLInputElement>('.kw')!, cat = body.querySelector<HTMLSelectElement>('.cat')!, cmds = body.querySelector<HTMLSelectElement>('.cmds')!, tbSel = body.querySelector<HTMLSelectElement>('.tb')!, lbl = body.querySelector<HTMLInputElement>('.lbl')!;
    kw.onkeydown = lbl.onkeydown = e => e.stopPropagation();
    const defs = [...app.commands.values()]; const cats = ['All', ...new Set(defs.map(d => d.category ?? 'Other'))].sort((a, b) => a === 'All' ? -1 : a.localeCompare(b));
    for (const c of cats) { const o = document.createElement('option'); o.textContent = c; cat.appendChild(o); }
    const fillTb = () => { tbSel.innerHTML = ''; for (const t of [...userToolbars().map(t => t.name), ...(userToolbars().some(t => t.name === 'Scripts') ? [] : ['Scripts'])]) { const o = document.createElement('option'); o.textContent = t; tbSel.appendChild(o); } if (target) tbSel.value = target; };
    const fill = () => { cmds.innerHTML = ''; const q = kw.value.trim().toLowerCase(); for (const d of defs.filter(d => (cat.value === 'All' || (d.category ?? 'Other') === cat.value) && (!q || (d.label ?? d.name).toLowerCase().includes(q) || d.name.toLowerCase().includes(q))).sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name))) { const o = document.createElement('option'); o.value = d.name; o.textContent = `${d.label ?? d.name}  (${d.name})`; cmds.appendChild(o); } };
    kw.oninput = fill; cat.onchange = fill; cmds.onchange = () => { lbl.value = app.commands.get(cmds.value)?.label ?? cmds.value; }; fill(); fillTb();
    body.querySelector<HTMLButtonElement>('.add')!.onclick = () => { const n = cmds.value; if (!n) return; const tb = toolbarByName(tbSel.value); if (!tb) return; tb.tabs[0].items.push({ type: 'command', label: lbl.value.trim() || app.commands.get(n)!.label || n, name: n }); const all = userToolbars(); all[all.findIndex(t => t.name === tb.name)] = tb; saveToolbars(all); app.logMsg('info', `Added ${n} to toolbar "${tb.name}"`); openToolbarWindow(app, tb.name); };
    body.querySelector<HTMLButtonElement>('.newtb')!.onclick = () => { const t = newToolbar(app, 'toolbar'); if (t) { fillTb(); tbSel.value = t.name; } };
  }, { w: 420, h: 420, key: 'customize-toolbars' });
}
export { SI_MENUS };
