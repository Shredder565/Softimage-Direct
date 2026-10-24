#!/usr/bin/env python3
"""File-based PE menu scrape for Softimage 2015 SP2 — no Softimage UI / no computer-use.

Reads RT_MENU (+ STRINGTABLE / dialogs) from install binaries so Render / Simulate /
ICE / Hair module trees and menubar leaves can be recovered when softimage-pc is online.

Default install:
  C:\\Program Files\\Autodesk\\Softimage 2015 SP2

Usage (on the Windows Softimage PC, or any machine with a copy of Application\\bin):
  python pe_scrape_module_menus.py
  python pe_scrape_module_menus.py --si "D:\\Softimage 2015 SP2"
  python pe_scrape_module_menus.py --si "C:\\Program Files\\Autodesk\\Softimage 2015 SP2" -o pe_module_menus.json

Requires pe_resources.py on PYTHONPATH or next to this file / in Softimage-Direct tools/.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Resolve pe_resources: dump-factory sibling, Softimage-Direct tools/, or cwd.
_HERE = Path(__file__).resolve().parent
for cand in (_HERE, _HERE.parent, _HERE.parent.parent / "tools", Path.cwd(), Path.cwd() / "tools"):
    if (cand / "pe_resources.py").is_file():
        sys.path.insert(0, str(cand))
        break

try:
    import pe_resources
except ImportError:
    sys.stderr.write(
        "ERROR: cannot import pe_resources.py — copy Softimage-Direct tools/pe_resources.py "
        "next to this script or run from the Softimage-Direct repo.\n"
    )
    sys.exit(2)

# Binaries known (or suspected) to hold menubar / module-toolbar MENU resources.
# toolbar.dll / toolbarobj.dll / siuitasks.dll / XSI.exe are the usual homes for
# Model/Animate/Render/Simulate/ICE/Hair trees; we scrape every candidate that exists.
CANDIDATES = [
    "XSI.exe",
    "toolbar.dll",
    "toolbarobj.dll",
    "siuitasks.dll",
    "siviewtasks.dll",
    "uiut.dll",
    "mcp.dll",
    "vm.dll",
    "viewcontrol.dll",
    "viewinteraction.dll",
    "genppg.dll",
    "sceneexplorer.dll",
    "prefs.dll",
    "manipulators.dll",
    "transformmanager.dll",
]


def clean_label(text: str) -> str:
    # Softimage MENU resources use & for accelerators; && is a literal &.
    t = (text or "").replace("&&", "\x00").replace("&", "").replace("\x00", "&")
    label, _, accel = t.partition("\t")
    return label.strip(), accel.strip() or None


def clean_tree(tree):
    out = []
    for it in tree:
        if it.get("separator"):
            out.append({"separator": True})
            continue
        label, accel = clean_label(it.get("label") or "")
        n = {"label": label, "id": it.get("id")}
        if accel:
            n["accel"] = accel
        if it.get("items"):
            n["items"] = clean_tree(it["items"])
        out.append(n)
    return out


def flatten_leaves(tree, path=None):
    path = path or []
    leaves = []
    for it in tree:
        if it.get("separator"):
            continue
        label = it.get("label") or ""
        p = path + [label]
        if it.get("items"):
            leaves.extend(flatten_leaves(it["items"], p))
        else:
            leaves.append({"path": "/".join(p), "label": label, "id": it.get("id"), "accel": it.get("accel")})
    return leaves


MODULE_HINTS = ("model", "animate", "render", "simulate", "ice", "hair", "fur", "fx")


def score_module_menu(tree) -> list[str]:
    """Return which Softimage modules this MENU resource likely belongs to (by label text)."""
    hits = set()

    def walk(nodes):
        for it in nodes:
            if it.get("separator"):
                continue
            lab = (it.get("label") or "").lower()
            for h in MODULE_HINTS:
                if h in lab:
                    hits.add(h)
            if it.get("items"):
                walk(it["items"])

    walk(tree)
    return sorted(hits)


def main():
    ap = argparse.ArgumentParser(description="Scrape Softimage PE RT_MENU resources (file-based).")
    ap.add_argument(
        "--si",
        default=r"C:\Program Files\Autodesk\Softimage 2015 SP2",
        help="Softimage 2015 SP2 install root",
    )
    ap.add_argument("-o", "--output", default="pe_module_menus.json", help="Output JSON path")
    ap.add_argument("--bin", default=None, help="Override Application/bin path")
    args = ap.parse_args()

    bin_dir = Path(args.bin) if args.bin else Path(args.si) / "Application" / "bin"
    if not bin_dir.is_dir():
        sys.stderr.write(f"ERROR: bin dir not found: {bin_dir}\n")
        sys.exit(1)

    allr = {}
    module_candidates = {}
    menubar_leaves = []

    for name in CANDIDATES:
        path = bin_dir / name
        if not path.is_file():
            # Also try Application/bin/nt-x86-64 style layouts if present.
            alt = bin_dir / "nt-x86-64" / name
            path = alt if alt.is_file() else path
        if not path.is_file():
            print(f"skip (missing): {name}")
            continue
        print(f"scrape {path}")
        try:
            raw = pe_resources.dump(str(path))
        except Exception as e:
            print(f"  FAIL {name}: {e}")
            continue
        cleaned = {"menus": {}, "strings_count": len(raw.get("strings") or {}), "dialogs_count": len(raw.get("dialogs") or {})}
        for mid, tree in (raw.get("menus") or {}).items():
            if isinstance(tree, dict) and tree.get("error"):
                cleaned["menus"][mid] = tree
                continue
            if not isinstance(tree, list):
                continue
            ct = clean_tree(tree)
            cleaned["menus"][mid] = ct
            hints = score_module_menu(ct)
            if hints:
                module_candidates.setdefault(name, []).append({"menu_id": mid, "hints": hints, "top_labels": [x.get("label") for x in ct[:12]]})
            # Menubar is typically XSI.exe menu 128
            if name.lower() == "xsi.exe" and str(mid) == "128":
                menubar_leaves = flatten_leaves(ct)
        allr[name] = cleaned
        print(f"  menus={len(cleaned['menus'])} strings={cleaned['strings_count']} dialogs={cleaned['dialogs_count']}")

    # Also glob any leftover *.dll that contain "toolbar" / "menu" in the name.
    for path in sorted(bin_dir.glob("*.dll")):
        if path.name in allr:
            continue
        low = path.name.lower()
        if "toolbar" in low or "uitask" in low or "module" in low:
            print(f"extra scrape {path.name}")
            try:
                raw = pe_resources.dump(str(path))
                cleaned = {"menus": {mid: clean_tree(t) if isinstance(t, list) else t for mid, t in (raw.get("menus") or {}).items()}}
                allr[path.name] = cleaned
                print(f"  menus={len(cleaned['menus'])}")
            except Exception as e:
                print(f"  FAIL: {e}")

    out = {
        "meta": {
            "si_root": str(args.si),
            "bin": str(bin_dir),
            "tool": "pe_scrape_module_menus.py",
            "note": "File-based; no Softimage process required. Feed menus into Softimage-Direct src/data/menus.json for Render/Simulate/ICE/Hair.",
        },
        "module_menu_candidates": module_candidates,
        "menubar_leaves": menubar_leaves,
        "files": allr,
    }
    out_path = Path(args.output)
    out_path.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"DONE -> {out_path.resolve()}")
    print(f"menubar leaves: {len(menubar_leaves)}; module-hinted resources: {sum(len(v) for v in module_candidates.values())}")


if __name__ == "__main__":
    main()
