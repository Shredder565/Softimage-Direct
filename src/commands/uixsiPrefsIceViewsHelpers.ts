// Ledger row CMD-B6c, helpers of src/commands/uixsiPrefsIceViews.ts. Brief: docs/ghidra/cmd-b6c-uixsi-prefs-ice-views.md
// ("Shared facts", "Wire contract"). Original code written from that contract only.
//
// The pieces of a Softimage session the 28 commands lean on and how this build stands in for them:
//
//  * Preferences object (Import / Export / RestoreDefault, preference values): the live preference sets of
//    File > Preferences (src/ui/prefs.ts). The .xsipref file format is open question Q3, so files are written and
//    read in this build's own text form on the session's virtual host file system.
//  * View manager attributes (focusedviewport, viewportundermouse, layout, viewport:<pane>, activecamera:<pane>,
//    suspenddrawing): mapped onto the four viewports of src/ui/viewManager.ts; attributes without a live
//    counterpart are kept in a table so that the order of writes can be checked.
//  * Layout views (SwitchToView, SwitchToViewByType): the frames of the layout engine.
//  * Net View (OpenNetView, a C++ command of another row): a floating window that shows the page address. The
//    three HTML pages are Softimage files and are not part of this build (Q11).
//  * PlayControl parameters: fields of the animation manager.
import { App } from '../core/commands';
import { X3DObject, Node, Shader, Material } from '../core/scene';
import type { ParamSet } from '../core/params';
import { SI_PROPSETS } from '../core/opdefs';
import { PREFERENCE_CATEGORY_KEYS } from '../core/preferences';
import { hostFs } from '../core/sdkHelpersHostFs';
import { preferenceSets } from '../ui/prefs';
import { openFloating, type Floating } from '../ui/floating';
import { sdkModal } from '../ui/sdkHelpersModal';
import { unset, siConst } from './viewEditPropertyHelpers';

export const NOTE = 'docs/ghidra/cmd-b6c-uixsi-prefs-ice-views.md';
export const logNya = (app: App, command: string, what: string, question = '') => app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
/** Warnings are logged as info with the prefix "WARNING : " (the log knows info / error). */
export const logWarning = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);
export class Cancelled extends Error {
  readonly siErrCancelled = true;
  constructor(command: string) { super(`${command} cancelled (siErrCancelled)`); this.name = 'siErrCancelled'; }
}
export const interactive = (app: App) => (app as any).Interactive !== false;
export const ownerObject = (n: any): X3DObject | null => { let x = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null; };

/** Run a delegated command of another row. `done` is false when it is not on the bus, or when the bus only has a
 *  placeholder for it (a stub that returns { command, args } and has no behaviour). */
export function delegate(app: App, name: string, args: Record<string, any>): { done: boolean; result?: any } {
  if (!app.commands.has(name)) return { done: false };
  const result = app.run(name, args);
  if (result && typeof result === 'object' && (result as any).command === name && 'args' in result) return { done: false };
  return { done: true, result };
}

/** The default token of the two SIUpdate...FromGlobalPref commands: taken to mean "nothing given" (Q2).   // inferred */
export const NOTHING_GIVEN_TOKEN = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';
export const nothingGiven = (v: any) => unset(v) || v === NOTHING_GIVEN_TOKEN || (Array.isArray(v) && v.length === 0);

// ------------------------------------------------------------------ preferences
const normCategory = (s: string) => s.replace(/^preferences\./i, '').replace(/[_\s]/g, '').toLowerCase();
const normKey = (k: string) => k.replace(/^C3DPrefs/, '').replace(/^C3D/, '').toLowerCase();
// inferred: category names of the preference dump that do not reduce to the property-set name
const CATEGORY_ALIAS: Record<string, string> = { units: 'unitssetting', transformproperties: 'transformprops', explorer: 'sceneexplorer' };
const XSIPREF_TAG = 'afterimage-xsipref';

