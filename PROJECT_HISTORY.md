# Softimage-Direct — project history and sources

A hand-off document for anyone (or any editor assistant such as Cursor) picking this code up: what was built, in what order, how each part was verified, and exactly where every piece of information came from. The companion files are `README.md` (what is implemented) and `GETTING_STARTED.md` (how to run it).

## 1. Goal and ground rules

- Clean-room web reimplementation of **Autodesk Softimage 2015 SP2**, starting with the **Model** toolset, the **Explorer**, the **Main Command Panel (MCP)** and the overall UI look and behaviour. TypeScript + Three.js + Vite; no Softimage code is copied — the application's *data files* (SPDL definitions, key maps, layouts, toolbars, dictionaries, menu resources, bitmaps) are decoded and the behaviour is re-derived from observing and scripting the real program.
- Everything is **verified against the user's real installation** on a Windows PC (`C:\Program Files\Autodesk\Softimage 2015 SP2`) rather than against assumptions: either by reading the install's own files, by running JScript inside Softimage's Script Editor and recording the results, or by screen-driving the application and comparing.
- Every stage is committed to GitHub (`Shredder565/Softimage-Direct`, branch `main`) and republished as a hosted artifact so it can be tried in a browser.

## 2. Where the information came from

### 2.1 Files read directly from the Softimage 2015 SP2 installation

