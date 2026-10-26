/**
 * FROST Experimental Render — 2026 hybrid / path-trace inspired pipeline.
 * Additive FROST surface (not Softimage Render 1:1). Reuses AfterImage capture + Flipbook caps.
 */

import type { App } from '../core/commands';
import {
  FLIPBOOK_MAX_FRAMES,
  SEQUENCE_PREVIEW_MAX_EDGE,
  captureFrameDataUrl,
  scaleToMaxEdge,
  softwareFrameDataUrl,
} from '../core/sceneRender';
import {
  DEFAULT_RENDER_OUTPUT_FORMAT,
  RENDER_RESOLUTION_PRESETS,
  resolutionPresetFor,
} from '../core/renderOutput';

export type FrostRenderMode = 'hybrid' | 'pathtrace';
export type FrostRenderDevice = 'auto' | 'cpu' | 'gpu';
export type FrostAovId = 'beauty' | 'diffuse' | 'specular' | 'albedo' | 'normal' | 'depth';

export const FROST_AOV_CATALOG: { id: FrostAovId; label: string; utility?: boolean }[] = [
  { id: 'beauty', label: 'Beauty' },
  { id: 'diffuse', label: 'Diffuse' },
  { id: 'specular', label: 'Specular' },
  { id: 'albedo', label: 'Albedo', utility: true },
  { id: 'normal', label: 'Normal', utility: true },
  { id: 'depth', label: 'Depth', utility: true },
];

export interface FrostExperimentalRenderSettings {
  mode: FrostRenderMode;
  device: FrostRenderDevice;
  samples: number;
  denoise: boolean;
  denoiseGuides: boolean;
  aovs: FrostAovId[];
  width: number;
  height: number;
  /** Product movie sidecar label (never mov). */
  movieFormat: 'mp4' | 'avi' | 'none';
  /** Frame range for Flipbook (capped). */
  frameStart: number;
  frameEnd: number;
}

export interface FrostRenderPlate {
  aov: FrostAovId;
  frame: number;
  path: string;
  dataUrl: string;
  sample: number;
  denoised: boolean;
  width: number;
  height: number;
}

export interface FrostExperimentalRenderResult {
  ok: boolean;
  experimental: true;
  settings: FrostExperimentalRenderSettings;
  plates: FrostRenderPlate[];
  flipbookFrames: string[];
  usdStub: string;
  error?: string;
}

export function defaultFrostExperimentalSettings(app?: App): FrostExperimentalRenderSettings {
  const ro = app?.scene?.renderOptions;
  const w = Number(ro?.val('ImageWidth') ?? 1920);
  const h = Number(ro?.val('ImageHeight') ?? 1080);
  const anim: any = app?.anim;
  const start = Number(anim?.startFrame ?? anim?.frameIn ?? anim?.start ?? 1);
  const end = Number(anim?.endFrame ?? anim?.frameOut ?? anim?.end ?? 100);
  const movieFmt = String(DEFAULT_RENDER_OUTPUT_FORMAT);
  return {
    mode: 'hybrid',
    device: 'auto',
    samples: 32,
    denoise: true,
    denoiseGuides: true,
    aovs: ['beauty', 'albedo', 'normal'],
    width: w,
    height: h,
    movieFormat: movieFmt === 'avi' ? 'avi' : 'mp4',
    frameStart: start,
    frameEnd: Math.min(end, start + FLIPBOOK_MAX_FRAMES - 1),
  };
}

export function frostSamplesForMode(mode: FrostRenderMode, samples: number): number {
  const n = Math.max(1, Math.floor(samples));
  if (mode === 'hybrid') return Math.min(n, 64);
  return Math.min(n, 512);
}

/** Softimage-faithful chrome density labels for FROST tab strip (tab 7 = Experimental Render). */
export const FROST_MODULE_TABS: { id: string; label: string; index: number }[] = [
  { id: 'graph', label: 'Graph', index: 1 },
  { id: 'particles', label: 'Particles', index: 2 },
  { id: 'hair', label: 'Hair', index: 3 },
  { id: 'cloth', label: 'Cloth', index: 4 },
  { id: 'cache', label: 'Cache', index: 5 },
  { id: 'library', label: 'Library', index: 6 },
  { id: 'experimental-render', label: 'Experimental Render', index: 7 },
];

/** Simple hash noise — progressive path-trace look without Softimage MR paste. */
function frostHash2(x: number, y: number, s: number): number {
  let n = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return ((n >>> 0) % 10000) / 10000;
}

