// Main menubar built from XSI.exe's own menu resources (File = MENU 344, Edit/View/Display/Window/Help = MENU 128),
// with the runtime-inserted entries Softimage adds at its "insertion points" (views, layouts, display modes).
import { layoutNames, currentLayoutName } from './layout';
import { userToolbars } from './toolbars';
const userToolbarNames = () => userToolbars().map(t => t.name);
import { App } from '../core/commands';
import { SI_MENUS, SI_VIEWS, SiMenuItem, openSiMenu } from './si';
import { minimizeAll, restoreAll, closeAll, floatingWindows } from './floating';
import { construction } from '../core/scene';
import { keymapNames, setKeymap, currentKeymap, bindingFor } from './keymap';

const ev = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));
const KEY_OF: Record<string, string> = { 'New Scene': 'New Scene', 'Open...': 'Open Scene', 'Save': 'Save Scene', 'Undo': 'Undo', 'Redo': 'Redo', 'Repeat': 'Repeat', 'Cut': 'Cut', 'Copy': 'Copy', 'Paste': 'Paste', 'Delete Selected': 'Delete', 'Select All': 'Select All', 'Exit': 'Quit', 'Softimage Help': 'Users Guide' };

/** Softimage PE leaves with id≥0 that the clone actually handles (others are grey / silent — see ui-documented-gaps). */
const WIRED_LABELS = new Set([
  'New Scene', 'Open...', 'Save', 'Save As...', 'Save Backup', 'Preferences...', 'Keyboard Mapping...', 'Exit',
  'Merge...', 'New Project...', 'Project Manager...', 'External Files...', 'Plug-in Manager...', 'Interaction Mode...', 'Migrate Preferences...',
  'Undo', 'Redo', 'Repeat', 'Cut', 'Copy', 'Paste', 'Delete Selected', 'Select All',
  'Minimize All', 'Restore All', 'Close All', 'Restore Default', 'Show All', 'Hide All',
  'About Softimage', 'Softimage Help', 'Softimage SDK Help', "What's New",
  'Softimage Learning Channel', '1-Minute Startup Movies', 'Learning Path', 'Softimage Wiki', 'Services and Support',
  'Softimage Home Page', 'Try Other Autodesk Products',
  'Manage...', 'New Custom Relational View', 'New Custom Shelf...', 'New Custom Toolbar...', 'Customize Toolbars...',
]);

const IMPORT_EXPORT_WIRED = new Set([
  'Model...', 'Referenced Model...', 'Delta...',
  'Obj File...', 'dotXSI...', 'IGES File...', 'EPS File...',
  'Biovision File...', 'Acclaim File...',
  'Import Alembic...', 'Export Alembic...',
]);

const EXTRA_VIEWS = ['ICE Tree', 'Render Tree', 'Texture Editor', 'Schematic', 'Animation Editor', 'DopeSheet', 'Animation Mixer', 'Spreadsheet', 'Plugin Manager', 'Netview', 'Image Clips', 'Render Manager', 'Material Manager', 'Weight Paint Panel', 'Preset Manager', 'Scene Layer Manager', 'XSI Explorer', 'Script History'];
const viewsSubmenu = (): SiMenuItem[] => [...SI_VIEWS.map(v => ({ label: v.name, id: -1 })), { separator: true }, ...EXTRA_VIEWS.filter(n => !SI_VIEWS.some(v => v.name === n)).map(n => ({ label: n, id: -1 }))];
const layoutsSubmenu = (): SiMenuItem[] => layoutNames().map(n => ({ label: n, id: -2 }));
const displaySubmenu = (): SiMenuItem[] => ['Bounding Box', 'Wireframe', 'Hidden Line', 'Constant', 'Shaded', 'Textured', 'Texture Decal', 'Realtime Shaders'].map(l => ({ label: l, id: -3 }));
const recentScenes = (): string[] => { try { return JSON.parse(localStorage.getItem('si.recent') ?? '[]'); } catch { return []; } };
const projectName = () => { try { return localStorage.getItem('si.project') || 'Softimage-Direct'; } catch { return 'Softimage-Direct'; } };
const setProject = (name: string) => { try { localStorage.setItem('si.project', name); } catch { /* */ } };

