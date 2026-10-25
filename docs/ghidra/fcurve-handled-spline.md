# Fcurve handled-spline - GkStdFCurve formula (gk10.dll)

**Date:** 2026-10-24 (softimage-pc residual RE)  
**DLL:** `Application\bin\gk10.dll` (primary). `fcurve.dll` is Softimage task/OM glue (`F3DGetFCurve`, keying layers) and imports **gk10**.  
**Ghidra project:** `Documents\SoftimageGhidra\Softimage2015SP2` - programs `gk10.dll`, `fcurve.dll` imported.  
**Decomps:** `internal/ghidra/decomp/gk10.dll__*` / `gk10.dll__deep__*` / `gk10.dll__core__*`.

Harness [#48](https://github.com/Shredder565/Softimage-Direct/pull/48) already green vs `si_anim_fcurve_eval_golden.json`. This note **confirms** the Softimage binary formula for Left/Right handled spline so residuals stay locked.

## Entry points

| Symbol | VA | Role |
|--------|-----|------|
| `GkStdFCurve::EvalNoLock` | `180049720` | Unlocked eval -> segment core |
| `GkStdFCurve::EvalLeft` | `1800492f0` | Left-continuity eval (uses `FUN_1800493a0`) |
| `FUN_180049870` | `180049870` | Segment dispatcher by curve mode / FSKind |
| `FUN_180020a30` | `180020a30` | **Per-segment value eval** (const/linear/spline) |
| `FUN_180021f90` | `180021f90` | **Time -> Bezier parameter u** (solve X(u)=t) |
| `FUN_180021750` | `180021750` | Right-handle **value** (Y) for key |
| `FUN_180021490` | `180021490` | Left-handle **value** (Y) for key |
| `GetActualKeyTgtHandle` | `18004bcb0` | OM handle as ? from key (KeySide) |
| `GetEvaluatedKeyTgtHandle` | `18004c100` | Evaluated/auto handles |

Mangled `?Eval@GkStdFCurve@@UEBANNH@Z` shares address with boolean Eval thunk in listing; **runtime path for Std is EvalNoLock -> FUN_180049870 -> FUN_180020a30**.

## Key record (stride `0x40`)

| Offset | Field (inferred) |
|--------|------------------|
| `+0x00`,`+0x08` | Left handle abs `(time, value)` |
| `+0x10`,`+0x18` | Right handle abs `(time, value)` |
| `+0x20` | Key **time** |
| `+0x28` | Key **LeftValue** (segment end uses next key?s LeftValue) |
| `+0x30` | Key **RightValue** / value (segment start uses current RightValue) |
| `+0x38` | `FSKind` (segment kind) `char` |
| `+0x3a` | Flags `ushort` (`0x100` flat/locked, `0x1000` auto, `0x20`/`0x40`/`0x400`/`0x80` ?) |

**KeySide:** `param_2 == 1` -> Left (vs key `(+0x20,+0x28)`); else Right (vs `(+0x20,+0x30)`). Matches Softimage OM Left/Right absolute values when converted.

## Segment kinds (`FUN_180020a30`, kind at `key+0x38`)

| Kind | Behaviour |
|------|-----------|
| `1` | Constant -> current `+0x30` |
| `2` | Linear lerp time->value between current `+0x30` and next `+0x28` |
| `3` | **Spline / cubic Bezier** (handled) - below |
| else | `0.0` |

## Handled spline (kind `3`) - formula to wire/verify

Constants from `.rdata`:

| VA | Value | Use |
|----|-------|-----|
| `DAT_1800e0990` | **3.0** | Bezier control scale |
| `DAT_1800e0968` | **1/3** | Auto-handle time placement |
| `DAT_1800e0980` | 1.0 | |
| `DAT_1800e0988` | 2.0 | |
| `DAT_1800e0970` | 0.5 | Newton-ish parameter solve |
| `DAT_1800e0a98` | 1e-20 | edge eps |
| `DAT_1800e0aa0` | 1e-9 | solve tol |
| `DAT_1800e2e28` | 1e-12 | key-lookup eps |
| `DAT_1800e09b0` | `0x7fffffffffffffff` | abs bitmask (not a float) |

### 1) Map frame time -> Bezier parameter `u ? [0,1]`

```
u = FUN_180021f90(t, t0, rightHandleTime_i, leftHandleTime_{i+1}, t1)
```

Solves cubic Bezier in **time** (X) so Softimage frames are **not** uniform-in-`u` unless handles are default.

### 2) Evaluate value with same `u`

```
P0 = key[i].RightValue          // +0x30
P1 = RightHandleY(key[i])       // FUN_180021750
P2 = LeftHandleY(key[i+1])      // FUN_180021490
P3 = key[i+1].LeftValue         // +0x28

A = 3 * (P1 - P0)
B = 3 * (P2 - P1)
Y = ((((P3 - P0) - B) * u + B) - A) * u + A) * u + P0
```

Standard cubic Bezier Horner form. Matches dump note: **mid-segment samples use next-key Left; exact keys use Value**.

### 3) Handle getters (flags)

- Flat / special flags (`0x100`, `0x20`, ?) -> clamp handle Y to key Left/Right value.
- Auto (`0x1000`) -> slope from neighbours x length helpers (`FUN_180020cb0`, `FUN_1800216c0`/`021400`).
- Else raw stored handle Y at `+0x18` (right) / `+0x08` (left).

## Softimage Direct

Harness [#48](https://github.com/Shredder565/Softimage-Direct/pull/48) / `compare_fcurves` stays green on dense handled cases vs PC goldens. Direct `FCurve.hermite` already targets **next-key Left** as segment end and key.Value at exact times - matching dump/RE note. Softimage binary path is cubic Bezier with non-uniform time->u (`FUN_180021f90`); treat formula as **confirmed** - no invent rewrite while goldens stay OK. Residual DIFF on new cases -> re-check time-parameter solve, not linear `u=(t-t0)/(t1-t0)`.

## Related dumps

- `internal/softimage-pc-dumps/anim/si_anim_fcurve_eval_golden.json`
- `internal/softimage-pc-dumps/re-exports/gk10-eval-symbols.txt`
