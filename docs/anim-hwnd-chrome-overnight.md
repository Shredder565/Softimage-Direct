# Anim HWND chrome — overnight Desktop dump

**Dump:** `data/dump/si_anim_hwnd_chrome.json` (from softimage-pc `anim/si_anim_hwnd_chrome.json`)  
**Softimage:** 13.2.163.0 Desktop (`si_anim_hwnd_kit.js`)  
**Mode:** Command.Enabled matrix for Animate commands — not raw Win32 HWND bits  
**Screenshots:** `docs/screenshots/overnight-desktop/si-anim-hwnd-chrome.png`, `si-anim-desktop-fullscreen.png`

## Quality

| Metric | Value |
|--------|------:|
| Contexts | 3 (`empty`, `keyed_null`, `mesh_skeleton`) |
| Attested Command.Enabled | **12** cells — `StoreAction` / `AddClip` / `AddTransition` / `CreateCompound` = **true** in all 3 |
| Null command cells | 123 (SaveKey, playback, Open*, ApplyFlexEnv, …) → fall back to Direct canRun |
| Views opened | **0** |
| OpenView API | **Avoided** (AV on this PC); Open* Commands → `Invalid argument` — `view_probe` failures only |

**LOCK:** Animation Editor / Mixer / DopeSheet / Keying / Playback / Layers floating chrome pixels beyond Desktop shell screenshots — no invent from failed `view_probe`.

## Wire

- Golden + screenshots in-repo
- Merged into `src/data/si/mcp_enabled_matrix.json` contexts + `meta.anim_hwnd_overlay`
- `mcpEnableMatrix.ts`: `keyed_null` / `mesh_skeleton` fallbacks
- Rebuild: `tools/rebuild_mcp_enabled_matrix.py` consumes Anim HWND dump
- Harness: `node tools/compare_anim_hwnd.mjs`

Null Enabled cells stay **canRun** — no invent greying / no invent OpenView.
