// Property Editor (PPG): renders any ParamSet the way Softimage does — a tab per page, collapsible groups taken
// from the operator's real SPDL layout (opdefs.json), and per-row [animation dot][label][value field + slider].
import { App } from '../core/commands';
import { Node, X3DObject, GeomOperator, Shader, Material, Light } from '../core/scene';
import { TEXTURE_NODES } from '../core/shaders';
import type { FCurve } from '../core/animation';
import { Parameter, ParamSet } from '../core/params';
import type { LayoutNode } from '../core/opdefs';
import { applyPpgChrome, PPG_CHROME } from './ppgChrome';

export function propertyEditor(app: App, host: HTMLElement, target?: () => Node | undefined) {
  applyPpgChrome();
  const state = { locked: null as Node | null, recycle: true, history: [] as Node[], hi: -1 };
  const current = () => state.locked ?? (target ? target() : app.selection[app.selection.length - 1]);
  const root = document.createElement('div'); root.className = 'ppg';
  const title = document.createElement('div'); title.className = 'ppg-title';
  // Softimage uiut.dll InspNavCtrl / tools RT_BITMAP chrome (PE dump host dialog 147).
  const bar = document.createElement('div'); bar.className = 'ppg-bar';
  const nav = document.createElement('div'); nav.className = 'ppg-bmp nav'; nav.style.backgroundImage = `url(${PPG_CHROME.bitmaps.inspNav.public})`;
  const tools = document.createElement('div'); tools.className = 'ppg-bmp tools'; tools.style.backgroundImage = `url(${PPG_CHROME.bitmaps.tools.public})`;
  const hit = (host2: HTMLElement, x: number, w: number, h: number, top: number, t: string, fn: () => void, id?: string) => {
    const b = document.createElement('button'); b.className = 'bmp-hit'; if (id) b.dataset.hit = id;
    b.style.cssText = `left:${x}px;top:${top}px;width:${w}px;height:${h}px`; b.title = t; b.onclick = fn; host2.appendChild(b); return b;
  };
  const nh = Object.fromEntries(PPG_CHROME.bitmaps.inspNav.hit.map(h => [h.id, h]));
  const th = Object.fromEntries(PPG_CHROME.bitmaps.tools.hit.map(h => [h.id, h]));
  hit(nav, nh.up.x, nh.up.w, nh.up.h, nh.up.top, 'Up: inspect the parent (owner) of this node', () => { const n = current(); const par = n && ((n as any).parentObj ?? n.parent); if (par && par !== n && par.kind !== 'scene') { if (state.locked) state.locked = par; else app.select([par]); } }, 'up');
  hit(nav, nh.prev.x, nh.prev.w, nh.prev.h, nh.prev.top, 'Previous inspected node', () => go(-1), 'prev');
  hit(nav, nh.next.x, nh.next.w, nh.next.h, nh.next.top, 'Next inspected node', () => go(1), 'next');
  const lockB = hit(tools, th.lock.x, th.lock.w, th.lock.h, th.lock.top, 'Lock: keep this node in the editor when the selection changes', () => { state.locked = state.locked ? null : (current() ?? null); upd(); }, 'lock');
  const recB = hit(tools, th.recycle.x, th.recycle.w, th.recycle.h, th.recycle.top, 'Recycle: reuse this editor for the next inspected node (off: open a new window)', () => { state.recycle = !state.recycle; app.recyclePPG = state.recycle; upd(); }, 'recycle');
  hit(tools, th.help.x, th.help.w, th.help.h, th.help.top, 'Help for this property page', () => { const n = current(); window.open('https://help.autodesk.com/view/SI/2015/ENU/?query=' + encodeURIComponent(n?.type ?? n?.name ?? 'property'), '_blank'); }, 'help');
  const keyB = document.createElement('span'); keyB.className = 'ppg-ico'; keyB.textContent = 'K'; keyB.title = 'Key all animatable parameters of this page (right-click: remove keys)';
  keyB.onclick = () => { const ps = pageParams(); if (ps.length) app.run('SaveKey', { InputObjs: ps.map(p => p.fullName).join(',') }); }; keyB.oncontextmenu = (e) => { e.preventDefault(); for (const p of pageParams()) app.run('RemoveKey', { InputObjs: p.fullName }); };
  bar.append(nav, keyB, Object.assign(document.createElement('span'), { className: 'spacer' }), tools);
  const tabs = document.createElement('div'); tabs.className = 'ppg-tabs';
  const body = document.createElement('div'); body.className = 'ppg-body';
  root.append(title, bar, tabs, body); host.appendChild(root);
  let activeTab = '';
  const collapsed = new Set<string>();
  const go = (d: number) => { const i = state.hi + d; if (i < 0 || i >= state.history.length) return; state.hi = i; state.locked = state.history[i]; upd(); };

  type Page = { key: string; set: ParamSet; layout?: LayoutNode[]; kind?: 'geom-shape' | 'geom-geometry' | 'animation' };
  /** Split a ParamSet whose SPDL layout has top-level tabs into one page per tab (the Softimage property page tabs). */
  const tabbed = (name: string, set: ParamSet): Page[] => {
    const lay = set.layout as any[] | undefined;
    if (lay?.length && lay.every(n => n.tab !== undefined)) return lay.map(t => ({ key: t.tab || name, set, layout: t.items }));
    return [{ key: name, set, layout: lay as any }];
  };
  const shaderPages = (sh: Shader, prefix = ''): Page[] => { const out = tabbed(prefix + sh.name, sh); for (const [port, inp] of sh.inputs) out.push(...shaderPages(inp, `${inp.name} (${port}) › `)); return out; };
  const pages = (n: Node): Page[] => {
    const out: Page[] = [];
    if (n instanceof X3DObject) {
      for (const op of n.primitive ? [...n.primitive.operators].reverse() : []) {
        if (op instanceof GeomOperator) { if (op.shapeParams.length) out.push({ key: op.preset, set: op, kind: 'geom-shape' }); if (n.primitive!.params.length) out.push(...tabbed(n.primitive!.name, n.primitive!)); if (op.geometryParams.length) out.push({ key: 'Geometry', set: op, kind: 'geom-geometry' }); }
        else out.push({ key: op.name, set: op, layout: op.layout });
      }
      if (n.primitive && n.primitive.params.length && !n.primitive.operators.some(o => o instanceof GeomOperator)) out.push(...tabbed(n.primitive.name, n.primitive));
      if (n instanceof Light) out.push(...shaderPages(n.shader));
      out.push({ key: 'Kinematics', set: n.kinematics.local, layout: n.kinematics.local.layout });
      if (n.material?.surface && n.material !== app.scene.root.material) out.push(...shaderPages(n.material.surface));
      for (const p of n.properties) out.push(...tabbed(p.name, p));
    } else if (n instanceof Material) { out.push({ key: n.name, set: n }); if (n.surface) out.push(...shaderPages(n.surface)); }
    else if (n instanceof Shader) out.push(...shaderPages(n));
    else {
      if (n.layout) out.push(...tabbed(n.name, n));
      else { for (const [g] of n.groups()) out.push({ key: g, set: n }); if (!out.length) out.push({ key: n.name, set: n }); }
    }
    const anim = allParams(n).filter(p => app.anim.isAnimated(p) || app.anim.expression(p));
    if (anim.length) out.push({ key: 'Animation', set: n, kind: 'animation' });
    return out;
  };
  const allParams = (n: Node): Parameter[] => { const out: Parameter[] = []; const seen = new Set<ParamSet>(); for (const pg of pagesNoAnim(n)) { if (seen.has(pg.set)) continue; seen.add(pg.set); out.push(...pg.set.params); } return out; };
  const pagesNoAnim = (n: Node): Page[] => { const out: Page[] = []; if (n instanceof X3DObject) { if (n.primitive) out.push({ key: '', set: n.primitive }); for (const op of n.primitive?.operators ?? []) out.push({ key: '', set: op }); out.push({ key: '', set: n.kinematics.local }); for (const p of n.properties) out.push({ key: '', set: p }); if (n.material?.surface) out.push({ key: '', set: n.material.surface }); } else out.push({ key: '', set: n }); return out; };
  /** Multi-object editing: the same parameter on every other selected node that has it (Softimage edits all inspected objects at once). */
  const siblings = (p: Parameter): Parameter[] => {
    if (state.locked || target) return [p]; const sel = app.selection; if (sel.length < 2) return [p];
    const path = p.fullName.split('.').slice(1).join('.'); const out = [p];
    for (const n of sel) { if (n === current()) continue; const q = findByPath(n, path); if (q && q !== p && q.def.type === p.def.type) out.push(q); }
    return out;
  };
  const multiSet = (p: Parameter, v: any, label?: string) => { for (const q of siblings(p)) app.setParam(q, v, label); };
  let currentPage: Page | undefined;
  const pageParams = (): Parameter[] => { const pg = currentPage; if (!pg) return []; if (pg.kind === 'geom-shape') return (pg.set as GeomOperator).shapeParams; if (pg.kind === 'geom-geometry') return (pg.set as GeomOperator).geometryParams; return pg.set.params.filter(p => p.animatable); };

  const render = () => {
    const n = current();
    tabs.innerHTML = ''; body.innerHTML = '';
    if (!n) { title.textContent = 'Property Editor'; body.innerHTML = '<div class="ppg-empty">Select an object, property or operator to inspect.</div>'; return; }
    const obj = n instanceof X3DObject ? n : (n as any).parentObj ?? n.parent;
    // Softimage titles the editor "<parent> : <object> (General)" for objects and "<object> : <node>" for nested nodes.
    const multi = !state.locked && !target && app.selection.length > 1 ? ` [${app.selection.length} objects]` : '';
    title.textContent = (n instanceof X3DObject ? `${(n as any).parentObj?.name ?? 'Scene_Root'} : ${n.name} (General)` : (obj && obj !== n ? obj.name + ' : ' : '') + n.name) + multi;
    const pg = pages(n);
    if (!pg.some(p => p.key === activeTab)) activeTab = pg[0]?.key ?? '';
    for (const p of pg) { const t = document.createElement('div'); t.className = 'ppg-tab' + (p.key === activeTab ? ' active' : ''); t.textContent = p.key; t.onclick = () => { activeTab = p.key; render(); }; tabs.appendChild(t); }
    const page = pg.find(p => p.key === activeTab); if (!page) return; currentPage = page;
    const { key: k, set } = page;
    const nameRow = document.createElement('div'); nameRow.className = 'ppg-name'; nameRow.innerHTML = `<label>Name</label>`; const ni = document.createElement('input'); ni.type = 'text'; ni.value = set instanceof Shader ? set.name : n.name; ni.readOnly = !(n instanceof X3DObject || set instanceof Shader); ni.onchange = () => { if (n instanceof X3DObject) app.run('Rename', { InputObj: [n], Name: ni.value }); else if (set instanceof Shader) { const old = set.name; const nn = ni.value; app.record('Rename', () => { set.name = nn; }, () => { set.name = old; }); render(); } }; ni.onkeydown = e => e.stopPropagation(); nameRow.appendChild(ni); body.appendChild(nameRow);
    if (page.kind === 'animation') { renderAnimation(n); return; }
    if (page.kind === 'geom-shape' || page.kind === 'geom-geometry') {
      const g = set as GeomOperator; const ps = page.kind === 'geom-geometry' ? g.geometryParams : g.shapeParams; const box = group(page.kind === 'geom-geometry' ? 'Subdivisions' : k, k); for (const p of ps) box.body.appendChild(row(app, p, [], multiSet)); body.appendChild(box.el);
    } else if (page.layout && page.layout.length) renderLayout(page.layout, set, body, k);
    else {
      const params = n instanceof X3DObject || set.layout || set !== n ? set.params : (set.groups().get(k) ?? set.params);
      const groups = new Map<string, Parameter[]>();
      for (const p of params) { const g = n instanceof X3DObject || set !== n ? (p.def.group ?? k) : k; if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(p); }
      for (const [g, ps] of groups) { const box = group(g, k); for (const p of ps) if (p.name !== 'mute') box.body.appendChild(row(app, p, [], multiSet)); if (ps.some(p => p.name === 'mute')) body.appendChild(muteRow(app, ps.find(p => p.name === 'mute')!)); body.appendChild(box.el); }
    }
    if (set instanceof Shader && set.ports().length) renderPorts(set);
  };
  /** Texturable inputs of a shader page: what is plugged in, with connect / disconnect (the PPG's texture buttons). */
  const renderPorts = (sh: Shader) => {
    const box = group('Render Tree connections', sh.name);
    for (const port of sh.ports()) {
      const r = document.createElement('div'); r.className = 'ppg-row ppg-port'; const l = document.createElement('label'); l.textContent = sh.get(port)?.label ?? port;
      const sel = document.createElement('select'); const none = document.createElement('option'); none.value = ''; none.textContent = sh.inputs.has(port) ? `(disconnect ${sh.inputs.get(port)!.name})` : '— none —'; sel.appendChild(none);
      for (const name of Object.keys(TEXTURE_NODES)) { const o = document.createElement('option'); o.value = name; o.textContent = (sh.inputs.get(port)?.type === name ? '● ' : '') + name; sel.appendChild(o); }
      sel.onchange = () => { const v = sel.value; if (!v) app.run('DisconnectShader', { Shader: sh, Port: port }); else app.run('ConnectShaderNode', { Shader: sh, Port: port, Preset: v }); };
      const dot = document.createElement('div'); dot.className = 'anim-dot'; dot.style.visibility = 'hidden'; r.append(dot, l, sel); box.body.appendChild(r);
    }
    body.appendChild(box.el);
  };
  const renderAnimation = (n: Node) => {
    const box = group('Animated parameters', 'Animation'); const A = app.anim;
    for (const p of allParams(n)) {
      const fc = A.fcurve(p); const ex = A.expression(p); if (!(fc?.keys.length) && !ex) continue;
      const r = document.createElement('div'); r.className = 'ppg-row ppg-anim'; const dot = document.createElement('div'); dot.className = 'anim-dot' + dotState(app, p);
      dot.onclick = () => { if (fc?.hasKey(A.frame)) app.run('RemoveKey', { InputObjs: p.fullName }); else app.run('SaveKey', { InputObjs: p.fullName }); };
      const l = document.createElement('label'); l.textContent = p.label; l.title = p.fullName;
      const info = document.createElement('div'); info.className = 'ppg-anim-info';
      if (ex) info.textContent = `= ${ex}`; else { const cv = document.createElement('canvas'); cv.width = 160; cv.height = 22; drawCurve(cv, fc!, A.startFrame, A.endFrame, A.frame); info.appendChild(cv); const t = document.createElement('span'); t.textContent = ` ${fc!.keys.length} keys [${fc!.keys[0].time}–${fc!.keys[fc!.keys.length - 1].time}]`; info.appendChild(t); }
      const rm = document.createElement('button'); rm.className = 'xp-btn'; rm.textContent = '×'; rm.title = 'Remove animation'; rm.onclick = () => app.run('RemoveAnimation', { InputObjs: p.fullName });
      r.append(dot, l, info, rm); box.body.appendChild(r);
    }
    body.appendChild(box.el);
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
        if (nd.param) { if (nd.param === '__name' || nd.param === 'Name') continue; const p = set.params.find(x => x.name.toLowerCase() === nd.param!.toLowerCase()); if (p && p.name !== 'mute') { seen.add(p.name); host.appendChild(row(app, p, nd.opts, multiSet)); } }
        else if (nd.row) { const r = document.createElement('div'); r.className = 'ppg-hrow'; walk(nd.items ?? [], r); host.appendChild(r); }
        else { const g = group(nd.group ?? nd.tab ?? '', pageKey); walk(nd.items ?? [], g.body); if (g.body.childElementCount) host.appendChild(g.el); }
      }
    };
    walk(nodes, into);
    const rest = set.params.filter(p => !seen.has(p.name) && p.name !== 'mute' && !(set.layout as any[])?.some?.(() => false));
    const inOtherTab = (set.layout as any[] | undefined)?.every(t => t.tab !== undefined) ? new Set((set.layout as any[]).flatMap(t => collect(t.items ?? []))) : new Set<string>();
    const rest2 = rest.filter(p => !inOtherTab.has(p.name.toLowerCase()));
    if (rest2.length) { const g = group('Other', pageKey); for (const p of rest2) g.body.appendChild(row(app, p, [], multiSet)); into.appendChild(g.el); }
  };
  let lastKeys = '';
  const refresh = () => {
    const n = current();
    const keys = n ? pages(n).map(p => p.key).join('|') : '';
    if (keys !== lastKeys) { lastKeys = keys; render(); return; }
    body.querySelectorAll<HTMLElement>('[data-param]').forEach(el => { const p = (el as any)._param as Parameter; if (!p) return; const v = p.value; const input = el.querySelector<HTMLInputElement>('input.val'); if (input && document.activeElement !== input) input.value = fmtNum(v); const range = el.querySelector<HTMLInputElement>('input[type=range]'); if (range && typeof v === 'number') range.value = String(v); const cb = el.querySelector<HTMLInputElement>('input[type=checkbox]'); if (cb) cb.checked = !!v; const sel = el.querySelector<HTMLSelectElement>('select'); if (sel) sel.value = String(v); const dot = el.querySelector<HTMLElement>('.anim-dot'); if (dot) dot.className = 'anim-dot' + dotState(app, p); });
    if (currentPage?.kind === 'animation') render();
  };
  let lastNode: Node | undefined;
  const upd = () => { lockB.classList.toggle('on', !!state.locked); recB.classList.toggle('on', state.recycle); renderSel(); };
  const renderSel = () => { const n = current(); if (n !== lastNode) { activeTab = ''; lastNode = n; if (n && state.history[state.hi] !== n) { state.history = state.history.slice(0, state.hi + 1); state.history.push(n); state.hi = state.history.length - 1; } } lastKeys = n ? pages(n).map(p => p.key).join('|') : ''; render(); };
  upd();
  app.events.on('selection', renderSel); app.events.on('scene', refresh); app.events.on('params', refresh); app.events.on('frame', refresh);
  return { lock: (n: Node | null) => { state.locked = n; upd(); }, state };
}
function collect(ns: any[]): string[] { return ns.flatMap(n => n.param ? [String(n.param).toLowerCase()] : collect(n.items ?? [])); }
function findByPath(n: Node, path: string): Parameter | undefined {
  const parts = path.split('.'); const pname = parts[parts.length - 1]; const mid = parts.slice(0, -1).join('.');
  if (n instanceof X3DObject) { if (mid === 'kine.local') return n.kinematics.local.get(pname); if (mid === 'kine.global') return n.kinematics.global.get(pname); for (const pr of n.properties) if (pr.type === mid || pr.name === mid) return pr.get(pname); if (n.primitive && (mid === n.primitive.name || mid === n.primitive.type)) return n.primitive.get(pname); for (const op of n.primitive?.operators ?? []) if (op.name === mid || op.type === mid) return op.get(pname); if (n.material?.surface && mid.endsWith(n.material.surface.name)) return n.material.surface.get(pname); return undefined; }
  return n.get(pname);
}
function drawCurve(cv: HTMLCanvasElement, fc: FCurve, s: number, e: number, cur: number) {
  const g = cv.getContext('2d')!; const w = cv.width, h = cv.height; g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, w, h);
  const vals: number[] = []; for (let i = 0; i < w; i++) vals.push(fc.eval(s + (i / (w - 1)) * (e - s))); const lo = Math.min(...vals), hi = Math.max(...vals); const sp = hi - lo || 1;
  g.strokeStyle = '#ffd34d'; g.beginPath(); vals.forEach((v, i) => { const y = h - 2 - ((v - lo) / sp) * (h - 4); if (i) g.lineTo(i, y); else g.moveTo(i, y); }); g.stroke();
  g.fillStyle = '#ff5a5a'; for (const k of fc.keys) { const x = ((k.time - s) / Math.max(1, e - s)) * (w - 1); g.fillRect(x - 1.5, h - 2 - ((k.value - lo) / sp) * (h - 4) - 1.5, 3, 3); }
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(((cur - s) / Math.max(1, e - s)) * (w - 1), 0, 1, h);
}

