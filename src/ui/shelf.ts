// Main Shelf (Application/toolbars/Main_Shelf.xsitb) and Panel Switcher (PanelSwitcher.xsitb), rendered from the
// real toolbar definitions with Softimage's own bitmaps. Buttons run the shelf's VBScript lines through runScriptLine.
import { layoutNames, currentLayoutName, switchLayout } from './layout';
import { App } from '../core/commands';
import { SI_SHELF, SI_PANELSWITCHER, siIcon, hasIcon, runScriptLine } from './si';
import { openMenu } from './toolbarPanel';
import menus from '../data/menus.json';

type Item = { type: string; label: string | null; bitmap: string | null; tooltip: string | null; script?: string };

/** Run a shelf script: executes the command lines it contains (VBScript control flow is skipped; a command that appears in
 *  several branches runs once) and handles the "Menu Window" scripts that pop a module sub-menu. */
export function runShelfScript(app: App, script: string, at?: { x: number; y: number }) {
  const mw = /SetAttributeValue\s+"TargetContent",\s*"([^"]+)"/.exec(script);
  if (mw) { openMenuWindow(app, mw[1], at); return; }
  const seen = new Set<string>(); const lines: string[] = [];
  for (const raw of script.split(/\r?\n/)) {
    const l = raw.trim(); if (!l || /^('|\/\/)/.test(l)) continue;
    if (/^(if|elseif|else|end if|end|on error|dim|wend|while|next|for)\b/i.test(l)) continue;
    if (/^\w+\s*=\s*/.test(l) && !/^set\s+\w+\s*=\s*\w+\s*\(/i.test(l)) continue; // `vw = GetFocusedViewport`, `oCam = ...`
    const m = /^(?:set\s+\w+\s*=\s*)?(?:application\.)?(\w+)/i.exec(l); if (!m) continue;
    const name = m[1];
    if (/^(cmd|oCmd|oView|v|vw|layout)$/i.test(name)) { // `set cmd = application.commands("Navigation Tool")` + `cmd.execute`
      const c = /commands\s*\(\s*"([^"]+)"/i.exec(l); if (c) { lines.push(`__named ${c[1]}`); }
      continue;
    }
    if (seen.has(name)) continue; seen.add(name); lines.push(l);
  }
  for (const l of lines) {
    if (l.startsWith('__named ')) { const n = l.slice(8); const def = [...app.commands.values()].find(d => d.label === n || d.name === n.replace(/\s+/g, '')); if (def) { try { app.run(def.name); } catch { /* logged */ } } else app.logMsg('error', `${n}: command not implemented`); continue; }
    runScriptLine(app, l.replace(/getviewcamera\s*\(-1\)\s*,?/i, '"Views.ViewB.Camera",'));
  }
}

/** Softimage "Menu Window" target like "ModelGetPrimitive&Polygon Mesh": module + squashed group path + leaf submenu. */
function openMenuWindow(app: App, target: string, at?: { x: number; y: number }) {
  const [head, ...rest] = target.split('&'); const mod = ['Model', 'Animate', 'Render', 'Simulate', 'ICE', 'Hair'].find(m => head.startsWith(m)) ?? 'Model';
  const squash = (s: string) => s.replace(/[^A-Za-z]/g, '').toLowerCase(); let path = squash(head.slice(mod.length));
  let items: any[] = (menus as any)[mod] ?? []; const labels: string[] = [];
  while (path) { const hit = items.find((it: any) => it.label && path.startsWith(squash(it.label))); if (!hit) break; path = path.slice(squash(hit.label).length); labels.push(hit.label); items = hit.items ?? []; }
  for (const r of rest) { const hit = items.find((it: any) => it.label === r); if (hit) { labels.push(hit.label); items = hit.items ?? [hit]; } }
  openMenu(app, items, at?.x ?? 300, at?.y ?? 160, labels);
}

function shelfButton(app: App, it: Item): HTMLElement | null {
  if (it.type === 'separator') { const s = document.createElement('div'); s.className = 'shelf-sep'; return s; }
  if (!it.label && !it.bitmap) return null;
  const b = document.createElement('button'); b.className = 'shelf-btn' + (it.bitmap && hasIcon(it.bitmap) ? ' has-icon' : ' text');
  if (it.bitmap && hasIcon(it.bitmap)) b.appendChild(siIcon(it.bitmap)); else b.textContent = it.label ?? '';
  b.title = (it.tooltip || it.label || '').replace(/&gt;/g, '>');
  b.onclick = (e) => { if (it.script) runShelfScript(app, it.script, { x: (e.target as HTMLElement).getBoundingClientRect().left, y: (e.target as HTMLElement).getBoundingClientRect().bottom }); else app.logMsg('info', `${it.label}: no script`); };
  return b;
}

export function mainShelf(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'shelf'; host.appendChild(root);
  const tabs = document.createElement('div'); tabs.className = 'shelf-tabs'; const body = document.createElement('div'); body.className = 'shelf-body'; root.append(tabs, body);
  let active = 'Main';
  const render = () => {
    tabs.innerHTML = ''; body.innerHTML = '';
    for (const t of SI_SHELF) { const b = document.createElement('div'); b.className = 'shelf-tab' + (t.label === active ? ' active' : ''); b.textContent = t.label; b.onclick = () => { active = t.label; render(); }; tabs.appendChild(b); }
    const tab = SI_SHELF.find(t => t.label === active); if (!tab) return;
    const icons = tab.items.filter(i => i.bitmap && hasIcon(i.bitmap)); const texts = tab.items.filter(i => !(i.bitmap && hasIcon(i.bitmap)));
    const row1 = document.createElement('div'); row1.className = 'shelf-row'; for (const it of icons) { const b = shelfButton(app, it); if (b) row1.appendChild(b); }
    const row2 = document.createElement('div'); row2.className = 'shelf-row text'; for (const it of texts) { const b = shelfButton(app, it); if (b) row2.appendChild(b); }
    body.append(row1, row2);
  };
  render();
}

export function panelSwitcher(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'panel-switcher'; host.appendChild(root);
  const layoutSel = document.createElement('select'); layoutSel.className = 'ps-layout'; layoutSel.title = 'Layouts';
  for (const o of layoutNames()) { const e = document.createElement('option'); e.textContent = o; layoutSel.appendChild(e); } layoutSel.value = currentLayoutName();
  layoutSel.onchange = () => { if (layoutSel.value !== currentLayoutName()) switchLayout(layoutSel.value); };
  root.appendChild(layoutSel);
  for (const it of SI_PANELSWITCHER) {
    if (it.type === 'separator') { const s = document.createElement('div'); s.className = 'shelf-sep'; root.appendChild(s); continue; }
    const b = document.createElement('button'); b.className = 'ps-btn'; b.title = it.tooltip || it.label || '';
    if (it.bitmap && hasIcon(it.bitmap)) b.appendChild(siIcon(it.bitmap)); else b.textContent = it.label ?? '';
    b.onclick = () => {
      const s = it.script ?? '';
      const lay = /"layout"\s*,\s*"([^"]+)"/i.exec(s); const tog = /ToggleOptionalPanel\s+"([^"]+)"/i.exec(s);
      if (lay) { let l = lay[1]; if (/Explorer/i.test(s) && it.label === 'Exp') l = 'explorer'; if (it.label === 'Tree') l = 'tree'; window.dispatchEvent(new CustomEvent('vmlayout', { detail: { layout: l } })); }
      else if (tog) window.dispatchEvent(new CustomEvent('togglepanel', { detail: { name: tog[1] } }));
      else if (/Timerange/i.test(s)) window.dispatchEvent(new CustomEvent('togglepanel', { detail: { name: 'Timerange' } }));
      else runShelfScript(app, s);
    };
    root.appendChild(b);
  }
}
