# MCP HWND Enabled — overnight Desktop dump

**Dump:** `data/dump/si_mcp_hwnd_enabled.json` (from softimage-pc `ui/si_mcp_hwnd_enabled.json`)  
**Softimage:** 13.2.163.0 Desktop overnight (2026-10-25)  
**Mode:** Command.Enabled proxy for MCP chrome keys (not raw Win32 HWND Enabled bits)

## Quality

| Metric | Value |
|--------|------:|
| Contexts | 4 (`empty`, `single_mesh`, `multi_mesh`, `single_null`) |
| Attested button bools | 16 (all `true`: translate / rotate / scale / duplicate) |
| Null button cells | 40 (parent, cut, freeze, group, freezeM, sample, snap, prop, cog, symmetry) |
| Attested Command.Enabled | Translate / Rotate / Scale / Duplicate = true in all 4 contexts |

Null cells stay **fall back to Direct canRun** — no invent greying.

## Wire

- Overlay merged into `src/data/si/mcp_enabled_matrix.json` as `hwnd_buttons`
- Consumed by `hwndButtonEnabled()` in `src/ui/mcpEnableMatrix.ts` → MCP `btnEn` in `mcp.ts`
- Rebuild helper understands overnight `contexts[].buttons` shape: `tools/rebuild_mcp_enabled_matrix.py`
