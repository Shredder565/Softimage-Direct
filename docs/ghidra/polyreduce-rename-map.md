# PolyReduce — optional FUN rename map (A5)

**Date:** 2026-10-24  
**DLL:** `topologyop.dll`  
**Prior:** softimage-pc polyreduce-impl — mesh-eval pin already accepted; harness green.

Heuristic labels only (no demangled QEM symbols). Safe for Ghidra bookmarks; **not** required for Direct wire unless a new DIFF appears.

| Address | Suggested name | Role |
|---------|----------------|------|
| `FUN_18007e570` | `PolyReduce_MeshEvaluate` | Graph eval entry |
| `FUN_18006d420` | `PolyReduce_MeshDriver` | Dispatches reduce helpers |
| `FUN_18006e220` | `PolyReduce_MainLoop` | Primary reducer |
| `FUN_18006cf80` | `PolyReduce_EdgePairCost` | Cost / interp over verts |
| `FUN_180075620` | `PolyReduce_ProcessCandidate` | Per-edge candidate |
| `FUN_180074150` | `PolyReduce_CollapseMark` | Bitset / collapse marks |
| `FUN_1800615b0` | `PolyReduce_AttrSetup` | Attribute path into reduce |
| `FUN_180073a90` | `PolyReduce_PostCollapseReport` | `CDelayedTopoReport` / rename |

**Wire:** none unless Softimage Direct `reduceQuadric` DIFF vs new PC golden.

## Optional push #2 exit (2026-10-25)

| Check | Result |
|-------|--------|
| `node tools/compare_topology.mjs` → `PolyReduction` | **OK** (pts/polys match `si_topo_ref.json`) |
| softimage-pc `docs/ghidra/polyreduce-diff.md` | **absent** — no DIFF attestation |

**Exit: NO_DIFF / LOCK.** No invent PolyReduce PR. Reopen only on a real Softimage vs Direct DIFF golden.
