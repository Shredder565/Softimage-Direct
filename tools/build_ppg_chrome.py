#!/usr/bin/env python3
"""Build Softimage PPG / floating-dialog chrome tokens from in-tree PE + views.

Sources (no Softimage Desktop):
  - data/si/pe_resources.json → uiut.dll host frames (InspNav / LoadSave / anim / reset)
  - data/si/pe_resources.json → genppg.dll / XSI.exe property-page dialogs
  - data/si/pe_bitmaps/uiut/{137,141}.png → InspNav / tools RT_BITMAP sizes
  - public/si/mcp/ppgnav.png + ppgtools.png → Direct skins (must match PE)
  - src/data/si/views.json → Property Editor defaultsize

Output: src/data/si/ppg_chrome.json

Usage: python3 tools/build_ppg_chrome.py
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PE = ROOT / "data" / "si" / "pe_resources.json"
# softimage-pc Phase B dumps (prefer when present)
PC_DIALOGS = Path("/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/dialogs")
PC_PE = PC_DIALOGS / "pe-dialogs-ui-model.json"
PC_SPDL_IDX = PC_DIALOGS / "spdl-layout-index.json"
PC_SPDL_LAYOUTS = PC_DIALOGS / "spdl-layouts-model-ui.json"
VIEWS = ROOT / "src" / "data" / "si" / "views.json"
UIUT_BMP = ROOT / "data" / "si" / "pe_bitmaps" / "uiut"
PUBLIC_MCP = ROOT / "public" / "si" / "mcp"
OUT = ROOT / "src" / "data" / "si" / "ppg_chrome.json"

# Softimage PPG host dialogs in uiut.dll (owner-draw chrome over Child Property Frame).
HOST_DIALOGS = ("138", "139", "141", "142", "144", "145", "147")


def load_uiut_dialogs() -> tuple[dict, str]:
    """Prefer softimage-pc pe-dialogs-ui-model.json; fall back to in-tree pe_resources.json."""
    if PC_PE.exists():
        pe = json.load(open(PC_PE))
        files = pe.get("files") or {}
        return {
            "uiut": (files.get("uiut.dll") or {}).get("dialogs") or {},
            "genppg": (files.get("genppg.dll") or {}).get("dialogs") or {},
            "xsi": (files.get("XSI.exe") or {}).get("dialogs") or {},
            "sceneexplorer": (files.get("sceneexplorer.dll") or {}).get("dialogs") or {},
            "props": (files.get("props.dll") or {}).get("dialogs") or {},
        }, "internal/softimage-pc-dumps/dialogs/pe-dialogs-ui-model.json"
    pe = json.load(open(PE))
    return {
        "uiut": pe.get("uiut.dll", {}).get("dialogs", {}),
        "genppg": pe.get("genppg.dll", {}).get("dialogs", {}),
        "xsi": pe.get("XSI.exe", {}).get("dialogs", {}),
        "sceneexplorer": pe.get("sceneexplorer.dll", {}).get("dialogs", {}),
        "props": pe.get("props.dll", {}).get("dialogs", {}),
    }, "data/si/pe_resources.json"


def png_size(path: Path) -> list[int] | None:
    if not path.exists():
        return None
    data = path.read_bytes()
    if data[12:16] != b"IHDR":
        return None
    w, h = struct.unpack(">II", data[16:24])
    return [int(w), int(h)]


def ctrl_summary(c: dict) -> dict:
    return {
        "id": c.get("id"),
        "cls": c.get("cls"),
        "text": c.get("text") or "",
        "rect_dlu": [c["x"], c["y"], c["w"], c["h"]],
    }


def pick_controls(dlg: dict) -> dict:
    out: dict[str, dict] = {}
    for c in dlg.get("controls") or []:
        text = (c.get("text") or "").strip()
        cls = str(c.get("cls") or "")
        tip = text.lower()
        if "InspNavCtrl" in text or text == "InspNavCtrl":
            out["inspNav"] = ctrl_summary(c)
        elif "LoadSaveCtrl" in text:
            out["loadSave"] = ctrl_summary(c)
        elif "Animation control" in tip or "DsAnimationCtrl" in cls:
            out["animation"] = ctrl_summary(c)
        elif "Reset All Parameters" in tip:
            out["resetAll"] = ctrl_summary(c)
        elif "Reset Current Parameter Group" in tip:
            out["resetGroup"] = ctrl_summary(c)
        elif "Child Property Frame" in text:
            out["childFrame"] = ctrl_summary(c)
    return out


def view_default_size(views: list) -> dict | None:
    for v in views:
        if v.get("name") == "Property Editor":
            raw = v.get("defaultsize") or ""
            parts = [int(x) for x in str(raw).split(",") if str(x).strip().lstrip("-").isdigit()]
            if len(parts) >= 4:
                return {"left": parts[0], "top": parts[1], "width": parts[2], "height": parts[3], "raw": raw}
            return {"raw": raw}
    return None


def build() -> dict:
    views = json.load(open(VIEWS))
    bags, pe_source = load_uiut_dialogs()
    uiut, genppg, xsi = bags["uiut"], bags["genppg"], bags["xsi"]
    sceneexplorer, props = bags.get("sceneexplorer") or {}, bags.get("props") or {}
    spdl_stats = None
    if PC_SPDL_IDX.exists():
        spdl_stats = json.load(open(PC_SPDL_IDX)).get("stats")

    hosts = {}
    for did in HOST_DIALOGS:
        dlg = uiut.get(did)
        if not dlg or "error" in dlg:
            continue
        hosts[did] = {
            "title": dlg.get("title") or "",
            "font": dlg.get("font"),
            "rect_dlu": dlg.get("rect"),
            "controls": pick_controls(dlg),
            "control_count": len(dlg.get("controls") or []),
        }

    # Canonical host: dialog 147 has the fullest PPG toolbar (anim + resets + nav + load/save).
    canonical_id = "147" if "147" in hosts else (HOST_DIALOGS[0] if HOST_DIALOGS[0] in hosts else next(iter(hosts), None))
    canonical = hosts.get(canonical_id) if canonical_id else None

    nav_bmp = png_size(UIUT_BMP / "137.png") or png_size(PUBLIC_MCP / "ppgnav.png")
    tools_bmp = png_size(UIUT_BMP / "141.png") or png_size(PUBLIC_MCP / "ppgtools.png")
    public_nav = png_size(PUBLIC_MCP / "ppgnav.png")
    public_tools = png_size(PUBLIC_MCP / "ppgtools.png")

    # Softimage PPG body metrics observed across SPDL-driven pages + PE host frames.
    # Font: uiut host frames use 11pt Arial; classic dialogs / genppg use 8pt MS Sans Serif.
    # Pixel chrome for owner-draw bitmaps is taken from RT_BITMAP (not DLU alone).
    tokens = {
        "fontFamily": 'Arial, "MS Sans Serif", Tahoma, sans-serif',
        "fontPtHost": 11,
        "fontPtDialog": 8,
        "titleBarHeightPx": 16,
        "toolbarHeightPx": (nav_bmp[1] if nav_bmp else 25),
        "tabFontPx": 10,
        "rowLabelWidthPx": 108,
        "animDotPx": 12,
        "rowGapPx": 4,
        "bodyPadPx": 4,
        "groupHeadBorder": "#8a8683",
        "valueFieldBg": "#2e2e2e",
        "valueFieldFg": "#f2f2f2",
        "sliderTrackTop": "#d8d4d1",
        "sliderTrackBot": "#c6c2bf",
        "sliderBorder": "#6a6663",
        "sliderThumbPx": 3,
        "sliderHeightPx": 13,
        "numFieldWidthPx": 56,
        "inputHeightPx": 17,
        "checkboxPx": 13,
        "floatDefaultWidthPx": 420,
        "floatBorder": "#3a3836",
        "floatTitleGradient": ["#7c7876", "#5a5654"],
        "ppgTitleGradient": ["#8f9bb0", "#6f7d96"],
        "fontPtDialog": 8,
        "dialogBtnWDlu": 50,
        "dialogBtnHDlu": 14,
    }

    se725 = sceneexplorer.get("725") or {}
    se_edit = next((c for c in (se725.get("controls") or []) if c.get("cls") == "edit"), None)
    explorer = {
        "renameDialog": {
            "id": "725",
            "dll": "sceneexplorer.dll",
            "font": se725.get("font") or [8, "MS Sans Serif"],
            "rect_dlu": se725.get("rect"),
            "edit": {"rect_dlu": [se_edit["x"], se_edit["y"], se_edit["w"], se_edit["h"]]} if se_edit else None,
        },
        "tokens": {
            "fontFamily": 'Arial, "MS Sans Serif", Tahoma, sans-serif',
            "fontPx": 11,
            "rowHeightPx": 16,
            "headBtnFontPx": 10,
            "searchBg": "#f4f2f0",
        },
    }
    p264 = props.get("264") or {}
    preferences = {
        "hostDialog": {
            "id": "264",
            "dll": "props.dll",
            "font": p264.get("font") or [10, "Arial"],
            "rect_dlu": p264.get("rect"),
            "controls": [
                {"text": c.get("text"), "cls": c.get("cls"), "rect_dlu": [c["x"], c["y"], c["w"], c["h"]]}
                for c in (p264.get("controls") or [])
            ],
        },
        "tokens": {
            "treeWidthPx": 170,
            "labelWidthPx": 260,
            "fontFamily": 'Arial, "MS Sans Serif", Tahoma, sans-serif',
            "fontPx": 11,
        },
    }

    # Script Editor factory prefs from C3DPrefsScriptEditor.spdl (PC dump when present).
    se_font, se_size, se_tab, se_linenum = "Courier New", 10, 4, True
    se_default_size = None
    if PC_SPDL_LAYOUTS.exists():
        layouts = json.load(open(PC_SPDL_LAYOUTS)).get("spdl") or {}
        se_spdl = layouts.get("C3DPrefsScriptEditor.spdl") or {}
        for p in se_spdl.get("params") or []:
            sn = p.get("sn")
            if sn == "font" and p.get("value"):
                se_font = str(p["value"])
            elif sn == "fontsize" and p.get("value") is not None:
                se_size = int(p["value"])
            elif sn == "tabsize" and p.get("value") is not None:
                se_tab = int(p["value"])
            elif sn == "linenum" and p.get("value") is not None:
                se_linenum = bool(p["value"])
    for v in (views if isinstance(views, list) else []):
        if v.get("name") == "Script Editor":
            se_default_size = v.get("defaultsize")
            break
    script_editor = {
        "prefsSpdl": "C3DPrefsScriptEditor.spdl",
        "viewDefaultSize": se_default_size,
        "tokens": {
            "fontFamily": f"{se_font}, Consolas, monospace",
            "fontPx": se_size,
            "tabSize": se_tab,
            "lineNumbers": se_linenum,
            "floatDefaultWidthPx": 485,
            "floatDefaultHeightPx": 550,
        },
    }

    bitmaps = {
        "inspNav": {
            "peId": "137",
            "peSize": nav_bmp,
            "public": "si/mcp/ppgnav.png",
            "publicSize": public_nav,
            "hit": [
                {"id": "up", "x": 2, "w": 22, "h": 21, "top": 2},
                {"id": "prev", "x": 25, "w": 22, "h": 21, "top": 2},
                {"id": "next", "x": 48, "w": 22, "h": 21, "top": 2},
            ],
        },
        "tools": {
            "peId": "141",
            "peSize": tools_bmp,
            "public": "si/mcp/ppgtools.png",
            "publicSize": public_tools,
            "hit": [
                {"id": "lock", "x": 2, "w": 20, "h": 21, "top": 2},
                {"id": "recycle", "x": 23, "w": 20, "h": 21, "top": 2},
                {"id": "help", "x": 44, "w": 20, "h": 21, "top": 2},
            ],
        },
    }

    match_nav = bool(nav_bmp and public_nav and nav_bmp == public_nav)
    match_tools = bool(tools_bmp and public_tools and tools_bmp == public_tools)

    inventory = {
        "uiutHostDialogs": sorted(hosts.keys(), key=lambda x: int(x)),
        "genppgDialogs": sorted(genppg.keys(), key=lambda x: int(x) if str(x).isdigit() else 0),
        "propertyPageLarge": xsi.get("IDD_PROPPAGE_LARGE"),
        "propertyEditorView": view_default_size(views if isinstance(views, list) else views.get("views", views)),
    }

    # Shared shell layout opts attested across Model/UI SPDL dumps (not per-op wiring).
    layout_opts = {
        "alignRightCommon": True,
        "labelWidthPctCommon": [50, 40, 45],
        "spdlStats": spdl_stats,
    }

    return {
        "softimage": "2015 SP2",
        "source": {
            "pe": pe_source,
            "uiut_bitmaps": "data/si/pe_bitmaps/uiut/",
            "views": "src/data/si/views.json",
            "pc_dialogs": "internal/softimage-pc-dumps/dialogs/" if PC_PE.exists() else None,
        },
        "canonicalHostDialog": canonical_id,
        "hosts": hosts,
        "bitmaps": bitmaps,
        "tokens": tokens,
        "explorer": explorer,
        "preferences": preferences,
        "scriptEditor": script_editor,
        "layoutOpts": layout_opts,
        "bitmapMatch": {"inspNav": match_nav, "tools": match_tools},
        "inventory": inventory,
        "notes": [
            "PPG host chrome is owner-draw (uiut InspNavCtrl / LoadSaveCtrl); DLU rects place controls, RT_BITMAP sizes paint them.",
            "Dialog 147 is the fullest Softimage PPG toolbar (animation + reset all/group + nav + load/save).",
            "Explorer rename = sceneexplorer.dll 725; Preferences host frame = props.dll 264.",
            "Script Editor factory font/size/tab/linenum from C3DPrefsScriptEditor.spdl; view defaultsize 485×550.",
            "Shared PPG shell only — Model-specific opdef layouts owned by Model PPG worker.",
            "No Softimage Desktop takeover — PE/SPDL file scrape only.",
        ],
    }


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"wrote {OUT}")
    print(
        f"host={data['canonicalHostDialog']} "
        f"nav={data['bitmaps']['inspNav']['peSize']} tools={data['bitmaps']['tools']['peSize']} "
        f"match={data['bitmapMatch']}"
    )


if __name__ == "__main__":
    main()
