import './styles.css';
import { App } from './core/commands';
import { registerBuiltins } from './commands';
import { registerModelCommands, registerModelAliases } from './commands/model';
import { registerUICommands } from './commands/ui';
import { registerPresetModels } from './commands/presets';
import { registerModelCommands2 } from './commands/model2';
import { registerClusterCommands } from './commands/clusters';
import { registerRiggingCommands } from './commands/rigging';
import { registerConstraintCommands } from './commands/constraints';
import { registerAnimCommands } from './commands/anim';
import { registerRenderCommands } from './commands/render';
import { registerModuleToolbarCommands } from './commands/moduleToolbar';
import { registerRenderToolbarOmCommands, renderToolbarOmAudit } from './commands/renderToolbarOm';
import { registerIceModuleCommands, iceModuleAudit } from './commands/iceModule';
import { registerHairModuleCommands, hairModuleAudit, hairApplySmoke } from './commands/hairModule';
import { registerSimulateModuleCommands, simulateModuleAudit } from './commands/simulateModule';
import { registerFaceRobotModuleCommands, faceRobotModuleAudit } from './commands/faceRobotModule';
import { registerCrowdFxModuleCommands, crowdFxModuleAudit } from './commands/crowdFxModule';
import iceViewChrome from './data/si/ice_view_chrome.json';
import iceModuleTops from './data/si/ice_module_mcp_tops.json';
import hairModuleTops from './data/si/hair_module_mcp_tops.json';
import simulateModuleTops from './data/si/simulate_module_mcp_tops.json';
import simulateViewChrome from './data/si/simulate_view_chrome.json';
import faceRobotTops from './data/si/face_robot_module_mcp_tops.json';
import faceRobotStage1Chrome from './data/si/face_robot_stage1_chrome.json';
import faceRobotControllerChrome from './data/si/face_robot_controller_chrome.json';
import crowdfxModuleDump from './data/si/crowdfx_module.json';
import crowdfxDesktopMenu from './data/si/crowdfx_desktop_menu.json';
import { iceTree, renderTree, textureEditor, schematic, animationEditor, spreadsheet, pluginManager, netview, imageClips, renderManager, materialManager, materialPanel, weightPaintPanel, presetManager, animationMixer } from './ui/shell';
import { faceRobotStage1View, faceRobotActPanelView } from './ui/faceRobotStage1';
import { faceRobotControlPanelView } from './ui/faceRobotController';
import { hairPanelView } from './ui/hairPanel';
import hairViewChrome from './data/si/hair_view_chrome.json';
import { frostGraphView, frostHairWizardView, frostClothWizardView, frostOf, runFrostSmokeTests } from './frost';
import { registerToolbarCommands, palettesView, toolbarView, newToolbar, customizeToolbars, openToolbarWindow, userToolbars } from './ui/toolbars';
import { playbackPanel, animationPanel, timerange, layerManager, xsiExplorer, scriptHistory } from './ui/views';
import { LayoutEngine, layoutByName, currentLayoutName, layoutNames, dockInto } from './ui/layout';
import { currentKeymap, keymapNames } from './ui/keymap';
import menusData from './data/menus.json';
import toolMenusPe from './data/si/tool_menus_530_536.json';
import { installLayoutEditing } from './ui/layoutEdit';
import { toolbarPanel, menuStatus, runMenuPath, getEnableParity } from './ui/toolbarPanel';
import { commandEnabled, mcpSampleEnabled } from './ui/cmdEnable';
import { mcpMatrixMeta, mcpSelectionContext, matrixCommandEnabled, peMenuItemGrayed } from './ui/mcpEnableMatrix';
import { explorerView } from './ui/explorer';
import { mcpPanel } from './ui/mcp';
import { installKeymap } from './ui/keymap';
import { propertyEditor } from './ui/ppg';
import { applyPpgChrome, ppgChromeAudit, PPG_CHROME } from './ui/ppgChrome';
import { applyAnimChromeVars, animViewDefaultSize, animChromeAudit } from './ui/animChrome';
import { applyIceTreeChromeVars, iceViewDefaultSize, iceTreeChromeAudit } from './ui/iceTreeChrome';
import { iceAttributeEditorView } from './ui/iceAttributeEditor';
import { animationLayerManager } from './ui/animLayerManager';
import { viewManager, SI as ViewportSI, DEFAULT_CAMERA_POS, DEFAULT_CAMERA_INTEREST, DEFAULT_CAMERA_FOV } from './ui/viewManager';
import { manipulatorHitboxAudit, MANIP_PE_MENUS } from './ui/manipulatorHitbox';
import { applyRenderToolbarChrome, renderToolbarChromeAudit } from './ui/renderToolbarChrome';
import { applyRenderRegionHwndChrome, renderRegionHwndChromeAudit } from './ui/renderRegionHwndChrome';
import { renderMcpFlyoutsAudit } from './ui/renderMcpFlyouts';
import { directLockDesktopAudit } from './ui/directLockDesktop';
import { ppgTitleColorrefAudit } from './ui/ppgTitleColorref';
import { animEditorsExecCmdAudit, animEditorsExecCmdSmoke } from './ui/animEditorsExecCmd';
import { applyAnimClientPaintVars, animClientPaintAudit } from './ui/animClientPaint';
applyPpgChrome();
applyAnimChromeVars();
applyAnimClientPaintVars();
applyIceTreeChromeVars();
applyRenderToolbarChrome();
applyRenderRegionHwndChrome();
import { keyingPanel, layerControl, timeline, commandLine, scriptLog } from './ui/panels';
import { mainShelf, panelSwitcher } from './ui/shelf';
import { menubar, menubarStatus } from './ui/menubar';
import { statusBar } from './ui/statusbar';
import { openFloating, floatingWindows, setDockHook } from './ui/floating';
import { siIcon, hasIcon, runScriptLine, siMessage, SI_VIEWS, SI_KEYMAPS, SI_MENUS } from './ui/si';
import { preferencesWindow, preferenceSets } from './ui/prefs';

