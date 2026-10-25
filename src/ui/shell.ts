// Shell views that were placeholders: Render Tree, Texture Editor, Schematic, Animation Editor (F-curves) and
// Dopesheet, Spreadsheet, Plugin Manager, Netview, Image Clip / Sources, Render Manager, Material Manager & Panel,
// Weight Paint Panel, Preset Manager. Each is compact but functional and uses the data the clone already keeps.
import * as THREE from 'three';
import { App } from '../core/commands';
import { pref } from './prefs';
import { sampleUVs, sampleOffsets, relaxUVs } from '../core/texturing';
import { ICETreeOperator, ICE_NODES, ICE_CATEGORIES, ICE_PRESETS, buildPreset } from '../core/ice';
import { Node, X3DObject, Shader, Material, Model, Property } from '../core/scene';
import { Parameter } from '../core/params';
import { FCurve } from '../core/animation';
import { TEXTURE_NODES, MATERIAL_PRESETS } from '../core/shaders';
import { openSiMenu, SI_MENUS } from './si';
import { PRESET_MODELS } from '../commands/presets';
import { animChrome, fcurveMenuLabels, mixerMenuLabels } from './animChrome';
import iceViewChrome from '../data/si/ice_view_chrome.json';
import {
  applyIceTreeChromeVars, iceToolbarShellLabels, iceToolbarTextLabels,
  icePaletteTabs, iceTaskCategoriesVisible,
} from './iceTreeChrome';

const el = (tag: string, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const btn = (l: string, t: string, fn: (e: MouseEvent) => void) => { const b = el('button', 'xp-btn', l) as HTMLButtonElement; b.title = t; b.onclick = fn; return b; };
const head = (...kids: HTMLElement[]) => { const h = el('div', 'xp-head'); h.append(...kids); return h; };
const menuBtn = (label: string, items: () => { label?: string; separator?: boolean; items?: any[] }[], onPick: (l: string, path: string[]) => void) => { const b = el('button', 'xp-btn', label) as HTMLButtonElement; b.innerHTML = label + '<span class="xp-arrow">▾</span>'; b.onclick = (e) => { e.stopPropagation(); const r = b.getBoundingClientRect(); openSiMenu(items() as any, r.left, r.bottom, (it, path) => onPick(it.label ?? '', path)); }; return b; };
const canvasFill = (host: HTMLElement) => { const cv = el('canvas') as HTMLCanvasElement; cv.className = 'fill-canvas'; host.appendChild(cv); const fit = () => { const r = host.getBoundingClientRect(); cv.width = Math.max(1, Math.round(r.width * devicePixelRatio)); cv.height = Math.max(1, Math.round(r.height * devicePixelRatio)); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; }; new ResizeObserver(() => { fit(); cv.dispatchEvent(new Event('redraw')); }).observe(host); fit(); return cv; };
const ctx2 = (cv: HTMLCanvasElement) => { const g = cv.getContext('2d')!; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.font = '10px Tahoma, Verdana, sans-serif'; return g; };
const currentMaterial = (app: App): Material | null => { const n = app.selection[app.selection.length - 1]; if (n instanceof Material) return n; if (n instanceof Shader) { let p: any = n; while (p && !(p instanceof Material)) p = p.parent; return p ?? null; } const o = app.selectedObjects[0]; return o?.material ?? app.scene.root.material ?? null; };

// ================================================================ Render Tree
export function renderTree(app: App, host: HTMLElement) {
  const root = el('div', 'rtree'); host.appendChild(root);
  const mat = () => currentMaterial(app);
  const nodesMenu = () => [{ label: 'Materials', items: Object.keys(MATERIAL_PRESETS).map(l => ({ label: l })) }, { label: 'Textures', items: Object.keys(TEXTURE_NODES).filter(k => /Image|Checker|Grid|Fractal|Marble|Wood|Cloud|Gradient|Vertex/.test(k)).map(l => ({ label: l })) }, { label: 'Mixers', items: Object.keys(TEXTURE_NODES).filter(k => /Mix|Math|Invert|HLS|Scalar to|Incidence|Environment|Bump|Space/.test(k)).map(l => ({ label: l })) }];
  const hd = head(menuBtn('Nodes', nodesMenu, (l) => { if (MATERIAL_PRESETS[l]) app.run('ReplaceSurfaceShader', { Preset: l }); else { const m = mat(); if (!m?.surface) return; const port = m.surface.ports().find(p => !m.surface!.inputs.has(p)) ?? 'diffuse'; app.run('ConnectShaderNode', { Shader: m.surface, Port: port, Preset: l }); } }),
    btn('Update', 'Refresh', () => render()), btn('Assign', 'Assign this material to the selection', () => { const m = mat(); if (m) app.run('AssignMaterial', { InputObjs: app.selectedObjects, Material: m.name }); }), btn('New', 'New material (Phong) on the selection', () => app.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: app.selectedObjects })));
  const title = el('span', 'rt-title'); hd.appendChild(title); root.appendChild(hd);
  const canvas = el('div', 'rt-canvas'); root.appendChild(canvas); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'rt-links'); canvas.appendChild(svg);
  const pos = new Map<Shader, { x: number; y: number }>(); let pending: { sh: Shader; out: boolean } | null = null;
  const render = () => {
    const m = mat(); canvas.querySelectorAll('.rt-node').forEach(n => n.remove()); svg.innerHTML = ''; title.textContent = m ? `${m.name}` : '(no material)'; if (!m) return;
    const nodes: { sh: Shader; depth: number }[] = []; const walk = (s: Shader, d: number) => { nodes.push({ sh: s, depth: d }); for (const i of s.inputs.values()) walk(i, d + 1); }; if (m.surface) walk(m.surface, 1);
    const maxD = Math.max(1, ...nodes.map(n => n.depth)); const W = canvas.clientWidth || 600; const colX = (d: number) => W - 40 - d * 190 - 170;
    const perCol: Record<number, number> = {};
    const matNode = mkNode(m.name, 'Material', [['surface', 'Surface'], ['volume', 'Volume'], ['environment', 'Environment'], ['shadow', 'Shadow']], null, colX(0), 30); canvas.appendChild(matNode.el);
    const boxes = new Map<Shader, ReturnType<typeof mkNode>>();
    for (const n of nodes) { const y = 30 + (perCol[n.depth] = (perCol[n.depth] ?? 0) + 1) * 0 + (perCol[n.depth] - 1) * 150; const p = pos.get(n.sh) ?? { x: colX(n.depth), y }; pos.set(n.sh, p); const b = mkNode(n.sh.name, n.sh.type, n.sh.ports().map(q => [q, n.sh.get(q)?.label ?? q] as [string, string]), n.sh, p.x, p.y); boxes.set(n.sh, b); canvas.appendChild(b.el); }
    void maxD;
    const link = (from: HTMLElement, to: HTMLElement) => { const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), c = canvas.getBoundingClientRect(); const x1 = a.right - c.left + canvas.scrollLeft, y1 = a.top + a.height / 2 - c.top + canvas.scrollTop, x2 = b.left - c.left + canvas.scrollLeft, y2 = b.top + b.height / 2 - c.top + canvas.scrollTop; const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', pref('C3DPrefsRenderTree', 'diagonal_connectors') ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`); path.setAttribute('class', 'rt-link'); svg.appendChild(path); };
    requestAnimationFrame(() => { if (m.surface) { const b = boxes.get(m.surface)!; link(b.out, matNode.ports.get('surface')!); } for (const [sh, b] of boxes) for (const [port, inp] of sh.inputs) { const ib = boxes.get(inp); if (ib) link(ib.out, b.ports.get(port)!); } });
  };
  const mkNode = (name: string, type: string, ports: [string, string][], sh: Shader | null, x: number, y: number) => {
    const n = el('div', 'rt-node' + (sh ? '' : ' material')); n.style.left = x + 'px'; n.style.top = y + 'px';
    const t = el('div', 'rt-node-title', name); const ty = el('div', 'rt-node-type', type); n.append(t, ty);
    const out = el('div', 'rt-port out'); out.title = 'Output: drag to an input port'; n.appendChild(out);
    const pm = new Map<string, HTMLElement>();
    for (const [p, label] of ports) { const r = el('div', 'rt-port-row'); const dot = el('div', 'rt-port in'); dot.title = `${label} (${p})`; const lb = el('span', '', label); r.append(dot, lb); n.appendChild(r); pm.set(p, dot); if (sh && sh.inputs.has(p)) r.classList.add('connected');
      dot.onclick = (e) => { e.stopPropagation(); if (pending && sh) { app.run('ConnectShaderNode', { Shader: sh, Port: p, Node: pending.sh }); pending = null; render(); } else if (sh?.inputs.has(p)) { app.run('DisconnectShader', { Shader: sh, Port: p }); render(); } else if (sh) { const r2 = dot.getBoundingClientRect(); openSiMenu(Object.keys(TEXTURE_NODES).map(l => ({ label: l })), r2.left, r2.bottom, (it) => { app.run('ConnectShaderNode', { Shader: sh, Port: p, Preset: it.label }); render(); }); } }; }
    if (sh) { out.onclick = (e) => { e.stopPropagation(); pending = pending?.sh === sh ? null : { sh, out: true }; canvas.querySelectorAll('.rt-port.out').forEach(o => o.classList.remove('pending')); if (pending) out.classList.add('pending'); };
      n.ondblclick = () => app.events.emit('inspect', sh); n.onclick = () => app.select([sh]);
      n.oncontextmenu = (e) => { e.preventDefault(); openSiMenu([{ label: 'Inspect' }, { label: 'Rename' }, { separator: true }, { label: 'Disconnect All' }, { label: 'Delete' }], e.clientX, e.clientY, (it) => { if (it.label === 'Inspect') app.events.emit('inspect', sh); else if (it.label === 'Rename') { const nn = prompt('Name:', sh.name); if (nn) { sh.name = nn; render(); } } else if (it.label === 'Disconnect All') { for (const k of [...sh.inputs.keys()]) app.run('DisconnectShader', { Shader: sh, Port: k }); render(); } else if (it.label === 'Delete') { const par = sh.parent as Shader | Material | null; if (par instanceof Shader) { const k = [...par.inputs].find(([, v]) => v === sh)?.[0]; if (k) app.run('DisconnectShader', { Shader: par, Port: k }); } render(); } }); };
      let drag: { sx: number; sy: number; x: number; y: number } | null = null; t.onpointerdown = (e) => { drag = { sx: e.clientX, sy: e.clientY, x: n.offsetLeft, y: n.offsetTop }; t.setPointerCapture(e.pointerId); }; t.onpointermove = (e) => { if (!drag) return; const p = { x: Math.max(0, drag.x + e.clientX - drag.sx), y: Math.max(0, drag.y + e.clientY - drag.sy) }; pos.set(sh, p); n.style.left = p.x + 'px'; n.style.top = p.y + 'px'; }; t.onpointerup = () => { drag = null; render(); }; }
    else { n.ondblclick = () => { const m = mat(); if (m) app.events.emit('inspect', m); }; }
    return { el: n, out, ports: pm };
  };
  render(); app.events.on('selection', render); app.events.on('scene', render); new ResizeObserver(render).observe(canvas);
}

