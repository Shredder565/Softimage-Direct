# Softimage Direct

[![Latest Release](https://img.shields.io/github/v/release/Shredder565/Softimage-Direct?label=Latest%20Release)](https://github.com/Shredder565/Softimage-Direct/releases/latest)

A clean-room reimplementation of Autodesk Softimage 2015's Model and Animate toolsets as a web application
(TypeScript + Three.js). The UI, menu trees, command names and argument lists follow the original, extracted
from the data files that ship with Softimage (menus, command maps, layouts, dictionaries) — not from its code.

**License:** proprietary / closed source (All Rights Reserved). This repository is **public** so anyone can download AfterImage release installers without GitHub auth. The source is **not** open source — viewing or cloning does not grant source rights; see [`LICENSE`](LICENSE). Binary distribution of the installer does not grant source rights.

## Latest Releases

Desktop builds ship as **AfterImage** (Windows NSIS installer; no Softimage/Autodesk binaries).

- [Releases](https://github.com/Shredder565/Softimage-Direct/releases) — all published versions (public downloads; no auth required)
- [Latest release](https://github.com/Shredder565/Softimage-Direct/releases/latest) — always the current stable
- **Download:** [AfterImage-1.0.17-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.17/AfterImage-1.0.17-setup.exe)
- Prior: [AfterImage-1.0.16-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.16/AfterImage-1.0.16-setup.exe) · [AfterImage-1.0.15-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.15/AfterImage-1.0.15-setup.exe) · [AfterImage-1.0.14-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.14/AfterImage-1.0.14-setup.exe) · [AfterImage-1.0.13-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.13/AfterImage-1.0.13-setup.exe) · [AfterImage-1.0.12-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.12/AfterImage-1.0.12-setup.exe) · [AfterImage-1.0.11-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.11/AfterImage-1.0.11-setup.exe) · [AfterImage-1.0.10-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.10/AfterImage-1.0.10-setup.exe) · [AfterImage-1.0.9-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.9/AfterImage-1.0.9-setup.exe) · [AfterImage-1.0.8-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.8/AfterImage-1.0.8-setup.exe) · [AfterImage-1.0.7-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.7/AfterImage-1.0.7-setup.exe) · [AfterImage-1.0.6-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.6/AfterImage-1.0.6-setup.exe) · [AfterImage-1.0.5-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.5/AfterImage-1.0.5-setup.exe) · [AfterImage-1.0.4-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.4/AfterImage-1.0.4-setup.exe) · [AfterImage-1.0.3-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.3/AfterImage-1.0.3-setup.exe) · [AfterImage-1.0.2-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.2/AfterImage-1.0.2-setup.exe) · [AfterImage-1.0.1-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.1/AfterImage-1.0.1-setup.exe) · [AfterImage-1.0.0-setup.exe](https://github.com/Shredder565/Softimage-Direct/releases/download/v1.0.0/AfterImage-1.0.0-setup.exe)

## Run

```
npm install
npm run dev      # live-reload dev server
npm run build    # static build in dist/
```

## Windows installer (AfterImage)

Prefer the [Latest Releases](#latest-releases) download above. To build locally on Windows:

```
npm ci
npm run build:win   # → release/AfterImage-1.0.17-setup.exe
```

Or use GitHub Actions (*Build AfterImage Windows installer*) / push a version tag. See [docs/PACKAGING.md](docs/PACKAGING.md).

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

### UI data taken directly from the installation (`tools/build_si_ui.py`)

- **Key map** — `Data/Preferences/KeyMaps/*.xsikm` parsed into `src/data/si/keymaps.json`; `src/ui/keymap.ts` dispatches by context (Tweak Tool, Transform Tool, Global, View Shortcuts, Layout Shortcuts, XSI) exactly like `XSIKeyMap`. Switch maps with `?keymap=` or Edit ▸ Keyboard Mapping.
- **Toolbar bitmaps** — the 107 `.bmp` toolbar icons packed into `public/si/icons.png` (cyan key → alpha).
- **Toolbars / shelves** — `.xsitb` files (VBScript buttons) parsed; `src/ui/shelf.ts` runs each button's command through the command map.
- **Layouts** — `Data/Layouts/*.xsily` frameset trees drive the `LayoutEngine` (`src/ui/layout.ts`); `.xsivw` view definitions are opened as floating views.
- **Menus** — every `MENU`/`MENUEX` resource read out of `XSI.exe`, `mcp.dll`, `viewcontrol.dll`, `vm.dll`, `viewinteraction.dll` (`tools/pe_resources.py` → `menus.json`): main menu bar, File menu, viewport camera/visibility/display/ViewCube menus, MCP option menus, tool-option menus.
- **Status bar** — mouse-button hints come from the `.dict` localisation files (`tools/parse_dict.py`).
- **Property pages** — `C3DKineState`, `C3DVisibilityAndDisplay`, `C3DDisplayProp`, `C3DGeomApprox`, `C3DCamera*`, `C3DSceneColors`, `C3DAmbientLighting` and the `C3DPrefs*` pages are laid out from their SPDL (`propsets.json`); File ▸ Preferences shows the real preference pages and the values are applied (point size, pick tolerance, click-to-deselect, surround selection, auto-inspect, wheel rate…).
- **Preset models** — the 21 `XSI_SAMPLES/Models/*.emdl` presets (skeletons, bipeds, rigs, bodies, faces, meshes) were exported from the running application by `tools/si_export_models.js` and are rebuilt by Get ▸ Primitive ▸ Model (`public/si/models/*.json.gz`). The `*_Generated` rig variants map to the same hierarchies; rig control curves exported without CVs are rebuilt as empty curve lists.

### Formerly greyed Model-menu items (`src/commands/model2.ts`, `src/core/nurbs.ts`)

NURBS surface operators (Open/Close, Snip, Extend to Curve, Stitch, Snap Boundary, Fit, Fillet, Trim by Projection, Delete Trim, Continuity Manager, Bezier-knot corners), curve fillet, Gator, Footprints, user normals (reset/average/normalize/copy/paste/settings/Tweak Normals tool), Paint / Push / Vertex Colour tools with Brush Properties, Spine / Tail / Control Splines, referenced models (new / empty / convert / update / reload / resolution / make local / commit / deltas — stored in `localStorage`), Stand-in and GeoShader primitives, Light Rig from Image, ICE Particle Volume shader. `tools/model2_check.mjs` exercises all of them.

### Shell views, preferences, key maps, docking (`src/ui/shell.ts`, `prefs.ts`, `keymap.ts`, `floating.ts`)

Render Tree, Texture Editor (per-sample UVs, relax / heal / islands), Schematic, Animation Editor (F-curves / Dopesheet), Animation Mixer, Spreadsheet, Plugin Manager, Netview, Image Clips, Render Manager, Material Manager / Panel, Weight Paint Panel, Preset Manager and the ICE Tree editor are all View-menu entries and floating windows; windows minimise to a tray, dock into any layout frame (⊡ or Ctrl+drop) and are listed in the Window menu. The Preferences pages (every `C3DPrefs*.spdl`) are wired into the app (scene colours, display, selection, camera / ViewCube, units, time, animation, scripting language and logs, undo depth, layer control, explorer, editor grids, generator input management…), all 358 key-map bindings of the four shipped maps have actions, and the message catalogue / preference titles / selection filter names come from the `.dict` tables.

### Modeling, NURBS, rigging, ICE (`src/core/topology2.ts`, `nurbs.ts`, `symmetry.ts`, `texturing.ts`, `envelope.ts`, `ice.ts`, `src/commands/rigging.ts`)

- **Polygons** — real edge / polygon / point bevel with rounding and junction polygons, Dice in Global / Local Object / Local Components frames, quadric-error Polygon Reduction, Loop / XSI-Doo-Sabin / Linear subdivision rules, clusters (Ctrl+L) hosting weight maps, vertex colours, user normals and envelopes.
- **NURBS** — knot vectors, weights, tensor de Boor, Boehm knot insertion, exact Snip, degree elevation; Loft / Extrusion / Revolution (exact rational circles) / Sweep / Birail / Four-Sided / Curve Net generate real surfaces; least-squares Fit, rolling-ball G1 Fillet, exact Trim by Projection, Inverse / Swap / Shift / Clean / Reparameterize / knot ops; curve knot insertion / removal, Bezier knots, corners, linear segments.
- **Interaction** — symmetry maps (symmetric selection and mirrored tweaks across any plane), Slide Components, Knife guide line and constraints, rotation rings picked by the ring under the cursor.
- **Texturing** — projections on the sample cluster driven by Texture_Support control objects, per-sample UVs with seam unwrapping.
- **Referenced models** — Export / Import Model (`.emdl` JSON), resolutions, per-parameter deltas.
- **Rigging** — envelopes (distance / nearest / smoothed weighting, smoothing, Reassign Locally, locks, limits, painting), Biped / Quadruped proportional guides → rigs, deformers re-evaluate live.
- **Deformers** — Deform by Curve with the `crvdeform` parameters, Deform by Spine (radius falloff), Deform by Cage (mean-value coordinates), median-cut Light Rig from Image (HDR), Stand-in proxies, Text alignment / spacing / bevel.
- **ICE** — an `ICETree` operator evaluates a node graph per point; Footprints, Turbulize Mesh, Push Points, Randomize Position, Twist and Wave are factory compounds you can open and edit in the ICE Tree view.
- **Construction modes** — Modeling / Shape / Animation / Secondary Shape regions in the operator stack (combo in the menubar), Freeze M freezes only the modeling region, Immediate mode bakes just the new operator.

## Keys

Space object · T point · E edge · Y polygon · V translate · C rotate · X scale · K key · Ctrl+Z/Y undo/redo ·
Alt+drag orbit · MMB pan · wheel zoom · 1–4 switch module · Enter/Esc finish/cancel a tool. The full map is the real `Default.xsikm`.

## Fidelity verification (against Softimage 2015 SP2)

The testbed is checked against the real application, not against assumptions:

- `tools/si_model_dump*.js` — JScript run inside Softimage's Script Editor; executes every Model-menu command and records operators, parameters, defaults, ranges and mesh statistics (`data/dump/`).
- `tools/parse_spdl.py` + `tools/build_opdefs.py` — parse the 995 `.spdl` definition files and merge them with the runtime dump into `src/data/opdefs.json` (labels, enums, UI ranges, property-page layouts).
- `tools/compare_deformers.mjs` — vertex-exact comparison of Twist/Bend/Taper/Bulge/Shear/Push/Smooth/Relax/Fold against recorded Softimage results (all 13 cases match).
- `tools/compare_topology.mjs` — same for the polygon tools on a 3×3×3 cube (21 of 25 cases exact; Bevel, Dice frame and Polygon Reduction are approximations).
- `tools/walk_model_menu.mjs` — runs every Model-toolbar item in the built app (390 run, 0 greyed, 0 failures).
