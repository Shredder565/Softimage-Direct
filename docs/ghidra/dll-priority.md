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
