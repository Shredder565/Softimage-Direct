# ApplyFlexEnv — headless LOCK + Mode wire note

## LOCK — Softimage weight *table* still unreadable

| Evidence | Result |
|----------|--------|
| `si_anim_envelope_shape_dump.js` → `si_anim_envelope_shape.json` | Shape StoreShapeKey OK |
| ApplyFlexEnv under `XSIBATCH -processing` | **Cancelled** / runtime fail |
| Overnight first pass `si_flexenv_weights.json` | Softimage 13.2.163.0; **ApplyFlexEnv all 7 attempts failed**; envelope null |
| **Desktop deep** `si_flexenv_weights.json` (2026-10-25) | **`apply.ok=true`** → `…Envelope_Weights.autoenvassign`; classname **`EnvelopeWeight`**; `envelopop` present; deformers `[bone]`; **`weight_table` 32 rows all `weights:null`** (COM: String expected / no method / Invalid procedure / Value undefined) |

**Proof class:** Softimage Desktop can **create** the envelope (`ApplyFlexEnv` OK) but scripted weight-element reads remain Softimage-impossible with the probed APIs. Do **not** invent Softimage envelope weight tables. Direct `compare_envelope_shape` validates Direct fixture (weight sum 1, normalize, mirror, RemoveFlexEnvDeformer). Dump path: `data/dump/si_flexenv_weights.json`.

Optional unlock: Softimage-attested weight-element dump API (Elements/GetValue path that returns arrays) before 2026-10-25 09:00 ET Desktop window ends.

## WIRE — Mode / DistanceWeighting (SPDL attested)

Softimage `C3DEnvelopeAutoAssignOp2.spdl` **`autoassignmeth`**: **0 = Distance-based**, **1 = Normal-based** (default **1**).

| Arg | Direct | Softimage-faithful note |
|-----|--------|-------------------------|
| ConnectionSet / DeformerSet | Yes | Mesh + deformers selection |
| Mode | Default **1** (Normal); **0** → Distance | Maps to `envelopop.weighting` 1 / 0 |
| DistanceWeighting | Truthy → force distance `weighting=0` | Overrides Mode → autoassignmeth 0 |
| canRun | Mesh + deformers selected | GetEnabled-style grey when incomplete selection |

## Acceptance

- LOCK documented with Desktop-deep dump citation (Apply OK / weights null).
- Direct envelope harness remains green (`compare_envelope_shape`).
- No fake Softimage weight golden files.
