// UI-side commands that Softimage's shelf/panel scripts call (Application/toolbars/*.xsitb): tool activation,
// viewport display modes, optional panels, view-manager layouts. They dispatch DOM events the views listen to.
import { App } from '../core/commands';
import { tool } from '../ui/viewManager';

const ev = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));

export function registerUICommands(app: App) {
  const reg = (name: string, label: string, execute: (app: App, a: Record<string, any>) => any, args: { name: string; default: any }[] = []) => app.register({ name, label, category: 'UI', args, undoable: false, execute });
  // TranslateTool / RotationTool / ScalingTool: toolmanager.dll activation commands (CMD-B16a, toolsB16a.ts).
  // ActivateSelectTool, Activate{Vertex,Edge,Polygon,RaycastEdge,RaycastPoly}SelTool, IsolateSelected: CMD-B19d (selectionB19d.ts)
  reg('ActivateObjectSelTool', 'Object Select Tool', (app) => { tool.setMode('select'); app.setSelMode('object'); });
  reg('ActivateRaycastSelTool', 'Raycast Select Tool', (app) => { tool.setMode('select'); app.setSelMode('object'); });
  // FrameSelection / FrameAll / CameraReset: vm.dll commands of CMD-B17i (src/commands/inferredB10Views.ts).
  reg('ResetCamera', 'Reset Camera', () => ev('frameall'), [{ name: 'View', default: -1 }]);
  reg('SetDisplayMode', 'Set Display Mode', (_, a) => ev('setdisplaymode', { mode: String(a.Mode ?? a.Camera ?? '').toLowerCase() }), [{ name: 'Camera', default: '' }, { name: 'Mode', default: 'shaded' }]);
  reg('GetViewCamera', 'Get View Camera', (_, a) => `Views.View${['A', 'B', 'C', 'D'][a.View] ?? 'B'}.Camera`, [{ name: 'View', default: -1 }]);
  reg('GetFocusedViewport', 'Get Focused Viewport', () => 'B');
  reg('ToggleOptionalPanel', 'Toggle Optional Panel', (_, a) => ev('togglepanel', { name: a.Name }), [{ name: 'Name', default: '' }]);
  reg('ShowOptionalPanel', 'Show Optional Panel', (_, a) => ev('togglepanel', { name: a.Name, show: true }), [{ name: 'Name', default: '' }]);
  // GetPrimStereoCamera: the StereoCamera.js rig (three cameras, Stereo property, constraint operators), CMD-B18d
  // (src/commands/faceRobotB18d.ts, WIRE_CORRECTIONS_B18 item 12); it was a plain GetPrim Camera here.
  reg('SetViewManagerLayout', 'View Manager Layout', (_, a) => ev('vmlayout', { layout: a.Layout }), [{ name: 'Layout', default: 'standard' }]);
  reg('MaximizeViewport', 'Maximize/Restore Viewport', () => ev('maximizeview'));
  reg('OpenPreferences', 'Preferences', (_, a) => ev('openprefs', { page: a.Page }), [{ name: 'Page', default: '' }]);
  // SaveScene / OpenScene: tasks.dll scene tasks, CMD-B19b (src/commands/tasksB19b.ts)

  // Softimage ToggleValue (commands_full Viewing) — harvest Hair ACTIVE via ScriptingName ToggleValue.
  // ParamName e.g. objhair; toggles a boolean display flag bag (no invent camera bitmaps).
  app.register({
    name: 'ToggleValue',
    label: 'ToggleValue',
    category: 'Viewing',
    args: [
      { name: 'ParamName', default: '' },
      { name: 'InputObjs', default: '' },
    ],
    undoable: false,
    description: 'Toggle a boolean parameter value',
    execute(app, a) {
      const key = String(a.ParamName || '').split(',')[0].trim() || 'toggle';
      const A = app as any;
      A.viewToggles ??= {};
      A.viewToggles[key] = !A.viewToggles[key];
      app.logMsg('info', `ToggleValue ${key}: ${A.viewToggles[key] ? 'ON' : 'OFF'}`);
      app.events.emit('frame');
      return A.viewToggles[key];
    },
  });
  // Softimage ExecuteCommand("Hair", []) ACTIVE → ToggleValue ParamName=objhair (commands_full).
  app.register({
    name: 'Hair',
    label: 'Hair',
    category: 'Viewing',
    args: [],
    undoable: false,
    execute: (app) => app.run('ToggleValue', { ParamName: 'objhair', InputObjs: '*.camvis,Views.*.*.camvis' }),
  });

  // Softimage full-tab harvest UI ACTIVE ExecuteCommand Names (found often false; [] still ok).
  // MCP already implements these hits — Name aliases keep Softimage scripting parity (no invent).
  app.register({
    name: 'SelectTool', label: 'Select Tool', category: 'Manipulation', args: [], undoable: false,
    execute: (app) => app.run('ActivateSelectTool'),
  });
  app.register({
    name: 'Preferences', label: 'Preferences', category: 'UI', args: [], undoable: false,
    execute: (app) => app.run('OpenPreferences', {}),
  });
  app.register({
    name: 'ToggleSnap', label: 'Toggle Snap', category: 'Manipulation', args: [], undoable: false,
    execute(app) {
      const t = tool as any;
      t.snap ??= { on: false, point: true, curve: false, midpoint: false, grid: false };
      t.snap.on = !t.snap.on;
      app.logMsg('info', `Snap ${t.snap.on ? 'ON' : 'OFF'}`);
      app.events.emit('selection');
      return t.snap.on;
    },
  });
  app.register({
    name: 'ToggleProportional', label: 'Toggle Proportional', category: 'Manipulation', args: [], undoable: false,
    execute(app) {
      app.proportional.on = !app.proportional.on;
      app.logMsg('info', `Proportional ${app.proportional.on ? 'ON' : 'OFF'}`);
      app.events.emit('selection');
      return app.proportional.on;
    },
  });
  app.register({
    name: 'ToggleSymmetry', label: 'Toggle Symmetry', category: 'Manipulation', args: [], undoable: false,
    execute(app) {
      const A = app as any;
      A.symmetry = !A.symmetry;
      app.logMsg('info', `Symmetry ${A.symmetry ? 'ON' : 'OFF'}`);
      app.events.emit('selection');
      return A.symmetry;
    },
  });
  app.register({
    name: 'ToggleCOG', label: 'Toggle COG', category: 'Manipulation', args: [], undoable: false,
    execute(app) {
      const A = app as any;
      A.cog = !A.cog;
      app.logMsg('info', `COG ${A.cog ? 'ON' : 'OFF'}`);
      app.events.emit('selection');
      return A.cog;
    },
  });
  // Softimage Face Robot Help / Wiki (harvest ACTIVE Name without trailing ...)
  app.register({
    name: 'Face Robot Help', label: 'Face Robot Help', category: 'Face Robot', args: [], undoable: false,
    execute() { window.open('https://help.autodesk.com/view/SI/2015/ENU/', '_blank'); },
  });
  app.register({
    name: 'Face Robot Wiki', label: 'Face Robot Wiki', category: 'Face Robot', args: [], undoable: false,
    execute() { window.open('https://en.wikipedia.org/wiki/Autodesk_Softimage', '_blank'); },
  });
}
