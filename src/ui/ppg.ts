// Property Editor (PPG): renders any ParamSet generically — groups become tabs, each parameter gets a
// control by type, and the animation dot on the left keys / shows animation state like Softimage.
import { App } from '../core/commands';
import { Node, X3DObject } from '../core/scene';
import { Parameter, ParamSet } from '../core/params';

export function propertyEditor(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'ppg';
  const title = document.createElement('div'); title.className = 'ppg-title';
  const tabs = document.createElement('div'); tabs.className = 'ppg-tabs';
  const body = document.createElement('div'); body.className = 'ppg-body';
  root.append(title, tabs, body); host.appendChild(root);
  let activeTab = '';
  let current: ParamSet | null = null;

  const pages = (n: Node): [string, ParamSet][] => {
    const out: [string, ParamSet][] = [];
    if (n instanceof X3DObject) {
      for (const op of n.primitive ? [...n.primitive.operators].reverse() : []) out.push([op.name, op]);
      if (n.primitive && n.primitive.params.length) out.push([n.primitive.name, n.primitive]);
      out.push(['Kinematics', n.kinematics.local]);
      if (n.material?.surface) out.push([n.material.surface.name, n.material.surface]);
      for (const p of n.properties) out.push([p.name, p]);
    } else {
      for (const [g] of n.groups()) out.push([g, n]);
      if (!out.length) out.push([n.name, n]);
    }
    return out;
  };

  const render = () => {
    const n = app.selection[app.selection.length - 1];
    tabs.innerHTML = ''; body.innerHTML = '';
    if (!n) { title.textContent = 'Property Editor'; body.innerHTML = '<div class="ppg-empty">Select an object, property or operator to inspect.</div>'; current = null; return; }
    title.textContent = n.fullName;
    const pg = pages(n);
    if (!pg.some(([k]) => k === activeTab)) activeTab = pg[0]?.[0] ?? '';
    for (const [k] of pg) { const t = document.createElement('div'); t.className = 'ppg-tab' + (k === activeTab ? ' active' : ''); t.textContent = k; t.onclick = () => { activeTab = k; render(); }; tabs.appendChild(t); }
    const page = pg.find(([k]) => k === activeTab); if (!page) return;
    const [k, set] = page; current = set;
    const params = n instanceof X3DObject ? set.params : (set.groups().get(k) ?? set.params);
    for (const p of params) body.appendChild(row(app, p));
  };
  let lastKeys = '';
  const refresh = () => { // update values in place without rebuilding (keeps focus); rebuild if the page list changed
    const n = app.selection[app.selection.length - 1];
    const keys = n ? pages(n).map(([k]) => k).join('|') : '';
    if (keys !== lastKeys) { lastKeys = keys; render(); return; }
    body.querySelectorAll<HTMLElement>('[data-param]').forEach(el => { const p = (el as any)._param as Parameter; if (!p) return; const v = p.value; const input = el.querySelector<HTMLInputElement>('input.val'); if (input && document.activeElement !== input) input.value = fmtNum(v); const r = el.querySelector<HTMLInputElement>('input[type=range]'); if (r && document.activeElement !== r) r.value = String(v); const sel = el.querySelector<HTMLSelectElement>('select'); if (sel) sel.value = String(v); const cb = el.querySelector<HTMLInputElement>('input[type=checkbox]'); if (cb) cb.checked = !!v; const dot = el.querySelector<HTMLElement>('.anim-dot'); if (dot) dot.className = 'anim-dot' + dotState(app, p); });
  };
  const renderSel = () => { const n = app.selection[app.selection.length - 1]; lastKeys = n ? pages(n).map(([k]) => k).join('|') : ''; render(); };
  renderSel();
  app.events.on('selection', renderSel); app.events.on('scene', refresh); app.events.on('params', refresh); app.events.on('frame', refresh);
}

function dotState(app: App, p: Parameter) { const fc = app.anim.fcurve(p); if (!fc || !fc.keys.length) return ''; return fc.hasKey(app.anim.frame) ? ' keyed' : ' animated'; }
function fmtNum(v: any) { return typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v); }

function row(app: App, p: Parameter): HTMLElement {
  const r = document.createElement('div'); r.className = 'ppg-row'; r.dataset.param = p.name; (r as any)._param = p;
  const dot = document.createElement('div'); dot.className = 'anim-dot' + dotState(app, p); dot.title = p.animatable ? 'Click: set key · Ctrl-click: remove animation' : '';
  if (!p.animatable) dot.style.visibility = 'hidden';
  dot.onclick = (e) => { if (e.ctrlKey) app.run('RemoveAnimation', { InputObjs: p.fullName }); else if (app.anim.fcurve(p)?.hasKey(app.anim.frame)) app.run('RemoveKey', { InputObjs: p.fullName }); else app.run('SaveKey', { InputObjs: p.fullName }); };
  const label = document.createElement('label'); label.textContent = p.label; label.title = p.fullName;
  let ctl: HTMLElement;
  const d = p.def;
  if (d.type === 'double' || d.type === 'int') {
    const wrap = document.createElement('div'); wrap.className = 'ppg-num';
    const input = document.createElement('input'); input.type = 'number'; input.className = 'val'; input.step = d.type === 'int' ? '1' : String(d.step ?? 0.1); input.value = fmtNum(p.value); input.disabled = !!d.readOnly;
    input.onchange = () => app.setParam(p, Number(input.value));
    const range = document.createElement('input'); range.type = 'range';
    const min = d.min ?? (d.type === 'int' ? 0 : -100), max = d.max ?? (d.type === 'int' ? 64 : 100);
    range.min = String(min); range.max = String(max); range.step = d.type === 'int' ? '1' : String((max - min) / 400); range.value = String(p.value); range.disabled = !!d.readOnly;
    let start: any; range.onpointerdown = () => { start = p.value; };
    range.oninput = () => { p.value = Number(range.value); input.value = fmtNum(p.value); app.events.emit('scene'); };
    range.onchange = () => { const v = Number(range.value); p.value = start; app.setParam(p, v); };
    wrap.append(input, range); ctl = wrap;
  } else if (d.type === 'bool') {
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!p.value; cb.disabled = !!d.readOnly; cb.onchange = () => app.setParam(p, cb.checked); ctl = cb;
  } else if (d.type === 'enum') {
    const s = document.createElement('select'); for (const it of d.items ?? []) { const o = document.createElement('option'); o.value = String(it.value); o.textContent = it.label; s.appendChild(o); } s.value = String(p.value); s.disabled = !!d.readOnly;
    s.onchange = () => { const it = d.items!.find(i => String(i.value) === s.value); app.setParam(p, it ? it.value : s.value); }; ctl = s;
  } else if (d.type === 'color') {
    const c = document.createElement('input'); c.type = 'color'; c.value = rgbHex(p.value); c.onchange = () => app.setParam(p, hexRgb(c.value)); ctl = c;
  } else {
    const t = document.createElement('input'); t.type = 'text'; t.value = String(p.value ?? ''); t.disabled = !!d.readOnly; t.onchange = () => app.setParam(p, t.value); ctl = t;
  }
  r.append(dot, label, ctl);
  // order: label, control, dot (dot on the right like Softimage's animation icon column is on the left; keep left)
  r.style.gridTemplateColumns = '18px 110px 1fr'; r.prepend(dot);
  return r;
}

export function rgbHex(v: number[]) { return '#' + v.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join(''); }
export function hexRgb(h: string): [number, number, number] { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
