# uiut owner-draw PPG GDI

**Date:** 2026-10-25  
**Class:** **WIRED** (title/chrome COLORREF) · **WIRED** (hover GetPixel) · **DUMP_READY** (binary pins / RT_BITMAP inventory)  
**Desktop:** Softimage GUI mouse/keyboard **ALLOWED** (user override)  
**softimage-pc pins:** `internal/softimage-pc-dumps/re-exports/uiut-ppg-gdi-pins.json`  
**COLORREF harvest:** `internal/softimage-pc-dumps/modules-gdi/ppg_colorref_samples.txt` + `media/softimage-modules-gdi/60-ppg-inspect-cube.png`  
**Hover GetPixel:** `internal/softimage-pc-dumps/closer95/ppg_hover_getpixel_samples.txt` + `media/softimage-95pct-closer/40/41/42-ppg-*.png`  
**Resources:** `…/uiut-ppg-gdi-resources.json`  
**Bitmap metrics:** `…/uiut-ppg-gdi-bitmap-metrics.json` (43 BITMAPs)

## Verdict

| Layer | Status |
|-------|--------|
| PPG title-bar / chrome **COLORREF** | **WIRED** — Desktop GetPixel DUMP_READY → `#607388` fill / `#E4E6EA` text / `#ABA8A6` face / `#9E9B99` mid |
| PPG title / close **hover** paint | **WIRED** — closer95 GetPixel DUMP_READY → idle `#8B8A8A` / close `#2F2E2E` / mid `#8B8A8A` (mid==idle) |
| Owner-draw + GDI entrypoints | **DUMP_READY** — `CDSBasePropertyFrame::OnDrawItem`, `C3DTrackMenu::DrawItem`, `BitBlt`/`StretchBlt`/`FillRect`/`SetTextColor` |
| Static RT_BITMAP inventory | **DUMP_READY** — 43×24bpp; sizes include **71×25** / **66×25** (InspNav/tools) |

## Dump-attested tokens (PPG_Cube title/chrome)

| Role | COLORREF | RGB | CSS |
|------|----------|-----|-----|
| title_text | `0x00EAE6E4` | (228,230,234) | `#E4E6EA` |
| title_fill | `0x00887360` | (96,115,136) | `#607388` |
| chrome_mid | `0x00999B9E` | (158,155,153) | `#9E9B99` |
| chrome_face | `0x00A6A8AB` | (171,168,166) | `#ABA8A6` |

Title fill attested once — CSS gradient top/bot both use `#607388` (no invent second stop).

## Dump-attested hover GetPixel (closer95)

| Role | COLORREF | RGB | CSS |
|------|----------|-----|-----|
| idle_title | `0x008A8A8B` | (139,138,138) | `#8B8A8A` |
| hover_close_zone | `0x002E2E2F` | (47,46,46) | `#2F2E2E` |
| hover_title_mid | `0x008A8A8B` | (139,138,138) | `#8B8A8A` |

`hover_title_mid` equals `idle_title` — no mid-title hover paint change. Close-zone token drives `.ppg-float-close:hover` (replaces invent yellow). Title fill stays modules-gdi `#607388`.

## Direct wire

| Path | Role |
|------|------|
| `data/dump/si_ppg_title_colorref.json` | Harvest mirror |
| `data/dump/ppg_hover_getpixel_samples.txt` | closer95 samples mirror |
| `src/data/si/ppg_title_colorref.json` | Runtime dump |
| `src/data/si/ppg_chrome.json` `tokens` / `titleColorref` | Built by `tools/build_ppg_chrome.py` |
| `src/ui/ppgTitleColorref.ts` | Audit |
| `src/styles.css` `--ppg-title-*` / `--ppg-title-hover-*` / `--ppg-chrome-*` | Applied chrome |

Docs LOCK PR (binary pins only): [#71](https://github.com/Shredder565/Softimage-Direct/pull/71).  
COLORREF wire: [#109](https://github.com/Shredder565/Softimage-Direct/pull/109).  
Hover GetPixel wire: this change.  
Related: [ui-lock-binary-pins.md](./ui-lock-binary-pins.md) · [softimage-modules-gdi-tour.md](../../docs/softimage-modules-gdi-tour.md) · [softimage-95pct-closer-tour.md](../../docs/softimage-95pct-closer-tour.md) (store tours).
