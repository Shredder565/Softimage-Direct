// Generic layout engine: a frameset tree like Softimage's *.xsily files.
// framesets split space horizontally/vertically; switchers show one child at a time with tab buttons;
// frames host a registered view type by name.
export type LayoutNode =
  | { kind: 'frameset'; orientation: 'horizontal' | 'vertical'; sizes: string[]; children: LayoutNode[]; name?: string; splitter?: boolean }
  | { kind: 'switcher'; name: string; buttonSide: 'top' | 'bottom' | 'left'; children: LayoutNode[]; labels?: string[]; icons?: (string | undefined)[]; active?: number }
  | { kind: 'frame'; name: string; view: string; label?: string; hidden?: boolean };

export type ViewFactory = (host: HTMLElement) => void | { destroy?: () => void };

export class LayoutEngine {
  readonly views = new Map<string, ViewFactory>();
  iconFactory?: (name: string) => HTMLElement;
  registerView(type: string, f: ViewFactory) { this.views.set(type, f); }
  /** Activate the tray/switcher pane whose button carries `label` (a frame's displayname or a frameset's name). */
  activate(switcherName: string, label: string) {
    const sw = document.querySelector<HTMLElement>(`.switcher[data-name="${switcherName}"]`); if (!sw) return false;
    const bar = sw.querySelector<HTMLElement>(':scope > .switcher-bar'); const b = bar && Array.from(bar.children).find(c => (c as HTMLElement).dataset.label === label) as HTMLElement | undefined;
    if (b) b.click(); return !!b;
  }
  /** Bring a frame (by layout name, e.g. "explorer") into view: activates every enclosing switcher pane and unhides it. */
  showFrame(name: string) {
    const el = document.querySelector<HTMLElement>(`.frame[data-name="${name}"]`); if (!el) return false;
    el.classList.remove('hidden'); let p: HTMLElement | null = el.parentElement;
    while (p) {
      if (p.classList.contains('switcher-pane')) { const body = p.parentElement!; const sw = body.parentElement!; const i = Array.from(body.children).indexOf(p); (sw.querySelector<HTMLElement>(':scope > .switcher-bar')!.children[i] as HTMLElement)?.click(); }
      if (p.classList.contains('frameset')) applyTracks(p, p.classList.contains('horizontal') ? 'horizontal' : 'vertical');
      p = p.parentElement;
    }
    window.dispatchEvent(new Event('resize')); return true;
  }
  setFrameVisible(name: string, visible?: boolean) {
    const el = document.querySelector<HTMLElement>(`.frame[data-name="${name}"], .switcher[data-name="${name}"], .frameset[data-name="${name}"]`); if (!el) return false;
    const v = visible ?? el.classList.contains('hidden'); el.classList.toggle('hidden', !v);
    const p = el.parentElement; if (p?.classList.contains('frameset')) applyTracks(p, p.classList.contains('horizontal') ? 'horizontal' : 'vertical');
    window.dispatchEvent(new Event('resize')); return v;
  }

  build(node: LayoutNode, host: HTMLElement) {
    host.appendChild(this.make(node));
  }

