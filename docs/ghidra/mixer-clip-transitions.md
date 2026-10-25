# Mixer clip transitions — RE note

## Softimage surface

| Asset | Evidence |
|-------|----------|
| Prefs / propset | `animation_mixer.clip_transition`, `clip_transitioncurves`, `clip_timewarp`, `clip_weightcurves` (propsets + `animationmixer.dll` UTF-16 strings) |
| DLL | `Application/bin/animationmixer.dll` — `CAnimMixerOpenGLClientWnd`, `AnimMixerTimeLine`, prefs keys |
| OM cmds | `AddTransition`, `AddBridgeTransition`, `AddTWTransition`, mixer `autotransition` |
| PC dump | `si_anim_mixer_deep.json`: nest Name/Hidden/Active/Start/Duration OK; **transitions often empty** without clip selection under XSIBATCH |

## Headless LOCK (PC dump only)

Softimage cannot populate mixer Transitions collections under `-processing` without interactive clip selection (dump steps: StoreAction null handles; AddBridgeTransition fail; mixer_collections null). **Direct implements transitions;** PC gap is dump-only LOCK.

## Direct today

- `src/core/mixer.ts` `clipWeightsAt`: standard/bridge linear crossfade over `length` ending at destination start; timewarp stretches `from` local time and fades.
- Commands in `src/commands/anim.ts`: AddTransition / Bridge / TW / CreateCompound / EqualizeClips.
- Harness `compare_mixer.mjs` locks nested schema + mid-crossfade blend.

## Proposed Softimage-faithful deltas (WIRE)

1. **Transition curves** — Softimage default `clip_transitioncurves=true` implies non-linear fade. Until animationmixer decomp names the exact curve, use Hermite smoothstep `u*u*(3-2*u)` for standard/bridge (preserves mid-blend harness band). Replace with decomp formula when softimage-pc lands it.
2. **Timewarp** — keep stretch of `from` into transition window; pin against future PC samples.
3. **Auto Transition** — when mixer `autotransition` is true, adding a clip after another inserts a standard transition (Softimage mixer flag).
4. **Bridge vs standard** — both use eased crossfade until decomp proves bridge-specific weight path; keep `kind` discriminant for OM fidelity.

## Ghidra entry (softimage-pc)

1. Import `animationmixer.dll`.
2. Xrefs to UTF-16 `clip_transition` / `clip_transitioncurves` / `AddTransition`.
3. Decompile weight-at-time / timewarp helpers; paste notes under Project `internal/ghidra/decomp/`.

## Acceptance

- `compare_mixer` stays OK.
- No invent Softimage transition OM from null PC dumps.
