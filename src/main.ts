import './styles.css';
import { App } from './core/commands';
import { registerBuiltins } from './commands';
import { registerModelCommands, registerModelAliases } from './commands/model';
import { registerUICommands } from './commands/ui';
import { registerPresetModels } from './commands/presets';
import { registerModelCommands2 } from './commands/model2';
import { registerAnimCommands } from './commands/anim';
import { registerRenderCommands } from './commands/render';
import { renderTree, textureEditor, schematic, animationEditor, spreadsheet, pluginManager, netview, imageClips, renderManager, materialManager, materialPanel, weightPaintPanel, presetManager, animationMixer } from './ui/shell';
import { registerToolbarCommands, palettesView, toolbarView, newToolbar, customizeToolbars, openToolbarWindow, userToolbars } from './ui/toolbars';
import { playbackPanel, animationPanel, timerange, layerManager, xsiExplorer, scriptHistory } from './ui/views';
import { LayoutEngine, layoutByName, currentLayoutName } from './ui/layout';
import { installLayoutEditing } from './ui/layoutEdit';
import { toolbarPanel, menuStatus, runMenuPath } from './ui/toolbarPanel';
import { explorerView } from './ui/explorer';
import { mcpPanel } from './ui/mcp';
import { installKeymap } from './ui/keymap';
import { propertyEditor } from './ui/ppg';
import { viewManager } from './ui/viewManager';
import { keyingPanel, layerControl, timeline, commandLine, scriptLog } from './ui/panels';
import { mainShelf, panelSwitcher } from './ui/shelf';
import { menubar } from './ui/menubar';
import { statusBar } from './ui/statusbar';
import { openFloating, floatingWindows } from './ui/floating';
import { siIcon, hasIcon, runScriptLine, SI_VIEWS } from './ui/si';
import { preferencesWindow } from './ui/prefs';

const app = new App();
registerBuiltins(app);
registerModelCommands(app);
registerModelAliases(app);
registerUICommands(app);
registerPresetModels(app);
registerModelCommands2(app);
registerAnimCommands(app);
registerRenderCommands(app);
registerToolbarCommands(app);
(window as any).Application = app; (window as any).__runLine = (t: string) => runScriptLine(app, t); (window as any).__menuStatus = (m?: string) => menuStatus(app, m); (window as any).__runMenu = (m: string, p: string, l: string) => runMenuPath(app, m, p, l); // scripting hook: Application.run('CreatePrim', {PresetObj:'Cube'})

const appEl = document.getElementById('app')!;
menubar(app, appEl);
const root = document.createElement('div'); root.id = 'root'; appEl.appendChild(root);
statusBar(app, appEl);

const layout = new LayoutEngine(); (window as any).__layout = layout;
layout.iconFactory = (name) => hasIcon(name) ? siIcon(name) : Object.assign(document.createElement('span'), { textContent: name });
layout.registerView('Toolbar Panel', h => toolbarPanel(app, h));
layout.registerView('Explorer', h => { explorerView(app, h); });
layout.registerView('Script Log', h => scriptLog(app, h));
let vm: ReturnType<typeof viewManager> | null = null;
layout.registerView('View Manager', h => { vm = viewManager(app, h); });
layout.registerView('Timeline', h => timeline(app, h));
layout.registerView('Timerange', h => timerange(app, h));
layout.registerView('MCP', h => mcpPanel(app, h));
installKeymap(app);
layout.registerView('Keying Panel', h => keyingPanel(app, h));
layout.registerView('Layer Control', h => layerControl(app, h));
layout.registerView('Property Editor', h => { propertyEditor(app, h); });
layout.registerView('Panel Switcher', h => panelSwitcher(app, h));
layout.registerView('Command Line', h => commandLine(app, h));
layout.registerView('Playback Panel', h => playbackPanel(app, h));
layout.registerView('Animation Panel', h => animationPanel(app, h));
layout.registerView('Main Shelf', h => mainShelf(app, h));
for (const n of ['Selection Panel', 'Transformation Panel', 'Snap Panel', 'Constraint Panel', 'Edit Panel', 'Mini Transform Panel'] as const) layout.registerView(n, h => { mcpPanel(app, h, n === 'Selection Panel' ? { only: ['Select'] } : n === 'Transformation Panel' ? { only: ['Transform'] } : n === 'Snap Panel' ? { only: ['Snap'] } : n === 'Constraint Panel' ? { only: ['Constrain'] } : n === 'Edit Panel' ? { only: ['Edit'] } : { only: ['Transform'], cls: 'mini' }); });
layout.registerView('Palettes', h => palettesView(app, h)); layout.registerView('Scripts', h => toolbarView(app, h, 'Scripts'));
window.addEventListener('toolbarmenu', (e: any) => { const l = e.detail?.label; if (l === 'New Custom Toolbar...') newToolbar(app, 'toolbar'); else if (l === 'New Custom Shelf...') newToolbar(app, 'shelf'); else if (l === 'Customize Toolbars...') customizeToolbars(app); else if (l === 'New Custom Relational View') app.logMsg('info', 'Custom relational views: use View > Layouts > New Blank Layout'); else openToolbarWindow(app, l); });
const SHELL: Record<string, (h: HTMLElement) => void> = { 'Render Tree': h => renderTree(app, h), 'Texture Editor': h => textureEditor(app, h), 'Schematic': h => schematic(app, h), 'Animation Editor': h => animationEditor(app, h, 'fcurve'), 'DopeSheet': h => animationEditor(app, h, 'dopesheet'), 'Spreadsheet': h => spreadsheet(app, h), 'Plugin Manager': h => pluginManager(app, h), 'Netview': h => netview(app, h), 'Image Clips': h => imageClips(app, h), 'Sources': h => imageClips(app, h), 'Render Manager': h => renderManager(app, h), 'Material Manager': h => materialManager(app, h), 'Material Panel': h => materialPanel(app, h), 'Weight Paint Panel': h => weightPaintPanel(app, h), 'Preset Manager': h => presetManager(app, h), 'Animation Mixer': h => animationMixer(app, h), 'Expression Editor': h => { animationEditor(app, h, 'fcurve'); } };
for (const [k, f] of Object.entries(SHELL)) layout.registerView(k, f);
layout.registerView('Scene Layer Manager', h => layerManager(app, h)); layout.registerView('Script History', h => scriptHistory(app, h)); layout.registerView('XSI Explorer', h => xsiExplorer(app, h));
layout.build(layoutByName(currentLayoutName()) ?? layoutByName('Default')!, root);
installLayoutEditing(app, layout, root);
window.addEventListener('frameall', () => vm?.frameAll());

