// Softimage Face Robot Stage 1 Assemble + Act floating panel shells.
// Chrome from media/softimage-modules-tour/50-facerobot-layout.png + facerobot.xsily (dump/Desktop only).
import { App } from '../core/commands';
import stage1 from '../data/si/face_robot_stage1_chrome.json';
import frChrome from '../data/si/face_robot_stage1_chrome.json';

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

type Stage1Chrome = typeof stage1 & {
  library_tabs: string[];
  library_path_attested: string;
  heads_list_attested: string[];
  tool_tabs: string[];
  tool_buttons: string[];
  log_default: string;
  grey_until_pick: string[];
  view: { category?: string; defaultsize?: number[]; title: string };
};

const chrome = stage1 as Stage1Chrome;

/** Softimage FaceStage1_SideView — Stage 1: Assemble (screenshot structure). */
export function faceRobotStage1View(app: App, host: HTMLElement) {
  const root = el('div', 'fr-stage1');
  host.appendChild(root);
  const def = chrome.view;
  if (def?.category) root.dataset.siCategory = def.category;
  if (def?.defaultsize) root.dataset.siDefaultsize = def.defaultsize.join(',');
  root.dataset.siFrStage = '1';

  const title = el('div', 'fr-stage1-title');
  title.append(el('span', 'fr-stage1-title-text', chrome.view.title), el('span', 'fr-stage1-help', '?'));
  root.appendChild(title);

  // Library: Heads / Parts / Actor / Custom / Type
  const lib = el('div', 'fr-stage1-lib');
  const libTabs = el('div', 'fr-tabs');
  let libTab = chrome.library_tabs[0] ?? 'Heads';
  const pathBar = el('input', 'fr-path') as HTMLInputElement;
  pathBar.type = 'text';
  pathBar.readOnly = true;
  const list = el('div', 'fr-lib-list');

  const headPath = () => {
    const prefs = (window as any).__prefSets as Map<string, { val: (n: string) => unknown }> | undefined;
    const p = prefs?.get('C3DPrefsFaceRobot')?.val('Head_Path');
    return (typeof p === 'string' && p) ? p : chrome.library_path_attested;
  };

  const renderLib = () => {
    pathBar.value = libTab === 'Heads' ? headPath() : '';
    list.innerHTML = '';
    const items = libTab === 'Heads' ? chrome.heads_list_attested : [];
    if (!items.length) {
      list.appendChild(el('div', 'fr-lib-empty', libTab === 'Heads' ? '' : `(${libTab} library — path from preferences.FaceRobot)`));
      return;
    }
    for (const name of items) {
      const row = el('div', 'fr-lib-item', name);
      row.onclick = () => {
        list.querySelectorAll('.fr-lib-item').forEach(x => x.classList.remove('selected'));
        row.classList.add('selected');
        app.logMsg('info', `Face Robot library: ${name}`);
      };
      list.appendChild(row);
    }
  };

  for (const t of chrome.library_tabs) {
    const b = el('button', 'fr-tab' + (t === libTab ? ' active' : ''), t);
    b.onclick = () => {
      libTab = t;
      libTabs.querySelectorAll('.fr-tab').forEach(x => x.classList.toggle('active', x.textContent === t));
      renderLib();
    };
    libTabs.appendChild(b);
  }
  lib.append(libTabs, pathBar, list);
  root.appendChild(lib);
  renderLib();

  // Tools: Face / Eyes / Mouth + Deactive Locate Video Manage + Log
  const tools = el('div', 'fr-stage1-tools');
  const toolTabs = el('div', 'fr-tabs');
  let toolTab = chrome.tool_tabs[0] ?? 'Face';
  for (const t of chrome.tool_tabs) {
    const b = el('button', 'fr-tab' + (t === toolTab ? ' active' : ''), t);
    b.onclick = () => {
      toolTab = t;
      toolTabs.querySelectorAll('.fr-tab').forEach(x => x.classList.toggle('active', x.textContent === t));
    };
    toolTabs.appendChild(b);
  }
  const toolBtns = el('div', 'fr-tool-btns');
  for (const lab of chrome.tool_buttons) {
    const b = el('button', 'fr-tool-btn', lab);
    b.onclick = () => app.logMsg('info', `Face Robot Stage 1: ${lab} (${toolTab})`);
    toolBtns.appendChild(b);
  }
  const logWrap = el('div', 'fr-log-wrap');
  logWrap.append(el('div', 'fr-log-label', 'Log'), el('div', 'fr-log', chrome.log_default));
  tools.append(toolTabs, toolBtns, logWrap);
  root.appendChild(tools);

  // Type field
  const typeRow = el('div', 'fr-type-row');
  typeRow.append(el('label', '', 'Type'), Object.assign(el('input', 'fr-type-input') as HTMLInputElement, { type: 'text', value: '' }));
  root.appendChild(typeRow);

  // Pick Objects / Scan (+ Diagnose grey-until-pick per tour)
  const exec = el('div', 'fr-exec');
  const pick = el('button', 'fr-exec-pick', 'Pick Objects') as HTMLButtonElement;
  const scan = el('button', 'fr-exec-scan', 'Scan »') as HTMLButtonElement;
  const diagnose = el('button', 'fr-exec-diagnose', 'Diagnose') as HTMLButtonElement;
  diagnose.classList.add('fr-secondary');

  const syncGrey = () => {
    const hasPick = app.selectedObjects.length > 0;
    const grey = chrome.grey_until_pick ?? ['Diagnose', 'Scan'];
    scan.disabled = grey.includes('Scan') && !hasPick;
    diagnose.disabled = grey.includes('Diagnose') && !hasPick;
    scan.classList.toggle('disabled', scan.disabled);
    diagnose.classList.toggle('disabled', diagnose.disabled);
  };
  pick.onclick = () => {
    app.logMsg('info', 'Face Robot: Pick Objects — select mesh(es) in the viewport');
    const log = root.querySelector('.fr-log');
    if (log) log.textContent = app.selectedObjects.length
      ? `Picked ${app.selectedObjects.map(o => o.name).join(', ')}`
      : chrome.log_default;
    syncGrey();
  };
  scan.onclick = () => {
    if (scan.disabled) return;
    app.logMsg('info', 'Face Robot: Scan (shell — FR.dll LOCK)');
  };
  diagnose.onclick = () => {
    if (diagnose.disabled) return;
    if (app.commands.has('fr_Diagnose')) app.run('fr_Diagnose');
    else app.logMsg('info', 'Face Robot: Diagnose (shell — fr_Diagnose LOCK)');
  };
  exec.append(pick, scan, diagnose);
  root.appendChild(exec);

  syncGrey();
  app.events.on('selection', syncGrey);
}

