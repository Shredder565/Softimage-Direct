// Softimage Desktop LOCK close dump (2026-10-25) — honest wire statuses.
// Source: internal/softimage-pc-dumps/unlock/direct_lock_desktop_close.json
// Do not invent HWND crop px, PPG COLORREF, or OpenView paint from PROBE/DUMP_READY labels.
import desk from '../data/si/direct_lock_desktop_close.json';

type Honest = {
  dump_label?: string;
  wire?: string;
  hwnd_crop_chrome?: string;
  status?: string;
  note?: string;
};

const D = desk as {
  meta: { softimage: string; utc: string; wire_note: string };
  per: Record<string, string>;
  honest: Record<string, Honest>;
  region_params: Record<string, unknown>;
  openview_errors: Record<string, string>;
};

/** Softimage Desktop Passes.RenderOptions keys attested in direct_lock_desktop_close (OM only). */
export const DESKTOP_REGION_OM_KEYS = Object.keys(D.region_params);

/** Compact audit — Desktop dump landed; HWND/PPG/OpenView stay LOCK (no invent). */
export function directLockDesktopAudit(): Record<string, unknown> {
  const region = D.honest['render.region_hwnd_crop'];
  const ppg = D.honest['ui.ppg_title_hover_gdi'];
  const views = D.honest['animate.floating_views'];
  const openviewFail =
    Object.keys(D.openview_errors).length > 0 &&
    Object.values(D.openview_errors).every(e => /Wrong number of arguments|invalid property/i.test(e));
  return {
    softimage: D.meta.softimage,
    utc: D.meta.utc,
    wireNote: D.meta.wire_note,
    per: { ...D.per },
    regionOmParamCount: DESKTOP_REGION_OM_KEYS.length,
    regionOmHasImageSize:
      D.region_params.imagewidth === 1920 && D.region_params.imageheight === 1080,
    regionHwndCrop: region?.hwnd_crop_chrome ?? 'LOCK',
    regionWire: region?.wire ?? 'NONE',
    ppgColorref: ppg?.status ?? 'LOCK',
    floatingViews: views?.status ?? 'LOCK',
    openviewAllFailed: openviewFail,
    ok:
      (region?.hwnd_crop_chrome ?? 'LOCK') === 'LOCK' &&
      (ppg?.status ?? 'LOCK') === 'LOCK' &&
      openviewFail &&
      DESKTOP_REGION_OM_KEYS.length >= 20 &&
      D.region_params.imagewidth === 1920,
  };
}