export interface PrefHit { key: string; category: string; set: ParamSet; param: string | null }
export class PrefStore {
  constructor(private app: App) {}
  private sets(): Map<string, ParamSet> { return preferenceSets(this.app) as Map<string, ParamSet>; }
  /** Script name of a category: "preferences.output_format" style where the name is known, else from the set key. */
  categoryName(key: string): string {
    const want = normKey(key);
    const known = PREFERENCE_CATEGORY_KEYS.find(k => (CATEGORY_ALIAS[normCategory(k)] ?? normCategory(k)) === want);   // the category list of the preference dump
    return known ?? 'preferences.' + want;
  }
  categories(): string[] { return [...this.sets().keys()].map(k => this.categoryName(k)); }
  /** "output_format", "preferences.output_format", "Preferences.output_format.frame_rate", "output_format.frame_rate". */
  resolve(name: any): PrefHit | null {
    const parts = String(name ?? '').trim().replace(/^preferences\./i, '').split('.').filter(Boolean);
    if (!parts.length || parts.length > 2) return null;
    const want = CATEGORY_ALIAS[normCategory(parts[0])] ?? normCategory(parts[0]);
    for (const [key, set] of this.sets()) {
      if (normKey(key) !== want) continue;
      if (parts.length === 1) return { key, category: this.categoryName(key), set, param: null };
      const p = set.get(parts[1]) ?? set.params.find(q => q.name.toLowerCase() === parts[1].toLowerCase());
      return p ? { key, category: this.categoryName(key), set, param: p.name } : null;
    }
    return null;
  }
  get(name: string): any { const h = this.resolve(name); return h && h.param ? h.set.val(h.param) : undefined; }
  set(name: string, value: any): boolean { const h = this.resolve(name); if (!h || !h.param) return false; h.set.set(h.param, value); return true; }
  private defaultOf(key: string, param: string): any { return SI_PROPSETS[key]?.params.find(q => q.sn === param)?.default; }
  /** Restore a category or one preference. Returns the number of values put back, -1 for an unknown name. */
  restoreDefault(name: any): number {
    const h = this.resolve(name); if (!h) return -1;
    let n = 0;
    for (const p of h.set.params) {
      if (h.param && p.name !== h.param) continue;
      const d = this.defaultOf(h.key, p.name); if (d === undefined) continue;
      if (p.value !== d) { h.set.set(p.name, d); n++; }
    }
    return n;
  }
  /** Category list of an Export call. inferred (Q3): one name or a comma / semicolon list; empty = every category. */
  private categoryList(categories: any): { hits: PrefHit[]; unknown: string[] } {
    const names = Array.isArray(categories) ? categories.map(String) : String(categories ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (!names.length) return { hits: [...this.sets().keys()].map(k => this.resolve(this.categoryName(k))!).filter(Boolean), unknown: [] };
    const hits: PrefHit[] = [], unknown: string[] = [];
    for (const n of names) { const h = this.resolve(n); if (h && !h.param) hits.push(h); else unknown.push(n); }
    return { hits, unknown };
  }
  /** Write categories to a file of the host file system. inferred (Q3): the file layout is this build's own. */
  export(file: string, categories: any): { written: string[]; unknown: string[] } {
    const { hits, unknown } = this.categoryList(categories);
    const data: Record<string, Record<string, any>> = {};
    for (const h of hits) data[h.category] = Object.fromEntries(h.set.params.map(p => [p.name, p.value]));
    const folder = hostFs.parentPath(file); if (folder) hostFs.ensureFolder(folder);
    hostFs.writeFile(file, JSON.stringify({ format: XSIPREF_TAG, version: 1, categories: data }, null, 1));
    return { written: hits.map(h => h.category), unknown };
  }
  /** Read a file written by `export`. Returns the number of values applied; throws when the file cannot be read. */
  import(file: string): number {
    if (!hostFs.isFile(file)) throw new Error(`Preferences file "${file}" not found`);
    let doc: any; try { doc = JSON.parse(hostFs.readFile(file)); } catch { doc = null; }
    if (!doc || doc.format !== XSIPREF_TAG || typeof doc.categories !== 'object') throw new Error(`"${file}" is not a preferences file of this build (the .xsipref format is not yet attested, ${NOTE} Q3)`);
    let n = 0;
    for (const [cat, values] of Object.entries(doc.categories as Record<string, Record<string, any>>)) {
      const h = this.resolve(cat); if (!h) continue;
      for (const [name, v] of Object.entries(values ?? {})) { const p = h.set.get(name); if (p && p.value !== v) { h.set.set(name, v); n++; } }
    }
    return n;
  }
}

/** The file browser of the two preference commands. Resolves the full path, or '' on Cancel / no file name. */
export function browseFile(req: { title: string; filter: string; initialDirectory: string; save: boolean; baseName: string }): Promise<string> {
  let dir: HTMLInputElement, name: HTMLInputElement;
  return sdkModal(req.title, (body) => {
    body.dataset.filter = req.filter; body.dataset.mode = req.save ? 'save' : 'open';
    const row = (cls: string, text: string, value: string) => {
      const r = document.createElement('div'); r.className = cls; r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0';
      const l = document.createElement('label'); l.textContent = text; l.style.cssText = 'flex:0 0 90px';
      const t = document.createElement('input'); t.type = 'text'; t.value = value; t.style.cssText = 'flex:1 1 auto;min-width:0';
      r.append(l, t); body.appendChild(r); return t;
    };
    dir = row('uixsi-browse-dir', req.save ? 'Save in' : 'Look in', req.initialDirectory);
    name = row('uixsi-browse-name', 'File name', req.baseName);
    const f = document.createElement('div'); f.className = 'uixsi-browse-filter'; f.style.cssText = 'padding:2px 0;opacity:0.8';
    f.textContent = req.filter.split('|').filter((_, i) => i % 2 === 0).filter(Boolean).join(' / ');
    body.appendChild(f);
  }, { w: 460, cls: `uixsi-filebrowser uixsi-filebrowser-${req.save ? 'save' : 'open'}` }).then((ok) => {
    const n = name.value.trim();
    if (!ok || n === '') return '';
    return /^([A-Za-z]:|\\\\|\/\/)/.test(n) ? n : hostFs.join(dir.value.trim(), n);
  });
}

// ------------------------------------------------------------------ view manager
const vmOf = (): any => (globalThis as any).__vm;
const LETTERS = ['A', 'B', 'C', 'D'];

export interface ViewManagerFacade {
  /** False when the active layout has no "View Manager" view. */
  present(): boolean;
  get(attr: string): any;
  /** Writes an attribute. Returns true when the write had a live effect in this build, false when it was only recorded. */
  set(attr: string, value: any): boolean;
  /** Attributes without a live counterpart, as last written. */
  attrs: Record<string, string>;
  /** Every write, in order. */
  trace: [string, string][];
}

export function makeViewManager(app: App): ViewManagerFacade {
  let under: string | null = null;
  const vps = (): any[] => vmOf()?.viewports?.() ?? [];
  const focused = (): string | null => { const i = vps().indexOf(vmOf()?.active?.()); return i >= 0 ? LETTERS[i] : null; };
  // The pane under the pointer, kept after the pointer leaves the view manager ("or last if mouse not over view manager").
  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', (e) => {
      vps().forEach((vp, i) => {
        const r = vp.el?.getBoundingClientRect?.(); if (!r || !r.width || !r.height) return;
        if (e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom) under = LETTERS[i];
      });
    }, { passive: true });
  }
  const index = (letter: string) => LETTERS.indexOf(String(letter).toUpperCase());
  const vm: ViewManagerFacade = {
    attrs: {}, trace: [],
    present: () => vps().length > 0,
    get(attr) {
      const a = attr.toLowerCase();
      if (a === 'focusedviewport') return focused() ?? undefined;
      // inferred: before the pointer has been over any pane the focused pane is reported
      if (a === 'viewportundermouse') return under ?? focused() ?? undefined;
      return vm.attrs[a];
    },
    set(attr, value) {
      const a = attr.toLowerCase(); const v = String(value ?? '');
      vm.trace.push([a, v]); vm.attrs[a] = v;
      if (a === 'focusedviewport') {
        const i = index(v); const set = vmOf()?.setActive;
        return i >= 0 && typeof set === 'function' ? !!set(i) : false;
      }
      if (a === 'layout') {
        if (v === 'alternate') { window.dispatchEvent(new CustomEvent('vmlayout', { detail: { layout: 'alternate' } })); return true; }
        return false;   // inferred: "reset" puts the panes back to their un-maximized state, which the layout switch above has done
      }
      const cam = /^activecamera:(.)$/.exec(a);
      if (cam) {
        const i = index(cam[1]); const m = vmOf(); if (i < 0 || !m?.setActive || !m.view) return false;
        const was = vps().indexOf(m.active());
        const o = app.scene.find(v) ?? app.scene.find(v.slice(v.lastIndexOf('.') + 1)); const label = o ? o.name : v;   // a camera full name, or a built-in view name such as User
        m.setActive(i); m.view(label); if (was >= 0) m.setActive(was);
        return true;
      }
      return false;   // suspenddrawing, viewport:<pane>: recorded only
    },
  };
  return vm;
}

