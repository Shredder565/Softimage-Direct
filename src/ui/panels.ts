// MCP (Selection / Transformation / Snap / Edit), Keying Panel, Layer Control, Timeline, Timerange,
// Playback Panel, Animation Panel, Panel Switcher, Command Line, Script Log.
import { App } from '../core/commands';
import { tool } from './viewManager';
import { X3DObject } from '../core/scene';
import { findParam } from '../commands';

const btn = (label: string, fn: () => void, title = '') => { const b = document.createElement('button'); b.textContent = label; b.title = title; b.onclick = fn; return b; };
const row = (...els: HTMLElement[]) => { const r = document.createElement('div'); r.className = 'mcp-row'; r.append(...els); return r; };
const panel = (title: string) => { const p = document.createElement('div'); p.className = 'mcp-panel'; const t = document.createElement('div'); t.className = 'mcp-title'; t.textContent = title; p.appendChild(t); return p; };

// Selection / Transformation / Snap / Edit panels now live in mcp.ts (the Main Command Panel).
export function keyingPanel(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'kp';
  host.appendChild(root);
  const render = () => {
    root.innerHTML = '';
    const t = document.createElement('div'); t.className = 'mcp-title'; t.textContent = 'Keying Panel'; root.appendChild(t);
    const objs = app.selectedObjects;
    if (!objs.length) { root.insertAdjacentHTML('beforeend', '<div class="ppg-empty">Select an object to see its keyable parameters.</div>'); return; }
    for (const o of objs) {
      const h = document.createElement('div'); h.style.cssText = 'color:#ffd34d;margin:4px 0 2px'; h.textContent = o.name; root.appendChild(h);
      for (const p of o.kinematics.local.params.filter(p => p.keyable)) {
        const r = document.createElement('div'); r.className = 'kp-row';
        const dot = document.createElement('div'); const fc = app.anim.fcurve(p); dot.className = 'anim-dot' + (fc?.keys.length ? (fc.hasKey(app.anim.frame) ? ' keyed' : ' animated') : '');
        dot.onclick = () => app.run(fc?.hasKey(app.anim.frame) ? 'RemoveKey' : 'SaveKey', { InputObjs: p.fullName });
        const nm = document.createElement('span'); nm.className = 'nm' + (app.anim.marked.has(p) ? ' marked' : ''); nm.textContent = p.label; nm.title = 'Click to mark / unmark (Shift: add)'; nm.onclick = (e) => { if (!e.shiftKey && !app.anim.marked.has(p)) app.anim.marked.clear(); if (app.anim.marked.has(p)) app.anim.marked.delete(p); else app.anim.marked.add(p); app.events.emit('params'); };
        const i = document.createElement('input'); i.type = 'number'; i.step = '0.1'; i.value = String(Math.round(p.value * 1000) / 1000); i.onchange = () => app.setParam(p, Number(i.value));
        r.append(dot, nm, i); root.appendChild(r);
      }
    }
  };
  render(); app.events.on('selection', render); app.events.on('params', render); app.events.on('frame', render);
}

