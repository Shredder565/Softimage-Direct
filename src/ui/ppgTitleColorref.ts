// Softimage PPG title/chrome COLORREF from Desktop DUMP_READY modules-gdi harvest.
// Source: data/dump/si_ppg_title_colorref.json — dump-attested only; hover LOCK (no invent).
import dump from '../data/si/ppg_title_colorref.json';

type Sample = {
  colorref: string;
  rgb: number[];
  hex: string;
  offset: number[];
  role: string;
};

const D = dump as {
  softimage: string;
  status: string;
  wire: string;
  hover: { status: string; note?: string };
  source: Record<string, unknown>;
  samples: { PPG_Cube: Sample[] };
  tokens: {
    titleFill: string;
    titleText: string;
    chromeFace: string;
    chromeMid: string;
  };
};

/** Dump-attested PPG title/chrome CSS tokens (hover stays LOCK). */
export const PPG_TITLE_COLORREF = D;

/** Compact audit — COLORREF title/chrome WIRED; hover LOCK. */
export function ppgTitleColorrefAudit(): Record<string, unknown> {
  const cs = getComputedStyle(document.documentElement);
  const t = D.tokens;
  const cube = D.samples.PPG_Cube ?? [];
  const byRole = Object.fromEntries(cube.map(s => [s.role, s.hex]));
  const cssTitle = cs.getPropertyValue('--ppg-title-top').trim().toLowerCase();
  const cssFg = cs.getPropertyValue('--ppg-title-fg').trim().toLowerCase();
  const cssFace = cs.getPropertyValue('--ppg-chrome-face').trim().toLowerCase();
  const cssMid = cs.getPropertyValue('--ppg-chrome-mid').trim().toLowerCase();
  const tokensApplied =
    cssTitle === t.titleFill.toLowerCase() &&
    cssFg === t.titleText.toLowerCase() &&
    cssFace === t.chromeFace.toLowerCase() &&
    cssMid === t.chromeMid.toLowerCase();
  return {
    softimage: D.softimage,
    status: D.status,
    wire: D.wire,
    hover: D.hover.status,
    sampleCount: cube.length,
    roles: byRole,
    tokens: { ...t },
    css: { titleTop: cssTitle, titleFg: cssFg, chromeFace: cssFace, chromeMid: cssMid },
    tokensApplied,
    ok:
      D.status === 'DUMP_READY' &&
      D.wire === 'COLORREF_TITLE_CHROME' &&
      D.hover.status === 'LOCK' &&
      t.titleFill === '#607388' &&
      t.titleText === '#E4E6EA' &&
      t.chromeFace === '#ABA8A6' &&
      t.chromeMid === '#9E9B99' &&
      cube.length >= 4 &&
      tokensApplied,
  };
}