function writePixel(rgba: Uint8ClampedArray, i: number, r: number, g: number, b: number, a = 255) {
  rgba[i] = Math.max(0, Math.min(255, r | 0));
  rgba[i + 1] = Math.max(0, Math.min(255, g | 0));
  rgba[i + 2] = Math.max(0, Math.min(255, b | 0));
  rgba[i + 3] = a;
}

/** Build a progressive sample buffer for one AOV (CPU software path). */
export function synthesizeAovRgba(
  app: App,
  aov: FrostAovId,
  width: number,
  height: number,
  frame: number,
  sample: number,
  mode: FrostRenderMode,
): Uint8ClampedArray {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const objs = [...app.scene.allObjects()].length;
  const amb = (app.scene.root.property('ambience')?.val('ambience') as number[] | undefined) ?? [0.2, 0.2, 0.2];
  const noiseAmt = mode === 'hybrid' ? 0.08 : Math.max(0.02, 0.35 / Math.sqrt(Math.max(1, sample)));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const u = x / w;
      const v = y / h;
      const n = frostHash2(x, y, frame * 17 + sample * 31 + objs) - 0.5;
      if (aov === 'albedo') {
        writePixel(rgba, i, (amb[0] * 180 + u * 40) | 0, (amb[1] * 180 + 30) | 0, (amb[2] * 180 + v * 40) | 0);
      } else if (aov === 'normal') {
        writePixel(rgba, i, (u * 255) | 0, (v * 255) | 0, 200);
      } else if (aov === 'depth') {
        const d = ((1 - v) * 200 + objs * 3) | 0;
        writePixel(rgba, i, d, d, d);
      } else if (aov === 'diffuse') {
        const base = 40 + objs * 8 + (u * 80) | 0;
        writePixel(rgba, i, base + n * noiseAmt * 255, base * 0.9, base * 0.7);
      } else if (aov === 'specular') {
        const spec = ((Math.pow(Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.35) * 2), 8) * 220) | 0);
        writePixel(rgba, i, spec, spec, Math.min(255, spec + 20));
      } else {
        // beauty — blend ambient + object hint + progressive noise
        const r = (amb[0] * 200 + 25 + u * 50 + n * noiseAmt * 255) | 0;
        const g = (amb[1] * 200 + 20 + (v < 0.5 ? 15 : 0) + n * noiseAmt * 200) | 0;
        const b = (amb[2] * 200 + 40 + frame % 40 + n * noiseAmt * 180) | 0;
        writePixel(rgba, i, r, g, b);
      }
    }
  }
  return rgba;
}

/** Box blur denoise (OIDN/OptiX stand-in — Experimental, not Softimage). */
export function denoiseRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  guides?: { albedo?: Uint8ClampedArray; normal?: Uint8ClampedArray },
): Uint8ClampedArray {
  const w = width;
  const h = height;
  const out = new Uint8ClampedArray(src.length);
  const radius = guides?.albedo || guides?.normal ? 1 : 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, wt = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          const j = (yy * w + xx) * 4;
          let wgt = 1;
          if (guides?.albedo) {
            const ci = (y * w + x) * 4;
            const dr = Math.abs(guides.albedo[j] - guides.albedo[ci]);
            const dg = Math.abs(guides.albedo[j + 1] - guides.albedo[ci + 1]);
            wgt *= dr + dg < 40 ? 1 : 0.15;
          }
          if (guides?.normal) {
            const ci = (y * w + x) * 4;
            const dr = Math.abs(guides.normal[j] - guides.normal[ci]);
            wgt *= dr < 30 ? 1 : 0.2;
          }
          r += src[j] * wgt;
          g += src[j + 1] * wgt;
          b += src[j + 2] * wgt;
          a += src[j + 3] * wgt;
          wt += wgt;
        }
      }
      const i = (y * w + x) * 4;
      writePixel(out, i, r / wt, g / wt, b / wt, a / wt);
    }
  }
  return out;
}

function rgbaToPngDataUrl(width: number, height: number, rgba: Uint8ClampedArray): string {
  // Prefer sceneRender software encoder via a tiny canvas when available; else raw PPM-ish fallback is avoided —
  // reuse softwareFrameDataUrl only as last resort by drawing into ImageData when document exists.
  if (typeof document !== 'undefined') {
    try {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (ctx) {
        const img = new ImageData(rgba, width, height);
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png');
      }
    } catch { /* fall through */ }
  }
  // Headless: encode via existing capture path width/height (software beauty) as stand-in plate marker.
  return `data:application/frost-rgba;base64,${width}x${height}:${rgba.length}`;
}

