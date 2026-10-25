# Full-clone residual → Ghidra bridge index

Maps remaining Softimage Direct gaps (UI / Model / Animate) to Softimage 2015 SP2 binaries and wire PRs.  
Authoritative inventory: Project store `docs/rea-full-clone-residuals.md`.  
Softimage-pc progress: `docs/rea-ghidra-residual-progress.md`.

| ID | Area | Residual | Binary / entry | Class | Softimage-pc RE | Wire |
|----|------|----------|----------------|-------|-----------------|------|
| A1 | Model | CapHoleProc ICE path | CapHoleProc VBS → ApplyICEOp; ICE `Cap Hole.xsicompound` `Vertex_Index` — **no CapHole mesh DLL** | WIRE | [capholeproc-path.md](./capholeproc-path.md) **done** | CapHole → Cap_Hole ICETree |
| A2 | Model | CapHole SPDL Layout | none (absent) | LOCK | corroborated | — |
| A3 | Model | GenOpInputsButtons chrome | GenOp SPDL fragments `has_layout:false` | LOCK | — | — |
| A4 | Model | Bevel collide / DAT_* | `mohelper.dll` `C3DLineSegmentBeveler::*` | WIRE (blocked) | queued | after DAT dump |
| A5 | Model | PolyReduce QEM internals | `topologyop.dll` mesh-eval pin | WIRE (partial) | prior | optional cost tweak |
| B1 | Animate | Mixer clip transition curves | **`nlehelper!SINleCreateTransitionTask`** create; curve eval → `CXSITransitionCore` next | WIRE | [mixer-clip-transitions.md](./mixer-clip-transitions.md) **partial** | ease / TW deltas |
| B2 | Animate | PC mixer transitions without clip sel | XSIBATCH dump gap | LOCK | — | — |
| B3 | Animate | ApplyFlexEnv weights under `-processing` | `deformop` `C3DEnvelopOp` / `envelopop`; cancel under `-processing` | LOCK weights / WIRE Mode | [applyflexenv-path.md](./applyflexenv-path.md) + [flexenv-headless-lock.md](./flexenv-headless-lock.md) | Mode enum lock |
| B4 | Animate | Fcurve handled-spline | **`gk10` GkStdFCurve** cubic Bezier + time→u | DONE harness; formula **confirmed** | [fcurve-handled-spline.md](./fcurve-handled-spline.md) | new cases only |
| C1 | UI | MCP live HWND Enabled | `sicoresdk` GetEnabled + HWND paste | LOCK live | [getenabled-callpath.md](./getenabled-callpath.md) prior | after paste JSON |
| C2–C6 | UI | PPG GDI / PE 394 / Send-to / ICE anchors | see residuals audit | LOCK | — | — |

## Softimage-pc coordination

Consume notes from Project store `docs/ghidra/` and `internal/ghidra/decomp/` as they land. Prefer small green Direct PRs; stack immediately. **No Softimage Desktop takeover.**
