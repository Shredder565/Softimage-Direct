// AfterImage Render tab output catalog.
// Softimage-attested still formats (Framebuffer / prefs color_format) + dump MovieFormat (avi).
// Product upgrades (user 2026-10-25): default .mp4; offer 2K/4K; never offer .mov.
import type { ParamDef } from './params';

/** Softimage Framebuffer still Format (si_render_framebuffer_enums / prefs color_format). */
export const SI_STILL_FORMATS = [
  { label: 'Softimage (.pic)', value: 'pic' },
  { label: 'PNG (.png)', value: 'png' },
  { label: 'OpenEXR (.exr)', value: 'exr' },
  { label: 'TIFF (.tif)', value: 'tif' },
  { label: 'JPEG (.jpg)', value: 'jpg' },
] as const;

/**
 * Render / movie output formats offered in the Render tab.
 * Softimage RenderPass.MovieFormat SPDL listed Quicktime(mov)+AVI; AfterImage drops mov, defaults mp4.
 */
export const RENDER_OUTPUT_FORMATS: { label: string; value: string; kind: 'movie' | 'still' }[] = [
  { label: 'MP4 (.mp4)', value: 'mp4', kind: 'movie' },
  { label: 'AVI (.avi)', value: 'avi', kind: 'movie' },
  ...SI_STILL_FORMATS.map(f => ({ label: f.label, value: f.value, kind: 'still' as const })),
];

/** AfterImage product default — not Softimage dump (dump MovieFormat was avi; SPDL offered mov). */
export const DEFAULT_RENDER_OUTPUT_FORMAT = 'mp4';

/** Softimage C3DPrefsOutputFormat picture_standard sizes (propsets) + AfterImage 2K/4K. */
export const RENDER_RESOLUTION_PRESETS: { label: string; value: number; width: number; height: number; ratio: number }[] = [
  { label: 'Custom', value: 0, width: 1920, height: 1080, ratio: 1.777778 },
  { label: 'NTSC D1 4/3 720x486', value: 9, width: 720, height: 486, ratio: 720 / 486 },
  { label: 'NTSC D1 16/9 720x486', value: 12, width: 720, height: 486, ratio: 16 / 9 },
  { label: 'NTSC DV 720x480', value: 22, width: 720, height: 480, ratio: 720 / 480 },
  { label: 'PAL D1 4/3 720x576', value: 10, width: 720, height: 576, ratio: 720 / 576 },
  { label: 'PAL D1 16/9 720x576', value: 13, width: 720, height: 576, ratio: 16 / 9 },
  { label: 'HDTV 480 640x480', value: 14, width: 640, height: 480, ratio: 640 / 480 },
  { label: 'HDTV 720 16/9 1280x720', value: 17, width: 1280, height: 720, ratio: 16 / 9 },
  { label: 'HDTV 1080 16/9 1920x1080', value: 18, width: 1920, height: 1080, ratio: 16 / 9 },
  // AfterImage product sizes (not Softimage PE chrome)
  { label: '2K 16/9 2048x1080', value: 23, width: 2048, height: 1080, ratio: 2048 / 1080 },
  { label: '4K UHD 16/9 3840x2160', value: 24, width: 3840, height: 2160, ratio: 16 / 9 },
];

export const DEFAULT_PICTURE_STANDARD = 18; // Softimage HDTV 1080

/** Softimage Pass MovieFormat items after AfterImage upgrade (no Quicktime/mov). */
export const MOVIE_FORMAT_ITEMS = [
  { label: 'MP4', value: 'mp4' },
  { label: 'AVI', value: 'avi' },
] as const;

export function isMovieOutputFormat(fmt: string): boolean {
  return fmt === 'mp4' || fmt === 'avi';
}

export function acceptsRenderOutputFormat(fmt: string): boolean {
  return RENDER_OUTPUT_FORMATS.some(f => f.value === fmt) && fmt !== 'mov';
}

export function extensionForFormat(fmt: string): string {
  const v = String(fmt || DEFAULT_RENDER_OUTPUT_FORMAT).replace(/^\./, '').toLowerCase();
  if (v === 'tif' || v === 'tiff') return 'tif';
  if (v === 'jpeg') return 'jpg';
  if (v === 'mov') return 'mp4'; // never emit .mov
  return acceptsRenderOutputFormat(v) ? v : DEFAULT_RENDER_OUTPUT_FORMAT;
}

export function movieFormatParamDefs(): ParamDef[] {
  return [
    {
      name: 'MovieCreate',
      label: 'MovieCreate',
      type: 'bool',
      value: false,
      animatable: false,
    },
    {
      name: 'MovieFormat',
      label: 'MovieFormat',
      type: 'enum',
      value: DEFAULT_RENDER_OUTPUT_FORMAT,
      items: MOVIE_FORMAT_ITEMS.map(it => ({ label: it.label, value: it.value })),
      animatable: false,
    },
    {
      name: 'MovieFileName',
      label: 'MovieFileName',
      type: 'string',
      value: '[Pass]_[Framebuffer]',
      animatable: false,
    },
    {
      name: 'MovieWriteAlpha',
      label: 'MovieWriteAlpha',
      type: 'bool',
      value: true,
      animatable: false,
    },
  ];
}

export function resolutionPresetFor(width: number, height: number) {
  return RENDER_RESOLUTION_PRESETS.find(p => p.value !== 0 && p.width === width && p.height === height)
    ?? RENDER_RESOLUTION_PRESETS[0];
}