export function layerControl(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'kp layers'; host.appendChild(root);
  const render = () => {
    root.innerHTML = '<div class="mcp-title">Scene Layers</div>';
    const tbl = document.createElement('table'); tbl.innerHTML = '<tr><th>Name</th><th>V</th><th>R</th><th>S</th><th></th></tr>';
    for (const l of app.scene.layers) {
      const tr = document.createElement('tr');
      const c = l.val('color'); tr.innerHTML = `<td><span class="sw" style="background:rgb(${c.map((x: number) => x * 255).join(',')})"></span> ${l.name} (${l.members.size})</td>`;
      for (const k of ['viewvis', 'rendvis', 'selectability']) { const td = document.createElement('td'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = l.val(k); cb.onchange = () => { app.setParam(l.get(k)!, cb.checked); for (const o of l.members) if (k === 'viewvis') app.setParam(o.property('visibility')!.get('viewvis')!, cb.checked); }; td.appendChild(cb); tr.appendChild(td); }
      const td = document.createElement('td'); td.appendChild(btn('+sel', () => { for (const o of app.selectedObjects) { o.layer?.members.delete(o); o.layer = l; l.members.add(o); } app.events.emit('scene'); })); tr.appendChild(td);
      tbl.appendChild(tr);
    }
    root.appendChild(tbl);
    root.appendChild(btn('New Layer', () => app.run('CreateLayer', { Name: 'Layer', InputObjs: app.selectedObjects })));
  };
  render(); app.events.on('scene', render);
}

export function timeline(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'timeline'; const cv = document.createElement('canvas'); root.appendChild(cv); host.appendChild(root);
  const draw = () => {
    const w = root.clientWidth, h = root.clientHeight; if (!w) return; cv.width = w * devicePixelRatio; cv.height = h * devicePixelRatio;
    const g = cv.getContext('2d')!; g.scale(devicePixelRatio, devicePixelRatio); g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, w, h);
    const a = app.anim, s = a.startFrame, e = a.endFrame, span = Math.max(1, e - s);
    const X = (f: number) => ((f - s) / span) * (w - 20) + 10;
    g.strokeStyle = '#666'; g.fillStyle = '#ccc'; g.font = '9px Tahoma';
    const step = span > 200 ? 50 : span > 60 ? 10 : 5;
    for (let f = s; f <= e; f += 1) { const x = X(f); if (f % step === 0) { g.beginPath(); g.moveTo(x, h); g.lineTo(x, h - 8); g.stroke(); g.fillText(String(f), x + 2, 9); } else if (span < 150) { g.beginPath(); g.moveTo(x, h); g.lineTo(x, h - 3); g.stroke(); } }
    // keys of the selection
    g.fillStyle = '#ff5a5a';
    for (const n of app.selection) { const ps = n instanceof X3DObject ? n.kinematics.local.params : n.params; for (const p of ps) { const fc = a.fcurve(p); if (!fc) continue; for (const k of fc.keys) g.fillRect(X(k.time) - 2, h / 2 - 4, 4, 8); } }
    g.fillStyle = '#ffd34d'; g.fillRect(X(a.frame) - 1, 0, 2, h); g.fillText(String(a.frame), X(a.frame) + 3, h - 2);
  };
  const toFrame = (e: PointerEvent) => { const r = root.getBoundingClientRect(); const a = app.anim; const f = Math.round(a.startFrame + ((e.clientX - r.left - 10) / (r.width - 20)) * (a.endFrame - a.startFrame)); app.anim.frame = Math.max(a.startFrame, Math.min(a.endFrame, f)); };
  let scrub = false; root.onpointerdown = (e) => { scrub = true; root.setPointerCapture(e.pointerId); toFrame(e); }; root.onpointermove = (e) => { if (scrub) toFrame(e); }; root.onpointerup = () => { scrub = false; };
  new ResizeObserver(draw).observe(root); draw();
  app.events.on('frame', draw); app.events.on('selection', draw); app.events.on('params', draw); app.events.on('scene', draw);
}

export function timerange(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'timerange';
  const s = document.createElement('input'); s.type = 'number'; const e = document.createElement('input'); e.type = 'number';
  const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('div'); bar.appendChild(fill);
  root.append(s, bar, e); host.appendChild(root);
  s.onchange = () => app.run('SetPlayRange', { Start: Number(s.value), End: app.anim.endFrame }); e.onchange = () => app.run('SetPlayRange', { Start: app.anim.startFrame, End: Number(e.value) });
  const upd = () => { s.value = String(app.anim.startFrame); e.value = String(app.anim.endFrame); fill.style.left = '0'; fill.style.right = '0'; };
  upd(); app.events.on('frame', upd);
}

export function playbackPanel(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'bottom';
  const frame = document.createElement('input'); frame.className = 'frame-field'; frame.onchange = () => app.run('SetCurrentFrame', { Frame: Number(frame.value) });
  const play = btn('▶', () => app.run('PlayForwards'), 'Play'), stop = btn('■', () => app.run('PlaybackStop'), 'Stop');
  root.append(btn('|◀', () => app.run('FirstFrame')), btn('◀', () => app.run('PrevFrame')), frame, btn('▶|', () => app.run('NextFrame')), btn('▶▶|', () => app.run('LastFrame')), play, stop);
  const loop = btn('Loop', () => { loop.classList.toggle('on'); }); loop.classList.add('on'); root.append(loop);
  host.appendChild(root);
  const upd = () => { frame.value = String(app.anim.frame); play.classList.toggle('on', app.anim.playing); };
  upd(); app.events.on('frame', upd);
}

