// Relational-view pane chrome from uiut.dll: the pane context menu (MENU 246 — Context / Relationship /
// Stack Window / Splitter Contextual), the splitter menu (MENU 163) and the three dialogs those menus open
// (uiut 160 Set Pane Relationships, uiut 162 Bitmap Editor, XSI.exe 331 Layout Explorer).
//
// Item names, nesting and the dialog templates come from the committed PE dump; the behaviour is
// AfterImage's own layout engine. Items with no AfterImage counterpart log the Softimage name instead of
// pretending to act.
import { App } from '../core/commands';
import { SI_MENUS, SiMenuItem, openSiMenu, siString } from './si';
import { LayoutEngine, splitFrame, setSplitterMode, deletePane, setFrameView, captureLayout, saveUserLayout, currentLayoutName, layoutNames, switchLayout } from './layout';
import { openSiDialog } from './siDialog';
import { userToolbars } from './toolbars';

/** The four named popups uiut 246 carries, by their resource names. */
const POPUP = { context: 'Context', relationship: 'Relationship', stack: 'Stack Window', splitter: 'Splitter Contextual' } as const;

function popupOf(name: string): SiMenuItem[] {
  const top = (SI_MENUS.uiPaneContext ?? []).find(n => n.label === name);
  return top?.items ?? [];
}

/** Pane relationships are stored per layout: "<source pane> → <target pane>" rows, as uiut 160 edits them. */
type Relationship = { from: string; to: string };
const relKey = () => 'si.panerel.' + currentLayoutName();
function relationships(): Relationship[] { try { return JSON.parse(localStorage.getItem(relKey()) ?? '[]'); } catch { return []; } }
function saveRelationships(r: Relationship[]) { localStorage.setItem(relKey(), JSON.stringify(r)); }

/** Pane bitmaps (Stack Window > Set Bitmap) use the Softimage toolbar bitmap names the icon sheet carries. */
const bmpKey = () => 'si.panebmp.' + currentLayoutName();
function paneBitmaps(): Record<string, string> { try { return JSON.parse(localStorage.getItem(bmpKey()) ?? '{}'); } catch { return {}; } }
function savePaneBitmaps(m: Record<string, string>) { localStorage.setItem(bmpKey(), JSON.stringify(m)); }