// ---- Optional panels (Softimage: View > Optional Panels, panel switcher buttons, ToggleOptionalPanel command)
const PANEL_FRAMES: Record<string, string> = { 'Main Shelf': 'main_shelf', 'Module Menu': 'module_menu', 'MCP': 'mcp', 'Timeline': 'timeline', 'Timerange': 'timerange', 'Playback': 'playback' };
window.addEventListener('togglepanel', (e: any) => {
  const { name, show } = e.detail ?? {};
  if (name === '*all') { for (const f of Object.values(PANEL_FRAMES)) layout.setFrameVisible(f, !!show); return; }
  if (name === '*restore') { for (const [k, f] of Object.entries(PANEL_FRAMES)) layout.setFrameVisible(f, k !== 'Main Shelf'); return; }
  const f = PANEL_FRAMES[name]; if (f) layout.setFrameVisible(f, show); else app.logMsg('info', `Optional panel "${name}" not available`);
});

// ---- Floating views (View > Views, shelf/explorer buttons, Enter on a selection)
const openView = (name: string) => {
  const key = 'view:' + name; const size = SI_VIEWS.find(v => v.name === name)?.defaultsize?.split(',').map(Number);
  const w = name === 'Mini Transform Panel' ? 200 : Math.max(320, size ? Math.min(900, size[2] - size[0]) : 420), h = size ? Math.min(600, size[3] - size[1]) : 400;
  const builders: Record<string, (host: HTMLElement) => void> = {
    'Explorer': h => explorerView(app, h), 'Property Editor': h => propertyEditor(app, h), 'Script Editor': h => scriptLog(app, h), 'Script History View': h => scriptLog(app, h),
    'Keying Panel': h => keyingPanel(app, h), 'Layer Control': h => layerControl(app, h), 'Main Shelf': h => mainShelf(app, h), 'Toolbar Panel': h => toolbarPanel(app, h), 'Command Line': h => commandLine(app, h),
    'Script History': h => scriptHistory(app, h), 'Palettes': h => palettesView(app, h), 'Scripts': h => toolbarView(app, h, 'Scripts'), 'Scene Layer Manager': h => layerManager(app, h), 'XSI Explorer': h => xsiExplorer(app, h),
    'Animation Panel': h => animationPanel(app, h), 'Playback Panel': h => playbackPanel(app, h), 'Timeline': h => timeline(app, h), 'Timerange': h => timerange(app, h),
    'Selection Panel': h => mcpPanel(app, h, { only: ['Select'] }), 'Transformation Panel': h => mcpPanel(app, h, { only: ['Transform'] }), 'Snap Panel': h => mcpPanel(app, h, { only: ['Snap'] }), 'Edit Panel': h => mcpPanel(app, h, { only: ['Constrain', 'Edit'] }), 'Mini Transform Panel': h => mcpPanel(app, h, { only: ['Transform'], cls: 'mini' }),
  };
  const b = builders[name] ?? SHELL[name]; if (!b) { app.logMsg('info', `View "${name}": not implemented`); return; }
  openFloating(name, (body) => b(body), { w, h, key });
};
window.addEventListener('openview', (e: any) => openView(e.detail?.name));
window.addEventListener('openprefs', (e: any) => preferencesWindow(app, e.detail?.page));