/** siViewport value to pane letter: A..D by name, siViewportCurrent = pane under the pointer, anything else = focused pane. */
export function viewportLetter(vm: ViewManagerFacade, id: any): string {
  const c = String(siConst(id) ?? '');
  const m = /^siViewport([A-D])$/.exec(c); if (m) return m[1];
  if (c === 'siViewportCurrent') return String(vm.get('viewportundermouse') ?? '');
  return String(vm.get('focusedviewport') ?? '');
}

// ------------------------------------------------------------------ layout views
export interface LayoutView { name: string; type: string; visible: boolean; show(): boolean }
/** The views of the active layout, in layout order: every frame of the layout engine (name = frame name, type = hosted view). */
export function layoutViews(): LayoutView[] {
  if (typeof document === 'undefined') return [];
  const layout = (globalThis as any).__layout;
  return Array.from(document.querySelectorAll<HTMLElement>('.frame[data-name]')).map((el) => ({
    name: el.dataset.name ?? '', type: el.dataset.view ?? '',
    get visible() { return !el.classList.contains('hidden') && el.offsetParent !== null; },
    show: () => (layout?.showFrame ? !!layout.showFrame(el.dataset.name) : (el.classList.remove('hidden'), true)),
  }));
}

// ------------------------------------------------------------------ net view
/** inferred: the install root the registry dump records (same value as the add-on wizard row uses). */
const FACTORY_PATH = 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2';
export const factoryPath = (app: App): string => String((app as any).addonDocWizard?.factoryPath ?? FACTORY_PATH);
export interface NetViewRecord { url: string; reuse: boolean; flags: number; reused: boolean; win: Floating | null }
const OPEN_NET_VIEW = 'OpenNetView';
/** OpenNetView <url>, <reuse>, <flags>: the command of the other row when it is on the bus, else a floating window. */
export function openNetView(app: App, list: NetViewRecord[], command: string, url: string, reuse: boolean, flags: number): NetViewRecord {
  if (delegate(app, OPEN_NET_VIEW, { URL: url, Reuse: reuse, Flags: flags }).done) { const r = { url, reuse, flags, reused: false, win: null }; list.push(r); return r; }
  const alive = (r: NetViewRecord) => !!r.win && r.win.el.isConnected;
  const old = reuse ? [...list].reverse().find(alive) : undefined;
  const fill = (body: HTMLElement) => {
    body.innerHTML = ''; body.classList.add('uixsi-netview');
    const u = document.createElement('div'); u.className = 'uixsi-netview-url'; u.textContent = url; u.style.cssText = 'padding:6px 8px;font-family:monospace;word-break:break-all';
    const t = document.createElement('div'); t.className = 'uixsi-netview-note'; t.style.cssText = 'padding:6px 8px;opacity:0.8';
    t.textContent = 'This page is a Softimage installation file and is not part of this build.';
    body.append(u, t);
  };
  let rec: NetViewRecord;
  if (old) { fill(old.win!.body); old.win!.focus(); rec = { url, reuse, flags, reused: true, win: old.win }; }
  else rec = { url, reuse, flags, reused: false, win: openFloating('Net View', (body) => fill(body), { w: 520, h: 200, cls: 'uixsi-netview-window' }) };
  list.push(rec);
  logNya(app, command, `the content of ${url.slice(url.lastIndexOf('/') + 1)} (a Softimage page); a Net View window showing its address was opened`, 'Q11');
  return rec;
}

