# ApplyFlexEnv — headless LOCK + Mode wire note

## LOCK — Softimage weight goldens under XSIBATCH

| Evidence | Result |
|----------|--------|
| `si_anim_envelope_shape_dump.js` → `si_anim_envelope_shape.json` | Shape StoreShapeKey OK |
| ApplyFlexEnv | **Cancelled** under `XSIBATCH -processing` |
| anim-dump-summary | Lists "ApplyFlexEnv weights under -processing" as remaining gap |

**Proof class:** Softimage-impossible headless weight capture (command cancel). Do **not** invent Softimage envelope weight tables. Direct `compare_envelope_shape` validates Direct fixture (weight sum 1, normalize, mirror, RemoveFlexEnvDeformer).

Optional unlock: user Script Editor paste / non-`-processing` attested dump only — no Desktop agent takeover.

## WIRE — Mode / DistanceWeighting (SPDL attested)

Softimage `C3DEnvelopeAutoAssignOp2.spdl` **`autoassignmeth`**: **0 = Distance-based**, **1 = Normal-based** (default **1**).

| Arg | Direct | Softimage-faithful note |
|-----|--------|-------------------------|
| ConnectionSet / DeformerSet | Yes | Mesh + deformers selection |
| Mode | Default **1** (Normal); **0** → Distance | Maps to `envelopop.weighting` 1 / 0 |
| DistanceWeighting | Truthy → force distance `weighting=0` | Overrides Mode → autoassignmeth 0 |
| canRun | Mesh + deformers selected | GetEnabled-style grey when incomplete selection |

## Acceptance

- LOCK documented with dump citation.
- Direct envelope harness remains green (`compare_envelope_shape`).
- No fake Softimage weight golden files.