const app = new App();
registerBuiltins(app);
registerModelCommands(app);
registerModelAliases(app);
registerUICommands(app);
registerPresetModels(app);
registerModelCommands2(app);
registerClusterCommands(app);
registerRiggingCommands(app);
registerConstraintCommands(app);
registerAnimCommands(app);
registerRenderCommands(app);
registerModuleToolbarCommands(app);
registerRenderToolbarOmCommands(app);
registerIceModuleCommands(app);
registerHairModuleCommands(app);
registerSimulateModuleCommands(app);
registerFaceRobotModuleCommands(app);
registerCrowdFxModuleCommands(app);
registerToolbarCommands(app);
(window as any).__siMessage = siMessage; (window as any).Application = app; (window as any).__runLine = (t: string) => runScriptLine(app, t); (window as any).__menuStatus = (m?: string) => menuStatus(app, m); (window as any).__runMenu = (m: string, p: string, l: string) => runMenuPath(app, m, p, l); (window as any).__getEnableParity = () => getEnableParity(app); // scripting hook: Application.run('CreatePrim', {PresetObj:'Cube'})
// Softimage Command.GetEnabled analogue for harness / Script Editor probes
(window as any).__commandEnabled = (name: string, args: Record<string, unknown> = {}) => commandEnabled(app, name, args);
(window as any).__matrixCommandEnabled = (name: string) => matrixCommandEnabled(app, name);

const appEl = document.getElementById('app')!;
menubar(app, appEl);
const root = document.createElement('div'); root.id = 'root'; appEl.appendChild(root);
statusBar(app, appEl);

