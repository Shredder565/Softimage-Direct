# Full-clone residual → Ghidra bridge index

Maps remaining Softimage Direct gaps (UI / Model / Animate) to Softimage 2015 SP2 binaries and wire PRs.
Authoritative inventory lives in the Project store `docs/rea-full-clone-residuals.md`.

| ID | Area | Residual | Binary / entry | Class | Wire |
|----|------|----------|----------------|-------|------|
| A1 | Model | CapHoleProc ICE path (not SPDL PPG) | CapHoleProc VBS → ApplyICEOp; ICE Cap Hole compound `Vertex_Index` | WIRE | CapHole → Cap_Hole ICETree |
| A2 | Model | CapHole SPDL Layout | none (absent) | LOCK | — |
| A3 | Model | GenOpInputsButtons chrome | GenOp SPDL fragments `has_layout:false` | LOCK | — |
| A4 | Model | Bevel collide / DAT_* | `mohelper.dll` `C3DLineSegmentBeveler::*` | WIRE (blocked) | after softimage-pc DAT dump |
| A5 | Model | PolyReduce QEM internals | `topologyop.dll` mesh-eval pin | WIRE (partial) | optional cost tweak |
| B1 | Animate | Mixer clip transition curves | `animationmixer.dll` prefs + eval | WIRE | ease / TW deltas |
| B2 | Animate | PC mixer transitions without clip sel | XSIBATCH dump gap | LOCK | — |
| B3 | Animate | ApplyFlexEnv weights under `-processing` | envelope cmd cancel | LOCK weights / WIRE Mode | Mode enum lock |
| C1 | UI | MCP live HWND Enabled | `sicoresdk` GetEnabled + HWND paste | LOCK live | after paste JSON |
| C2–C6 | UI | PPG GDI / PE 394 / Send-to / ICE anchors | see residuals audit | LOCK | — |

## Softimage-pc coordination

Consume new notes from Project store `docs/ghidra/` and `internal/ghidra/` as the **Ghidra residual RE** worker lands them. Prefer small green Direct PRs; stack immediately.
