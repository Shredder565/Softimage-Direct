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

### MCP (Main Command Panel)
`src/ui/mcp.ts` reproduces the Softimage MCP on the right of the viewports, laid out from the 2015 SP2 panel
(Select / Transform / Snap / Constrain / Edit sections with the dark `◣ Title` headers):

- **Select**: arrow (select tool, Esc), Group / Center modes, Object / Point / Edge / Polygon filters, Sample,
  the filter combo (Object, Polygon Mesh, Curve, Light, Camera, Null, Model, Cluster, Property …), the select-by-name
  field with ▲/▼ cycling through matches, and Explore / Scene / Selection / Clusters which switch the left tray to
  the Explorer with that scope.
- **Transform**: s / r / t rows (X / C / V) with per-axis enable toggles, the `≡` options menu, the three dark axis
  fields (editable; commits `kine.local.*` on Enter), reference modes Global / Local / View / Par / Ref / Plane,
  COG / Prop / Sym.
- **Snap**: ON plus point / curve / midpoint / grid targets (used by the viewport drag and tweak tools).
- **Constrain**: Parent / Cut (`ParentObj` / `CutObj` on the selection), CnsComp / ChldComp toggles.
- **Edit**: Freeze (`FreezeObj`), Group (`CreateGroup`, groups appear under the Explorer's *Groups* scope),
  Freeze M (`FreezeModeling`), Immed (freezes the stack after each topology operator).

Screenshot: `docs/screenshots/mcp-clone.png`.

### Viewport modeling behaviour (observed on 2015 SP2, colours from `C3DSceneColors.spdl`)
- New objects: Softimage starts on an empty scene; creating a primitive selects it and pops a **floating property editor**
  (`Scene_Root : sphere (General)`), per the Interaction pref *Popup Property Editors on Node Creation* (`?demo` restores the starter scene).
- Shaded views draw the wireframe only on **selected** objects (Selected = white); in point/edge/polygon mode the active
  object's wire turns to the *Active* colour (255,210,0); unselected wire colour is the Geometry colour (black). Background 127 grey.
- Points are shown only in point mode: Vertex blue, Display pref point size 5; selected components are Component red
  (points, edges, translucent polygon fill); the component under the cursor is pre-highlighted in the Highlight colour.
- Rectangle selection goes through the object (hidden points/edges/polygons included); an edge is picked when the rectangle
  touches it, a polygon when any part overlaps (*Surround Edges/Polygons* off); point pick tolerance 15 px (`Tweak.picktol`).
- Clicking empty space does **not** deselect objects (`Select.clicktodeselect = false`); Ctrl+Shift+A deselects all.
- `v`/`c`/`x` show the SRT manipulator at the selection centre (red X / green Y / blue Z handles, yellow centre square);
  dragging a handle constrains to that axis, dragging the centre or empty space moves in the view plane (`siView`), the
  mesh deforms live, and the edit lands in a `MoveComponent` operator in the construction history. `f` frames the selection, `a` frames all.
- Default camera matches Softimage's (≈ 9.5, 7.3, 12.3 looking at the origin).

Checks: `tools/model_shot.mjs` (sphere → point/edge/polygon modes → move → empty click), screenshots `docs/screenshots/model-*.png`.

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
