# UI LOCK residuals — binary pins (no Desktop)

**Date:** 2026-10-24  
**Dump:** softimage-pc `internal/softimage-pc-dumps/re-exports/ui-lock-binary-pins.json`  
**Class:** corroborate LOCK rows in residuals C2–C6 / A3 — **not** portable wire.

## String hits (Application\bin)

| Binary | Hits | Note |
|--------|------|------|
| `optasks.dll` | U16 `GenOpInputs` | GenOp input-button chrome host string — confirms A3/GenOp fragment family |
| `toolbarobj.dll` | U16 `Cap Hole` | Menu label only (no CapHole PPG) |
| `XSI.exe` | U16 `Property Page`, `TODO: layout property page`, `Send to`, `Add-On`; RT_DIALOG **394** | PE394 stub **WIRED** (shell chrome); Send-to / Add-On still out (C5) |
| `uiut.dll` / `mcp.dll` | (none for these needles) | Live PPG/MCP HWND skins still LOCK |

## Implications

- **GenOp Hide/Delete inputs:** binary name token exists in optasks; still **no** SPDL Layout grammar → LOCK (A3).
- **PE Property Page 394:** RT_DIALOG 394 + TODO stub strings → **DONE** (PPG/shell chrome pins only; no invent Layout). See `src/data/si/pe_property_page_394.json`.
- **Send-to / Add-On:** still out of web-clone → LOCK / out-of-scope (C5).
- **MCP live Enabled:** [getenabled-deepen.md](./getenabled-deepen.md) — mcp → `sitaskcore!OnUpdateUI` only; HWND matrix still LOCK (C1).

No Direct invent-work from these pins alone.
