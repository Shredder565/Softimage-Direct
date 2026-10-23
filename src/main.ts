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

// Auto-inspect: selecting something switches the right tray to the PPG, like Softimage opening a property page.
app.events.on('selection', () => {
  if (!app.autoInspect || !app.selection.length) return;
  const bar = document.querySelector<HTMLElement>('.switcher[data-name=mcp] > .switcher-bar');
  (bar?.children[2] as HTMLElement | undefined)?.click();
});

// Menubar: File > New Scene / Edit undo-redo as simple actions.
menubar.querySelectorAll<HTMLElement>('.m').forEach(m => m.onclick = () => {
  if (m.textContent === 'File') { if (confirm('New scene? (unsaved work is lost)')) app.run('NewScene'); }
  if (m.textContent === 'Edit') app.undo();
  if (m.textContent === 'Help') alert('Softimage-web testbed\n\nToolbar: click a group button (e.g. Primitive) to open its menu. Greyed items are not implemented yet; hover for the Softimage command they map to.\nViewports: click to select, Alt+LMB orbit (Camera view), MMB / Alt+Shift pan, RMB / wheel zoom.\nTools: X scale, C rotate, V translate, Esc select. Drag in a viewport to transform the selection.\nKeys: K sets a key on the selection at the current frame; click/drag the timeline; ▶ plays.\nCommand line: Softimage-style, e.g.  CreatePrim "Torus", "MeshSurface"');
});

// Starter scene so the window is not empty.
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
app.select([]);
app.logMsg('info', 'Ready. Softimage-web phase 1 testbed.');
