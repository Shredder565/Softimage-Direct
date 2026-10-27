// Main Command Panel (MCP) — Softimage mcp.dll RT_BITMAP section skins (SELEC1U / SRTU / SNAPU /
// CONSTU / EDITU / MINITRANSFORMMCP_U) with hit regions from tools/build_mcp_hitmaps.py
// (U↔HU absdiff + PE dialog 9200/9400 edit cells). No Softimage Desktop takeover.
import { App } from '../core/commands';
import { tool } from './viewManager';
import { siFilterNames, SI_MENUS, SiMenuItem, openSiMenu } from './si';
import { X3DObject, Model } from '../core/scene';
import { commandEnabled, mcpSampleEnabled } from './cmdEnable';
import { hwndButtonEnabled } from './mcpEnableMatrix';
import hitmaps from '../data/si/mcp_hitmaps.json';

type Rect = [number, number, number, number];
type HitDef = { id: string; rect: number[]; kind?: string };
type PanelDef = { skin: string; skinDown?: string; skinHover?: string; w: number; h: number; hits: HitDef[] };

const PANELS = (hitmaps as { panels: Record<string, PanelDef> }).panels;

/**
 * mcp.dll MENU 325 (control tips) and MENU 487 (reference-mode tips) carry the MCP's own tooltip text.
 * Each hit region maps onto the PE command id whose tip Softimage shows for that control; where the dump
 * has no tip the panel keeps its own longer hint.
 */
const TIP_PE: Record<string, number> = {
  selectTool: 32785, group: 32778, center: 32781,
  explore: 32782, scene: 32794, selection: 32799, clusters: 32795,
  filter: 32789, nameNav: 32791,
  scale: 32816, rotate: 32830, translate: 32831,
  miniScale: 32816, miniRotate: 32830, miniTranslate: 32831,
  refGlobal: 32801, refLocal: 32802, refPar: 32803, refView: 32804, refRef: 32805, refPlane: 32806,
  miniRef0: 32801, miniRef1: 32802, miniRef2: 32804,
  cog: 32807, prop: 32808, sym: 32809,
  snapOn: 32836, snapPoint: 32837, snapCurve: 32838, snapMidpoint: 32839, snapGrid: 32840,
  parent: 32841, cut: 32842, cnsComp: 32847, childComp: 32848,
  freeze: 32854, immed: 32855,
};
/** Edit > Group creates a group or cluster — a different PE tip from the Select > Group mode toggle. */
const TIP_PE_BY_SECTION: Record<string, Record<string, number>> = { Edit: { group: 32852 } };
const PE_TIPS = (() => {
  const m = new Map<number, string>();
  for (const src of [SI_MENUS.mcpControlTips ?? [], SI_MENUS.mcpRefModeTips ?? []]) {
    for (const it of src) if (it.id != null && it.label && !m.has(it.id)) m.set(it.id, it.label);
  }
  return m;
})();
function peTip(section: string, hitId: string, fallback: string): string {
  const id = TIP_PE_BY_SECTION[section]?.[hitId] ?? TIP_PE[hitId];
  return (id != null ? PE_TIPS.get(id) : undefined) ?? fallback;
}
/** Inventory for __uiAudit: which MCP hits now show the dump's own tip text. */
export function mcpTipsAudit(): { tips: number; mapped: number; unmapped: string[]; sample: Record<string, string> } {
  const unmapped = Object.entries(TIP_PE).filter(([, id]) => !PE_TIPS.has(id)).map(([k]) => k);
  return {
    tips: PE_TIPS.size,
    mapped: Object.keys(TIP_PE).length - unmapped.length,
    unmapped,
    sample: {
      scale: peTip('Transform', 'scale', ''),
      sym: peTip('Transform', 'sym', ''),
      group: peTip('Select', 'group', ''),
      groupEdit: peTip('Edit', 'group', ''),
      snapPoint: peTip('Snap', 'snapPoint', ''),
    },
  };
}