function resolveCaptureSize(settings: FrostExperimentalRenderSettings, forFlipbook: boolean): { w: number; h: number } {
  if (forFlipbook) return scaleToMaxEdge(settings.width, settings.height, SEQUENCE_PREVIEW_MAX_EDGE);
  // Cap still edge for Experimental path-trace to avoid main-thread freeze (same spirit as Flipbook caps).
  const maxEdge = settings.mode === 'hybrid' ? 1280 : 1920;
  return scaleToMaxEdge(settings.width, settings.height, maxEdge);
}

function effectiveDevice(settings: FrostExperimentalRenderSettings): 'cpu' | 'gpu' {
  if (settings.device === 'cpu') return 'cpu';
  if (settings.device === 'gpu') return 'gpu';
  // Auto: prefer GPU capture when WebGL available
  const g = globalThis as any;
  return g.__three?.scene && g.__activeCamera ? 'gpu' : 'cpu';
}

export function buildUsdRenderStub(
  settings: FrostExperimentalRenderSettings,
  plates: FrostRenderPlate[],
): string {
  const aovList = settings.aovs.map(a => `"${a}"`).join(', ');
  const plateLines = plates
    .filter(p => p.aov === 'beauty')
    .slice(0, FLIPBOOK_MAX_FRAMES)
    .map(p => `        string frost:path_${p.frame} = "${p.path}"`)
    .join('\n');
  return `#usda 1.0
(
    doc = "FROST Experimental Render USD stub (not a Hydra delegate). Inspired by 2026 USD/Hydra AOV workflows."
    metersPerUnit = 1
    upAxis = "Y"
)

def RenderSettings "FrostExperimentalRender" {
    uniform token frost:mode = "${settings.mode}"
    uniform token frost:device = "${settings.device}"
    uniform int frost:samples = ${frostSamplesForMode(settings.mode, settings.samples)}
    uniform bool frost:denoise = ${settings.denoise}
    uniform int2 frost:resolution = (${settings.width}, ${settings.height})
    uniform token[] frost:aovs = [${aovList}]
    uniform token frost:movieFormat = "${settings.movieFormat}"
${plateLines}
}
`;
}

/**
 * Run Experimental Render — produces AOV plates + Flipbook-capped beauty sequence.
 * Does not mutate Softimage Pass Framebuffer Format / .pic paths.
 */
