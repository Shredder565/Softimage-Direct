// Explorer: scope dropdown, filter, name search, and a tree over the object model with Softimage-style icons.
import { App } from '../core/commands';
import { Node, X3DObject, Scene } from '../core/scene';

type Scope = 'Scene' | 'Layers' | 'Passes' | 'Materials' | 'Selection';
type Filter = 'All' | 'Objects only' | 'Models only' | 'Primitives and Properties' | 'Geometry Operators' | 'Materials and Shaders';

export function explorerView(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'explorer';
  const head = document.createElement('div'); head.className = 'explorer-head';
  const scope = select<Scope>(['Scene', 'Layers', 'Passes', 'Materials', 'Selection']);
  const filter = select<Filter>(['All', 'Objects only', 'Models only', 'Primitives and Properties', 'Geometry Operators', 'Materials and Shaders']);
  const search = document.createElement('input'); search.placeholder = 'find';
  const showParams = document.createElement('select'); for (const o of ['No Parameters', 'Animated Parameters', 'All Parameters']) { const e = document.createElement('option'); e.textContent = o; showParams.appendChild(e); }
  head.append(scope, filter, showParams, search);
  const body = document.createElement('div'); body.className = 'explorer-body';
  root.append(head, body); host.appendChild(root);
  const expanded = new Set<number>();
  let first = true;

  const render = () => {
    body.innerHTML = '';
    const sc = app.scene;
    let roots: Node[];
    switch (scope.value as Scope) {
      case 'Layers': roots = sc.layers; break;
      case 'Passes': roots = sc.passes; break;
      case 'Materials': roots = sc.materials; break;
      case 'Selection': roots = app.selection; break;
      default: roots = [sc.root];
    }
    if (first) { expanded.add(sc.root.id); first = false; }
    for (const r of roots) body.appendChild(nodeEl(r, 0));
  };

  const passes = (n: Node): boolean => {
    const f = filter.value as Filter;
    if (f === 'Objects only') return n.kind === 'object' || n.kind === 'model';
    if (f === 'Models only') return n.kind === 'model';
    if (f === 'Primitives and Properties') return ['object', 'model', 'primitive', 'property', 'kinematics'].includes(n.kind);
    if (f === 'Geometry Operators') return ['object', 'model', 'primitive', 'operator'].includes(n.kind);
    if (f === 'Materials and Shaders') return ['object', 'model', 'material', 'shader'].includes(n.kind);
    return true;
  };

  const nodeEl = (n: Node, depth: number): HTMLElement => {
    const wrap = document.createElement('div'); wrap.className = 'tree-node';
    const kids = n.explorerChildren().filter(passes);
    const q = search.value.trim().toLowerCase();
    const paramMode = showParams.selectedIndex;
    const params = paramMode === 0 ? [] : n.params.filter(p => paramMode === 2 || app.anim.isAnimated(p));
    const hasKids = kids.length > 0 || params.length > 0;
    const matches = !q || n.name.toLowerCase().includes(q);
    const row = document.createElement('div'); row.className = 'tree-row' + (app.selection.includes(n) ? ' selected' : '');
    const tg = document.createElement('span'); tg.className = 'tree-toggle'; tg.textContent = hasKids ? (expanded.has(n.id) ? '▼' : '▶') : '';
    tg.onclick = (e) => { e.stopPropagation(); if (expanded.has(n.id)) expanded.delete(n.id); else expanded.add(n.id); render(); };
    const ic = document.createElement('span'); ic.className = 'tree-icon ic-' + n.kind; ic.textContent = iconLetter(n);
    const nm = document.createElement('span'); nm.textContent = n.name;
    if (n instanceof X3DObject && !n.visible) nm.style.color = '#999';
    row.append(tg, ic, nm);
    if (n.params.some(p => app.anim.isAnimated(p))) { const a = document.createElement('span'); a.className = 'tree-anim'; a.textContent = '◆'; row.appendChild(a); }
    row.onclick = (e) => { app.select([n], e.ctrlKey ? 'toggle' : e.shiftKey ? 'add' : 'replace'); };
    row.ondblclick = () => { if (expanded.has(n.id)) expanded.delete(n.id); else expanded.add(n.id); render(); };
    row.oncontextmenu = (e) => { e.preventDefault(); contextMenu(app, n, e.clientX, e.clientY); };
    if (matches || q) wrap.appendChild(row);
    if (expanded.has(n.id) || q) {
      const ch = document.createElement('div'); ch.className = 'tree-children';
      for (const p of params) {
        const pr = document.createElement('div'); pr.className = 'tree-row';
        const pic = document.createElement('span'); pic.className = 'tree-icon ic-param'; pic.textContent = 'p';
        const pn = document.createElement('span'); pn.textContent = `${p.label}  =  ${fmt(p.value)}`;
        pr.append(document.createElement('span'), pic, pn);
        if (app.anim.isAnimated(p)) { const a = document.createElement('span'); a.className = 'tree-anim'; a.textContent = '◆'; pr.appendChild(a); }
        ch.appendChild(pr);
      }
      for (const k of kids) ch.appendChild(nodeEl(k, depth + 1));
      wrap.appendChild(ch);
    }
    return wrap;
  };

  scope.onchange = filter.onchange = showParams.onchange = render; search.oninput = render;
  render();
  app.events.on('scene', render); app.events.on('selection', render); app.events.on('params', render);
}

