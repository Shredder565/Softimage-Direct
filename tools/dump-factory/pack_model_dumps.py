import json
from pathlib import Path
from datetime import datetime, timezone

STORE = Path(r"C:\Users\neil\AppData\Local\Cursor\AgentStores\cursor_agent_stores\bc-0bd1d332-4e49-4056-9894-1b21507c9f95\files")
p = STORE / "internal" / "softimage-pc-dumps" / "model"
docs = STORE / "docs"

master = json.loads((p / "si_model_goldens.json").read_text(encoding="utf-8"))
prims = json.loads((p / "si_model_prims.json").read_text(encoding="utf-8"))
topo = json.loads((p / "si_model_topo_extra.json").read_text(encoding="utf-8"))
deform = json.loads((p / "si_model_deform.json").read_text(encoding="utf-8"))
props = json.loads((p / "si_model_property_commands.json").read_text(encoding="utf-8"))

topo_rows = []
for k, v in (topo.get("cases") or {}).items():
    topo_rows.append({
        "case": k,
        "npts": v.get("npts"),
        "npolys": v.get("npolys"),
        "op_name": v.get("op_name"),
        "op_type": v.get("op_type"),
        "error": v.get("error"),
        "tried_alt": v.get("tried_alt"),
        "has_real_topo_params": bool(v.get("params")) and "subdivu" not in (v.get("params") or {}) or (
            bool(v.get("op_type")) and "geom" not in str(v.get("op_type") or "").lower()
        ),
        "param_count": len(v.get("params") or {}),
    })

deform_rows = []
for k, v in (deform.get("cases") or {}).items():
    deform_rows.append({
        "preset": k,
        "ok": v.get("ok"),
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

summary = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "master": master,
    "prims": prim_rows,
    "topo": topo_rows,
    "deform": deform_rows,
    "property_cmd_count": (props.get("properties") or {}).get("count"),
    "files": sorted([f.name for f in p.iterdir() if f.is_file()]),
}
(p / "model-dump-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

# docs
md = f"""# Softimage PC Model golden dumps

**Mode:** XSIBATCH `-processing` only — **no Softimage Desktop / GUI**.
**Install:** `C:\\Program Files\\Autodesk\\Softimage 2015 SP2`
**When:** {summary['generated_at']}

## Paths

| Role | Path |
|------|------|
| **Dump pack** | `internal/softimage-pc-dumps/model/` |
| Documents mirror | `%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\` |
| Script | `docs/dump-factory/si_model_goldens_dump.js` |
| Prior topo params | `model/si_topo_ref_params.json` (copied) |
| UI dumps | **STOPPED** — see `internal/softimage-pc-dumps/ui/PARTIAL-STOPPED.md` |

## Artifacts

| File | Purpose |
|------|---------|
| `si_model_goldens.json` | Master index + counts |
| `si_model_prims.json` | Get-primitive defaults (Cube/Sphere/Grid/… + Null) + mesh |
| `si_model_topo_extra.json` | Extra topology ApplyTopoOp cases beyond Bevel/Dice/PolyReduce |
| `si_model_deform.json` | Deform preset ApplyOp attempts on 3x3x3 cube |
| `si_model_property_commands.json` | Property-related command inventory |
| `si_topo_ref_params.json` | Existing Bevel/Bevel_edges/PolyReduction/Dice params dump |
| `model-dump-summary.json` | Compact harness-facing summary |
| `probe_cmds.json` | Prior Model/Get command probe (298 hits) |

## Summary counts

- Prims OK: **{sum(1 for x in prim_rows if x['ok'])}** / {len(prim_rows)}
- Topo cases: **{len(topo_rows)}** (with op_name: {sum(1 for x in topo_rows if x.get('op_name'))})
- Deform ApplyOp OK: **{sum(1 for x in deform_rows if x['ok'])}** / {len(deform_rows)}
- Property-ish commands: **{summary['property_cmd_count']}**

## Headless limits (blocked without interactive Softimage)

1. Many `ApplyTopoOp` presets under `-processing` still attach geom history only (same class of gap as prior `si_topo_ref_params` — operator `params` may be subdiv fallbacks).
2. Some deform presets need extra inputs (Wave target, Deform by Curve/Spine) — failed under object-only ApplyOp.
3. Get Property **preset SPDL value tables** are install files (`Application/spdl`) — not fully expanded in this OM dump; command inventory only.
4. Text / multi-input generators (Loft, Birail, Boolean) need multi-object setups — not in this pass.

## Re-run

```bat
call "%ProgramFiles%\\Autodesk\\Softimage 2015 SP2\\Application\\bin\\XSIBATCH.bat" -processing -script docs\\dump-factory\\si_model_goldens_dump.js -lang JScript
```

Then copy `%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\*` into `internal/softimage-pc-dumps/model/`.

## Worker

Scheduled Task `Cursor Softimage PC Worker` kept **Running**.
"""
(docs / "softimage-pc-model-dumps.md").write_text(md, encoding="utf-8")
print(json.dumps({
    "prim_ok": sum(1 for x in prim_rows if x["ok"]),
    "prim_n": len(prim_rows),
    "topo_n": len(topo_rows),
    "topo_with_op": sum(1 for x in topo_rows if x.get("op_name")),
    "deform_ok": sum(1 for x in deform_rows if x["ok"]),
    "deform_n": len(deform_rows),
    "props": summary["property_cmd_count"],
}, indent=2))