# Softimage-Direct — getting started (Cursor / VS Code)

Clean-room web reimplementation of Autodesk Softimage 2015 SP2's Model toolset, Explorer, MCP and UI (TypeScript + Three.js + Vite).

```bash
npm install          # Node 18+ (three, vite, typescript, playwright for the test harnesses)
npm run dev          # http://localhost:5173  (add ?demo for the starter scene)
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ on :4173 — the tools/*.mjs harnesses expect this
```

Layout:
- `src/main.ts` — boots the app (commands, layout, menubar, views)
- `src/core/` — scene graph, parameters, commands/undo, geometry, topology, NURBS, curves, symmetry, texturing, envelopes, ICE, animation
- `src/commands/` — every Softimage command (`index.ts`, `model.ts`, `model2.ts`, `rigging.ts`, `clusters.ts`, `presets.ts`, `anim.ts`, `render.ts`, `ui.ts`)
- `src/ui/` — View Manager (viewport), MCP, Explorer, PPG, menubar, shell views, layouts, key maps, preferences, floating windows
- `src/data/` — data decoded from the real installation (SPDL op defs, menus, key maps, layouts, dictionaries, toolbars)
- `data/` — raw copies of the install data + Softimage dumps used for fidelity checks (`data/dump/`)
- `tools/` — decoders (`build_si_ui.py`, `parse_spdl.py`, `pe_resources.py`, `parse_dict.py`), JScript run inside Softimage (`si_*.js`), and Playwright checks (`walk_model_menu.mjs`, `compare_topology.mjs`, `compare_deformers.mjs`, `model2_check.mjs`, …)
- `public/si/` — toolbar icons and the 21 preset models exported from Softimage

Run a check: `npm run build && npm run preview &` then `node tools/walk_model_menu.mjs` (expects 390 run / 0 grey / 0 fail). Playwright needs a Chromium: `npx playwright install chromium` (or point `executablePath` in the scripts at your browser).

See README.md for what is implemented and how it was verified against the real application.
