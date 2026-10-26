# AfterImage Native (Windows / Win32)

Phase 1 Softimage-faithful **original** C++17 Win32 shell for AfterImage.

| Policy | Rule |
|--------|------|
| Softimage dumps / Ghidra / REA | Behavior + architecture **spec only** |
| Softimage binary / source / decompile | **Never** paste into this tree |
| Existing Electron/TS AfterImage | Unchanged dual track |

## What Phase 1 includes

- `wWinMain` + Softimage Layout–like main frame chrome stub (module strip Targets 1–6, Module Menu tray, View Manager viewport)
- Command registry driven by dump-attested **Names** in `data/commands_attested.json` (from `wanted_commands.txt` / command registry slice)
- Render pass stub for `RenderPass` / `RenderPasses` / `RenderCurrentFrame` / `RenderPreview` → Softimage-attested still `.pic` path and product `.mp4` (no `.mov`); faithful writer wires when softimage-pc dump lands

## Build on softimage-pc (MSVC)

Requirements: Visual Studio 2019+ (or Build Tools) with **Desktop development with C++**, CMake 3.20+.

```bat
cd Softimage-Direct\native
build-softimage-pc.bat
REM or pick a generator your VS install provides:
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

CI and `build-softimage-pc.bat` try **VS 2026 → 2022 → 2019 → default** so GitHub `windows-latest` (VS 2026) and softimage-pc both work.

Run:

```bat
build\Release\AfterImageNative.exe
```

`commands_attested.json` is copied next to the exe under `build\Release\data\`.

### Alternative: open folder in Visual Studio

`File → Open → CMake…` → select `native/CMakeLists.txt` → Build `AfterImageNative`.

### Older MSVC generator examples

```bat
cmake -S . -B build -G "Visual Studio 16 2019" -A x64
cmake --build build --config RelWithDebInfo
```

## Windows CI / GitHub Release

Workflow: `.github/workflows/build-native-windows.yml`  
Builds on `windows-latest` (PR / main / `v*` tags / published release). On tag or release, attaches **`AfterImageNative-win-x64.zip`** to the GitHub Release next to the Electron NSIS installer. Does **not** replace or embed into the NSIS workflow.

## Spec sources (Project store; not vendored Softimage)

- `internal/softimage-pc-dumps/behavioral/proof/wanted_commands.txt`
- `internal/softimage-pc-dumps/behavioral/proof/softimage_command_registry_slice.json`
- `internal/softimage-pc-dumps/behavioral/proof/render_command_chain.json`
- `docs/afterimage-tab-feature-matrix.md` (SwitchToolbar Targets)
- Softimage Layout frame names from AfterImage `src/data/si/layouts.json` (structure labels only)

## Next (post Phase 1)

1. Wire still writer to Softimage-attested `Render_Pictures\Default_Pass_Main.1.pic` from softimage-pc dump
2. Movie path `.mp4` / 2K / 4K; refuse `.mov`
3. Deepen Softimage Layout chrome from Desktop HWND harvest (not Softimage code)
