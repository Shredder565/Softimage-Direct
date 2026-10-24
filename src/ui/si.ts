// Access to the UI data copied straight out of the Softimage 2015 SP2 install (see tools/build_si_ui.py):
// real toolbar bitmaps, menu resources, localisation strings, key maps, shelf/panel-switcher toolbars.
import icons from '../data/si/icons.json';
import menus from '../data/si/menus.json';
import strings from '../data/si/strings.json';
import keymaps from '../data/si/keymaps.json';
import shelf from '../data/si/shelf.json';
import panelswitcher from '../data/si/panelswitcher.json';
import views from '../data/si/views.json';
import type { App } from '../core/commands';
import { peMenuItemGrayed } from './mcpEnableMatrix';

export type SiMenuItem = { label?: string; id?: number | null; accel?: string; items?: SiMenuItem[]; separator?: boolean; grayed?: boolean };
export const SI_MENUS = menus as unknown as Record<string, SiMenuItem[]>;
export const SI_STRINGS = strings as unknown as Record<string, Record<string, string>>;
export const SI_KEYMAPS = keymaps as unknown as Record<string, Record<string, { name: string; key: string; mods: string[] }[]>>;
export const SI_SHELF = shelf as unknown as { label: string; items: { type: string; label: string | null; bitmap: string | null; tooltip: string | null; script?: string }[] }[];
export const SI_PANELSWITCHER = panelswitcher as unknown as { type: string; label: string | null; bitmap: string | null; tooltip: string | null; script?: string }[];
export const SI_VIEWS = views as unknown as { name: string; clsid: string; defaultsize: string }[];
const ICONS = icons as { cell: number; sheet: string; icons: Record<string, { x: number; y: number; w: number; h: number }> };

/** A span showing one of Softimage's own toolbar bitmaps (from Application/toolbars/bitmaps). */
export function siIcon(name: string, scale = 1): HTMLElement {
  const s = document.createElement('span'); s.className = 'si-icon'; const ic = ICONS.icons[name.toLowerCase()];
  if (!ic) { s.textContent = name.slice(0, 3); s.classList.add('missing'); return s; }
  s.style.width = ic.w * scale + 'px'; s.style.height = ic.h * scale + 'px';
  s.style.backgroundImage = `url(${ICONS.sheet})`; s.style.backgroundPosition = `${-ic.x * scale}px ${-ic.y * scale}px`;
  if (scale !== 1) s.style.backgroundSize = `${ICONS.cell * 12 * scale}px auto`;
  s.title = name; return s;
}
export function hasIcon(name: string) { return !!ICONS.icons[name.toLowerCase()]; }

/** Status-bar hint text: Softimage stores "Tool name\nLMB\nMMB\nRMB" strings in its dictionaries. */
export function siHint(module: string, id: number): { title: string; lmb: string; mmb: string; rmb: string } | null {
  const s = SI_STRINGS[module]?.[String(id)]; if (!s) return null;
  const [title = '', lmb = '', mmb = '', rmb = ''] = s.split('\n'); return { title, lmb, mmb, rmb };
}
/** Find a hint string by its first line (e.g. "Translate") and a word in one of the button lines. */
export function siHintBy(first: string, contains = ''): { title: string; lmb: string; mmb: string; rmb: string } | null {
  for (const [id, s] of Object.entries(SI_STRINGS.XSIVIEWINTERACTION ?? {})) { if (s.startsWith(first + '\n') && s.includes(contains)) return siHint('XSIVIEWINTERACTION', Number(id)); }
  return null;
}

/** Run one line of Softimage VBScript/JScript as found in shelf buttons: `CreatePrim ("Sphere", "MeshSurface")`,
 *  `GetPrim "Null"`, `GetPrimLight "Point.Preset", "Point"`, `SetDisplayMode "shaded"` … Positional arguments map onto
 *  the command's declared argument order. */
export function runScriptLine(app: App, text: string): any {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("'") && !l.startsWith('//'));
  let last: any;
  for (const line of lines) {
    const m = /^(?:set\s+\w+\s*=\s*)?(?:\$?Application(?:\.|->))?([A-Za-z_]\w*)\s*\(?\s*(.*?)\)?\s*;?$/.exec(line); if (!m) { app.logMsg('info', `Script: ${line}`); continue; }
    const name = m[1]; const args = splitArgs(m[2]);
    const def = app.commands.get(name);
    if (!def) { app.logMsg('error', `${name}: command not implemented`); continue; }
    const named: Record<string, any> = {};
    def.args.forEach((a, i) => { if (i < args.length && args[i] !== null) named[a.name] = args[i]; });
    try { last = app.run(name, named); } catch { /* logged */ }
  }
  return last;
}
function splitArgs(s: string): any[] {
  const out: any[] = []; let cur = '', q = false;
  const push = () => { const t = cur.trim(); cur = ''; if (!t) { out.push(null); return; } if (/^".*"$/.test(t)) out.push(t.slice(1, -1)); else if (/^-?\d+(\.\d+)?$/.test(t)) out.push(Number(t)); else if (/^(true|false)$/i.test(t)) out.push(t.toLowerCase() === 'true'); else if (/^(null|nothing|none|undef)$/i.test(t)) out.push(null); else out.push(t); };
  for (const ch of s) { if (ch === '"') q = !q; if (ch === ',' && !q) { push(); continue; } cur += ch; }
  if (cur.trim() || out.length) push();
  return out;
}

