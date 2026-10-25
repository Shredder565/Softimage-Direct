// Softimage Face Robot Stage 1 Assemble + Act floating panel (Synoptic View) shells.
// Chrome from media/softimage-modules-tour/50-facerobot-layout.png OCR + facerobot.xsily (dump/Desktop only).
import { App } from '../core/commands';
import stage1 from '../data/si/face_robot_stage1_chrome.json';
import { faceRobotSynopticSlot } from './faceRobotSynoptic';

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

type Stage1Chrome = typeof stage1 & {
  library_section_label?: string;
  library_tabs: string[];
  library_path_attested: string;
  heads_list_attested: string[];
  tool_section_label?: string;
  tool_tabs: string[];
  tool_buttons: string[];
  log_default: string;
  grey_until_pick: string[];
  view: { category?: string; defaultsize?: number[]; title: string };
  act_panel: {
    category?: string;
    defaultsize?: number[];
    view_type?: string;
    path_default?: string;
    OffsetX?: number;
    OffsetY?: number;
  };
};

const chrome = stage1 as Stage1Chrome;

/** Softimage FaceStage1_SideView — Stage 1 > Assemble (Desktop screenshot structure). */
export function faceRobotStage1View(app: App, host: HTMLElement) {
  const root = el('div', 'fr-stage1');
  host.appendChild(root);
  const def = chrome.view;
  if (def?.category) root.dataset.siCategory = def.category;
  if (def?.defaultsize) root.dataset.siDefaultsize = def.defaultsize.join(',');
  root.dataset.siFrStage = '1';
  root.dataset.siViewType = 'FaceStage1_SideView';

  const title = el('div', 'fr-stage1-title');
  title.append(el('span', 'fr-stage1-title-text', chrome.view.title), el('span', 'fr-stage1-help', '?'));
  root.appendChild(title);

  // Library: Heads / Parts / Actor / Custom / Type
  const lib = el('div', 'fr-stage1-lib');
  lib.appendChild(el('div', 'fr-section-label', chrome.library_section_label ?? 'Library'));
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

  // Tools: Face / Eyes / Mouth + Diagnose / Freeze / Hide (Desktop OCR) + Log
  const tools = el('div', 'fr-stage1-tools');
  tools.appendChild(el('div', 'fr-section-label', chrome.tool_section_label ?? 'Tools'));
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
  const grey = chrome.grey_until_pick ?? ['Diagnose', 'Scan'];
  const syncToolGrey = () => {
    const hasPick = app.selectedObjects.length > 0;
    toolBtns.querySelectorAll('.fr-tool-btn').forEach(btn => {
      const lab = btn.textContent ?? '';
      const disable = grey.includes(lab) && !hasPick;
      (btn as HTMLButtonElement).disabled = disable;
      btn.classList.toggle('disabled', disable);
    });
  };
  for (const lab of chrome.tool_buttons) {
    const b = el('button', 'fr-tool-btn', lab) as HTMLButtonElement;
    b.onclick = () => {
      if (b.disabled) return;
      if (lab === 'Diagnose') {
        if (app.commands.has('fr_Diagnose')) app.run('fr_Diagnose');
        else app.logMsg('info', 'Face Robot: Diagnose (shell — fr_Diagnose LOCK)');
        return;
      }
      app.logMsg('info', `Face Robot Stage 1: ${lab} (${toolTab}) — FR plugin LOCK`);
    };
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

  // Pick Objects / Scan (Diagnose lives under Tools per Desktop OCR; grey-until-pick Scan)
  const exec = el('div', 'fr-exec');
  const pick = el('button', 'fr-exec-pick', 'Pick Objects') as HTMLButtonElement;
  const scan = el('button', 'fr-exec-scan', 'Scan »') as HTMLButtonElement;

  const syncGrey = () => {
    const hasPick = app.selectedObjects.length > 0;
    scan.disabled = grey.includes('Scan') && !hasPick;
    scan.classList.toggle('disabled', scan.disabled);
    syncToolGrey();
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
  exec.append(pick, scan);
  root.appendChild(exec);

  syncGrey();
  app.events.on('selection', syncGrey);
}

/** Softimage ShowFaceRobotActPanel — Synoptic View shell (Path/Offset from commands_full). HTML body LOCK. */
export function faceRobotActPanelView(app: App, host: HTMLElement, opts?: {
  path?: string; Path?: string; offsetX?: number; OffsetX?: number; offsetY?: number; OffsetY?: number;
}) {
  const root = el('div', 'fr-act-panel');
  host.appendChild(root);
  const def = chrome.act_panel;
  if (def?.category) root.dataset.siCategory = def.category;
  if (def?.defaultsize) root.dataset.siDefaultsize = def.defaultsize.join(',');
  root.dataset.siFrAct = '1';
  root.dataset.siViewType = def?.view_type ?? 'Synoptic View';
  const path = opts?.Path ?? opts?.path ?? def?.path_default
    ?? '$FACEROBOTROOT\\Application\\views\\synoptic\\FaceRobotContext.htm';
  const ox = opts?.OffsetX ?? opts?.offsetX ?? def?.OffsetX ?? 3;
  const oy = opts?.OffsetY ?? opts?.offsetY ?? def?.OffsetY ?? 335;
  root.append(
    el('div', 'fr-act-title', 'Face Robot Act Floating Panel'),
    el('div', 'fr-act-meta', `Synoptic View · OffsetX=${ox} OffsetY=${oy}`),
  );
  const slotHost = el('div', 'fr-act-synoptic');
  root.appendChild(slotHost);
  faceRobotSynopticSlot(slotHost, {
    name: 'FaceRobotContext',
    path: String(path),
    note: 'Contextual synoptic view shell (commands_full Path). Synoptic HTML / FR.dll body LOCK.',
  });
  app.logMsg('info', 'ShowFaceRobotActPanel');
}
