# AfterImage Windows packaging

AfterImage is the Electron + NSIS Windows installer for this clean-room Softimage-faithful web app.

Distribution is **binary-only / closed source**: the NSIS installer does not grant source rights; production Vite builds ship with `sourcemap: false`.

## Artifact name

```
AfterImage-<version>-setup.exe
```

Example for the current `package.json` version: **`AfterImage-1.0.11-setup.exe`**.

## Local / CI build (Windows)

Requires Windows (or electron-builder wine tooling). On a Windows machine or `windows-latest` runner:

```bash
npm ci
npm run build:win
```

Installer lands in `release/AfterImage-<version>-setup.exe`.

Scripts:

| Script | Purpose |
|--------|---------|
| `npm run build` | Vite production bundle → `dist/` |
| `npm run build:win` / `npm run dist` | Vite build + NSIS installer via electron-builder |
| `npm run pack` | Unpackaged Electron dir (debug) |
| `npm run electron:dev` | Electron shell against a running `npm run dev` server (`ELECTRON_DEV=1`) |

Config: `electron-builder.yml`, main process `electron/main.cjs`, appId `com.afterimage.app`, productName **AfterImage**.

## GitHub Actions

Workflow: [`.github/workflows/build-windows.yml`](../.github/workflows/build-windows.yml)

Triggers:

- **Manual:** Actions → *Build AfterImage Windows installer* → *Run workflow*
- **Tag:** `git tag v1.0.11 && git push origin v1.0.11` — builds and attaches the exe to the GitHub Release for that tag
- **Release published:** same attach step

Download:

1. Open the workflow run → *Artifacts* → `AfterImage-…-setup`
2. Or open the GitHub Release for `vX.Y.Z` and download `AfterImage-X.Y.Z-setup.exe`

## Softimage branding note

This ships **AfterImage** only — no Softimage binaries or Autodesk IP. UI/data in-tree is the existing clean-room TypeScript/Three.js reimplementation.
