# REA / Ghidra residual progress (softimage-pc)

**Updated:** 2026-10-24  
**Worker:** softimage-pc | Softimage 2015 SP2 | **No Desktop takeover**  
**Inventory:** [rea-full-clone-residuals.md](./rea-full-clone-residuals.md) | index [ghidra/residual-index.md](./ghidra/residual-index.md)

## This pass - landed for wire sibling

| Residual | Artifact | Status |
|----------|----------|--------|
| **A1 CapHoleProc** | [ghidra/capholeproc-path.md](./ghidra/capholeproc-path.md) | **RE done** - VBS->ApplyICEOp("Cap Hole")+`Vertex_Index`; ICE only; no mesh CapHole DLL |
| **B4 Fcurve handled-spline** | [ghidra/fcurve-handled-spline.md](./ghidra/fcurve-handled-spline.md) | **Formula confirmed** in `gk10.dll` (cubic Bezier Y + time->u); harness already DONE |
| **B1 Mixer transitions** | [ghidra/mixer-clip-transitions.md](./ghidra/mixer-clip-transitions.md) | **Partial** - `nlehelper!SINleCreateTransitionTask`; `CXSITransitionCore` = OM only; curve eval host open |
| **B3 ApplyFlexEnv** | [ghidra/applyflexenv-path.md](./ghidra/applyflexenv-path.md) + [ghidra/flexenv-headless-lock.md](./ghidra/flexenv-headless-lock.md) | **Path locked** - `deformop`/`C3DEnvelopOp`; XSIBATCH weights LOCK |
| **A4 Bevel DAT_*** | [ghidra/bevel-dat-candidates.md](./ghidra/bevel-dat-candidates.md) | **Candidates dumped** - need ComputeBevelVectors xrefs |
| **C1 GetEnabled** | [ghidra/getenabled-callpath.md](./getenabled-callpath.md) | Prior DONE - live HWND still LOCK |

## Ghidra project adds

`Documents\SoftimageGhidra\Softimage2015SP2`: `gk10.dll`, `fcurve.dll`, `animationmixer.dll`, `deformop.dll`, `nlehelper.dll` (+ prior topologyop/mohelper/mcp/sicoresdk/?).

Decomps: `internal/ghidra/decomp/gk10.dll__*`, `nlehelper.dll__*`, `deformop.dll__*`, `sicoresdk.dll__CXSITransitionCore__*`.  
Strings: `internal/softimage-pc-dumps/re-exports/*`.  
CapHole ports: `internal/softimage-pc-dumps/model/caphole-compound-ports.json`.

## Tooling notes

- GhidraMCP GUI (`:8080`) down -> **analyzeHeadless** with quoted paths.  
- REA MCP: set `GHIDRA_INSTALL_DIR=C:\Tools\ghidra_12.2_PUBLIC` in `~\.cursor\mcp.json` for next reconnect.  
- Scripts: `Documents\SoftimageGhidra\scripts\DecompFcurveEval*.java`, `DecompAddrs.java`, `DecompNleTransition.java`, `DecompTransitionCore.java`.

## Next (auto-continue)

1. Pin transition curve/weight eval host (`clip_transitioncurves` -> DLL).  
2. Bevel: xref `ComputeBevelVectors` -> DAT_*.  
3. Optional PolyReduce cost rename (A5).  
4. XSIBATCH ASCII only where not LOCK - no Desktop.
