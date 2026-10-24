#!/usr/bin/env python3
"""Merge softimage-pc SPDL PPG layouts into data/spdl/spdl.json and rebuild opdefs.

Heals LabelWidth(80%, 10) comma-splits from older parse_spdl dumps.
Does not touch PPG shell chrome — Model layout trees only.

Usage:
  python3 tools/merge_model_spdl_layouts.py [path/to/spdl-layouts-model-ui.json]
  python3 tools/build_opdefs.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DUMP = Path(
    "/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/dialogs/spdl-layouts-model-ui.json"
)
TREE = ROOT / "data/spdl/spdl.json"


def heal_opts(opts):
    if not opts:
        return opts
    out, i = [], 0
    while i < len(opts):
        o = opts[i]
        if o.count("(") > o.count(")"):
            buf = o
            i += 1
            while i < len(opts) and buf.count("(") > buf.count(")"):
                buf += ", " + opts[i]
                i += 1
            out.append(buf)
            continue
        out.append(o)
        i += 1
    norm = []
    for o in out:
        low = o.lower()
        if low == "alignright":
            norm.append("AlignRight")
        elif low == "aligncenter":
            norm.append("AlignCenter")
        elif low == "nolabel":
            norm.append("NoLabel")
        elif low == "noslider":
            norm.append("NoSlider")
        elif low == "valueonly":
            norm.append("ValueOnly")
        else:
            norm.append(o)
    return norm


def heal_layout(nodes):
    out = []
    for n in nodes or []:
        n = dict(n)
        if "opts" in n:
            n["opts"] = heal_opts(n["opts"])
        if "items" in n:
            n["items"] = heal_layout(n["items"])
        out.append(n)
    return out


def main():
    dump_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DUMP
    if not dump_path.is_file():
        print("missing dump", dump_path, file=sys.stderr)
        return 2
    dump = json.load(dump_path.open())["spdl"]
    tree = json.load(TREE.open())
    updated = 0
    for fname, entry in dump.items():
        lay = heal_layout(entry.get("layout") or [])
        if fname not in tree:
            continue
        if lay:
            tree[fname]["layout"] = lay
            updated += 1
        for k in ("propset", "ref", "help"):
            if entry.get(k) and not tree[fname].get(k):
                tree[fname][k] = entry[k]
    TREE.write_text(json.dumps(tree, indent=0))
    print(f"updated {updated} layouts from {dump_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
