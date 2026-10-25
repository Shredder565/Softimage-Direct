// Softimage Face Robot Control Panel — facerobot.xsily facerobot_controller tray (stages 1–6 + synoptic slots).
// closer95 / modules-gdi DUMP_READY path index wired. Stage HTML / FR.dll / SideView bodies LOCK (except Stage 1 PNG chrome).
import { App } from '../core/commands';
import ctrl from '../data/si/face_robot_controller_chrome.json';
import { faceRobotStage1View } from './faceRobotStage1';
import { faceRobotSynopticSlot } from './faceRobotSynoptic';

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

type NestedFrame = {
  name: string;
  type: string;
  url_blank?: string;
  path?: string;
  path_status?: string;
  html_body?: string;
};

type StageDef = {
  index: number;
  frame: string;
  title_frame: string;
  title_url: string;
  title_html_url?: string;
  blank_url: string;
  sideframe_url?: string;
  sideview_html_url?: string;
  sideview_xsivw?: string;
  path_status?: string;
  side_view_type: string;
  title_attested?: string;
  status: string;
  html_body?: string;
  nested?: {
    synoptic_tray?: { frames: NestedFrame[] };
    library?: NestedFrame;
    browser_tray?: { frames: NestedFrame[] };
    mid?: NestedFrame;
    ppg?: { name: string; type: string };
    lower?: NestedFrame;
  };
};

type CtrlChrome = typeof ctrl & {
  view: { name: string; category: string; defaultsize: number[]; active: number };
  stages: StageDef[];
  sizechild: number[];
  synoptic: {
    act_panel: { path_default: string; path_status?: string; html_body?: string };
    stage_frames: string[];
    stage_paths?: Record<string, string>;
  };
  views_index?: { status: string; n_files_indexed?: number; closer95_n_files?: number };
  lipsync_tray: { displayname: string; frames: { name: string; type: string; displayname: string }[]; status: string };
};

const chrome = ctrl as CtrlChrome;

/** Softimage app.__faceRobotStage (1–6); used by fr_GetCurrentStage / tray. */
export function faceRobotCurrentStage(app: App): number {
  const n = Number((app as any).__faceRobotStage);
  return n >= 1 && n <= 6 ? n : 1;
}

export function setFaceRobotStage(app: App, stage: number) {
  const s = Math.max(1, Math.min(6, Math.floor(stage) || 1));
  (app as any).__faceRobotStage = s;
  app.events.emit('fr-stage', s);
  try { localStorage.setItem('si.facerobot.stage', String(s)); } catch { /* */ }
}

function restoreStage(app: App) {
  if ((app as any).__faceRobotStage != null) return;
  try {
    const n = Number(localStorage.getItem('si.facerobot.stage'));
    (app as any).__faceRobotStage = n >= 1 && n <= 6 ? n : (chrome.view.active ?? 0) + 1;
  } catch {
    (app as any).__faceRobotStage = (chrome.view.active ?? 0) + 1;
  }
}

