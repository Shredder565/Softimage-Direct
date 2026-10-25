// Softimage Face Robot module — MENU 300 + Control Panel (facerobot.xsily) + ShowFaceRobotActPanel.
// Enable/Disable/Layout ExecuteCommand OK on Desktop but Commands.found=false (plugin).
// Stage structure dump-attested; FR.dll / synoptic HTML bodies LOCK.
import { App } from '../core/commands';
import frTops from '../data/si/face_robot_module_mcp_tops.json';
import stage1 from '../data/si/face_robot_stage1_chrome.json';
import ctrl from '../data/si/face_robot_controller_chrome.json';
import viewsIndex from '../data/si/face_robot_views_index.json';
import { faceRobotCurrentStage, setFaceRobotStage } from '../ui/faceRobotController';

const openView = (name: string) => window.dispatchEvent(new CustomEvent('openview', { detail: { name } }));

/** Softimage Face Robot enabled flag (Desktop Enable/Disable Face Robot). */
export function faceRobotEnabled(app: App): boolean {
  return !!(app as any).__faceRobotEnabled;
}
export function setFaceRobotEnabled(app: App, on: boolean) {
  (app as any).__faceRobotEnabled = on;
  try { localStorage.setItem('si.facerobot.enabled', on ? '1' : '0'); } catch { /* */ }
  app.events.emit('module');
}

function restoreFaceRobotFlag(app: App) {
  if ((app as any).__faceRobotEnabled != null) return;
  try {
    (app as any).__faceRobotEnabled = localStorage.getItem('si.facerobot.enabled') === '1';
  } catch {
    (app as any).__faceRobotEnabled = false;
  }
}

const FR_LAYOUT_CMDS = [
  'Face Robot Layout',
  'Softimage Layout',
  'Enable Face Robot',
  'Disable Face Robot',
  'Face Robot',
] as const;

const FR_CONTROL_PANEL = 'Face Robot Control Panel';

