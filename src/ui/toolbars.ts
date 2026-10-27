// Palettes (Application/toolbars/Palettes.xsitb: wire colours + object display types), the Scripts toolbar
// (ScriptCommands.xsitb, a user toolbar of script buttons), custom toolbars / shelves (View > New Custom Toolbar /
// New Custom Shelf, stored in localStorage) and the Customize Toolbars dialog (XSI.exe dialog 225: keyword filter,
// command categories, add to toolbar). Script buttons run their lines through runScriptLine.
import { App } from '../core/commands';
import { runScriptLine, SI_MENUS, openSiMenu } from './si';
import { openFloating } from './floating';
import { X3DObject, makeDisplay } from '../core/scene';
import {
  addScriptCommandDialog, changeIconDialog, customizeButtonDialog, customizeScriptButtonDialog,
  customizeSpacerDialog, popupMenuButtonDialog, scriptButtonTypeDialog, ScriptButton,
} from './siDialogWire';
import icons from '../data/si/icons.json';

const BITMAP_NAMES = Object.keys((icons as { icons: Record<string, unknown> }).icons).sort();

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
  // Palettes.xsitb ships with the install: a read-only toolbar, so it gets XSI.exe MENU 345.
  root.classList.add('tb-readonly');
  root.oncontextmenu = (e) => {
    e.preventDefault();
    const items: TbItem[] = [
      ...Object.keys(WIRE_COLORS).map(n => ({ type: 'command' as const, label: n, name: 'SetWireColor' + n.replace(/ /g, '') })),
      { type: 'command', label: 'Default', name: 'SetWireColorDefault' },
      ...Object.keys(DISPLAY_TYPES).map(n => ({ type: 'command' as const, label: n, name: 'SetObjectDisplay' + n.replace(/ /g, '') })),
    ];
    readOnlyToolbarMenu(app, 'Palettes', items, e.clientX, e.clientY);
  };
}

// ---------------------------------------------------------------- custom toolbars / shelves (user data)
export type TbItem = { type: 'command' | 'script' | 'separator'; label: string; name?: string; script?: string; tooltip?: string; lang?: string; bitmap?: string; w?: number; h?: number };
/** `view` carries the XSI.exe 245 toolbar menu flags; `readOnly` drives the XSI.exe 345 menu. */
export type Toolbar = { name: string; kind: 'toolbar' | 'shelf'; tabs: { label: string; items: TbItem[] }[]; readOnly?: boolean; view?: { textOnly?: boolean; thumbOnly?: boolean; thumbSize?: 'Small' | 'Normal'; titlebar?: boolean } };
export function userToolbars(): Toolbar[] { try { return JSON.parse(localStorage.getItem('si.toolbars') ?? '[]'); } catch { return []; } }
export function saveToolbars(t: Toolbar[]) { localStorage.setItem('si.toolbars', JSON.stringify(t)); window.dispatchEvent(new CustomEvent('toolbarschanged')); }
export function toolbarByName(name: string) { let t = userToolbars().find(x => x.name === name); if (!t && name === 'Scripts') { t = { name: 'Scripts', kind: 'toolbar', tabs: [{ label: 'DS Toolbar', items: [] }] }; saveToolbars([...userToolbars(), t]); } return t; }
export function newToolbar(app: App, kind: 'toolbar' | 'shelf') { const n = prompt(`New custom ${kind} name:`, kind === 'shelf' ? 'MyShelf' : 'MyToolbar'); if (!n) return null; const all = userToolbars(); if (all.some(t => t.name === n)) { app.logMsg('error', `A toolbar named "${n}" already exists`); return null; } const t: Toolbar = { name: n, kind, tabs: [{ label: kind === 'shelf' ? 'Tab 1' : 'DS Toolbar', items: [] }] }; saveToolbars([...all, t]); openToolbarWindow(app, n); return t; }
export function openToolbarWindow(app: App, name: string) { openFloating(name, (body) => toolbarView(app, body, name), { w: 220, h: 360, key: 'toolbar:' + name }); }

const asTbItem = (b: ScriptButton): TbItem => ({ type: 'script', label: b.label, script: b.script, tooltip: b.tooltip, lang: b.lang, bitmap: b.bitmap, w: b.w, h: b.h });

/**
 * Softimage's script-button flow, on its own templates: XSI.exe 159 picks the button kind, then
 * XSI.exe 406 (Customize Button, script commands) or XSI.exe 319 (Add Script Command, external file).
 */
function addScriptDialog(app: App, existing?: TbItem): Promise<TbItem | null> {
  return new Promise(resolve => {
    const script = (it?: TbItem) => customizeScriptButtonDialog(app, it ?? {}, b => resolve(asTbItem(b)));
    if (existing) { script(existing); return; }
    scriptButtonTypeDialog(kind => {
      if (kind === 'script') script();
      else addScriptCommandDialog(app, {}, b => resolve(asTbItem(b)));
    });
  });
}

