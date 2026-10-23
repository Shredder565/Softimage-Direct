import './styles.css';
import { App } from './core/commands';
import { registerBuiltins } from './commands';
import { registerModelCommands, registerModelAliases } from './commands/model';
import { LayoutEngine, DEFAULT_LAYOUT } from './ui/layout';
import { toolbarPanel, menuStatus, runMenuPath } from './ui/toolbarPanel';
import { explorerView } from './ui/explorer';
import { mcpPanel } from './ui/mcp';
import { propertyEditor } from './ui/ppg';
import { viewManager } from './ui/viewManager';
import { keyingPanel, layerControl, timeline, timerange, playbackPanel, animationPanel, panelSwitcher, commandLine, scriptLog } from './ui/panels';

const app = new App();
registerBuiltins(app);
registerModelCommands(app);
registerModelAliases(app);
(window as any).Application = app; (window as any).__menuStatus = (m?: string) => menuStatus(app, m); (window as any).__runMenu = (m: string, p: string, l: string) => runMenuPath(app, m, p, l); // scripting hook: Application.run('CreatePrim', {PresetObj:'Cube'})

const appEl = document.getElementById('app')!;
const menubar = document.createElement('div'); menubar.id = 'menubar';
menubar.innerHTML = '<span class="logo">SOFT</span>' + ['File', 'Edit', 'View', 'Window', 'Help'].map(m => `<span class="m">${m}</span>`).join('') + '<span class="right">Softimage-web 0.1 · phase 1 testbed · Alt+drag orbit · wheel zoom · X/C/V transform tools · K key · Ctrl+Z undo</span>';
appEl.appendChild(menubar);
const root = document.createElement('div'); root.id = 'root'; appEl.appendChild(root);

const layout = new LayoutEngine();
layout.registerView('Toolbar Panel', h => toolbarPanel(app, h));
layout.registerView('Explorer', h => explorerView(app, h));
layout.registerView('Script Log', h => scriptLog(app, h));
let vm: ReturnType<typeof viewManager> | null = null;
layout.registerView('View Manager', h => { vm = viewManager(app, h); });
layout.registerView('Timeline', h => timeline(app, h));
layout.registerView('Timerange', h => timerange(app, h));
layout.registerView('MCP', h => mcpPanel(app, h));
layout.registerView('Keying Panel', h => keyingPanel(app, h));
layout.registerView('Layer Control', h => layerControl(app, h));
layout.registerView('Property Editor', h => propertyEditor(app, h));
layout.registerView('Panel Switcher', h => panelSwitcher(app, h));
layout.registerView('Command Line', h => commandLine(app, h));
layout.registerView('Playback Panel', h => playbackPanel(app, h));
layout.registerView('Animation Panel', h => animationPanel(app, h));
layout.build(DEFAULT_LAYOUT, root);
window.addEventListener('frameall', () => vm?.frameAll());

// Auto-inspect (Interaction pref "Popup Property Editors on Node Creation"): a new node opens a floating property
// editor, like Softimage's "Scene_Root : sphere (General)" window, rather than switching the MCP tray.
let floatPPG: { el: HTMLElement; node: any } | null = null;
const openFloatingPPG = (node: any) => {
  if (floatPPG) { floatPPG.node = node; (floatPPG.el as any)._render?.(); return; }
  const el = document.createElement('div'); el.className = 'ppg-float'; el.style.left = '60px'; el.style.top = '40px';
  const bar = document.createElement('div'); bar.className = 'ppg-float-bar'; const ttl = document.createElement('span'); ttl.className = 'ppg-float-title';
  const close = document.createElement('span'); close.className = 'ppg-float-close'; close.textContent = '×'; close.title = 'Close'; bar.append(ttl, close);
  const host = document.createElement('div'); host.className = 'ppg-float-body'; el.append(bar, host); root.appendChild(el);
  floatPPG = { el, node };
  propertyEditor(app, host, () => floatPPG?.node);
  const sync = () => { ttl.textContent = host.querySelector('.ppg-title')?.textContent ?? ''; };
  (el as any)._render = () => { app.events.emit('selection'); setTimeout(sync); }; setTimeout(sync);
  close.onclick = () => { el.remove(); floatPPG = null; };
  let dragStart: { x: number; y: number; l: number; t: number } | null = null;
  bar.onpointerdown = (e) => { if (e.target === close) return; dragStart = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop }; bar.setPointerCapture(e.pointerId); };
  bar.onpointermove = (e) => { if (!dragStart) return; el.style.left = dragStart.l + e.clientX - dragStart.x + 'px'; el.style.top = dragStart.t + e.clientY - dragStart.y + 'px'; };
  bar.onpointerup = () => { dragStart = null; };
  app.events.on('scene', () => setTimeout(sync));
};
app.events.on('inspect', (n: any) => openFloatingPPG(n));
app.events.on('newscene', () => { floatPPG?.el.remove(); floatPPG = null; });

// Menubar: File > New Scene / Edit undo-redo as simple actions.
menubar.querySelectorAll<HTMLElement>('.m').forEach(m => m.onclick = () => {
  if (m.textContent === 'File') { if (confirm('New scene? (unsaved work is lost)')) app.run('NewScene'); }
  if (m.textContent === 'Edit') app.undo();
  if (m.textContent === 'Help') alert('Softimage-web testbed\n\nToolbar: click a group button (e.g. Primitive) to open its menu. Greyed items are not implemented yet; hover for the Softimage command they map to.\nViewports: click to select, Alt+LMB orbit (Camera view), MMB / Alt+Shift pan, RMB / wheel zoom.\nTools: X scale, C rotate, V translate, Esc select. Drag in a viewport to transform the selection.\nKeys: K sets a key on the selection at the current frame; click/drag the timeline; ▶ plays.\nCommand line: Softimage-style, e.g.  CreatePrim "Torus", "MeshSurface"');
});

// Softimage opens on an empty scene; `?demo` adds a starter scene (used by the Playwright harnesses).
if (location.search.includes('demo')) { app.autoInspect = false;
app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
app.run('Translate', { X: -8, Y: 4, Z: 0 });
app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface' });
app.run('Translate', { X: 6, Y: 4, Z: 0 });
app.run('ApplyOp', { PresetObj: 'Twist' });
app.run('SelectObj', { InputObjs: 'sphere' });
app.run('SaveKey', { Time: 1 });
app.run('Translate', { Y: 8 });
app.run('SaveKey', { Time: 50 });
app.run('Translate', { Y: -8 });
app.run('SaveKey', { Time: 100 });
app.anim.frame = 1;
app.run('GetPrim', { PresetObj: 'Null', Name: 'root_null' });
app.select([]); app.autoInspect = true; }
app.logMsg('info', 'Ready. Softimage-web phase 1 testbed.');