// Auto-inspect (Interaction pref "Popup Property Editors on Node Creation"): a new node opens a floating property
// editor, like Softimage's "Scene_Root : sphere (General)" window, rather than switching the MCP tray.
let floatPPG: { win: ReturnType<typeof openFloating>; node: any } | null = null;
const openFloatingPPG = (node: any) => {
  if (floatPPG && app.recyclePPG) { floatPPG.node = node; app.events.emit('selection'); return; }
  if (floatPPG && !app.recyclePPG) { const fixed = node; openFloating('', (body, w) => { propertyEditor(app, body, () => fixed); setTimeout(() => w.setTitle(body.querySelector('.ppg-title')?.textContent ?? '')); }, { w: 420, cls: 'ppg-window' }); return; }
  const state = { win: null as any, node }; floatPPG = state;
  state.win = openFloating('', (body, w) => { propertyEditor(app, body, () => floatPPG?.node); const sync = () => w.setTitle(body.querySelector('.ppg-title')?.textContent ?? ''); setTimeout(sync); app.events.on('selection', () => setTimeout(sync)); app.events.on('scene', () => setTimeout(sync)); }, { w: 420, x: 60, y: 40, cls: 'ppg-window' });
  const win = state.win;
  const obs = new MutationObserver(() => { if (!document.body.contains(win.el)) { floatPPG = null; obs.disconnect(); } }); obs.observe(appEl, { childList: true });
};
app.events.on('inspect', (n: any) => openFloatingPPG(n));
app.events.on('newscene', () => { for (const f of floatingWindows()) f.close(); floatPPG = null; });

// ---- Scene save / open: the scene is stored as its command script (what the Script Log shows), replayed on open.
let sceneName = 'Untitled'; let sceneStart = 0;
const sceneScript = () => app.log.slice(sceneStart).filter(l => l.kind === 'cmd').map(l => l.text).join('\n');
const updateTitle = () => { const r = document.querySelector('#menubar .right'); if (r) r.textContent = `Project: Softimage-Direct    Scene: ${sceneName}`; };
window.addEventListener('savescene', (e: any) => {
  let name = sceneName; if (e.detail?.as || name === 'Untitled') { name = prompt('Scene name', name === 'Untitled' ? 'Scene' : name) ?? ''; if (!name) return; }
  const text = sceneScript(); try { localStorage.setItem('si.scene.' + name, text); const rec = JSON.parse(localStorage.getItem('si.recent') ?? '[]').filter((n: string) => n !== name); rec.unshift(name); localStorage.setItem('si.recent', JSON.stringify(rec.slice(0, 10))); } catch { /* ignore */ }
  if (!e.detail?.backup) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name + '.scn.txt'; a.click(); }
  sceneName = name; updateTitle(); app.logMsg('info', `Saved scene "${name}" (${text.split('\n').filter(Boolean).length} commands)`);
});
window.addEventListener('openscene', (e: any) => {
  let name = e.detail?.name; const rec: string[] = (() => { try { return JSON.parse(localStorage.getItem('si.recent') ?? '[]'); } catch { return []; } })();
  if (!name) { name = prompt('Open scene:\n' + rec.map((n, i) => `${i + 1}. ${n}`).join('\n') + '\n(number or name; leave empty to pick a file)', '') ?? ''; if (/^\d+$/.test(name)) name = rec[Number(name) - 1]; }
  const load = (text: string, nm: string) => { app.run('NewScene'); sceneStart = app.log.length; app.autoInspect = false; for (const line of text.split(/\r?\n/)) { if (line.trim()) { try { runScriptLine(app, line); } catch { /* logged */ } } } app.autoInspect = true; app.select([]); sceneName = nm; updateTitle(); };
  if (name) { const t = localStorage.getItem('si.scene.' + name); if (t !== null) load(t, name); else app.logMsg('error', `Scene "${name}" not found`); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.scn.txt'; inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; f.text().then(t => load(t, f.name.replace(/\.scn\.txt$|\.txt$/, ''))); }; inp.click();
});
app.events.on('newscene', () => { sceneName = 'Untitled'; sceneStart = app.log.length; updateTitle(); });
updateTitle();

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
sceneStart = app.log.length;
app.logMsg('info', 'Ready.');
