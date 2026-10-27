// Softimage-faithful pass / picture output for AfterImage.
// Dump-attested: OutputDir, Framebuffer.Filename/Format, Pass frame range (render-desktop / framebuffer enums).
// Product: still frames write real image bytes; sequences keep .mp4 default (no .mov); 2K/4K via renderOutput.
import * as THREE from 'three';
import type { App } from './commands';
import type { Pass, Framebuffer } from './scene';
import type { MeshData } from './geometry';
import { sphere as makeSphereMesh } from './geometry';
import {
  DEFAULT_RENDER_OUTPUT_FORMAT,
  acceptsRenderOutputFormat,
  extensionForFormat,
  isMovieOutputFormat,
} from './renderOutput';

/** Softimage default Camera world pose (viewManager / PROJECT_HISTORY). */
const SI_CAM_POS: [number, number, number] = [9.5, 7.3, 12.3];
const SI_CAM_FOV = 53.6;
/** Softimage Scene Colors background (viewport grey). */
const SI_BG = { r: 0x7f, g: 0x7f, b: 0x7f };

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
  /**
   * Softimage does not Save As on render (tour WR-MSLINK-01 #32770 PIC File was AfterImage bug).
   * Default false — Electron auto-writes Render_Pictures; optional true only for explicit Export.
   */
  download?: boolean;
  /** Open in-app still preview. Default true for stills. */
  openPreview?: boolean;
  /** Softimage silent disk write via Electron bridge. Default true when bridge present. */
  autoWriteDisk?: boolean;
  /** Cap sequence length (Softimage Render Manager parity). */
  maxFrames?: number;
}

/** Electron preload bridge (WR-MSLINK-01 Softimage Render_Pictures auto-write). */
export interface AfterimageBridge {
  getRenderPicturesRoot?: () => Promise<string>;
  writeRenderPicture?: (payload: {
    softimagePath: string;
    dataUrl: string;
  }) => Promise<{ ok: boolean; path?: string; bytes?: number; error?: string }>;
}

export function afterimageBridge(): AfterimageBridge | null {
  if (typeof window === 'undefined') return null;
  const b = (window as any).afterimage as AfterimageBridge | undefined;
  return b?.writeRenderPicture ? b : null;
}

/**
 * Softimage OutputDir write — silent; never opens the plate (Pick an app / ms-link).
 * Returns absolute disk paths written, or [] when bridge absent (browser / headless).
 */
