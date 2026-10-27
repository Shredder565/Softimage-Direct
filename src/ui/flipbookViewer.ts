/**
 * In-app Softimage Flipbook / still preview (Softimage viewer subset).
 * Never uses window.open / shell.openExternal — Electron openExternal(about:blank)
 * on Windows surfaces Store / ms-link prompts for missing protocol handlers.
 */
import { openFloating } from './floating';
import { FLIPBOOK_MAX_FRAMES, browserDownloadLeaf } from '../core/sceneRender';

export interface FlipbookOpenDetail {
  frames: string[];
  name: string;
  format?: string;
  totalFrames?: number;
  moviePath?: string | null;
  previewMaxEdge?: number;
}

export interface StillPreviewDetail {
  dataUrl: string;
  /** Softimage ResolvedFilename / picture path (may end in .pic). */
  path: string;
  format: string;
}

export { browserDownloadLeaf };

function saveHref(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** Softimage Flipbook floating viewer — capped frame list, no JSON.stringify into document.write. */
export function openInAppFlipbook(detail: FlipbookOpenDetail) {
  const frames = (detail.frames || []).slice(0, FLIPBOOK_MAX_FRAMES).filter(u => typeof u === 'string' && u.startsWith('data:image'));
  if (!frames.length) return;
  const name = detail.name || 'Flipbook';
  const total = detail.totalFrames ?? frames.length;
  const win = openFloating(`Flipbook – ${name}`, (body) => {
    body.style.cssText = 'display:flex;flex-direction:column;background:#333;color:#ddd;font:12px Tahoma;min-height:0;height:100%';
    const bar = document.createElement('div');
    bar.style.cssText = 'padding:4px;display:flex;align-items:center;gap:6px;flex-shrink:0';
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = '▶';
    play.title = 'Play / Pause';
    const scrub = document.createElement('input');
    scrub.type = 'range';
    scrub.min = '0';
    scrub.max = String(Math.max(0, frames.length - 1));
    scrub.value = '0';
    scrub.style.width = '280px';
    const label = document.createElement('span');
    label.textContent = `1 / ${frames.length}` + (total > frames.length ? ` (of ${total})` : '');
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save frame';
    save.title = 'Download current preview frame as PNG';
    const hint = document.createElement('span');
    hint.style.cssText = 'color:#888;font-size:11px;margin-left:auto';
    hint.textContent = detail.moviePath
      ? `Movie sidecar → ${detail.moviePath}`
      : (detail.format ? `format ${detail.format}` : '');
    bar.append(play, scrub, label, save, hint);
    const img = document.createElement('img');
    img.alt = name;
    img.style.cssText = 'flex:1;min-height:0;object-fit:contain;background:#222;width:100%';
    body.append(bar, img);

    let i = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const show = (k: number) => {
      if (!frames.length) return;
      i = Math.max(0, Math.min(frames.length - 1, k));
      img.src = frames[i]!;
      scrub.value = String(i);
      label.textContent = `${i + 1} / ${frames.length}` + (total > frames.length ? ` (of ${total})` : '');
    };
    scrub.oninput = () => show(+scrub.value);
    play.onclick = () => {
      if (timer) { clearInterval(timer); timer = null; play.textContent = '▶'; return; }
      play.textContent = '❚❚';
      timer = setInterval(() => show((i + 1) % frames.length), 1000 / 24);
    };
    save.onclick = () => {
      const leaf = browserDownloadLeaf(`${name}_${String(i + 1).padStart(4, '0')}.pic`, frames[i]!);
      saveHref(frames[i]!, leaf.endsWith('.png') ? leaf : `${leaf}.png`);
    };
    show(0);
  }, { key: `flipbook:${name}`, w: 720, h: 560, x: 80, y: 48, cls: 'flipbook-float' });
  win.focus();
}

/** Softimage still plate preview — in-app, no popup / openExternal. */
export function openInAppStillPreview(detail: StillPreviewDetail) {
  if (!detail?.dataUrl?.startsWith('data:image')) return;
  const file = detail.path.split(/[/\\]/).pop() || detail.path;
  const downloadName = browserDownloadLeaf(detail.path, detail.dataUrl);
  const win = openFloating(file, (body) => {
    body.style.cssText = 'display:flex;flex-direction:column;background:#222;color:#ddd;font:12px Tahoma;min-height:0;height:100%;text-align:center';
    const bar = document.createElement('div');
    bar.style.cssText = 'padding:6px;flex-shrink:0';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = `Save ${downloadName}`;
    save.onclick = () => saveHref(detail.dataUrl, downloadName);
    const meta = document.createElement('span');
    meta.style.cssText = 'color:#888;margin-left:8px;font:11px Tahoma';
    meta.textContent = `Softimage path ${file} · output format ${detail.format} · preview PNG`;
    bar.append(save, meta);
    const img = document.createElement('img');
    img.src = detail.dataUrl;
    img.alt = file;
    img.style.cssText = 'flex:1;min-height:0;object-fit:contain;width:100%;background:#1a1a1a';
    body.append(bar, img);
  }, { key: `still:${detail.path}`, w: 640, h: 520, x: 100, y: 60, cls: 'still-preview-float' });
  win.focus();
}

/** Install once — Flipbook / still events open in-app viewers (never window.open). */
export function installFlipbookViewer() {
  const g = globalThis as any;
  if (g.__siFlipbookViewerInstalled) return;
  g.__siFlipbookViewerInstalled = true;
  window.addEventListener('flipbook-frames', (e: Event) => {
    const detail = (e as CustomEvent).detail as FlipbookOpenDetail;
    openInAppFlipbook(detail);
  });
  window.addEventListener('still-preview', (e: Event) => {
    const detail = (e as CustomEvent).detail as StillPreviewDetail;
    openInAppStillPreview(detail);
  });
}
