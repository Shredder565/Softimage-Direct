# uiut owner-draw PPG GDI — LOCK

**Date:** 2026-10-25  
**Class:** **LOCK** (optional push #4)  
**Desktop:** Softimage GUI **FORBIDDEN** — PE / Ghidra / existing dumps only.  
**Wire:** no invent CSS/TS chrome PR.

## Verdict

RE / dump **cannot** attest live PPG owner-draw **paint pixels** (title-bar / hover composite skins, `COLORREF` fills). Direct already ships PE-backed host layout + RT_BITMAP sizes from PRs **#36–#41**. Push #4 stops here.

## Evidence consumed

| Artifact | Result |
|----------|--------|
| `internal/softimage-pc-dumps/ui/si_ppg_hwnd_capture.json` | `windows: []` — overnight HWND kit empty; **no** title/hover metrics |
| `docs/ghidra/ui-lock-binary-pins.md` + `re-exports/ui-lock-binary-pins.json` | `uiut.dll` hits = `AddOn` / `EnableMenuItem` / `EnableWindow` only — **no** paint / `COLORREF` / DrawItem pins |
| softimage-pc `docs/ghidra/uiut-ppg-gdi.md` + pins JSON | **Absent** at wire time (softimage-pc dump agent not landed) |
| `internal/ghidra/decomp/` | **No** uiut PPG owner-draw / `WM_DRAWITEM` / `GradientFill` decomp |
| PE `dialogs/pe-dialogs-ui-model.json` → uiut hosts **138–147** | DLU + font only (already mirrored in `src/data/si/ppg_chrome.json`) |

## Direct PPG chrome audit (vs attested PE)

| Item | Attested? | Direct status |
|------|-----------|---------------|
| uiut host dialogs **138–147** font / `rect_dlu` / control DLU | **Yes** (PE) | Match `ppg_chrome.hosts` — no drift |
| Canonical host **147** (anim + nav + load/save) | **Yes** | Wired #36 |
| InspNav RT_BITMAP **137** 71×25, tools **141** 66×25 + hit strips | **Yes** (PE bitmap) | `bitmapMatch` true; public PNGs size-match |
| Toolbar height from bitmap height (25px) | **Yes** | `--ppg-toolbar-h` |
| Title-bar / float **gradient colors**, group/slider/value hex colors | **No** `COLORREF` / HWND sample | Hardcoded in `build_ppg_chrome.py` — **do not “correct” without RE** |
| Hover composite skins for nav bitmaps | **No** | Interactive-only residual ([dialog-pixel-perfect-progress.md](../dialog-pixel-perfect-progress.md)) |
| XSI.exe Property Page **394** | Stub `TODO: layout property page` | LOCK (not live host; live = uiut 147) |

## Exit

- **Optional push #4 → LOCK**
- **No** invent PR changing `--ppg-title-*` / hover CSS
- Docs LOCK note: Direct [#71](https://github.com/Shredder565/Softimage-Direct/pull/71)
- Reopen wire only if softimage-pc later lands attested GDI pins (headless Ghidra `COLORREF` / DrawItem constants) — still **no** Desktop

See plan: [optional-ghidra-pushes-1-4.md](../optional-ghidra-pushes-1-4.md).