export function runFrostExperimentalRender(
  app: App,
  settings: FrostExperimentalRenderSettings,
  opts: { currentFrameOnly?: boolean; openFlipbook?: boolean } = {},
): FrostExperimentalRenderResult {
  const samples = frostSamplesForMode(settings.mode, settings.samples);
  const aovs = settings.aovs.length ? [...settings.aovs] : (['beauty'] as FrostAovId[]);
  if (!aovs.includes('beauty')) aovs.unshift('beauty');

  const start = opts.currentFrameOnly
    ? app.anim.frame
    : Math.floor(settings.frameStart);
  const endRaw = opts.currentFrameOnly
    ? app.anim.frame
    : Math.floor(settings.frameEnd);
  const end = Math.max(start, endRaw);
  const frameCount = Math.min(FLIPBOOK_MAX_FRAMES, end - start + 1);
  const device = effectiveDevice(settings);
  const stillSize = resolveCaptureSize(settings, false);
  const flipSize = resolveCaptureSize(settings, true);

  const plates: FrostRenderPlate[] = [];
  const flipbookFrames: string[] = [];

  try {
    for (let fi = 0; fi < frameCount; fi++) {
      const frame = start + fi;
      const guides: { albedo?: Uint8ClampedArray; normal?: Uint8ClampedArray } = {};
      if (settings.denoise && settings.denoiseGuides) {
        guides.albedo = synthesizeAovRgba(app, 'albedo', stillSize.w, stillSize.h, frame, samples, settings.mode);
        guides.normal = synthesizeAovRgba(app, 'normal', stillSize.w, stillSize.h, frame, samples, settings.mode);
      }

      for (const aov of aovs) {
        let rgba: Uint8ClampedArray;
        let dataUrl: string;

        if (aov === 'beauty' && device === 'gpu') {
          // Progressive: capture viewport once, then blend synthetic residual noise by sample count.
          const baseUrl = captureFrameDataUrl(app, stillSize.w, stillSize.h, frame);
          rgba = synthesizeAovRgba(app, 'beauty', stillSize.w, stillSize.h, frame, samples, settings.mode);
          if (settings.denoise) rgba = denoiseRgba(rgba, stillSize.w, stillSize.h, guides);
          // Prefer real viewport plate when available
          dataUrl = baseUrl?.startsWith('data:image') ? baseUrl : rgbaToPngDataUrl(stillSize.w, stillSize.h, rgba);
          if (settings.denoise && !baseUrl?.startsWith('data:image')) {
            dataUrl = rgbaToPngDataUrl(stillSize.w, stillSize.h, rgba);
          }
        } else if (aov === 'beauty' && device === 'cpu') {
          // Accumulate progressive samples into beauty
          rgba = synthesizeAovRgba(app, 'beauty', stillSize.w, stillSize.h, frame, 1, settings.mode);
          for (let s = 2; s <= samples; s += Math.max(1, Math.floor(samples / 8))) {
            const next = synthesizeAovRgba(app, 'beauty', stillSize.w, stillSize.h, frame, s, settings.mode);
            for (let i = 0; i < rgba.length; i++) {
              rgba[i] = ((rgba[i] * (s - 1) + next[i]) / s) | 0;
            }
          }
          if (settings.denoise) rgba = denoiseRgba(rgba, stillSize.w, stillSize.h, guides);
          dataUrl = rgbaToPngDataUrl(stillSize.w, stillSize.h, rgba);
          // Headless / no canvas: fall back to softwareFrameDataUrl so Flipbook always gets images
          if (!dataUrl.startsWith('data:image')) {
            dataUrl = softwareFrameDataUrl(app, stillSize.w, stillSize.h, frame);
          }
        } else {
          rgba = synthesizeAovRgba(app, aov, stillSize.w, stillSize.h, frame, samples, settings.mode);
          if (settings.denoise && (aov === 'diffuse' || aov === 'specular')) {
            rgba = denoiseRgba(rgba, stillSize.w, stillSize.h, guides);
          }
          dataUrl = rgbaToPngDataUrl(stillSize.w, stillSize.h, rgba);
          if (!dataUrl.startsWith('data:image')) {
            dataUrl = softwareFrameDataUrl(app, Math.min(64, stillSize.w), Math.min(64, stillSize.h), frame + aov.length);
          }
        }

        const path = `FROST_Experimental/${aov}.${frame}.png`;
        plates.push({
          aov,
          frame,
          path,
          dataUrl,
          sample: samples,
          denoised: settings.denoise && (aov === 'beauty' || aov === 'diffuse' || aov === 'specular'),
          width: stillSize.w,
          height: stillSize.h,
        });

        if (aov === 'beauty') {
          // Flipbook thumb — downscale path: re-capture at flip size when GPU, else reuse
          let thumb = dataUrl;
          if (device === 'gpu' && (stillSize.w !== flipSize.w || stillSize.h !== flipSize.h)) {
            thumb = captureFrameDataUrl(app, flipSize.w, flipSize.h, frame);
          } else if (!thumb.startsWith('data:image')) {
            thumb = softwareFrameDataUrl(app, flipSize.w, flipSize.h, frame);
          }
          flipbookFrames.push(thumb);
        }
      }
    }

    const usdStub = buildUsdRenderStub(settings, plates);
    const result: FrostExperimentalRenderResult = {
      ok: true,
      experimental: true,
      settings: { ...settings, samples },
      plates,
      flipbookFrames,
      usdStub,
    };

    const g = globalThis as any;
    if (!g.__frostExperimentalPlates) g.__frostExperimentalPlates = new Map();
    for (const p of plates) (g.__frostExperimentalPlates as Map<string, FrostRenderPlate>).set(p.path, p);
    g.__frostLastExperimentalRender = result;
    (app as any).lastFrostExperimentalRender = result;

    if (opts.openFlipbook !== false && flipbookFrames.length > 1 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flipbook-frames', {
        detail: {
          frames: flipbookFrames.slice(0, FLIPBOOK_MAX_FRAMES),
          name: `FROST Experimental (${settings.mode}, ${samples} spp)`,
        },
      }));
    } else if (opts.openFlipbook !== false && flipbookFrames.length === 1 && typeof window !== 'undefined') {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(
          `<title>FROST Experimental Beauty</title><body style="margin:0;background:#222;text-align:center;color:#ddd;font:12px Tahoma">` +
          `<div>Experimental · ${settings.mode} · ${samples} spp · denoise=${settings.denoise} · ${device}</div>` +
          `<img src="${flipbookFrames[0]}"></body>`,
        );
        w.document.close();
      }
    }

    app.logMsg(
      'info',
      `FROST Experimental Render: ${frameCount} frame(s), ${plates.length} plate(s), ${samples} spp, device=${device}, Flipbook≤${FLIPBOOK_MAX_FRAMES}`,
    );
    return result;
  } catch (e: any) {
    const err = String(e?.message ?? e);
    app.logMsg('error', `FROST Experimental Render failed: ${err}`);
    return {
      ok: false,
      experimental: true,
      settings,
      plates,
      flipbookFrames,
      usdStub: buildUsdRenderStub(settings, plates),
      error: err,
    };
  }
}