// ================================================================ Texture Editor (UV view)
const pcol = (page: string, name: string, fallback: string) => { const v = pref(page, name); if (v === undefined || v === null) return fallback; if (Array.isArray(v)) return `rgb(${v.slice(0, 3).map(x => Math.round(Number(x) * 255)).join(',')})`; const n = Number(v); return Number.isFinite(n) ? '#' + ((n >>> 8) & 0xffffff).toString(16).padStart(6, '0') : fallback; };
export function textureEditor(app: App, host: HTMLElement) {
  const root = el('div', 'texed'); host.appendChild(root);
  const obj = () => app.selectedObjects.find(o => o.primitive?.mesh());
  const proj = (o: X3DObject | undefined) => o?.property('uvprojection');
  const uvsOf = (o: X3DObject): Float32Array | null => sampleUVs(o); // per-sample UVs (polygon nodes), like Softimage's texture editor
  const image = (o: X3DObject | undefined): string | null => { const sh = o?.material?.surface; const img = sh?.inputs.get('diffuse'); return (img?.val('tex') as string) || (sh?.val('image') as string) || null; };
  let sel = new Set<number>(); let view = { x: 20, y: 20, s: 300 }; let img: HTMLImageElement | null = null; let imgSrc = '';
  const hd = head(menuBtn('Edit', () => [{ label: 'Select All' }, { label: 'Deselect All' }, { label: 'Select Island' }, { separator: true }, { label: 'Flip U' }, { label: 'Flip V' }, { label: 'Rotate 90°' }, { label: 'Normalize' }, { label: 'Relax (Unfold)' }, { label: 'Heal (Weld Samples)' }, { label: 'Reset to Projection' }], (l) => editUV(l)),
    menuBtn('Projection', () => ['Planar XY', 'Planar XZ', 'Planar YZ', 'Cylindrical', 'Spherical', 'Cubic', 'Camera'].map(k => ({ label: k })), (l) => { const o = obj(); if (!o) return; app.run('CreateProjection', { InputObjs: [o], Type: l }); }),
    menuBtn('Texture', () => [{ label: 'Load Image...' }, { label: 'Checkerboard' }, { label: 'None' }], (l) => { if (l === 'Load Image...') app.run('AddImageClip'); else if (l === 'Checkerboard') { const o = obj(); if (o?.material?.surface) app.run('ConnectShaderNode', { Shader: o.material.surface, Port: 'diffuse', Preset: 'Checkerboard' }); } else { const o = obj(); if (o?.material?.surface) app.run('DisconnectShader', { Shader: o.material.surface, Port: 'diffuse' }); } }),
    btn('Frame', 'Frame the UVs', () => { view = { x: 20, y: 20, s: Math.min(cv.clientWidth, cv.clientHeight) - 40 }; draw(); }));
  const info = el('span', 'rt-title'); hd.appendChild(info); root.appendChild(hd);
  const wrap = el('div', 'texed-canvas'); root.appendChild(wrap); const cv = canvasFill(wrap);
  const toPx = (u: number, v: number) => [view.x + u * view.s, view.y + (1 - v) * view.s];
  const draw = () => {
    const g = ctx2(cv); const W = cv.clientWidth, H = cv.clientHeight; g.fillStyle = pcol('C3DPrefsTextureEditor', 'BackgroundColor', '#5a5a5a'); g.fillRect(0, 0, W, H);
    const o = obj(); const uv = o ? uvsOf(o) : null; const src = image(o);
    if (src && src !== imgSrc) { imgSrc = src; img = new Image(); img.onload = draw; img.src = src; }
    const [x0, y0] = toPx(0, 1); if (img && src) { try { g.drawImage(img, x0, y0, view.s, view.s); } catch { /* ignore */ } } else { g.fillStyle = '#3c3c3c'; g.fillRect(x0, y0, view.s, view.s); }
    if (pref('C3DPrefsTextureEditor', 'ShowGrid') !== false) { const su = Math.max(0.01, Number(pref('C3DPrefsTextureEditor', 'GridStepU') ?? 0.1)), sv = Math.max(0.01, Number(pref('C3DPrefsTextureEditor', 'GridStepV') ?? 0.1)); g.strokeStyle = pcol('C3DPrefsTextureEditor', 'GridColor', 'rgba(255,255,255,.18)'); g.globalAlpha = 0.35; g.beginPath(); for (let u = 0; u <= 1.0001; u += su) { const [x, ya] = toPx(u, 1), [, yb] = toPx(u, 0); g.moveTo(x, ya); g.lineTo(x, yb); } for (let v = 0; v <= 1.0001; v += sv) { const [xa, y] = toPx(0, v), [xb] = toPx(1, v); g.moveTo(xa, y); g.lineTo(xb, y); } g.stroke(); g.globalAlpha = 1; }
    g.strokeStyle = '#999'; g.strokeRect(x0 + 0.5, y0 + 0.5, view.s, view.s); for (let i = 1; i < 10; i++) { g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(x0 + view.s * i / 10, y0); g.lineTo(x0 + view.s * i / 10, y0 + view.s); g.moveTo(x0, y0 + view.s * i / 10); g.lineTo(x0 + view.s, y0 + view.s * i / 10); g.stroke(); }
    info.textContent = o ? (uv ? `${o.name}: ${uv.length / 2} UV samples${src ? ' · ' + (o.material?.surface?.inputs.get('diffuse')?.name ?? 'image') : ''}` : `${o.name}: no texture projection (Projection menu)`) : 'Select a polygon mesh';
    if (!o || !uv) return; const m = o.primitive!.mesh()!;
    const { start } = sampleOffsets(m);
    g.strokeStyle = '#9ad24a'; g.lineWidth = 1; m.polygons.forEach((poly, pi) => { g.beginPath(); poly.forEach((_, i) => { const si = start[pi] + i; const [x, y] = toPx(uv[si * 2], uv[si * 2 + 1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); g.stroke(); });
    for (let i = 0; i < uv.length / 2; i++) { const [x, y] = toPx(uv[i * 2], uv[i * 2 + 1]); g.fillStyle = sel.has(i) ? '#ff4040' : '#5a7cff'; g.fillRect(x - 2, y - 2, 4, 4); }
  };
  const editUV = (l: string) => { const o = obj(); if (!o) return; const uv = uvsOf(o); const p = proj(o); if (!uv || !p) return; const n = uv.length / 2; const ids = sel.size ? [...sel] : Array.from({ length: n }, (_, i) => i); const nu = new Float32Array(uv);
    if (l === 'Select All') { sel = new Set(ids); draw(); return; } if (l === 'Deselect All') { sel.clear(); draw(); return; }
    if (l === 'Select Island') { const m = o.primitive!.mesh()!; const { start } = sampleOffsets(m); const groups = new Map<string, number[]>(); m.polygons.forEach((f, pi) => f.forEach((v, i) => { const si = start[pi] + i; const k = `${v}|${Math.round(uv[si * 2] * 200)},${Math.round(uv[si * 2 + 1] * 200)}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(si); })); const sampleGroup = new Map<number, number[]>(); for (const g of groups.values()) for (const si of g) sampleGroup.set(si, g); const polyOf = new Int32Array(uv.length / 2); m.polygons.forEach((f, pi) => f.forEach((_, i) => { polyOf[start[pi] + i] = pi; })); const todo = [...sel]; const seen = new Set(sel); while (todo.length) { const si = todo.pop()!; const pi = polyOf[si]; for (let i = 0; i < m.polygons[pi].length; i++) { const sj = start[pi] + i; for (const sk of sampleGroup.get(sj) ?? [sj]) if (!seen.has(sk)) { seen.add(sk); todo.push(sk); } } } sel = seen; draw(); return; }
    if (l === 'Relax (Unfold)') { (p as any).uvs = relaxUVs(o.primitive!.mesh()!, nu, 15, sel.size ? undefined : undefined); }
    else if (l === 'Heal (Weld Samples)') { const m = o.primitive!.mesh()!; const { start } = sampleOffsets(m); const byV = new Map<number, number[]>(); m.polygons.forEach((f, pi) => f.forEach((v, i) => { const si = start[pi] + i; if (!ids.includes(si)) return; (byV.get(v) ?? byV.set(v, []).get(v)!).push(si); })); for (const g of byV.values()) { let cx = 0, cy = 0; for (const si of g) { cx += nu[si * 2]; cy += nu[si * 2 + 1]; } for (const si of g) { nu[si * 2] = cx / g.length; nu[si * 2 + 1] = cy / g.length; } } (p as any).uvs = nu; }
    else if (l === 'Reset to Projection') { delete (p as any).uvs; } else { let cx = 0, cy = 0; for (const i of ids) { cx += nu[i * 2]; cy += nu[i * 2 + 1]; } cx /= ids.length; cy /= ids.length; for (const i of ids) { let u = nu[i * 2] - cx, v = nu[i * 2 + 1] - cy; if (l === 'Flip U') u = -u; if (l === 'Flip V') v = -v; if (l === 'Rotate 90°') [u, v] = [-v, u]; nu[i * 2] = u + cx; nu[i * 2 + 1] = v + cy; } if (l === 'Normalize') { let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity]; for (const i of ids) { mn = [Math.min(mn[0], nu[i * 2]), Math.min(mn[1], nu[i * 2 + 1])]; mx = [Math.max(mx[0], nu[i * 2]), Math.max(mx[1], nu[i * 2 + 1])]; } for (const i of ids) { nu[i * 2] = (nu[i * 2] - mn[0]) / ((mx[0] - mn[0]) || 1); nu[i * 2 + 1] = (nu[i * 2 + 1] - mn[1]) / ((mx[1] - mn[1]) || 1); } } (p as any).uvs = nu; }
    app.logMsg('cmd', `TextureEditor "${l}"`); window.dispatchEvent(new Event('uvedit')); app.events.emit('params'); draw(); };
  let drag: { sx: number; sy: number; mode: 'pan' | 'move' | 'box'; start: Float32Array | null } | null = null;
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); const o = obj(); const uv = o ? uvsOf(o) : null; const r = cv.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; if (e.button === 1 || e.altKey) { drag = { sx: e.clientX, sy: e.clientY, mode: 'pan', start: null }; return; } if (!uv) return; let hit = -1; for (let i = 0; i < uv.length / 2; i++) { const [x, y] = toPx(uv[i * 2], uv[i * 2 + 1]); if (Math.abs(x - px) < 5 && Math.abs(y - py) < 5) { hit = i; break; } } if (hit >= 0) { if (!sel.has(hit) && !e.shiftKey) sel = new Set([hit]); else if (e.shiftKey) sel.add(hit); drag = { sx: e.clientX, sy: e.clientY, mode: 'move', start: new Float32Array(uv) }; } else { if (!e.shiftKey) sel.clear(); drag = { sx: e.clientX, sy: e.clientY, mode: 'box', start: new Float32Array(uv) }; } draw(); };
  cv.onpointermove = (e) => { if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (drag.mode === 'pan') { view.x += dx; view.y += dy; drag.sx = e.clientX; drag.sy = e.clientY; draw(); return; } if (drag.mode === 'move') { const o = obj()!; const p = proj(o)!; const nu = new Float32Array(drag.start!); for (const i of sel) { nu[i * 2] += dx / view.s; nu[i * 2 + 1] -= dy / view.s; } (p as any).uvs = nu; window.dispatchEvent(new Event('uvedit')); draw(); } };
  cv.onpointerup = (e) => { if (!drag) return; const d = drag; drag = null; if (d.mode === 'box') { const o = obj(); const uv = o ? uvsOf(o) : null; if (!uv) return; const r = cv.getBoundingClientRect(); const x0 = Math.min(d.sx, e.clientX) - r.left, x1 = Math.max(d.sx, e.clientX) - r.left, y0 = Math.min(d.sy, e.clientY) - r.top, y1 = Math.max(d.sy, e.clientY) - r.top; for (let i = 0; i < uv.length / 2; i++) { const [x, y] = toPx(uv[i * 2], uv[i * 2 + 1]); if (x >= x0 && x <= x1 && y >= y0 && y <= y1) sel.add(i); } draw(); } else if (d.mode === 'move') app.logMsg('cmd', `TextureEditor "Move ${sel.size} UVs"`); };
  cv.onwheel = (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; const r = cv.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; view.x = px - (px - view.x) * f; view.y = py - (py - view.y) * f; view.s *= f; draw(); };
  cv.addEventListener('redraw', draw); draw(); app.events.on('selection', () => { sel.clear(); draw(); }); app.events.on('scene', draw); app.events.on('params', draw);
}

// ================================================================ Schematic
export function schematic(app: App, host: HTMLElement) {
  const root = el('div', 'schematic'); host.appendChild(root);
  const hd = head(menuBtn('View', () => [{ label: 'Frame All' }, { label: 'Expand All' }, { label: 'Collapse All' }, { separator: true }, { label: 'Show Materials' }, { label: 'Show Properties' }], (l) => { if (l === 'Frame All') { view = { x: 20, y: 30, s: 1 }; } else if (l === 'Show Materials') opts.materials = !opts.materials; else if (l === 'Show Properties') opts.props = !opts.props; else if (l === 'Collapse All') collapsed = new Set([...app.scene.allObjects()].map(o => o.id)); else collapsed.clear(); layout(); draw(); }), btn('Frame', 'Frame all nodes', () => { view = { x: 20, y: 30, s: 1 }; draw(); }));
  root.appendChild(hd); const wrap = el('div', 'schematic-canvas'); root.appendChild(wrap); const cv = canvasFill(wrap);
  const opts = { materials: false, props: false }; let collapsed = new Set<number>(); let view = { x: 20, y: 30, s: 1 };
  type Box = { n: Node; x: number; y: number; w: number; h: number; parent?: Box };
  let boxes: Box[] = [];
  const colorOf = (n: Node) => n instanceof Model ? '#6fb36f' : n.kind === 'object' ? ((n as X3DObject).type === 'camera' ? '#7aa0ff' : (n as X3DObject).type === 'light' ? '#ffb347' : (n as X3DObject).type === 'null' ? '#cfcfcf' : '#e0d8b0') : n.kind === 'material' ? '#d98cd9' : '#bbb';
  const layout = () => { boxes = []; let x = 0; const W = 110, H = 26, GX = 16, GY = 50;
    const place = (o: X3DObject, depth: number, parent?: Box): number => { const kids = collapsed.has(o.id) ? [] : o.children; const b: Box = { n: o, x: 0, y: depth * GY, w: W, h: H, parent }; boxes.push(b); const extras: Node[] = []; if (opts.materials && o.material && o.material !== app.scene.root.material) extras.push(o.material); if (opts.props) extras.push(...o.properties.filter(p => !p.shared)); let left = x; let span = 0; for (const k of kids) span += place(k, depth + 1, b); for (const e of extras) { boxes.push({ n: e, x: x, y: (depth + 1) * GY, w: W, h: H, parent: b }); x += W + GX; span += W + GX; } if (!span) { span = W + GX; x += span; } b.x = left + (span - GX) / 2 - W / 2; return span; };
    for (const c of app.scene.root.children) place(c, 0); };
  const draw = () => { const g = ctx2(cv); const Wd = cv.clientWidth, Hd = cv.clientHeight; g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, Wd, Hd); g.save(); g.translate(view.x, view.y); g.scale(view.s, view.s);
    if (pref('C3DPrefsSchematicView', 'show_grid')) { g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); for (let x = 0; x < 4000; x += 50) { g.moveTo(x, -2000); g.lineTo(x, 4000); } for (let y = -2000; y < 4000; y += 50) { g.moveTo(0, y); g.lineTo(4000, y); } g.stroke(); }
    g.strokeStyle = '#222'; for (const b of boxes) if (b.parent) { g.beginPath(); g.moveTo(b.parent.x + b.parent.w / 2, b.parent.y + b.parent.h); g.lineTo(b.x + b.w / 2, b.y); g.stroke(); }
    for (const b of boxes) { const selected = app.selection.includes(b.n); g.fillStyle = colorOf(b.n); g.fillRect(b.x, b.y, b.w, b.h); g.strokeStyle = selected ? '#fff' : '#222'; g.lineWidth = selected ? 2 : 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h); g.fillStyle = '#111'; g.fillText(b.n.name.slice(0, 16), b.x + 4, b.y + 16); if (b.n instanceof X3DObject && b.n.children.length) { g.fillText(collapsed.has(b.n.id) ? '+' : '−', b.x + b.w - 10, b.y + 16); } }
    g.restore(); };
  const hit = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left - view.x) / view.s, y = (e.clientY - r.top - view.y) / view.s; return { x, y, b: boxes.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) }; };
  let drag: { sx: number; sy: number; b?: Box; pan: boolean } | null = null;
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); const h = hit(e); if (e.button === 1 || e.altKey || !h.b) { drag = { sx: e.clientX, sy: e.clientY, pan: true }; return; } if (h.b.n instanceof X3DObject && h.x > h.b.x + h.b.w - 14 && h.b.n.children.length) { if (collapsed.has(h.b.n.id)) collapsed.delete(h.b.n.id); else collapsed.add(h.b.n.id); layout(); draw(); return; } app.select(e.shiftKey ? [...app.selection, h.b.n] : [h.b.n]); drag = { sx: e.clientX, sy: e.clientY, b: h.b, pan: false }; };
  cv.onpointermove = (e) => { if (!drag) return; if (drag.pan) { view.x += e.clientX - drag.sx; view.y += e.clientY - drag.sy; drag.sx = e.clientX; drag.sy = e.clientY; draw(); } };
  cv.onpointerup = (e) => { if (!drag) return; const d = drag; drag = null; if (d.b && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) { const h = hit(e); if (h.b && h.b !== d.b && h.b.n instanceof X3DObject && d.b.n instanceof X3DObject) { app.run('ParentObj', { Parent: h.b.n.fullName, Children: [d.b.n] }); } else if (!h.b && d.b.n instanceof X3DObject) app.run('CutObj', { Children: [d.b.n] }); } };
  cv.ondblclick = (e) => { const h = hit(e); if (h.b) app.events.emit('inspect', h.b.n); };
  cv.onwheel = (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; view.s *= f; draw(); };
  cv.addEventListener('redraw', draw); layout(); draw(); app.events.on('scene', () => { layout(); draw(); }); app.events.on('selection', draw);
}

// ================================================================ Animation Editor (F-curves) & Dopesheet
const animParams = (app: App): Parameter[] => { const out: Parameter[] = []; const A = app.anim; for (const n of app.selection) { const sets = n instanceof X3DObject ? [n.kinematics.local, ...(n.primitive ? [n.primitive, ...n.primitive.operators] : []), ...n.properties] : [n]; for (const s of sets) for (const p of s.params) if (A.isAnimated(p)) out.push(p); } return out; };
const CURVE_COLORS: Record<string, string> = { posx: '#ff5a5a', posy: '#5aff5a', posz: '#5a7cff', rotx: '#ff5a5a', roty: '#5aff5a', rotz: '#5a7cff', sclx: '#ff5a5a', scly: '#5aff5a', sclz: '#5a7cff' };
export function animationEditor(app: App, host: HTMLElement, mode: 'fcurve' | 'dopesheet' = 'fcurve') {
  const root = el('div', 'fcv'); host.appendChild(root); const A = app.anim;
  let shown = new Set<Parameter>(); let selKeys = new Set<string>(); const key = (p: Parameter, t: number) => `${p.fullName}@${t}`;
  // Softimage Animation Editor / DopeSheet menubar labels from PE dict chrome tokens
  const menus = mode === 'fcurve' ? fcurveMenuLabels() : animChrome.menus.dopesheet;
  const hd = head(menuBtn(menus[0] || 'Edit', () => [{ label: 'Select All Keys' }, { label: 'Deselect All' }, { separator: true }, { label: 'Delete Keys' }, { label: 'Set Key at Current Frame' }, { separator: true }, { label: 'Move Keys...' }, { label: 'Scale Keys...' }], (l) => edit(l)),
    menuBtn(mode === 'fcurve' ? (menus[1] || 'Curves') : (menus[1] || 'View'), () => mode === 'fcurve' ? [{ label: 'Linear' }, { label: 'Spline' }, { label: 'Constant (step)' }] : [{ label: 'Frame All' }, { label: 'Frame Selection' }, { separator: true }, { label: 'Show Values' }], (l) => {
      if (mode !== 'fcurve' || l.startsWith('Frame') || l === 'Show Values') { if (l.startsWith('Frame')) frameAll(); else if (l === 'Show Values') showVals = !showVals; draw(); return; }
      for (const p of shown) { const fc = A.fcurve(p); if (fc) { fc.interp = l.startsWith('Lin') ? 1 : l.startsWith('Con') ? 0 : 3; for (const k of fc.keys) k.interp = fc.interp; } }
      A.frame = A.frame; draw();
    }),
    menuBtn(menus[2] || 'View', () => [{ label: 'Frame All' }, { label: 'Frame Selection' }, { separator: true }, { label: 'Show Values' }, { label: 'Show Handles' }, { label: 'Lock Parameters' }], (l) => { if (l.startsWith('Frame')) frameAll(); else if (l === 'Lock Parameters') lock = !lock; else if (l === 'Show Handles') showHandles = !showHandles; else showVals = !showVals; draw(); }),
    btn(mode === 'fcurve' ? 'Dopesheet' : 'F-Curves', 'Switch editor', () => { root.remove(); animationEditor(app, host, mode === 'fcurve' ? 'dopesheet' : 'fcurve'); }), btn('Frame', 'Frame all', () => { frameAll(); draw(); }));
  const info = el('span', 'rt-title'); hd.appendChild(info); root.appendChild(hd);
  const body = el('div', 'fcv-body'); const list = el('div', 'fcv-list'); const wrap = el('div', 'fcv-canvas'); body.append(list, wrap); root.appendChild(body); const cv = canvasFill(wrap);
  let lock = false, showVals = true, showHandles = true; let view = { t0: A.startFrame - 2, t1: A.endFrame + 2, v0: -10, v1: 10 };
  const LM = animChrome.layout.fcv_label_margin, TB = animChrome.layout.fcv_ruler_h;
  const refreshList = () => { const ps = animParams(app); if (!lock) shown = new Set(ps); list.innerHTML = ''; for (const p of ps) { const r = el('div', 'fcv-row' + (shown.has(p) ? ' on' : '')); const sw = el('span', 'sw'); sw.style.background = CURVE_COLORS[p.name] ?? '#ffd34d'; r.append(sw, el('span', '', `${(p.owner as any).parent?.name ?? ''}.${p.label}`)); r.onclick = (e) => { if (e.shiftKey) { if (shown.has(p)) shown.delete(p); else shown.add(p); } else shown = new Set([p]); lock = true; refreshList(); draw(); }; list.appendChild(r); } info.textContent = `${ps.length} animated parameter(s)`; };
  const frameAll = () => { let lo = Infinity, hi = -Infinity, t0 = Infinity, t1 = -Infinity; for (const p of shown) for (const k of A.fcurve(p)?.keys ?? []) { lo = Math.min(lo, k.value); hi = Math.max(hi, k.value); t0 = Math.min(t0, k.time); t1 = Math.max(t1, k.time); } if (lo === Infinity) { lo = -10; hi = 10; t0 = A.startFrame; t1 = A.endFrame; } const pad = (hi - lo || 2) * 0.15; view = { t0: t0 - 2, t1: t1 + 2, v0: lo - pad, v1: hi + pad }; };
  const X = (t: number) => LM + (t - view.t0) / (view.t1 - view.t0) * (cv.clientWidth - LM - 6); const Y = (v: number) => TB + (1 - (v - view.v0) / (view.v1 - view.v0)) * (cv.clientHeight - TB - 6);
  const invX = (x: number) => view.t0 + (x - LM) / (cv.clientWidth - LM - 6) * (view.t1 - view.t0); const invY = (y: number) => view.v1 - (y - TB) / (cv.clientHeight - TB - 6) * (view.v1 - view.v0);
  const rows = () => [...shown];
  const draw = () => { const g = ctx2(cv); const W = cv.clientWidth, H = cv.clientHeight; g.fillStyle = animChrome.colors.client_bg; g.fillRect(0, 0, W, H);
    const tstep = (view.t1 - view.t0) > 200 ? 50 : (view.t1 - view.t0) > 60 ? 10 : 5; g.strokeStyle = animChrome.colors.grid; g.fillStyle = '#ccc';
    const vg = pref('C3DPrefsFCurveEditor', 'vert_grid_vis') !== false, hg = pref('C3DPrefsFCurveEditor', 'horz_grid_vis') !== false, hr = pref('C3DPrefsFCurveEditor', 'horz_ruler_vis') !== false, vr = pref('C3DPrefsFCurveEditor', 'vert_ruler_vis') !== false;
    for (let t = Math.ceil(view.t0 / tstep) * tstep; t <= view.t1; t += tstep) { const x = X(t); if (vg || mode !== 'fcurve') { g.beginPath(); g.moveTo(x, TB); g.lineTo(x, H); g.stroke(); } if (hr) g.fillText(String(t), x + 2, 10); }
    if (mode === 'fcurve') { const vstep = niceStep(view.v1 - view.v0); for (let v = Math.ceil(view.v0 / vstep) * vstep; v <= view.v1; v += vstep) { const y = Y(v); if (hg) { g.beginPath(); g.moveTo(LM, y); g.lineTo(W, y); g.stroke(); } if (vr) g.fillText(String(Math.round(v * 100) / 100), 2, y + 3); } g.strokeStyle = '#888'; g.beginPath(); g.moveTo(LM, Y(0)); g.lineTo(W, Y(0)); g.stroke(); }
    const rs = rows();
    rs.forEach((p, ri) => { const fc = A.fcurve(p); if (!fc) return; const col = CURVE_COLORS[p.name] ?? animChrome.colors.key_diamond;
      if (mode === 'fcurve') {
        g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath();
        for (let x = LM; x < W; x += 2) { const v = fc.eval(invX(x)); const y = Y(v); if (x === LM) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
        for (let ki = 0; ki < fc.keys.length; ki++) {
          const k = fc.keys[ki]; const x = X(k.time), y = Y(k.value);
          // Softimage Left/Right handle chrome (absolute handle Y at ±1/3 neighbor span)
          if (showHandles && selKeys.has(key(p, k.time))) {
            const prev = fc.keys[ki - 1], next = fc.keys[ki + 1];
            g.strokeStyle = '#ccc'; g.fillStyle = '#eee';
            if (next) {
              const hx = X(k.time + (next.time - k.time) / 3), hy = Y(k.right ?? k.value);
              g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke(); g.fillRect(hx - 2, hy - 2, 4, 4);
            }
            if (prev) {
              const hx = X(k.time - (k.time - prev.time) / 3), hy = Y(k.left ?? k.value);
              g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke(); g.fillRect(hx - 2, hy - 2, 4, 4);
            }
          }
          g.fillStyle = selKeys.has(key(p, k.time)) ? '#fff' : col; g.fillRect(x - 3, y - 3, 6, 6);
          if (showVals && selKeys.has(key(p, k.time))) { g.fillStyle = '#fff'; g.fillText(`${k.time}: ${Math.round(k.value * 1000) / 1000}`, x + 6, y - 6); }
        }
      }
      else { const y = TB + 8 + ri * 18; g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(LM, y - 2, W - LM, 16); g.fillStyle = '#ddd'; g.fillText(p.label, 2, y + 10); for (const k of fc.keys) { const x = X(k.time); g.fillStyle = selKeys.has(key(p, k.time)) ? '#fff' : col; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y + 6); g.lineTo(x, y + 12); g.lineTo(x - 5, y + 6); g.closePath(); g.fill(); } } });
    g.fillStyle = animChrome.colors.time_cursor; g.fillRect(X(A.frame) - 1, TB, 2, H - TB); g.fillText(String(A.frame), X(A.frame) + 3, H - 3); };
  const keyAt = (px: number, py: number): { p: Parameter; t: number } | null => { const rs = rows(); for (let ri = 0; ri < rs.length; ri++) { const p = rs[ri]; const fc = A.fcurve(p); if (!fc) continue; for (const k of fc.keys) { const x = X(k.time), y = mode === 'fcurve' ? Y(k.value) : TB + 8 + ri * 18 + 6; if (Math.abs(x - px) < 6 && Math.abs(y - py) < 7) return { p, t: k.time }; } } return null; };
  const edit = (l: string) => { if (l === 'Select All Keys') { selKeys.clear(); for (const p of shown) for (const k of A.fcurve(p)?.keys ?? []) selKeys.add(key(p, k.time)); } else if (l === 'Deselect All') selKeys.clear(); else if (l === 'Delete Keys') { for (const p of shown) for (const k of [...(A.fcurve(p)?.keys ?? [])]) if (selKeys.has(key(p, k.time))) app.run('RemoveKey', { InputObjs: p.fullName, Time: k.time }); selKeys.clear(); } else if (l === 'Set Key at Current Frame') { for (const p of shown) app.run('SaveKey', { InputObjs: p.fullName }); } else if (l === 'Move Keys...' || l === 'Scale Keys...') { const v = Number(prompt(l === 'Move Keys...' ? 'Offset (frames):' : 'Scale factor about the first selected key:', l === 'Move Keys...' ? '10' : '2') ?? NaN); if (!Number.isFinite(v)) return; for (const p of shown) { const fc = A.fcurve(p); if (!fc) continue; const sel = fc.keys.filter(k => selKeys.has(key(p, k.time))); if (!sel.length) continue; const t0 = sel[0].time; const old = fc.keys.map(k => ({ ...k })); app.record(l, () => { for (const k of sel) k.time = Math.round(l === 'Move Keys...' ? k.time + v : t0 + (k.time - t0) * v); fc.keys.sort((a, b) => a.time - b.time); }, () => { fc.keys = old; }); } selKeys.clear(); A.frame = A.frame; } draw(); };
  let drag: { sx: number; sy: number; mode: 'key' | 'pan' | 'box' | 'scrub'; start: Map<string, { t: number; v: number }>; keys: FCurve[] } | null = null;
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; if (e.button === 1 || e.altKey) { drag = { sx: e.clientX, sy: e.clientY, mode: 'pan', start: new Map(), keys: [] }; return; } if (py < TB) { drag = { sx: e.clientX, sy: e.clientY, mode: 'scrub', start: new Map(), keys: [] }; A.frame = Math.round(invX(px)); return; }
    const h = keyAt(px, py); if (h) { const k = key(h.p, h.t); if (!selKeys.has(k) && !e.shiftKey) selKeys = new Set([k]); else selKeys.add(k); const start = new Map<string, { t: number; v: number }>(); const fcs: FCurve[] = []; for (const p of shown) { const fc = A.fcurve(p); if (!fc) continue; fcs.push(fc); for (const q of fc.keys) if (selKeys.has(key(p, q.time))) start.set(key(p, q.time), { t: q.time, v: q.value }); } drag = { sx: e.clientX, sy: e.clientY, mode: 'key', start, keys: fcs }; }
    else { if (!e.shiftKey) selKeys.clear(); if (e.button === 2 && mode === 'fcurve') { const p = rows()[0]; if (p) app.run('SaveKey', { InputObjs: p.fullName, Time: Math.round(invX(px)), Value: invY(py) }); } else drag = { sx: e.clientX, sy: e.clientY, mode: 'box', start: new Map(), keys: [] }; } draw(); };
  cv.onpointermove = (e) => { if (!drag) return; const r = cv.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; if (drag.mode === 'pan') { const dt = (e.clientX - drag.sx) / (cv.clientWidth - LM - 6) * (view.t1 - view.t0), dv = (e.clientY - drag.sy) / (cv.clientHeight - TB - 6) * (view.v1 - view.v0); view.t0 -= dt; view.t1 -= dt; view.v0 += dv; view.v1 += dv; drag.sx = e.clientX; drag.sy = e.clientY; draw(); return; } if (drag.mode === 'scrub') { A.frame = Math.max(A.globalStart, Math.min(A.globalEnd, Math.round(invX(px)))); return; } if (drag.mode !== 'key') return;
    const dt = Math.round((e.clientX - drag.sx) / (cv.clientWidth - LM - 6) * (view.t1 - view.t0)), dv = mode === 'fcurve' ? -(e.clientY - drag.sy) / (cv.clientHeight - TB - 6) * (view.v1 - view.v0) : 0;
    for (const p of shown) { const fc = A.fcurve(p); if (!fc) continue; for (const q of fc.keys) { const s = drag.start.get(key(p, q.time)); if (s) { (q as any)._nt = s.t + dt; q.value = e.shiftKey ? s.v : s.v + dv; } } }
    const ns = new Set<string>(); for (const p of shown) { const fc = A.fcurve(p); if (!fc) continue; for (const q of fc.keys) if ((q as any)._nt !== undefined) { q.time = (q as any)._nt; ns.add(key(p, q.time)); } fc.keys.sort((a, b) => a.time - b.time); } selKeys = ns.size ? ns : selKeys; A.frame = A.frame; draw(); };
  cv.onpointerup = (e) => { if (!drag) return; const d = drag; drag = null; if (d.mode === 'box') { const r = cv.getBoundingClientRect(); const x0 = Math.min(d.sx, e.clientX) - r.left, x1 = Math.max(d.sx, e.clientX) - r.left, y0 = Math.min(d.sy, e.clientY) - r.top, y1 = Math.max(d.sy, e.clientY) - r.top; const rs = rows(); rs.forEach((p, ri) => { for (const k of A.fcurve(p)?.keys ?? []) { const x = X(k.time), y = mode === 'fcurve' ? Y(k.value) : TB + 8 + ri * 18 + 6; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) selKeys.add(key(p, k.time)); } }); } else if (d.mode === 'key') { for (const fc of d.keys) for (const q of fc.keys) delete (q as any)._nt; app.logMsg('cmd', `${mode === 'fcurve' ? 'FCurveEditor' : 'Dopesheet'} "Move ${selKeys.size} key(s)"`); } draw(); };
  cv.oncontextmenu = (e) => e.preventDefault();
  cv.onwheel = (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 0.9 : 1.1; const r = cv.getBoundingClientRect(); const t = invX(e.clientX - r.left), v = invY(e.clientY - r.top); view.t0 = t - (t - view.t0) * f; view.t1 = t + (view.t1 - t) * f; if (mode === 'fcurve' && !e.shiftKey) { view.v0 = v - (v - view.v0) * f; view.v1 = v + (view.v1 - v) * f; } draw(); };
  window.addEventListener('keydown', (e) => { if (e.key === 'Delete' && root.contains(document.activeElement) ) edit('Delete Keys'); });
  cv.addEventListener('redraw', draw); refreshList(); frameAll(); draw();
  app.events.on('selection', () => { refreshList(); if (!lock) frameAll(); draw(); }); app.events.on('params', () => { refreshList(); draw(); }); app.events.on('frame', draw);
}
function niceStep(range: number) { const p = Math.pow(10, Math.floor(Math.log10(range / 4 || 1))); const m = range / 4 / p; return (m < 2 ? 1 : m < 5 ? 2 : 5) * p; }

// ================================================================ Spreadsheet
export function spreadsheet(app: App, host: HTMLElement) {
  const root = el('div', 'sheet'); host.appendChild(root);
  const QUERIES = ['Local Transforms', 'Global Position', 'Visibility', 'Animated Parameters', 'All Parameters of Selection'];
  let query = QUERIES[0];
  const hd = head(menuBtn('Query', () => QUERIES.map(q => ({ label: q })), (l) => { query = l; render(); }), btn('Refresh', 'Refresh', () => render()), btn('Export CSV', 'Download as CSV', () => { const rows = Array.from(tbl.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => '"' + (((td as HTMLElement).querySelector('input') as HTMLInputElement | null)?.value ?? (td as HTMLElement).textContent) + '"').join(',')); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = 'spreadsheet.csv'; a.click(); }));
  root.appendChild(hd); const tbl = el('table', 'sheet-table') as HTMLTableElement; root.appendChild(tbl);
  const render = () => { tbl.innerHTML = ''; const objs = app.selectedObjects.length ? app.selectedObjects : [...app.scene.allObjects()];
    const cols: { label: string; get: (o: X3DObject) => Parameter | undefined }[] = [];
    if (query === 'Local Transforms') for (const k of ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz']) cols.push({ label: k, get: o => o.kinematics.local.get(k) });
    else if (query === 'Global Position') for (const k of ['posx', 'posy', 'posz']) cols.push({ label: 'global.' + k, get: o => o.kinematics.global.get(k) });
    else if (query === 'Visibility') for (const k of ['viewvis', 'rendvis', 'selectability']) cols.push({ label: k, get: o => o.property('visibility')?.get(k) });
    else { const names = new Set<string>(); for (const o of objs) { const sets = query === 'Animated Parameters' ? [o.kinematics.local, ...o.properties] : [o.kinematics.local, ...(o.primitive ? [o.primitive] : []), ...o.properties]; for (const s of sets) for (const p of s.params) if (query !== 'Animated Parameters' || app.anim.isAnimated(p)) names.add(`${s.name}.${p.name}`); } for (const n of [...names].slice(0, 40)) cols.push({ label: n, get: o => { const [sn, pn] = n.split('.'); const s = [o.kinematics.local, ...(o.primitive ? [o.primitive] : []), ...o.properties].find(x => x.name === sn); return s?.get(pn); } }); }
    const hr = el('tr'); hr.appendChild(el('th', '', 'Object')); for (const c of cols) hr.appendChild(el('th', '', c.label)); tbl.appendChild(hr);
    for (const o of objs) { const tr = el('tr'); const nm = el('td', 'nm', o.name); nm.onclick = () => app.select([o]); tr.appendChild(nm); for (const c of cols) { const td = el('td'); const p = c.get(o); if (p) { const i = el('input') as HTMLInputElement; i.value = typeof p.value === 'number' ? String(Math.round(p.value * 1000) / 1000) : String(p.value); i.className = app.anim.isAnimated(p) ? 'anim' : ''; i.onkeydown = e => e.stopPropagation(); i.onchange = () => app.setParam(p, p.def.type === 'bool' ? i.value === 'true' : p.def.type === 'double' || p.def.type === 'int' ? Number(i.value) : i.value); td.appendChild(i); } tr.appendChild(td); } tbl.appendChild(tr); } };
  render(); app.events.on('selection', render); app.events.on('scene', render); app.events.on('params', render); app.events.on('frame', render);
}

// ================================================================ Plugin Manager
export function pluginManager(app: App, host: HTMLElement) {
  const root = el('div', 'plugmgr'); host.appendChild(root);
  const disabled = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem('si.plugins.disabled') ?? '[]')); } catch { return new Set(); } };
  const render = () => { root.innerHTML = ''; root.appendChild(head(btn('Refresh', 'Rescan', render), btn('Unload All User Plug-ins', 'Disable every category', () => { localStorage.setItem('si.plugins.disabled', JSON.stringify(cats.map(c => c[0]))); render(); }), btn('Load All', 'Enable all', () => { localStorage.removeItem('si.plugins.disabled'); render(); })));
    const tree = el('div', 'plug-tree'); root.appendChild(tree); const dis = disabled();
    const byCat = new Map<string, string[]>(); for (const d of app.commands.values()) { const c = d.category ?? 'Other'; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c)!.push(d.name); }
    const cats = [...byCat].sort((a, b) => a[0].localeCompare(b[0]));
    const sec = (title: string, items: [string, string[]][]) => { tree.appendChild(el('div', 'tb-group', title)); for (const [name, cmds] of items) { const r = el('div', 'plug-row' + (dis.has(name) ? ' off' : '')); const cb = el('input') as HTMLInputElement; cb.type = 'checkbox'; cb.checked = !dis.has(name); cb.onchange = () => { const d = disabled(); if (cb.checked) d.delete(name); else d.add(name); localStorage.setItem('si.plugins.disabled', JSON.stringify([...d])); for (const c of cmds) { const def = app.commands.get(c); if (def) (def as any).disabled = !cb.checked; } render(); }; r.append(cb, el('span', 'nm', name), el('span', 'cnt', `${cmds.length} command${cmds.length === 1 ? '' : 's'}`)); r.onclick = (e) => { if (e.target === cb) return; const det = r.nextElementSibling; if (det?.classList.contains('plug-detail')) det.remove(); else { const d = el('div', 'plug-detail', cmds.sort().join(', ')); r.after(d); } }; tree.appendChild(r); } };
    sec('Built-in Plug-ins (command categories)', cats);
    const tbs = JSON.parse(localStorage.getItem('si.toolbars') ?? '[]') as { name: string; tabs: { items: any[] }[] }[]; sec('User Plug-ins (custom toolbars & scripts)', tbs.map(t => [t.name, t.tabs.flatMap(x => x.items.map((i: any) => i.label))] as [string, string[]]));
    sec('Workgroups', [['Local (localStorage)', ['si.toolbars', 'si.layouts', 'si.prefs', 'si.refmodel.*', 'si.scene.*']]]); };
  render();
}

// ================================================================ Netview
export function netview(app: App, host: HTMLElement) {
  const root = el('div', 'netview'); host.appendChild(root);
  const url = el('input') as HTMLInputElement; url.value = (app as any).netviewHome || 'https://help.autodesk.com/view/SI/2015/ENU/'; url.className = 'nv-url'; url.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); };
  const frame = el('iframe', 'nv-frame') as HTMLIFrameElement; frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
  const go = () => { frame.src = url.value; app.logMsg('info', `Netview: ${url.value}`); };
  const BOOK: [string, string][] = [['Softimage 2015 Help', 'https://help.autodesk.com/view/SI/2015/ENU/'], ['SDK Guide', 'https://help.autodesk.com/view/SI/2015/ENU/?guid=__sdk_guide_html'], ['Softimage-Direct (GitHub)', 'https://github.com/Shredder565/Softimage-Direct']];
  root.append(head(btn('◀', 'Back', () => history.back()), btn('▶', 'Forward', () => history.forward()), btn('⟳', 'Reload', go), menuBtn('Bookmarks', () => BOOK.map(([l]) => ({ label: l })), (l) => { const b = BOOK.find(x => x[0] === l); if (b) { url.value = b[1]; go(); } }), url, btn('Go', 'Open', go), btn('↗', 'Open in a new tab', () => window.open(url.value, '_blank'))), frame);
  go();
}

// ================================================================ Image Clips / Sources
export function imageClips(app: App, host: HTMLElement) {
  const root = el('div', 'clips'); host.appendChild(root);
  const clips = (): Shader[] => { const out: Shader[] = []; for (const m of app.scene.materials) { const walk = (s: Shader) => { if (s.spdl?.propset.startsWith('txt2d-image') || s.type === 'Image') out.push(s); for (const i of s.inputs.values()) walk(i); }; if (m.surface) walk(m.surface); } return out; };
  const render = () => { root.innerHTML = ''; root.appendChild(head(btn('Add Clip...', 'Load an image file onto the selection', () => app.run('AddImageClip')), btn('Refresh', '', render)));
    const grid = el('div', 'clip-grid'); root.appendChild(grid); const cs = clips(); if (!cs.length) grid.appendChild(el('div', 'ppg-empty', 'No image clips. Use Add Clip... (an Image node is connected to the material).'));
    for (const c of cs) { const card = el('div', 'clip-card'); const im = el('img') as HTMLImageElement; const src = String(c.val('tex') ?? ''); if (src) im.src = src; card.append(im, el('div', 'nm', c.name), el('div', 'src', (c as any).file ?? (src ? src.slice(0, 24) + '…' : '(no file)'))); card.onclick = () => app.select([c]); card.ondblclick = () => app.events.emit('inspect', c); card.oncontextmenu = (e) => { e.preventDefault(); openSiMenu([{ label: 'Inspect' }, { label: 'Replace Image...' }, { label: 'Select Objects Using Clip' }], e.clientX, e.clientY, (it) => { if (it.label === 'Inspect') app.events.emit('inspect', c); else if (it.label === 'Replace Image...') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { c.set('tex', String(r.result)); (c as any).file = f.name; app.events.emit('scene'); render(); }; r.readAsDataURL(f); }; inp.click(); } else { let m: any = c; while (m && !(m instanceof Material)) m = m.parent; if (m) app.select([...app.scene.allObjects()].filter(o => o.material === m)); } }); }; grid.appendChild(card); } };
  render(); app.events.on('scene', render);
}

// ================================================================ Render Manager
export function renderManager(app: App, host: HTMLElement) {
  const root = el('div', 'rendmgr'); host.appendChild(root);
  // Softimage Passes.RenderOptions defaults (si_render_prefs.json): 1920x1080, OutputDir Render_Pictures
  const ro = () => app.scene.renderOptions;
  const opts = {
    width: Number(ro()?.val('ImageWidth') ?? 1920),
    height: Number(ro()?.val('ImageHeight') ?? 1080),
    path: 'Render_Pictures/[Pass]_[Framebuffer].png',
    frames: 'current' as 'current' | 'range',
    pass: app.scene.passes[0]?.name ?? 'Default_Pass',
  };
  const render = () => { root.innerHTML = ''; root.appendChild(head(btn('Render Current Frame', 'Render the active camera at the output resolution', () => doRender(false)), btn('Render Pass', 'Render the pass frame range to a Flipbook', () => doRender(true)), btn('Preview', 'Render preview window', () => doRender(false))));
    const form = el('div', 'dlg');
    const row = (label: string, ctl: HTMLElement) => { const r = el('div', 'row'); r.append(el('label', '', label), ctl); form.appendChild(r); };
    const passSel = el('select') as HTMLSelectElement; for (const p of app.scene.passes) { const o = el('option', '', p.name); passSel.appendChild(o); } passSel.value = opts.pass; passSel.onchange = () => { opts.pass = passSel.value; }; row('Current Pass', passSel);
    const pw = el('input') as HTMLInputElement; pw.type = 'number'; pw.value = String(opts.width); pw.onchange = () => { opts.width = Number(pw.value); }; row('Image Width', pw);
    const ph = el('input') as HTMLInputElement; ph.type = 'number'; ph.value = String(opts.height); ph.onchange = () => { opts.height = Number(ph.value); }; row('Image Height', ph);
    const pp = el('input') as HTMLInputElement; pp.value = opts.path; pp.onchange = () => { opts.path = pp.value; }; row('Output Path', pp);
    for (const i of [pw, ph, pp]) i.onkeydown = e => e.stopPropagation();
    const pass = app.scene.passes.find(p => p.name === opts.pass); if (pass) { const fs = el('input') as HTMLInputElement; fs.type = 'number'; fs.value = String(pass.val('FrameStart')); fs.onchange = () => app.setParam(pass.get('FrameStart')!, Number(fs.value)); row('Frame Start', fs); const fe = el('input') as HTMLInputElement; fe.type = 'number'; fe.value = String(pass.val('FrameEnd')); fe.onchange = () => app.setParam(pass.get('FrameEnd')!, Number(fe.value)); row('Frame End', fe); }
    const np = btn('New Pass', 'Create a render pass', () => { app.run('CreatePass', { Name: 'Pass' }); render(); }); form.appendChild(np);
    root.appendChild(form); root.appendChild(el('div', 'hint', 'Renderer: viewport shading (three.js) at the output resolution. Pictures download as PNG; a pass range opens a Flipbook.'));
  };
  const doRender = (range: boolean) => { const three = (window as any).__three; if (!three?.scene) { app.logMsg('error', 'No viewport to render from'); return; } const cam = (window as any).__activeCamera as THREE.Camera | undefined; if (!cam) { app.logMsg('error', 'No active camera'); return; }
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(opts.width, opts.height); r.shadowMap.enabled = true; const c = cam.clone() as any; if (c.aspect !== undefined) { c.aspect = opts.width / opts.height; c.updateProjectionMatrix(); }
    const pass = app.scene.passes.find(p => p.name === opts.pass); const frames: string[] = []; const A = app.anim; const f0 = range && pass ? Number(pass.val('FrameStart')) : A.frame, f1 = range && pass ? Number(pass.val('FrameEnd')) : A.frame; const cur = A.frame;
    for (let f = f0; f <= f1; f++) { if (range) { A.frame = f; three.needs?.(); } r.render(three.scene, c); frames.push(r.domElement.toDataURL('image/png')); if (frames.length > 300) break; }
    if (range) A.frame = cur; r.dispose();
    const name = opts.path.replace('[Pass]', opts.pass).replace('[Frame]', String(f0).padStart(4, '0')).split('/').pop()!.replace(/\.png$/, '');
    if (frames.length === 1) { const w = window.open('', '_blank'); if (w) { w.document.write(`<title>${name}</title><body style="margin:0;background:#222;text-align:center"><a download="${name}.png" href="${frames[0]}" style="color:#ddd;font:12px Tahoma">save ${name}.png</a><br><img src="${frames[0]}"></body>`); w.document.close(); } else { const a = document.createElement('a'); a.href = frames[0]; a.download = name + '.png'; a.click(); } }
    else { window.dispatchEvent(new CustomEvent('flipbook-frames', { detail: { frames, name } })); }
    app.logMsg('info', `Rendered ${frames.length} frame(s) at ${opts.width}x${opts.height}`); };
  render(); app.events.on('scene', render);
}

// ================================================================ Material Manager / Material Panel
export function materialManager(app: App, host: HTMLElement) {
  const root = el('div', 'matmgr'); host.appendChild(root);
  const render = () => { root.innerHTML = ''; root.appendChild(head(menuBtn('New', () => Object.keys(MATERIAL_PRESETS).map(l => ({ label: l })), (l) => app.run('SIApplyShader', { PresetObj: l, InputObjs: app.selectedObjects })), btn('Assign', 'Assign the highlighted material to the selection', () => { const m = currentMaterial(app); if (m) app.run('AssignMaterial', { InputObjs: app.selectedObjects, Material: m.name }); }), btn('Select Users', 'Select objects using the material', () => { const m = currentMaterial(app); if (m) app.select([...app.scene.allObjects()].filter(o => o.material === m)); }), btn('Delete Unused', 'Delete unused materials', () => { const used = new Set([...app.scene.allObjects()].map(o => o.material)); const ms = app.scene.materials; for (const m of [...ms]) if (!used.has(m) && m !== app.scene.root.material) ms.splice(ms.indexOf(m), 1); app.events.emit('scene'); })));
    const grid = el('div', 'mat-grid'); root.appendChild(grid); const cur = currentMaterial(app);
    for (const m of app.scene.materials) { const card = el('div', 'mat-card' + (m === cur ? ' on' : '')); const ball = el('div', 'shaderball'); const d = m.diffuse; ball.style.background = `radial-gradient(circle at 35% 30%, #fff 0, rgb(${d.map(x => Math.round(x * 255)).join(',')}) 35%, #000 100%)`; const users = [...app.scene.allObjects()].filter(o => o.material === m).length; card.append(ball, el('div', 'nm', m.name), el('div', 'src', `${m.surface?.type ?? '—'} · ${users} user${users === 1 ? '' : 's'}`)); card.onclick = () => app.select([m]); card.ondblclick = () => app.events.emit('inspect', m); card.oncontextmenu = (e) => { e.preventDefault(); openSiMenu((SI_MENUS.explorerContext ?? []).find(i => i.label === '__Material__')?.items ?? [], e.clientX, e.clientY, (it) => { const l = it.label ?? ''; if (l === 'Assign to Selection') app.run('AssignMaterial', { InputObjs: app.selectedObjects, Material: m.name }); else if (l === 'Select Objects with this Material') app.select([...app.scene.allObjects()].filter(o => o.material === m)); else if (l === 'Duplicate Material') { app.select([m]); app.run('SIApplyShader', { PresetObj: m.surface?.type ?? 'Phong', InputObjs: app.selectedObjects }); } else if (l === 'Create Material') app.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: app.selectedObjects }); else app.logMsg('info', `${l}: not available`); }); }; grid.appendChild(card); } };
  render(); app.events.on('scene', render); app.events.on('selection', render); app.events.on('params', render);
}
export function materialPanel(app: App, host: HTMLElement) { const root = el('div', 'matpanel'); host.appendChild(root); const info = el('div', 'rt-title'); root.appendChild(info); const body = el('div'); root.appendChild(body); const render = () => { const m = currentMaterial(app); info.textContent = m ? `${m.name} — ${m.surface?.type ?? ''}` : 'No material'; body.innerHTML = ''; if (!m?.surface) return; const sh = m.surface; for (const p of ['diffuse', 'ambient', 'specular', 'shiny', 'transparency', 'reflectivity']) { const q = sh.get(p); if (!q) continue; const r = el('div', 'row'); r.append(el('label', '', q.label)); if (q.def.type === 'color') { const c = el('input') as HTMLInputElement; c.type = 'color'; const v = q.value as number[]; c.value = '#' + v.slice(0, 3).map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join(''); c.onchange = () => app.setParam(q, [1, 3, 5].map(i => parseInt(c.value.slice(i, i + 2), 16) / 255)); r.appendChild(c); } else { const i = el('input') as HTMLInputElement; i.type = 'number'; i.step = '0.1'; i.value = String(q.value); i.onkeydown = e => e.stopPropagation(); i.onchange = () => app.setParam(q, Number(i.value)); r.appendChild(i); } body.appendChild(r); } }; render(); app.events.on('selection', render); app.events.on('scene', render); app.events.on('params', render); root.classList.add('dlg'); }

// ================================================================ Weight Paint Panel & Preset Manager
export function weightPaintPanel(app: App, host: HTMLElement) {
  const root = el('div', 'wpaint dlg'); host.appendChild(root);
  root.appendChild(el('div', 'tb-group', 'Paint Tools'));
  for (const [l, c, t] of [['Paint Weights (W)', 'PaintTool', 'Paint weight map values'], ['Paint Push', 'PaintPushTool', 'Push geometry with the brush'], ['Paint Vertex Colors', 'PaintVertexColorTool', 'Paint CAV vertex colours'], ['Smooth Weights', 'SmoothWeightsTool', 'Smooth the weight map'], ['Brush Properties...', 'BrushProperties', 'Inspect the brush']] as const) root.appendChild(btn(l, t, () => { if (app.commands.has(c)) app.run(c); else app.logMsg('info', `${c}: not available`); }));
  root.appendChild(el('div', 'tb-group', 'Brush'));
  const bp = (app as any).brushProps?.(); // the shared Brush Properties property (same one the paint tools use) if (bp?.params) for (const [k, l, mn, mx] of [['radius', 'Radius', 0.05, 10], ['opacity', 'Opacity', 0, 1], ['weight', 'Weight', 0, 1], ['push', 'Push Amount', -5, 5]] as const) { const r = el('div', 'row'); const i = el('input') as HTMLInputElement; i.type = 'range'; i.min = String(mn); i.max = String(mx); i.step = '0.01'; i.value = String(bp.val(k) ?? 0); const v = el('span', '', String(bp.val(k) ?? 0)); i.oninput = () => { bp.set(k, Number(i.value)); v.textContent = i.value; }; r.append(el('label', '', l), i, v); root.appendChild(r); }
  root.appendChild(el('div', 'tb-group', 'Weight Maps on Selection')); const list = el('div'); root.appendChild(list);
  const render = () => { list.innerHTML = ''; for (const o of app.selectedObjects) for (const p of o.allProperties()) if (p.type === 'weightmap' || p.type === 'vertexcolor' || p.type === 'envelope') { const b = btn(`${o.name}.${p.name}`, 'Inspect', () => app.events.emit('inspect', p)); list.appendChild(b); } if (!list.childElementCount) list.appendChild(el('div', 'hint', 'No weight maps (Get > Property > Weight Map, or paint).')); };
  render(); app.events.on('selection', render); app.events.on('scene', render);
}
export function presetManager(app: App, host: HTMLElement) {
  const root = el('div', 'presetmgr'); host.appendChild(root);
  const CATS: Record<string, [string, () => void][]> = {
    'Primitives › Polygon Mesh': ['Cube', 'Sphere', 'Cylinder', 'Cone', 'Torus', 'Grid', 'Disc'].map(p => [p, () => app.run('CreatePrim', { PresetObj: p, GeometryType: 'MeshSurface' })] as [string, () => void]),
    'Primitives › Surface': ['Grid', 'Sphere', 'Cylinder', 'Torus', 'Disc'].map(p => [p, () => app.run('CreatePrim', { PresetObj: p, GeometryType: 'NurbsSurface' })] as [string, () => void]),
    'Primitives › Curve': ['Circle', 'Arc', 'Square', 'Spiral'].map(p => [p, () => app.run('CreatePrim', { PresetObj: p, GeometryType: 'NurbsCurve' })] as [string, () => void]),
    'Models': Object.keys(PRESET_MODELS).map(p => [p, () => app.run('GetPresetModel', { ModelName: PRESET_MODELS[p] })] as [string, () => void]),
    'Materials': Object.keys(MATERIAL_PRESETS).map(p => [p, () => app.run('SIApplyShader', { PresetObj: p, InputObjs: app.selectedObjects })] as [string, () => void]),
    'Textures': Object.keys(TEXTURE_NODES).map(p => [p, () => { const m = currentMaterial(app); if (m?.surface) app.run('ConnectShaderNode', { Shader: m.surface, Port: 'diffuse', Preset: p }); }] as [string, () => void]),
  };
  const sel = el('select') as HTMLSelectElement; for (const k of Object.keys(CATS)) sel.appendChild(el('option', '', k)); const search = el('input') as HTMLInputElement; search.placeholder = 'filter'; search.onkeydown = e => e.stopPropagation();
  root.appendChild(head(sel, search)); const list = el('div', 'tb-items'); root.appendChild(list);
  const render = () => { list.innerHTML = ''; const q = search.value.toLowerCase(); for (const [l, fn] of CATS[sel.value]) if (!q || l.toLowerCase().includes(q)) list.appendChild(btn(l, 'Apply preset', fn)); };
  sel.onchange = render; search.oninput = render; render();
}
export function animationMixer(app: App, host: HTMLElement) {
  const root = el('div', 'mixer'); host.appendChild(root);
  const sources = () => {
    const hostModel = app.selectedObjects[0]?.model ?? app.scene.root;
    return [...hostModel.properties.filter(p => p.type === 'actionsource'), ...app.scene.root.properties.filter(p => p.type === 'actionsource')];
  };
  const mix = () => (app.selectedObjects[0]?.model ?? app.scene.root).property('mixer') ?? app.scene.root.property('mixer');
  // Softimage Animation Mixer menubar labels from XSIANIMATIONMIXER.dict / anim_chrome tokens
  const mm = mixerMenuLabels();
  const hd = head(
    menuBtn(mm[0] || 'Edit', () => [{ label: 'Store Action' }, { label: 'Apply Action' }, { separator: true }, { label: 'Equalize Clips' }], (l) => {
      if (l === 'Store Action') app.run('StoreAction', { Name: prompt('Action name:', 'Action') || 'Action', AddClip: true });
      else if (l === 'Apply Action') app.run('ApplyAction');
      else if (l === 'Equalize Clips') app.run('EqualizeClips');
      render();
    }),
    menuBtn(mm[1] || 'View', () => [{ label: 'Refresh' }, { label: 'Frame All' }], () => render()),
    menuBtn(mm[2] || 'Track', () => [{ label: 'Insert Animation Track' }, { label: 'Insert Shape Track' }], (l) => { app.logMsg('info', `Mixer: ${l}`); }),
    menuBtn(mm[3] || 'Clip', () => [{ label: 'Add Transition' }, { label: 'Add Bridge Transition' }, { label: 'Create Compound' }], (l) => {
      if (l === 'Add Transition') app.run('AddTransition');
      else if (l === 'Add Bridge Transition') app.run('AddBridgeTransition');
      else if (l === 'Create Compound') app.run('CreateCompound');
      render();
    }),
    btn('Store Action', 'Store selection animation as an action source on the model', () => { app.run('StoreAction', { Name: prompt('Action name:', 'Action') || 'Action', AddClip: true }); render(); }),
    btn('Apply', 'Apply the selected action source', () => { app.run('ApplyAction'); render(); }),
    btn('Refresh', '', () => render()),
  );
  // Extra PNG toolbar glyphs (#50) — PE ids not in the #47 BMP wire set (34–42,75 + 78–99)
  for (const id of [34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]) {
    const img = el('img', 'mixer-ico') as HTMLImageElement;
    img.src = `si/anim/animationmixer_rtbitmap_${id}.png`;
    img.width = 16; img.height = 16; img.alt = ''; img.title = `Mixer tool PE ${id}`;
    hd.appendChild(img);
  }
  root.appendChild(hd);
  const tracksEl = el('div', 'mixer-tracks'); root.appendChild(tracksEl);
  const render = () => {
    tracksEl.innerHTML = '';
    const m = mix();
    tracksEl.appendChild(el('div', 'hint', m ? `Mixer: ${m.val('Name') || 'Mixer'} · Active=${m.val('Active')} · Start=${m.val('start')} · Duration=${m.val('duration')}` : 'No Mixer on Scene_Root'));
    const all = sources();
    if (!all.length) tracksEl.appendChild(el('div', 'hint', 'No action sources. Store Action keeps current values / f-curves as a reusable source (Softimage Animation Mixer).'));
    for (const a of all) {
      const nKeys = (() => { try { return Object.keys(JSON.parse(a.val('fcurves') || '{}')).length; } catch { return 0; } })();
      const b = btn(`${a.name} (${a.val('items') || 0} params, ${nKeys} fcurves)`, 'Select / apply this action source', () => { app.select([a]); app.run('ApplyAction'); });
      tracksEl.appendChild(b);
    }
    const clips: any[] = (m as any)?.clips ?? [];
    const byTrack = new Map<number, any[]>();
    for (const c of clips) { const t = c.track ?? 0; if (!byTrack.has(t)) byTrack.set(t, []); byTrack.get(t)!.push(c); }
    if (clips.length) {
      for (const [ti, list] of [...byTrack.entries()].sort((a, b) => a[0] - b[0])) {
        const row = el('div', 'mixer-track-row');
        row.appendChild(el('div', 'mixer-track-label', `Animation Track ${ti}`));
        for (const c of list) {
          const bar = el('div', 'mixer-clip-bar', `${c.name} · ${c.source ?? ''} @${c.start} (${c.duration}f)${c.mute ? ' [mute]' : ''}${c.additive ? ' [add]' : ''}`);
          bar.onclick = () => app.run('SelectObj', { InputObjs: c.source });
          row.appendChild(bar);
        }
        tracksEl.appendChild(row);
      }
    }
    const transitions: any[] = (m as any)?.transitions ?? [];
    if (transitions.length) {
      tracksEl.appendChild(el('div', 'hint', `Transitions (${transitions.length}):`));
      for (const t of transitions) tracksEl.appendChild(el('div', 'hint', `• ${t.kind}: ${t.from} → ${t.to} (${t.length}f)`));
    }
    const compounds: any[] = (m as any)?.compounds ?? [];
    if (compounds.length) {
      tracksEl.appendChild(el('div', 'hint', `Compounds (${compounds.length}):`));
      for (const c of compounds) tracksEl.appendChild(el('div', 'hint', `• ${c.name}: [${(c.clips || []).join(', ')}] @ ${c.start}`));
    }
    root.querySelector('.mixer-actions')?.remove();
    const actions = el('div', 'mixer-actions');
    actions.append(
      btn('Add Transition', 'Bridge last two clips', () => { app.run('AddTransition'); render(); }),
      btn('Create Compound', 'Compound all clips', () => { app.run('CreateCompound'); render(); }),
      btn('Equalize', 'Pack clips end-to-end', () => { app.run('EqualizeClips'); render(); }),
    );
    root.appendChild(actions);
  };
  app.events.on('scene', render); app.events.on('params', render); render();
}
export { Property };

// ================================================================ ICE Tree (node editor for ICETree operators)
// Softimage icetree.xsivw + preferences.icetree + Desktop modules-gdi client GDI (Gate B). Tour 12-ice-tree.png LOCK.
export function iceTree(app: App, host: HTMLElement) {
  applyIceTreeChromeVars();
  const root = el('div', 'rtree icetree'); host.appendChild(root);
  type IceDef = {
    category?: string; defaultsize?: number[]; clsid?: string; cmdmap?: string;
    supportedtypes?: string; maxinstances?: string; private?: string; acceptfocus?: string;
    status?: string; client_gdi?: string;
  };
  const iceDef = (iceViewChrome as { views?: Record<string, IceDef> }).views?.['ICE Tree'];
  const prefs = (iceViewChrome as {
    prefs_layout?: {
      preset_manager_size?: number; explorer_size?: number;
      leftcompoundbar_size?: number; rightcompoundbar_size?: number;
      create_node_mode?: number; ice_selection_locked?: boolean;
      allow_explorer_selection?: boolean; allow_explorer_node_skipping?: boolean;
      create_node_shortcutdelimiter?: string; apply_as_css_vars?: boolean; status?: string;
    };
    client_gdi?: { status?: string };
  });
  const pl = prefs.prefs_layout;
  if (iceDef?.category) root.dataset.siCategory = iceDef.category;
  if (iceDef?.defaultsize) root.dataset.siDefaultsize = iceDef.defaultsize.join(',');
  if (iceDef?.clsid) root.dataset.siClsid = iceDef.clsid;
  if (iceDef?.cmdmap) root.dataset.siCmdmap = iceDef.cmdmap;
  if (iceDef?.supportedtypes) root.dataset.siSupportedtypes = iceDef.supportedtypes;
  if (iceDef?.maxinstances) root.dataset.siMaxinstances = iceDef.maxinstances;
  if (iceDef?.private) root.dataset.siPrivate = iceDef.private;
  if (iceDef?.acceptfocus) root.dataset.siAcceptfocus = iceDef.acceptfocus;
  root.dataset.siStatus = iceDef?.status ?? 'CLIENT_GDI';
  root.dataset.siClientGdi = iceDef?.client_gdi ?? prefs.client_gdi?.status ?? 'DUMP_READY';
  if (pl) {
    root.dataset.siPresetManagerSize = String(pl.preset_manager_size ?? '');
    root.dataset.siExplorerSize = String(pl.explorer_size ?? '');
    root.dataset.siLeftCompoundbarSize = String(pl.leftcompoundbar_size ?? '');
    root.dataset.siRightCompoundbarSize = String(pl.rightcompoundbar_size ?? '');
    root.dataset.siCreateNodeMode = String(pl.create_node_mode ?? 0);
    root.dataset.siSelectionLocked = String(!!pl.ice_selection_locked);
    root.dataset.siAllowExplorerSelection = String(!!pl.allow_explorer_selection);
    root.dataset.siAllowExplorerNodeSkipping = String(!!pl.allow_explorer_node_skipping);
    root.dataset.siShortcutDelimiter = pl.create_node_shortcutdelimiter ?? ':';
    root.dataset.siPrefsLayoutStatus = pl.status ?? '';
    root.dataset.siPrefsApplyCss = String(!!pl.apply_as_css_vars);
  }
  const createNodeMode = () => Number(root.dataset.siCreateNodeMode ?? pref('C3DPrefsICETree', 'create_node_mode') ?? 0);
  const treeOf = (): ICETreeOperator | null => { const sel = app.selection[app.selection.length - 1] as any; if (sel instanceof ICETreeOperator) return sel; const o: X3DObject | null = app.selectedObjects.find(x => x.primitive?.operators.some(op => op instanceof ICETreeOperator)) ?? (sel?.parent?.parent instanceof X3DObject ? sel.parent.parent : null); return (o?.primitive?.operators.slice().reverse().find((op: any) => op instanceof ICETreeOperator) as ICETreeOperator) ?? null; };
  const cats = ICE_CATEGORIES();
  const nodesMenu = () => [...[...cats.entries()].map(([c, types]) => ({ label: c, items: types.map(t => ({ label: t })) })), { separator: true }, { label: 'Compounds', items: ICE_PRESETS.map(p => ({ label: p })) }];
  const lockMenu = (label: string) => [{ label: `${label} leaves LOCK (no invent)` }];
  const addNode = (type: string) => { let t = treeOf(); if (!t) { const o = app.selectedObjects.find(x => x.primitive?.mesh()); if (!o) { app.logMsg('error', 'ICE Tree: select a polygon mesh first'); return; } t = app.run('ApplyICEOp', { File: '', Target: o.fullName }) as ICETreeOperator; } if (ICE_PRESETS.includes(type)) { buildPreset(t, type); } else t.addNode(type, 40 + canvas.scrollLeft + Math.random() * 120, 40 + canvas.scrollTop + Math.random() * 120); app.events.emit('scene'); render(); };
  // Desktop 20-ice-tree.png menubar: Create Show Tools Nodes Compounds User Tools
  const tb = iceToolbarShellLabels();
  const menubar = el('div', 'ice-menubar xp-head');
  for (const label of tb) {
    if (label === 'Nodes') menubar.appendChild(menuBtn('Nodes', nodesMenu, (l) => addNode(l)));
    else if (label === 'Compounds') menubar.appendChild(menuBtn('Compounds', () => ICE_PRESETS.map(p => ({ label: p })), (l) => addNode(l)));
    else menubar.appendChild(menuBtn(label, () => lockMenu(label), () => { /* flyout leaves LOCK */ }));
  }
  const title = el('span', 'rt-title'); menubar.appendChild(title); root.appendChild(menubar);
  // Desktop toolbar text buttons (icon bitmaps LOCK)
  const tbText = iceToolbarTextLabels();
  const toolStrip = el('div', 'ice-toolbar-text xp-head');
  for (const label of tbText) {
    if (label === 'Attr. Editor') {
      toolStrip.appendChild(btn('Attr. Editor', 'Open ICE Attribute Editor', () => {
        window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'ICE Attribute Editor' } }));
      }));
    } else {
      toolStrip.appendChild(btn(label, label, () => { /* highlight modes LOCK without enum dump */ }));
    }
  }
  root.appendChild(toolStrip);

  // Desktop region layout: left palette | canvas | right explorer (prefs sizes as CSS)
  const body = el('div', 'ice-body');
  const palette = el('div', 'ice-palette');
  const searchRow = el('div', 'ice-palette-search');
  searchRow.appendChild(el('span', 'ice-palette-search-label', 'Search'));
  const searchInp = document.createElement('input'); searchInp.className = 'ice-palette-search-input'; searchInp.type = 'text'; searchRow.appendChild(searchInp);
  palette.appendChild(searchRow);
  const tabs = el('div', 'ice-palette-tabs');
  let activeTab = icePaletteTabs()[0] ?? 'Task';
  const tabBtns: HTMLButtonElement[] = [];
  for (const tab of icePaletteTabs()) {
    const b = el('button', 'ice-palette-tab' + (tab === activeTab ? ' on' : ''), tab) as HTMLButtonElement;
    b.onclick = () => { activeTab = tab; tabBtns.forEach(x => x.classList.toggle('on', x.textContent === tab)); renderPalette(); };
    tabBtns.push(b); tabs.appendChild(b);
  }
  palette.appendChild(tabs);
  const catList = el('div', 'ice-palette-cats');
  const nodeList = el('div', 'ice-palette-nodes');
  palette.append(catList, nodeList);
  let activeCat = iceTaskCategoriesVisible()[0] ?? 'All Nodes';
  const renderPalette = () => {
    catList.innerHTML = ''; nodeList.innerHTML = '';
    const visible = iceTaskCategoriesVisible();
    for (const c of visible) {
      const row = el('div', 'ice-palette-cat' + (c === activeCat ? ' on' : ''), c);
      row.onclick = () => { activeCat = c; renderPalette(); };
      catList.appendChild(row);
    }
    // Node leaves from Softimage Task tab are LOCK (truncated in PNG). All Nodes → AfterImage ICE_NODES (already Softimage-derived).
    if (activeTab === 'Task' && (activeCat === 'All Nodes' || activeCat === 'Favorites')) {
      const types = activeCat === 'Favorites' ? ICE_PRESETS : Object.keys(ICE_NODES);
      const q = searchInp.value.trim().toLowerCase();
      for (const t of types) {
        if (q && !t.toLowerCase().includes(q)) continue;
        const row = el('div', 'ice-palette-node', t);
        row.onclick = () => addNode(t);
        nodeList.appendChild(row);
      }
    } else {
      nodeList.appendChild(el('div', 'ice-palette-lock', 'node leaves LOCK (Desktop truncated; no invent)'));
    }
  };
  searchInp.oninput = () => renderPalette();
  renderPalette();

  const canvas = el('div', 'rt-canvas ice-canvas');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'rt-links'); canvas.appendChild(svg);

  const explorer = el('div', 'ice-explorer');
  const explorerHead = el('div', 'ice-explorer-head', 'Explorer');
  const explorerTree = el('div', 'ice-explorer-tree');
  explorer.append(explorerHead, explorerTree);
  const renderExplorer = () => {
    explorerTree.innerHTML = '';
    const objs = app.scene.root.children;
    if (!objs.length) { explorerTree.appendChild(el('div', 'ice-explorer-empty', '(empty)')); return; }
    for (const o of objs) {
      const row = el('div', 'ice-explorer-row', o.name);
      if (o.primitive?.operators.some(op => op instanceof ICETreeOperator)) row.classList.add('has-ice');
      row.onclick = () => { app.select([o]); };
      explorerTree.appendChild(row);
      const mesh = o.primitive?.mesh();
      if (mesh) {
        explorerTree.appendChild(el('div', 'ice-explorer-row child', 'Polygon Mesh'));
        explorerTree.appendChild(el('div', 'ice-explorer-row child2', 'Geometry'));
        if (o.material) explorerTree.appendChild(el('div', 'ice-explorer-row child2', o.material.name || 'Scene_Material'));
      }
    }
  };

  body.append(palette, canvas, explorer);
  root.appendChild(body);

  let pending: { node: number; port: string } | null = null; let selected: number | null = null;
  const render = () => {
    const t = treeOf(); canvas.querySelectorAll('.rt-node').forEach(n => n.remove()); svg.innerHTML = ''; title.textContent = t ? `${(t.parent as any)?.parent?.name ?? ''} : ${t.name} (${t.nodes.length} nodes)` : 'Select an object with an ICE tree (or Nodes > … to create one)'; renderExplorer(); if (!t) return;
    const mode = createNodeMode(); // 0 Expanded / 1 Collapsed / 2 Connections only — C3DPrefsICETree
    const boxes = new Map<number, { el: HTMLElement; outs: Map<string, HTMLElement>; ins: Map<string, HTMLElement> }>();
    for (const n of t.nodes) {
      const def = ICE_NODES[n.type]; const b = el('div', 'rt-node ice' + (n.id === selected ? ' selected' : '') + (n.type === 'Set Data' || n.type === 'Execute' ? ' material' : '') + (mode === 1 ? ' collapsed' : '') + (mode === 2 ? ' connections-only' : '')); b.style.left = n.x + 'px'; b.style.top = n.y + 'px';
      const tt = el('div', 'rt-node-title', n.type === 'Get Data' || n.type === 'Set Data' ? `${n.type}: ${n.params.val('reference')}` : n.type); b.appendChild(tt);
      if (mode === 0) { const vals = n.params.params.filter(p => p.name !== 'reference').slice(0, 3).map(p => `${p.name}=${Array.isArray(p.value) ? '[' + p.value.join(',') + ']' : typeof p.value === 'number' ? Math.round(p.value * 100) / 100 : p.value}`).join(' '); if (vals) b.appendChild(el('div', 'rt-node-type', vals)); }
      const ins = new Map<string, HTMLElement>(), outs = new Map<string, HTMLElement>();
      if (mode !== 1) {
        for (const ip of def?.inputs ?? []) { const r = el('div', 'rt-port-row' + (t.links.some(l => l.to === n.id && l.toPort === ip.name) ? ' connected' : '')); const dot = el('div', 'rt-port in ' + ip.type); dot.title = `${ip.name} (${ip.type})`; r.append(dot, mode === 2 ? el('span', '', '') : el('span', '', ip.name)); b.appendChild(r); ins.set(ip.name, dot);
          dot.onclick = (e) => { e.stopPropagation(); if (pending) { t.connect(pending.node, pending.port, n.id, ip.name); pending = null; } else t.disconnect(n.id, ip.name); app.events.emit('scene'); render(); }; }
        for (const op of def?.outputs ?? []) { const r = el('div', 'rt-port-row right'); const dot = el('div', 'rt-port outp ' + op.type); dot.title = `${op.name} (${op.type}) — click, then click an input`; r.append(mode === 2 ? el('span', '', '') : el('span', '', op.name), dot); b.appendChild(r); outs.set(op.name, dot);
          dot.onclick = (e) => { e.stopPropagation(); pending = pending && pending.node === n.id && pending.port === op.name ? null : { node: n.id, port: op.name }; canvas.querySelectorAll('.rt-port.outp').forEach(o => o.classList.remove('pending')); if (pending) dot.classList.add('pending'); }; }
      }
      b.onclick = () => { selected = n.id; app.select([n.params as any]); render(); }; b.ondblclick = () => app.events.emit('inspect', n.params);
      b.oncontextmenu = (e) => { e.preventDefault(); openSiMenu([{ label: 'Inspect' }, { label: 'Duplicate' }, { separator: true }, { label: 'Delete' }], e.clientX, e.clientY, (it) => { if (it.label === 'Inspect') app.events.emit('inspect', n.params); else if (it.label === 'Delete') { t.removeNode(n.id); app.events.emit('scene'); render(); } else if (it.label === 'Duplicate') { const d = t.addNode(n.type, n.x + 30, n.y + 30); for (const p of n.params.params) d.params.set(p.name, p.value); render(); } }); };
      let drag: { sx: number; sy: number; x: number; y: number } | null = null; tt.onpointerdown = (e) => { drag = { sx: e.clientX, sy: e.clientY, x: n.x, y: n.y }; tt.setPointerCapture(e.pointerId); }; tt.onpointermove = (e) => { if (!drag) return; n.x = Math.max(0, drag.x + e.clientX - drag.sx); n.y = Math.max(0, drag.y + e.clientY - drag.sy); b.style.left = n.x + 'px'; b.style.top = n.y + 'px'; drawLinks(); }; tt.onpointerup = () => { drag = null; };
      canvas.appendChild(b); boxes.set(n.id, { el: b, outs, ins });
    }
    const drawLinks = () => { svg.innerHTML = ''; const c = canvas.getBoundingClientRect(); for (const l of t.links) { const a = boxes.get(l.from)?.outs.get(l.fromPort), b2 = boxes.get(l.to)?.ins.get(l.toPort); if (!a || !b2) continue; const ra = a.getBoundingClientRect(), rb = b2.getBoundingClientRect(); const x1 = ra.right - c.left + canvas.scrollLeft, y1 = ra.top + ra.height / 2 - c.top + canvas.scrollTop, x2 = rb.left - c.left + canvas.scrollLeft, y2 = rb.top + rb.height / 2 - c.top + canvas.scrollTop; const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', `M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`); path.setAttribute('class', 'rt-link ice'); svg.appendChild(path); } };
    requestAnimationFrame(drawLinks);
  };
  render(); app.events.on('selection', render); app.events.on('scene', render); new ResizeObserver(render).observe(canvas);
}
