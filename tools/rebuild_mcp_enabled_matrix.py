#!/usr/bin/env python3
"""Rebuild src/data/si/mcp_enabled_matrix.json from softimage-pc ui dumps.

Prefer Agent Store dumps when present; else data/dump/.
Consumes:
  - si_mcp_enabled_matrix.json (assembled PE + XSIBATCH)
  - optional si_mcp_hwnd_enabled.json (Script Editor paste)
Also stamps menus.json grayed=true when item id is in PE f_grayed cmds.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORE_UI = Path(
    "/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/ui"
)
DUMP = ROOT / "data" / "dump"
OUT = ROOT / "src" / "data" / "si" / "mcp_enabled_matrix.json"
MENUS = ROOT / "src" / "data" / "si" / "menus.json"

DENY = {
    "both",
    "clear",
    "dynamic",
    "inertia",
    "spring",
    "nail",
    "symmetry",
    "operators...",
    "pendulum",
    "collision",
    "n-points",
    "polynode",
    "align",
    "distribute",
}


def norm(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("&", "")).strip().lower()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def find_matrix() -> Path:
    for p in (STORE_UI / "si_mcp_enabled_matrix.json", DUMP / "si_mcp_enabled_matrix.json"):
        if p.exists():
            return p
    raise SystemExit("si_mcp_enabled_matrix.json not found")


def find_hwnd() -> Path | None:
    for p in (STORE_UI / "si_mcp_hwnd_enabled.json", DUMP / "si_mcp_hwnd_enabled.json"):
        if p.exists():
            return p
    return None


def main() -> int:
    full = load_json(find_matrix())
    xsibatch = full.get("xsibatch_command_enabled_matrix") or {}

    greys = []
    for g in full.get("pe_static_grayed_defaults") or []:
        n = norm(g.get("label"))
        greys.append(
            {
                "menu": g.get("menu"),
                "label": g.get("label"),
                "cmd": g.get("cmd"),
                "norm": n,
            }
        )

    norm_counts = Counter(g["norm"] for g in greys)
    safe_norms = sorted(
        {
            g["norm"]
            for g in greys
            if g["norm"]
            and g["norm"] not in DENY
            and norm_counts[g["norm"]] == 1
            and (len(g["norm"]) >= 12 or " " in g["norm"])
        }
    )
    ambiguous = sorted({g["norm"] for g in greys if g["norm"] not in set(safe_norms)})
    cmds = sorted({g["cmd"] for g in greys if isinstance(g.get("cmd"), int)})

    contexts = {}
    bool_attested: set[str] = set()
    for cid, block in xsibatch.items():
        cmds_map = {}
        for name, row in (block.get("enabled") or {}).items():
            en = row.get("enabled") if isinstance(row, dict) else row
            cmds_map[name] = None if en is None else bool(en)
            if en is True or en is False:
                bool_attested.add(name)
        contexts[cid] = {"selection": block.get("selection"), "commands": cmds_map}

    out: dict = {
        "meta": {
            "softimage": (full.get("xsibatch_meta") or {}).get("softimage")
            or full.get("meta", {}).get("xsibatch_softimage"),
            "source": "si_mcp_enabled_matrix.json",
            "mode": full.get("meta", {}).get("mode"),
            "note": "XSIBATCH Command.Enabled bools where non-null; null falls back to Direct canRun. PE f_grayed: prefer cmd id, safe unique labels only.",
            "pe_gray_policy": "cmd_id_first_then_safe_norm",
        },
        "contexts": contexts,
        "command_aliases": {
            "TranslateTool": "Translate",
            "RotateTool": "Rotate",
            "ScaleTool": "Scale",
        },
        "pe_static_grayed": greys,
        "pe_grayed_cmds": cmds,
        "pe_grayed_safe_norms": safe_norms,
        "pe_grayed_ambiguous_norms": ambiguous,
        "bool_attested": sorted(bool_attested),
    }

    hwnd_path = find_hwnd()
    if hwnd_path:
        hwnd = load_json(hwnd_path)
        # Overnight Desktop dump shape: contexts[].buttons / contexts[].commands
        # Legacy paste shape: top-level hwnd_buttons
        buttons = hwnd.get("hwnd_buttons")
        if not (isinstance(buttons, dict) and buttons) and isinstance(hwnd.get("contexts"), list):
            buttons = {}
            for c in hwnd["contexts"]:
                cid = c.get("id")
                if not cid:
                    continue
                row = c.get("buttons") or {}
                buttons[cid] = {k: (None if v is None else bool(v)) for k, v in row.items()}
                # Merge Command.Enabled bools into matrix contexts (attested only)
                block = out["contexts"].setdefault(cid, {"selection": c.get("selection"), "commands": {}})
                cmds_map = block.setdefault("commands", {})
                for name, info in (c.get("commands") or {}).items():
                    en = info.get("enabled") if isinstance(info, dict) else info
                    if en is True or en is False:
                        if name not in cmds_map or cmds_map[name] is None:
                            cmds_map[name] = bool(en)
                            bool_attested.add(name)
            out["bool_attested"] = sorted(bool_attested)
        if isinstance(buttons, dict) and buttons:
            out["hwnd_buttons"] = buttons
            out["meta"]["hwnd_source"] = str(hwnd_path.name)
            out["meta"]["hwnd_overlay"] = {
                "source": str(hwnd_path),
                "softimage": (hwnd.get("meta") or {}).get("softimage"),
                "mode": (hwnd.get("meta") or {}).get("mode"),
                "note": (hwnd.get("meta") or {}).get("note"),
                "utc": (hwnd.get("meta") or {}).get("utc"),
                "contexts": list(buttons.keys()),
                "attested_button_bools": sum(
                    1 for row in buttons.values() for v in row.values() if v is True or v is False
                ),
                "null_button_cells": sum(1 for row in buttons.values() for v in row.values() if v is None),
            }

    OUT.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} contexts={list(contexts)} bools={sorted(bool_attested)} cmds={len(cmds)} hwnd={bool(out.get('hwnd_buttons'))}")

    if MENUS.exists():
        menus = load_json(MENUS)
        cmdset = set(cmds)
        stamped = 0

        def stamp(obj):
            nonlocal stamped
            if isinstance(obj, dict):
                if isinstance(obj.get("id"), int) and obj["id"] in cmdset and not obj.get("items"):
                    if not obj.get("grayed"):
                        obj["grayed"] = True
                        stamped += 1
                for v in obj.values():
                    stamp(v)
            elif isinstance(obj, list):
                for v in obj:
                    stamp(v)

        stamp(menus)
        MENUS.write_text(json.dumps(menus, indent=0) + "\n", encoding="utf-8")
        print(f"stamped menus.json grayed={stamped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
