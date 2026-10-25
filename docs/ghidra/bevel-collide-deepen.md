# Bevel collide deepen -- hard-mesh DIFF golden

**Date:** 2026-10-25 (softimage-pc unlock bat)
**Desktop:** FORBIDDEN -- XSIBATCH -processing only.
**Dump:** `internal/softimage-pc-dumps/model/si_bevel_collide_hard.json`
**Script:** `docs/dump-factory/si_bevel_collide_hard_dump.js`
**Prior:** [bevel-dat-xrefs.md](./bevel-dat-xrefs.md), overnight `si_bevel_collide.json` (mesh_equal)

## Verdict

**DUMP_READY / DIFF** -- `any_mesh_diff: true`.

Diverging case: **grid_r08** (dense Grid, all edges, ratio 0.8, units Relative).
managecollisions OFF vs ON yields different topology/points.

Other hard cases (thin box, dense cube, abs units, cube ratio 1.0) remain **mesh_equal** despite managecollisions flip -- LOCK invent for those geometries.

## diff_summary (attested)

| Case | npts off/on | npolys off/on | mesh_equal |
|------|-------------|---------------|------------|
| thin_r09 | 384/384 | 386/386 | true |
| dense_r095 | 864/864 | 866/866 | true |
| cube_abs2 | 216/216 | 218/218 | true |
| **grid_r08** | **288/96** | **285/109** | **false** |
| cube_r10 | 384/384 | 386/386 | true |

grid_r08: nsel=144 edges; managecollisions_off=false, managecollisions_on=true; pts_equal=false, polys_equal=false.

## Ghidra / DAT pins (unchanged deepen)

`mohelper.dll` `C3DLineSegmentBeveler::ComputeBevelVectors` @ `1800b3da0` -- `param_8` gates collide path.
Pinned epsilons (see bevel-dat-xrefs): DAT max-double sentinel, 1e-12, 1e-6, 1e-18.
Collide helpers: `Collide_ComputeAndStoreBevelVector`, `Collide_ComputeAndStoreSegmentCollision`, `Collide_RemoveSegmentAndNextVertexAndReajustTimes`, `GetSegSquaredDistance`.

PE: `internal/softimage-pc-dumps/re-exports/bevel-collide-deepen-pins.json`

## Wire guidance

- Wire collide from **grid_r08** golden only; do not invent behavior for mesh_equal cube cases.
- Full pts/polys for grid_off_r08 / grid_on_r08 in the JSON dump.
- No Softimage binary paste into Direct.

## Direct wire (2026-10-25)

| Piece | Dump-backed rule |
|-------|------------------|
| Absolute Distance | Chamfer width = Distance × 0.125 (grid OFF inset 0.1 for Distance 0.8) |
| Absolute collide reach | Raw Distance SI vs half min-face extent (0.8 clears 0.5 cell) |
| Collide ON | Planar all-edge selection → face-centroid dual (32 border + 64 centers, 109 polys) |
| Collide OFF open border | Keep boundary verts; border-edge far-corner quads + border-vert tris (→ 288/285) |
| Cube hard cases | Non-planar → chamfer path; on/off **mesh_equal** |

Harness: `tools/compare_bevel_collide_hard.mjs` + soft `compare_bevel_collide.mjs`.