/** Softimage-painted MCP section: bitmap skin + invisible hit overlays (same pattern as views.ts Playback/Anim). */
function skinPanel(title: string, def: PanelDef, collapsed: Set<string>) {
  const wrap = document.createElement('div');
  wrap.className = 'mcp-sec mcp-skin';
  wrap.dataset.section = title;
  const root = document.createElement('div');
  root.className = 'bmp-panel mcp-bmp';
  root.style.cssText = `width:${def.w}px;height:${def.h}px;background:url(si/mcp/${def.skin}) no-repeat`;
  const titleEl = document.createElement('span');
  titleEl.className = 'mcp-sec-title';
  titleEl.hidden = true;
  titleEl.textContent = title;
  wrap.append(titleEl, root);

  const byId: Record<string, HTMLElement> = {};
  const hit = (id: string, titleTip: string, fn: (e: MouseEvent) => void, label = '') => {
    const h = def.hits.find(x => x.id === id);
    if (!h) return null as unknown as HTMLButtonElement;
    const [x, y, w, hgt] = h.rect as Rect;
    const b = document.createElement('button');
    b.className = 'bmp-hit mcp-btn';
    b.dataset.hit = id;
    b.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${hgt}px`;
    b.title = peTip(title, id, titleTip);
    if (label) b.textContent = label;
    b.onclick = fn;
    root.appendChild(b);
    byId[id] = b;
    return b;
  };
  const fieldHit = (id: string, titleTip: string, onCommit: (v: string) => void) => {
    const h = def.hits.find(x => x.id === id);
    if (!h) return null as unknown as HTMLInputElement;
    const [x, y, w, hgt] = h.rect as Rect;
    const i = document.createElement('input');
    i.className = 'bmp-field mcp-bmp-field';
    i.dataset.hit = id;
    i.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${hgt}px`;
    i.title = peTip(title, id, titleTip);
    i.spellcheck = false;
    i.onchange = () => onCommit(i.value);
    i.onkeydown = e => e.stopPropagation();
    root.appendChild(i);
    byId[id] = i;
    return i;
  };

  const headerH = def.hits.find(x => x.id === 'header')?.rect[3] ?? 18;
  const applyCollapse = () => {
    const c = collapsed.has(title);
    wrap.classList.toggle('collapsed', c);
    root.style.height = c ? `${headerH}px` : `${def.h}px`;
    for (const el of Array.from(root.children)) {
      if (el === byId.header) continue;
      (el as HTMLElement).style.visibility = c ? 'hidden' : '';
    }
  };
  hit('header', `${title} — click to collapse`, () => {
    if (collapsed.has(title)) collapsed.delete(title);
    else collapsed.add(title);
    applyCollapse();
  });

  return { wrap, root, hit, fieldHit, byId, applyCollapse, def };
}