| What | Install location | Decoded by | Lands in |
|---|---|---|---|
| Operator / property / primitive definitions (995 `.spdl` files: parameters, defaults, ranges, enums, PPG layouts) | `Application/spdl/` | `tools/parse_spdl.py`, `tools/build_opdefs.py` | `data/spdl/spdl.json`, `src/data/opdefs.json` |
| Property sets used by the UI (`C3DSceneColors`, `C3DKineState`, `C3DVisibilityAndDisplay`, `C3DDisplayProp`, `C3DGeomApprox`, `C3DCamera*`, `C3DLightPoint`, `C3DTransformProps`, every `C3DPrefs*` preferences page) | `Application/spdl/` | `tools/build_si_ui.py` | `src/data/si/propsets.json` |
| Shader definitions (phenolib: Phong, Lambert, Blinn, Cook-Torrance, Strauss, Ward, Constant, textures, mixers, `soft_light`) | `Application/phenolib/spdl/` | `tools/build_shaders.py` | `src/data/shaders.json` |
| Key maps (Softimage, Maya-compatible, 3ds Max-compatible, SI\|3D) — XML, contexts Global / XSI / View Shortcuts / Transform Tool / Tweak Tool… | `Application/keymaps/*.xsikm` | `tools/build_si_ui.py` | `src/data/si/keymaps.json` |
| Toolbars (`Main_Shelf`, `PanelSwitcher`, `Palettes`, `ScriptCommands` — VBScript button definitions) | `Application/toolbars/*.xsitb` | `tools/build_si_ui.py` | `src/data/si/shelf.json`, `panelswitcher.json`, `toolbars.json` |
| Layouts (`default`, `Dual`, `1024_x_768`, `Autohide` — frameset / switcher / frame trees with sizes) | `Application/layouts/*.xsily` | `tools/build_si_ui.py` | `src/data/si/layout_*.json` |
| View definitions (20 relational views: Explorer, Property Editor, Script Editor, Timeline, Keying Panel…) | `Application/views/*.xsivw` | `tools/build_si_ui.py` | `src/data/si/views.json` |
| Command maps (which command each menu item runs, with its arguments) | `Application/commandmaps/` | `tools/dump_softimage.py`, `tools/gen_dump_script.py` | `data/menu_command_map.json`, `src/data/menu_commands.json` |
| Menu resources (main menubar #128, File menu #344 in `XSI.exe`; MCP Select/Transform/Edit/Constraints/Snap/Explore/Reference/Symmetry menus in `mcp.dll`; viewport camera #101 / visibility #102 / ViewCube #128 in `viewcontrol.dll`; view list #202 in `vm.dll`; tool option menus #530–536 in `viewinteraction.dll`) | `Application/bin/*.dll`, `XSI.exe` (PE RT_MENU resources, standard + MENUEX) | `tools/pe_resources.py` | `data/si/pe_resources.json`, `src/data/si/menus.json` |
| Toolbar / MCP / PPG bitmaps (107 toolbar icons, `mcp.dll` playback & animation panel strips, `uiut.dll` PPG toolbar bitmaps) | PE RT_BITMAP resources, `Application/bitmaps/` | `tools/pe_resources.py`, `tools/build_si_ui.py` (cyan colour key → alpha, 36 px cells) | `public/si/icons.png`, `public/si/mcp/*.png`, `src/data/si/icons.json` |
| Dictionaries (28 `.dict` tables: status-bar hints, tool prompts, message catalogue, preference page titles, selection filter names; format = big-endian count + `[uint32 id][UTF-16LE string\0]`) | `Application/Dictionary/en/*.dict` | `tools/parse_dict.py`, `tools/build_si_ui.py` | `data/si/dict.json`, `src/data/si/strings.json` |
| Preset models (21 `XSI_SAMPLES/Models/*.emdl`: skeletons, bipeds, rigs, Bull, Car, Fish, Horse, Lizard, Male, T.rex…) | `Data/XSI_SAMPLES/Models/` | exported *by Softimage itself* with `tools/si_export_models.js` (JScript run in the Script Editor) | `data/si/models/*.json`, `public/si/models/*.json(.gz)` |

### 2.2 Data recorded by running scripts inside Softimage

JScript files in `tools/` were opened in Softimage's Script Editor (Alt+4 → File > Open → Edit > Run) and their output copied back from `C:\Users\Neil\Documents\`:

- `tools/si_model_dump*.js` → `data/dump/si_model_dump*.json`: executes every Model-menu command on sample objects and records the operators created, their parameters, defaults, ranges, and mesh statistics.
- `tools/si_model_dump*.js` (deformers / topology sections) → `data/dump/si_deform_ref*.json`, `data/dump/si_topo_ref.json`: **vertex-exact** results of Twist / Bend / Taper / Bulge / Shear / Push / Smooth / Relax / Fold and of the polygon tools (extrude, inset, bevel, subdivide, split, dice, slice, symmetrize, weld, collapse, dissolve, disconnect, offset, bridge, quadrangulate, reduction, invert, thickness) on a 3×3×3 cube.
- `tools/si_export_models.js` → the 21 preset models above.
- `tools/Run-Dump.bat` / `tools/dump_softimage.py`: batch helpers used to launch dumps.

### 2.3 Behaviour observed by driving the real application

Computer-use sessions on the user's PC (screenshots + clicks in Softimage) established the fidelity rules that are not written in any data file:

- A new scene is empty; a new primitive is selected and a floating property page titled `Scene_Root : sphere (General)` opens.
- Viewport background 127-grey; shaded views draw wire only on the selected object (white), Active colour (255,210,0) in component mode, black for unselected; points shown only in point mode (Vertex blue, 5 px), selected components red / translucent red; rectangle selection goes *through* the object (edge touched / polygon overlapped); click on empty space does not deselect (`clicktodeselect = false`); pick tolerance 15 px; the SRT manipulator (red X / green Y / blue Z, yellow centre); default camera ≈ (9.5, 7.3, 12.3); surfaces occlude back points and wire.
- Rotation orders are **extrinsic** (Softimage `XYZ` = three.js `ZYX`), which fixed Local / Global / Parent / View rotation.
- Spotlights are created as `Spot_Root` → `Spot` + `Spot_Interest` with a Direction constraint.
- MCP layout, button order and section titles; menu contents and greyed items; which Model-menu entries were unavailable (67 items) until implemented.

### 2.4 Public documentation used for algorithms (no Softimage code)

Standard published algorithms were implemented from their descriptions: Catmull-Clark / Doo-Sabin / Loop subdivision, Garland–Heckbert quadric error metric for reduction, Boehm knot insertion and tensor-product de Boor evaluation for NURBS, rolling-ball fillets with rational quadratic arcs, Coons patches and Gordon surfaces, Ju–Schaefer–Warren mean-value coordinates for cage deformation, linear-blend skinning, median-cut light extraction from environment maps, Laplacian UV relaxation.

## 3. Steps taken, in order (one git commit per step)

| # | Commit | Step |
|---|---|---|
| 1 | `e745cbd` | Initial web testbed: scene graph, parameters, command/undo system, Three.js viewport, Model toolset menus, basic primitives and operators. |
| 2 | `df6e5f3` | Softimage light theme; Explorer rebuilt with Softimage's node structure. |
| 3 | `21c8b60` | SPDL parser + JScript dump script; operator definitions parsed from the install. |
| 4 | `5f8e2bc` | Real operator definitions (labels, enums, ranges, PPG layouts) ported into the testbed. |
| 5 | `f36d2fd` | Deformers and topology operators matched **numerically** to Softimage (13/13 deformer cases exact; 21/25 topology cases exact). |
| 6 | `693ca84` | Explorer: Softimage structure and look (construction-mode markers, Clusters folder, shared properties in italics). |
| 7 | `f49263d` | Main Command Panel copied from the `mcp.dll` resources: Select / Transform / Snap / Constrain / Edit sections, groups, Freeze Modeling, Immediate mode. |
| 8 | `96b95b8`, `a503d5e` | Viewport modeling fidelity: scene colours from `C3DSceneColors.spdl`, wire-on-selected, component display and highlight, overlap rectangle picking, no click-deselect, depth-tested overlays so back points/wire are hidden on shaded objects. |
| 9 | `05b109d` | UI data copied from the install: key maps, toolbar bitmaps, Main Shelf + Panel Switcher, Default layout, main menubar + viewport / MCP menus from PE resources, status-bar strings from dictionaries, SPDL property pages, Preferences dialog, floating windows, scene save/open. (Face Robot removal script `Remove-FaceRobot.bat` prepared for the user's install.) |
| 10 | `adf6b83`, `5912dfe`, `7cdd5d9` | The 67 formerly greyed Model-menu items: NURBS surface ops, paint tools, user normals, referenced models, rigging helpers, preset models exported from Softimage, Stand-in / GeoShader, light rig, ICE Particle Volume, Footprints. Menu walk: 390 run / 0 grey / 0 fail. |
| 11 | `84899fb` | Views: Playback / Animation panels painted with the real `mcp.dll` bitmaps and their menus, Timerange, Scene Layer Manager, XSI Explorer, Script History, Selection / Transformation / Snap / Edit / Mini Transform panels. |
| 12 | `247fda2` | Property pages: real phenolib shader SPDLs with their tabs, Render Tree connections, Camera / Light pages, PPG lock / recycle / history, multi-object editing, Animation tab. |
| 13 | `8ae8ac8` | Viewport: camera-menu navigation tools, isolate / mute / solo, capture → flipbook, display menu (depth cue, rotoscope, headlight, X-ray, HQ, textured decal), stereo modes, drawn ViewCube, Render Region, Camera Visibility / Display property pages (grid, rulers, field guide, safe areas, stats). |
| 14 | `2c007a5` | Layouts: Default / Dual / 1024×768 / Autohide from the shipped `.xsily` files, layout editing, Save / New / Rename / Manage. |
| 15 | `1ae90e1` | Toolbars: Palettes, Scripts toolbar, custom toolbars / shelves, Customize Toolbars dialog, per-object wire colour. |
| 16 | `9036caa` | Shell views: Render Tree, Texture Editor, Schematic, Animation Editor (F-curve / Dopesheet), Mixer, Spreadsheet, Plugin Manager, Netview, Image Clips, Render Manager, Material Manager / Panel, Weight Paint Panel, Preset Manager. |
| 17 | `e2bd37c` | Preferences wired through the app; all 358 key-map bindings implemented; clusters (Ctrl+L); dictionary strings (message catalogue, preference titles, filter names); window docking / tray / Window-menu list. |
| 18 | `beac2bd`, `9bef3ae` | Fixes verified against the running application: extrinsic rotation orders; rotation rings picked by the ring under the cursor and dragged by swept angle; spotlight interest line and cone; component picking switches to the object under the cursor. |
| 19 | `a738272` | Modeling: true bevel with rounding and junctions, Dice in Global / Local Object / Local Components frames, quadric Polygon Reduction, Loop / Doo-Sabin / Linear subdivision; NURBS core with knots, weights, de Boor, knot insertion, exact Snip, degree elevation; generators produce real NURBS surfaces. |
| 20 | `58d24d1` | NURBS: least-squares Fit, rolling-ball G1 Fillet, exact Trim by Projection, Inverse / Swap / Shift / Clean / Reparameterize / knot ops; curve knot tools (Bezier knots, corners, linear segments). |
| 21 | `d4e1f2d` | Symmetry maps (symmetric selection, mirrored tweaks across any plane); Slide Components; Knife guide line, Ctrl constraint, tagged-polygon limit; Tweak / Knife / Pivot option menus. |
| 22 | `8f43408` | Texturing: projections on the sample cluster with Texture_Support control objects, per-sample UVs, Texture Editor relax / heal / islands; maps on clusters; GATOR nearest-point transfer. |
| 23 | `a51a814` | Referenced models: Export / Import Model (`.emdl` JSON), file browsing, resolutions, per-parameter deltas. |
| 24 | `850f59e` | Rigging: envelopes (weighting modes, reference poses, smooth, reassign, locks, limits, painting), Biped / Quadruped guides → rigs, dependency stamps so deformers update live. |
| 25 | `5e439a8` | ICE node graphs with the factory compounds and an ICE Tree editor; median-cut HDR Light Rig; Stand-in proxies; Text options; Deform by Curve / Spine / Cage; construction modes, Freeze M by region, Immediate mode. |
| 26 | `5420fcb`, `3c608f4` | README and GETTING_STARTED. |

## 4. How each stage was verified

- `tools/compare_deformers.mjs` — vertex-exact comparison of 13 deformer cases against `data/dump/si_deform_ref.json` (all match, max error 0.000).
- `tools/compare_topology.mjs` — 25 polygon-tool cases against `data/dump/si_topo_ref.json` as point multisets + polygon histograms (21 exact; Bevel, Dice and Polygon Reduction are documented approximations whose topology differs from Softimage's).
- `tools/walk_model_menu.mjs` — runs every Model-toolbar entry in the built app (390 run / 0 greyed / 0 failures).
- `tools/model2_check.mjs` — functional checks of the 67 formerly greyed items (NURBS ops, paint, normals, referenced models, rigging, light rig…).
- `tools/model_shot.mjs`, `tools/mcp_shot.mjs` — viewport and MCP screenshots and selection checks (`docs/screenshots/`).
- Ad-hoc Playwright scripts during each stage (preferences, key maps, docking, clusters, projections, envelopes, ICE, construction modes) — their results are summarised in the commit messages.

## 5. Things still pending on the user's side

- **Face Robot**: `C:\Users\Neil\Documents\Remove-FaceRobot.bat` must be run as administrator (with Softimage closed) to remove it from the real install.
- The five `*_Generated` rig presets were not exported (a screen-capture tool blocked the automation); the clone maps them to the exported base rigs.
