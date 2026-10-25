# Full-clone residual → Ghidra bridge index

Maps remaining Softimage Direct gaps (UI / Model / Animate) to Softimage 2015 SP2 binaries and wire PRs.  
Authoritative inventory: Project store `docs/rea-full-clone-residuals.md`.  
Softimage-pc progress: `docs/rea-ghidra-residual-progress.md`.

| ID | Area | Residual | Binary / entry | Class | Softimage-pc RE | Wire |
|----|------|----------|----------------|-------|-----------------|------|
| A1 | Model | CapHoleProc ICE path | CapHoleProc VBS → ApplyICEOp; `Vertex_Index` | **DONE** (#54) | [capholeproc-path.md](./capholeproc-path.md) + [caphole-vertex-index-bind.md](./caphole-vertex-index-bind.md) | Cap_Hole + Vertex_Index confirmed |
| A2 | Model | CapHole SPDL Layout | none (absent) | **LOCK** | corroborated | — |
| A3 | Model | GenOpInputsButtons chrome | GenOp SPDL `has_layout:false` | **LOCK** | [ui-lock-binary-pins.md](./ui-lock-binary-pins.md) | — |
| A4 | Model | Bevel collide / DAT_* | `mohelper` ComputeBevelVectors DAT_* **pinned** | **LOCK** (optional push #1; collide harness OK, mesh-equal) | [bevel-dat-xrefs.md](./bevel-dat-xrefs.md) | no invent Bevel |
| A5 | Model | PolyReduce QEM internals | `topologyop.dll` mesh-eval pin | **LOCK** / **NO_DIFF** (optional push #2; topo harness OK) | [polyreduce-rename-map.md](./polyreduce-rename-map.md) | rename map only |
| B1 | Animate | Mixer weight / transition | weight=`actionclip.weight` + `siWeightPresets`; prefs=**display** | **WIRE** (this PR) | [mixer-clip-transitions.md](./mixer-clip-transitions.md) | SetDefaultWeight + FCurve sample |
| B2 | Animate | PC mixer transitions | Desktop pass3 TW1 WIRE (`type=2`); empty without clip sel still LOCK | **WIRE** (TW1) / LOCK (no sel) | [mixer-clip-transitions.md](./mixer-clip-transitions.md) | AddTWTransition → TW# |
| B3 | Animate | ApplyFlexEnv weights / Mode | Desktop VBArray: numeric % Weights.Array | **WIRE** weights + Mode | [flexenv-headless-lock.md](./flexenv-headless-lock.md) | VBArray golden; Direct unit sum |
| B4 | Animate | Fcurve handled-spline | **`gk10` GkStdFCurve** | **DONE** | [fcurve-handled-spline.md](./fcurve-handled-spline.md) | new cases only |
| C1 | UI | MCP / Anim HWND Enabled | Desktop MCP + Anim Command.Enabled overlays | **WIRE** attested bools; OpenView **LOCK** | [../anim-hwnd-chrome-overnight.md](../anim-hwnd-chrome-overnight.md) | null→canRun; no invent views |
| C2–C6 | UI | PPG GDI / PE 394 / Send-to / ICE anchors | see [ui-lock-binary-pins.md](./ui-lock-binary-pins.md) + [uiut-ppg-gdi.md](./uiut-ppg-gdi.md) | **LOCK** | empty HWND + no GDI COLORREF; PE host already #36–#41 | no invent |

## Softimage-pc coordination

Consume notes from Project store `docs/ghidra/` and `internal/ghidra/decomp/` as they land. Prefer small green Direct PRs; stack immediately. **No Softimage Desktop takeover.**

## WIRE inventory status (pass 3)

All residual WIRE rows are either **DONE/PR'd**, **LOCK-proofed** (docs + attested blocker), or **in this PR** (B1 presets + B3 Mode SPDL + C1 CanBeModified portable). No open invent-work remaining without new Softimage-pc goldens (A4 collide, C1 HWND matrix).
