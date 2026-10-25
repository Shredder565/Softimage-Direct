# REA / Ghidra residual progress (softimage-pc)

**Updated:** 2026-10-25 (pass 3)  
**Worker:** softimage-pc + Direct wire sibling  
**Inventory:** Project store `docs/rea-full-clone-residuals.md` | index [ghidra/residual-index.md](./ghidra/residual-index.md)

## Pass 3 — consume + wire

| Residual | Artifact | Status |
|----------|----------|--------|
| **B3 FlexEnv Mode** | [ghidra/applyflexenv-path.md](./ghidra/applyflexenv-path.md) | **WIRE** — SPDL `autoassignmeth` 0=Distance, 1=Normal (default 1); #56 inverted → fixed |
| **A1 CapHole Vertex_Index** | [ghidra/caphole-vertex-index-bind.md](./caphole-vertex-index-bind.md) | **DONE** — #54 bind confirmed (`Vertex_Index` username) |
| **C1 GetEnabled deepen** | [ghidra/getenabled-deepen.md](./getenabled-deepen.md) | CanBeModified + PutEnabled portable; HWND matrix **LOCK** |
| **B1 Mixer weight presets** | [ghidra/mixer-clip-transitions.md](./ghidra/mixer-clip-transitions.md) | **WIRE** — SetDefaultWeight / siWeightPresets; Exponential LOCK |
| **UI LOCK pins** | [ghidra/ui-lock-binary-pins.md](./ui-lock-binary-pins.md) | Docs only (A3/C2–C6) |
| **A4 Bevel DAT xrefs** | [ghidra/bevel-dat-xrefs.md](./ghidra/bevel-dat-xrefs.md) | Docs only until managecollisions golden |
| **A5 PolyReduce rename** | [ghidra/polyreduce-rename-map.md](./ghidra/polyreduce-rename-map.md) | Docs only unless DIFF |

## Prior passes

| Residual | Status |
|----------|--------|
| A1 CapHoleProc ICE | DONE #54 |
| B4 gk10 handled-spline | DONE harness |
| B3 FlexEnv Animation region + canRun | DONE #56 (Mode enum corrected this PR) |
| B1 Hermite transitionEase + Auto Transition | DONE #55 / main |

## WIRE rows — closed or LOCK-proofed

Explicit: every WIRE row from the residuals inventory is **PR'd/merged**, **in this PR**, or **LOCK-proofed** with Softimage-attested blocker (no Desktop invent). Remaining work needs new goldens: A4 collide, C1 live HWND matrix.