export function installPaneContext(app: App, layout: LayoutEngine, root: HTMLElement) {
  const paneName = (f: HTMLElement) => f.dataset.label || f.dataset.view || f.dataset.name || 'Pane';
  const panes = () => Array.from(root.querySelectorAll<HTMLElement>('.frame'));
  const viewNames = () => [...layout.views.keys()].sort();
  const primary = { name: null as string | null };

  /** uiut 160 — Relational View Editor - Set Pane Relationships. */
  const setRelationships = (frame: HTMLElement) => {
    openSiDialog('uiut.dll#160', {
      onReady: (d, close) => {
        const edit = d.byId.get(302) as HTMLTextAreaElement | undefined;
        const text = () => relationships().map(r => `${r.from} -> ${r.to}`).join('\n');
        if (edit) edit.value = text();
        d.on(300, () => {
          const target = prompt(`Add Relationship from "${paneName(frame)}" to pane:\n` + panes().map(p => paneName(p)).join('\n'), '');
          if (!target) return;
          saveRelationships([...relationships(), { from: paneName(frame), to: target }]);
          if (edit) edit.value = text();
        });
        d.on(301, () => {
          const rel = relationships();
          const known = new Set(panes().map(p => paneName(p)));
          const bad = rel.filter(r => !known.has(r.to) || !known.has(r.from));
          // XSIUIUT 3031 "Relationship Conflict : '%s' conflicts with '%s'." / 3032 "All relationships are valid."
          if (edit) {
            edit.value = bad.length
              ? bad.map(r => (siString('XSIUIUT', 3031) ?? "Relationship Conflict : '%s' conflicts with '%s'.")
                .replace('%s', r.from).replace('%s', r.to)).join('\n')
              : (siString('XSIUIUT', 3032) ?? 'All relationships are valid.');
          }
        });
        d.on(1, () => { close(); app.logMsg('info', `Pane relationships: ${relationships().length} relationship(s) on layout "${currentLayoutName()}"`); });
      },
    });
  };

  /** uiut 162 — Relational View - Bitmap Editor. */
  const bitmapEditor = (frame: HTMLElement) => {
    openSiDialog('uiut.dll#162', {
      onReady: (d, close) => {
        const names = Object.keys(paneBitmaps());
        d.fillList(259, names.length ? names : [paneName(frame)], 0);
        d.on(271, () => {
          // XSIUIUT 3020/3022 pane toolbar defaults — the shipped bitmap names the icon sheet already carries.
          const defaults = ['toolbar', 'explorer', 'animeditor', 'dopesheet', 'browser', 'shelf'];
          const m = paneBitmaps();
          for (const b of defaults) m[b] = b;
          savePaneBitmaps(m);
          d.fillList(259, Object.keys(m), 0);
        });
        d.on(272, () => {
          const n = prompt('Import New Bitmap — Softimage bitmap name (filename.bmp / filename_highlight.bmp):', 'toolbar');
          if (!n) return;
          const m = paneBitmaps(); m[paneName(frame)] = n.replace(/\.bmp$/i, ''); savePaneBitmaps(m);
          d.fillList(259, Object.keys(m), 0);
          app.logMsg('info', `Pane "${paneName(frame)}" bitmap set to ${n}`);
        });
        d.on(269, () => close());
      },
    });
  };

  /** XSI.exe 331 — Layout Explorer: the live frame tree with the focused pane reported. */
  const layoutExplorer = (frame: HTMLElement) => {
    openSiDialog('XSI.exe#331', {
      onReady: (d, close) => {
        const rows: string[] = [];
        const walk = (el: HTMLElement, depth: number) => {
          const kind = el.classList.contains('frame') ? 'frame' : el.classList.contains('switcher') ? 'switcher' : 'frameset';
          const name = el.dataset.name ?? '';
          const view = el.dataset.view ? ` [${el.dataset.view}]` : '';
          rows.push(`${'  '.repeat(depth)}${kind} ${name}${view}`);
          for (const c of Array.from(el.children) as HTMLElement[]) {
            if (c.classList.contains('frame') || c.classList.contains('frameset') || c.classList.contains('switcher')) walk(c, depth + 1);
            else if (c.classList.contains('switcher-body')) for (const p of Array.from(c.children) as HTMLElement[]) {
              const f = p.firstElementChild as HTMLElement | null; if (f) walk(f, depth + 1);
            }
          }
        };
        for (const top of Array.from(root.children) as HTMLElement[]) walk(top, 0);
        d.fillList(1147, rows, 0);
        // Control 1148 is the dialog's own focus readout ("no where" in the template).
        const focus = d.byId.get(1148); if (focus) focus.textContent = paneName(frame);
        d.on(1, () => close());
      },
    });
  };

  const setView = (frame: HTMLElement, items: SiMenuItem[]): SiMenuItem[] => {
    void frame;
    // The resource ships one "None" entry; the live list is the registered views (Softimage fills it the same way).
    return [...items.filter(i => i.label === 'None'), { separator: true }, ...viewNames().map(v => ({ label: v, id: null }))];
  };
  const setToolbar = (items: SiMenuItem[]): SiMenuItem[] => {
    const tbs = userToolbars().map(t => t.name);
    return [...items.filter(i => i.label === 'None'), ...(tbs.length ? [{ separator: true } as SiMenuItem, ...tbs.map(t => ({ label: t, id: null }))] : [])];
  };
  const setBitmap = (items: SiMenuItem[]): SiMenuItem[] => {
    const names = Object.keys(paneBitmaps());
    return [...items.filter(i => i.label === 'None'), ...(names.length ? [{ separator: true } as SiMenuItem, ...names.map(n => ({ label: n, id: null }))] : [])];
  };

  /** Rebuild one popup with its live sub-lists (Set View / Set Toolbar-Shelf / Set Bitmap). */
  const live = (frame: HTMLElement, items: SiMenuItem[]): SiMenuItem[] => items.map(it => {
    if (it.label === 'Set View') return { ...it, items: setView(frame, it.items ?? []) };
    if (it.label === 'Set Toolbar/Shelf') return { ...it, items: setToolbar(it.items ?? []) };
    if (it.label === 'Set Bitmap') return { ...it, items: setBitmap(it.items ?? []) };
    return it;
  });

  const saveCurrent = () => { const tree = captureLayout(root); if (tree) { saveUserLayout(currentLayoutName(), tree); app.logMsg('info', `Layout "${currentLayoutName()}" saved`); } };

  const pick = (frame: HTMLElement, it: SiMenuItem, path: string[]) => {
    const label = it.label ?? '';
    const parent = path[path.length - 2] ?? '';
    if (parent === 'Set View') { setFrameView(layout, frame, label === 'None' ? '' : label); return; }
    if (parent === 'Set Toolbar/Shelf') { app.logMsg('info', label === 'None' ? `Pane "${paneName(frame)}": no toolbar` : `Pane "${paneName(frame)}" toolbar: ${label}`); return; }
    if (parent === 'Set Bitmap') { const m = paneBitmaps(); if (label === 'None') delete m[paneName(frame)]; else m[paneName(frame)] = label; savePaneBitmaps(m); return; }
    if (parent === 'File') {
      // XSIUIUT 3052 "Save Layout" / 3053 "Layout Files"
      if (label === 'New...') { const n = prompt('New Layout name:', 'MyLayout'); if (n) { saveUserLayout(n, captureLayout(root)); switchLayout(n); } return; }
      if (label === 'Open...') { const n = prompt('Open layout:\n' + layoutNames().join('\n'), currentLayoutName()); if (n && layoutNames().includes(n)) switchLayout(n); return; }
      if (label === 'Save') { saveCurrent(); return; }
      if (label === 'Save As...') { const n = prompt(siString('XSIUIUT', 3052) ?? 'Save Layout', currentLayoutName() + '_copy'); if (n) { saveUserLayout(n, captureLayout(root)); app.logMsg('info', `Layout "${n}" saved`); } return; }
    }
    if (parent === 'Toolbar') { app.logMsg('info', `Pane "${paneName(frame)}" toolbar: ${label}`); return; }
    switch (label) {
      case 'New Tray Switcher': { const p = splitFrame(frame, 'vertical'); if (p) setFrameView(layout, p, 'Panel Switcher'); return; }
      case 'Split Horizontally': splitFrame(frame, 'horizontal'); return;
      case 'Split Vertically': splitFrame(frame, 'vertical'); return;
      case 'Remove View': setFrameView(layout, frame, ''); return;
      case 'Delete Pane': if (!deletePane(frame)) app.logMsg('info', `Pane "${paneName(frame)}" is the only pane in its frameset`); return;
      case 'Select Parent': {
        // XSIUIUT 3066 "Selects the currently selected parent frame"
        const p = frame.parentElement;
        if (p?.classList.contains('frameset')) { p.classList.add('pane-selected'); setTimeout(() => p.classList.remove('pane-selected'), 1200); }
        app.logMsg('info', siString('XSIUIUT', 3066) ?? 'Selects the currently selected parent frame');
        return;
      }
      case 'Set View as Primary': primary.name = paneName(frame); for (const p of panes()) p.classList.toggle('pane-primary', p === frame); return;
      case 'Set Relationships...': setRelationships(frame); return;
      case 'Set View Properties': app.run('InspectObj', { InputObjs: [] }); app.logMsg('info', `Pane "${paneName(frame)}" (${frame.dataset.view || 'None'}) — view properties`); return;
      case 'Remove Relationship': { const keep = relationships().filter(r => r.from !== paneName(frame)); saveRelationships(keep); app.logMsg('info', `Removed relationships from pane "${paneName(frame)}"`); return; }
      case 'Add Pane': splitFrame(frame, 'vertical'); return;
      case 'Bitmap Editor': bitmapEditor(frame); return;
      case 'Remove Bitmap': { const m = paneBitmaps(); delete m[paneName(frame)]; savePaneBitmaps(m); return; }
      case 'No Splitter': case 'Fixed Splitter': case 'Movable Splitter': {
        const fs = frame.parentElement;
        if (fs?.classList.contains('frameset')) setSplitterMode(fs, label === 'No Splitter' ? 'none' : label === 'Fixed Splitter' ? 'fixed' : 'movable');
        return;
      }
      default: app.logMsg('info', `Pane context: ${label}`);
    }
  };

  /** Right-click a pane: Context + Relationship + Stack Window, as uiut 246 groups them. */
  const openPaneMenu = (frame: HTMLElement, x: number, y: number) => {
    const items: SiMenuItem[] = [
      ...live(frame, popupOf(POPUP.context)),
      { separator: true },
      { label: POPUP.relationship, id: null, items: popupOf(POPUP.relationship) },
      { label: POPUP.stack, id: null, items: live(frame, popupOf(POPUP.stack)) },
      { separator: true },
      { label: 'Layout Explorer', id: null },
    ];
    openSiMenu(items, x, y, (it, path) => {
      if (it.label === 'Layout Explorer') { layoutExplorer(frame); return; }
      pick(frame, it, path);
    }, {
      checked: (it) => it.label === 'Set View as Primary' ? primary.name === paneName(frame) : undefined,
    });
  };

  root.addEventListener('contextmenu', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.si-menu') || t.closest('input') || t.closest('textarea') || t.closest('.tree-row')) return;
    const splitter = t.closest<HTMLElement>('.splitter');
    if (splitter) {
      e.preventDefault();
      const fs = splitter.parentElement!;
      openSiMenu(popupOf(POPUP.splitter), e.clientX, e.clientY, (it) => {
        const l = it.label ?? '';
        setSplitterMode(fs, l === 'No Splitter' ? 'none' : l === 'Fixed Splitter' ? 'fixed' : 'movable');
      }, { checked: (it) => (fs.dataset.splitter ?? 'movable') === (it.label === 'No Splitter' ? 'none' : it.label === 'Fixed Splitter' ? 'fixed' : 'movable') });
      return;
    }
    const frame = t.closest<HTMLElement>('.frame');
    if (!frame) return;
    // Only the frame chrome itself, not a view that handles its own context menu.
    if (t !== frame && !t.classList.contains('view-placeholder') && !t.closest('.layout-edit')) return;
    e.preventDefault();
    openPaneMenu(frame, e.clientX, e.clientY);
  });

  /** uiut.dll MENU 163 — the splitter menu on its own (Split Horizontally / Split Vertically). */
  window.addEventListener('panesplit', (e: any) => {
    const frame = root.querySelector<HTMLElement>(`.frame[data-name="${e.detail?.name}"]`);
    if (!frame) return;
    openSiMenu(SI_MENUS.uiSplitter ?? [], e.detail?.x ?? 100, e.detail?.y ?? 100,
      (it) => splitFrame(frame, it.label === 'Split Horizontally' ? 'horizontal' : 'vertical'));
  });

  return { openPaneMenu, setRelationships, bitmapEditor, layoutExplorer, relationships, paneBitmaps, primary };
}

/** Inventory for __uiAudit: the uiut pane-chrome resources and the dialogs they open. */
export function paneContextAudit(): {
  popups: string[];
  contextLeaves: number;
  splitterLeaves: number;
  stackLeaves: number;
  relationshipLeaves: number;
  dialogs: string[];
  ok: boolean;
} {
  const popups = (SI_MENUS.uiPaneContext ?? []).map(n => n.label ?? '');
  const count = (name: string) => popupOf(name).filter(i => !i.separator).length;
  const out = {
    popups,
    contextLeaves: count(POPUP.context),
    splitterLeaves: (SI_MENUS.uiSplitter ?? []).filter(i => !i.separator).length,
    stackLeaves: count(POPUP.stack),
    relationshipLeaves: count(POPUP.relationship),
    dialogs: ['uiut.dll#160', 'uiut.dll#162', 'XSI.exe#331'],
    ok: false,
  };
  out.ok = popups.length === 4 && out.contextLeaves > 0 && out.splitterLeaves === 2
    && out.stackLeaves > 0 && out.relationshipLeaves > 0;
  return out;
}
