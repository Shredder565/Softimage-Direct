# Softimage 2015 SP2 — Ghidra / RE docs (Softimage Direct)

Clean-room notes only. Softimage binaries are not copied into this tree.
Upstream Project store mirrors live under the Softimage Reproduce agent store `docs/ghidra/` + `internal/ghidra/`.

## Residual bridge (full clone)

Canonical inventory: Project store [`docs/rea-full-clone-residuals.md`](https://github.com/Shredder565/Softimage-Direct) (agent store path). This folder holds RE notes that drive TypeScript fidelity PRs.

| Doc | What |
|-----|------|
| [residual-index.md](./residual-index.md) | UI + Model + Animate residual → DLL → wire map |
| [capholeproc-path.md](./capholeproc-path.md) | CapHoleProc → ApplyICEOp Cap Hole + Vertex_Index |
| [mixer-clip-transitions.md](./mixer-clip-transitions.md) | animationmixer.dll transition / timewarp pins |
| [flexenv-headless-lock.md](./flexenv-headless-lock.md) | ApplyFlexEnv XSIBATCH `-processing` gap + Mode args |
| [applyflexenv-path.md](./applyflexenv-path.md) | softimage-pc: CapHoleProc-style FlexEnv VBS + deformop.dll pins |
| [fcurve-handled-spline.md](./fcurve-handled-spline.md) | softimage-pc: gk10.dll GkStdFCurve Left/Right formula (harness #48 locked) |
| [getenabled-callpath.md](./getenabled-callpath.md) | SR-28 CommandCore GetEnabled vs MCP grey |
| [dll-priority.md](./dll-priority.md) | P0/P1 import order for residual RE |
| [rea-notes.md](./rea-notes.md) | SPDL↔CLSID↔DLL registration (Bevel / PolyReduce) |

## Hard rules

- No Softimage Desktop mouse/keyboard takeover.
- No Softimage source/binary paste into Direct.
- Wire only dump- or Ghidra-attested behavior.