const layout = new LayoutEngine(); (window as any).__layout = layout;
layout.iconFactory = (name) => hasIcon(name) ? siIcon(name) : Object.assign(document.createElement('span'), { textContent: name });
layout.registerView('Toolbar Panel', h => toolbarPanel(app, h));
layout.registerView('Explorer', h => { explorerView(app, h); });
layout.registerView('Script Log', h => scriptLog(app, h));
// Softimage layout *.xsily names these "Script Editor" / "Script History View" — alias so Dual/Default frames aren't empty placeholders.
layout.registerView('Script Editor', h => scriptLog(app, h));
layout.registerView('Script History View', h => scriptHistory(app, h));
let vm: ReturnType<typeof viewManager> | null = null;
layout.registerView('View Manager', h => { vm = viewManager(app, h); });
layout.registerView('Timeline', h => timeline(app, h));
layout.registerView('Timerange', h => timerange(app, h));
layout.registerView('MCP', h => mcpPanel(app, h));
installKeymap(app); preferenceSets(app); // apply the saved preferences (key map, colours, units, …) before anything draws
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
/** Softimage FX / compositing views — shell chrome only until Render/FX DoD; Dual layout embeds these frame types. */
const deferredView = (title: string, note: string) => (h: HTMLElement) => {
  const d = document.createElement('div'); d.className = 'view-placeholder deferred';
  d.innerHTML = `<div class="view-placeholder-title">${title}</div><p>${note}</p>`;
  h.appendChild(d);
};
const SHELL: Record<string, (h: HTMLElement) => void> = {
  'Render Tree': h => renderTree(app, h), 'Texture Editor': h => textureEditor(app, h), 'Schematic': h => schematic(app, h),
  'Animation Editor': h => animationEditor(app, h, 'fcurve'), 'Fcurve Editor': h => animationEditor(app, h, 'fcurve'),
  'DopeSheet': h => animationEditor(app, h, 'dopesheet'), 'Standalone Dopesheet': h => animationEditor(app, h, 'dopesheet'),
  'Spreadsheet': h => spreadsheet(app, h), 'Plugin Manager': h => pluginManager(app, h), 'Netview': h => netview(app, h),
  'Image Clips': h => imageClips(app, h), 'Sources': h => imageClips(app, h), 'Render Manager': h => renderManager(app, h),
  'Material Manager': h => materialManager(app, h), 'Material Panel': h => materialPanel(app, h),
  'Weight Paint Panel': h => weightPaintPanel(app, h), 'Preset Manager': h => presetManager(app, h),
  'Animation Mixer': h => animationMixer(app, h), 'Expression Editor': h => { animationEditor(app, h, 'fcurve'); },
  'ICE Tree': h => iceTree(app, h),
  'ICE Attribute Editor': h => iceAttributeEditorView(app, h),
  'Hair Panel': h => hairPanelView(app, h),
  'Face Robot Control Panel': h => faceRobotControlPanelView(app, h),
  'Face Robot Stage 1': h => faceRobotStage1View(app, h),
  'Face Robot Act Floating Panel': h => faceRobotActPanelView(app, h, (app as any).__faceRobotActArgs),
  'FROST Graph': h => frostGraphView(app, h),
  'FROST Hair Wizard': h => frostHairWizardView(app, h),
  'FROST Cloth Wizard': h => frostClothWizardView(app, h),
  'FX Tree': deferredView('FX Tree', 'Softimage Fx Tree (compositing) — UI frame wired; Render/FX evaluation deferred past UI+Model+Animation DoD.'),
  'Fx Viewer': deferredView('Fx Viewer', 'Softimage Fx Viewer — UI frame wired; compositing deferred.'),
  'Fx Paint Brush List': deferredView('Fx Paint Brush List', 'Softimage Fx brushes list — UI frame wired; compositing deferred.'),
  'Fx Operator Selector': deferredView('Fx Operator Selector', 'Softimage Fx operators — UI frame wired; compositing deferred.'),
};
for (const [k, f] of Object.entries(SHELL)) layout.registerView(k, f);
layout.registerView('Scene Layer Manager', h => layerManager(app, h));
layout.registerView('Script History', h => scriptHistory(app, h));
layout.registerView('XSI Explorer', h => xsiExplorer(app, h));
layout.registerView('SDK Explorer', h => xsiExplorer(app, h));
// Softimage Dual/Default layouts include Animation Layer Manager (anim layers / mixer clips ≠ scene layers).
layout.registerView('Animation Layer Manager', h => animationLayerManager(app, h));
layout.build(layoutByName(currentLayoutName()) ?? layoutByName('Default')!, root);
installLayoutEditing(app, layout, root);
setDockHook((win, frame) => { const body = win.body; const title = win.title; return dockInto(frame, title, body, (b) => { openFloating(title, (nb, w) => { nb.replaceWith(b); b.classList.remove('docked-body'); b.className = 'ppg-float-body'; (w as any).body = b; }, { w: 480, h: 400 }); }); });
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
  const animSz = animViewDefaultSize(name);
  const iceSz = iceViewDefaultSize(name) ?? (iceViewChrome as { views?: Record<string, { defaultsize?: number[] }> }).views?.[name]?.defaultsize;
  const hairSz = (hairViewChrome as { views?: Record<string, { defaultsize?: number[] }> }).views?.[name]?.defaultsize;
  const frSz = name === 'Face Robot Control Panel'
    ? (faceRobotControllerChrome as { view?: { defaultsize?: number[] } }).view?.defaultsize
    : name === 'Face Robot Stage 1'
      ? (faceRobotStage1Chrome as { view?: { defaultsize?: number[] } }).view?.defaultsize
      : name === 'Face Robot Act Floating Panel'
        ? (faceRobotStage1Chrome as { act_panel?: { defaultsize?: number[] } }).act_panel?.defaultsize
        : undefined;
  // Softimage .xsivw defaultsize is left,top,width,height. Script Editor uses C3DPrefsScriptEditor chrome tokens when present.
  const seTok = (PPG_CHROME as any).scriptEditor?.tokens;
  let w = name === 'Mini Transform Panel' ? 200 : Math.max(320, size ? Math.min(900, size[2]) : (hairSz ? Math.min(900, hairSz[2]) : (frSz ? Math.min(900, frSz[2]) : (iceSz ? Math.min(900, iceSz[2]) : (animSz ? Math.min(900, animSz[2]) : 420)))));
  let h = size ? Math.min(700, size[3]) : (hairSz ? Math.min(700, hairSz[3]) : (frSz ? Math.min(900, frSz[3]) : (iceSz ? Math.min(700, iceSz[3]) : (animSz ? Math.min(700, animSz[3]) : 400))));
  if (name === 'Script Editor' && seTok) { w = seTok.floatDefaultWidthPx ?? w; h = seTok.floatDefaultHeightPx ?? h; }
  // Softimage hairpanel.xsivw defaultsize 0,0,900,115 — thin horizontal panel (do not clamp to 320×400 defaults).
  if (name === 'Hair Panel') { w = hairSz?.[2] ?? size?.[2] ?? 900; h = hairSz?.[3] ?? size?.[3] ?? 115; }
  // Softimage icetree.xsivw / iceattributeeditor.xsivw defaultsize — prefer dump chrome over SI_VIEWS clamp.
  if (name === 'ICE Tree') { w = iceSz?.[2] ?? 850; h = iceSz?.[3] ?? 550; }
  if (name === 'ICE Attribute Editor') { w = iceSz?.[2] ?? 900; h = iceSz?.[3] ?? 550; }
  if (name === 'Face Robot Control Panel') { w = frSz?.[2] ?? 344; h = frSz?.[3] ?? 720; }
  if (name === 'Face Robot Stage 1') { w = frSz?.[2] ?? 290; h = frSz?.[3] ?? 720; }
  if (name === 'Face Robot Act Floating Panel') { w = frSz?.[2] ?? 320; h = frSz?.[3] ?? 280; }
  if (name === 'FROST Hair Wizard' || name === 'FROST Cloth Wizard') { w = 440; h = 620; }
  if (name === 'FROST Graph') { w = Math.max(w, 720); h = Math.max(h, 480); }
  const builders: Record<string, (host: HTMLElement) => void> = {
    'Explorer': h => explorerView(app, h), 'Property Editor': h => propertyEditor(app, h), 'Script Editor': h => scriptLog(app, h), 'Script History View': h => scriptHistory(app, h),
    'Keying Panel': h => keyingPanel(app, h), 'Layer Control': h => layerControl(app, h), 'Main Shelf': h => mainShelf(app, h), 'Toolbar Panel': h => toolbarPanel(app, h), 'Command Line': h => commandLine(app, h),
    'Script History': h => scriptHistory(app, h), 'Palettes': h => palettesView(app, h), 'Scripts': h => toolbarView(app, h, 'Scripts'), 'Scene Layer Manager': h => layerManager(app, h), 'XSI Explorer': h => xsiExplorer(app, h),
    'SDK Explorer': h => xsiExplorer(app, h),
    'Animation Panel': h => animationPanel(app, h), 'Playback Panel': h => playbackPanel(app, h), 'Timeline': h => timeline(app, h), 'Timerange': h => timerange(app, h),
    'Selection Panel': h => mcpPanel(app, h, { only: ['Select'] }), 'Transformation Panel': h => mcpPanel(app, h, { only: ['Transform'] }), 'Snap Panel': h => mcpPanel(app, h, { only: ['Snap'] }), 'Edit Panel': h => mcpPanel(app, h, { only: ['Constrain', 'Edit'] }), 'Mini Transform Panel': h => mcpPanel(app, h, { only: ['Transform'], cls: 'mini' }),
  };
  const b = builders[name] ?? SHELL[name] ?? layout.views.get(name); if (!b) { app.logMsg('info', `View "${name}": not implemented`); return; }
  openFloating(name, (body) => b(body), { w, h, key });
};
window.addEventListener('openview', (e: any) => openView(e.detail?.name));
window.addEventListener('openprefs', (e: any) => preferencesWindow(app, e.detail?.page));