export async function autoWriteSoftimagePictures(
  files: RenderedFile[],
): Promise<{ written: string[]; root: string | null }> {
  const bridge = afterimageBridge();
  if (!bridge?.writeRenderPicture) return { written: [], root: null };
  const root = (await bridge.getRenderPicturesRoot?.()) ?? null;
  const written: string[] = [];
  for (const f of files) {
    if (isMovieOutputFormat(f.format)) continue;
    if (!f.dataUrl?.startsWith('data:')) continue;
    try {
      const res = await bridge.writeRenderPicture({ softimagePath: f.path, dataUrl: f.dataUrl });
      if (res?.ok && res.path) written.push(res.path);
    } catch {
      /* keep Softimage virtual __siRenderPictures even if disk write fails */
    }
  }
  return { written, root };
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
  /** Softimage-faithful disk paths written under Render_Pictures (Electron). */
  diskPaths?: string[];
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
 * Per-frame picture plates always use still Format (pic default). Movie container (.mp4 product / avi dump)
 * is a separate Pass MovieCreate/MovieFileName path — never the plate extension.
 */
export function writeExtensionFor(format: string): string {
  const f = extensionForFormat(format);
  if (isMovieOutputFormat(f)) return 'pic'; // Softimage still plates stay .pic even when Pass MovieFormat is mp4/avi
  if (f === 'tif' || f === 'tiff') return 'tif';
  if (f === 'jpeg') return 'jpg';
  if (f === 'pic' || f === 'exr' || f === 'png' || f === 'jpg') return f;
  return 'pic'; // Softimage Framebuffer default
}

/** Softimage Pass MovieFileName → AfterImage movie leaf (.mp4 product; never .mov). */
export function resolveSoftimageMoviePath(
  outputDir: string,
  movieFileName: string,
  movieFormat: string,
  passName = 'Default_Pass',
  fbName = 'Main',
): string {
  const ext = extensionForFormat(movieFormat === 'mov' ? DEFAULT_RENDER_OUTPUT_FORMAT : movieFormat);
  const movieExt = isMovieOutputFormat(ext) ? ext : DEFAULT_RENDER_OUTPUT_FORMAT;
  const raw = String(movieFileName || '[Pass]_[Framebuffer]');
  const expanded = expandRenderTokens(raw, passName, fbName)
    .replace(/\.(png|mp4|avi|pic|exr|tif|tiff|jpg|jpeg|mov)$/i, '');
  const norm = expanded.replace(/\\/g, '/');
  const absolute = /^[a-zA-Z]:\//.test(norm) || norm.startsWith('//');
  if (absolute) return `${norm}.${movieExt}`;
  if (norm.includes('/')) return `${norm.replace(/^\//, '')}.${movieExt}`;
  const dir = expandRenderTokens(outputDir || '[Project Path]\\Render_Pictures', '', '').replace(/\/$/, '') || 'Render_Pictures';
  return `${dir}/${norm || `${passName}_${fbName}`}.${movieExt}`;
}

/**
 * Softimage Flipbook is a viewer subset — Softimage writes full plates to disk.
 * Cap Flipbook preview count AND downscale (see SEQUENCE_PREVIEW_MAX_EDGE).
 * Post-1.0.22 freeze: encoding FrameEnd=100 at 1920×1080 into data URLs ≈ 1.1 GB + 14s sync.
 */
export const FLIPBOOK_MAX_FRAMES = 16;
/** Max edge for sequence Flipbook thumbs (Softimage path plates stay Softimage-named). */
export const SEQUENCE_PREVIEW_MAX_EDGE = 480;

export function scaleToMaxEdge(width: number, height: number, maxEdge: number): { w: number; h: number } {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const m = Math.max(w, h);
  if (m <= maxEdge) return { w, h };
  const s = maxEdge / m;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Tiny valid PNG for Softimage path attestation beyond Flipbook subset (no heap bomb). */
export function softimagePathAttestationDataUrl(frame: number): string {
  const n = ((Math.floor(frame) % 200) + 40) & 255;
  const rgba = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = n;
    rgba[i + 1] = 60;
    rgba[i + 2] = 90;
    rgba[i + 3] = 255;
  }
  return pngBytesToDataUrl(encodePngRGBA(8, 8, rgba));
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

/**
 * Softimage still / per-frame plate Format — Framebuffer.Format (dump default pic).
 * Movie overrides (mp4/avi) never become plate Format; Softimage MovieCreate is separate.
 */
function stillFormatFor(_pass: Pass, fb: Framebuffer, override?: string | null): string {
  if (override && acceptsRenderOutputFormat(override) && override !== 'mov' && !isMovieOutputFormat(override)) {
    return override;
  }
  const fbFmt = String(fb.val('Format') ?? 'pic');
  return acceptsRenderOutputFormat(fbFmt) && !isMovieOutputFormat(fbFmt) ? fbFmt : 'pic';
}

/**
 * Whether Softimage Pass should also emit a movie container beside picture plates.
 * Dump: MovieCreate bool; AfterImage product MovieFormat default mp4 (no mov).
 * Render Manager formatOverride=mp4 on a range implies movie sidecar (product).
 */
function wantsMovieContainer(pass: Pass, override?: string | null): boolean {
  if (override && isMovieOutputFormat(override) && override !== 'mov') return true;
  return !!pass.val('MovieCreate');
}

function movieFormatFor(pass: Pass, override?: string | null): string {
  if (override && isMovieOutputFormat(override) && override !== 'mov') return override;
  const movieFmt = String(pass.val('MovieFormat') ?? DEFAULT_RENDER_OUTPUT_FORMAT);
  if (movieFmt === 'mov' || !isMovieOutputFormat(movieFmt)) return DEFAULT_RENDER_OUTPUT_FORMAT;
  return movieFmt;
}

/** Reuse one WebGLRenderer across sequence frames (new-per-frame was a main-thread hitch). */
let _captureGl: { r: THREE.WebGLRenderer; w: number; h: number } | null = null;

/**
 * Softimage Render Current Frame draws shaded geometry — not the last viewport's wireframe.
 * viewManager scissors toggle mesh/wire per-vp; capture must force Softimage shaded state.
 */
function prepareSoftimageShadedCapture(scene: THREE.Scene): () => void {
  const saved: { obj: THREE.Object3D; visible: boolean }[] = [];
  const remember = (obj: THREE.Object3D) => {
    if (!saved.some(s => s.obj === obj)) saved.push({ obj, visible: obj.visible });
  };
  scene.traverse((obj) => {
    const k = (obj as any)._kind as string | undefined;
    remember(obj);
    if (k === 'mesh') { obj.visible = true; return; }
    if (k === 'wire' || k === 'bbox' || k === 'marker' || k === 'aimline') { obj.visible = false; return; }
    if (k === 'light') { obj.visible = true; return; }
    if (obj.name === 'grid' || obj.type === 'GridHelper' || obj.type === 'AxesHelper') {
      obj.visible = false; return;
    }
    // Softimage still has no component/hover/gizmo chrome (viewManager renderOrder ≥ 9).
    if ((obj.renderOrder ?? 0) >= 9 && !k) obj.visible = false;
  });
  return () => { for (const s of saved) s.obj.visible = s.visible; };
}

/** Resolve Softimage Camera viewport for still capture (never rely on unset window.THREE). */
function resolveCaptureCamera(w: number, h: number): THREE.Camera {
  const g = globalThis as any;
  const cam =
    g.__activeCamera
    ?? g.__vm?.active?.()?.camera
    ?? g.__vm?.viewports?.()?.find?.((v: { name: string }) => v.name === 'Camera')?.camera;
  if (cam) {
    const c = cam.clone();
    if ((c as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (c as THREE.PerspectiveCamera).aspect = w / h;
      (c as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    c.updateMatrixWorld?.(true);
    return c;
  }
  const persp = new THREE.PerspectiveCamera(SI_CAM_FOV, w / h, 0.1, 5000);
  persp.position.set(...SI_CAM_POS);
  persp.up.set(0, 1, 0);
  persp.lookAt(0, 0, 0);
  persp.updateMatrixWorld(true);
  return persp;
}

/** Capture one frame to a PNG data URL via viewport WebGL, or software mesh fallback. */
export function captureFrameDataUrl(app: App, width: number, height: number, frame: number): string {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  try {
    const g = globalThis as any;
    // Module THREE — window.THREE was never set (1.0.27 always fell through to ambience bands = "static").
    if (!g.THREE) g.THREE = THREE;
    const three = g.__three;
    if (three?.scene && THREE.WebGLRenderer) {
      // Flush Softimage → Three sync so sphere / meshes are in the framebuffer before plate write.
      try { three.syncNow?.(); } catch { /* ignore */ }
      if (!_captureGl || _captureGl.w !== w || _captureGl.h !== h) {
        try { _captureGl?.r?.dispose?.(); } catch { /* ignore */ }
        const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
        r.setSize(w, h, false);
        r.setClearColor(SI_BG.r << 16 | SI_BG.g << 8 | SI_BG.b, 1);
        r.shadowMap.enabled = true;
        _captureGl = { r, w, h };
      }
      const r = _captureGl.r;
      const c = resolveCaptureCamera(w, h);
      const prev = app.anim.frame;
      app.anim.frame = frame;
      three.needs?.();
      // Softimage still = shaded mesh plate. Viewport scissors leave last ortho as wireframe —
      // force Softimage shaded visibility (mesh on, wire/gizmo/hover off) for the capture pass.
      const restore = prepareSoftimageShadedCapture(three.scene);
      try {
        r.render(three.scene, c);
        const url = r.domElement.toDataURL('image/png');
        app.anim.frame = prev;
        if (url?.startsWith('data:image')) return url;
      } finally {
        restore();
        app.anim.frame = prev;
      }
    }
  } catch {
    /* fall through to software */
  }
  return softwareFrameDataUrl(app, w, h, frame);
}

type SoftTri = {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  cx: number; cy: number; cz: number;
  nx: number; ny: number; nz: number;
  cr: number; cg: number; cb: number;
};

function collectSceneTris(app: App): SoftTri[] {
  const tris: SoftTri[] = [];
  for (const o of app.scene.allObjects()) {
    if (!o.visible) continue;
    const mesh = o.primitive?.mesh() as MeshData | null | undefined;
    if (!mesh?.positions || !mesh?.indices) continue;
    const M = o.globalMatrix();
    const sh = o.material?.surface;
    const col = (sh?.val('diffuse') as number[] | undefined)
      ?? (sh?.val('color') as number[] | undefined)
      ?? [0.72, 0.72, 0.72];
    const cr = Math.max(0, Math.min(1, Number(col[0]) || 0.72));
    const cg = Math.max(0, Math.min(1, Number(col[1]) || 0.72));
    const cb = Math.max(0, Math.min(1, Number(col[2]) || 0.72));
    const pos = mesh.positions;
    const idx = mesh.indices;
    const xform = (i: number) => {
      const v = new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(M);
      return v;
    };
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const A = xform(idx[t]), B = xform(idx[t + 1]), C = xform(idx[t + 2]);
      const e1 = B.clone().sub(A), e2 = C.clone().sub(A);
      const n = e1.cross(e2);
      const len = n.length() || 1;
      n.multiplyScalar(1 / len);
      tris.push({
        ax: A.x, ay: A.y, az: A.z,
        bx: B.x, by: B.y, bz: B.z,
        cx: C.x, cy: C.y, cz: C.z,
        nx: n.x, ny: n.y, nz: n.z,
        cr, cg, cb,
      });
    }
  }
  return tris;
}

/** Softimage default sphere when scene has no mesh geo yet. */
function softimageDefaultSphereTris(): SoftTri[] {
  const mesh = makeSphereMesh(1, 24, 16);
  const tris: SoftTri[] = [];
  const pos = mesh.positions;
  const idx = mesh.indices;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const Ax = pos[a], Ay = pos[a + 1], Az = pos[a + 2];
    const Bx = pos[b], By = pos[b + 1], Bz = pos[b + 2];
    const Cx = pos[c], Cy = pos[c + 1], Cz = pos[c + 2];
    const e1x = Bx - Ax, e1y = By - Ay, e1z = Bz - Az;
    const e2x = Cx - Ax, e2y = Cy - Ay, e2z = Cz - Az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    tris.push({
      ax: Ax, ay: Ay, az: Az, bx: Bx, by: By, bz: Bz, cx: Cx, cy: Cy, cz: Cz,
      nx, ny, nz, cr: 0.72, cg: 0.72, cb: 0.72,
    });
  }
  return tris;
}

/**
 * Softimage-like CPU still: grey backdrop + Lambert-shaded scene meshes (or default sphere).
 * Replaces pre-1.0.28 ambience-band "static" fallback that had no geo.
 */
export function softwareFrameDataUrl(app: App, width: number, height: number, frame: number): string {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const rgba = new Uint8Array(w * h * 4);
  const zbuf = new Float32Array(w * h);
  zbuf.fill(1e30);

  // Softimage Scene Colors background
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = SI_BG.r; rgba[i + 1] = SI_BG.g; rgba[i + 2] = SI_BG.b; rgba[i + 3] = 255;
  }

  // Softimage viewport grid (XZ plane) — faint lines for Softimage-like plate.
  drawSoftimageGrid(rgba, zbuf, w, h, frame);

  let tris = collectSceneTris(app);
  if (!tris.length) tris = softimageDefaultSphereTris();

  // Softimage Camera look-from DEFAULT_CAMERA_POS → origin; light from upper-right.
  const eye = new THREE.Vector3(...SI_CAM_POS);
  const target = new THREE.Vector3(0, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const forward = target.clone().sub(eye).normalize();
  const right = forward.clone().cross(up).normalize();
  const camUp = right.clone().cross(forward).normalize();
  const fov = SI_CAM_FOV * Math.PI / 180;
  const tanHalf = Math.tan(fov / 2);
  const aspect = w / h;
  const L = new THREE.Vector3(0.45, 0.85, 0.35).normalize(); // Softimage-ish key
  const amb = 0.28;

  const project = (x: number, y: number, z: number) => {
    const p = new THREE.Vector3(x, y, z).sub(eye);
    const px = p.dot(right), py = p.dot(camUp), pz = p.dot(forward);
    if (pz <= 0.05) return null;
    const sx = (px / (pz * tanHalf * aspect) + 1) * 0.5 * w;
    const sy = (1 - (py / (pz * tanHalf) + 1) * 0.5) * h;
    return { sx, sy, z: pz };
  };

  for (const t of tris) {
    const A = project(t.ax, t.ay, t.az);
    const B = project(t.bx, t.by, t.bz);
    const C = project(t.cx, t.cy, t.cz);
    if (!A || !B || !C) continue;
    // Backface (Softimage shaded): skip if facing away
    const ndot = t.nx * forward.x + t.ny * forward.y + t.nz * forward.z;
    if (ndot > 0.02) continue;
    const ndL = Math.max(0, t.nx * L.x + t.ny * L.y + t.nz * L.z);
    const shade = amb + (1 - amb) * ndL;
    const rr = Math.min(255, Math.round(t.cr * shade * 255));
    const gg = Math.min(255, Math.round(t.cg * shade * 255));
    const bb = Math.min(255, Math.round(t.cb * shade * 255));
    fillTri(rgba, zbuf, w, h, A, B, C, rr, gg, bb);
  }

  return pngBytesToDataUrl(encodePngRGBA(w, h, rgba));
}

function drawSoftimageGrid(
  rgba: Uint8Array, zbuf: Float32Array, w: number, h: number, _frame: number,
) {
  // Project Softimage grid lines on XZ (viewport GridHelper analogue) — subtle.
  const eye = new THREE.Vector3(...SI_CAM_POS);
  const target = new THREE.Vector3(0, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const forward = target.clone().sub(eye).normalize();
  const right = forward.clone().cross(up).normalize();
  const camUp = right.clone().cross(forward).normalize();
  const fov = SI_CAM_FOV * Math.PI / 180;
  const tanHalf = Math.tan(fov / 2);
  const aspect = w / h;
  const proj = (x: number, y: number, z: number) => {
    const p = new THREE.Vector3(x, y, z).sub(eye);
    const px = p.dot(right), py = p.dot(camUp), pz = p.dot(forward);
    if (pz <= 0.05) return null;
    return {
      sx: (px / (pz * tanHalf * aspect) + 1) * 0.5 * w,
      sy: (1 - (py / (pz * tanHalf) + 1) * 0.5) * h,
      z: pz,
    };
  };
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    const a = proj(x0, 0, z0), b = proj(x1, 0, z1);
    if (!a || !b) return;
    const steps = Math.max(2, Math.hypot(b.sx - a.sx, b.sy - a.sy) | 0);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (a.sx + (b.sx - a.sx) * t) | 0;
      const y = (a.sy + (b.sy - a.sy) * t) | 0;
      const z = a.z + (b.z - a.z) * t;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const p = y * w + x;
      if (z >= zbuf[p]) continue;
      zbuf[p] = z;
      const o = p * 4;
      rgba[o] = 0x5e; rgba[o + 1] = 0x5e; rgba[o + 2] = 0x5e;
    }
  };
  for (let i = -10; i <= 10; i++) {
    line(i, -10, i, 10);
    line(-10, i, 10, i);
  }
}

function fillTri(
  rgba: Uint8Array, zbuf: Float32Array, w: number, h: number,
  A: { sx: number; sy: number; z: number },
  B: { sx: number; sy: number; z: number },
  C: { sx: number; sy: number; z: number },
  rr: number, gg: number, bb: number,
) {
  const minX = Math.max(0, Math.floor(Math.min(A.sx, B.sx, C.sx)));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(A.sx, B.sx, C.sx)));
  const minY = Math.max(0, Math.floor(Math.min(A.sy, B.sy, C.sy)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(A.sy, B.sy, C.sy)));
  const area = (B.sx - A.sx) * (C.sy - A.sy) - (B.sy - A.sy) * (C.sx - A.sx);
  if (Math.abs(area) < 1e-8) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Barycentric: wA=area(PBC)/ABC, wB=area(PCA)/ABC, wC=area(PAB)/ABC
      const wC = ((B.sx - A.sx) * (y - A.sy) - (B.sy - A.sy) * (x - A.sx)) / area;
      const wA = ((C.sx - B.sx) * (y - B.sy) - (C.sy - B.sy) * (x - B.sx)) / area;
      const wB = 1 - wA - wC;
      if (wA < -0.001 || wB < -0.001 || wC < -0.001) continue;
      const z = wA * A.z + wB * B.z + wC * C.z;
      const p = y * w + x;
      if (z >= zbuf[p]) continue;
      zbuf[p] = z;
      const o = p * 4;
      rgba[o] = rr; rgba[o + 1] = gg; rgba[o + 2] = bb; rgba[o + 3] = 255;
    }
  }
}