export function animationPanel(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'bottom';
  const key = btn('K', () => app.run('SaveKey'), 'Set key on keyable parameters (K)');
  const autokey = btn('Auto', () => { app.autoKey = !app.autoKey; autokey.classList.toggle('on', app.autoKey); }, 'Auto-key: key any changed animated parameter');
  const rm = btn('Del Key', () => app.run('RemoveKey')), rma = btn('Del Anim', () => app.run('RemoveAnimation'));
  const prev = btn('◁K', () => { const t = keyTimes(app).filter(t => t < app.anim.frame).pop(); if (t !== undefined) app.anim.frame = t; }, 'Previous key'), next = btn('K▷', () => { const t = keyTimes(app).find(t => t > app.anim.frame); if (t !== undefined) app.anim.frame = t; }, 'Next key');
  root.append(prev, key, next, autokey, rm, rma); host.appendChild(root);
}
function keyTimes(app: App) { const s = new Set<number>(); for (const n of app.selection) { const ps = n instanceof X3DObject ? n.kinematics.local.params : n.params; for (const p of ps) for (const k of app.anim.fcurve(p)?.keys ?? []) s.add(k.time); } return [...s].sort((a, b) => a - b); }

export function panelSwitcher(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'bottom';
  const layout = document.createElement('select'); for (const o of ['Default', 'Dual', '1024 x 768']) { const e = document.createElement('option'); e.textContent = o; layout.appendChild(e); } layout.style.cssText = 'background:#333;color:#eee;border:1px solid #222;font-size:11px';
  root.append(layout, btn('Reset View', () => window.dispatchEvent(new CustomEvent('frameall'))));
  host.appendChild(root);
}

export function commandLine(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'cmdline';
  const input = document.createElement('input'); input.placeholder = 'Command line — e.g.  CreatePrim "Sphere", "MeshSurface"   or   SetValue "sphere.kine.local.posy", 5';
  const hint = document.createElement('span'); hint.className = 'hint';
  root.append(input, hint); host.appendChild(root);
  const history: string[] = []; let hi = 0;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { const t = input.value.trim(); if (!t) return; history.push(t); hi = history.length; input.value = ''; try { runScriptLine(app, t); } catch (err: any) { app.logMsg('error', String(err?.message ?? err)); } }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); input.value = history[hi] ?? ''; } else if (e.key === 'ArrowDown') { hi = Math.min(history.length, hi + 1); input.value = history[hi] ?? ''; }
  };
  const upd = () => { const last = app.log[app.log.length - 1]; hint.textContent = last ? last.text.slice(0, 60) : ''; hint.style.color = last?.kind === 'error' ? '#ff8080' : '#b8b8b8'; };
  app.events.on('log', upd);
}

/** Parses  Name arg1, arg2  /  Name(arg1, arg2)  with Softimage-like literals and runs it. */
export function runScriptLine(app: App, line: string) {
  const m = line.match(/^\s*([A-Za-z_][\w]*)\s*\(?(.*?)\)?\s*$/); if (!m) throw new Error('Cannot parse: ' + line);
  const name = m[1]; const def = app.commands.get(name); if (!def) throw new Error('Unknown command: ' + name);
  const raw = m[2].trim(); const parts: string[] = []; let cur = '', q = false;
  for (const ch of raw) { if (ch === '"') q = !q; if (ch === ',' && !q) { parts.push(cur); cur = ''; } else cur += ch; } if (cur.trim() || parts.length) parts.push(cur);
  const args: Record<string, any> = {};
  parts.forEach((p, i) => { const a = def.args[i]; if (!a) return; let v: any = p.trim(); if (v === '') return; if (/^".*"$/.test(v)) v = v.slice(1, -1); else if (v === 'true' || v === 'True') v = true; else if (v === 'false' || v === 'False') v = false; else if (!isNaN(Number(v))) v = Number(v); args[a.name] = v; });
  return app.run(name, args);
}

export function scriptLog(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'log'; host.appendChild(root);
  const render = () => { root.innerHTML = ''; for (const l of app.log.slice(-200)) { const d = document.createElement('div'); d.className = l.kind; d.textContent = (l.kind === 'cmd' ? '' : l.kind === 'error' ? '// ERROR: ' : '// INFO : ') + l.text; root.appendChild(d); } root.scrollTop = root.scrollHeight; };
  render(); app.events.on('log', render);
}

export { findParam };
