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


STORE_ANIM = Path(
    "/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim"
)
STORE_RENDER = Path(
    "/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/render"
)


def find_anim_hwnd() -> Path | None:
    for p in (STORE_ANIM / "si_anim_hwnd_chrome.json", DUMP / "si_anim_hwnd_chrome.json"):
        if p.exists():
            return p
    return None


def find_render_desktop_tour() -> Path | None:
    for p in (
        STORE_RENDER / "desktop_tour_commands.json",
        DUMP / "desktop_tour_commands.json",
        ROOT / "src" / "data" / "si" / "render_desktop_command_enabled.json",
    ):
        if p.exists():
            return p
    return None


def merge_render_desktop_tour_commands(out: dict, bool_attested: set[str], tour: dict) -> None:
    """Merge Desktop tour Command.Enabled by unique ScriptingName into empty context.

    Softimage indexes some specialty passes (Curve/Surface Pass) with ScriptingName ApplyOp
    and Enabled=false; do not demote shared ApplyOp from those rows.
    """
    from collections import Counter

    commands = tour.get("commands") or {}
    # Compact inventory shape: enabled_by_scriptingname already unique
    if "enabled_by_scriptingname" in tour and isinstance(tour["enabled_by_scriptingname"], dict):
        merged = {k: bool(v) for k, v in tour["enabled_by_scriptingname"].items() if v is True or v is False}
        skipped = []
    else:
        sn_count: Counter[str] = Counter()
        rows: list[tuple[str, str, bool | None]] = []
        for name, v in commands.items():
            if not isinstance(v, dict) or not v.get("found"):
                continue
            sn = v.get("scriptingname") or name
            sn_count[sn] += 1
            en = v.get("enabled")
            rows.append((sn, name, en if isinstance(en, bool) else None))
        merged = {}
        skipped = []
        for sn, name, en in rows:
            if en is None:
                continue
            if en is False and (sn_count[sn] > 1 or sn == "ApplyOp"):
                skipped.append({"scriptingname": sn, "name": name, "enabled": en})
                continue
            if sn in merged and merged[sn] != en:
                if en is True:
                    merged[sn] = True
                skipped.append({"scriptingname": sn, "name": name, "enabled": en, "reason": "conflict"})
            else:
                merged[sn] = bool(en)

    empty = out["contexts"].setdefault("empty", {"selection": None, "commands": {}})
    cmds_map = empty.setdefault("commands", {})
    added = 0
    for sn, en in sorted(merged.items()):
        if sn not in cmds_map or cmds_map[sn] is None:
            cmds_map[sn] = bool(en)
            bool_attested.add(sn)
            added += 1
        elif en is True and cmds_map[sn] is not True:
            # Prefer attested Enabled=true over stale false/null
            cmds_map[sn] = True
            bool_attested.add(sn)
            added += 1
        elif cmds_map[sn] is True or cmds_map[sn] is False:
            bool_attested.add(sn)
    out["bool_attested"] = sorted(bool_attested)
    out["meta"]["render_desktop_tour"] = {
        "source": str((tour.get("meta") or {}).get("script") or "desktop_tour_commands.json"),
        "softimage": (tour.get("meta") or {}).get("softimage") or "13.2.163.0",
        "mode": "empty-scene Command.Enabled + ScriptingName",
        "utc": (tour.get("meta") or {}).get("utc"),
        "commands_rows": len(commands) or len(tour.get("rows") or []),
        "merged_unique_scriptingnames": len(merged),
        "added_to_empty": added,
        "skipped": skipped,
        "note": "Merge unique ScriptingName→Enabled into empty; skip shared ApplyOp false (Curve/Surface Pass)",
    }


def merge_command_enabled_contexts(out: dict, bool_attested: set[str], dump: dict) -> None:
    """Merge Softimage Command.Enabled bools from a contexts[] dump (attested only)."""
    for c in dump.get("contexts") or []:
        cid = c.get("id")
        if not cid:
            continue
        block = out["contexts"].setdefault(cid, {"selection": c.get("selection"), "commands": {}})
        if c.get("selection") is not None:
            block["selection"] = c["selection"]
        cmds_map = block.setdefault("commands", {})
        for name, info in (c.get("commands") or {}).items():
            en = info.get("enabled") if isinstance(info, dict) else info
            if en is True or en is False:
                if name not in cmds_map or cmds_map[name] is None:
                    cmds_map[name] = bool(en)
                    bool_attested.add(name)
            elif name not in cmds_map:
                cmds_map[name] = None
    out["bool_attested"] = sorted(bool_attested)


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
            merge_command_enabled_contexts(out, bool_attested, hwnd)
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

    render_tour_path = find_render_desktop_tour()
    if render_tour_path:
        merge_render_desktop_tour_commands(out, bool_attested, load_json(render_tour_path))
        print(f"merged render desktop tour {render_tour_path.name}")

    anim_hwnd_path = find_anim_hwnd()
    if anim_hwnd_path:
        anim = load_json(anim_hwnd_path)
        merge_command_enabled_contexts(out, bool_attested, anim)
        def seed_ctx(src: str, dst: str, sel: dict) -> None:
            src_cmds = (out["contexts"].get(src) or {}).get("commands") or {}
            dst_cmds = out["contexts"].setdefault(dst, {"selection": sel, "commands": {}}).setdefault("commands", {})
            for name, en in src_cmds.items():
                if (en is True or en is False) and (name not in dst_cmds or dst_cmds[name] is None):
                    dst_cmds[name] = bool(en)
                    bool_attested.add(name)

        # keyed_null → single_null; mesh_skeleton → multi_mesh/multi_mixed
        seed_ctx("keyed_null", "single_null", {"count": 1})
        seed_ctx("mesh_skeleton", "multi_mesh", {"count": 4})
        seed_ctx("mesh_skeleton", "multi_mixed", {"count": 4})
        out["bool_attested"] = sorted(bool_attested)
        em = anim.get("enabled_matrix") or {}
        out["meta"]["anim_hwnd_overlay"] = {
            "source": str(anim_hwnd_path),
            "softimage": (anim.get("meta") or {}).get("softimage"),
            "mode": (anim.get("meta") or {}).get("mode"),
            "utc": (anim.get("meta") or {}).get("utc"),
            "wire_note": (anim.get("meta") or {}).get("wire_note"),
            "note": (anim.get("meta") or {}).get("note"),
            "contexts": list(em.keys()) or (anim.get("acceptance") or {}).get("contexts"),
            "attested_command_bools": sum(
                1
                for ctx in em.values()
                for v in ctx.values()
                if isinstance(v, dict) and (v.get("enabled") is True or v.get("enabled") is False)
            ),
            "null_command_cells": sum(
                1 for ctx in em.values() for v in ctx.values() if isinstance(v, dict) and v.get("enabled") is None
            ),
            "openview_api_avoided": (anim.get("acceptance") or {}).get("openview_api_avoided"),
            "openview_av": (anim.get("acceptance") or {}).get("openview_av_after_commands"),
            "n_views_opened": (anim.get("acceptance") or {}).get("n_views_opened"),
            "view_probe_lock": "Open* Commands failed / OpenView API avoided — no invent view chrome",
            "screenshot_checklist": anim.get("screenshot_checklist"),
        }

    OUT.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {OUT} contexts={list(out['contexts'])} bools={len(out['bool_attested'])} cmds={len(cmds)} "
        f"hwnd={bool(out.get('hwnd_buttons'))} anim_hwnd={bool(out['meta'].get('anim_hwnd_overlay'))}"
    )

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