/** Expand Softimage insertion points the way the running menubar does (shared by UI + harness). */
export function expandMenubarItems(items: SiMenuItem[]): SiMenuItem[] {
  return items.flatMap(it => {
    if (it.label === 'View insertion point') return [{ label: 'Views', items: viewsSubmenu() }, { label: 'Toolbars', items: [...userToolbarNames().map(n => ({ label: n, id: -9 })), { label: 'Palettes', id: -1 }, { label: 'Scripts', id: -1 }] }, { label: 'Optional Panels', items: [{ label: 'Main Shelf', id: -4 }, { label: 'Module Menu', id: -4 }, { label: 'MCP', id: -4 }, { label: 'Timeline', id: -4 }, { label: 'Timerange', id: -4 }, { label: 'Playback', id: -4 }] }];
    if (it.label === 'Layout Insertion Point') return layoutsSubmenu();
    if (it.label === 'New Layout From') return [{ label: 'New Layout From', items: layoutNames().map(n => ({ label: n, id: -8 })) }];
    if (it.label === 'Display Insertion Point') return [...displaySubmenu(), { separator: true }, { label: 'Scene Colors...', id: -5 }, { label: 'Visibility Options...', id: -6 }];
    if (it.label === 'Import Insertion Point') return [{ label: 'Model...', id: -13 }, { label: 'Referenced Model...', id: -13 }, { label: 'Delta...', id: -13 }];
    if (it.label === 'Export Insertion Point') return [{ label: 'Model...', id: -14 }, { label: 'Delta...', id: -14 }];
    if (it.label === 'Edit Insertion Point' || it.label === 'Crosswalk Insertion Point') return [];
    if (it.label === 'Recent Scenes') return [{ label: 'Recent Scenes', items: recentScenes().map(n => ({ label: n, id: -7 })) }];
    if (it.label === 'Recent Models') return [];
    if (it.label === 'Window' && it.items) {
      const wins = floatingWindows();
      return [{ ...it, items: [...expandMenubarItems(it.items), ...(wins.length ? [{ separator: true } as SiMenuItem, ...wins.map((w, i) => ({ label: `${i + 1} ${w.title}`, id: -12 }))] : [])] }];
    }
    if (it.items) return [{ ...it, items: expandMenubarItems(it.items) }];
    return [it];
  });
}

export function menubarIsWired(it: SiMenuItem, path: string[] = []): boolean {
  const l = it.label ?? '';
  const id = it.id;
  if (id !== undefined && id !== null && id < 0) return true;
  if (WIRED_LABELS.has(l)) return true;
  if (path.includes('Layouts')) return true;
  if ((path.includes('Import') || path.includes('Export') || path.includes('Alembic')) && IMPORT_EXPORT_WIRED.has(l)) return true;
  if (path.includes('Communities') || path.includes('Resources and Tools')) return true;
  return false;
}

/** Inventory Softimage File/Edit/View/… leaves: wired vs silent (grey / would log not implemented). */
export function menubarStatus(): { path: string; label: string; id: number | null; wired: boolean }[] {
  const file = SI_MENUS.fileMenu?.[0]; const main = SI_MENUS.mainMenu ?? [];
  const tops: SiMenuItem[] = [file ?? main[0], ...main.slice(1)].filter(Boolean);
  const out: { path: string; label: string; id: number | null; wired: boolean }[] = [];
  const walk = (items: SiMenuItem[], path: string[]) => {
    for (const it of expandMenubarItems(items)) {
      if (it.separator) continue;
      if (it.items) { walk(it.items, [...path, it.label ?? '']); continue; }
      const label = it.label ?? '';
      out.push({ path: path.join(' > '), label, id: it.id ?? null, wired: menubarIsWired(it, path) });
    }
  };
  for (const top of tops) walk(top.items ?? [], [top.label ?? '']);
  return out;
}

