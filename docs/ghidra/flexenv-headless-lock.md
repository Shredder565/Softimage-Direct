# ApplyFlexEnv — headless LOCK + Mode wire note

## LOCK — Softimage weight goldens under XSIBATCH

| Evidence | Result |
|----------|--------|
| `si_anim_envelope_shape_dump.js` → `si_anim_envelope_shape.json` | Shape StoreShapeKey OK |
| ApplyFlexEnv | **Cancelled** under `XSIBATCH -processing` |
| anim-dump-summary | Lists "ApplyFlexEnv weights under -processing" as remaining gap |

**Proof class:** Softimage-impossible headless weight capture (command cancel). Do **not** invent Softimage envelope weight tables. Direct `compare_envelope_shape` validates Direct fixture (weight sum 1, normalize, mirror, RemoveFlexEnvDeformer).

Optional unlock: user Script Editor paste / non-`-processing` attested dump only — no Desktop agent takeover.

## WIRE — Mode / DistanceWeighting surface (landed)

Softimage `ApplyFlexEnv` args in Direct (`src/commands/rigging.ts`):

| Arg | Direct | Softimage-faithful note |
|-----|--------|-------------------------|
| ConnectionSet / DeformerSet | Yes | Mesh + deformers selection |
| Mode | Default **2** (automatic/assign); `1` → alternate `weighting=1` | Enum labels still soft until SPDL/cmd dump names land |
| DistanceWeighting | Truthy → force distance `weighting=0` (overrides Mode) | Softimage parallel switch |
| canRun | Mesh + deformers selected | GetEnabled-style grey when incomplete selection |

Ghidra follow-up: string hunt `ApplyFlexEnv` / `envelopop` / weight assign in deform DLLs; pin Mode constants to Softimage enum names.

## Acceptance

- LOCK documented with dump citation.
- Direct envelope harness remains green (`compare_envelope_shape`).
- No fake Softimage weight golden files.
