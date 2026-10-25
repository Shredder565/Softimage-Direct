# Bevel DAT_* candidates (`mohelper.dll`)

**Date:** 2026-10-24  
**For:** residual A4 (collide / constrained bevel) - blocked until harness case + xref pins.  
**Dump:** `internal/softimage-pc-dumps/re-exports/mohelper-bevel-dat-candidates.txt`

## Method

PE `.rdata` scan of `mohelper.dll` for double constants in epsilon / unit ranges (not yet xref-tied to `C3DLineSegmentBeveler::ComputeBevelVectors`).

## Notable candidates (VA -> value)

| VA | Value | Likely role |
|----|-------|-------------|
| `18015c280` | `1e-12` | geometry eps |
| `18015c288` | `1e-9` | |
| `18015c290` | `1e-6` | |
| `18015c298` | `0.001` | |
| `18016ef78` | `1e-5` | |
| `18016ef80` | `0.0001` | |
| `18016bf68` | `0.5` | |
| `18016efe8` / `eff0` | `2.0` / `3.0` | scale-like |
| `180174d78` | `0.005555?` (= `1/180`) | degree?radian hint |

Full list: 120 unique candidates in the dump file.

## Next

Headless Ghidra: xrefs from `ComputeBevelVectors` (`~1800b3da0` per prior notes) to these DAT_* addresses; keep only collide-path loads. Do not invent Direct collide behaviour without a PC golden.
