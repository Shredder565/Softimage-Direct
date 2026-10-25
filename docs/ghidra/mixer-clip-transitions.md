# Mixer clip transitions — RE note

**Date:** 2026-10-24 (updated 2026-10-25)  
**Mode:** Headless Ghidra + SPDL/SDK. No Softimage Desktop.

## Softimage surface

| Asset | Evidence |
|-------|----------|
| Prefs SPDL | `C3DPrefsAnimationMixer.spdl` — `clip_transition`, `clip_transitioncurves`, `clip_weightcurves`, `clip_timewarp` |
| Mixer UI DLL | `animationmixer.dll` |
| Create task | **`nlehelper.dll!SINleCreateTransitionTask`** @ `180008870` |
| OM | `sicoresdk` `CXSITransitionCore` (GetStart/EndClip, GetTime, …) |
| Bridge script | `action.vbs` `AddBridgeTransitionFunc` → **`AddTWTransition`** (timewarp; works with FCurves) |
| PC dump | `si_anim_mixer_deep.json` — nest OK; transitions often empty under XSIBATCH (LOCK B2) |
| Overnight | `si_mixer_transitions.json` (2026-10-25) — StoreAction null; SelectClips fewer than 2 clips; `TransitionCollection` classname attested empty; Auto Transition default false; Bridge/TW “no command” under XSIBATCH |

## Critical: `clip_transitioncurves` / `clip_weightcurves` are **display**, not eval math

SPDL: Parameter `"clip_transitioncurves"` — **"Displays the transition curves for the clip"** — `VT_BOOL` default True.  
Same family: `clip_weightcurves` displays weight curves only.

Ghidra: `animationmixer.dll` UTF-16 prefs xrefs only prefs-load / UI bitflag helpers (`FUN_18001eda0` etc.).

**Do not** treat these prefs keys as Softimage switches for weight math — they toggle mixer chrome drawing only.

## Create path (binary)

```
SINleCreateTransitionTask(I3DClip *from, I3DClip *to, ulong kind, I3DTransition **out)
```

- `kind == 2` vs other → Bridge vs standard CLSID.
- `CXSITransitionCore` = OM accessors only (no weight formula).

## Weight / curve eval — Softimage-attested host

| Claim | Status |
|-------|--------|
| Prefs `clip_transitioncurves` = eval host | **False** (display bits only) |
| Weight math in `CXSITransitionCore` | **Absent** (OM only) |
| **Clip mix weight** | FCurve on **`clip.actionclip.weight`** |
| Eval engine | **`gk10` `GkStdFCurve`** ([fcurve-handled-spline.md](./fcurve-handled-spline.md)) |
| Presets | `action.vbs` `ModifyWeightProc` / `siWeightPresets` → Direct `SetDefaultWeight` |
| Bridge | → `AddTWTransition` (timewarp + FCurves) |
| PC dump of live transition weights | **LOCK** without clip selection (B2) |

### `ModifyWeightProc` preset → keys (WIRE)

From `Application\DSScripts\action.vbs`:

| Preset | Keys (frame, value) | `SetCurveType` (gk10 FSKind) |
|--------|---------------------|------------------------------|
| `siWeightEaseIn` | lower→0, upper-1→1 | **3** (spline) |
| `siWeightEaseOut` | lower→1, upper-1→0 | **3** |
| `siWeightLinearEaseIn` | lower→0, upper-1→1 | **2** (linear) |
| `siWeightLinearEaseOut` | lower→1, upper-1→0 | **2** |
| `siWeightGaussian` | ends 0, mid 1 | **3** |
| `siWeightGaussianReverse` | ends 1, mid 0 | **3** |
| `siWeightSquare` / Reverse | step keys | **1** (constant) |
| `siWeightConstant` | flat at Extra | **1** |
| Exponential In/Out | **NOT IMPLEMENTED** in Softimage VBS — **LOCK** |

Direct maps SetCurveType 1/2/3 → siInterpolation 0/1/3 when storing keys (`buildWeightPresetKeys` / `mapSetCurveTypeToInterp` in `src/core/mixer.ts`).

## Direct wire (landed)

- Transition create + Auto Transition + Hermite crossfade window (`transitionEase`) when overlapping weight FCurves are absent.
- `SetDefaultWeight` / `ModifyWeight` write `MixerClip.weightKeys` (actionclip.weight).
- `clipWeightsAt` samples weight FCurve via Direct `FCurve` (gk10-faithful hermite/linear/const).
- `SetClipWeight` sets scalar and clears weight keys.

## Acceptance

- `compare_mixer` nest + EaseIn preset + Exponential LOCK stay OK.
- No invent Softimage OM Transitions from null PC dumps.
- Chrome prefs may drive curve glyph drawing — not the blend formula.