/** Softimage ShowFaceRobotActPanel — contextual synoptic shell (Path/Offset from commands_full). */
export function faceRobotActPanelView(app: App, host: HTMLElement, opts?: {
  path?: string; Path?: string; offsetX?: number; OffsetX?: number; offsetY?: number; OffsetY?: number;
}) {
  const root = el('div', 'fr-act-panel');
  host.appendChild(root);
  const def = (frChrome as Stage1Chrome).act_panel;
  if (def?.category) root.dataset.siCategory = def.category;
  if (def?.defaultsize) root.dataset.siDefaultsize = def.defaultsize.join(',');
  root.dataset.siFrAct = '1';
  const path = opts?.Path ?? opts?.path ?? '$FACEROBOTROOT\\Application\\views\\synoptic\\FaceRobotContext.htm';
  const ox = opts?.OffsetX ?? opts?.offsetX ?? 3;
  const oy = opts?.OffsetY ?? opts?.offsetY ?? 335;
  root.append(
    el('div', 'fr-act-title', 'Face Robot Act'),
    el('div', 'fr-act-path', String(path)),
    el('div', 'fr-act-meta', `OffsetX=${ox} OffsetY=${oy}`),
    el('div', 'fr-act-body', 'Contextual synoptic view shell (dump-backed). Synoptic HTML / FR.dll body LOCK.'),
  );
  app.logMsg('info', 'ShowFaceRobotActPanel');
}