const HELP_URLS: Record<string, string> = {
  'Softimage Help': 'https://help.autodesk.com/view/SI/2015/ENU/',
  'Softimage SDK Help': 'https://help.autodesk.com/view/SI/2015/ENU/',
  "What's New": 'https://help.autodesk.com/view/SI/2015/ENU/',
  'Softimage Learning Channel': 'https://www.youtube.com/user/AutodeskSoftimage',
  '1-Minute Startup Movies': 'https://help.autodesk.com/view/SI/2015/ENU/',
  'Learning Path': 'https://help.autodesk.com/view/SI/2015/ENU/',
  'Softimage Wiki': 'https://en.wikipedia.org/wiki/Autodesk_Softimage',
  'Services and Support': 'https://www.autodesk.com/support',
  'Softimage Home Page': 'https://www.autodesk.com/',
  'Try Other Autodesk Products': 'https://www.autodesk.com/products',
  'AREA Product Community': 'https://www.autodesk.com/community',
  'AREA Discussion Forums': 'https://forums.autodesk.com/',
  'Facebook': 'https://www.facebook.com/autodesk',
  'Mental Ray Help': 'https://help.autodesk.com/view/SI/2015/ENU/',
  'Syflex Help': 'https://help.autodesk.com/view/SI/2015/ENU/',
};

function pickImportExport(app: App, path: string[], l: string): boolean {
  if (path.includes('Import')) {
    if (l === 'Model...' || l === 'Referenced Model...' || l === 'Delta...') {
      app.run(l.startsWith('Model') ? 'ImportModel' : l.startsWith('Referenced') ? 'ImportRefModels' : 'ImportDelta'); return true;
    }
    if (l === 'Obj File...') { app.run('ImportObjFile'); return true; }
    if (l === 'dotXSI...' || l === 'IGES File...' || l === 'EPS File...' || l === 'Biovision File...' || l === 'Acclaim File...') {
      // Scene-script merge / open for formats we don't parse yet (Softimage-compatible fallback: .scn.txt)
      ev('mergescene', { format: l.replace(/\.\.\.$/, ''), accept: '.txt,.scn.txt,.xsi,.iges,.eps,.bvh,.asf,.amc' });
      return true;
    }
    if (l === 'Import Alembic...') { app.logMsg('info', 'Alembic import: pick a .abc when a loader is bundled; use Import > Obj File... for meshes today'); ev('mergescene', { format: 'Alembic', accept: '.abc,.obj' }); return true; }
  }
  if (path.includes('Export')) {
    if (l === 'Model...' || l === 'Delta...') { app.run(l.startsWith('Model') ? 'ExportModel' : 'ExportDelta'); return true; }
    if (l === 'Obj File...') { app.run('ExportObjFile'); return true; }
    if (l === 'dotXSI...' || l === 'IGES File...') {
      ev('savescene', { as: true, format: l.replace(/\.\.\.$/, '') }); return true;
    }
    if (l === 'Export Alembic...') { app.logMsg('info', 'Alembic export stub — use Export > Obj File... for mesh interchange'); app.run('ExportObjFile'); return true; }
  }
  if (path.includes('Alembic')) {
    if (l === 'Import Alembic...') { ev('mergescene', { format: 'Alembic', accept: '.abc,.obj' }); return true; }
    if (l === 'Export Alembic...') { app.run('ExportObjFile'); return true; }
  }
  return false;
}

