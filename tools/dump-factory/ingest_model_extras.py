#!/usr/bin/env python3
"""Ingest softimage-pc model-extras dumps into Softimage-Direct goldens.

Reads Project-store (or local) JSON from model-extras and updates:
  - src/data/si/text_softimage_curves.json (+ data/dump mirror) from si_text_curves_detail.json
  - data/dump/si_model_ops_counts.json boolean.si / note from si_boolean_mesh_golden.json
  - data/dump/si_emdl_delta_bytes.json copy from si_emdl_delta_bytes.json

Usage:
  python tools/dump-factory/ingest_model_extras.py \\
    [--src /path/to/internal/softimage-pc-dumps/model-extras] \\
    [--repo /path/to/Softimage-Direct]
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def load(p: Path):
    if not p.is_file():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def ingest_text(detail: dict, repo: Path) -> str:
    curves_in = detail.get("curves") or detail.get("Curves") or {}
    # Accept top-level, Curves, or Curves.curves_detail (XSIBATCH dump shape)
    if isinstance(detail.get("Curves"), dict):
        curves_in = detail["Curves"]
        if isinstance(curves_in.get("curves_detail"), dict):
            curves_in = {**curves_in, **curves_in["curves_detail"]}
    rows = curves_in.get("curves") or []
    if not rows and isinstance(detail.get("curves"), list):
        rows = detail["curves"]
        curves_in = detail
    ok_rows = [r for r in rows if (r.get("ok") is not False) and (r.get("cvs") or r.get("count", 0) >= 2)]
    if not ok_rows:
        return "text: no per-curve cvs yet"
    curves = []
    npts = 0
    for i, r in enumerate(ok_rows):
        cvs = r.get("cvs") or []
        curves.append({
            "index": r.get("index", i),
            "count": len(cvs),
            "cvs": cvs,
            "closed": bool(r.get("closed", True)),
            "degree": r.get("degree"),
            "source": r.get("source"),
        })
        npts += len(cvs)
    out = {
        "meta": {
            "source": "si_text_curves_detail.json",
            "softimage_nbcurves": curves_in.get("nbcurves", len(curves)),
            "partition": "Geometry.Curves",
            "per_curve_lengths_sum": curves_in.get("per_curve_lengths_sum", npts),
        },
        "text": detail.get("text") or curves_in.get("text") or "Softimage",
        "params": (detail.get("params") or curves_in.get("params") or {}),
        "nbcurves": len(curves),
        "npts": npts,
        "curves": curves,
    }
    for rel in ("src/data/si/text_softimage_curves.json", "data/dump/si_text_softimage_curves.json"):
        path = repo / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    return f"text: nbcurves={len(curves)} npts={npts}"


def ingest_boolean(golden: dict, repo: Path) -> str:
    counts_path = repo / "data/dump/si_model_ops_counts.json"
    counts = json.loads(counts_path.read_text(encoding="utf-8"))
    cases = golden.get("cases") or golden
    updated = []
    for key, leaf in (("Difference", "Difference"), ("Union", "Union"), ("Intersection", "Intersect")):
        c = cases.get(key) or cases.get(leaf) or cases.get(f"Boolean_{key}")
        if not c:
            continue
        mesh = c.get("mesh") or c.get("result") or c
        npts = mesh.get("npts") or mesh.get("points") or (mesh.get("summary") or {}).get("pts")
        npolys = mesh.get("npolys") or mesh.get("polys") or (mesh.get("summary") or {}).get("polys")
        if npts is None:
            continue
        slot = counts.setdefault("boolean", {}).setdefault(key, {})
        slot["si"] = {
            "cube": {"points": npts, "polys": npolys},
            "from": "si_boolean_mesh_golden.json",
        }
        updated.append(f"{key}={npts}/{npolys}")
    counts_path.write_text(json.dumps(counts, indent=2) + "\n", encoding="utf-8")
    return "boolean: " + (", ".join(updated) if updated else "no cases")


def ingest_emdl(blob: dict, repo: Path, src_file: Path) -> str:
    dest = repo / "data/dump/si_emdl_delta_bytes.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_file, dest)
    emdl = (blob.get("cases") or blob).get("export_model") or blob.get("emdl") or {}
    delta = (blob.get("cases") or blob).get("export_delta") or blob.get("delta") or {}
    return f"emdl: size={emdl.get('size')} magic={str(emdl.get('magic_hex') or emdl.get('hex') or '')[:16]}… delta_size={delta.get('size')}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--src",
        type=Path,
        default=Path("/cursor/stores/self/internal/softimage-pc-dumps/model-extras"),
    )
    ap.add_argument("--repo", type=Path, default=Path(".").resolve())
    args = ap.parse_args()
    src: Path = args.src
    if not src.is_dir():
        # fall back to absolute Project store id path
        alt = Path("/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/model-extras")
        src = alt if alt.is_dir() else src
    print(f"ingest from {src}")
    notes = []
    text = load(src / "si_text_curves_detail.json")
    if text:
        notes.append(ingest_text(text, args.repo))
    else:
        notes.append("text: waiting for si_text_curves_detail.json")
    boolj = load(src / "si_boolean_mesh_golden.json")
    if boolj:
        notes.append(ingest_boolean(boolj, args.repo))
    else:
        notes.append("boolean: waiting for si_boolean_mesh_golden.json")
    emdl = load(src / "si_emdl_delta_bytes.json")
    if emdl:
        notes.append(ingest_emdl(emdl, args.repo, src / "si_emdl_delta_bytes.json"))
    else:
        notes.append("emdl: waiting for si_emdl_delta_bytes.json")
    for n in notes:
        print(n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
