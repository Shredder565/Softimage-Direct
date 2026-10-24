import json
import shutil
from pathlib import Path
from datetime import datetime, timezone

STORE = Path(r"C:\Users\neil\AppData\Local\Cursor\AgentStores\cursor_agent_stores\bc-0bd1d332-4e49-4056-9894-1b21507c9f95\files")
p = STORE / "internal" / "softimage-pc-dumps" / "model"
docs = STORE / "docs"
src = Path.home() / "Documents" / "softimage_dump_factory"
src_model = src / "model"

p.mkdir(parents=True, exist_ok=True)

# Mirror Documents dump factory outputs into the Project store pack.
for folder in (src_model, src):
    if not folder.is_dir():
        continue
    for f in folder.iterdir():
        if not f.is_file():
            continue
        # Prefer model\ subfolder copies; root si_topo_ref_params.json is also useful.
        if folder is src and f.name != "si_topo_ref_params.json":
            continue
        shutil.copy2(f, p / f.name)

# Optional root-level topo params already copied above.
master_path = p / "si_model_goldens.json"
if not master_path.is_file():
    raise SystemExit(f"missing {master_path} — run si_model_goldens_dump.js first")

master = json.loads(master_path.read_text(encoding="utf-8"))
prims = json.loads((p / "si_model_prims.json").read_text(encoding="utf-8"))
topo = json.loads((p / "si_model_topo_extra.json").read_text(encoding="utf-8"))
deform = json.loads((p / "si_model_deform.json").read_text(encoding="utf-8"))
props = json.loads((p / "si_model_property_commands.json").read_text(encoding="utf-8"))

def load_optional(name):
    fp = p / name
    if not fp.is_file():
        return None
    return json.loads(fp.read_text(encoding="utf-8"))

text = load_optional("si_text_golden.json")
generators = load_optional("si_generators_golden.json")
get_prop = load_optional("si_model_get_prop.json") or load_optional("si_model_get_prop_golden.json")
ref_dump = load_optional("si_model_ref.json") or load_optional("si_model_ref_golden.json")

topo_rows = []
for k, v in (topo.get("cases") or {}).items():
    params = v.get("params") or {}
    topo_rows.append({
        "case": k,
        "npts": v.get("npts"),
        "npolys": v.get("npolys"),
        "op_name": v.get("op_name"),
        "op_type": v.get("op_type"),
        "error": v.get("error"),
        "tried_alt": v.get("tried_alt"),
        "preset": v.get("preset"),
        "has_real_topo_params": bool(params) and "subdivu" not in params or (
            bool(v.get("op_type")) and "geom" not in str(v.get("op_type") or "").lower()
        ),
        "param_count": len(params),
    })

deform_rows = []
for k, v in (deform.get("cases") or {}).items():
    deform_rows.append({
        "preset": k,
        "ok": v.get("ok"),
        "helper": v.get("helper"),
        "connection": v.get("connection"),
        "note": v.get("note"),
        "op_name": v.get("op_name"),
        "op_type": v.get("op_type"),
        "npts": (v.get("mesh") or {}).get("npts"),
        "error": (v.get("error") or "")[:160],
        "param_count": len(v.get("params") or {}),
    })

prim_rows = []
for x in prims.get("primitives") or []:
    prim_rows.append({
        "kind": x.get("kind"),
        "geom": x.get("geom"),
        "ok": x.get("ok"),
        "npts": (x.get("mesh") or {}).get("npts"),
        "npolys": (x.get("mesh") or {}).get("npolys"),
        "subdivu": x.get("subdivu"),
        "error": x.get("error"),
    })