function muteRow(app: App, p: Parameter) { const r = document.createElement('div'); r.className = 'ppg-mute'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!p.value; cb.onchange = () => app.setParam(p, cb.checked); const l = document.createElement('label'); l.textContent = 'Mute'; r.append(cb, l); return r; }
function dotState(app: App, p: Parameter) { const fc = app.anim.fcurve(p); if (!fc || !fc.keys.length) return ''; return fc.hasKey(app.anim.frame) ? ' keyed' : ' animated'; }
function fmtNum(v: any) { return typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v); }

function row(app: App, p: Parameter, opts: string[] = [], setter?: (p: Parameter, v: any, label?: string) => void): HTMLElement {
  const setP = (v: any, label?: string) => setter ? setter(p, v, label) : app.setParam(p, v, label);
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
    input.onchange = () => setP(Number(input.value));
    input.onkeydown = (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const step = (d.type === 'int' ? 1 : (e.shiftKey ? 1 : 0.1)) * (e.key === 'ArrowUp' ? 1 : -1); setP(Number(input.value) + step); } };
    const range = document.createElement('input'); range.type = 'range';
    const min = d.uimin ?? d.min ?? (d.type === 'int' ? 0 : -100), max = d.uimax ?? d.max ?? (d.type === 'int' ? 64 : 100);
    range.min = String(min); range.max = String(max); range.step = d.type === 'int' ? '1' : String((max - min) / 1000); range.value = String(p.value); range.disabled = !!d.readOnly;
    let start: any; range.onpointerdown = () => { start = p.value; };
    range.oninput = () => { p.value = Number(range.value); input.value = fmtNum(p.value); app.events.emit('scene'); };
    range.onchange = () => { const v = Number(range.value); p.value = start; setP(v); };
    wrap.append(input, range); ctl = wrap;
  } else if (d.type === 'bool') {
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!p.value; cb.disabled = !!d.readOnly; cb.onchange = () => setP(cb.checked); ctl = cb; r.classList.add('is-check');
  } else if (d.type === 'enum') {
    const s = document.createElement('select'); for (const it of d.items ?? []) { const o = document.createElement('option'); o.value = String(it.value); o.textContent = it.label; s.appendChild(o); } s.value = String(p.value); s.disabled = !!d.readOnly;
    s.onchange = () => { const it = d.items!.find(i => String(i.value) === s.value); setP(it ? it.value : s.value); }; ctl = s;
  } else if (d.type === 'color') {
    const c = document.createElement('input'); c.type = 'color'; c.value = rgbHex(p.value); c.onchange = () => setP(hexRgb(c.value)); ctl = c;
  } else {
    const t = document.createElement('input'); t.type = 'text'; t.value = String(p.value ?? ''); t.disabled = !!d.readOnly; t.onchange = () => setP(t.value); ctl = t;
  }
  if (opts.includes('AlignRight')) r.classList.add('align-right');
  r.append(dot, label, ctl);
  return r;
}

export function rgbHex(v: number[]) { return '#' + v.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join(''); }
export function hexRgb(h: string): [number, number, number] { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