/** XSI.exe MENU 345 — the contextual menu a read-only (factory) toolbar shows. */
export function readOnlyToolbarMenu(app: App, name: string, items: TbItem[], x: number, y: number) {
  openSiMenu(SI_MENUS.toolbarReadOnlyMenu ?? [], x, y, (it) => {
    if (it.label !== 'Make Local Copy') return;
    const copy = `${name} (local)`;
    if (userToolbars().some(t => t.name === copy)) { app.logMsg('error', `A toolbar named "${copy}" already exists`); return; }
    saveToolbars([...userToolbars(), { name: copy, kind: 'toolbar', tabs: [{ label: 'DS Toolbar', items: items.map(i => ({ ...i })) }] }]);
    openToolbarWindow(app, copy);
  }, { checked: it => it.label === 'Read-Only Toolbar' ? true : undefined, enabled: it => it.label !== 'Read-Only Toolbar' });
}

/** XSI.exe MENU 245 — a writable toolbar's own contextual menu: Save / Save As / Rename / display flags. */
export function toolbarChromeMenu(app: App, tb: Toolbar, x: number, y: number, save: () => void) {
  const v = (tb.view ??= {});
  openSiMenu(SI_MENUS.toolbarMenu ?? [], x, y, (it, path) => {
    if (path[path.length - 2] === 'Thumbnail Size') { v.thumbSize = it.label as 'Small' | 'Normal'; save(); return; }
    switch (it.label) {
      case 'Save': save(); app.logMsg('info', `Toolbar "${tb.name}" saved`); return;
      case 'Save As': {
        const n = prompt('Save toolbar as:', tb.name + '_copy');
        if (!n) return;
        saveToolbars([...userToolbars().filter(t => t.name !== n), { ...tb, name: n, readOnly: false }]);
        openToolbarWindow(app, n);
        return;
      }
      case 'Rename': {
        const n = prompt('Rename toolbar:', tb.name);
        if (!n || n === tb.name) return;
        const all = userToolbars().filter(t => t.name !== tb.name);
        saveToolbars([...all, { ...tb, name: n }]);
        return;
      }
      case 'Thumbnail Only': v.thumbOnly = !v.thumbOnly; if (v.thumbOnly) v.textOnly = false; save(); return;
      case 'Text Only': v.textOnly = !v.textOnly; if (v.textOnly) v.thumbOnly = false; save(); return;
      case 'Display Titlebar': v.titlebar = !v.titlebar; save(); return;
      case 'Customize Toolbar...': customizeToolbars(app, tb.name); return;
    }
  }, {
    checked: it => it.label === 'Thumbnail Only' ? !!v.thumbOnly
      : it.label === 'Text Only' ? !!v.textOnly
        : it.label === 'Display Titlebar' ? !!v.titlebar
          : it.label === 'Small' || it.label === 'Normal' ? (v.thumbSize ?? 'Normal') === it.label
            : undefined,
  });
}

