// Keyboard handling driven by Softimage's own key maps (Application/keymaps/*.xsikm, parsed to data/si/keymaps.json).
// Every binding is looked up by the key-map entry name; names without an action here log "not implemented", exactly
// like a command that is absent — so switching to the Maya / 3ds Max / SI|3D map re-binds everything for free.
import { App } from '../core/commands';
import { SI_KEYMAPS } from './si';
import { tool } from './viewManager';

type Action = (app: App, e: KeyboardEvent) => void;
const explorer = (scope: string) => { const bar = document.querySelector<HTMLElement>('.switcher[data-name=module_menu] > .switcher-bar'); const b = bar && Array.from(bar.children).find(c => c.textContent === 'Explorer') as HTMLElement | undefined; b?.click(); (window as any).__explorerScope?.(scope); };
const setMode = (m: 'select' | 'translate' | 'rotate' | 'scale') => tool.setMode(m);
const mcp = (k: string, v: any) => { const A = (window as any).__mcp; if (A) A(k, v); };

const ev = (n: string, d: any = {}) => window.dispatchEvent(new CustomEvent(n, { detail: d }));
export const ACTIONS: Record<string, Action> = {
  // viewport navigation tools, render region, stereo, visibility/display options
  'Navigation Tool': () => ev('navtool', { tool: 'Navigation Tool' }), 'Dolly Tool': () => ev('navtool', { tool: 'Dolly Tool' }), 'Track Tool': () => ev('navtool', { tool: 'Track Tool' }), 'Zoom Tool': () => ev('navtool', { tool: 'Zoom Tool' }), 'Pan and Zoom Tool': () => ev('navtool', { tool: 'Pan & Zoom Tool' }), 'Orbit Tool': () => ev('navtool', { tool: 'Orbit Tool' }), 'Roll Tool': () => ev('navtool', { tool: 'Roll Tool' }), 'Pivot Tool': () => ev('navtool', { tool: 'Pivot Tool' }), 'Fly Tool': () => ev('navtool', { tool: 'Fly Tool' }), 'Walk Tool': () => ev('navtool', { tool: 'Walk Tool' }),
  'Render Region Tool': () => ev('renderregion'), 'Refresh All Render Regions': () => ev('renderregion-refresh'), 'Delete Render Region': () => ev('deleterenderregion'), 'Show/Hide Render Region': () => ev('renderregion-toggle'), 'Refresh Render Region': () => ev('renderregion-refresh'), 'Isolate Selected': (app) => app.run('IsolateSelected'),
  'Toggle Headlight Display Mode': () => ev('displaytoggle', { item: 'Headlight' }), 'Visibility Options (All Cameras)': () => ev('openvisibility'), 'Display Options (All Cameras)': () => ev('opendisplayoptions'), 'Toggle Stereo': () => ev('stereomode', { mode: 'Active' }),
  // tools
  'Translate Tool': () => setMode('translate'), 'Rotation Tool': () => setMode('rotate'), 'Scaling Tool': () => setMode('scale'),
  'Object Select Tool': (app) => { setMode('select'); app.setSelMode('object'); }, 'Object Select Tool (Extended Selection)': (app) => { setMode('select'); app.setSelMode('object'); },
  'Point Select Tool': (app) => app.setSelMode('point'), 'Point Select Tool (Extended Selection)': (app) => app.setSelMode('point'),
  'Edge Select Tool': (app) => app.setSelMode('edge'), 'Edge Select Tool (Extended Selection)': (app) => app.setSelMode('edge'), 'Raycast Edge Select Tool': (app) => app.setSelMode('edge'),
  'Polygon Select Tool': (app) => app.setSelMode('polygon'), 'Polygon Select Tool (Extended Selection)': (app) => app.setSelMode('polygon'), 'Raycast Polygon Select Tool': (app) => app.setSelMode('polygon'), 'Raycast Polygon Select Tool (Extended Selection)': (app) => app.setSelMode('polygon'),
  'Rectangle Select Tool': () => setMode('select'), 'Raycast Select Tool': () => setMode('select'),
  'Set Filter to Object': (app) => app.setSelMode('object'), 'Set Filter to Point': (app) => app.setSelMode('point'), 'Set Filter to Edge': (app) => app.setSelMode('edge'), 'Set Filter to Polygon': (app) => app.setSelMode('polygon'),
  'Move Component Tool': (app) => app.run('TweakTool'), 'Escape Pick Session': (app) => { if (app.activeTool) { app.activeTool.onCancel(); app.activeTool = null; app.events.emit('selection'); } else { setMode('select'); app.setSelMode('object'); } },
  'Add Edge Tool': (app) => app.run('Knife'), 'Split Edge Tool': (app) => app.run('SplitEdge'), 'Slice Polygons Tool': (app) => app.run('ApplyTopoOp', { PresetObj: 'SlicePolygons' }),
  'Add Vertex Tool': (app) => app.run('ApplyTopoOp', { PresetObj: 'AddVertex' }), 'Add Polygon Tool': (app) => app.run('ApplyTopoOp', { PresetObj: 'AddPolygon' }),
  'Parent Tool': (app) => app.run('ParentObj'), 'Cut Hierarchical Link': (app) => app.run('CutObj'),
  'Duplicate/Extrude Single': (app) => app.run('Duplicate'), 'Duplicate Single w/o Options': (app) => app.run('Duplicate'), 'Duplicate Tool': (app) => app.run('Duplicate'),
  // selection
  'Deselect All': (app) => { app.compSel = null; app.select([]); }, 'Select All Objects': (app) => app.run('SelectAll'), 'Select All Using Filter': (app) => { if (app.selMode === 'object') app.run('SelectAll'); else app.run('SelectAllComponents'); },
  'Select All': (app) => app.run('SelectAll'), 'Select Parent': (app) => { const o: any = app.selectedObjects[0]; if (o?.parentObj && o.parentObj !== app.scene.root) app.select([o.parentObj]); },
  'Select First Child': (app) => { const o: any = app.selectedObjects[0]; const c = o?.children?.[0]; if (c) app.select([c]); }, 'Select Tree': (app) => app.run('SelectChildNodes'), 'Select Model': (app) => { let o: any = app.selectedObjects[0]; while (o && o.kind !== 'model' && o.parentObj) o = o.parentObj; if (o) app.select([o]); },
  'Grow Selection': (app) => app.run('SelectAllComponents'), 'Create Group from Objects': (app) => app.run('CreateGroup'), 'Remove Group': (app) => app.run('DeleteObj'),
  'Delete': (app) => app.run('DeleteObj'), 'Delete Selected': (app) => app.run('DeleteObj'), 'Delete Component': (app) => app.run('DeleteComponent'), 'Delete Selected Permanently': (app) => app.run('DeleteObj'), 'Delete Objects Tool': (app) => app.run('DeleteObj'),
  'Collapse': (app) => app.run('ApplyTopoOp', { PresetObj: 'Collapse' }), 'Dissolve Component': (app) => app.run('ApplyTopoOp', { PresetObj: 'DissolveComponent' }), 'Subdivide': (app) => app.run('ApplyTopoOp', { PresetObj: 'SubdividePolygon' }),
  // edit
  'Undo': (app) => app.undo(), 'Redo': (app) => app.redo(), 'Repeat': (app) => { const l = app.log.filter(x => x.kind === 'cmd').slice(-1)[0]; if (l) app.logMsg('info', 'Repeat: ' + l.text); },
  'Hide/Unhide Selection': (app) => app.run('ToggleVisibility'), 'Unhide All Objects': (app) => app.run('UnhideAll'), 'Hide Unselected Objects/Polygons': (app) => app.run('HideSelection', { Invert: true }),
  'Inspect Object': (app) => { const n = app.selection[app.selection.length - 1]; if (n) app.events.emit('inspect', n); }, 'Inspect Local Transform': (app) => { const o = app.selectedObjects[0]; if (o) app.events.emit('inspect', o.kinematics.local); },
  'Inspect All Node Properties': (app) => { const n = app.selection[app.selection.length - 1]; if (n) app.events.emit('inspect', n); },
  'Info Selection': (app) => app.logMsg('info', `${app.selection.length} selected: ${app.selection.map(n => n.name).join(', ')}`), 'Info Scene': (app) => app.logMsg('info', `Scene: ${[...app.scene.allObjects()].length} objects`),
  // animation
  'Save Key Hot Key': (app) => app.run('SaveKey'), 'Remove Key Hot Key': (app) => app.run('RemoveKey'), 'Remove Animation': (app) => app.run('RemoveAnimation'),
  'Next Frame': (app) => app.run('NextFrame'), 'Previous Frame': (app) => app.run('PrevFrame'), 'First Frame': (app) => app.run('FirstFrame'), 'Last Frame': (app) => app.run('LastFrame'),
  'Play Forwards': (app) => app.run('PlayForwards'), 'Play in Real Time': (app) => app.run('PlayForwards'), 'Stop': (app) => app.run('PlaybackStop'),
  'Save Key on Pos (X,Y,Z)': (app) => app.run('SaveKey', { InputObjs: app.selectedObjects.map(o => `${o.fullName}.kine.local.pos`).join(',') }),
  'Save Key on Rot (X,Y,Z)': (app) => app.run('SaveKey', { InputObjs: app.selectedObjects.map(o => `${o.fullName}.kine.local.rot`).join(',') }),
  'Save Key on Scl (X,Y,Z)': (app) => app.run('SaveKey', { InputObjs: app.selectedObjects.map(o => `${o.fullName}.kine.local.scl`).join(',') }),
  // views / camera
  'Frame All': () => window.dispatchEvent(new CustomEvent('frameall')), 'Frame All (All 3D Views)': () => window.dispatchEvent(new CustomEvent('frameall')),
  'Frame Selection': () => window.dispatchEvent(new CustomEvent('framesel')), 'Frame Selection (All 3D Views)': () => window.dispatchEvent(new CustomEvent('framesel')),
  'Reset Camera': () => window.dispatchEvent(new CustomEvent('frameall')), 'Show/Hide Grid': () => window.dispatchEvent(new CustomEvent('togglegrid')), 'Grid (All Cameras)': () => window.dispatchEvent(new CustomEvent('togglegrid')),
  'Maximize/Restore Current Viewport': () => window.dispatchEvent(new CustomEvent('maximizeview')),
  'Explorer': () => explorer('Scene'), 'XSI Explorer': () => explorer('Scene'), 'Scene Layer Manager': () => explorer('Layers'),
  'Script Editor': () => { const bar = document.querySelector<HTMLElement>('.switcher[data-name=module_menu] > .switcher-bar'); (Array.from(bar?.children ?? []).find(c => c.textContent === 'Script Log') as HTMLElement | undefined)?.click(); },
  'Switch to Model Toolbar': (app) => { app.module = 'Model' as any; app.events.emit('module'); }, 'Switch to Animate Toolbar': (app) => { app.module = 'Animate' as any; app.events.emit('module'); },
  'Switch to Render Toolbar': (app) => { app.module = 'Render' as any; app.events.emit('module'); }, 'Switch to Simulate Toolbar': (app) => { app.module = 'Simulate' as any; app.events.emit('module'); }, 'Switch to ICE Toolbar': (app) => { app.module = 'ICE' as any; app.events.emit('module'); },
  'Switch to Hair Toolbar': (app) => { app.module = 'Hair' as any; app.events.emit('module'); },
  // MCP settings
  'MCP Setting: Set Transform Ref Global': () => mcp('ref', 'Global'), 'MCP Setting: Set Transform Ref Local': () => mcp('ref', 'Local'), 'MCP Setting: Set Transform Ref View': () => mcp('ref', 'View'),
  'MCP Setting: Set Transform Ref Parent': () => mcp('ref', 'Par'), 'MCP Setting: Set Transform Ref Reference': () => mcp('ref', 'Ref'), 'MCP Setting: Set Transform Ref Plane': () => mcp('ref', 'Plane'),
  'MCP Setting: Set Transform Tool Axis X': () => mcp('axis', 'x'), 'MCP Setting: Set Transform Tool Axis Y': () => mcp('axis', 'y'), 'MCP Setting: Set Transform Tool Axis Z': () => mcp('axis', 'z'),
  'MCP Setting: Toggle Prop Modeling': () => mcp('prop', null), 'MCP Setting: Set Transform Modifier COG': () => mcp('cog', null), 'MCP Setting: Set Transform Modifier Sym': () => mcp('sym', null),
  // file
  'New Scene': (app) => { if (confirm('New scene? (unsaved work is lost)')) app.run('NewScene'); }, 'Save Scene': () => window.dispatchEvent(new CustomEvent('savescene')), 'Open Scene': () => window.dispatchEvent(new CustomEvent('openscene')),
  'Quit': () => { /* browser */ }, 'Users Guide': () => window.open('https://help.autodesk.com/view/SI/2015/ENU/', '_blank'),
  // Transform Tool Proportional / Tweak Tool contexts
  'Increase proportional distance': (app) => { app.proportional.radius *= 1.1; app.events.emit('selection'); }, 'Decrease proportional distance': (app) => { app.proportional.radius /= 1.1; app.events.emit('selection'); },
  'Translate Manipulator': () => setMode('translate'), 'Rotate Manipulator': () => setMode('rotate'), 'Scale Manipulator': () => setMode('scale'),
};