/** Playwright / Script Editor hook: inventory UI wiring without Softimage install access. */
(window as any).__uiAudit = () => {
  const MENUS = menusData as Record<string, unknown>;
  const registered = [...layout.views.keys()].sort();
  const mcpHost = document.querySelector('.mcp');
  const mcpSections = mcpHost ? Array.from(mcpHost.querySelectorAll('.mcp-section-title, .mcp-sec-title, .section-title, .mcp-sec[data-section]')).map(e => (e.getAttribute('data-section') || e.textContent || '').trim()).filter(Boolean) : [];
  const mcpBtns = mcpHost ? Array.from(mcpHost.querySelectorAll('.mcp-btn')).map(b => (b as HTMLElement).dataset.hit || b.textContent?.trim() || '') : [];
  const mcpHitmaps = mcpHost ? {
    skinned: mcpHost.classList.contains('mcp-skinned'),
    sections: Array.from(mcpHost.querySelectorAll('.mcp-sec.mcp-skin')).map(e => (e as HTMLElement).dataset.section || ''),
    hitCount: mcpHost.querySelectorAll('.bmp-hit[data-hit]').length,
  } : null;
  const placeholders = Array.from(document.querySelectorAll('.view-placeholder')).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120));
  const moduleSel = document.querySelector<HTMLSelectElement>('.module-select');
  const mb = menubarStatus();
  const prefs = preferenceSets(app);
  const EXPECTED_KEYMAPS = ['Softimage Key Map', 'Maya Compatible Key Map', '3ds Max Compatible Key Map', 'SI|3D Key Map'];
  const keymapStats = keymapNames().map(n => ({ name: n, contexts: Object.keys(SI_KEYMAPS[n] ?? {}).length, bindings: Object.values(SI_KEYMAPS[n] ?? {}).reduce((a, b) => a + (b?.length ?? 0), 0) }));
  return {
    layout: currentLayoutName(),
    layouts: layoutNames(),
    keymap: currentKeymap,
    keymaps: keymapNames(),
    keymapStats,
    keymapsExpectedOk: EXPECTED_KEYMAPS.every(n => keymapNames().includes(n)),
    modulesExtracted: Object.keys(MENUS),
    moduleSelect: moduleSel ? Array.from(moduleSel.options).map(o => o.textContent) : [],
    registeredViews: registered,
    registeredCount: registered.length,
    mcpPresent: !!mcpHost,
    mcpSections,
    mcpButtonCount: mcpBtns.length,
    mcpButtons: mcpBtns,
    mcpHitmaps,
    placeholderFrames: placeholders,
    menubar: !!document.getElementById('menubar'),
    menubarWired: mb.filter(x => x.wired).length,
    menubarSilent: mb.filter(x => !x.wired).length,
    menubarLeaves: mb.length,
    prefsPages: [...prefs.keys()],
    prefsPageCount: prefs.size,
    getEnableParity: getEnableParity(app),
    // Softimage GetEnabled-driven MCP button state (Ghidra command-flag model + matrix overlay)
    mcpEnable: {
      sample: mcpSampleEnabled(app),
      parent: commandEnabled(app, 'ParentObj'),
      cut: commandEnabled(app, 'CutObj'),
      freeze: commandEnabled(app, 'FreezeObj'),
      group: commandEnabled(app, 'CreateGroup'),
      freezeM: commandEnabled(app, 'FreezeModeling'),
      selCount: app.selectedObjects.length,
      // Softimage-pc XSIBATCH bools (attested true even empty across expanded contexts)
      translate: commandEnabled(app, 'Translate'),
      rotate: commandEnabled(app, 'Rotate'),
      scale: commandEnabled(app, 'Scale'),
      duplicate: commandEnabled(app, 'Duplicate'),
      copy: commandEnabled(app, 'Copy'),
      paste: commandEnabled(app, 'Paste'),
      instantiate: commandEnabled(app, 'Instantiate'),
      context: mcpSelectionContext(app),
      matrixTranslate: matrixCommandEnabled(app, 'Translate'),
      matrixParentObj: matrixCommandEnabled(app, 'ParentObj'),
      matrixCopy: matrixCommandEnabled(app, 'Copy'),
      matrixInstantiate: matrixCommandEnabled(app, 'Instantiate'),
    },
    mcpMatrix: mcpMatrixMeta(),
    // PE f_grayed: long unique labels OK without cmd; ambiguous short labels need cmd id
    peGrayedClusterWithCenter: peMenuItemGrayed('Create Cluster with Center'),
    peGrayedSelectability: peMenuItemGrayed('Selectability'),
    peGrayedSymmetryLabelOnly: peMenuItemGrayed('Symmetry'),
    peGrayedSymmetryWithCmd: peMenuItemGrayed('Symmetry', 32821),
    peGrayedPolynodeWithCmd: peMenuItemGrayed('Polynode', 32896),
    matrixTranslateTool: matrixCommandEnabled(app, 'TranslateTool'),
    // Softimage viewinteraction.dll PE menus 530–532 vs Direct tool* trees (+ PE resource sizes)
    toolMenusPe: (() => {
      const map: Record<string, string> = { '530': 'toolTranslate', '531': 'toolRotate', '532': 'toolScale' };
      const leaf = (items: { label?: string; separator?: boolean }[] | undefined) =>
        (items ?? []).map(it => it.separator ? '---' : (it.label ?? ''));
      const mismatches: string[] = [];
      for (const [mid, key] of Object.entries(map)) {
        const pe = leaf((toolMenusPe as any).menus?.[mid]?.leaves);
        const di = leaf(SI_MENUS[key] as any);
        if (JSON.stringify(pe) !== JSON.stringify(di)) mismatches.push(`${mid}/${key}`);
        const pin = MANIP_PE_MENUS[mid];
        if (!pin || pin.directTool !== key) mismatches.push(`${mid}/hitboxPin`);
      }
      return {
        ok: mismatches.length === 0,
        mismatches,
        menus: Object.keys(map),
        peSizes: Object.fromEntries(Object.entries(MANIP_PE_MENUS).map(([k, v]) => [k, v.size])),
      };
    })(),
    // Unlock DUMP_READY ui.manipulator_hitbox_px — menus 530–532 + PE bitmap W/H; hover LOCK
    manipHitbox: manipulatorHitboxAudit(),
    // Unlock DUMP_READY render.toolbar_pixel_chrome — PE RT_MENU/BITMAP W/H; eye LOCK
    renderToolbarChrome: renderToolbarChromeAudit(),
    // PE menu 234 Render MCP flyouts (Desktop press-hold missed; menus.json already wired)
    renderMcpFlyouts: renderMcpFlyoutsAudit(),
    // Softimage Desktop LOCK close — region HWND DUMP_READY; PPG title COLORREF WIRED; hover/OpenView LOCK; Anim ExecCmd+paint DONE
    directLockDesktop: directLockDesktopAudit(),
    ppgTitleColorref: ppgTitleColorrefAudit(),
    // Softimage floating Anim editors — ExecuteCommand([]) open path (OpenView LOCK; client paint HWND_PNG DONE)
    animEditorsExecCmd: animEditorsExecCmdAudit(app),
    // Softimage Anim Mixer/Editor/Fcurve client paint — modules-gdi 50/51/52 HWND PNG
    animClientPaint: animClientPaintAudit(),
    // Softimage Render toolbar OM scripting names + RenderOptionsRegion SPDL + HWND crop DUMP_READY
    renderToolbarOm: renderToolbarOmAudit(app),
    // Softimage render.region_hwnd_crop — modules-gdi harvest crop + DsNewRegionButtonCtrl + prefs colors
    renderRegionHwnd: renderRegionHwndChromeAudit(),
    // Softimage ICE module MENU 303 MCP tops + OpenICETreeView / xsivw shell chrome (client GDI + PE Anchor DUMP_READY / compound names LOCK)
    iceModule: {
      ...iceModuleAudit(app),
      mcpTops: iceModuleTops.tops,
      mcpButtons: iceModuleTops.buttons,
      iceTreeChrome: iceTreeChromeAudit(),
      iceTreeViewChrome: (iceViewChrome as { views?: Record<string, unknown> }).views?.['ICE Tree'],
      iceAttrViewChrome: (iceViewChrome as { views?: Record<string, unknown> }).views?.['ICE Attribute Editor'],
      moduleInSelect: (document.querySelector('.module-select') as HTMLSelectElement | null)
        ? Array.from((document.querySelector('.module-select') as HTMLSelectElement).options).some(o => o.value === 'ICE')
        : false,
    },
    // Softimage Hair module MENU 297 MCP Create/Modify/Display + ApplyHair* + Hair Panel xsivw shell (client GDI LOCK)
    hairModule: {
      ...hairModuleAudit(app),
      mcpTops: hairModuleTops.tops,
      mcpButtons: hairModuleTops.buttons,
      hairPanelChrome: (hairViewChrome as { views?: Record<string, unknown> }).views?.['Hair Panel'],
      moduleInSelect: (document.querySelector('.module-select') as HTMLSelectElement | null)
        ? Array.from((document.querySelector('.module-select') as HTMLSelectElement).options).some(o => o.value === 'Hair')
        : false,
    },
    // Softimage Simulate MENU 205 MCP + cloth PPG (C3DClothProp/Op SPDL) + prefs.simulation (Syflex client GDI LOCK)
    simulateModule: {
      ...simulateModuleAudit(app),
      mcpTops: simulateModuleTops.tops,
      mcpButtons: simulateModuleTops.buttons,
      viewChrome: (simulateViewChrome as { cloth_ppg?: { status: string }; syflex_client_gdi?: { status: string } }),
      moduleInSelect: (document.querySelector('.module-select') as HTMLSelectElement | null)
        ? Array.from((document.querySelector('.module-select') as HTMLSelectElement).options).some(o => o.value === 'Simulate')
        : false,
    },
    // Softimage Face Robot MENU 300 + Control Panel (xsily stages) + Stage 1 + Act synoptic (FR.dll HTML LOCK; FROST parallel)
    faceRobot: {
      ...faceRobotModuleAudit(app),
      mcpTops: faceRobotTops.tops,
      menu300: faceRobotTops.menu_300,
      stage1Chrome: faceRobotStage1Chrome.view,
      controllerChrome: faceRobotControllerChrome.view,
      controllerStages: faceRobotControllerChrome.stages?.length,
      menubarPresent: !!document.querySelector('#menubar .m[data-si-menu="Face Robot"]'),
      controlPanelHost: !!document.querySelector('.fr-controller'),
    },
    // Softimage CrowdFX under ICE (PE 41644/41646/41645 + Desktop ICE menubar tear-off DUMP_READY — compound leaves LOCK)
    crowdFxModule: {
      ...crowdFxModuleAudit(app),
      mcpTop: crowdfxModuleDump.mcp_top,
      mcpButtons: crowdfxModuleDump.buttons,
      peMenuIds: crowdfxModuleDump.pe_menu_ids,
      desktopMenuDump: crowdfxDesktopMenu,
      menubarIcePresent: !!document.querySelector('#menubar .m[data-si-menu="ICE"]'),
    },
    // Desktop polish #2 — manip / viewport prefs + default Camera pose (softimage-pc attested)
    viewportPolish: {
      ...(typeof (window as any).__vm?.viewportPolish === 'function' ? (window as any).__vm.viewportPolish() : {}),
      siManipAxisMode: ViewportSI.manipAxisMode,
      siRectRaycast: ViewportSI.rectRaycast,
      siUseManipulators: ViewportSI.useManipulators,
      siTransformSize: ViewportSI.transformSize,
      attestedDefaultCamera: { pos: DEFAULT_CAMERA_POS, interest: DEFAULT_CAMERA_INTEREST, fov: DEFAULT_CAMERA_FOV },
    },
    // Phase B — Softimage PPG / floating dialog shell chrome (uiut PE host + RT_BITMAP)
    ppgChrome: ppgChromeAudit(),
    // Animate chrome (PE pack #47 + xsivw / PNG glyph extras)
    animChrome: animChromeAudit(),
  };
};
(window as any).__menubarStatus = () => menubarStatus();
(window as any).__softUiChecks = () => {
  const a = (window as any).__uiAudit();
  return {
    keymapsExpectedOk: a.keymapsExpectedOk,
    keymapStats: a.keymapStats,
    prefsPageCount: a.prefsPageCount,
    prefsPages: a.prefsPages,
    menubarWired: a.menubarWired,
    menubarSilent: a.menubarSilent,
  };
};
(window as any).__openView = (name: string) => openView(name);
(window as any).__animEditorsExecCmdSmoke = () => animEditorsExecCmdSmoke(app);
(window as any).__switchModule = (m: string) => { app.module = m as any; app.events.emit('module'); };
(window as any).__hairApplySmoke = () => hairApplySmoke(app);
// FROST P0 hooks (graph session + evaluator smoke)
frostOf(app);
(window as any).__frost = () => frostOf(app);
(window as any).__frostSmoke = () => runFrostSmokeTests();