/** Softimage Face Robot layout / enable / Act panel / stage cmds. */
export function registerFaceRobotModuleCommands(app: App) {
  restoreFaceRobotFlag(app);

  // commands_full: ShowFaceRobotActPanel — Face Robot Act Floating Panel (Synoptic View)
  const act = (frTops as typeof frTops).act_panel;
  app.register({
    name: 'ShowFaceRobotActPanel',
    label: 'Face Robot Act Floating Panel',
    category: '',
    description: 'Opens the face robot contextual synoptic view',
    args: [
      { name: 'Path', default: act?.args?.Path ?? '$FACEROBOTROOT\\Application\\views\\synoptic\\FaceRobotContext.htm' },
      { name: 'OffsetX', default: act?.args?.OffsetX ?? 3 },
      { name: 'OffsetY', default: act?.args?.OffsetY ?? 335 },
    ],
    undoable: false,
    execute(app, a) {
      (app as any).__faceRobotActArgs = { Path: a.Path, OffsetX: a.OffsetX, OffsetY: a.OffsetY };
      openView('Face Robot Act Floating Panel');
      return null;
    },
  });

  // Desktop ExecuteCommand names (Commands.found=false on Softimage — still execute).
  app.register({
    name: 'Enable Face Robot',
    label: 'Enable Face Robot',
    category: 'Face Robot',
    args: [],
    undoable: false,
    execute(app) {
      setFaceRobotEnabled(app, true);
      setFaceRobotStage(app, faceRobotCurrentStage(app) || 1);
      openView(FR_CONTROL_PANEL);
      app.logMsg('info', 'Enable Face Robot');
      return null;
    },
  });
  app.register({
    name: 'Disable Face Robot',
    label: 'Disable Face Robot',
    category: 'Face Robot',
    args: [],
    undoable: false,
    execute(app) {
      setFaceRobotEnabled(app, false);
      app.logMsg('info', 'Disable Face Robot');
      return null;
    },
  });
  app.register({
    name: 'Face Robot Layout',
    label: 'Face Robot Layout',
    category: 'Face Robot',
    args: [],
    undoable: false,
    execute(app) {
      setFaceRobotEnabled(app, true);
      setFaceRobotStage(app, 1);
      openView(FR_CONTROL_PANEL);
      app.logMsg('info', 'Face Robot Layout');
      return null;
    },
  });
  app.register({
    name: 'Softimage Layout',
    label: 'Softimage Layout',
    category: 'Face Robot',
    args: [],
    undoable: false,
    execute(app) {
      // Softimage full-tab harvest: ExecuteCommand("Softimage Layout", []) ACTIVE (boot + Face Robot).
      // Closer95 boot: Disable Face Robot then Softimage Layout → Default Softimage layout.
      (app as any).__faceRobotAltLayout = false;
      setFaceRobotEnabled(app, false);
      // layoutEdit listens for layoutmenu — Default is Softimage Default.xsily.
      window.dispatchEvent(new CustomEvent('layoutmenu', { detail: { label: 'Default', path: ['Window', 'Layouts'] } }));
      app.logMsg('info', 'Softimage Layout → Default');
      return null;
    },
  });
  // Desktop alt_switch "Face Robot" — same as Enable + Layout path
  app.register({
    name: 'Face Robot',
    label: 'Face Robot',
    category: 'Face Robot',
    args: [],
    undoable: false,
    execute(app) {
      return app.run('Face Robot Layout');
    },
  });

  // commands_full: FaceRobot(cmd, arg, id) — FR.dll router stub (no invent body)
  app.register({
    name: 'FaceRobot',
    label: 'FaceRobot',
    category: 'Custom',
    args: [
      { name: 'cmd', default: null },
      { name: 'arg', default: null },
      { name: 'id', default: null },
    ],
    undoable: false,
    execute(app, a) {
      app.logMsg('info', `FaceRobot(${a.cmd ?? ''}, ${a.arg ?? ''}, ${a.id ?? ''}) — FR.dll router LOCK`);
      return null;
    },
  });

  // Thin Diagnose stub so Stage 1 Diagnose button can call Softimage scripting name when present
  if (!app.commands.has('fr_Diagnose')) {
    app.register({
      name: 'fr_Diagnose',
      label: 'fr_Diagnose',
      category: 'Custom',
      args: [],
      undoable: false,
      execute(app) {
        app.logMsg('info', 'fr_Diagnose — PreparationTools.js shell (FR plugin LOCK)');
        return null;
      },
    });
  }

  // commands_full: fr_GetCurrentStage — returns current Control Panel stage (1–6)
  if (!app.commands.has('fr_GetCurrentStage')) {
    app.register({
      name: 'fr_GetCurrentStage',
      label: 'fr_GetCurrentStage',
      category: 'Custom',
      args: [],
      undoable: false,
      execute(app) {
        return faceRobotCurrentStage(app);
      },
    });
  }

  // commands_full: fr_SwitchFaceLayout(inLayoutID) — FR.dll; when 1–6, switch Control Panel stage (xsily tray)
  if (!app.commands.has('fr_SwitchFaceLayout')) {
    app.register({
      name: 'fr_SwitchFaceLayout',
      label: 'fr_SwitchFaceLayout',
      category: 'Custom',
      args: [{ name: 'inLayoutID', default: null }],
      undoable: false,
      execute(app, a) {
        // Softimage named arg inLayoutID; also accept bare numeric args from thin callers
        const raw = a?.inLayoutID ?? (typeof a === 'number' ? a : a?.[0]);
        const id = Number(raw);
        if (id >= 1 && id <= 6) {
          setFaceRobotEnabled(app, true);
          setFaceRobotStage(app, id);
          openView(FR_CONTROL_PANEL);
          app.logMsg('info', `fr_SwitchFaceLayout(${id}) → Control Panel Stage ${id}`);
          return null;
        }
        app.logMsg('info', `fr_SwitchFaceLayout(${a.inLayoutID ?? ''}) — FR.dll body LOCK (non-stage id)`);
        return null;
      },
    });
  }

  // ModifyFaceLayout.js stubs — toggle FR vs Softimage layout names (no invent JS body)
  if (!app.commands.has('fr_ToggleFaceLayout')) {
    app.register({
      name: 'fr_ToggleFaceLayout',
      label: 'fr_ToggleFaceLayout',
      category: 'Custom',
      args: [],
      undoable: false,
      execute(app) {
        const alt = !!(app as any).__faceRobotAltLayout;
        (app as any).__faceRobotAltLayout = !alt;
        if (alt) return app.run('Softimage Layout');
        return app.run('Face Robot Layout');
      },
    });
  }
  if (!app.commands.has('fr_SetAltLayout')) {
    app.register({
      name: 'fr_SetAltLayout',
      label: 'fr_SetAltLayout',
      category: 'Custom',
      args: [],
      undoable: false,
      execute(app) {
        (app as any).__faceRobotAltLayout = true;
        app.logMsg('info', 'fr_SetAltLayout — ModifyFaceLayout.js shell');
        return null;
      },
    });
  }

  // GeneralHelper.js — Object View name stub (no invent)
  if (!app.commands.has('fr_ObjectView')) {
    app.register({
      name: 'fr_ObjectView',
      label: 'fr_ObjectView',
      category: 'Custom',
      args: [{ name: 'vname', default: null }],
      undoable: false,
      execute(app, a) {
        app.logMsg('info', `fr_ObjectView(${a.vname ?? ''}) — GeneralHelper.js shell LOCK`);
        return null;
      },
    });
  }
}

