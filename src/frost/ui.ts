/** FROST Graph editor view — minimal usable node graph for P0. */

import { App } from '../core/commands';
import { openSiMenu } from '../ui/si';
import { FROST_NODES, frostCategories } from './nodes';
import { frostOf } from './session';
import { FROST_PRESETS } from './presets';
import { aliveCount } from './evaluator';

const el = (tag: string, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const btn = (l: string, t: string, fn: () => void) => {
  const b = el('button', 'xp-btn', l) as HTMLButtonElement;
  b.title = t;
  b.onclick = fn;
  return b;
};
const head = (...kids: HTMLElement[]) => {
  const h = el('div', 'xp-head');
  h.append(...kids);
  return h;
};
const menuBtn = (
  label: string,
  items: () => { label?: string; separator?: boolean; items?: any[] }[],
  onPick: (l: string) => void,
) => {
  const b = el('button', 'xp-btn', label) as HTMLButtonElement;
  b.innerHTML = label + '<span class="xp-arrow">▾</span>';
  b.onclick = (e) => {
    e.stopPropagation();
    const r = b.getBoundingClientRect();
    openSiMenu(items() as any, r.left, r.bottom, (it) => onPick(it.label ?? ''));
  };
  return b;
};

export function frostGraphView(app: App, host: HTMLElement) {
  const frost = frostOf(app);
  const root = el('div', 'rtree frost-graph');
  host.appendChild(root);

  const cats = frostCategories();
  const nodesMenu = () => [
    ...[...cats.entries()].map(([c, types]) => ({ label: c, items: types.map(t => ({ label: t })) })),
    { separator: true },
    { label: 'Presets', items: FROST_PRESETS.map(p => ({ label: p.label })) },
  ];

  const addNode = (type: string) => {
    const preset = FROST_PRESETS.find(p => p.label === type);
    if (preset) {
      frost.graph = preset.build();
      frost.reset();
      frost.tick(app.anim.frame);
      app.logMsg('info', `FROST preset: ${type}`);
      app.events.emit('scene');
      render();
      return;
    }
    frost.addNode(type, 40 + canvas.scrollLeft + Math.random() * 100, 40 + canvas.scrollTop + Math.random() * 100);
    app.events.emit('scene');
    render();
  };

  const edit = (l: string) => {
    if (l === 'Delete Selected Node' && selected) frost.removeNode(selected);
    else if (l === 'Clear Graph') { frost.graph.nodes = []; frost.graph.links = []; frost.reset(); }
    else if (l === 'Reset Simulation') frost.reset();
    else if (l === 'Load Emit→Simulate recipe') frost.loadRecipe();
    else if (l === 'Export Graph (.json)') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([frost.toJSON()], { type: 'application/json' }));
      a.download = (frost.graph.name || 'frost') + '.frost.json';
      a.click();
    } else if (l === 'Import Graph (.json)') {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,.frost.json';
      inp.onchange = () => inp.files?.[0]?.text().then(t => { frost.loadJSON(t); render(); });
      inp.click();
      return;
    } else if (l === 'Toggle Simulated') {
      frost.graph.simulated = !frost.graph.simulated;
      frost.reset();
      frost.tick(app.anim.frame);
    }
    app.events.emit('scene');
    render();
  };

  const hd = head(
    menuBtn('Nodes', nodesMenu, addNode),
    menuBtn('Edit', () => [
      { label: 'Load Emit→Simulate recipe' },
      { label: 'Reset Simulation' },
      { label: 'Toggle Simulated' },
      { separator: true },
      { label: 'Delete Selected Node' },
      { label: 'Clear Graph' },
      { separator: true },
      { label: 'Export Graph (.json)' },
      { label: 'Import Graph (.json)' },
    ], edit),
    btn('Reset', 'Reset particle state', () => { frost.reset(); frost.tick(app.anim.frame); app.events.emit('scene'); render(); }),
    btn('Recipe', 'Load Emit → Simulate Particles', () => { frost.loadRecipe(); render(); }),
  );
  const title = el('span', 'rt-title');
  hd.appendChild(title);
  root.appendChild(hd);

  const canvas = el('div', 'rt-canvas');
  root.appendChild(canvas);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'rt-links');
  canvas.appendChild(svg);

  let pending: { node: string; port: string } | null = null;
  let selected: string | null = null;

  const render = () => {
    const g = frost.graph;
    canvas.querySelectorAll('.rt-node').forEach(n => n.remove());
    svg.innerHTML = '';
    title.textContent = `${frost.status()} · ${g.nodes.length} nodes`;
    const boxes = new Map<string, { el: HTMLElement; outs: Map<string, HTMLElement>; ins: Map<string, HTMLElement> }>();

    for (const n of g.nodes) {
      const def = FROST_NODES[n.type];
      const b = el('div', 'rt-node frost' + (n.id === selected ? ' selected' : '') + (n.type === 'SetAttr' || n.type === 'SimulateParticles' ? ' material' : ''));
      b.style.left = n.x + 'px';
      b.style.top = n.y + 'px';
      const label = (n.type === 'GetAttr' || n.type === 'SetAttr')
        ? `${n.type}: ${n.params.name}`
        : n.type;
      const tt = el('div', 'rt-node-title', label);
      b.appendChild(tt);
      const keys = Object.keys(n.params).filter(k => k !== 'name').slice(0, 3);
      const vals = keys.map(k => {
        const v = n.params[k];
        return `${k}=${Array.isArray(v) ? '[' + v.map(x => Math.round(Number(x) * 100) / 100).join(',') + ']' : typeof v === 'number' ? Math.round(v * 100) / 100 : v}`;
      }).join(' ');
      if (vals) b.appendChild(el('div', 'rt-node-type', vals));

      const ins = new Map<string, HTMLElement>(), outs = new Map<string, HTMLElement>();
      for (const ip of def?.inputs ?? []) {
        const r = el('div', 'rt-port-row' + (g.links.some(l => l.to === n.id && l.toPort === ip.name) ? ' connected' : ''));
        const dot = el('div', 'rt-port in ' + ip.type);
        dot.title = `${ip.name} (${ip.type})`;
        r.append(dot, el('span', '', ip.name));
        b.appendChild(r);
        ins.set(ip.name, dot);
        dot.onclick = (e) => {
          e.stopPropagation();
          if (pending) { frost.connect(pending.node, pending.port, n.id, ip.name); pending = null; }
          else frost.disconnect(n.id, ip.name);
          app.events.emit('scene');
          render();
        };
      }
      for (const op of def?.outputs ?? []) {
        const r = el('div', 'rt-port-row right');
        const dot = el('div', 'rt-port outp ' + op.type);
        dot.title = `${op.name} (${op.type}) — click, then click an input`;
        r.append(el('span', '', op.name), dot);
        b.appendChild(r);
        outs.set(op.name, dot);
        dot.onclick = (e) => {
          e.stopPropagation();
          pending = pending && pending.node === n.id && pending.port === op.name ? null : { node: n.id, port: op.name };
          canvas.querySelectorAll('.rt-port.outp').forEach(o => o.classList.remove('pending'));
          if (pending) dot.classList.add('pending');
        };
      }

      b.onclick = () => { selected = n.id; render(); };
      b.oncontextmenu = (e) => {
        e.preventDefault();
        openSiMenu(
          [{ label: 'Delete' }, { label: 'Duplicate' }],
          e.clientX, e.clientY,
          (it) => {
            if (it.label === 'Delete') { frost.removeNode(n.id); app.events.emit('scene'); render(); }
            else if (it.label === 'Duplicate') {
              const d = frost.addNode(n.type, n.x + 30, n.y + 30);
              d.params = { ...n.params };
              render();
            }
          },
        );
      };

      let drag: { sx: number; sy: number; x: number; y: number } | null = null;
      tt.onpointerdown = (e) => { drag = { sx: e.clientX, sy: e.clientY, x: n.x, y: n.y }; tt.setPointerCapture(e.pointerId); };
      tt.onpointermove = (e) => {
        if (!drag) return;
        n.x = Math.max(0, drag.x + e.clientX - drag.sx);
        n.y = Math.max(0, drag.y + e.clientY - drag.sy);
        b.style.left = n.x + 'px';
        b.style.top = n.y + 'px';
        drawLinks();
      };
      tt.onpointerup = () => { drag = null; };

      canvas.appendChild(b);
      boxes.set(n.id, { el: b, outs, ins });
    }

    const drawLinks = () => {
      svg.innerHTML = '';
      const c = canvas.getBoundingClientRect();
      for (const l of g.links) {
        const a = boxes.get(l.from)?.outs.get(l.fromPort);
        const b2 = boxes.get(l.to)?.ins.get(l.toPort);
        if (!a || !b2) continue;
        const ra = a.getBoundingClientRect(), rb = b2.getBoundingClientRect();
        const x1 = ra.right - c.left + canvas.scrollLeft;
        const y1 = ra.top + ra.height / 2 - c.top + canvas.scrollTop;
        const x2 = rb.left - c.left + canvas.scrollLeft;
        const y2 = rb.top + rb.height / 2 - c.top + canvas.scrollTop;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`);
        path.setAttribute('class', 'rt-link frost');
        svg.appendChild(path);
      }
    };
    requestAnimationFrame(drawLinks);
  };

  const stats = el('div', 'frost-stats');
  root.appendChild(stats);
  const updStats = () => {
    stats.textContent = `Particles ${aliveCount(frost.state)} · frame ${app.anim.frame} · ${frost.graph.simulated ? 'simulated' : 'procedural'}`;
  };

  render();
  updStats();
  app.events.on('selection', render);
  app.events.on('scene', render);
  app.events.on('frame', () => { updStats(); });
  app.events.on('params', updStats);
  new ResizeObserver(render).observe(canvas);
}

/** Compact FROST toolbar content for the module panel when FROST is selected. */
export function frostToolbar(app: App, host: HTMLElement) {
  const frost = frostOf(app);
  host.innerHTML = '';
  const wrap = el('div', 'frost-tb');
  const mk = (label: string, title: string, fn: () => void) => {
    const b = el('button', 'tb-btn', label) as HTMLButtonElement;
    b.title = title;
    b.onclick = fn;
    return b;
  };
  wrap.append(
    el('div', 'tb-group', 'FROST'),
    mk('Graph Editor', 'Open FROST Graph view', () => window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'FROST Graph' } }))),
    mk('Emit→Simulate', 'Load default particle recipe', () => { frost.loadRecipe(); app.logMsg('info', 'FROST: loaded Emit→Simulate recipe'); }),
    mk('Reset Sim', 'Clear particles and re-evaluate', () => { frost.reset(); frost.tick(app.anim.frame); app.events.emit('scene'); }),
    mk('Export JSON', 'Download frost-graph IR', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([frost.toJSON()], { type: 'application/json' }));
      a.download = 'frost-graph.json';
      a.click();
    }),
  );
  const hint = el('div', 'frost-tb-hint', 'Play the timeline to advance particles in the viewport.');
  wrap.appendChild(hint);
  host.appendChild(wrap);
}