// Auto-inspect (Interaction pref "Popup Property Editors on Node Creation"): a new node opens a floating property
// editor, like Softimage's "Scene_Root : sphere (General)" window, rather than switching the MCP tray.
let floatPPG: { win: ReturnType<typeof openFloating>; node: any } | null = null;
const openFloatingPPG = (node: any) => {
  if (floatPPG && app.recyclePPG) { floatPPG.node = node; app.events.emit('selection'); return; }
  const ppgW = (applyPpgChrome().tokens.floatDefaultWidthPx) || 420;
  if (floatPPG && !app.recyclePPG) { const fixed = node; openFloating('', (body, w) => { propertyEditor(app, body, () => fixed); setTimeout(() => w.setTitle(body.querySelector('.ppg-title')?.textContent ?? '')); }, { w: ppgW, cls: 'ppg-window' }); return; }
  const state = { win: null as any, node }; floatPPG = state;
  state.win = openFloating('', (body, w) => { propertyEditor(app, body, () => floatPPG?.node); const sync = () => w.setTitle(body.querySelector('.ppg-title')?.textContent ?? ''); setTimeout(sync); app.events.on('selection', () => setTimeout(sync)); app.events.on('scene', () => setTimeout(sync)); }, { w: ppgW, x: 60, y: 40, cls: 'ppg-window' });
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
const importEmdlFile = (f: File, { newScene = false } = {}) => {
  if (newScene) app.run('NewScene');
  return f.arrayBuffer().then(buf => app.run('ImportModel', { Bytes: buf, FileName: f.name })).then((m: any) => {
    sceneName = f.name.replace(/\.emdl$/i, '') || sceneName;
    updateTitle();
    return m;
  });
};
window.addEventListener('openscene', (e: any) => {
  let name = e.detail?.name; const rec: string[] = (() => { try { return JSON.parse(localStorage.getItem('si.recent') ?? '[]'); } catch { return []; } })();
  if (!name) { name = prompt('Open scene:\n' + rec.map((n, i) => `${i + 1}. ${n}`).join('\n') + '\n(number or name; leave empty to pick a file)', '') ?? ''; if (/^\d+$/.test(name)) name = rec[Number(name) - 1]; }
  const load = (text: string, nm: string) => { app.run('NewScene'); sceneStart = app.log.length; app.autoInspect = false; for (const line of text.split(/\r?\n/)) { if (line.trim()) { try { runScriptLine(app, line); } catch { /* logged */ } } } app.autoInspect = true; app.select([]); sceneName = nm; updateTitle(); };
  if (name) { const t = localStorage.getItem('si.scene.' + name); if (t !== null) load(t, name); else app.logMsg('error', `Scene "${name}" not found`); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.scn.txt,.emdl,.json';
  inp.onchange = () => {
    const f = inp.files?.[0]; if (!f) return;
    if (/\.emdl$/i.test(f.name) || /\.json$/i.test(f.name)) { importEmdlFile(f, { newScene: true }); return; }
    f.text().then(t => load(t, f.name.replace(/\.scn\.txt$|\.txt$/, '')));
  };
  inp.click();
});
// File > Merge… (and interchange formats without a dedicated parser): append a scene script, or import .obj / .emdl.
window.addEventListener('mergescene', (e: any) => {
  const accept = e.detail?.accept ?? '.txt,.scn.txt,.emdl,.json';
  const format = e.detail?.format ? String(e.detail.format) : 'scene';
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
  inp.onchange = () => {
    const f = inp.files?.[0]; if (!f) return;
    if (/\.obj$/i.test(f.name)) {
      const url = URL.createObjectURL(f);
      Promise.resolve(app.run('ImportObjFile', { FileName: url })).finally(() => URL.revokeObjectURL(url));
      return;
    }
    if (/\.emdl$/i.test(f.name) || /\.json$/i.test(f.name)) { importEmdlFile(f); return; }
    f.text().then(text => {
      let n = 0; app.autoInspect = false;
      for (const line of text.split(/\r?\n/)) { if (line.trim()) { try { runScriptLine(app, line); n++; } catch { /* logged */ } } }
      app.autoInspect = true; app.events.emit('scene');
      app.logMsg('info', `Merged ${format} "${f.name}" (${n} commands)`);
    });
  };
  inp.click();
});
// Desktop drag-drop: Softimage .emdl / Direct JSON OM / .obj onto the shell.
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
window.addEventListener('drop', (e) => {
  const files = e.dataTransfer?.files; if (!files?.length) return;
  const f = files[0];
  if (!/\.(emdl|json|obj)$/i.test(f.name)) return;
  e.preventDefault();
  if (/\.obj$/i.test(f.name)) {
    const url = URL.createObjectURL(f);
    Promise.resolve(app.run('ImportObjFile', { FileName: url })).finally(() => URL.revokeObjectURL(url));
    return;
  }
  importEmdlFile(f);
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