  private make(node: LayoutNode): HTMLElement {
    if (node.kind === 'frame') {
      const el = div('frame', node.name);
      el.dataset.view = node.view; el.dataset.label = node.label ?? node.view; if (node.hidden) el.classList.add('hidden');
      const f = this.views.get(node.view);
      if (f) f(el); else el.innerHTML = `<div class="view-placeholder">${node.label ?? node.view}</div>`;
      return el;
    }
    if (node.kind === 'frameset') {
      const el = div('frameset ' + node.orientation, node.name);
      el.dataset.sizes = node.sizes.join(','); el.style.display = 'grid';
      node.children.forEach((c, i) => {
        const child = this.make(c);
        el.appendChild(child);
        if (node.splitter && i < node.children.length - 1) addSplitter(el, node.orientation, i);
      });
      applyTracks(el, node.orientation);
      return el;
    }
    // switcher
    const el = div('switcher side-' + node.buttonSide, node.name);
    const bar = div('switcher-bar');
    const body = div('switcher-body');
    const panes: HTMLElement[] = [];
    node.children.forEach((c, i) => {
      const pane = div('switcher-pane'); pane.appendChild(this.make(c)); panes.push(pane); body.appendChild(pane);
      const b = document.createElement('button'); b.className = 'switcher-btn'; const label = node.labels?.[i] ?? (c.kind === 'frame' ? (c.label ?? c.view) : (c.name ?? 'Tab'));
      b.dataset.label = label; b.title = label; const ic = node.icons?.[i]; if (ic) b.dataset.icon = ic; if (ic && this.iconFactory) { b.appendChild(this.iconFactory(ic)); b.classList.add('icon'); } else b.textContent = label;
      b.onclick = () => { panes.forEach((p, j) => p.classList.toggle('active', i === j)); Array.from(bar.children).forEach((x, j) => x.classList.toggle('active', i === j)); window.dispatchEvent(new Event('resize')); };
      bar.appendChild(b);
    });
    const a0 = node.active ?? 0; panes[a0]?.classList.add('active'); bar.children[a0]?.classList.add('active');
    if (node.buttonSide === 'top' || node.buttonSide === 'left') { el.appendChild(bar); el.appendChild(body); } else { el.appendChild(body); el.appendChild(bar); }
    return el;
  }
}

/** Grid tracks from the frameset's declared sizes, skipping hidden children (Softimage "optional" panels). */
function applyTracks(el: HTMLElement, orientation: 'horizontal' | 'vertical') {
  const sizes = (el.dataset.sizes ?? '').split(','); const kids = Array.from(el.children).filter(c => !c.classList.contains('splitter')) as HTMLElement[];
  const tracks = kids.map((k, i) => k.classList.contains('hidden') ? '0px' : sizes[i] === '*' || sizes[i] === undefined ? 'minmax(0,1fr)' : /^\d+%$/.test(sizes[i]) ? sizes[i] : `${sizes[i]}px`);
  if (!tracks.some(t => t === 'minmax(0,1fr)')) { const i = tracks.findIndex(t => t !== '0px'); if (i >= 0) tracks[i] = 'minmax(0,1fr)'; }
  if (orientation === 'horizontal') { el.style.gridTemplateColumns = tracks.join(' '); el.style.gridTemplateRows = 'minmax(0,1fr)'; } else { el.style.gridTemplateRows = tracks.join(' '); el.style.gridTemplateColumns = 'minmax(0,1fr)'; }
}
function div(cls: string, name?: string) { const d = document.createElement('div'); d.className = cls; if (name) d.dataset.name = name; return d; }

function addSplitter(grid: HTMLElement, orientation: 'horizontal' | 'vertical', index: number) {
  // Visual-only splitter that drags grid track sizes.
  const s = document.createElement('div'); s.className = 'splitter ' + orientation;
  grid.appendChild(s);
  const children = () => Array.from(grid.children).filter(c => !c.classList.contains('splitter')) as HTMLElement[];
  const place = () => {
    const kids = children(); const a = kids[index];
    if (!a) return;
    if (orientation === 'horizontal') { s.style.left = (a.offsetLeft + a.offsetWidth - 3) + 'px'; s.style.top = '0'; s.style.height = '100%'; }
    else { s.style.top = (a.offsetTop + a.offsetHeight - 3) + 'px'; s.style.left = '0'; s.style.width = '100%'; }
  };
  requestAnimationFrame(place); new ResizeObserver(place).observe(grid);
  s.onpointerdown = (e) => {
    e.preventDefault(); s.setPointerCapture(e.pointerId);
    const prop = orientation === 'horizontal' ? 'gridTemplateColumns' : 'gridTemplateRows';
    const kids = children(); const sizes = kids.map(k => orientation === 'horizontal' ? k.offsetWidth : k.offsetHeight);
    const start = orientation === 'horizontal' ? e.clientX : e.clientY;
    const move = (ev: PointerEvent) => {
      const d = (orientation === 'horizontal' ? ev.clientX : ev.clientY) - start;
      const ns = [...sizes]; ns[index] = Math.max(40, sizes[index] + d); ns[index + 1] = Math.max(40, sizes[index + 1] - d);
      (grid.style as any)[prop] = ns.map(v => v + 'px').join(' ');
      place();
    };
    const up = () => { s.removeEventListener('pointermove', move); s.removeEventListener('pointerup', up); window.dispatchEvent(new Event('resize')); };
    s.addEventListener('pointermove', move); s.addEventListener('pointerup', up);
  };
}

