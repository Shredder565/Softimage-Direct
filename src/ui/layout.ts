// Generic layout engine: a frameset tree like Softimage's *.xsily files.
// framesets split space horizontally/vertically; switchers show one child at a time with tab buttons;
// frames host a registered view type by name.
export type LayoutNode =
  | { kind: 'frameset'; orientation: 'horizontal' | 'vertical'; sizes: string[]; children: LayoutNode[]; name?: string; splitter?: boolean }
  | { kind: 'switcher'; name: string; buttonSide: 'top' | 'bottom' | 'left'; children: LayoutNode[]; labels?: string[] }
  | { kind: 'frame'; name: string; view: string; label?: string };

export type ViewFactory = (host: HTMLElement) => void | { destroy?: () => void };

export class LayoutEngine {
  readonly views = new Map<string, ViewFactory>();
  registerView(type: string, f: ViewFactory) { this.views.set(type, f); }

  build(node: LayoutNode, host: HTMLElement) {
    host.appendChild(this.make(node));
  }

  private make(node: LayoutNode): HTMLElement {
    if (node.kind === 'frame') {
      const el = div('frame', node.name);
      el.dataset.view = node.view;
      const f = this.views.get(node.view);
      if (f) f(el); else el.innerHTML = `<div class="view-placeholder">${node.label ?? node.view}</div>`;
      return el;
    }
    if (node.kind === 'frameset') {
      const el = div('frameset ' + node.orientation, node.name);
      const sizes = node.sizes;
      el.style.display = 'grid';
      const tracks = sizes.map(s => s === '*' ? 'minmax(0,1fr)' : /^\d+%$/.test(s) ? s : `${s}px`).join(' ');
      if (node.orientation === 'horizontal') { el.style.gridTemplateColumns = tracks; el.style.gridTemplateRows = 'minmax(0,1fr)'; }
      else { el.style.gridTemplateRows = tracks; el.style.gridTemplateColumns = 'minmax(0,1fr)'; }
      node.children.forEach((c, i) => {
        const child = this.make(c);
        el.appendChild(child);
        if (node.splitter && i < node.children.length - 1) addSplitter(el, node.orientation, i);
      });
      return el;
    }
    // switcher
    const el = div('switcher side-' + node.buttonSide, node.name);
    const bar = div('switcher-bar');
    const body = div('switcher-body');
    const panes: HTMLElement[] = [];
    node.children.forEach((c, i) => {
      const pane = div('switcher-pane'); pane.appendChild(this.make(c)); panes.push(pane); body.appendChild(pane);
      const b = document.createElement('button'); b.className = 'switcher-btn'; b.textContent = node.labels?.[i] ?? (c.kind === 'frame' ? (c.label ?? c.view) : (c.name ?? 'Tab'));
      b.onclick = () => { panes.forEach((p, j) => p.classList.toggle('active', i === j)); Array.from(bar.children).forEach((x, j) => x.classList.toggle('active', i === j)); };
      bar.appendChild(b);
    });
    panes[0]?.classList.add('active'); bar.children[0]?.classList.add('active');
    if (node.buttonSide === 'top' || node.buttonSide === 'left') { el.appendChild(bar); el.appendChild(body); } else { el.appendChild(body); el.appendChild(bar); }
    return el;
  }
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

/** Softimage default layout (from Application/layouts/default.xsily), simplified to the panels implemented so far. */
export const DEFAULT_LAYOUT: LayoutNode = {
  kind: 'frameset', orientation: 'vertical', sizes: ['*', '48'], children: [
    {
      kind: 'frameset', orientation: 'horizontal', name: 'main', sizes: ['*', '300'], splitter: true, children: [
        {
          kind: 'frameset', orientation: 'horizontal', name: 'VM_Frameset', sizes: ['299', '*'], splitter: true, children: [
            {
              kind: 'switcher', name: 'module_menu', buttonSide: 'bottom', labels: ['Toolbar', 'Explorer', 'Script Log'], children: [
                { kind: 'frame', name: 'toolbar_panel', view: 'Toolbar Panel' },
                { kind: 'frame', name: 'explorer', view: 'Explorer' },
                { kind: 'frame', name: 'scripts', view: 'Script Log' },
              ],
            },
            {
              kind: 'frameset', orientation: 'vertical', sizes: ['*', '26', '22'], children: [
                { kind: 'frame', name: 'vm', view: 'View Manager' },
                { kind: 'frame', name: 'timeline', view: 'Timeline' },
                { kind: 'frame', name: 'timerange', view: 'Timerange' },
              ],
            },
          ],
        },
        {
          kind: 'switcher', name: 'mcp', buttonSide: 'bottom', labels: ['MCP', 'KP/L', 'PPG'], children: [
            {
              kind: 'frameset', orientation: 'vertical', sizes: ['*'], children: [
                { kind: 'frame', name: 'mcp_panel', view: 'MCP' },
              ],
            },
            {
              kind: 'frameset', orientation: 'vertical', sizes: ['*', '40%'], splitter: true, children: [
                { kind: 'frame', name: 'keying_panel', view: 'Keying Panel' },
                { kind: 'frame', name: 'scene_layer_manager', view: 'Layer Control' },
              ],
            },
            { kind: 'frame', name: 'property_editor', view: 'Property Editor' },
          ],
        },
      ],
    },
    {
      kind: 'frameset', orientation: 'horizontal', name: 'playback', sizes: ['170', '*', '290', '270'], children: [
        { kind: 'frame', name: 'panel_switcher', view: 'Panel Switcher' },
        { kind: 'frame', name: 'command_line', view: 'Command Line' },
        { kind: 'frame', name: 'playback_panel', view: 'Playback Panel' },
        { kind: 'frame', name: 'animation_panel', view: 'Animation Panel' },
      ],
    },
  ],
};
