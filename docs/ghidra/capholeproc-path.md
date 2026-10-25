# CapHoleProc path (Softimage 2015 SP2) — RE note

Clean-room. Evidence from headless file scrape + model goldens (no Desktop).

## Softimage surface

Mesh **Cap Hole** is **not** an SPDL PPG operator:

| Check | Result |
|-------|--------|
| `CapHole*.spdl` / `capholeop.spdl` | Absent (989-file SPDL index) |
| Nearby `capop` / `fillHoleOp` | NURBS fill/cap; `has_layout: false`; wrong family |
| Compound | `Data/Compounds/Topology/Modifiers/Cap Hole.xsicompound` |
| Command | `Application/DSScripts/operators.vbs` → `CapHoleProc` |
| PE RT_DIALOG / RT_BITMAP CapHole | None; `toolbarobj.dll` utf16 "Cap Hole" string only |

## CapHoleProc (attested flow)

```
SIFilter(in_objects, siSubComponentFilter)
  → if pntSubComponent: vtx = points(0).Index, objName = FullName
  → else PickElement siPointFilter (interactive — cancelled under -processing)
ApplyICEOp("Cap Hole", objName)  → Cap_Hole:ICETree
capOp = iceTree.InputPorts(0).ConnectedNodes(0)
inputPorts("Vertex_Index").Parameters(0).Value = vtx
```

Headless model dump recipe (faithful substitute for PickElement):

1. `ApplyTopoOp` DeleteComponent (open a hole).
2. `ApplyICEOp("Cap Hole")` → attach Cap_Hole ICETree.
3. `SetValue(...Cap_Hole.Vertex_Index, 0)` (border vertex).

PC goldens: CapHole after Delete → **56 pts / 54 polys** (`Cap_Hole:ICETree`).

## Direct fidelity target

| Softimage | Direct (before) | Direct (target) |
|-----------|-----------------|-----------------|
| CapHoleProc → ApplyICEOp | `CapHole` → `ApplyTopoOp` → `TopologyOperator2` | `CapHole` → `ApplyICEOp("Cap Hole")` + `Vertex_Index` |
| Cap_Hole:ICETree | Topology op on stack | `ICETreeOperator` named `Cap_Hole` |
| Topology via ICE compound | `T2.capHoles` inside TopologyOperator2 | Same `T2.capHoles` inside Cap_Hole ICETree apply (Vertex_Index → point sel) |
| No SPDL Layout PPG | (correct absence) | Keep no CapHole PPG Layout |

**Do not** invent CapHole SPDL Layout (LOCK — corroboration pack).

## Ghidra follow-up (softimage-pc)

- String/xref `Vertex_Index` / `Cap Hole` in ICE host (`iceflow.dll` / compound runtime).
- Confirm Cap_Hole compound does border-loop cap from seed vertex (matches Direct `capHoles` selection filter).

## Acceptance

- `compare_model_ops` CapHole_SI_* green.
- CapHole command leaves Cap_Hole ICETree with `Vertex_Index` param.
- `ApplyTopoOp` preset `Cap Hole` may remain for menu ApplyTopoOp path.
