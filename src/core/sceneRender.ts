// Softimage-faithful pass / picture output for AfterImage.
// Dump-attested: OutputDir, Framebuffer.Filename/Format, Pass frame range (render-desktop / framebuffer enums).
// Product: still frames write real image bytes; sequences keep .mp4 default (no .mov); 2K/4K via renderOutput.
import type { App } from './commands';
import type { Pass, Framebuffer } from './scene';
import {
  DEFAULT_RENDER_OUTPUT_FORMAT,
  acceptsRenderOutputFormat,
  extensionForFormat,
  isMovieOutputFormat,
} from './renderOutput';

export interface RenderedFile {
  /**
   * Softimage resolved picture path (dump: Render_Pictures/Default_Pass_Main.1.pic).
   * Format=pic keeps .pic extension (desktop_tour_commands.json).
   */
  path: string;
  frame: number;
  format: string;
  /** Browser-displayable image (PNG data URL). Softimage .pic path may wrap these bytes until PIC codec dump lands. */
  dataUrl: string;
  byteLength: number;
}

export interface SceneRenderOptions {
  /** Softimage Passes arg: Passes.Current | Passes.List.* | pass name. */
  passes?: string | null;
  /** Softimage command args may be null (defaults) or numeric. */
  startFrame?: number | string | null;
  endFrame?: number | string | null;
  stepFrame?: number | string | null;
  /** Render only Application.anim.frame (RenderCurrentFrame). */
  currentFrameOnly?: boolean;
  /** Override Framebuffer/Movie format (Render Manager UI). */
  formatOverride?: string | null;
  width?: number | null;
  height?: number | null;
  /** Trigger browser download for still (single-file) results. Default true. */
  download?: boolean;
  /** Open preview window for stills. Default true when download. */
  openPreview?: boolean;
  /** Cap sequence length (Softimage Render Manager parity). */
  maxFrames?: number;
}

export interface SceneRenderResult {
  ok: boolean;
  files: RenderedFile[];
  width: number;
  height: number;
  format: string;
  passNames: string[];
  mode: 'still' | 'sequence';
  outputDir: string;
  error?: string;
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

/** CRC32 for PNG chunks. */
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new TextEncoder().encode(type);
  const len = u32be(data.length);
  const body = new Uint8Array(4 + data.length);
  body.set(t, 0);
  body.set(data, 4);
  const crc = u32be(crc32(body));
  const out = new Uint8Array(12 + data.length);
  out.set(len, 0);
  out.set(body, 4);
  out.set(crc, 8 + data.length);
  return out;
}