function select<T extends string>(opts: T[]) { const s = document.createElement('select'); for (const o of opts) { const e = document.createElement('option'); e.value = o; e.textContent = o; s.appendChild(e); } return s; }
function fmt(v: any) { return typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : Array.isArray(v) ? v.map(x => Math.round(x * 100) / 100).join(', ') : String(v); }
function iconLetter(n: Node) {
  if (n instanceof Scene) return 'S';
  switch (n.kind) { case 'model': return 'M'; case 'object': return n.type === 'null' ? 'N' : n.type === 'camera' ? 'C' : n.type === 'light' ? 'L' : 'O'; case 'kinematics': return 'K'; case 'property': return 'P'; case 'primitive': return 'G'; case 'operator': return 'op'; case 'material': return 'Mt'; case 'shader': return 'Sh'; case 'layer': return 'Ly'; case 'pass': return 'Ps'; default: return '·'; }
}

function contextMenu(app: App, n: Node, x: number, y: number) {
  const m = document.createElement('div'); m.className = 'menu'; m.style.left = x + 'px'; m.style.top = y + 'px';
  const add = (label: string, fn?: () => void) => { const r = document.createElement('div'); r.className = 'menu-item' + (fn ? '' : ' disabled'); r.textContent = label; if (fn) r.onclick = () => { m.remove(); fn(); }; m.appendChild(r); };
  add('Inspect', () => app.run('InspectObj', { InputObjs: [n] }));
  if (n instanceof X3DObject) {
    add('Rename…', () => { const nn = prompt('New name', n.name); if (nn) app.run('Rename', { InputObj: [n], Name: nn }); });
    add('Duplicate', () => app.run('Duplicate', { InputObjs: [n] }));
    add(n.visible ? 'Hide' : 'Unhide', () => app.run('ToggleVisibility', { InputObjs: [n] }));
    add('Delete', () => app.run('DeleteObj', { InputObj: [n] }));
  }
  if (n.kind === 'operator' && n.type !== 'geom') add('Delete Operator', () => { app.select([n]); app.run('DeleteOp', { Operator: n }); });
  document.body.appendChild(m);
  const close = (e: PointerEvent) => { if (!m.contains(e.target as any)) { m.remove(); document.removeEventListener('pointerdown', close); } };
  setTimeout(() => document.addEventListener('pointerdown', close));
}