/**
 * Softimage ResolvedFilename may end in .pic while payload is PNG.
 * Browser download must use a known image extension — opening .pic on Windows
 * triggers Store / ms-link "find an app" prompts (no Softimage PIC association).
 */
export function browserDownloadLeaf(softimagePath: string, dataUrl: string): string {
  const leaf = softimagePath.split(/[/\\]/).pop() || softimagePath;
  if (dataUrl.startsWith('data:image/png') && /\.pic$/i.test(leaf)) return leaf.replace(/\.pic$/i, '.png');
  if (dataUrl.startsWith('data:image/jpeg') && /\.pic$/i.test(leaf)) return leaf.replace(/\.pic$/i, '.jpg');
  if (/\.mov$/i.test(leaf)) return leaf.replace(/\.mov$/i, '.mp4');
  return leaf;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Softimage still preview — in-app via still-preview event (Flipbook viewer).
 * Never window.open / shell.openExternal (Electron about:blank → Windows ms-link).
 */
function previewStill(dataUrl: string, title: string, format: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('still-preview', {
    detail: { dataUrl, path: title, format },
  }));
}

function storePicture(path: string, file: RenderedFile) {
  const g = globalThis as any;
  if (!g.__siRenderPictures) g.__siRenderPictures = new Map();
  (g.__siRenderPictures as Map<string, RenderedFile>).set(path, file);
}