import siLayout from '../data/si/layout_default.json';
import siLayouts from '../data/si/layouts.json';
type SiNode = { kind: string; name?: string; displayname?: string; type?: string; bitmap?: string; optional?: string; orientation?: string; splitter?: string; sizes?: string[]; buttonside?: string; active?: number; children?: SiNode[] };
/** Frame types in default.xsily -> registered view names; anything else shows a placeholder with its Softimage name. */
const VIEW_OF: Record<string, string> = { 'Toolbar Panel': 'Toolbar Panel', 'Explorer': 'Explorer', 'Scripts': 'Scripts', 'View Manager': 'View Manager', 'Timeline': 'Timeline', 'Timerange': 'Timerange', 'Keying Panel': 'Keying Panel', 'Layer Control': 'Layer Control', 'Property Editor': 'Property Editor', 'Panel Switcher': 'Panel Switcher', 'Command Line': 'Command Line', 'Playback Panel': 'Playback Panel', 'Animation Panel': 'Animation Panel', 'Main Shelf': 'Main Shelf', 'Mini Transform Panel': 'Mini Transform Panel', 'Preset Manager': 'Preset Manager', 'Palettes': 'Palettes', 'Weight Paint Panel': 'Weight Paint Panel', 'Animation Layer Manager': 'Animation Layer Manager', 'Selection Panel': 'Selection Panel', 'Transformation Panel': 'Transformation Panel', 'Snap Panel': 'Snap Panel', 'Constraint Panel': 'Constraint Panel', 'Edit Panel': 'Edit Panel', 'Netview': 'Netview', 'Animation Editor': 'Animation Editor', 'Fcurve Editor': 'Animation Editor', 'DopeSheet': 'DopeSheet', 'Standalone Dopesheet': 'DopeSheet', 'Animation Mixer': 'Animation Mixer', 'Schematic': 'Schematic', 'Material Manager': 'Material Manager', 'Material Panel': 'Material Panel', 'Render Tree': 'Render Tree', 'Texture Editor': 'Texture Editor', 'ICE Tree': 'ICE Tree', 'FX Tree': 'FX Tree', 'Fx Viewer': 'Fx Viewer', 'Fx Paint Brush List': 'Fx Paint Brush List', 'Fx Operator Selector': 'Fx Operator Selector', 'Plugin Manager': 'Plugin Manager', 'SDK Explorer': 'SDK Explorer', 'Script Editor': 'Script Editor' };
function convert(n: SiNode): LayoutNode {
  if (n.kind === 'frame') return { kind: 'frame', name: n.name!, view: VIEW_OF[n.type!] ?? n.type!, label: n.displayname ?? n.type, hidden: n.optional === 'hidden' };
  if (n.kind === 'switcher') {
    if (n.type === 'panel') return { kind: 'frame', name: 'mcp_panel', view: 'MCP', label: 'MCP' }; // the five MCP panels stacked = our MCP view
    const kids = n.children ?? [];
    return { kind: 'switcher', name: n.name!, buttonSide: n.buttonside === 'top' ? 'top' : 'bottom', active: n.active ?? 0, children: kids.map(convert), labels: kids.map(k => k.displayname ?? (k.kind === 'frame' ? k.type! : k.name!)), icons: kids.map(k => k.bitmap) };
  }
  return { kind: 'frameset', name: n.name, orientation: n.orientation === 'horizontal' ? 'horizontal' : 'vertical', sizes: n.sizes ?? ['*'], splitter: n.splitter === 'movable', children: (n.children ?? []).map(convert) };
}
/** Softimage's default layout, converted 1:1 from Application/layouts/default.xsily (1282x959 reference sizes). */
export const DEFAULT_LAYOUT: LayoutNode = convert((siLayout as any).tree);
/** Every layout shipped in Application/layouts (Default, Dual, 1024 x 768, Autohide) plus user layouts saved by Edit/Save Layouts. */
export const SHIPPED_LAYOUTS: Record<string, LayoutNode> = Object.fromEntries(Object.entries(siLayouts as any).map(([k, v]: [string, any]) => [k, convert(v.tree)]));
export function userLayouts(): Record<string, LayoutNode> { try { return JSON.parse(localStorage.getItem('si.layouts') ?? '{}'); } catch { return {}; } }
export function saveUserLayout(name: string, node: LayoutNode | null) { const u = userLayouts(); if (node) u[name] = node; else delete u[name]; localStorage.setItem('si.layouts', JSON.stringify(u)); }
export function layoutNames(): string[] { return [...new Set([...Object.keys(SHIPPED_LAYOUTS), ...Object.keys(userLayouts())])]; }
export function layoutByName(name: string): LayoutNode | undefined { return userLayouts()[name] ?? SHIPPED_LAYOUTS[name]; }
export function currentLayoutName(): string { const q = new URLSearchParams(location.search).get('layout'); if (q && layoutByName(q)) return q; try { const s = localStorage.getItem('si.layout'); if (s && layoutByName(s)) return s; } catch { /* ignore */ } return 'Default'; }
/** Switch layouts the way Softimage does on startup: remember the choice and rebuild the whole shell. */
export function switchLayout(name: string) { if (!layoutByName(name)) return false; localStorage.setItem('si.layout', name); const u = new URL(location.href); u.searchParams.delete('layout'); location.href = u.toString(); return true; }
/** Read the live DOM back into a layout tree (frame order/visibility after layout editing, splitter sizes). */
export function captureLayout(root: HTMLElement): LayoutNode | null {
  const walk = (el: HTMLElement): LayoutNode | null => {
    if (el.classList.contains('frame')) return { kind: 'frame', name: el.dataset.name!, view: el.dataset.view!, label: el.dataset.label, hidden: el.classList.contains('hidden') };
    if (el.classList.contains('frameset')) { const kids = Array.from(el.children).filter(c => !c.classList.contains('splitter')) as HTMLElement[]; const horiz = el.classList.contains('horizontal'); const tracks = (horiz ? el.style.gridTemplateColumns : el.style.gridTemplateRows).split(' '); const sizes = kids.map((k, i) => k.classList.contains('hidden') ? ((el.dataset.sizes ?? '').split(',')[i] ?? '*') : tracks[i]?.endsWith('px') ? String(Math.round(parseFloat(tracks[i]))) : '*'); return { kind: 'frameset', name: el.dataset.name, orientation: horiz ? 'horizontal' : 'vertical', sizes, splitter: !!el.querySelector(':scope > .splitter'), children: kids.map(walk).filter(Boolean) as LayoutNode[] }; }
    if (el.classList.contains('switcher')) { const body = el.querySelector(':scope > .switcher-body')!; const bar = el.querySelector(':scope > .switcher-bar')!; const panes = Array.from(body.children) as HTMLElement[]; const kids = panes.map(p => walk(p.firstElementChild as HTMLElement)).filter(Boolean) as LayoutNode[]; return { kind: 'switcher', name: el.dataset.name!, buttonSide: el.classList.contains('side-top') ? 'top' : 'bottom', active: Math.max(0, panes.findIndex(p => p.classList.contains('active'))), children: kids, labels: Array.from(bar.children).map(b => (b as HTMLElement).dataset.label ?? ''), icons: Array.from(bar.children).map(b => (b as HTMLElement).dataset.icon || undefined) }; }
    return null;
  };
  const top = root.firstElementChild as HTMLElement | null; return top ? walk(top) : null;
}