export function toolbarView(app: App, host: HTMLElement, name: string) {
  const root = document.createElement('div'); root.className = 'user-toolbar'; host.appendChild(root);
  let active = 0;
  const render = () => {
    root.innerHTML = ''; const tb = toolbarByName(name); if (!tb) { root.textContent = `Toolbar "${name}" not found`; return; }
    // XSI.exe 245 display flags
    root.className = 'user-toolbar'
      + (tb.view?.textOnly ? ' tb-text-only' : '') + (tb.view?.thumbOnly ? ' tb-thumb-only' : '')
      + (tb.view?.thumbSize === 'Small' ? ' tb-thumb-small' : '') + (tb.readOnly ? ' tb-readonly' : '');
    if (tb.view?.titlebar) { const t = document.createElement('div'); t.className = 'tb-titlebar'; t.textContent = tb.name; root.appendChild(t); }
    const tabs = document.createElement('div'); tabs.className = 'switcher-bar top';
    if (tb.kind === 'shelf') { tb.tabs.forEach((t, i) => { const b = document.createElement('button'); b.className = 'switcher-btn' + (i === active ? ' active' : ''); b.textContent = t.label; b.onclick = () => { active = i; render(); }; b.oncontextmenu = (e) => { e.preventDefault(); const n = prompt('Rename tab:', t.label); if (n) { t.label = n; save(tb); } }; tabs.appendChild(b); }); const add = document.createElement('button'); add.className = 'switcher-btn'; add.textContent = '+'; add.title = 'New tab'; add.onclick = () => { tb.tabs.push({ label: 'Tab ' + (tb.tabs.length + 1), items: [] }); active = tb.tabs.length - 1; save(tb); }; tabs.appendChild(add); root.appendChild(tabs); }
    const tab = tb.tabs[Math.min(active, tb.tabs.length - 1)];
    const list = document.createElement('div'); list.className = 'tb-items'; root.appendChild(list);
    // XSI.exe MENU 244 — the contextual menu of one toolbar button (attested names only).
    const buttonMenu = (it: TbItem, i: number, x: number, y: number) => {
      openSiMenu(SI_MENUS.toolButtonMenu ?? [], x, y, async (m) => {
        switch (m.label) {
          case 'Remove Button': tab.items.splice(i, 1); save(tb); return;
          case 'Remove Command': if (it.type === 'command') { tab.items.splice(i, 1); save(tb); } return;
          case 'Customize Button...':
            if (it.type === 'separator') customizeSpacerDialog({ w: it.w ?? 0, h: it.h ?? 0 }, s => { it.w = s.w; it.h = s.h; save(tb); });
            else customizeButtonDialog(it, v => {
              if (v.label) it.label = v.label;
              it.w = v.w; it.h = v.h;
              // XSI.exe 316 Change Icon: a bitmap name Softimage's own icon sheet does not carry gets picked
              // from the sheet rather than stored as a dangling name.
              if (v.bitmap && !BITMAP_NAMES.includes(v.bitmap.toLowerCase())) changeIconDialog(BITMAP_NAMES, v.bitmap, n => { it.bitmap = n; save(tb); });
              else it.bitmap = v.bitmap;
              save(tb);
            });
            return;
          case 'Edit Script...': {
            if (it.type !== 'script') return;
            const r = await addScriptDialog(app, it);
            if (r) { tab.items[i] = r; save(tb); }
            return;
          }
          case 'Edit Command...':
            if (it.type === 'command') addScriptCommandDialog(app, { label: it.label, tooltip: it.tooltip }, b => { it.label = b.label; it.tooltip = b.tooltip; save(tb); });
            return;
        }
      }, {
        enabled: (m) => m.label === 'Remove Command' || m.label === 'Edit Command...' ? it.type === 'command'
          : m.label === 'Edit Script...' ? it.type === 'script' : true,
      });
    };
    tab.items.forEach((it, i) => {
      if (it.type === 'separator') {
        const h = document.createElement('div'); h.className = 'tb-group'; h.textContent = it.label;
        // XSI.exe 327 Customize Popup Menu Button — the order of the items this group pops up.
        h.oncontextmenu = (e) => {
          e.preventDefault();
          const from = i + 1;
          const until = tab.items.findIndex((x, j) => j > i && x.type === 'separator');
          const to = until < 0 ? tab.items.length : until;
          const names = tab.items.slice(from, to).map(x => x.label);
          popupMenuButtonDialog(names, order => {
            const kept = order.map(l => tab.items.slice(from, to).find(x => x.label === l)!).filter(Boolean);
            tab.items.splice(from, to - from, ...kept);
            save(tb);
          });
        };
        list.appendChild(h); return;
      }
      const b = document.createElement('button'); b.className = 'xp-btn wide'; b.textContent = it.label; b.title = it.tooltip || (it.type === 'command' ? it.name ?? '' : (it.script ?? '').split('\n')[0]);
      if (it.w) b.style.width = it.w + 'px';
      if (it.h) b.style.height = it.h + 'px';
      b.onclick = () => { try { if (it.type === 'command') app.run(it.name!); else for (const line of (it.script ?? '').split(/\r?\n/)) { const l = line.trim(); if (!l || /^(\/\/|')/.test(l)) continue; runScriptLine(app, l); } } catch (e: any) { app.logMsg('error', String(e?.message ?? e)); } };
      b.oncontextmenu = (e) => { e.preventDefault(); buttonMenu(it, i, e.clientX, e.clientY); };
      list.appendChild(b);
    });
    // XSI.exe MENU 245 — the toolbar's own contextual menu (read-only toolbars get MENU 345 instead).
    list.oncontextmenu = (e) => {
      if ((e.target as HTMLElement) !== list) return;
      e.preventDefault();
      if (tb.readOnly) { readOnlyToolbarMenu(app, tb.name, tab.items, e.clientX, e.clientY); return; }
      toolbarChromeMenu(app, tb, e.clientX, e.clientY, () => save(tb));
    };
    const foot = document.createElement('div'); foot.className = 'tb-foot';
    const addS = document.createElement('button'); addS.className = 'xp-btn'; addS.textContent = '+ Script'; addS.title = 'Add Script Command'; addS.onclick = async () => { const it = await addScriptDialog(app); if (it) { tab.items.push(it); save(tb); } };
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