def text_rows(blob):
    if not blob:
        return []
    rows = []
    cases = blob.get("cases") or blob.get("variants") or blob.get("text")
    if cases is None:
        # si_text_golden.json shape: { meta, Curves, Planar, Solid }
        cases = []
        for k, v in blob.items():
            if k == "meta" or not isinstance(v, dict):
                continue
            if "ok" in v or "mesh" in v or "op_name" in v:
                cases.append({"variant": k, **v})
    if isinstance(cases, dict):
        cases = [{"variant": k, **(v if isinstance(v, dict) else {"raw": v})} for k, v in cases.items()]
    for x in cases:
        mesh = x.get("mesh") or {}
        summary = mesh.get("summary") or {}
        rows.append({
            "variant": x.get("variant") or x.get("name") or x.get("case"),
            "ok": x.get("ok"),
            "pts": x.get("pts") or x.get("npts") or summary.get("pts") or summary.get("npts"),
            "polys": x.get("polys") or x.get("npolys") or summary.get("polys") or summary.get("npolys"),
            "nbcurves": x.get("nbcurves") or summary.get("nbcurves"),
            "op_name": x.get("op_name"),
            "param_count": x.get("param_count") or len(x.get("params") or {}),
            "error": x.get("error") or mesh.get("error"),
            "notes": x.get("note") or x.get("notes") or (
                f"op={x.get('op_name')} params={x.get('param_count') or len(x.get('params') or {})}"
                if x.get("op_name") else None
            ),
        })
    return rows

def gen_rows(blob):
    if not blob:
        return []
    rows = []
    cases = blob.get("cases") or blob.get("generators") or []
    if isinstance(cases, dict):
        cases = [{"case": k, **(v if isinstance(v, dict) else {"raw": v})} for k, v in cases.items()]
    for x in cases:
        rows.append({
            "case": x.get("case") or x.get("name"),
            "ok": x.get("ok"),
            "preset": x.get("preset"),
            "pts": x.get("pts") or x.get("npts"),
            "op_name": x.get("op_name"),
            "param_count": x.get("param_count") or len(x.get("params") or {}),
            "error": (x.get("error") or "")[:120],
        })
    return rows

t_rows = text_rows(text)
g_rows = gen_rows(generators)

caphole = next((r for r in topo_rows if "caphole" in (r.get("case") or "").lower()), None)
extrude_axis = [r for r in topo_rows if "extrude_axis" in (r.get("case") or "")]
helper_deforms = [r for r in deform_rows if r.get("helper")]

