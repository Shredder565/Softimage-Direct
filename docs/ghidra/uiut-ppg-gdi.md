# uiut owner-draw PPG GDI

**Date:** 2026-10-25  
**Class:** **LOCK** (title/hover paint) · **DUMP_READY** (binary pins / RT_BITMAP inventory)  
**Desktop:** Softimage GUI **FORBIDDEN**  
**softimage-pc pins:** `internal/softimage-pc-dumps/re-exports/uiut-ppg-gdi-pins.json`  
**Resources:** `…/uiut-ppg-gdi-resources.json`  
**Bitmap metrics:** `…/uiut-ppg-gdi-bitmap-metrics.json` (43 BITMAPs)

## Verdict

| Layer | Status |
|-------|--------|
| PPG title-bar / hover **pixel chrome** | **LOCK** — empty overnight HWND; no `COLORREF` title/hover constants |
| Owner-draw + GDI entrypoints | **DUMP_READY** — `CDSBasePropertyFrame::OnDrawItem`, `C3DTrackMenu::DrawItem`, `BitBlt`/`StretchBlt`/`FillRect`/`SetTextColor` |
| Static RT_BITMAP inventory | **DUMP_READY** — 43×24bpp; sizes include **71×25** / **66×25** (InspNav/tools) |
| Direct chrome wire follow-up | **None** — PE host + toolbar bitmap sizes already in `#36–#41`; quantized dominant RGB is bitmap palette summary, **not** title/hover theme (do not invent gradients) |

## Direct audit after softimage-pc #4 RE

| Attested item | Direct |
|---------------|--------|
| uiut hosts **138–147** DLU/font | Match `ppg_chrome.hosts` |
| InspNav **137** 71×25, tools **141** 66×25 | `bitmapMatch` true; `data/si/pe_bitmaps/uiut` has **43** PNGs (= metrics count) |
| Toolbar height 25px | `--ppg-toolbar-h` from bitmap height |
| Other RT_BITMAP sizes (30×30, 50×22, 80×30, …) | Inventory only — not PPG shell title chrome |
| Dominant greys on 71×25/66×25 (~`[168,168,168]`) | Already painted via PNG assets; **not** a CSS title-gradient pin |
| Title/float gradient hex in `build_ppg_chrome.py` | Still unattested — leave as-is (no “correct” invent) |

## Wire guidance (from softimage-pc)

- OK: document owner-draw + GDI BitBlt/FillRect family; cite bitmap size inventory.
- LOCK: any specific title/hover pixel, theme color, or skin gradient without HWND (banned) or attested `COLORREF`.

Docs LOCK PR: [#71](https://github.com/Shredder565/Softimage-Direct/pull/71).  
Related: [ui-lock-binary-pins.md](./ui-lock-binary-pins.md) · overnight empty `si_ppg_hwnd_capture.json`.
