# ApplyFlexEnv — headless LOCK + Mode wire note

## LOCK — Softimage weight goldens under XSIBATCH

| Evidence | Result |
|----------|--------|
| `si_anim_envelope_shape_dump.js` → `si_anim_envelope_shape.json` | Shape StoreShapeKey OK |
| ApplyFlexEnv | **Cancelled** under `XSIBATCH -processing` |
| anim-dump-summary | Lists "ApplyFlexEnv weights under -processing" as remaining gap |

**Proof class:** Softimage-impossible headless weight capture (command cancel). Do **not** invent Softimage envelope weight tables. Direct `compare_envelope_shape` validates Direct fixture (weight sum 1, normalize, mirror, RemoveFlexEnvDeformer).

Optional unlock: user Script Editor paste / non-`-processing` attested dump only — no Desktop agent takeover.

## WIRE — Mode / DistanceWeighting surface

Softimage `ApplyFlexEnv` args used by Direct (`src/commands/rigging.ts`):

| Arg | Direct | Softimage-faithful note |
|-----|--------|-------------------------|
| ConnectionSet / DeformerSet | Yes | Mesh + deformers selection |
| Mode | Default 2; maps weighting when DistanceWeighting unset | Lock enum labels when SPDL/cmd dump names land |
| DistanceWeighting | Forces distance weighting when truthy | Keep as Softimage parallel switch |

Ghidra follow-up: string hunt `ApplyFlexEnv` / `envelopop` / weight assign in deform DLLs; pin Mode constants.

## Acceptance

- LOCK documented with dump citation.
- Direct envelope harness remains green.
- No fake Softimage weight golden files.