summary = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "recipes": {
        "pr": 24,
        "caphole_after_delete": True,
        "extrude_component_axis": True,
        "deform_helpers": ["Lattice", "Wave", "Deform by Curve", "Deform by Spine"],
    },
    "master": master,
    "prims": prim_rows,
    "topo": topo_rows,
    "deform": deform_rows,
    "text": t_rows,
    "generators": g_rows,
    "property_cmd_count": (props.get("properties") or {}).get("count"),
    "files": sorted([f.name for f in p.iterdir() if f.is_file()]),
    "optional_present": {
        "si_text_golden.json": text is not None,
        "si_generators_golden.json": generators is not None,
        "get_prop": get_prop is not None,
        "ref": ref_dump is not None,
    },
}
(p / "model-dump-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

def md_escape(s):
    return (s or "").replace("|", "\\|").replace("\n", " ")

# CapHole / Extrude highlight table
highlight_lines = []
if caphole:
    highlight_lines.append(
        f"| CapHole-after-Delete | {caphole.get('npts')}/{caphole.get('npolys')} | "
        f"{caphole.get('op_name') or '—'} | {md_escape(str(caphole.get('error') or 'ok'))} |"
    )
for r in extrude_axis:
    highlight_lines.append(
        f"| {r['case']} | {r.get('npts')}/{r.get('npolys')} | "
        f"{r.get('op_name') or '—'} | {md_escape(str(r.get('error') or r.get('tried_alt') or 'ok'))} |"
    )

helper_lines = []
for r in helper_deforms:
    helper_lines.append(
        f"| {r['preset']} | {r.get('helper')} | {r.get('ok')} | "
        f"{r.get('npts')} | {md_escape(str(r.get('error') or r.get('note') or r.get('connection') or ''))} |"
    )

text_table = "\n".join(
    f"| {r.get('variant')} | {r.get('ok')} | {r.get('pts')}/{r.get('polys')} | "
    f"{md_escape(str(r.get('notes') or r.get('op_name') or ''))} |"
    for r in t_rows
) or "| — | — | — | no si_text_golden.json |"

gen_table = "\n".join(
    f"| {r.get('case')} | {r.get('ok')} | {r.get('preset')} | {r.get('pts')} | "
    f"{md_escape(str(r.get('error') or r.get('op_name') or ''))} |"
    for r in g_rows
) or "| — | — | — | — | no si_generators_golden.json |"

new_files = [n for n in summary["files"] if n.startswith("si_model_") and n not in {
    "si_model_goldens.json", "si_model_prims.json", "si_model_topo_extra.json",
    "si_model_deform.json", "si_model_property_commands.json", "si_model_goldens_dump.js",
}]

md = f"""# Softimage PC Model golden dumps

**Mode:** XSIBATCH `-processing` only — **no Softimage Desktop / GUI**.
**Install:** `C:\\Program Files\\Autodesk\\Softimage 2015 SP2`
**When:** {summary['generated_at']}
**Recipes:** PR #24 CapHole-after-Delete, ExtrudeComponentAxis / Extrude Along Axis, Lattice/Wave/Curve/Spine helpers

## Paths

| Role | Path |
|------|------|
| **Dump pack** | `internal/softimage-pc-dumps/model/` |
| Documents mirror | `%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\` |
| Scripts | `docs/dump-factory/si_model_goldens_dump.js`, `si_text_dump.js`, `si_generators_dump.js`, `si_topo_params_dump.js` |
| Runner | `docs/dump-factory/Run-DumpFactory.bat model` or `Run-DumpFactory-Model.bat` |
| UI dumps | **STOPPED** — see `internal/softimage-pc-dumps/ui/PARTIAL-STOPPED.md` |

## Artifacts

| File | Purpose |
|------|---------|
| `si_model_goldens.json` | Master index + counts |
| `si_model_prims.json` | Get-primitive defaults (Cube/Sphere/Grid/... + Null) + mesh |
| `si_model_topo_extra.json` | Extra topology ApplyTopoOp (+ CapHole-after-Delete, ExtrudeComponentAxis) |
| `si_model_deform.json` | Deform ApplyOp; Lattice/Wave/Curve/Spine use helper connection sets |
| `si_model_property_commands.json` | Property-related command inventory |
| `si_topo_ref_params.json` | Bevel / Bevel_edges / PolyReduction / Dice params dump |
| `si_text_golden.json` | CreateText Curves / Planar / Solid |
| `si_generators_golden.json` | Extrusion / Loft / Revolution ApplyGenOp probes |
| `model-dump-summary.json` | Compact harness-facing summary |

## Summary counts

- Prims OK: **{sum(1 for x in prim_rows if x['ok'])}** / {len(prim_rows)}
- Topo cases: **{len(topo_rows)}** (with op_name: {sum(1 for x in topo_rows if x.get('op_name'))})
- Deform ApplyOp OK: **{sum(1 for x in deform_rows if x['ok'])}** / {len(deform_rows)}
- Property-ish commands: **{summary['property_cmd_count']}**
- Text variants OK: **{sum(1 for x in t_rows if x.get('ok'))}** / {len(t_rows) or 0}
- Generator cases OK: **{sum(1 for x in g_rows if x.get('ok'))}** / {len(g_rows) or 0}

### PR #24 highlights (CapHole / Extrude axis)

| Case | pts/polys | op | notes |
|------|-----------|----|-------|
{chr(10).join(highlight_lines) if highlight_lines else "| — | — | — | not present |"}

### Deform helpers (Lattice / Wave / Curve / Spine)

| Preset | helper | ok | npts | notes |
|--------|--------|----|------|-------|
{chr(10).join(helper_lines) if helper_lines else "| — | — | — | — | not present |"}

### Text (`si_text_golden.json`)

| Variant | OK | pts/polys | notes |
|---------|----|-----------|-------|
{text_table}

### Generators (`si_generators_golden.json`)

| Case | OK | preset | pts | notes |
|------|----|--------|-----|-------|
{gen_table}

## Headless recipe notes (this pass)

| Target | Working headless path |
|--------|----------------------|
| CapHole | `ApplyTopoOp DeleteComponent` → `ApplyICEOp("Cap Hole")` → set `Vertex_Index=0` (CapHole cmd / ApplyTopoOp Cap Hole fail under `-processing`) |
| Extrude Along Axis | `ApplyTopoOp ExtrudeComponentAxis` on `obj.poly[0]` → `extrudecompaxisop` (23 params); `lastOp` skips markers/geom |
| Lattice / Wave | `GetPrim("Lattice"|"Wave")` then `ApplyOp(preset, "mesh;helper")` — `CreatePrim` Lattice/Wave fails |
| Deform by Curve | `ApplyOp("CrvDeform", "mesh;circle")` |
| Deform by Spine | `ApplyDeformBySpine("mesh;circle", 0)` |

## Headless limits (blocked without interactive Softimage)

1. Many `ApplyTopoOp` presets under `-processing` still attach geom history only (same class of gap as prior `si_topo_ref_params` — operator `params` may be subdiv fallbacks). `topo_with_op` now counts real ops only (markers/geom skipped).
2. Multi-input deform helpers now land via GetPrim / CrvDeform / ApplyDeformBySpine; meshes may still be undeformed at defaults until helper transforms are driven.
3. Get Property **preset SPDL value tables** are install files (`Application/spdl`) — not fully expanded in this OM dump; command inventory only.
4. **Generators**: ExtrusionAlongAxis / Extrusion / RevolutionAlongAxis may create objects with unavailable `ActivePrimitive.Geometry` under `-processing`. Mesh Loft + NURBS Loft often fail headless.
5. Text: Curves is usually usable; Planar/Solid may return converters without readable mesh under `-processing`. Font PPG / glyph picking is interactive-only.

## Re-run

```bat
docs\\dump-factory\\Run-DumpFactory.bat model
```

or `Run-DumpFactory-Model.bat` (includes pack). Always `call` before XSIBATCH. **ASCII-only JScript** (UTF-16 / non-ASCII fails parse).

Then pack copies `%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\*` into `internal/softimage-pc-dumps/model/`.

## Worker

Scheduled Task `Cursor Softimage PC Worker` kept **Running**.
"""
(docs / "softimage-pc-model-dumps.md").write_text(md, encoding="utf-8")

# Keep repo tools copy in sync for local Softimage-Direct consumers when present.
repo_pack = Path(r"C:\Users\neil\Softimage-Direct\tools\dump-factory\pack_model_dumps.py")
if repo_pack.parent.is_dir():
    shutil.copy2(Path(__file__), repo_pack)

print(json.dumps({
    "prim_ok": sum(1 for x in prim_rows if x["ok"]),
    "prim_n": len(prim_rows),
    "topo_n": len(topo_rows),
    "topo_with_op": sum(1 for x in topo_rows if x.get("op_name")),
    "deform_ok": sum(1 for x in deform_rows if x["ok"]),
    "deform_n": len(deform_rows),
    "caphole": caphole,
    "extrude_axis_cases": [r["case"] for r in extrude_axis],
    "helper_ok": sum(1 for x in helper_deforms if x.get("ok")),
    "helper_n": len(helper_deforms),
    "text_ok": sum(1 for x in t_rows if x.get("ok")),
    "gen_ok": sum(1 for x in g_rows if x.get("ok")),
    "props": summary["property_cmd_count"],
    "new_or_extra_files": new_files,
}, indent=2))
