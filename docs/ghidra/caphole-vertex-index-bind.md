# Cap Hole — `Vertex_Index` bind (compound)

**Date:** 2026-10-24  
**Prior path:** [capholeproc-path.md](./capholeproc-path.md)  
**JSON:** softimage-pc `internal/softimage-pc-dumps/model/caphole-vertex-index-bind.json`

## Softimage bind (attested)

`CapHoleProc` (`operators.vbs`):

```
Set iceTree = ApplyICEOp("Cap Hole", objName)
Set capOp = iceTree.InputPorts(0).ConnectedNodes(0)
inputPorts("Vertex_Index").Parameters(0).Value = vtx
```

## Compound exposure (`Cap Hole.xsicompound`)

| Field | Value |
|-------|-------|
| Exposed port `username` | **`Vertex_Index`** |
| `basename` / `portlabel` | `Vertex Index` |
| `exposetype` | `single` |
| `portname` | `in` (index 3) |
| UI item | `<item type="input" name="Vertex_Index">` |

Internal graph uses **`First_Vertex_Index`** portdef + border traversal. CapHoleProc’s `Vertex_Index` is the **seed border vertex** — not a mesh CapHoleProc DLL param.

## Direct (#54) — confirmed

| Softimage | Direct |
|-----------|--------|
| ApplyICEOp("Cap Hole") | `CapHole` → `ApplyICEOp` File=`Cap Hole` → `Cap_Hole` ICETree |
| `Vertex_Index` username | `ICETreeOperator` param **`Vertex_Index`** (`src/core/ice.ts`) |
| CapHoleProc sets seed | `model.ts` CapHole sets `Vertex_Index` from border/selection |

Port name matches compound dump. Do not invent SPDL PPG Layout (LOCK A2). No TS change required on this pass.

## Binary

No `Vertex_Index` / Cap Hole evaluator in `Application\bin\*.dll` beyond menu utf16. Algorithm = ICE compound only.