function renderStageShell(app: App, host: HTMLElement, stage: StageDef) {
  const wrap = el('div', 'fr-stage-shell');
  wrap.dataset.siFrStage = String(stage.index);
  wrap.dataset.siViewType = stage.side_view_type;
  wrap.dataset.siFrStatus = stage.status;

  // Title netview shell — dump-attested titleframe Path (HTML body LOCK)
  const title = el('div', 'fr-stage-titlebar');
  const titleText = stage.title_attested ?? `Stage ${stage.index}`;
  title.append(
    el('span', 'fr-stage-title-text', titleText),
    el('span', 'fr-stage-title-url', stage.title_url),
  );
  if (stage.title_html_url) {
    title.appendChild(el('span', 'fr-stage-title-url', `title=${stage.title_html_url}`));
  }
  if (stage.path_status) title.dataset.siFrPathStatus = stage.path_status;
  wrap.appendChild(title);

  if (stage.index === 1 && stage.status === 'WIRED') {
    const body = el('div', 'fr-stage-body');
    faceRobotStage1View(app, body);
    // Stage 1 view already draws its own title; hide duplicate chrome title inside embedded view
    const innerTitle = body.querySelector('.fr-stage1-title') as HTMLElement | null;
    if (innerTitle) innerTitle.style.display = 'none';
    if (stage.sideframe_url) {
      body.appendChild(el('div', 'fr-stage-path', `sideframe=${stage.sideframe_url}`));
    }
    wrap.appendChild(body);
    host.appendChild(wrap);
    return;
  }

  const body = el('div', 'fr-stage-body fr-stage-lock');
  body.append(
    el('div', 'fr-stage-type', stage.side_view_type),
    el('div', 'fr-stage-frame', `frame=${stage.frame}`),
    el('div', 'fr-stage-lock-note', 'SHELL_ONLY — Path DUMP_READY (closer95). SideView / titleframe HTML body LOCK. No invent FR.dll.'),
  );
  if (stage.sideframe_url) body.appendChild(el('div', 'fr-stage-path', `sideframe=${stage.sideframe_url}`));
  if (stage.sideview_html_url) body.appendChild(el('div', 'fr-stage-path', `sideview=${stage.sideview_html_url}`));
  if (stage.sideview_xsivw) body.appendChild(el('div', 'fr-stage-path', `xsivw=${stage.sideview_xsivw}`));

  const nested = stage.nested;
  if (nested?.synoptic_tray?.frames?.length) {
    const tray = el('div', 'fr-nested-tray');
    tray.appendChild(el('div', 'fr-nested-label', 'Synoptic / netview tray (xsily + install Path)'));
    for (const f of nested.synoptic_tray.frames) {
      if (f.type === 'Synoptic View') {
        const slot = el('div', 'fr-nested-slot');
        faceRobotSynopticSlot(slot, {
          name: f.name,
          path: f.path ?? chrome.synoptic?.stage_paths?.[f.name],
          note: 'Synoptic Path DUMP_READY (closer95/modules-gdi). HTML / FR.dll body LOCK.',
        });
        tray.appendChild(slot);
      } else {
        const row = el('div', 'fr-nested-netview');
        row.append(
          el('span', '', `${f.name} · ${f.type}`),
          el('span', 'fr-nested-url', f.path ?? f.url_blank ?? ''),
        );
        tray.appendChild(row);
      }
    }
    body.appendChild(tray);
  }
  if (nested?.library) {
    const row = el('div', 'fr-nested-row', `${nested.library.name} · ${nested.library.type}`);
    if (nested.library.path) row.appendChild(el('span', 'fr-nested-url', nested.library.path));
    body.appendChild(row);
  }
  if (nested?.browser_tray?.frames) {
    const tray = el('div', 'fr-nested-tray');
    tray.appendChild(el('div', 'fr-nested-label', 'Browser tray (xsily + install Path)'));
    for (const f of nested.browser_tray.frames) {
      const row = el('div', 'fr-nested-row', `${f.name} · ${f.type}`);
      if (f.path) row.appendChild(el('span', 'fr-nested-url', f.path));
      tray.appendChild(row);
    }
    body.appendChild(tray);
  }
  if (nested?.mid) {
    const row = el('div', 'fr-nested-row', `${nested.mid.name} · ${nested.mid.type}`);
    if (nested.mid.path) row.appendChild(el('span', 'fr-nested-url', nested.mid.path));
    body.appendChild(row);
  }
  if (nested?.ppg) body.appendChild(el('div', 'fr-nested-row', `${nested.ppg.name} · ${nested.ppg.type}`));
  if (nested?.lower) {
    const row = el('div', 'fr-nested-row', `${nested.lower.name} · ${nested.lower.type}`);
    if (nested.lower.path) row.appendChild(el('span', 'fr-nested-url', nested.lower.path));
    body.appendChild(row);
  }

  wrap.appendChild(body);
  host.appendChild(wrap);
}

/** Softimage facerobot_controller — Face Robot Control Panel (stages 1–6). */
export function faceRobotControlPanelView(app: App, host: HTMLElement) {
  restoreStage(app);
  const root = el('div', 'fr-controller');
  host.appendChild(root);
  const def = chrome.view;
  if (def?.category) root.dataset.siCategory = def.category;
  if (def?.defaultsize) root.dataset.siDefaultsize = def.defaultsize.join(',');
  root.dataset.siFrController = 'facerobot_controller';
  root.dataset.siFrSizechild = (chrome.sizechild ?? []).join(',');

  const tabs = el('div', 'fr-stage-tabs');
  const body = el('div', 'fr-controller-body');
  let stage = faceRobotCurrentStage(app);

  const paint = () => {
    body.innerHTML = '';
    const st = chrome.stages.find(s => s.index === stage) ?? chrome.stages[0];
    if (st) renderStageShell(app, body, st);
    tabs.querySelectorAll('.fr-stage-tab').forEach(t => {
      t.classList.toggle('active', Number((t as HTMLElement).dataset.stage) === stage);
    });
    root.dataset.siFrStage = String(stage);
  };

  for (const s of chrome.stages) {
    const b = el('button', 'fr-stage-tab' + (s.index === stage ? ' active' : ''), `Stage ${s.index}`);
    (b as HTMLElement).dataset.stage = String(s.index);
    b.title = s.side_view_type;
    b.onclick = () => {
      stage = s.index;
      setFaceRobotStage(app, stage);
      paint();
      app.logMsg('info', `Face Robot Control Panel → Stage ${stage} (${s.side_view_type})`);
    };
    tabs.appendChild(b);
  }

  // Softimage switcher buttonside=bottom_inv — tabs under body
  root.append(body, tabs);
  paint();

  const onStage = (s: number) => {
    if (s === stage) return;
    stage = s;
    paint();
  };
  app.events.on('fr-stage', onStage);

  // Lip Sync tray (xsily optional=hidden) — structure stub only
  const lip = chrome.lipsync_tray;
  if (lip) {
    const lipEl = el('div', 'fr-lipsync-stub');
    lipEl.dataset.siFrStatus = lip.status;
    lipEl.appendChild(el('div', 'fr-lipsync-label', `${lip.displayname} (optional=hidden)`));
    for (const f of lip.frames ?? []) {
      lipEl.appendChild(el('div', 'fr-nested-row', `${f.displayname} · ${f.type}`));
    }
    root.appendChild(lipEl);
  }
}