export let currentKeymap = 'Softimage Key Map';
export function setKeymap(name: string) { if (SI_KEYMAPS[name]) { currentKeymap = name; localStorage.setItem('si.keymap', name); } }
export function keymapNames() { return Object.keys(SI_KEYMAPS); }
export function bindingFor(actionName: string): string | null {
  for (const keys of Object.values(SI_KEYMAPS[currentKeymap] ?? {})) for (const k of keys) if (k.name === actionName) return [...k.mods.map(m => m[0].toUpperCase() + m.slice(1)), k.key === ' ' ? 'Space' : k.key.length === 1 ? k.key.toUpperCase() : k.key].join('+');
  return null;
}

export function installKeymap(app: App) {
  try { const s = localStorage.getItem('si.keymap'); if (s && SI_KEYMAPS[s]) currentKeymap = s; } catch { /* ignore */ }
  const q = new URLSearchParams(location.search).get('keymap'); if (q) { const n = keymapNames().find(k => k.toLowerCase().startsWith(q.toLowerCase())); if (n) currentKeymap = n; }
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (app.activeTool && (e.key === 'Enter' || e.key === 'Escape')) return; // interactive tools own these (viewManager)
    const km = SI_KEYMAPS[currentKeymap]; if (!km) return;
    let key = e.key; if (key.length === 1) key = key.toLowerCase(); if (e.code.startsWith('Numpad') && e.code !== 'NumpadEnter') key = e.code === 'NumpadAdd' ? '+' : e.code === 'NumpadSubtract' ? '-' : e.code === 'NumpadMultiply' ? '*' : e.code === 'NumpadDivide' ? '/' : e.code;
    if (e.shiftKey && /^[0-9]$/.test(e.code.replace('Digit', '')) && key.length === 1 && !/[0-9]/.test(key)) key = e.code.replace('Digit', ''); // Shift+7 etc.
    const ctxs = ['Global', 'View Shortcuts', 'Layout Shortcuts', 'XSI'];
    if (tool.mode !== 'select') ctxs.unshift(app.proportional.on ? 'Transform Tool Proportional' : 'Transform Tool');
    if (app.activeTool) ctxs.unshift('Tweak Tool');
    for (const c of ctxs) {
      for (const b of km[c] ?? []) {
        if (b.key !== key) continue;
        const want = new Set(b.mods); if ((want.has('ctrl') !== e.ctrlKey) || (want.has('shift') !== e.shiftKey) || (want.has('alt') !== e.altKey)) continue;
        e.preventDefault();
        const a = ACTIONS[b.name]; if (a) a(app, e); else app.logMsg('info', `${b.name}: not implemented`);
        return;
      }
    }
  });
}
