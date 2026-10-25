# Bevel `ComputeBevelVectors` → DAT_* xrefs (`mohelper.dll`)

**Date:** 2026-10-24 (softimage-pc residual RE)  
**Entry:** `C3DLineSegmentBeveler::ComputeBevelVectors` @ `1800b3da0`  
**Prior:** [bevel-dat-candidates.md](./bevel-dat-candidates.md)

## Pinned constants (instruction xrefs)

| VA | Value | Role |
|----|-------|------|
| `DAT_1801639f8` | ≈ max double | Infinite-distance sentinel (skip / one-sided) |
| `DAT_1801639e8` | 1.0 | Unit scale |
| `DAT_180168380` | 1e-12 | Geometry epsilon |
| `DAT_180168230` | abs mask | `fabs` via AND |
| `DAT_18016ffc0` | 1.000000000001 | Slight >1 threshold |
| `DAT_180168220` | 1e-6 | Collide eps |
| `DAT_18016ffb8` | 1e-18 | Tiny eps (collide store) |
| `DAT_18016ffc8` | 1.000000001 | Slight >1 (collide) |
| `DAT_18016f040` | -0.0 | Signed zero |

## Wire guidance (A4)

- Default-cube harness already green — **no invent collide** without a PC golden that sets `managecollisions`.
- If wiring collide later: use **1e-12** / **1e-6** / **1e-18** and **max-double sentinel** as attested.
- Docs only until managecollisions golden.
