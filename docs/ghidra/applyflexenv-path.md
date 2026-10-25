# ApplyFlexEnv / envelopop path

**Date:** 2026-10-24 (updated 2026-10-25 SPDL Mode lock)  
**Mode:** VBS + SPDL + string/Ghidra on `deformop.dll`. No Softimage Desktop.  
**XSIBATCH:** ApplyFlexEnv **cancelled** under `-processing`. **Desktop VBArray:** ApplyFlexEnv **OK** + numeric `Weights.Array` (Softimage % scale) — see [flexenv-headless-lock.md](./flexenv-headless-lock.md).

## Script / command path

`Application\DSScripts\operators.vbs`

| Function | Role |
|----------|------|
| `ApplyFlexibleEnvelopeProc` / `ApplyFlexibleEnvelopeFunc` | UI entry; may pop AssignNew dialog |
| Detect existing envelope | `ActivePrimitive.ConstructionHistory.Find("envelopop")` |
| Apply | `FApplySelectedOp(connectionset, TRUE, AssignNew, 1, ConstructionMode)` |
| Inspect | `AutoInspect MyFlexEnv` (GUI — skipped headless) |

## Operator registration

| Asset | Detail |
|-------|--------|
| SPDL | `Application\spdl\C3DEnvelopOp.spdl` |
| Parameter | `"envelopop"` |
| CLSID | `{470CF890-D3AA-11d0-996C-00A0243F0E60}` |
| Include | `C3DDeform.spdl` |
| Binary host | **`deformop.dll`** |

Related: `C3DEnvelopeAutoAssignOp(.2)`, smooth/lock/limit weight SPDLs, `c3denvelopeweightprop.spdl`.

## Assignment method (Mode / Distance — SPDL lock)

`C3DEnvelopeAutoAssignOp2.spdl` parameter **`autoassignmeth`** (default **Value = 1**):

| Value | Label |
|------:|-------|
| **0** | **Distance-based** |
| **1** | **Normal-based** |

Direct mapping (`src/commands/rigging.ts`):

| Softimage | Direct |
|-----------|--------|
| Mode default **1** (Normal) | `Mode` default **1** → `envelopop.weighting` **1** (nearest stand-in) |
| Mode **0** (Distance) | `weighting` **0** (distance falloff) |
| `DistanceWeighting` truthy | Forces distance path (`weighting` 0) ↔ **`autoassignmeth = 0`** |

See also [flexenv-headless-lock.md](./flexenv-headless-lock.md).

## Weight / deform binary (`deformop.dll`)

| Symbol | VA | Note |
|--------|-----|------|
| `C3DDeform::AdjustFromVertexWeight` | `180001390` | If flag `this+0x2c4`: `w *= *(double*)(this+0x2b8)` |
| `C3DDeform::GetVertexWeight` | `180002d10` | Weight read |
| `C3DDeform::IsConnectedToWeightMap` | `18001cc10` | Weight-map connection |

`mogeometry.dll`: `F3DFindEnvelopeOp` → `I3DMultiWeightMapsOp`. OM: `CXSIEnvelopeCore` / `CXSIEnvelopeWeightCore`.

## Wire guidance (B3)

| Item | Class |
|------|-------|
| Softimage weight goldens via `-processing` | **LOCK** |
| Direct ApplyFlexEnv harness | Keep green |
| Distance vs Normal assign | **WIRE** — SPDL **0 / 1** attested (Mode default 1) |
| Construction mode | Prefers Animation when not already |