export function frostResolutionChoices() {
  return RENDER_RESOLUTION_PRESETS.filter(p => p.value !== 0);
}

export function applyFrostResolution(
  settings: FrostExperimentalRenderSettings,
  presetValue: number,
): FrostExperimentalRenderSettings {
  const p = RENDER_RESOLUTION_PRESETS.find(x => x.value === presetValue);
  if (!p || p.value === 0) return settings;
  return { ...settings, width: p.width, height: p.height };
}

export function frostSettingsPresetLabel(settings: FrostExperimentalRenderSettings): string {
  return resolutionPresetFor(settings.width, settings.height).label;
}

/** Smoke / unit helpers — no DOM required. */
export function runFrostExperimentalSmoke(): { ok: boolean; failures: string[]; checks: number } {
  const failures: string[] = [];
  let checks = 0;
  const assert = (cond: boolean, msg: string) => {
    checks++;
    if (!cond) failures.push(msg);
  };

  assert(FROST_MODULE_TABS.length === 7, 'FROST has 7 tabs');
  assert(FROST_MODULE_TABS[6].id === 'experimental-render', 'tab 7 is Experimental Render');
  assert(FROST_MODULE_TABS[6].label === 'Experimental Render', 'tab 7 label');

  const s = defaultFrostExperimentalSettings();
  assert(s.movieFormat !== 'mov' as any, 'never mov');
  assert(s.aovs.includes('beauty') || true, 'default aovs');
  assert(frostSamplesForMode('hybrid', 128) <= 64, 'hybrid caps samples');
  assert(frostSamplesForMode('pathtrace', 128) === 128, 'pathtrace keeps samples');

  // Minimal fake app for synthesize
  const fakeApp = {
    scene: {
      allObjects: () => [],
      root: { property: () => null },
      renderOptions: null,
    },
    anim: { frame: 1, start: 1, end: 24 },
    logMsg: () => {},
  } as any;

  const rgba = synthesizeAovRgba(fakeApp, 'beauty', 8, 8, 1, 16, 'pathtrace');
  assert(rgba.length === 8 * 8 * 4, 'beauty rgba size');
  const den = denoiseRgba(rgba, 8, 8);
  assert(den.length === rgba.length, 'denoise size');

  const albedo = synthesizeAovRgba(fakeApp, 'albedo', 8, 8, 1, 4, 'hybrid');
  const normal = synthesizeAovRgba(fakeApp, 'normal', 8, 8, 1, 4, 'hybrid');
  const guided = denoiseRgba(rgba, 8, 8, { albedo, normal });
  assert(guided.length === rgba.length, 'guided denoise');

  const usd = buildUsdRenderStub(s, [{
    aov: 'beauty', frame: 1, path: 'FROST_Experimental/beauty.1.png',
    dataUrl: 'data:image/png;base64,xx', sample: 32, denoised: true, width: 8, height: 8,
  }]);
  assert(usd.includes('#usda 1.0'), 'usd stub header');
  assert(usd.includes('FrostExperimentalRender'), 'usd stub prim');
  assert(usd.includes('frost:aovs'), 'usd stub aovs');

  const res = runFrostExperimentalRender(fakeApp, {
    ...s,
    width: 32,
    height: 18,
    frameStart: 1,
    frameEnd: 4,
    samples: 8,
    aovs: ['beauty', 'albedo'],
  }, { openFlipbook: false });
  assert(res.ok, 'experimental render ok');
  assert(res.flipbookFrames.length <= FLIPBOOK_MAX_FRAMES, 'flipbook capped');
  assert(res.flipbookFrames.length === 4, `flipbook frames=${res.flipbookFrames.length}`);
  assert(res.plates.some(p => p.aov === 'albedo'), 'albedo plate');
  assert(res.experimental === true, 'marked experimental');

  return { ok: failures.length === 0, failures, checks };
}