/** Softimage PE f_grayed / opts.enabled — grey seed from dump when no caller predicate. */
function menuItemEnabled(it: SiMenuItem, path: string[] | undefined, opts: { enabled?: (it: SiMenuItem, path?: string[]) => boolean }): boolean {
  if (opts.enabled) return !!opts.enabled(it, path);
  if (it.grayed || peMenuItemGrayed(it.label)) return false;
  return true;
}

/** Generic popup for a menu tree copied from a Softimage menu resource. `onPick(label, item)` handles leaves. */
export function openSiMenu(items: SiMenuItem[], x: number, y: number, onPick: (it: SiMenuItem, path: string[]) => void, opts: { checked?: (it: SiMenuItem) => boolean | undefined; enabled?: (it: SiMenuItem, path?: string[]) => boolean } = {}, path: string[] = [], level = 0) {
  closeSiMenus(level);
  const m = document.createElement('div'); m.className = 'menu si-menu';
  for (const it of items) {
    if (it.separator) { const s = document.createElement('div'); s.className = 'menu-sep'; m.appendChild(s); continue; }
    const row = document.createElement('div'); row.className = 'menu-item';
    const chk = opts.checked?.(it); const lab = document.createElement('span'); lab.textContent = (chk === undefined ? '' : chk ? '✓ ' : '   ') + (it.label ?? ''); row.appendChild(lab);
    if (it.accel) { const a = document.createElement('span'); a.className = 'menu-accel'; a.textContent = it.accel; row.appendChild(a); }
    const nextPath = [...path, it.label ?? ''];
    if (it.items) { row.classList.add('has-sub'); row.onpointerenter = () => { const r = row.getBoundingClientRect(); openSiMenu(it.items!, r.right - 2, r.top - 2, onPick, opts, nextPath, level + 1); }; }
    else {
      const en = menuItemEnabled(it, path, opts);
      if (!en) row.classList.add('disabled');
      row.onpointerenter = () => closeSiMenus(level + 1);
      row.onclick = () => { if (!menuItemEnabled(it, path, opts)) return; closeSiMenus(); onPick(it, nextPath); };
    }
    m.appendChild(row);
  }
  document.body.appendChild(m);
  m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 4) + 'px'; m.style.top = Math.min(y, window.innerHeight - m.offsetHeight - 4) + 'px';
  siMenus[level] = m;
  return m;
}
let siMenus: HTMLElement[] = [];
export function closeSiMenus(from = 0) { siMenus.splice(from).forEach(m => m.remove()); }
document.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('.si-menu')) closeSiMenus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSiMenus(); }, true);

/** Any dictionary string by module/id (Application/Dictionary/en/*.dict). */
export function siString(module: string, id: number | string): string | undefined { return SI_STRINGS[module]?.[String(id)]; }
/** Message catalogue (XSIMSGCAT) entries are "<n>$text" with printf-style %s / %d holes. */
export function siMessage(id: number | string, ...args: (string | number)[]): string {
  let s = siString('XSIMSGCAT', id) ?? ''; s = s.replace(/^\d+\$/, ''); let i = 0; return s.replace(/%[sd]/g, () => String(args[i++] ?? ''));
}
/** Find a message in the catalogue by (part of) its English text — handy when the id is unknown. */
export function siMessageLike(text: string, ...args: (string | number)[]): string | undefined {
  const t = text.toLowerCase(); for (const [id, s] of Object.entries(SI_STRINGS.XSIMSGCAT ?? {})) if (s.toLowerCase().includes(t)) return siMessage(id, ...args); return undefined;
}
/** Preferences page title from XSIPREFS (e.g. "C3DPrefsUnitsSetting" → "Units Setting", "C3DPrefsPluginMgr" → "Plug-in Manager"). */
export function siPrefTitle(key: string): string | undefined {
  const bare = key.replace(/^C3DPrefs/, '').replace(/Mgr$/, 'Manager').toLowerCase(); const alias: Record<string, string> = { scenesearch: 'scene search', fcurveeditor: 'fcurve editor', netview: 'netview', layercontrol: 'layer control', unitssetting: 'units setting', outputformat: 'output format', pluginmanager: 'plug-in manager', sceneexplorer: 'explorer', xsiexplorer: 'explorer', schematicview: 'schematic', texturelayereditor: 'texture layer editor', weighteditor: 'weight editor', performancemonitor: 'performance', materialmanager: 'material manager', keyingpanel: 'keying panel', datamanagement: 'data management', animationeditor: 'animation editor', textureeditor: 'texture editor', rendertree: 'render tree' };
  const want = alias[bare] ?? bare; for (const s of Object.values(SI_STRINGS.XSIPREFS ?? {})) if (s.toLowerCase().replace(/[\s-]/g, '') === want.replace(/[\s-]/g, '')) return s; return undefined;
}
/** Selection filter names as the filter manager (XSIFILTERMGR) spells them. */
export function siFilterNames(): string[] {
  const ids = [1191, 1192, 1194, 1195, 9, 1077, 1078, 1, 5, 22, 108, 38, 50, 97, 1200, 1152, 1165, 103]; return ids.map(i => siString('XSIFILTERMGR', i)).filter((s): s is string => !!s);
}
