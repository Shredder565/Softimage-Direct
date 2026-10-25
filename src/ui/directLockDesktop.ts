// Softimage Desktop LOCK close dump (2026-10-25) — honest wire statuses.
// Source: internal/softimage-pc-dumps/unlock/direct_lock_desktop_close.json (+ modules-gdi PPG COLORREF + closer95 hover).
// Region HWND crop closed by modules-gdi harvest; PPG title + hover GetPixel WIRED; OpenView stays LOCK — no invent.
// Anim Mixer/Editor/Fcurve client paint DONE via modules-gdi HWND PNG (anim_client_paint.json).
import desk from '../data/si/direct_lock_desktop_close.json';

type Honest = {
  dump_label?: string;
  wire?: string;
  hwnd_crop_chrome?: string;
  status?: string;
  hover?: string;
  hover_wire?: string;
  note?: string;
  openview?: string;
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

/** Compact audit — region HWND DUMP_READY + PPG title COLORREF WIRED; hover GetPixel DUMP_READY; OpenView LOCK; Anim ExecCmd + paint DONE. */
export function directLockDesktopAudit(): Record<string, unknown> {
  const region = D.honest['render.region_hwnd_crop'];
  const ppg = D.honest['ui.ppg_title_hover_gdi'];
  const views = D.honest['animate.floating_views'] as Honest;
  const paint = D.honest['animate.fcurve_mixer_client_paint'];
  const openviewFail =
    Object.keys(D.openview_errors).length > 0 &&
    Object.values(D.openview_errors).every(e => /Wrong number of arguments|invalid property/i.test(e));
  const floatingExecDone =
    (views?.status === 'EXECCMD_DONE' || views?.wire === 'EXECCMD') &&
    (views?.openview ?? 'LOCK') === 'LOCK';
  const regionHwnd = region?.hwnd_crop_chrome ?? 'LOCK';
  const ppgWired =
    (ppg?.status === 'WIRED' || ppg?.wire === 'COLORREF_TITLE_CHROME') &&
    (ppg?.hover === 'DUMP_READY') &&
    (ppg?.hover_wire === 'COLORREF_HOVER') &&
    (ppg?.dump_label === 'DUMP_READY');
  return {
    softimage: D.meta.softimage,
    utc: D.meta.utc,
    wireNote: D.meta.wire_note,
    per: { ...D.per },
    regionOmParamCount: DESKTOP_REGION_OM_KEYS.length,
    regionOmHasImageSize:
      D.region_params.imagewidth === 1920 && D.region_params.imageheight === 1080,
    regionHwndCrop: regionHwnd,
    regionWire: region?.wire ?? 'NONE',
    ppgColorref: ppg?.status ?? 'LOCK',
    ppgColorrefWire: ppg?.wire ?? 'NONE',
    ppgHover: ppg?.hover ?? 'LOCK',
    ppgHoverWire: ppg?.hover_wire ?? 'NONE',
    floatingViews: views?.status ?? 'LOCK',
    floatingViewsOpenview: views?.openview ?? 'LOCK',
    floatingViewsWire: views?.wire ?? 'NONE',
    fcurveMixerClientPaint: paint?.status ?? 'LOCK',
    fcurveMixerClientPaintWire: paint?.wire ?? 'NONE',
    openviewAllFailed: openviewFail,
    ok:
      regionHwnd === 'DUMP_READY' &&
      (region?.wire ?? '') === 'HWND_CROP' &&
      ppgWired &&
      openviewFail &&
      floatingExecDone &&
      (paint?.status ?? 'LOCK') === 'DONE' &&
      (paint?.wire ?? 'NONE') === 'HWND_PNG' &&
      DESKTOP_REGION_OM_KEYS.length >= 20 &&
      D.region_params.imagewidth === 1920,
  };
}