/** Uncompressed RGBA → PNG bytes (filter 0). Suitable for still smoke / no-WebGL fallback. */
export function encodePngRGBA(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const row = 1 + width * 4;
  const raw = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * row + 1);
  }
  // Store as zlib-wrapped deflate stored blocks (no compression) — valid PNG IDAT.
  const zlib = deflateStore(raw);
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const parts = [new Uint8Array(PNG_SIG), chunk('IHDR', ihdr), chunk('IDAT', zlib), chunk('IEND', new Uint8Array(0))];
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** zlib + stored deflate blocks (RFC 1950/1951). */
function deflateStore(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [];
  const max = 65535;
  for (let i = 0; i < data.length; i += max) {
    const slice = data.subarray(i, Math.min(i + max, data.length));
    const last = i + max >= data.length ? 1 : 0;
    const hdr = new Uint8Array(5);
    hdr[0] = last; // BFINAL + BTYPE=00
    hdr[1] = slice.length & 255;
    hdr[2] = (slice.length >>> 8) & 255;
    hdr[3] = (~slice.length) & 255;
    hdr[4] = ((~slice.length) >>> 8) & 255;
    const b = new Uint8Array(5 + slice.length);
    b.set(hdr, 0);
    b.set(slice, 5);
    blocks.push(b);
  }
  const adler = adler32(data);
  let n = 2 + 4;
  for (const b of blocks) n += b.length;
  const out = new Uint8Array(n);
  out[0] = 0x78; out[1] = 0x01; // zlib, no dict, fastest
  let o = 2;
  for (const b of blocks) { out.set(b, o); o += b.length; }
  out.set(u32be(adler), o);
  return out;
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function pngBytesToDataUrl(bytes: Uint8Array): string {
  const Buf = (globalThis as any).Buffer as { from(b: Uint8Array): { toString(enc: string): string } } | undefined;
  if (Buf) {
    return 'data:image/png;base64,' + Buf.from(bytes).toString('base64');
  }
  let s = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return 'data:image/png;base64,' + btoa(s);
}

export function dataUrlByteLength(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  return Math.floor(b64.length * 3 / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

/** Softimage OutputDir / Filename token expand (dump-attested templates). */
export function expandRenderTokens(template: string, passName: string, fbName: string): string {
  return String(template ?? '')
    .replace(/\[Project Path\]/gi, '')
    .replace(/\[Pass\]/gi, passName)
    .replace(/\[Framebuffer\]/gi, fbName)
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\//, ''); // Softimage relative under project: Render_Pictures/… (not /Render_Pictures)
}

export function padFrame(frame: number, padding: number): string {
  const p = Math.max(1, Math.floor(padding) || 1);
  return String(Math.floor(frame)).padStart(Math.max(p, String(Math.floor(frame)).length), '0');
}

/**
 * Softimage ResolvedFilename (true-95pct + desktop tour).
 * Pattern: `{Filename}.{frame}.{ext}` with Format=pic → `.pic`.
 * Absolute Filename (dump: …\still_frame) stays absolute → still_frame.1.pic.
 * Relative / token Filename joins OutputDir → Render_Pictures/Default_Pass_Main.1.pic.
 */
export function resolveSoftimageResolvedFilename(
  outputDir: string,
  filename: string,
  frame: number,
  padding: number,
  format: string,
  passName = 'Default_Pass',
  fbName = 'Main',
): string {
  const ext = writeExtensionFor(format);
  const frameStr = padFrame(frame, padding);
  const raw = String(filename || '[Pass]_[Framebuffer]');
  const expanded = expandRenderTokens(raw, passName, fbName)
    .replace(/\.(png|mp4|avi|pic|exr|tif|tiff|jpg|jpeg|mov)$/i, '');
  const norm = expanded.replace(/\\/g, '/');
  const absolute = /^[a-zA-Z]:\//.test(norm) || norm.startsWith('//');
  if (absolute) return `${norm}.${frameStr}.${ext}`;
  // Relative path that already includes directories (no OutputDir prefix doubling)
  if (norm.includes('/')) return `${norm.replace(/^\//, '')}.${frameStr}.${ext}`;
  const dir = expandRenderTokens(outputDir || '[Project Path]\\Render_Pictures', '', '').replace(/\/$/, '') || 'Render_Pictures';
  const base = norm || 'Pass_Main';
  return `${dir}/${base}.${frameStr}.${ext}`;
}

/** @deprecated alias — Softimage name is ResolvedFilename */
export function resolvePicturePath(
  outputDir: string,
  filename: string,
  frame: number,
  padding: number,
  format: string,
  passName = 'Default_Pass',
  fbName = 'Main',
): string {
  return resolveSoftimageResolvedFilename(outputDir, filename, frame, padding, format, passName, fbName);
}

/**
 * Softimage Framebuffer Format → file extension (dump-attested pic).
 * Movie sequence formats (mp4/avi) still emit per-frame .png plates for Flipbook; container .mp4 stays the Pass MovieFormat default.
 */
export function writeExtensionFor(format: string): string {
  const f = extensionForFormat(format);
  if (isMovieOutputFormat(f)) return 'png';
  if (f === 'tif' || f === 'tiff') return 'tif';
  if (f === 'jpeg') return 'jpg';
  if (f === 'pic' || f === 'exr' || f === 'png' || f === 'jpg') return f;
  return 'pic'; // Softimage Framebuffer default
}

export function resolvePasses(app: App, passesArg: string | null | undefined): Pass[] {
  const all = app.scene.passes;
  const key = String(passesArg ?? 'Passes.Current');
  if (!all.length) return [];
  if (/Passes\.List\.\*/i.test(key) || /^all$/i.test(key)) return [...all];
  if (/Passes\.Current/i.test(key) || !key) return [all[all.length - 1] ?? all[0]];
  const named = all.filter(p => p.name === key || key.split(',').map(s => s.trim()).includes(p.name));
  return named.length ? named : [all[all.length - 1] ?? all[0]];
}

function mainFramebuffer(pass: Pass): Framebuffer {
  return pass.framebuffers.find(f => f.name === 'Main') ?? pass.framebuffers[0] ?? pass.addFramebuffer('Main');
}

function stillFormatFor(pass: Pass, fb: Framebuffer, override?: string | null): string {
  if (override && acceptsRenderOutputFormat(override) && override !== 'mov') {
    // Sequence UI may pass mp4 — for a still write use Framebuffer Format (Softimage picture).
    if (isMovieOutputFormat(override)) {
      const fbFmt = String(fb.val('Format') ?? 'pic');
      return acceptsRenderOutputFormat(fbFmt) ? fbFmt : 'png';
    }
    return override;
  }
  const movieCreate = !!pass.val('MovieCreate');
  const movieFmt = String(pass.val('MovieFormat') ?? DEFAULT_RENDER_OUTPUT_FORMAT);
  if (movieCreate && isMovieOutputFormat(movieFmt)) return movieFmt;
  const fbFmt = String(fb.val('Format') ?? 'pic');
  return acceptsRenderOutputFormat(fbFmt) ? fbFmt : 'pic';
}

function sequenceFormatFor(pass: Pass, override?: string | null): string {
  if (override && acceptsRenderOutputFormat(override) && override !== 'mov') return override;
  const movieFmt = String(pass.val('MovieFormat') ?? DEFAULT_RENDER_OUTPUT_FORMAT);
  if (isMovieOutputFormat(movieFmt) || acceptsRenderOutputFormat(movieFmt)) return movieFmt === 'mov' ? DEFAULT_RENDER_OUTPUT_FORMAT : movieFmt;
  return DEFAULT_RENDER_OUTPUT_FORMAT;
}

/** Capture one frame to a PNG/JPEG data URL via viewport WebGL, or software fallback. */
export function captureFrameDataUrl(app: App, width: number, height: number, frame: number): string {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  try {
    const g = globalThis as any;
    const THREE = g.THREE;
    const three = g.__three;
    const cam = g.__activeCamera;
    if (three?.scene && cam && THREE?.WebGLRenderer) {
      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      r.setSize(w, h);
      r.shadowMap.enabled = true;
      const c = cam.clone();
      if (c.aspect !== undefined) { c.aspect = w / h; c.updateProjectionMatrix?.(); }
      const prev = app.anim.frame;
      app.anim.frame = frame;
      three.needs?.();
      r.render(three.scene, c);
      const url = r.domElement.toDataURL('image/png');
      app.anim.frame = prev;
      r.dispose();
      if (url?.startsWith('data:image')) return url;
    }
  } catch {
    /* fall through to software */
  }
  return softwareFrameDataUrl(app, w, h, frame);
}

/** Deterministic still when no viewport — proves image write without inventing Softimage OM. */
export function softwareFrameDataUrl(app: App, width: number, height: number, frame: number): string {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const rgba = new Uint8Array(w * h * 4);
  const amb = (app.scene.root.property('ambience')?.val('ambience') as number[] | undefined) ?? [0.2, 0.2, 0.2];
  const r0 = Math.round(Math.max(0, Math.min(1, Number(amb[0]) || 0.2)) * 200) + 20;
  const g0 = Math.round(Math.max(0, Math.min(1, Number(amb[1]) || 0.2)) * 200) + 20;
  const b0 = Math.round(Math.max(0, Math.min(1, Number(amb[2]) || 0.2)) * 200) + 40;
  const objs = [...app.scene.allObjects()].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const band = ((x + frame * 3 + objs) % 64) < 8 ? 40 : 0;
      rgba[i] = Math.min(255, r0 + band);
      rgba[i + 1] = Math.min(255, g0 + (y < h / 2 ? 10 : 0));
      rgba[i + 2] = Math.min(255, b0 + ((x / w) * 30) | 0);
      rgba[i + 3] = 255;
    }
  }
  return pngBytesToDataUrl(encodePngRGBA(w, h, rgba));
}

function downloadDataUrl(dataUrl: string, filename: string) {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function previewStill(dataUrl: string, title: string, format: string) {
  if (typeof window === 'undefined' || !window.open) return;
  const w = window.open('', '_blank');
  if (!w) return;
  const file = title.split('/').pop() || title;
  w.document.write(
    `<title>${file}</title><body style="margin:0;background:#222;text-align:center">` +
    `<a download="${file}" href="${dataUrl}" style="color:#ddd;font:12px Tahoma">save ${file}</a> ` +
    `<span style="color:#888;font:11px Tahoma">output format ${format}</span><br>` +
    `<img src="${dataUrl}"></body>`,
  );
  w.document.close();
}

function storePicture(path: string, file: RenderedFile) {
  const g = globalThis as any;
  if (!g.__siRenderPictures) g.__siRenderPictures = new Map();
  (g.__siRenderPictures as Map<string, RenderedFile>).set(path, file);
}

/**
 * Render Softimage Pass picture output (still or sequence).
 * Still → real image write (download + virtual Render_Pictures). Sequence → frames + Flipbook; format default mp4.
 */
export function renderScenePasses(app: App, opts: SceneRenderOptions = {}): SceneRenderResult {
  const passList = resolvePasses(app, opts.passes);
  if (!passList.length) {
    const err = 'No render pass in scene';
    app.logMsg('error', err);
    const fail: SceneRenderResult = { ok: false, files: [], width: 0, height: 0, format: 'png', passNames: [], mode: 'still', outputDir: '', error: err };
    (app as any).lastRender = fail;
    (globalThis as any).__siLastRender = fail;
    return fail;
  }

  const ro = app.scene.renderOptions;
  const outputDir = String(ro?.val('OutputDir') ?? '[Project Path]/Render_Pictures');
  const padding = Number(ro?.val('FramePadding') ?? 1);
  const files: RenderedFile[] = [];
  const passNames: string[] = [];
  const maxFrames = Math.max(1, opts.maxFrames ?? 300);
  let width = Math.max(1, Math.floor(Number(opts.width ?? ro?.val('ImageWidth') ?? 1920)));
  let height = Math.max(1, Math.floor(Number(opts.height ?? ro?.val('ImageHeight') ?? 1080)));
  let format = 'png';
  let mode: 'still' | 'sequence' = 'still';

  for (const pass of passList) {
    passNames.push(pass.name);
    const fb = mainFramebuffer(pass);
    const w = Math.max(1, Math.floor(Number(opts.width ?? pass.val('ImageWidth') ?? width)));
    const h = Math.max(1, Math.floor(Number(opts.height ?? pass.val('ImageHeight') ?? height)));
    width = w; height = h;

    let f0: number;
    let f1: number;
    let step: number;
    if (opts.currentFrameOnly) {
      f0 = f1 = app.anim.frame;
      step = 1;
    } else {
      // Softimage: null Start/End/Step → Pass FrameStart/FrameEnd/FrameStep (dump defaults 1–100 / 1).
      const hasStart = opts.startFrame != null && opts.startFrame !== '';
      const hasEnd = opts.endFrame != null && opts.endFrame !== '';
      f0 = hasStart ? Number(opts.startFrame) : Number(pass.val('FrameStart') ?? 1);
      f1 = hasEnd ? Number(opts.endFrame) : Number(pass.val('FrameEnd') ?? f0);
      step = Math.max(1, Number(
        opts.stepFrame != null && opts.stepFrame !== '' ? opts.stepFrame : (pass.val('FrameStep') ?? 1),
      ));
    }
    if (!Number.isFinite(f0)) f0 = app.anim.frame;
    if (!Number.isFinite(f1)) f1 = f0;
    if (f1 < f0) [f0, f1] = [f1, f0];

    const multi = f0 !== f1;
    mode = multi ? 'sequence' : 'still';
    format = multi ? sequenceFormatFor(pass, opts.formatOverride) : stillFormatFor(pass, fb, opts.formatOverride);
    if (format === 'mov') format = DEFAULT_RENDER_OUTPUT_FORMAT;

    // Softimage Framebuffer.Filename — absolute (still_frame dump) or token template.
    const filenameTpl = String(fb.val('Filename') ?? '[Pass]_[Framebuffer]');
    const prev = app.anim.frame;
    let count = 0;
    let lastResolved = '';
    for (let f = f0; f <= f1; f += step) {
      if (count >= maxFrames) break;
      app.anim.frame = f;
      const dataUrl = captureFrameDataUrl(app, w, h, f);
      const path = resolveSoftimageResolvedFilename(
        outputDir, filenameTpl, f, padding, format, pass.name, fb.name,
      );
      lastResolved = path;
      const file: RenderedFile = {
        path,
        frame: f,
        format,
        dataUrl,
        byteLength: dataUrlByteLength(dataUrl),
      };
      storePicture(path, file);
      files.push(file);
      count++;
    }
    // Softimage OM: Framebuffer.ResolvedFilename (RenderFramebuffer.spdl / true-95pct)
    if (lastResolved && fb.get('ResolvedFilename')) {
      app.setParam(fb.get('ResolvedFilename')!, lastResolved);
    }
    app.anim.frame = prev;
  }

  const ok = files.length > 0 && files.every(f => f.byteLength > 32 && f.dataUrl.startsWith('data:image'));
  const result: SceneRenderResult = {
    ok,
    files,
    width,
    height,
    format,
    passNames,
    mode,
    outputDir: expandRenderTokens(outputDir, '', ''),
    error: ok ? undefined : 'Image write failed',
  };
  (app as any).lastRender = result;
  (globalThis as any).__siLastRender = result;

  if (ok && mode === 'still' && files[0]) {
    const leaf = files[0].path.split('/').pop() || files[0].path;
    if (opts.download !== false) downloadDataUrl(files[0].dataUrl, leaf);
    if (opts.openPreview !== false) previewStill(files[0].dataUrl, files[0].path, format);
  } else if (ok && mode === 'sequence') {
    const name = (files[0]?.path.split('/').pop() || 'pass').replace(/\.\d+\.[^.]+$/, '');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flipbook-frames', {
        detail: { frames: files.map(f => f.dataUrl), name, format },
      }));
    }
  }

  if (ok) {
    app.logMsg('info', `Rendered ${files.length} frame(s) → ${files[0]?.path ?? '(none)'} (${width}x${height}, .${format})`);
  } else {
    app.logMsg('error', result.error || 'Render failed');
  }
  return result;
}

/** Softimage RenderPass / RenderPasses entry — args match dump arity. */
export function executeRenderPass(app: App, args: Record<string, any> = {}): SceneRenderResult {
  return renderScenePasses(app, {
    passes: args.Passes ?? 'Passes.Current',
    startFrame: args.StartFrame ?? null,
    endFrame: args.EndFrame ?? null,
    stepFrame: args.StepFrame ?? null,
    currentFrameOnly: false,
  });
}

export function executeRenderCurrentFrame(app: App, allPasses = false): SceneRenderResult {
  return renderScenePasses(app, {
    passes: allPasses ? 'Passes.List.*' : 'Passes.Current',
    currentFrameOnly: true,
  });
}
