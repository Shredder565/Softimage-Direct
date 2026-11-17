# Softimage 2015 SP2 — DLL priority (residual RE)

Generated from softimage-pc string hunts under `Application\` (449 binaries).

## P0 — residual full-clone bridge

| DLL | Why |
|-----|-----|
| `topologyop.dll` | Bevel / PolyReduce registration + PolyReduce mesh-eval |
| `mohelper.dll` | `C3DLineSegmentBeveler` bevel vectors / collide |
| `mopolymesh.dll` | Imports beveler; mesh consumer hunt |
| `sicoresdk.dll` | `CXSICommandCore::GetEnabled` / PutEnabled |
| `animationmixer.dll` | clip_transition / transitioncurves / mixer client |
| ICE host / `iceflow.dll` | Cap Hole compound runtime (CapHoleProc path) |

## P0 — MCP / view tools

| DLL | Why |
|-----|-----|
| `mcp.dll` | MCP chrome; EnableMenuItem / EnableWindow |
| `viewinteraction.dll` | Tool activation / module gating |

## P1

`prefs.dll`, `uiut.dll`, `toolbarobj.dll` (Cap Hole string), `viewcontrol.dll`, `XSI.exe`, `vm.dll`.

## Suggested headless import order (residuals)

1. `animationmixer.dll` — transition weight / timewarp
2. ICE Cap Hole / CapHoleProc string xrefs
3. `mohelper.dll` DAT_* for bevel collide
4. `topologyop.dll` PolyReduce cost helpers rename
5. Envelope / ApplyFlexEnv Mode constants

## Opened by the full-clone loop

| DLL | Row | Note |
|-----|-----|------|
| `Application\Plugins\FBXXSI.64.dll` | CMD-01a | [cmd-01a-fbx.md](./cmd-01a-fbx.md) |
| `Application\bin\xsiutils.dll` | CMD-01b | [cmd-01b-sdk-helpers.md](./cmd-01b-sdk-helpers.md) (`XSIUtils.Translate`; imports only for the rest) |
| `Application\bin\shadertasks.dll` | CMD-01c | [cmd-01c-texture-layers.md](./cmd-01c-texture-layers.md) (texture layer tasks; pop-up tasks still open) |
| `Application\bin\shaderhelper.dll` | CMD-01c | same note (layer order, insert, move and suitability helpers) |
| `Application\bin\fcurve.dll` | CMD-B8a, CMD-B8b, CMD-B8c | [cmd-b8a](./cmd-b8a-fcurve-keys-binary.md), [cmd-b8b](./cmd-b8b-fcurve-layers-marking-expr-binary.md), [cmd-b8c](./cmd-b8c-fcurve-copy-paste-rotation-binary.md) (60 commands, 46 handler classes) |
| `Application\bin\primtasks.dll` | CMD-B8d, CMD-B8e | [cmd-b8d](./cmd-b8d-primtasks-texture-binary.md), [cmd-b8e](./cmd-b8e-primtasks-prims-binary.md) (30 commands) |
| `Application\bin\simeshtasks.dll`, `sicurvetasks.dll` | CMD-B8f | [cmd-b8f](./cmd-b8f-mesh-curve-step-tasks-binary.md) (19 commands) |
| `Application\bin\mohelper.dll` | CMD-B8a | `F3DGetKeyableParams` only (addendum of cmd-b8a); other helpers wanted, row CMD-B8-HELPERS |
