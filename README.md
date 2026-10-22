# Softimage Direct

A clean-room reimplementation of Autodesk Softimage 2015's Model and Animate toolsets as a web application
(TypeScript + Three.js). The UI, menu trees, command names and argument lists follow the original, extracted
from the data files that ship with Softimage (menus, command maps, layouts, dictionaries) — not from its code.

## Run

```
npm install
npm run dev      # live-reload dev server
npm run build    # static build in dist/
```

## Layout

- `src/core` — object model (scene, kinematics, primitives, construction history), parameters, command bus, geometry (meshes, NURBS curves/surfaces, subdivision, topology ops, deformers), animation (fcurves).
- `src/commands` — Softimage-named commands (`CreatePrim`, `ApplyTopoOp`, `ApplyGenOp`, `SaveKey`, ...).
- `src/ui` — layout engine (Softimage `*.xsily`-style framesets), Toolbar Panel driven by the real menu tree, Explorer, Property Editor, 4-viewport View Manager, MCP panels, timeline/playback, command line, script log.
- `src/data` — the Model/Animate menu trees and menu-item → command map extracted from Softimage 2015 SP2.
- `data/` — the full extracted reference data (2,950-command registry dumped from Softimage, menu trees, mappings).
- `tools/` — the Softimage dump script used to extract the command registry.

## Keys

Space object · T point · E edge · Y polygon · V translate · C rotate · X scale · K key · Ctrl+Z/Y undo/redo ·
Alt+drag orbit · MMB pan · wheel zoom · 1–4 switch module · Enter/Esc finish/cancel a tool.