/** The full MCP, or (with `only`) one of its sections as a standalone view. */
export function mcpPanel(app: App, host: HTMLElement, opts: { only?: string[]; cls?: string } = {}) {
  const root = document.createElement('div');
  root.className = 'mcp mcp-skinned ' + (opts.cls ?? '');
  const want = (t: string) => !opts.only || opts.only.includes(t);
  const add = (t: string, el: HTMLElement) => { if (want(t)) root.appendChild(el); };
  host.appendChild(root);
  const collapsed = new Set<string>();
  const A = app as any;
  A.centerMode ??= false; A.groupMode ??= false; A.symmetry ??= false; A.cog ??= false;
  A.immediate ??= false; A.cnsComp ??= false; A.childComp ??= false;
  (tool as any).ref ??= 'Global';
  (tool as any).snap ??= { on: false, point: true, curve: false, midpoint: false, grid: false };

  const FILTERS = ['Object', 'Point', 'Edge', 'Polygon', 'Knot', 'Isopoint', 'Sample', 'Subcurve', 'Boundary', 'Hull', 'Polynode', 'Domainpoint', 'Surfacecurve', 'Trimboundary', ...siFilterNames().filter(f => !['Objects'].includes(f)), 'Model', 'Chain Element', 'Effector', 'Root', 'Cluster', 'Property', 'Operator'].filter((f, i, a) => a.indexOf(f) === i);
  const showExplorer = (scope: string) => {
    const bar = document.querySelector<HTMLElement>('.switcher-bar');
    const b = bar && Array.from(bar.children).find(c => c.textContent === 'Explorer') as HTMLElement | undefined;
    b?.click();
    (window as any).__explorerScope?.(scope);
  };

  // Softimage Mini Transform Panel — dedicated MINITRANSFORMMCP_U skin
  // Default.xsily also hosts Mini Transform; it must not overwrite tool.setMode with a toggle
  // (commands / ui_smoke call setMode('translate') absolutely — toggle would flip back to select).
  if (opts.cls === 'mini') {
    const miniP = skinPanel('Transform', PANELS.MiniTransform, collapsed);
    const setMini = (m: typeof tool.mode) => { tool.mode = m; app.events.emit('selection'); };
    tool.setMode = setMini;
    const toggleMini = (m: typeof tool.mode) => setMini(tool.mode === m ? 'select' : m);
    miniP.hit('miniScale', 'Scale tool', () => toggleMini('scale'), 's');
    miniP.hit('miniRotate', 'Rotate tool', () => toggleMini('rotate'), 'r');
    miniP.hit('miniTranslate', 'Translate tool', () => toggleMini('translate'), 't');
    miniP.hit('miniMenu', 'Transform options', e => {
      e.stopPropagation();
      const r = (e.target as HTMLElement).getBoundingClientRect();
      openSiMenu(SI_MENUS.toolTranslate ?? [], r.left, r.bottom, it => {
        const l = it.label ?? '';
        if (['Global', 'Local', 'View', 'Parent', 'Ref', 'Plane'].includes(l)) (tool as any).ref = l === 'Parent' ? 'Par' : l;
        else app.logMsg('info', `Mini Transform: ${l}`);
      });
    });
    miniP.hit('miniRef0', 'Global', () => { (tool as any).ref = 'Global'; });
    miniP.hit('miniRef1', 'Local', () => { (tool as any).ref = 'Local'; });
    miniP.hit('miniRef2', 'View', () => { (tool as any).ref = 'View'; });
    miniP.hit('miniAxes', 'Axis enable X/Y/Z', () => { /* painted XYZ cluster */ });
    miniP.fieldHit('miniMarked', 'Marked / filter readout', () => { /* display */ });
    root.appendChild(miniP.wrap);
    (window as any).__mcp = (k: string, v: any) => {
      if (k === 'ref') (tool as any).ref = v;
      else if (k === 'axis') { (tool.axes as any)[v] = !(tool.axes as any)[v]; app.events.emit('selection'); }
    };
    void Model;
    return;
  }

  // ---------------------------------------------------------------- Select
  const selP = skinPanel('Select', PANELS.Select, collapsed);
  const openFilterMenu = (x: number, y: number) => {
    const m = document.createElement('div'); m.className = 'menu'; m.style.left = x + 'px'; m.style.top = y + 'px';
    for (const f of FILTERS) {
      const it = document.createElement('div'); it.className = 'menu-item'; it.textContent = f;
      it.onclick = () => { filterI.value = f; filterI.dispatchEvent(new Event('change')); m.remove(); };
      m.appendChild(it);
    }
    document.body.appendChild(m);
    const close = (e: PointerEvent) => { if (!m.contains(e.target as any)) { m.remove(); document.removeEventListener('pointerdown', close); } };
    setTimeout(() => document.addEventListener('pointerdown', close));
  };
  const selectToolB = selP.hit('selectTool', 'Select tool (Esc) · right-click: selection filter', () => { tool.setMode('select'); app.setSelMode('object'); })!;
  selectToolB.oncontextmenu = e => { e.preventDefault(); openFilterMenu(e.clientX, e.clientY); };
  const groupB = selP.hit('group', 'Group selection mode: picking an object selects its model/branch', () => { A.groupMode = !A.groupMode; upd(); }, 'Group')!;
  const centerB = selP.hit('center', 'Center mode: transform the object centre (pivot) instead of the geometry', () => { A.centerMode = !A.centerMode; upd(); }, 'Center')!;
  const modes: { m: 'object' | 'point' | 'edge' | 'polygon'; id: string; k: string }[] = [
    { m: 'object', id: 'object', k: 'Space' }, { m: 'point', id: 'point', k: 'T' },
    { m: 'edge', id: 'edge', k: 'E' }, { m: 'polygon', id: 'polygon', k: 'Y' },
  ];
  const modeBtns = modes.map(md => {
    const b = selP.hit(md.id, `${md.m[0].toUpperCase() + md.m.slice(1)} selection (${md.k})`, () => app.setSelMode(md.m), md.m[0].toUpperCase() + md.m.slice(1))!;
    (b as any)._m = md.m;
    return b;
  });
  const sampleB = selP.hit('sample', 'Sample selection mode (ICE) ▸', () => app.logMsg('info', 'Sample selection applies to ICE point clouds (not available on polygon meshes).'), 'Sample')!;
  const filterI = selP.fieldHit('filter', 'Selection filter', v => {
    const f = v.trim() || 'Object';
    if (['Object', 'Point', 'Edge', 'Polygon'].includes(f)) { A.selFilter = f; app.setSelMode(f.toLowerCase() as any); }
    else { A.selFilter = f; app.setSelMode('object'); app.logMsg('info', `Selection filter: ${f}`); app.events.emit('selection'); }
  })!;
  filterI.value = 'Object';
  filterI.onclick = e => { e.preventDefault(); const r = filterI.getBoundingClientRect(); openFilterMenu(r.left, r.bottom); };
  let matches: X3DObject[] = [], mi = -1;
  const nameI = selP.fieldHit('name', 'Select by name — wildcards (cube*), Enter to select', () => { /* commit via Enter */ })!;
  const findMatches = () => {
    const q = nameI.value.trim().toLowerCase();
    if (!q) return [];
    const re = new RegExp('^' + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return [...app.scene.allObjects()].filter(o => re.test(o.name) || re.test(o.fullName));
  };
  nameI.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      matches = findMatches(); mi = -1;
      if (matches.length) app.select(matches); else app.logMsg('info', `No object matches "${nameI.value}"`);
    }
  };
  const cycle = (d: number) => {
    if (!matches.length) matches = findMatches();
    if (!matches.length) return;
    mi = (mi + d + matches.length) % matches.length;
    app.select([matches[mi]]);
  };
  selP.hit('nameNav', 'Cycle name matches (▲ / ▼)', () => cycle(1));
  selP.byId.nameNav && ((selP.byId.nameNav as HTMLElement).oncontextmenu = e => { e.preventDefault(); cycle(-1); });
  selP.hit('explore', 'Open an Explorer (8)', e => {
    e.stopPropagation();
    const r = (e.target as HTMLElement).getBoundingClientRect();
    const items = (SI_MENUS.mcpExplore ?? []).map(it => it.label?.startsWith('TITLE:') ? { label: it.label.slice(6), items: [] as SiMenuItem[], title: true } as any : it);
    openSiMenu(items, r.left, r.bottom, (it) => {
      const l = it.label ?? '';
      const scope = ['Layers', 'Passes', 'Materials', 'Groups', 'Application'].includes(l) ? l
        : /Current|Scene|Environment|Lights|Cameras|Operators|Shaders|Images|Animation|Audio|Sources|Mixers|Constraints|Property|Custom|Texture/.test(l) ? 'Scene' : 'Scene';
      showExplorer(scope);
    }, { enabled: it => !(it as any).title });
  }, 'Explore');
  selP.hit('scene', 'Explorer scoped to the scene', () => showExplorer('Scene'), 'Scene');
  selP.hit('selection', 'Explorer scoped to the current selection', () => showExplorer('Selection'), 'Selection');
  selP.hit('clusters', 'Clusters of the selected object', () => showExplorer('Selection'), 'Clusters');
  add('Select', selP.wrap);

  // ------------------------------------------------------------- Transform
  const trP = skinPanel('Transform', PANELS.Transform, collapsed);
  const tmodes: { m: typeof tool.mode; id: string; opt: string; prefix: string; k: string; axes: [string, string, string] }[] = [
    { m: 'scale', id: 'scale', opt: 'scaleOpt', prefix: 'scl', k: 'X', axes: ['scaleX', 'scaleY', 'scaleZ'] },
    { m: 'rotate', id: 'rotate', opt: 'rotateOpt', prefix: 'rot', k: 'C', axes: ['rotateX', 'rotateY', 'rotateZ'] },
    { m: 'translate', id: 'translate', opt: 'translateOpt', prefix: 'pos', k: 'V', axes: ['translateX', 'translateY', 'translateZ'] },
  ];
  const modeB: HTMLElement[] = [];
  const fields: Record<string, HTMLInputElement[]> = {};
  const setMode = (m: typeof tool.mode) => {
    tool.mode = m;
    modeB.forEach(b => b.classList.toggle('on', (b as any)._m === m));
    app.events.emit('selection');
  };
  tool.setMode = setMode;
  const OPTIONS: Record<string, SiMenuItem[]> = { scale: SI_MENUS.toolScale ?? [], rotate: SI_MENUS.toolRotate ?? [], translate: SI_MENUS.toolTranslate ?? [] };
  const REFS = ['Global', 'Local', 'View', 'Par', 'Ref', 'Plane'] as const;
  const refIds = ['refGlobal', 'refLocal', 'refView', 'refPar', 'refRef', 'refPlane'] as const;
  const refB: HTMLElement[] = [];

  const pickOption = (m: string, label: string) => {
    const refs: Record<string, string> = { Global: 'Global', Local: 'Local', View: 'View', Parent: 'Par', Ref: 'Ref', Plane: 'Plane' };
    if (refs[label]) { refB.find(b => (b as any)._ref === refs[label])?.click(); return; }
    if (label === 'COG') cogB.click();
    else if (label === 'Prop') propB.click();
    else if (label === 'Sym') symB.click();
    else if (label === 'Uniform') { (tool as any).uniform = !(tool as any).uniform; (tool as any).volume = false; }
    else if (label === 'Volume') { (tool as any).volume = !(tool as any).volume; if ((tool as any).volume) (tool as any).uniform = false; }
    else if (label === 'Add') { (tool as any).addRotate = !(tool as any).addRotate; app.logMsg('info', `Rotate Add ${((tool as any).addRotate ? 'ON' : 'OFF')} (Softimage additive rotate ref)`); }
    else if (label === 'Edit Pivot') { A.editPivot = !A.editPivot; A.centerMode = !!A.editPivot; app.logMsg('info', `Edit Pivot ${A.editPivot ? 'ON' : 'OFF'}`); app.events.emit('selection'); }
    else if (label === 'Lock Pivot' || label === 'Lock') { A.pivotLocked = !A.pivotLocked; app.logMsg('info', `Lock Pivot ${A.pivotLocked ? 'ON' : 'OFF'}`); }
    else if (label === 'Reset Pivot' || label === 'Reset') {
      if (A.pivotLocked) { app.logMsg('info', 'Reset Pivot: pivot is locked'); return; }
      for (const o of app.selectedObjects) for (const ax of ['x', 'y', 'z']) app.setParam(o.kinematics.local.get('ppos' + ax)!, 0);
    }
    else if (label === 'Slide Components') { A.slideMode = !A.slideMode; app.logMsg('info', `Slide components ${A.slideMode ? 'ON' : 'OFF'}`); }
    else if (label === 'Weld Points') app.run('WeldPoints');
    else if (label === 'Translate' || label === 'Rotate' || label === 'Scale') setMode(label.toLowerCase() as any);
    else if (label === 'Points' || label === 'Edges' || label === 'Polygons') app.setSelMode(label.slice(0, -1).toLowerCase() as any);
    else if (label === 'Points + Edges' || label === 'Tweak All') { app.setSelMode('point'); A.tweakAll = label === 'Tweak All'; }
    else if (label === 'Next Manipulator') setMode(tool.mode === 'translate' ? 'rotate' : tool.mode === 'rotate' ? 'scale' : 'translate');
    else if (label === 'Prev Manipulator') setMode(tool.mode === 'translate' ? 'scale' : tool.mode === 'scale' ? 'rotate' : 'translate');
    else if (label === 'Toggle Manipulator') { A.hideManip = !A.hideManip; app.events.emit('selection'); }
    else if (label === 'Proportional Settings...' || label === 'Last Proportional Operator...') {
      const o = app.selectedObjects[0];
      const op = o?.primitive?.operators.slice().reverse().find(x => x.type === 'movecomponent' || /prop/i.test(x.name));
      if (op) app.events.emit('inspect', op); else app.run('SetProportionalRadius', { Radius: app.proportional.radius });
    }
    else if (label === 'Create Grid And Connect') app.logMsg('info', 'Knife: click two points to cut; tag polygons first to limit the cut');
    else if (label === 'Inspect Operator...') { const o = app.selectedObjects[0]; const op = o?.primitive?.operators.slice(-1)[0]; if (op) app.events.emit('inspect', op); }
    else app.logMsg('info', `${m}: ${label} not implemented`);
  };
  const optionChecked = (it: { label?: string }) => {
    const l = it.label ?? '';
    if (['Global', 'Local', 'View', 'Parent', 'Ref', 'Plane'].includes(l)) return ((tool as any).ref ?? 'Global') === (l === 'Parent' ? 'Par' : l);
    if (l === 'COG') return !!A.cog;
    if (l === 'Prop') return !!app.proportional.on;
    if (l === 'Sym') return !!A.symmetry;
    if (l === 'Uniform') return !!(tool as any).uniform;
    if (l === 'Volume') return !!(tool as any).volume;
    if (l === 'Add') return !!(tool as any).addRotate;
    if (l === 'Lock Pivot' || l === 'Lock') return !!A.pivotLocked;
    if (l === 'Edit Pivot') return !!A.editPivot;
    return undefined;
  };

  for (const md of tmodes) {
    const mb = trP.hit(md.id, `${md.m[0].toUpperCase() + md.m.slice(1)} tool (${md.k})`, () => setMode(tool.mode === md.m ? 'select' : md.m), md.id[0])!;
    (mb as any)._m = md.m;
    modeB.push(mb);
    trP.hit(md.opt, 'Options', e => {
      e.stopPropagation();
      const r = (e.target as HTMLElement).getBoundingClientRect();
      openSiMenu(OPTIONS[md.m], r.left, r.bottom, it => pickOption(md.m, it.label!), { checked: optionChecked });
    });
    fields[md.m] = md.axes.map((fid, ai) => {
      const ax = 'xyz'[ai] as 'x' | 'y' | 'z';
      const inp = trP.fieldHit(fid, `${md.m} ${ax.toUpperCase()}`, v => {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        for (const o of app.selectedObjects) app.setParam(o.kinematics.local.get(md.prefix + ax)!, n, md.m);
      })!;
      // Softimage: click axis letter end toggles axis enable
      inp.addEventListener('pointerdown', e => {
        if (e.offsetX > inp.clientWidth - 14) {
          e.preventDefault();
          (tool.axes as any)[ax] = !(tool.axes as any)[ax];
          upd();
        }
      });
      inp.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          const n = Number(inp.value) + (e.key === 'ArrowUp' ? step : -step);
          inp.value = String(Math.round(n * 1000) / 1000);
          for (const o of app.selectedObjects) app.setParam(o.kinematics.local.get(md.prefix + ax)!, n, md.m);
        }
      };
      return inp;
    });
  }
  REFS.forEach((r, i) => {
    const b = trP.hit(refIds[i], `${r} reference frame for manipulation`, () => {
      (tool as any).ref = r;
      refB.forEach(x => x.classList.toggle('on', (x as any)._ref === r));
    }, r)!;
    (b as any)._ref = r;
    if (r === 'Global') b.classList.add('on');
    refB.push(b);
  });
  const cogB = trP.hit('cog', 'Transform multiple objects about their common centre of gravity', () => { A.cog = !A.cog; upd(); }, 'COG')!;
  const propB = trP.hit('prop', 'Proportional modeling (falloff)', () => { app.proportional.on = !app.proportional.on; upd(); }, 'Prop')!;
  const symB = trP.hit('sym', 'Symmetry Mode. Right-click to popup menu.', () => { A.symmetry = !A.symmetry; upd(); }, 'Sym')!;
  symB.oncontextmenu = e => {
    e.preventDefault();
    openSiMenu(SI_MENUS.mcpSymmetry ?? [], e.clientX, e.clientY, it => {
      if (['YZ', 'XZ', 'XY'].includes(it.label!)) { A.symPlane = it.label; A.symmetry = true; upd(); }
      else {
        const o = app.selectedObjects.find(x => x.primitive?.mesh());
        if (o) { const p = o.property('symmetrymap') ?? app.run('CreateSymmetryMap', { InputObj: [o] }); if (p) app.events.emit('inspect', p); }
        else app.logMsg('info', 'Symmetry Properties: select a polygon mesh');
      }
    }, { checked: it => ['YZ', 'XZ', 'XY'].includes(it.label!) ? (A.symPlane ?? 'YZ') === it.label : undefined });
  };
  add('Transform', trP.wrap);

  // ------------------------------------------------------------------- Snap
  const snP = skinPanel('Snap', PANELS.Snap, collapsed);
  const S = (tool as any).snap;
  const snapOn = snP.hit('snapOn', 'Enable snapping (hold Ctrl while manipulating)', () => { S.on = !S.on; upd(); }, 'ON')!;
  const snapKinds: [string, string, string][] = [
    ['point', 'snapPoint', 'Snap to points'], ['curve', 'snapCurve', 'Snap to curves / edges'],
    ['midpoint', 'snapMidpoint', 'Snap to midpoints'], ['grid', 'snapGrid', 'Snap to the grid'],
  ];
  const snapB = snapKinds.map(([k, id, t]) => {
    const b = snP.hit(id, t, () => { S[k] = !S[k]; upd(); })!;
    (b as any)._k = k;
    return b;
  });
  add('Snap', snP.wrap);

  // -------------------------------------------------------------- Constrain
  const cnP = skinPanel('Constrain', PANELS.Constrain, collapsed);
  const parentB = cnP.hit('parent', 'Parent: make the last-selected object the parent of the others', () => {
    const objs = app.selectedObjects;
    if (objs.length < 2) { app.logMsg('info', 'Parent: select the children, then Shift-click the parent (or pick it) and click Parent'); return; }
    const parent = objs[objs.length - 1];
    app.run('ParentObj', { Parent: parent.fullName, Children: objs.slice(0, -1) });
  }, 'Parent')!;
  const cutB = cnP.hit('cut', 'Cut the hierarchical link (reparent to the scene root)', () => app.run('CutObj'), 'Cut')!;
  const cnsB = cnP.hit('cnsComp', 'Constraint compensation', () => { A.cnsComp = !A.cnsComp; upd(); }, 'CnsComp')!;
  const chdB = cnP.hit('childComp', 'Child transform compensation (children keep their global pose when the parent moves)', () => { A.childComp = !A.childComp; upd(); }, 'ChldComp')!;
  add('Constrain', cnP.wrap);

  // ------------------------------------------------------------------- Edit
  const edP = skinPanel('Edit', PANELS.Edit, collapsed);
  const freezeB = edP.hit('freeze', 'Freeze: collapse the construction history', () => app.run('FreezeObj'), 'Freeze')!;
  const groupEditB = edP.hit('group', 'Group the selected objects', () => app.run('CreateGroup'), 'Group')!;
  const freezeMB = edP.hit('freezeM', 'Freeze Modeling: freeze operators below the Modeling marker', () => app.run('FreezeModeling'), 'Freeze M')!;
  const immB = edP.hit('immed', 'Immediate mode: operators are applied and frozen right away', () => { A.immediate = !A.immediate; upd(); }, 'Immed')!;
  edP.hit('stackPlus', 'Expand construction history', () => app.logMsg('info', 'Construction history expand'));
  edP.hit('stackMinus', 'Collapse construction history', () => app.logMsg('info', 'Construction history collapse'));
  add('Edit', edP.wrap);

  (window as any).__mcp = (k: string, v: any) => {
    if (k === 'ref') refB.find(b => (b as any)._ref === v)?.click();
    else if (k === 'axis') { (tool.axes as any)[v] = !(tool.axes as any)[v]; app.events.emit('selection'); }
    else if (k === 'prop') propB.click(); else if (k === 'cog') cogB.click(); else if (k === 'sym') symB.click();
    else if (k === 'snap') { const b = snapB.find(x => (x as any)._k === v); if (b) b.click(); else if (v === 'on') snapOn.click(); }
    else if (k === 'pivot') pickOption('translate', 'Edit Pivot');
    else if (k === 'lockpivot') pickOption('translate', 'Lock Pivot');
    else if (k === 'manip') { A.hideManip = !v; app.events.emit('selection'); }
    else if (k === 'selmode') { (window as any).__selShape = v; app.logMsg('info', `${v} select mode`); }
    else if (k === 'vol') pickOption('scale', 'Volume');
    else if (k === 'pick') pickOption(String(v?.m ?? 'translate'), String(v?.label ?? ''));
  };

  // Softimage MCP greying: EnableMenuItem/EnableWindow track CommandCore GetEnabled
  // (Ghidra getenabled-callpath). Buttons that map to commands read commandEnabled;
  // Sample is a filter mode (mcpSampleEnabled). Optional hwnd_buttons overlay from Script Editor paste.
  const btnEn = (key: string, fallback: boolean) => {
    const h = hwndButtonEnabled(app, key);
    return h === null ? fallback : h;
  };
  const upd = () => {
    modeBtns.forEach(b => b.classList.toggle('on', (b as any)._m === app.selMode));
    groupB.classList.toggle('on', !!A.groupMode); centerB.classList.toggle('on', !!A.centerMode);
    selectToolB.classList.toggle('on', tool.mode === 'select');
    const o = app.selectedObjects[0];
    sampleB.disabled = !btnEn('sample', mcpSampleEnabled(app));
    parentB.disabled = !btnEn('parent', commandEnabled(app, 'ParentObj'));
    cutB.disabled = !btnEn('cut', commandEnabled(app, 'CutObj'));
    freezeB.disabled = !btnEn('freeze', commandEnabled(app, 'FreezeObj'));
    groupEditB.disabled = !btnEn('group', commandEnabled(app, 'CreateGroup'));
    freezeMB.disabled = !btnEn('freezeM', commandEnabled(app, 'FreezeModeling'));
    for (const md of tmodes) {
      modeB.forEach(b => b.classList.toggle('on', (b as any)._m === tool.mode));
      fields[md.m]?.forEach((i, k) => {
        if (document.activeElement === i) return;
        i.value = o ? String(Math.round(o.kinematics.local.val(md.prefix + 'xyz'[k]) * 1000) / 1000) : '';
        i.classList.toggle('axis-off', !(tool.axes as any)['xyz'[k]]);
      });
    }
    refB.forEach(b => b.classList.toggle('on', (b as any)._ref === ((tool as any).ref ?? 'Global')));
    cogB.classList.toggle('on', !!A.cog); propB.classList.toggle('on', !!app.proportional.on); symB.classList.toggle('on', !!A.symmetry);
    snapOn.classList.toggle('on', !!S.on); snapB.forEach(b => b.classList.toggle('on', !!S[(b as any)._k]));
    cnsB.classList.toggle('on', !!A.cnsComp); chdB.classList.toggle('on', !!A.childComp); immB.classList.toggle('on', !!A.immediate);
  };
  upd();
  app.events.on('selection', upd); app.events.on('params', upd); app.events.on('scene', upd); app.events.on('frame', upd);

  void Model;
}
