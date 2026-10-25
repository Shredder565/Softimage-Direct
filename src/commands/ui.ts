// UI-side commands that Softimage's shelf/panel scripts call (Application/toolbars/*.xsitb): tool activation,
// viewport display modes, optional panels, view-manager layouts. They dispatch DOM events the views listen to.
import { App } from '../core/commands';
import { tool } from '../ui/viewManager';

const ev = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));

export function registerUICommands(app: App) {
  const reg = (name: string, label: string, execute: (app: App, a: Record<string, any>) => any, args: { name: string; default: any }[] = []) => app.register({ name, label, category: 'UI', args, undoable: false, execute });
  reg('TranslateTool', 'Translate Tool', () => tool.setMode('translate'));
  reg('RotationTool', 'Rotation Tool', () => tool.setMode('rotate'));
  reg('ScalingTool', 'Scaling Tool', () => tool.setMode('scale'));
  reg('ActivateSelectTool', 'Select Tool', () => tool.setMode('select'));
  reg('ActivateObjectSelTool', 'Object Select Tool', (app) => { tool.setMode('select'); app.setSelMode('object'); });
  reg('ActivateVertexSelTool', 'Point Select Tool', (app) => app.setSelMode('point'));
  reg('ActivateEdgeSelTool', 'Edge Select Tool', (app) => app.setSelMode('edge'));
  reg('ActivatePolygonSelTool', 'Polygon Select Tool', (app) => app.setSelMode('polygon'));
  reg('ActivateRaycastEdgeSelTool', 'Raycast Edge Select Tool', (app) => app.setSelMode('edge'));
  reg('ActivateRaycastPolySelTool', 'Raycast Polygon Select Tool', (app) => app.setSelMode('polygon'));
  reg('ActivateRaycastSelTool', 'Raycast Select Tool', (app) => { tool.setMode('select'); app.setSelMode('object'); });
  reg('FrameSelection', 'Frame Selection', () => ev('framesel'), [{ name: 'Toggle', default: false }, { name: 'AllViews', default: false }, { name: 'View', default: -1 }]);
  reg('FrameAll', 'Frame All', () => ev('frameall'), [{ name: 'Toggle', default: false }, { name: 'AllViews', default: false }, { name: 'View', default: -1 }]);
  reg('ResetCamera', 'Reset Camera', () => ev('frameall'), [{ name: 'View', default: -1 }]);
  reg('CameraReset', 'Reset Camera', () => ev('frameall'), [{ name: 'View', default: -1 }]);
  reg('SetDisplayMode', 'Set Display Mode', (_, a) => ev('setdisplaymode', { mode: String(a.Mode ?? a.Camera ?? '').toLowerCase() }), [{ name: 'Camera', default: '' }, { name: 'Mode', default: 'shaded' }]);
  reg('GetViewCamera', 'Get View Camera', (_, a) => `Views.View${['A', 'B', 'C', 'D'][a.View] ?? 'B'}.Camera`, [{ name: 'View', default: -1 }]);
  reg('GetFocusedViewport', 'Get Focused Viewport', () => 'B');
  reg('ToggleOptionalPanel', 'Toggle Optional Panel', (_, a) => ev('togglepanel', { name: a.Name }), [{ name: 'Name', default: '' }]);
  reg('ShowOptionalPanel', 'Show Optional Panel', (_, a) => ev('togglepanel', { name: a.Name, show: true }), [{ name: 'Name', default: '' }]);
  reg('IsolateSelected', 'Isolate Selected', (app, a) => { const sel = new Set(app.selectedObjects); const all = [...app.scene.allObjects()]; const vis = (o: any, v: boolean) => { const p = o.property('visibility')?.get('viewvis'); if (p) app.setParam(p, v, 'Isolate'); }; const hidden = all.filter(o => !sel.has(o) && !o.visible); if (hidden.length && !a.Force) { for (const o of all) vis(o, true); } else for (const o of all) if (!sel.has(o)) vis(o, false); }, [{ name: 'Force', default: false }, { name: 'View', default: -1 }]);
  reg('GetPrimStereoCamera', 'Get Stereo Camera', (app) => app.run('GetPrim', { PresetObj: 'Camera' }));
  reg('SetViewManagerLayout', 'View Manager Layout', (_, a) => ev('vmlayout', { layout: a.Layout }), [{ name: 'Layout', default: 'standard' }]);
  reg('MaximizeViewport', 'Maximize/Restore Viewport', () => ev('maximizeview'));
  reg('OpenPreferences', 'Preferences', (_, a) => ev('openprefs', { page: a.Page }), [{ name: 'Page', default: '' }]);
  reg('SaveScene', 'Save Scene', () => ev('savescene'));
  reg('OpenScene', 'Open Scene', () => ev('openscene'));

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
}