/**
 * Render Softimage Pass picture output (still or sequence).
 * Dump: per-frame plates → Render_Pictures/[Pass]_[Framebuffer].FRAME.pic (Format=pic).
 * MovieCreate / movie formatOverride → AfterImage .mp4 sidecar (product; no .mov) beside plates.
 * Still → Softimage auto-write Render_Pictures + in-app preview (no Save As / OpenWith).
 * Sequence → virtual + disk plates + capped Flipbook (avoid OOM).
 */
export function renderScenePasses(app: App, opts: SceneRenderOptions = {}): SceneRenderResult {
  const passList = resolvePasses(app, opts.passes);
  if (!passList.length) {
    const err = 'No render pass in scene';
    app.logMsg('error', err);
    const fail: SceneRenderResult = { ok: false, files: [], width: 0, height: 0, format: 'pic', passNames: [], mode: 'still', outputDir: '', error: err };
    (app as any).lastRender = fail;
    (globalThis as any).__siLastRender = fail;
    return fail;
  }

  const ro = app.scene.renderOptions;
  // Softimage dump: OutputDir=[Project Path]\Render_Pictures
  const outputDir = String(ro?.val('OutputDir') ?? '[Project Path]\\Render_Pictures');
  const padding = Number(ro?.val('FramePadding') ?? 1);
  const files: RenderedFile[] = [];
  const passNames: string[] = [];
  const maxFrames = Math.max(1, opts.maxFrames ?? 300);
  let width = Math.max(1, Math.floor(Number(opts.width ?? ro?.val('ImageWidth') ?? 1920)));
  let height = Math.max(1, Math.floor(Number(opts.height ?? ro?.val('ImageHeight') ?? 1080)));
  let format = 'pic';
  let mode: 'still' | 'sequence' = 'still';
  let moviePath: string | null = null;

  for (const pass of passList) {
    passNames.push(pass.name);
    // Softimage.XSIOM / sicoresdk: OnBeginRenderPass / OnEndRenderPass (string-attested OM events).
    app.events.emit('OnBeginRenderPass', { pass: pass.name });
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
    // Softimage plates always use Framebuffer Format (pic). Movie is Pass MovieCreate / product mp4 sidecar.
    const plateFormat = stillFormatFor(pass, fb, opts.formatOverride);
    const emitMovie = multi && wantsMovieContainer(pass, opts.formatOverride);
    const movieFmt = emitMovie ? movieFormatFor(pass, opts.formatOverride) : plateFormat;
    format = emitMovie ? movieFmt : plateFormat;
    if (format === 'mov') format = DEFAULT_RENDER_OUTPUT_FORMAT;

    // Softimage Framebuffer.Filename — absolute (still_frame dump) or token template.
    const filenameTpl = String(fb.val('Filename') ?? '[Pass]_[Framebuffer]');
    const prev = app.anim.frame;
    let count = 0;
    let lastResolved = '';
    const passPlates: RenderedFile[] = [];
    // Softimage: full plates on disk. AfterImage: still = full-res; sequence = Flipbook thumbs
    // + Softimage-path attestation for the rest (avoids sync main-thread OOM / UI freeze).
    const preview = multi ? scaleToMaxEdge(w, h, SEQUENCE_PREVIEW_MAX_EDGE) : { w, h };
    for (let f = f0; f <= f1; f += step) {
      if (count >= maxFrames) break;
      app.anim.frame = f;
      const dataUrl = !multi
        ? captureFrameDataUrl(app, w, h, f)
        : count < FLIPBOOK_MAX_FRAMES
          ? captureFrameDataUrl(app, preview.w, preview.h, f)
          : softimagePathAttestationDataUrl(f);
      const path = resolveSoftimageResolvedFilename(
        outputDir, filenameTpl, f, padding, plateFormat, pass.name, fb.name,
      );
      lastResolved = path;
      const file: RenderedFile = {
        path,
        frame: f,
        format: plateFormat,
        dataUrl,
        byteLength: dataUrlByteLength(dataUrl),
      };
      storePicture(path, file);
      files.push(file);
      passPlates.push(file);
      count++;
    }

    if (emitMovie && passPlates.length) {
      const movieTpl = String(pass.val('MovieFileName') ?? '[Pass]_[Framebuffer]');
      moviePath = resolveSoftimageMoviePath(outputDir, movieTpl, movieFmt, pass.name, fb.name);
      // AfterImage product .mp4 path — Softimage movie codec bytes not dump-attested; plates are Softimage .pic.
      // Store a Softimage-faithful path entry referencing plate sequence (no invent MPEG bitstream).
      const movieManifest = JSON.stringify({
        kind: 'afterimage-movie-sidecar/v1',
        format: movieFmt,
        path: moviePath,
        softimage: { MovieCreate: true, MovieFileName: movieTpl, MovieFormat: movieFmt },
        plates: passPlates.map(p => ({ path: p.path, frame: p.frame })),
      });
      const Buf = (globalThis as any).Buffer as { from(s: string): { toString(enc: string): string } } | undefined;
      const b64 = Buf
        ? Buf.from(movieManifest).toString('base64')
        : btoa(movieManifest);
      const movieFile: RenderedFile = {
        path: moviePath,
        frame: passPlates[0]!.frame,
        format: movieFmt,
        dataUrl: `data:application/json;base64,${b64}`,
        byteLength: movieManifest.length,
      };
      storePicture(moviePath, movieFile);
      files.push(movieFile);
      if (pass.get('MovieCreate')) app.setParam(pass.get('MovieCreate')!, true);
      if (pass.get('MovieFormat') && movieFmt !== 'mov') app.setParam(pass.get('MovieFormat')!, movieFmt);
    }

    // Softimage OM (true-95pct / #130): ResolvedFilename after write; Format stays Softimage still Format (pic) — never movie.
    if (lastResolved && fb.get('ResolvedFilename')) {
      app.setParam(fb.get('ResolvedFilename')!, lastResolved.replace(/\//g, '\\'));
    }
    if (fb.get('Format') && !isMovieOutputFormat(plateFormat)) {
      fb.set('Format', plateFormat || 'pic');
    }
    app.anim.frame = prev;
    app.events.emit('OnEndRenderPass', {
      pass: pass.name,
      frames: count,
      resolved: lastResolved,
      movie: moviePath,
    });
  }

  const pictureFiles = files.filter(f => !isMovieOutputFormat(f.format));
  const ok = pictureFiles.length > 0 && pictureFiles.every(f => f.byteLength > 32 && f.dataUrl.startsWith('data:image'));
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

  // Softimage: silent write to OutputDir\Render_Pictures — never Save As (#32770 PIC File) / never open .pic.
  const wantDisk = opts.autoWriteDisk !== false && !!afterimageBridge();
  const wantDownload = opts.download === true; // opt-in only (WR-MSLINK-01)
  if (ok && wantDisk) {
    // Fire-and-forget disk write; Softimage UI stays responsive. Result.diskPaths filled when settled.
    void autoWriteSoftimagePictures(pictureFiles).then(({ written, root }) => {
      result.diskPaths = written;
      (app as any).lastRender = result;
      (globalThis as any).__siLastRender = result;
      if (written.length) {
        app.logMsg('info', `Softimage Render_Pictures auto-write ${written.length} plate(s) → ${root ?? written[0]}`);
      }
    });
  }

  if (ok && mode === 'still' && pictureFiles[0]) {
    // Softimage path stays .pic; explicit Export may download as .png (never default — Save As was the bug).
    if (wantDownload) {
      const leaf = browserDownloadLeaf(pictureFiles[0].path, pictureFiles[0].dataUrl);
      downloadDataUrl(pictureFiles[0].dataUrl, leaf);
    }
    if (opts.openPreview !== false) previewStill(pictureFiles[0].dataUrl, pictureFiles[0].path, pictureFiles[0].format);
  } else if (ok && mode === 'sequence') {
    const name = (pictureFiles[0]?.path.split('/').pop() || 'pass').replace(/\.\d+\.[^.]+$/, '');
    // Softimage Flipbook viewer subset — thumbs only; never stringify full-res×N into document.write.
    const flip = pictureFiles.slice(0, FLIPBOOK_MAX_FRAMES).filter(f => f.dataUrl.startsWith('data:image'));
    if (typeof window !== 'undefined' && flip.length) {
      window.dispatchEvent(new CustomEvent('flipbook-frames', {
        detail: {
          frames: flip.map(f => f.dataUrl),
          name,
          format: moviePath ? format : (pictureFiles[0]?.format ?? 'pic'),
          totalFrames: pictureFiles.length,
          moviePath,
          previewMaxEdge: SEQUENCE_PREVIEW_MAX_EDGE,
        },
      }));
    }
    if (pictureFiles.length > FLIPBOOK_MAX_FRAMES) {
      app.logMsg('info', `Flipbook shows ${FLIPBOOK_MAX_FRAMES}/${pictureFiles.length} preview plates (≤${SEQUENCE_PREVIEW_MAX_EDGE}px); Softimage paths for full range in Render_Pictures (__siRenderPictures)`);
    }
    if (moviePath) app.logMsg('info', `Movie sidecar → ${moviePath} (.${format}; Softimage plates .pic)`);
  }

  if (ok) {
    const head = pictureFiles[0]?.path ?? files[0]?.path ?? '(none)';
    app.logMsg('info', `Rendered ${pictureFiles.length} plate(s) → ${head} (${width}x${height}, .${pictureFiles[0]?.format ?? format}${moviePath ? ` + ${moviePath}` : ''})`);
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
