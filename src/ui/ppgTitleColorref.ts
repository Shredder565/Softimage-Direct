// Softimage PPG title/chrome COLORREF from Desktop DUMP_READY harvests.
// Title/chrome: modules-gdi. Hover GetPixel: closer95. Dump-attested only; no invent.
import dump from '../data/si/ppg_title_colorref.json';

type Sample = {
  colorref: string;
  rgb: number[];
  hex: string;
  offset: number[];
  role: string;
};

type HoverSample = {
  role: string;
  colorref: string;
  rgb: number[];
  hex: string;
  offset: number[];
  screen?: number[];
};

const D = dump as {
  softimage: string;
  status: string;
  wire: string;
  hover: {
    status: string;
    wire?: string;
    note?: string;
    tokens?: {
      idleTitle: string;
      hoverClose: string;
      hoverTitleMid: string;
    };
    samples?: HoverSample[];
  };
  source: Record<string, unknown>;
  samples: { PPG_Cube: Sample[] };
  tokens: {
    titleFill: string;
    titleText: string;
    chromeFace: string;
    chromeMid: string;
  };
};

/** Dump-attested PPG title/chrome CSS tokens (+ closer95 hover GetPixel). */
export const PPG_TITLE_COLORREF = D;

/** Compact audit — COLORREF title/chrome WIRED; hover GetPixel DUMP_READY/WIRED. */
export function ppgTitleColorrefAudit(): Record<string, unknown> {
  const cs = getComputedStyle(document.documentElement);
  const t = D.tokens;
  const ht = D.hover.tokens;
  const cube = D.samples.PPG_Cube ?? [];
  const byRole = Object.fromEntries(cube.map(s => [s.role, s.hex]));
  const cssTitle = cs.getPropertyValue('--ppg-title-top').trim().toLowerCase();
  const cssFg = cs.getPropertyValue('--ppg-title-fg').trim().toLowerCase();
  const cssFace = cs.getPropertyValue('--ppg-chrome-face').trim().toLowerCase();
  const cssMid = cs.getPropertyValue('--ppg-chrome-mid').trim().toLowerCase();
  const cssHoverClose = cs.getPropertyValue('--ppg-title-hover-close').trim().toLowerCase();
  const cssHoverIdle = cs.getPropertyValue('--ppg-title-hover-idle').trim().toLowerCase();
  const cssHoverMid = cs.getPropertyValue('--ppg-title-hover-mid').trim().toLowerCase();
  const tokensApplied =
    cssTitle === t.titleFill.toLowerCase() &&
    cssFg === t.titleText.toLowerCase() &&
    cssFace === t.chromeFace.toLowerCase() &&
    cssMid === t.chromeMid.toLowerCase();
  const hoverApplied =
    !!ht &&
    cssHoverClose === ht.hoverClose.toLowerCase() &&
    cssHoverIdle === ht.idleTitle.toLowerCase() &&
    cssHoverMid === ht.hoverTitleMid.toLowerCase() &&
    ht.idleTitle === ht.hoverTitleMid;
  return {
    softimage: D.softimage,
    status: D.status,
    wire: D.wire,
    hover: D.hover.status,
    hoverWire: D.hover.wire ?? null,
    sampleCount: cube.length,
    hoverSampleCount: D.hover.samples?.length ?? 0,
    roles: byRole,
    tokens: { ...t },
    hoverTokens: ht ? { ...ht } : null,
    css: {
      titleTop: cssTitle,
      titleFg: cssFg,
      chromeFace: cssFace,
      chromeMid: cssMid,
      hoverClose: cssHoverClose,
      hoverIdle: cssHoverIdle,
      hoverMid: cssHoverMid,
    },
    tokensApplied,
    hoverApplied,
    ok:
      D.status === 'DUMP_READY' &&
      D.wire === 'COLORREF_TITLE_CHROME' &&
      D.hover.status === 'DUMP_READY' &&
      D.hover.wire === 'COLORREF_HOVER' &&
      t.titleFill === '#607388' &&
      t.titleText === '#E4E6EA' &&
      t.chromeFace === '#ABA8A6' &&
      t.chromeMid === '#9E9B99' &&
      ht?.idleTitle === '#8B8A8A' &&
      ht?.hoverClose === '#2F2E2E' &&
      ht?.hoverTitleMid === '#8B8A8A' &&
      cube.length >= 4 &&
      (D.hover.samples?.length ?? 0) >= 3 &&
      tokensApplied &&
      hoverApplied,
  };
}