export function menubar(app: App, host: HTMLElement) {
  const bar = document.createElement('div'); bar.id = 'menubar';
  const logo = document.createElement('span'); logo.className = 'logo'; logo.textContent = 'SOFT'; bar.appendChild(logo);
  const file = SI_MENUS.fileMenu?.[0]; const main = SI_MENUS.mainMenu ?? [];
  const tops: SiMenuItem[] = [file ?? main[0], ...main.slice(1)];
  const clipboard: { objs: any[]; cut: boolean } = { objs: [], cut: false };

  const pick = (it: SiMenuItem, path: string[]) => {
    const l = it.label ?? '';
    switch (it.id) {
      case -1: ev('openview', { name: l }); return;
      case -2: ev('layoutmenu', { label: l, path }); return;
      case -3: ev('setdisplaymode', { mode: l.toLowerCase() }); return;
      case -4: ev('togglepanel', { name: l }); return;
      case -5: ev('openprefs', { page: 'Scene Colors' }); return;
      case -6: ev('openvisibility'); return;
      case -7: ev('openscene', { name: l }); return;
      case -8: ev('layoutmenu', { label: l, path: [...path, 'New Layout From'] }); return;
      case -13: app.run(l.startsWith('Model') ? 'ImportModel' : l.startsWith('Referenced') ? 'ImportRefModels' : 'ImportDelta'); return;
      case -14: app.run(l.startsWith('Model') ? 'ExportModel' : 'ExportDelta'); return;
    }
    if (pickImportExport(app, path, l)) return;
    if (path.includes('Layouts') || l === 'Manage...') { ev('layoutmenu', { label: l, path }); return; }
    if (['New Custom Relational View', 'New Custom Shelf...', 'New Custom Toolbar...', 'Customize Toolbars...'].includes(l) || it.id === -9) { ev('toolbarmenu', { label: l }); return; }
    if (HELP_URLS[l]) { window.open(HELP_URLS[l], '_blank'); return; }
    switch (l) {
      case 'New Scene': if (confirm('New scene? (unsaved work is lost)')) app.run('NewScene'); return;
      case 'Open...': ev('openscene'); return; case 'Save': ev('savescene'); return; case 'Save As...': ev('savescene', { as: true }); return; case 'Save Backup': ev('savescene', { backup: true }); return;
      case 'Merge...': ev('mergescene'); return;
      case 'New Project...': {
        const n = prompt('New project name', projectName());
        if (n) { setProject(n); app.logMsg('info', `Project: ${n}`); const r = document.querySelector('#menubar .right'); if (r) r.textContent = `Project: ${n}    Scene: …`; }
        return;
      }
      case 'Project Manager...': {
        const cur = projectName();
        const n = prompt(`Project Manager\nCurrent: ${cur}\nEnter project name to switch/create:`, cur);
        if (n) { setProject(n); app.logMsg('info', `Project Manager → ${n}`); }
        return;
      }
      case 'External Files...': ev('openview', { name: 'Image Clips' }); app.logMsg('info', 'External Files → Image Clips'); return;
      case 'Plug-in Manager...': ev('openview', { name: 'Plugin Manager' }); return;
      case 'Interaction Mode...': {
        const names = keymapNames();
        const n = prompt('Interaction mode (key map):\n' + names.map((k, i) => `${i + 1}. ${k}${k === currentKeymap ? ' (current)' : ''}`).join('\n'), String(names.indexOf(currentKeymap) + 1));
        const k = names[Number(n) - 1]; if (k) { setKeymap(k); app.logMsg('info', `Interaction mode: ${k}`); }
        return;
      }
      case 'Migrate Preferences...': ev('openprefs'); app.logMsg('info', 'Migrate Preferences → Preferences (import Softimage prefs manually)'); return;
      case 'Preferences...': ev('openprefs'); return;
      case 'Keyboard Mapping...': { const names = keymapNames(); const n = prompt('Keyboard map:\n' + names.map((k, i) => `${i + 1}. ${k}${k === currentKeymap ? ' (current)' : ''}`).join('\n'), String(names.indexOf(currentKeymap) + 1)); const k = names[Number(n) - 1]; if (k) { setKeymap(k); app.logMsg('info', `Key map: ${k}`); } return; }
      case 'Exit': return;
      case 'Undo': app.undo(); return; case 'Redo': app.redo(); return;
      case 'Repeat': { const last = app.log.filter(x => x.kind === 'cmd').slice(-1)[0]; if (last) app.logMsg('info', 'Repeat: ' + last.text); return; }
      case 'Copy': clipboard.objs = app.selectedObjects.slice(); clipboard.cut = false; return;
      case 'Cut': clipboard.objs = app.selectedObjects.slice(); clipboard.cut = true; app.run('DeleteObj'); return;
      case 'Paste': if (clipboard.objs.length) { if (clipboard.cut) { app.logMsg('info', 'Paste after Cut: restoring via undo is not available; duplicating last copy'); } app.run('Duplicate', { InputObjs: clipboard.objs.filter(o => [...app.scene.allObjects()].includes(o)) }); } return;
      case 'Delete Selected': app.run('DeleteObj'); return; case 'Select All': app.run('SelectAll'); return;
      case 'Minimize All': minimizeAll(); return; case 'Restore All': restoreAll(); return; case 'Close All': closeAll(); return;
      default: if (it.id === -12) { const w = floatingWindows()[Number(l.split(' ')[0]) - 1]; w?.focus(); return; }
      case 'Restore Default': ev('togglepanel', { name: '*restore' }); return; case 'Show All': ev('togglepanel', { name: '*all', show: true }); return; case 'Hide All': ev('togglepanel', { name: '*all', show: false }); return;
      case 'About Softimage': alert('Softimage-Direct — a web reimplementation of Autodesk Softimage 2015 SP2\'s modeling toolset.\nUI data (menus, key maps, bitmaps, strings) are read from the original installation files.'); return;
      case 'Softimage Help': case 'Softimage SDK Help': case "What's New": window.open(HELP_URLS[l] ?? 'https://help.autodesk.com/view/SI/2015/ENU/', '_blank'); return;
    }
    app.logMsg('info', `${path.join(' > ')}: not implemented`);
  };
  const enabled = (it: SiMenuItem, path: string[] = []) => menubarIsWired(it, path);
  const accel = (it: SiMenuItem) => { const k = KEY_OF[it.label ?? '']; const b = k ? bindingFor(k) : null; return b ? { ...it, accel: b } : it; };
  for (const top of tops) {
    const m = document.createElement('span'); m.className = 'm'; m.textContent = top.label ?? ''; bar.appendChild(m);
    m.onclick = (e) => { e.stopPropagation(); const r = m.getBoundingClientRect(); openSiMenu(expandMenubarItems(top.items ?? []).map(accel), r.left, r.bottom, pick, { enabled, checked: it => it.id === -2 ? it.label === currentLayoutName() : undefined }, [top.label ?? '']); };
  }
  // construction-mode combo (Softimage shows it at the right of the main toolbar): operators go into the chosen region
  const cm = document.createElement('select'); cm.className = 'cmode'; cm.title = 'Construction mode: which region of the construction history new operators go into';
  for (const [v, l] of [['modeling', 'Modeling'], ['shape', 'Shape Modeling'], ['animation', 'Animation'], ['secondaryshape', 'Secondary Shape Modeling']]) { const o = document.createElement('option'); o.value = v; o.textContent = l; cm.appendChild(o); }
  cm.value = construction.mode; cm.onchange = () => app.run('SetConstructionMode', { Mode: cm.value }); app.events.on('module', () => { cm.value = construction.mode; }); bar.appendChild(cm);
  const right = document.createElement('span'); right.className = 'right'; right.textContent = `Project: ${projectName()} · Softimage-Direct`; bar.appendChild(right);
  host.appendChild(bar);
}
