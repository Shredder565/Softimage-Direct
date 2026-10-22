// Property Editor (PPG): renders any ParamSet the way Softimage does — a tab per page, collapsible groups taken
// from the operator's real SPDL layout (opdefs.json), and per-row [animation dot][label][value field + slider].
import { App } from '../core/commands';
import { Node, X3DObject, GeomOperator } from '../core/scene';
import { Parameter, ParamSet } from '../core/params';
import type { LayoutNode } from '../core/opdefs';

export function propertyEditor(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'ppg';
  const title = document.createElement('div'); title.className = 'ppg-title';
  const bar = document.createElement('div'); bar.className = 'ppg-bar';
  bar.innerHTML = '<span class="ppg-ico" title="Lock">🔒</span><span class="ppg-ico" title="Previous">◀</span><span class="ppg-ico" title="Next">▶</span><span class="spacer"></span><span class="ppg-ico" title="Recycle">↻</span><span class="ppg-ico" title="Help">?</span>';
  const tabs = document.createElement('div'); tabs.className = 'ppg-tabs';
  const body = document.createElement('div'); body.className = 'ppg-body';
  root.append(title, bar, tabs, body); host.appendChild(root);
  let activeTab = '';
  const collapsed = new Set<string>();

  const pages = (n: Node): [string, ParamSet][] => {
    const out: [string, ParamSet][] = [];
    if (n instanceof X3DObject) {
      for (const op of n.primitive ? [...n.primitive.operators].reverse() : []) {
        if (op instanceof GeomOperator) { if (op.shapeParams.length) out.push([op.preset, op]); if (n.primitive!.params.length) out.push([n.primitive!.name, n.primitive!]); if (op.geometryParams.length) out.push(['Geometry', op]); }
        else out.push([op.name, op]);
      }
      if (n.primitive && n.primitive.params.length && !n.primitive.operators.some(o => o instanceof GeomOperator)) out.push([n.primitive.name, n.primitive]);
      out.push(['Kinematics', n.kinematics.local]);
      if (n.material?.surface) out.push([n.material.surface.name, n.material.surface]);
      for (const p of n.properties) out.push([p.name, p]);
    } else {
      if (n.layout) out.push([n.name, n]);
      else { for (const [g] of n.groups()) out.push([g, n]); if (!out.length) out.push([n.name, n]); }
    }
    return out;
  };

  const render = () => {
    const n = app.selection[app.selection.length - 1];
    tabs.innerHTML = ''; body.innerHTML = '';
    if (!n) { title.textContent = 'Property Editor'; body.innerHTML = '<div class="ppg-empty">Select an object, property or operator to inspect.</div>'; return; }
    const obj = n instanceof X3DObject ? n : (n as any).parentObj ?? n.parent;
    title.textContent = (obj && obj !== n ? obj.fullName + ' : ' : '') + (n instanceof X3DObject ? n.fullName + ' (General)' : n.name);
    const pg = pages(n);
    if (!pg.some(([k]) => k === activeTab)) activeTab = pg[0]?.[0] ?? '';
    for (const [k] of pg) { const t = document.createElement('div'); t.className = 'ppg-tab' + (k === activeTab ? ' active' : ''); t.textContent = k; t.onclick = () => { activeTab = k; render(); }; tabs.appendChild(t); }
    const page = pg.find(([k]) => k === activeTab); if (!page) return;
    const [k, set] = page;
    if (n instanceof X3DObject && set === pg[pg.length - 1]?.[1] && false) { /* placeholder */ }
    const nameRow = document.createElement('div'); nameRow.className = 'ppg-name'; nameRow.innerHTML = `<label>Name</label>`; const ni = document.createElement('input'); ni.type = 'text'; ni.value = n.name; ni.readOnly = !(n instanceof X3DObject); ni.onchange = () => { if (n instanceof X3DObject) app.run('Rename', { InputObj: [n], Name: ni.value }); }; nameRow.appendChild(ni); body.appendChild(nameRow);
    if (set instanceof GeomOperator) {
      const ps = k === 'Geometry' ? set.geometryParams : set.shapeParams; const g = group(k === 'Geometry' ? 'Subdivisions' : k, k); for (const p of ps) g.body.appendChild(row(app, p)); body.appendChild(g.el);
    } else if (set.layout && set.layout.length) renderLayout(set.layout, set, body, k);
    else {
      const params = n instanceof X3DObject || set.layout ? set.params : (set.groups().get(k) ?? set.params);
      const groups = new Map<string, Parameter[]>();
      for (const p of params) { const g = n instanceof X3DObject ? (p.def.group ?? k) : k; if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(p); }
      for (const [g, ps] of groups) { const box = group(g, k); for (const p of ps) if (p.name !== 'mute') box.body.appendChild(row(app, p)); if (ps.some(p => p.name === 'mute')) body.appendChild(muteRow(app, ps.find(p => p.name === 'mute')!)); body.appendChild(box.el); }
    }
  };
  const group = (name: string, pageKey: string) => {
    const el = document.createElement('div'); el.className = 'ppg-group'; const key = pageKey + '/' + name;
    const head = document.createElement('div'); head.className = 'ppg-group-head'; head.innerHTML = `<span class="tri">${collapsed.has(key) ? '▸' : '▾'}</span><span>${name}</span><span class="spacer"></span><span class="ppg-group-pin">⇪</span>`;
    const bodyEl = document.createElement('div'); bodyEl.className = 'ppg-group-body'; if (collapsed.has(key)) bodyEl.style.display = 'none';
    head.onclick = () => { if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key); render(); };
    el.append(head, bodyEl); return { el, body: bodyEl };
  };
  const renderLayout = (nodes: LayoutNode[], set: ParamSet, into: HTMLElement, pageKey: string) => {
    const mute = set.get('mute'); if (mute && into === body) into.appendChild(muteRow(app, mute));
    const seen = new Set<string>();
    const walk = (ns: LayoutNode[], host: HTMLElement) => {
      for (const nd of ns) {
        if (nd.param) { const p = set.params.find(x => x.name.toLowerCase() === nd.param!.toLowerCase()); if (p && p.name !== 'mute') { seen.add(p.name); host.appendChild(row(app, p, nd.opts)); } }
        else if (nd.row) { const r = document.createElement('div'); r.className = 'ppg-hrow'; walk(nd.items ?? [], r); host.appendChild(r); }
        else { const g = group(nd.group ?? nd.tab ?? '', pageKey); walk(nd.items ?? [], g.body); host.appendChild(g.el); }
      }
    };
    walk(nodes, into);
    const rest = set.params.filter(p => !seen.has(p.name) && p.name !== 'mute');
    if (rest.length) { const g = group('Other', pageKey); for (const p of rest) g.body.appendChild(row(app, p)); into.appendChild(g.el); }
  };
  let lastKeys = '';
  const refresh = () => {
    const n = app.selection[app.selection.length - 1];
    const keys = n ? pages(n).map(([k]) => k).join('|') : '';
    if (keys !== lastKeys) { lastKeys = keys; render(); return; }
    body.querySelectorAll<HTMLElement>('[data-param]').forEach(el => { const p = (el as any)._param as Parameter; if (!p) return; const v = p.value; const input = el.querySelector<HTMLInputElement>('input.val'); if (input && document.activeElement !== input) input.value = fmtNum(v); const r = el.querySelector<HTMLInputElement>('input[type=range]'); if (r && document.activeElement !== r) r.value = String(v); const sel = el.querySelector<HTMLSelectElement>('select'); if (sel) sel.value = String(v); const cb = el.querySelector<HTMLInputElement>('input[type=checkbox]'); if (cb) cb.checked = !!v; const dot = el.querySelector<HTMLElement>('.anim-dot'); if (dot) dot.className = 'anim-dot' + dotState(app, p); });
  };
  let lastNode: Node | undefined;
  const renderSel = () => { const n = app.selection[app.selection.length - 1]; if (n !== lastNode) { activeTab = ''; lastNode = n; } lastKeys = n ? pages(n).map(([k]) => k).join('|') : ''; render(); };
  renderSel();
  app.events.on('selection', renderSel); app.events.on('scene', refresh); app.events.on('params', refresh); app.events.on('frame', refresh);
}

