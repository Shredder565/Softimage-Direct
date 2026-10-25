# Softimage 2015 SP2 — Ghidra / RE docs

Machine: softimage-pc · Install: `C:\Program Files\Autodesk\Softimage 2015 SP2` · Headless Ghidra preferred (no desktop).  
Clean-room notes only. Softimage binaries are not copied into Softimage Direct.

## Status

Checklist **1–8 closed** — see [checklist-progress.md](./checklist-progress.md).  
Residual RE progress: [../rea-ghidra-residual-progress.md](../rea-ghidra-residual-progress.md) · inventory [../rea-full-clone-residuals.md](../rea-full-clone-residuals.md).

## Residual bridge (full clone)

| Doc | What |
|-----|------|
| [residual-index.md](./residual-index.md) | UI + Model + Animate residual → DLL → wire map |
| [capholeproc-path.md](./capholeproc-path.md) | CapHoleProc → ApplyICEOp Cap Hole + Vertex_Index (no mesh CapHole DLL) |
| [caphole-vertex-index-bind.md](./caphole-vertex-index-bind.md) | Cap Hole.xsicompound `Vertex_Index` username bind (confirmed #54) |
| [fcurve-handled-spline.md](./fcurve-handled-spline.md) | `gk10` GkStdFCurve handled-spline cubic + time→u |
| [mixer-clip-transitions.md](./mixer-clip-transitions.md) | Weight = actionclip.weight + siWeightPresets; prefs display-only |
| [applyflexenv-path.md](./applyflexenv-path.md) | ApplyFlexEnv / autoassignmeth 0=Distance 1=Normal |
| [flexenv-headless-lock.md](./flexenv-headless-lock.md) | ApplyFlexEnv XSIBATCH `-processing` gap + Mode args |
| [getenabled-callpath.md](./getenabled-callpath.md) | SR-28 CommandCore GetEnabled vs MCP grey |
| [getenabled-deepen.md](./getenabled-deepen.md) | CanBeModified gate; HWND matrix LOCK |
| [bevel-dat-xrefs.md](./bevel-dat-xrefs.md) | ComputeBevelVectors DAT_* pins (docs until collide golden) |
| [polyreduce-rename-map.md](./polyreduce-rename-map.md) | Optional topologyop FUN renames (docs unless DIFF) |
| [ui-lock-binary-pins.md](./ui-lock-binary-pins.md) | UI LOCK C2–C6 / A3 binary string pins |

## Checklist / prior RE

| Doc | What |
|-----|------|
| [checklist-progress.md](./checklist-progress.md) | Upload checklist items 1–8 + residual pass |
| [polyreduce-impl.md](./polyreduce-impl.md) | PolyReduce CLSID→Update→mesh-eval pin |
| [polyreduce-vs-direct.md](./polyreduce-vs-direct.md) | Decomp vs Direct `reduceQuadric` |
| [bevel-vs-direct.md](./bevel-vs-direct.md) | `C3DLineSegmentBeveler` vs Direct `bevelEdges` |
| [rea-notes.md](./rea-notes.md) | SPDL↔CLSID↔DLL registration |
| [notes.md](./notes.md) | Working notes |
| [dll-priority.md](./dll-priority.md) | P0/P1 import order |
| [ghidra-pc-install.md](./ghidra-pc-install.md) | Ghidra 12.2 / Java paths on this PC |

## Artifacts (`internal/ghidra/`)

| Path | What |
|------|------|
| `decomp/` | Headless C dumps (incl. `gk10.dll__*`, `nlehelper.dll__*`, `deformop.dll__*`) |
| `bin-listing.txt` / `strings-*.txt` | Listing + string hunts |
| `../softimage-pc-dumps/re-exports/` | Anim DLL string extracts |

Live Ghidra project: `Documents\SoftimageGhidra\Softimage2015SP2`.

## Hard rules

- No Softimage Desktop mouse/keyboard takeover.
- No Softimage source/binary paste into Direct.
- Wire only dump- or Ghidra-attested behavior.
