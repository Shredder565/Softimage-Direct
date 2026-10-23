// Main menubar built from XSI.exe's own menu resources (File = MENU 344, Edit/View/Display/Window/Help = MENU 128),
// with the runtime-inserted entries Softimage adds at its "insertion points" (views, layouts, display modes).
import { layoutNames, currentLayoutName } from './layout';
import { App } from '../core/commands';
import { SI_MENUS, SI_VIEWS, SiMenuItem, openSiMenu } from './si';
import { minimizeAll, restoreAll, closeAll } from './floating';
import { keymapNames, setKeymap, currentKeymap, bindingFor } from './keymap';

const ev = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));
const KEY_OF: Record<string, string> = { 'New Scene': 'New Scene', 'Open...': 'Open Scene', 'Save': 'Save Scene', 'Undo': 'Undo', 'Redo': 'Redo', 'Repeat': 'Repeat', 'Cut': 'Cut', 'Copy': 'Copy', 'Paste': 'Paste', 'Delete Selected': 'Delete', 'Select All': 'Select All', 'Exit': 'Quit', 'Softimage Help': 'Users Guide' };

export function menubar(app: App, host: HTMLElement) {
  const bar = document.createElement('div'); bar.id = 'menubar';
  const logo = document.createElement('span'); logo.className = 'logo'; logo.textContent = 'SOFT'; bar.appendChild(logo);
  const file = SI_MENUS.fileMenu?.[0]; const main = SI_MENUS.mainMenu ?? [];
  const tops: SiMenuItem[] = [file ?? main[0], ...main.slice(1)];
  const clipboard: { objs: any[]; cut: boolean } = { objs: [], cut: false };

  const viewsSubmenu = (): SiMenuItem[] => SI_VIEWS.map(v => ({ label: v.name, id: -1 }));
  const layoutsSubmenu = (): SiMenuItem[] => layoutNames().map(n => ({ label: n, id: -2 }));
  const displaySubmenu = (): SiMenuItem[] => ['Bounding Box', 'Wireframe', 'Hidden Line', 'Constant', 'Shaded', 'Textured', 'Texture Decal', 'Realtime Shaders'].map(l => ({ label: l, id: -3 }));
  /** Expand Softimage's insertion points the way the running app does. */
  const expand = (items: SiMenuItem[]): SiMenuItem[] => items.flatMap(it => {
    if (it.label === 'View insertion point') return [{ label: 'Views', items: viewsSubmenu() }, { label: 'Optional Panels', items: [{ label: 'Main Shelf', id: -4 }, { label: 'Module Menu', id: -4 }, { label: 'MCP', id: -4 }, { label: 'Timeline', id: -4 }, { label: 'Timerange', id: -4 }, { label: 'Playback', id: -4 }] }];
    if (it.label === 'Layout Insertion Point') return layoutsSubmenu();
    if (it.label === 'New Layout From') return [{ label: 'New Layout From', items: layoutNames().map(n => ({ label: n, id: -8 })) }];
    if (it.label === 'Display Insertion Point') return [...displaySubmenu(), { separator: true }, { label: 'Scene Colors...', id: -5 }, { label: 'Visibility Options...', id: -6 }];
    if (it.label === 'Edit Insertion Point' || it.label === 'Crosswalk Insertion Point' || it.label === 'Import Insertion Point' || it.label === 'Export Insertion Point') return [];
    if (it.label === 'Recent Scenes') return [{ label: 'Recent Scenes', items: recent().map(n => ({ label: n, id: -7 })) }];
    if (it.label === 'Recent Models') return [];
    if (it.items) return [{ ...it, items: expand(it.items) }];
    return [it];
  });
  const recent = (): string[] => { try { return JSON.parse(localStorage.getItem('si.recent') ?? '[]'); } catch { return []; } };

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
    }
    if (path.includes('Layouts')) { ev('layoutmenu', { label: l, path }); return; }
    switch (l) {
      case 'New Scene': if (confirm('New scene? (unsaved work is lost)')) app.run('NewScene'); return;
      case 'Open...': ev('openscene'); return; case 'Save': ev('savescene'); return; case 'Save As...': ev('savescene', { as: true }); return; case 'Save Backup': ev('savescene', { backup: true }); return;
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
      case 'Restore Default': ev('togglepanel', { name: '*restore' }); return; case 'Show All': ev('togglepanel', { name: '*all', show: true }); return; case 'Hide All': ev('togglepanel', { name: '*all', show: false }); return;
      case 'About Softimage': alert('Softimage-Direct — a web reimplementation of Autodesk Softimage 2015 SP2\'s modeling toolset.\nUI data (menus, key maps, bitmaps, strings) are read from the original installation files.'); return;
      case 'Softimage Help': case 'Softimage SDK Help': case "What's New": window.open('https://help.autodesk.com/view/SI/2015/ENU/', '_blank'); return;
    }
    app.logMsg('info', `${path.join(' > ')}: not implemented`);
  };
  const enabled = (it: SiMenuItem) => { const l = it.label ?? ''; return it.id! < 0 || ['New Scene', 'Open...', 'Save', 'Save As...', 'Save Backup', 'Preferences...', 'Keyboard Mapping...', 'Exit', 'Undo', 'Redo', 'Repeat', 'Cut', 'Copy', 'Paste', 'Delete Selected', 'Select All', 'Minimize All', 'Restore All', 'Close All', 'Restore Default', 'Show All', 'Hide All', 'About Softimage', 'Softimage Help', 'Softimage SDK Help', "What's New"].includes(l); };
  const accel = (it: SiMenuItem) => { const k = KEY_OF[it.label ?? '']; const b = k ? bindingFor(k) : null; return b ? { ...it, accel: b } : it; };
  for (const top of tops) {
    const m = document.createElement('span'); m.className = 'm'; m.textContent = top.label ?? ''; bar.appendChild(m);
    m.onclick = (e) => { e.stopPropagation(); const r = m.getBoundingClientRect(); openSiMenu(expand(top.items ?? []).map(accel), r.left, r.bottom, pick, { enabled, checked: it => it.id === -2 ? it.label === currentLayoutName() : undefined }, [top.label ?? '']); };
  }
  const right = document.createElement('span'); right.className = 'right'; right.textContent = 'Softimage-Direct · Autodesk Softimage 2015 SP2 clone'; bar.appendChild(right);
  host.appendChild(bar);
}
