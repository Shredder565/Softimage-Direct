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
