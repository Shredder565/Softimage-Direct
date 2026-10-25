# Mixer clip transitions - RE note

**Date:** 2026-10-24 (softimage-pc residual RE)  
**Mode:** Headless Ghidra import/decomp + string hunt. No Softimage Desktop.

## Softimage surface

| Asset | Evidence |
|-------|----------|
| Prefs / propset | `animation_mixer.clip_transition`, `clip_transitioncurves`, `clip_timewarp`, `clip_weightcurve` |
| Mixer UI DLL | `Application\bin\animationmixer.dll` - `CAnimMixerOpenGLClientWnd`, prefs keys |
| OM cmds | `AddTransition`, `AddBridgeTransition`, `AddTWTransition`, mixer `autotransition` |
| PC dump | `si_anim_mixer_deep.json`: nest names OK; **transitions often empty** without clip selection under XSIBATCH |

## Headless LOCK (PC dump only)

Softimage cannot populate mixer Transitions collections under `-processing` without interactive clip selection (StoreAction null; AddBridgeTransition fails). **Direct implements transitions**; PC gap is dump-only LOCK (residuals B2).

## Create transition (binary) - RE proven

| DLL | Symbol | VA |
|-----|--------|-----|
| **`nlehelper.dll`** | `SINleCreateTransitionTask` | `180008870` |

```
SINleCreateTransitionTask(I3DClip *from, I3DClip *to, ulong kind, I3DTransition **out)
```

- `kind == 2` -> one CLSID path; else alternate - Bridge vs standard class (which number is Bridge not yet named).
- Builds exec context, packs clips, sets "From" + second clip, creates transition object.

Decomp: `internal/ghidra/decomp/nlehelper.dll__SINleCreateTransitionTask.c`  
`animationmixer.dll` **imports** this task (does not own create math).

## Direct wire (landed)

- `AddTransition` / `AddBridgeTransition` / `AddTWTransition` keep `kind` discriminant (`standard` / `bridge` / `timewarp`) matching Softimage OM surface until `kind==2` is named.
- Mixer `autotransition`: `AddClip` inserts a standard transition when flag is on (same track).
- `CXSITransitionCore` = OM shell only - **no** weight/curve eval there.

## Weight / curve eval - still open

Prefs imply non-linear fades when `clip_transitioncurves` is on. Direct: Hermite smoothstep (`transitionEase` in `src/core/mixer.ts`) until Softimage formula pinned.

**Next RE:** string-xref `clip_transitioncurves` / transition weight fcurve host (action / gap / mixer eval DLL) - not TransitionCore. Do not invent Softimage curve math.

## Acceptance

- `compare_mixer` stays OK.
- No invent Softimage transition OM from null PC dumps.
- Replace ease with Softimage formula only when decomp lands.
