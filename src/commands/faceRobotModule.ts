// Softimage Face Robot module — dump-backed (MENU 300 + modules_facerobot.json + ShowFaceRobotActPanel).
// Enable/Disable/Layout ExecuteCommand OK on Desktop but Commands.found=false (plugin). Stage 1 chrome only; FR.dll LOCK.
import { App } from '../core/commands';
import frTops from '../data/si/face_robot_module_mcp_tops.json';
import stage1 from '../data/si/face_robot_stage1_chrome.json';

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

/** Softimage Face Robot layout / enable / Act panel commands. */
export function registerFaceRobotModuleCommands(app: App) {
  restoreFaceRobotFlag(app);

  // commands_full: ShowFaceRobotActPanel — Face Robot Act Floating Panel
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
      openView('Face Robot Stage 1');
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
      openView('Face Robot Stage 1');
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
      // Softimage returns to Default Softimage layout; Stage 1 float stays closable by user.
      app.logMsg('info', 'Softimage Layout');
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
}

/** Audit for __uiAudit / compare_face_robot_module — dump-backed MENU 300 + Stage 1 + prefs. */
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
    grey_until_pick: string[];
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
    headsCount: chrome.heads_list_attested?.length ?? 0,
    greyUntilPick: chrome.grey_until_pick,
    commandsWired: [
      'ShowFaceRobotActPanel',
      ...layoutCmds,
      'FaceRobot',
      'fr_Diagnose',
    ].filter(n => app.commands.has(n)),
    showFaceRobotActPanel: app.commands.has('ShowFaceRobotActPanel'),
    enableFaceRobot: app.commands.has('Enable Face Robot'),
    faceRobotLayout: app.commands.has('Face Robot Layout'),
    disableFaceRobot: app.commands.has('Disable Face Robot'),
    softimageLayout: app.commands.has('Softimage Layout'),
    faceRobotEnabled: faceRobotEnabled(app),
    prefsFull: tops.prefs?.full,
    prefsPropset: tops.prefs?.propset,
    prefsParamCount: tops.prefs?.param_count,
    prefsPagePresent: prefsPages.includes('C3DPrefsFaceRobot'),
    currentModule: app.module,
  };
}
