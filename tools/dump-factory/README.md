# Softimage 2015 SP2 dump factory (no desktop handoff)

Scripts that dump topology **with operator parameters**, module-menu gaps (Render / Simulate / ICE / Hair), and optional MCP/state — runnable from **Script Editor** or **XSIBATCH**. No computer-use / remote desktop required.

Install assumed: `C:\Program Files\Autodesk\Softimage 2015 SP2`.

Canonical scripts: [`docs/dump-factory/`](./dump-factory/) (also on Softimage-Direct branch `cursor/dump-factory-…` under `tools/dump-factory/`).

Related request list: [`softimage-dump-requests.md`](./softimage-dump-requests.md).

---

## Output paths

All dumps land under:

```text
%USERPROFILE%\Documents\softimage_dump_factory\
```

| File | Source script | Purpose |
|------|---------------|---------|
| `si_topo_ref_params.json` | `si_topo_params_dump.js` | Base 3×3×3 cube + Bevel / Bevel_edges A–D + PolyReduction ladder + Dice defaults, each with full `params` |
| `model/si_model_prims.json` | `si_model_goldens_dump.js` | Get primitive default meshes + subdivs (Cube/Sphere/…) |
| `model/si_model_topo_extra.json` | `si_model_goldens_dump.js` | Extra ApplyTopoOp cases (headless often geom-only — expected gap) |
| `model/si_model_deform.json` | `si_model_goldens_dump.js` | Deform ApplyOp attempts (Lattice/Wave/Curve/Spine need extra inputs) |
| `model/si_model_property_commands.json` | `si_model_goldens_dump.js` | Property-related command inventory |
| `model/si_model_get_prop_golden.json` | `si_model_get_prop_dump.js` | Get > Property preset params + cluster placement (follow-up) |
| `model/si_model_text_golden.json` | `si_model_text_dump.js` | Create > Text Curves/Planar/Solid (follow-up; Text may gap headless) |
| `model/si_model_generators_golden.json` | `si_model_generators_dump.js` | Create generators Loft/Boolean/… (follow-up) |
| `model/si_model_ref_golden.json` | `si_model_ref_dump.js` | Modify/Create Model referenced + delta (follow-up) |
| `si_module_commands_gap.json` | `si_dump_menus.js` | Commands whose Category starts with Render / Simulate / ICE / Hair |
| `si_commands_by_category.json` | `si_dump_menus.js` | Full category index |
| `si_menus_live.json` | `si_dump_menus.js` | Desktop layouts/views + PE-scrape hint |
| `si_mcp_state.json` | `si_mcp_state_dump.js` | Filters, selection, prefs sample, layout shell |
| `pe_module_menus.json` | `pe_scrape_module_menus.py` | **File-based** RT_MENU trees from install binaries |

Copy finished JSON into Softimage-Direct `data/dump/` (or Project store) for harness use.

---

## Tonight — pick one path

### A. Headless (preferred when Softimage is installed)

1. Copy `docs/dump-factory/` (or repo `tools/dump-factory/`) onto the Softimage PC.
2. Double-click **`Run-DumpFactory.bat`** (or from cmd: `Run-DumpFactory.bat all`).
3. Wait for XSIBATCH to finish; collect `%USERPROFILE%\Documents\softimage_dump_factory\*.json`.
4. Also run PE scrape (no Softimage process): `Run-DumpFactory.bat pe`  
   (needs Python 3 + `pe_resources.py` from Softimage-Direct `tools/`).

### B. Script Editor (interactive Softimage, still no remote control)

1. Softimage 2015 SP2 → **Alt+4** (Script Editor).
2. **File > Open** → `si_topo_params_dump.js` → set language to **JScript** → **Edit > Run**.
3. Repeat for `si_dump_menus.js` and (optional) `si_mcp_state_dump.js`.
4. Grab JSON from Documents as above.

Do **not** hand over the desktop for clicking menus — these scripts write files themselves.

---

## What `si_topo_params_dump.js` records

Same 3×3×3 cube / component indices as `tools/compare_topology.mjs`:

| Key | What |
|-----|------|
| `base` | Unmodified cube mesh (`pts`, `polys`, `edges`) |
| `Bevel` | Polys `[0,1,2]`, Softimage defaults + full `params` |
| `Bevel_edges` | Edges `[0,1,2]`, variant **A** defaults |
| `Bevel_edges_B` | ratio `0.25` |
| `Bevel_edges_C` | miter on |
| `Bevel_edges_D` | `nbsubdivs` 1 |
| `PolyReduction` / `_100` / `_75` / `_50` / `_25` | Object selected; ratio ladder with params |
| `Dice` | Polys `[0,1,2]` defaults; `dice_defaults_note` for style / planeref / nbslices* / merge |

Each case includes `params` (name→value map) and `params_full` (script name, label, type, min/max).

---

## PE scrape (preferred for menus when softimage-pc is online)

Module toolbar trees (Model / Animate / Render / Simulate / ICE / Hair) are **not** fully present in the in-tree `data/si/pe_resources.json` (only Model + Animate made it into `src/data/menus.json`). Recover them from the install files:

```bat
pe_scrape_module_menus.bat
```

or:

```bat
python pe_scrape_module_menus.py --si "C:\Program Files\Autodesk\Softimage 2015 SP2" -o "%USERPROFILE%\Documents\softimage_dump_factory\pe_module_menus.json"
```

Targets under `Application\bin\`: `XSI.exe`, `toolbar.dll`, `toolbarobj.dll` (if present), `siuitasks.dll`, `mcp.dll`, viewport/UI DLLs, plus any extra `*toolbar*` / `*uitask*` DLLs. Uses Softimage-Direct `tools/pe_resources.py` (copy next to the scraper if not in the same repo).

Output highlights:

- `files.<dll>.menus.<id>` — cleaned menu trees (`label`, `id`, nested `items`)
- `module_menu_candidates` — resources whose labels mention render / simulate / ice / hair / …
- `menubar_leaves` — flattened File/Edit/View/… leaves from `XSI.exe` menu `128`

When softimage-pc worker is connected, prefer this over interactive menu walking.

---

## Softimage-Direct repo layout

On branch `cursor/dump-factory-…`:

```text
tools/dump-factory/
  Run-DumpFactory.bat
  pe_scrape_module_menus.bat / .py
  si_topo_params_dump.js
  si_dump_menus.js
  si_mcp_state_dump.js
  si_common.js          (canonical helpers; dump scripts are self-contained)
tools/pe_resources.py   (existing — imported by the PE scraper)
tools/Run-Dump.bat      (legacy command/UI dump — unchanged)
```

After dumps land, place `si_topo_ref_params.json` at `data/dump/si_topo_ref_params.json` and extend `compare_topology.mjs` (or a sibling) to assert params + variant meshes.

---

## Notes / limits

- **XSIBATCH** runs without UI; Desktop-only MCP chrome may be sparse in `si_mcp_state.json` — still useful for filters/prefs. Full MCP enable/grey rules remain observation/Ghidra.
- Bevel preset name tries `Bevel` then `BevelComponent`; Polygon Reduction tries both spaced and concatenated names.
- PolyReduction `ratio` is Softimage’s 0–100 remaining-percent style (default 50), per dump-requests.
- No computer-use agent is required for any of the above.
