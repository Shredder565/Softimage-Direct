// Status bar (the strip under the playback row): current tool on the left, the three mouse-button hints on the right,
// with the strings Softimage's own dictionaries use (XSIVIEWINTERACTION.dict).
import { App } from '../core/commands';
import { siHint } from './si';
import { tool } from './viewManager';

export function statusBar(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.id = 'statusbar';
  const left = document.createElement('span'); left.className = 'sb-tool';
  const hints = [0, 1, 2].map(() => { const s = document.createElement('span'); s.className = 'sb-hint'; return s; });
  const right = document.createElement('span'); right.className = 'sb-right'; right.append(...hints);
  root.append(left, right); host.appendChild(root);
  const set = (title: string, l: string, m: string, r: string) => { left.textContent = title; [l, m, r].forEach((t, i) => { hints[i].innerHTML = t ? `<i>${['L', 'M', 'R'][i]}</i> ${t}` : ''; }); };
  const update = () => {
    if (app.activeTool) { set(app.activeTool.prompt, 'Pick', '', 'Finish'); return; }
    if (tool.mode !== 'select') {
      const name = tool.mode === 'translate' ? 'Translate' : tool.mode === 'rotate' ? 'Rotate' : 'Scale';
      const h = tool.mode === 'rotate' ? siHint('XSIVIEWINTERACTION', 670) : null; // "Rotate\nRotate Handle\nRotate Direction\nContext Menu"
      set(name, h?.lmb ?? `${name} Handle`, h?.mmb ?? `${name} Direction`, h?.rmb ?? 'Context Menu'); return;
    }
    if (app.selMode === 'object') { const h = siHint('XSIVIEWINTERACTION', 127)!; set(h.title, h.lmb, h.mmb, h.rmb); return; } // Select Objects / Select NODE / BRANCH / TREE
    const h = siHint('XSIVIEWINTERACTION', 141)!; // Select Components / Range / Loop / Context Menu
    const cs = app.compSel; const total = cs?.obj.primitive ? (app.selMode === 'point' ? (cs.obj.primitive.mesh()?.positions.length ?? 0) / 3 : app.selMode === 'edge' ? '' : cs.obj.primitive.mesh()?.polygons.length) : '';
    const n = cs ? (app.selMode === 'point' ? cs.points.size : app.selMode === 'edge' ? cs.edges.size : cs.polygons.size) : 0;
    const kind = app.selMode === 'point' ? 'Points' : app.selMode === 'edge' ? 'Edges' : 'Polygons';
    set(`${h.title} (Alt or Double click for Loop/Range)${total !== '' ? ` (${total} ${kind} total, ${n} selected)` : ''}`, h.lmb, h.mmb, h.rmb);
  };
  update(); app.events.on('selection', update); app.events.on('scene', update);
}