// ------------------------------------------------------------------ play control
export type PlayControlName = 'Step' | 'Rate' | 'Format' | 'In' | 'Out' | 'Current' | 'Key';
// inferred: where this build keeps the PlayControl parameters (there is one timeline value for Key and Current)
const PLAY_FIELD: Record<PlayControlName, string> = { Step: 'step', Rate: 'fps', Format: 'frameFormat', In: 'startFrame', Out: 'endFrame', Current: 'frame', Key: 'frame' };
export function getPlayControl(app: App, name: PlayControlName): any {
  const a = app.anim as any;
  if (name === 'Key') return Number(a.keyMarker ?? a.key ?? a.frame);
  return a[PLAY_FIELD[name]] ?? (name === 'Step' ? 1 : undefined);
}
/** SetValue "PlayControl.<name>", <value> (undoable). */
export function setPlayControl(app: App, name: PlayControlName, value: any) {
  const a = app.anim as any; const f = PLAY_FIELD[name]; const old = a[f];
  if (old === value) return;
  app.record(`SetValue PlayControl.${name}`, () => { a[f] = value; }, () => { a[f] = old; });
}

// ------------------------------------------------------------------ shader connection points
/** inferred stand-in for the C++ connection-point query: the shader plugged into "<material>.surface" or "<...shader>.<port>". */
export function shaderOnCnxPoint(app: App, x: any): Shader | undefined {
  if (x instanceof Shader) return x;
  if (x instanceof Material) return x.surface ?? undefined;
  if (x instanceof Node || typeof x !== 'string' || !x.includes('.')) return undefined;
  const parts = x.split('.'); const port = parts.pop()!;
  const mats: Material[] = [...app.scene.materials];
  for (const o of app.scene.allObjects()) if (o.material && !mats.includes(o.material)) mats.push(o.material);
  const walk = (s: Shader | null | undefined, f: (s: Shader) => void) => { if (!s) return; f(s); for (const i of s.inputs.values()) walk(i, f); };
  const owner = parts[parts.length - 1];
  for (const m of mats) {
    if (m.name === owner && /^surface$/i.test(port)) return m.surface ?? undefined;
    if (!parts.includes(m.name) && parts.length > 1) continue;
    let hit: Shader | undefined;
    walk(m.surface, (s) => { if (!hit && s.name === owner && s.inputs.has(port)) hit = s.inputs.get(port); });
    if (hit) return hit;
  }
  return undefined;
}
