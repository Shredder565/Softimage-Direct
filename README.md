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

## Fidelity verification (against Softimage 2015 SP2)

The testbed is checked against the real application, not against assumptions:

- `tools/si_model_dump*.js` — JScript run inside Softimage's Script Editor; executes every Model-menu command and records operators, parameters, defaults, ranges and mesh statistics (`data/dump/`).
- `tools/parse_spdl.py` + `tools/build_opdefs.py` — parse the 995 `.spdl` definition files and merge them with the runtime dump into `src/data/opdefs.json` (labels, enums, UI ranges, property-page layouts).
- `tools/compare_deformers.mjs` — vertex-exact comparison of Twist/Bend/Taper/Bulge/Shear/Push/Smooth/Relax/Fold against recorded Softimage results (all 13 cases match).
- `tools/compare_topology.mjs` — same for the polygon tools on a 3×3×3 cube (21 of 25 cases exact; Bevel, Dice frame and Polygon Reduction are approximations).
- `tools/walk_model_menu.mjs` — runs every Model-toolbar item in the built app (323 run, 67 greyed with reasons, 0 failures).
