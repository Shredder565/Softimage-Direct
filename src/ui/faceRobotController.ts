// Softimage Face Robot Control Panel — facerobot.xsily facerobot_controller tray (stages 1–6 + synoptic slots).
// Dump/Desktop-attested structure only. Stage HTML / FR.dll / SideView bodies LOCK (except Stage 1 PNG chrome).
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

type StageDef = {
  index: number;
  frame: string;
  title_frame: string;
  title_url: string;
  blank_url: string;
  side_view_type: string;
  title_attested?: string;
  status: string;
  nested?: {
    synoptic_tray?: { frames: { name: string; type: string; url_blank?: string }[] };
    library?: { name: string; type: string };
    browser_tray?: { frames: { name: string; type: string }[] };
    mid?: { name: string; type: string };
    ppg?: { name: string; type: string };
    lower?: { name: string; type: string };
  };
};

type CtrlChrome = typeof ctrl & {
  view: { name: string; category: string; defaultsize: number[]; active: number };
  stages: StageDef[];
  sizechild: number[];
  synoptic: { act_panel: { path_default: string }; stage_frames: string[] };
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

  // Title netview shell — URL path only (no invent stage*_titleframe.html)
  const title = el('div', 'fr-stage-titlebar');
  const titleText = stage.title_attested ?? `Stage ${stage.index}`;
  title.append(
    el('span', 'fr-stage-title-text', titleText),
    el('span', 'fr-stage-title-url', stage.title_url),
  );
  wrap.appendChild(title);

  if (stage.index === 1 && stage.status === 'WIRED') {
    const body = el('div', 'fr-stage-body');
    faceRobotStage1View(app, body);
    // Stage 1 view already draws its own title; hide duplicate chrome title inside embedded view
    const innerTitle = body.querySelector('.fr-stage1-title') as HTMLElement | null;
    if (innerTitle) innerTitle.style.display = 'none';
    wrap.appendChild(body);
    host.appendChild(wrap);
    return;
  }

  const body = el('div', 'fr-stage-body fr-stage-lock');
  body.append(
    el('div', 'fr-stage-type', stage.side_view_type),
    el('div', 'fr-stage-frame', `frame=${stage.frame}`),
    el('div', 'fr-stage-lock-note', 'SHELL_ONLY — SideView / titleframe HTML LOCK until Desktop/GDI harvest. No invent FR.dll.'),
  );

  const nested = stage.nested;
  if (nested?.synoptic_tray?.frames?.length) {
    const tray = el('div', 'fr-nested-tray');
    tray.appendChild(el('div', 'fr-nested-label', 'Synoptic / netview tray (xsily)'));
    for (const f of nested.synoptic_tray.frames) {
      if (f.type === 'Synoptic View') {
        const slot = el('div', 'fr-nested-slot');
        faceRobotSynopticSlot(slot, { name: f.name });
        tray.appendChild(slot);
      } else {
        const row = el('div', 'fr-nested-netview');
        row.append(
          el('span', '', `${f.name} · ${f.type}`),
          el('span', 'fr-nested-url', f.url_blank ?? ''),
        );
        tray.appendChild(row);
      }
    }
    body.appendChild(tray);
  }
  if (nested?.library) {
    body.appendChild(el('div', 'fr-nested-row', `${nested.library.name} · ${nested.library.type}`));
  }
  if (nested?.browser_tray?.frames) {
    const tray = el('div', 'fr-nested-tray');
    tray.appendChild(el('div', 'fr-nested-label', 'Browser tray (xsily)'));
    for (const f of nested.browser_tray.frames) {
      tray.appendChild(el('div', 'fr-nested-row', `${f.name} · ${f.type}`));
    }
    body.appendChild(tray);
  }
  if (nested?.mid) body.appendChild(el('div', 'fr-nested-row', `${nested.mid.name} · ${nested.mid.type}`));
  if (nested?.ppg) body.appendChild(el('div', 'fr-nested-row', `${nested.ppg.name} · ${nested.ppg.type}`));
  if (nested?.lower) body.appendChild(el('div', 'fr-nested-row', `${nested.lower.name} · ${nested.lower.type}`));

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
