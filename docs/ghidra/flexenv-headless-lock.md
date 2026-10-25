# ApplyFlexEnv — weights + Mode wire note

## WIRE — Softimage weight table via VBArray (Desktop 2026-10-25)

| Evidence | Result |
|----------|--------|
| XSIBATCH `-processing` | ApplyFlexEnv cancelled / runtime fail |
| Overnight first pass | ApplyFlexEnv all attempts failed; envelope null |
| Desktop deep | Apply OK + `EnvelopeWeight`; element reads null |
| Desktop pass4 | `Weights.Array` probed but JS null cells |
| **Desktop VBArray** `si_flexenv_weights.json` | **`apply.ok=true`**; deformers `[root,bone,eff]`; **`VBArray` Bounds** 3×32; **`weight_table` numeric** (e.g. `[0,100,0]` = 100% on bone); `acceptance.has_nonzero=true` |

Softimage `envelopop.Weights.Array` is a 2D VBArray (deformer × point) with **percentage** weights (sum ≈ **100** per point). Direct `envelopop.weights` stay **unit-normalized** (sum ≈ **1**). Do **not** invent Softimage tables — consume the dump golden.

Dump path: `data/dump/si_flexenv_weights.json`.

## WIRE — Mode / DistanceWeighting (SPDL attested)

Softimage `C3DEnvelopeAutoAssignOp2.spdl` **`autoassignmeth`**: **0 = Distance-based**, **1 = Normal-based** (default **1**).

| Arg | Direct | Softimage-faithful note |
|-----|--------|-------------------------|
| ConnectionSet / DeformerSet | Yes | Mesh + deformers selection |
| Mode | Default **1** (Normal); **0** → Distance | Maps to `envelopop.weighting` 1 / 0 |
| DistanceWeighting | Truthy → force distance `weighting=0` | Overrides Mode → autoassignmeth 0 |
| canRun | Mesh + deformers selected | GetEnabled-style grey when incomplete selection |

## Acceptance

- Softimage VBArray weight golden cited; `compare_envelope_shape` asserts numeric rows + Direct unit sum.
- No fake Softimage weight files.
- Scale note: Softimage % vs Direct 0–1 — compare schemas, not raw cell equality across engines.