/** Audit for __uiAudit / compare_face_robot_module — MENU 300 + Control Panel + Stage 1 + synoptic. */
export function faceRobotModuleAudit(app: App): Record<string, unknown> {
  const tops = frTops as typeof frTops & {
    menu_id: number;
    tops: string[];
    mcp_tops_expected: string[];
    menu_300: { label?: string; id?: number; separator?: boolean }[];
    act_panel: { scripting_name: string };
    prefs: { full: string; propset: string; param_count: number };
    runtime_lock: { status: string };
  };
  const chrome = stage1 as typeof stage1 & {
    view: { defaultsize: number[]; category: string; title: string };
    library_tabs: string[];
    heads_list_attested: string[];
    tool_buttons: string[];
    grey_until_pick: string[];
  };
  const controller = ctrl as typeof ctrl & {
    view: { name: string; defaultsize: number[] };
    stages: {
      index: number;
      side_view_type: string;
      status: string;
      title_url?: string;
      path_status?: string;
      nested?: { synoptic_tray?: { frames: { name: string; path?: string }[] } };
    }[];
    synoptic: {
      stage_frames: string[];
      stage_paths?: Record<string, string>;
      act_panel: { html_body: string; path_default?: string; path_status?: string };
    };
    views_index?: { status: string; n_files_indexed?: number; closer95_n_files?: number; stages_seen?: string[] };
    sizechild: number[];
    runtime_lock: { status: string };
  };
  const vidx = viewsIndex as typeof viewsIndex & {
    status: string;
    synoptic_htm?: Record<string, { path: string; size: number }>;
    stages?: { index: number; titleframe: { path: string } }[];
    closer95?: { n_synoptic_htm?: number; stages_seen?: string[] };
  };
  const layoutCmds = FR_LAYOUT_CMDS.filter(n => app.commands.has(n));
  const prefsPages: string[] = (() => {
    try {
      const m = (window as any).__prefSets as Map<string, unknown> | undefined;
      return m ? [...m.keys()] : [];
    } catch { return []; }
  })();
  return {
    softimage: tops.softimage,
    menuId: tops.menu_id,
    tops: tops.tops,
    mcpTopsExpected: tops.mcp_tops_expected,
    menu300Labels: (tops.menu_300 ?? []).filter(x => !x.separator).map(x => x.label),
    switchToolbarTarget: null,
    runtimeLock: tops.runtime_lock?.status ?? 'LOCK',
    stage1Title: chrome.view?.title,
    stage1DefaultSize: chrome.view?.defaultsize,
    stage1Category: chrome.view?.category,
    libraryTabs: chrome.library_tabs,
    toolButtons: chrome.tool_buttons,
    headsCount: chrome.heads_list_attested?.length ?? 0,
    greyUntilPick: chrome.grey_until_pick,
    controlPanelName: controller.view?.name,
    controlPanelDefaultSize: controller.view?.defaultsize,
    controlPanelSizechild: controller.sizechild,
    stageCount: controller.stages?.length ?? 0,
    stageTypes: (controller.stages ?? []).map(s => s.side_view_type),
    synopticFrames: controller.synoptic?.stage_frames ?? [],
    synopticPaths: controller.synoptic?.stage_paths ?? {},
    synopticPathStatus: controller.synoptic?.act_panel?.path_status ?? 'LOCK',
    synopticHtmlLock: controller.synoptic?.act_panel?.html_body ?? 'LOCK',
    actSynopticPath: controller.synoptic?.act_panel?.path_default ?? null,
    viewsIndexStatus: controller.views_index?.status ?? vidx.status ?? 'LOCK',
    viewsIndexFileCount: controller.views_index?.n_files_indexed
      ?? (Array.isArray((vidx as { files?: unknown[] }).files) ? (vidx as { files: unknown[] }).files.length : 0),
    closer95FileCount: controller.views_index?.closer95_n_files
      ?? (vidx.closer95 as { n_files?: number } | undefined)?.n_files
      ?? 0,
    stagesSeen: controller.views_index?.stages_seen ?? vidx.closer95?.stages_seen ?? [],
    titleframePaths: (controller.stages ?? []).map(s => s.title_url),
    stagePathStatuses: (controller.stages ?? []).map(s => s.path_status ?? 'LOCK'),
    stage5SynopticPaths: (controller.stages?.find(s => s.index === 5)?.nested?.synoptic_tray?.frames ?? [])
      .filter(f => f.path)
      .map(f => ({ name: f.name, path: f.path })),
    currentStage: faceRobotCurrentStage(app),
    commandsWired: [
      'ShowFaceRobotActPanel',
      ...layoutCmds,
      'FaceRobot',
      'fr_Diagnose',
      'fr_GetCurrentStage',
      'fr_SwitchFaceLayout',
      'fr_ToggleFaceLayout',
      'fr_SetAltLayout',
      'fr_ObjectView',
    ].filter(n => app.commands.has(n)),
    showFaceRobotActPanel: app.commands.has('ShowFaceRobotActPanel'),
    enableFaceRobot: app.commands.has('Enable Face Robot'),
    faceRobotLayout: app.commands.has('Face Robot Layout'),
    disableFaceRobot: app.commands.has('Disable Face Robot'),
    softimageLayout: app.commands.has('Softimage Layout'),
    frGetCurrentStage: app.commands.has('fr_GetCurrentStage'),
    frSwitchFaceLayout: app.commands.has('fr_SwitchFaceLayout'),
    faceRobotEnabled: faceRobotEnabled(app),
    prefsFull: tops.prefs?.full,
    prefsPropset: tops.prefs?.propset,
    prefsParamCount: tops.prefs?.param_count,
    prefsPagePresent: prefsPages.includes('C3DPrefsFaceRobot'),
    currentModule: app.module,
  };
}