function muteRow(app: App, p: Parameter) { const r = document.createElement('div'); r.className = 'ppg-mute'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!p.value; cb.onchange = () => app.setParam(p, cb.checked); const l = document.createElement('label'); l.textContent = 'Mute'; r.append(cb, l); return r; }
function dotState(app: App, p: Parameter) { const fc = app.anim.fcurve(p); if (!fc || !fc.keys.length) return ''; return fc.hasKey(app.anim.frame) ? ' keyed' : ' animated'; }
function fmtNum(v: any) { return typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v); }

function row(app: App, p: Parameter, opts: string[] = []): HTMLElement {
  const r = document.createElement('div'); r.className = 'ppg-row'; r.dataset.param = p.name; (r as any)._param = p;
  const dot = document.createElement('div'); dot.className = 'anim-dot' + dotState(app, p); dot.title = p.animatable ? 'Click: set key · Ctrl-click: remove animation' : '';
  if (!p.animatable) dot.style.visibility = 'hidden';
  dot.onclick = (e) => { if (e.ctrlKey) app.run('RemoveAnimation', { InputObjs: p.fullName }); else if (app.anim.fcurve(p)?.hasKey(app.anim.frame)) app.run('RemoveKey', { InputObjs: p.fullName }); else app.run('SaveKey', { InputObjs: p.fullName }); };
  const label = document.createElement('label'); label.textContent = p.label; label.title = p.def.desc ? `${p.fullName} — ${p.def.desc}` : p.fullName;
  let ctl: HTMLElement;
  const d = p.def;
  if (d.type === 'double' || d.type === 'int') {
    const wrap = document.createElement('div'); wrap.className = 'ppg-num';
    const input = document.createElement('input'); input.type = 'text'; input.className = 'val'; input.value = fmtNum(p.value); input.disabled = !!d.readOnly;
    input.onchange = () => app.setParam(p, Number(input.value));
    input.onkeydown = (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const step = (d.type === 'int' ? 1 : (e.shiftKey ? 1 : 0.1)) * (e.key === 'ArrowUp' ? 1 : -1); app.setParam(p, Number(input.value) + step); } };
    const range = document.createElement('input'); range.type = 'range';
    const min = d.uimin ?? d.min ?? (d.type === 'int' ? 0 : -100), max = d.uimax ?? d.max ?? (d.type === 'int' ? 64 : 100);
    range.min = String(min); range.max = String(max); range.step = d.type === 'int' ? '1' : String((max - min) / 1000); range.value = String(p.value); range.disabled = !!d.readOnly;
    let start: any; range.onpointerdown = () => { start = p.value; };
    range.oninput = () => { p.value = Number(range.value); input.value = fmtNum(p.value); app.events.emit('scene'); };
    range.onchange = () => { const v = Number(range.value); p.value = start; app.setParam(p, v); };
    wrap.append(input, range); ctl = wrap;
  } else if (d.type === 'bool') {
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!p.value; cb.disabled = !!d.readOnly; cb.onchange = () => app.setParam(p, cb.checked); ctl = cb; r.classList.add('is-check');
  } else if (d.type === 'enum') {
    const s = document.createElement('select'); for (const it of d.items ?? []) { const o = document.createElement('option'); o.value = String(it.value); o.textContent = it.label; s.appendChild(o); } s.value = String(p.value); s.disabled = !!d.readOnly;
    s.onchange = () => { const it = d.items!.find(i => String(i.value) === s.value); app.setParam(p, it ? it.value : s.value); }; ctl = s;
  } else if (d.type === 'color') {
    const c = document.createElement('input'); c.type = 'color'; c.value = rgbHex(p.value); c.onchange = () => app.setParam(p, hexRgb(c.value)); ctl = c;
  } else {
    const t = document.createElement('input'); t.type = 'text'; t.value = String(p.value ?? ''); t.disabled = !!d.readOnly; t.onchange = () => app.setParam(p, t.value); ctl = t;
  }
  if (opts.includes('AlignRight')) r.classList.add('align-right');
  r.append(dot, label, ctl);
  return r;
}

export function rgbHex(v: number[]) { return '#' + v.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join(''); }
export function hexRgb(h: string): [number, number, number] { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
