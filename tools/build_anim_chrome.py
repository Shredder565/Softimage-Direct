#!/usr/bin/env python3
"""Build Softimage Animate chrome tokens from PE RT_DIALOG dump + dict (no GUI).

Sources:
  internal/softimage-pc-dumps/anim/anim-editor-mixer-pe-dialogs.json
  internal/softimage-pc-dumps/anim/anim-dict-strings.json

Output: src/data/si/anim_chrome.json

Usage: python3 tools/build_anim_chrome.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORE = Path("/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim")
PE = STORE / "anim-editor-mixer-pe-dialogs.json"
DICT = STORE / "anim-dict-strings.json"
OUT = ROOT / "src" / "data" / "si" / "anim_chrome.json"
DUMP = ROOT / "data" / "dump"

# Softimage classic DLU → px (8pt MS Sans / Phase B PPG convention)
HX, HY = 1.5, 1.625

VIEW_DEFAULTS = {
    "Keying Panel": [0, 0, 160, 480],
    "Animation Panel": [50, 50, 485, 550],
    "Animation Editor": [50, 50, 640, 400],
    "Fcurve Editor": [50, 50, 640, 400],
    "DopeSheet": [50, 50, 640, 280],
    "Animation Mixer": [50, 50, 720, 360],
    "Animation Layer Manager": [50, 50, 280, 320],
    "Playback Panel": [0, 0, 320, 28],
}


def dlu_to_px(rect):
    if not rect or len(rect) < 4:
        return None
    _x, _y, w, h = rect[:4]
    return [round(w * HX), round(h * HY)]


def dialog(files: dict, dll: str, did: str):
    return ((files.get(dll) or {}).get("dialogs") or {}).get(str(did))


def main() -> None:
    pe = json.loads(PE.read_text()) if PE.exists() else {"files": {}, "meta": {}}
    files = pe.get("files") or {}
    dict_labels: dict[str, list[str]] = {}
    if DICT.exists():
        dj = json.loads(DICT.read_text())
        for fname, block in dj.items():
            strings = block.get("strings") or []
            key = fname.replace(".dict", "").lower()
            dict_labels[key] = [s for s in strings if isinstance(s, str) and 1 < len(s) < 80][:80]

    action_106 = dialog(files, "action.dll", "106")
    action_108 = dialog(files, "action.dll", "108")
    action_124 = dialog(files, "action.dll", "124")
    mcp_220 = dialog(files, "mcp.dll", "220")
    props_103 = dialog(files, "props.dll", "103")
    uiut_147 = dialog(files, "uiut.dll", "147")

    chrome = {
        "softimage": "2015 SP2 / 13.2.163.0",
        "source": {
            "pe": "internal/softimage-pc-dumps/anim/anim-editor-mixer-pe-dialogs.json",
            "dict": "internal/softimage-pc-dumps/anim/anim-dict-strings.json",
            "generated_utc": (pe.get("meta") or {}).get("generated_utc"),
            "mode": "file-scrape-only",
        },
        "scale": {"dlu_to_px_x": HX, "dlu_to_px_y": HY},
        "fonts": {
            "editor": 'Tahoma, "MS Sans Serif", Arial, sans-serif',
            "editor_px": 11,
            "panel": 'Tahoma, "MS Sans Serif", Arial, sans-serif',
            "panel_px": 10,
            "dialog": '"MS Sans Serif", Tahoma, Arial, sans-serif',
            "dialog_pt": 8,
        },
        "colors": {
            "client_bg": "#4a4a4a",
            "list_bg": "#9d9b99",
            "panel_bg": "#a9a7a5",
            "toolbar_bg": "#b6b2af",
            "track_bg": "#8a8886",
            "clip_bg": "#c9c5c2",
            "clip_sel": "#3a5a8c",
            "key_diamond": "#ffd34d",
            "grid": "#5c5c5c",
            "time_cursor": "#ffd34d",
        },
        "layout": {
            "fcv_list_w": 150,
            "fcv_toolbar_h": 22,
            "fcv_ruler_h": 16,
            "fcv_label_margin": 36,
            "mixer_track_h": 22,
            "mixer_clip_h": 18,
            "mixer_toolbar_h": 22,
            "kp_row_h": 16,
            "kp_num_w": 56,
            "kp_default_w": 160,
            "kp_title_h": 15,
            "layer_mgr_w": 280,
            "ok_cancel": {
                "w_dlu": 50,
                "h_dlu": 14,
                "w_px": round(50 * HX),
                "h_px": round(14 * HY),
            },
        },
        "dialogs": {},
        "views": VIEW_DEFAULTS,
        "menus": {
            "mixer": ["Edit", "View", "Track", "Clip", "Effect", "Playback"],
            "fcurve": ["Edit", "Curves", "View", "Keys"],
            "dopesheet": ["Edit", "View", "Keys"],
            "keying": ["Key", "Mark", "Keyable"],
        },
        "dict_labels": {
            "mixer": (dict_labels.get("xsianimationmixer") or [])[:40],
            "action": (dict_labels.get("xsiaction2") or [])[:40],
        },
        "mixer_tools": [
            "AM Selection Tool",
            "AM PanZoom Tool",
            "AM Standard Transition Tool",
            "AM Bridge Transition Tool",
            "AM Remove Transition Tool",
            "AM Rectangular Selection Tool",
            "Insert Animation Track",
            "Insert Shape Track",
            "Insert Audio Track",
        ],
        "interactive_only": pe.get("interactive_only_note") or "",
    }

    for name, dlg, dll, did in [
        ("action_instanced", action_106, "action.dll", "106"),
        ("action_source_editor", action_108, "action.dll", "108"),
        ("action_inst_clip", action_124, "action.dll", "124"),
        ("mcp_current_time", mcp_220, "mcp.dll", "220"),
        ("clip_time_control", props_103, "props.dll", "103"),
        ("ppg_host_147", uiut_147, "uiut.dll", "147"),
    ]:
        if not dlg:
            continue
        rect = dlg.get("rect")
        chrome["dialogs"][name] = {
            "dll": dll,
            "id": did,
            "title": dlg.get("title") or "",
            "font": dlg.get("font"),
            "rect_dlu": rect,
            "size_px_hint": dlu_to_px(rect),
            "control_count": len(dlg.get("controls") or []),
            "labels": [c.get("text") for c in (dlg.get("controls") or []) if (c.get("text") or "").strip()][:24],
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(chrome, indent=2) + "\n")
    print("wrote", OUT)

    DUMP.mkdir(parents=True, exist_ok=True)
    for fn in (
        "si_anim_fcurve_eval_golden.json",
        "si_anim_mixer_deep.json",
        "si_anim_envelope_shape.json",
    ):
        src = STORE / fn
        if src.exists():
            (DUMP / fn).write_bytes(src.read_bytes())
            print("copied", fn)


if __name__ == "__main__":
    main()
