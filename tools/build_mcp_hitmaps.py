#!/usr/bin/env python3
"""Build Softimage MCP section hit-maps from mcp.dll RT_BITMAP state skins.

Softimage paints each MCP section (Select / Transform / Snap / Constrain / Edit /
Mini Transform / Layer) as a full-panel RT_BITMAP (SELEC1U, SRTU, …). The HU
(highlight-up) variant lights button chrome; absolute U↔HU diffs recover the
raised-button masks. Win32 dialog templates in pe_resources.json only place a
few EDIT controls over the painted surface — those rects are merged in for
value fields the HU diff does not outline.

Output: src/data/si/mcp_hitmaps.json (semantic ids + pixel rects [x,y,w,h]).

Usage: python3 tools/build_mcp_hitmaps.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
BMP = ROOT / "data" / "si" / "pe_bitmaps" / "mcp"
PE = ROOT / "data" / "si" / "pe_resources.json"
OUT = ROOT / "src" / "data" / "si" / "mcp_hitmaps.json"


def _diff_boxes(stem: str, thr: float, min_w: int, min_h: int, max_w: int, max_h: int, min_area: int):
    u = np.asarray(Image.open(BMP / f"{stem}U.png").convert("RGB"), dtype=np.float64)
    hu = np.asarray(Image.open(BMP / f"{stem}HU.png").convert("RGB"), dtype=np.float64)
    h, w = u.shape[:2]
    edge = np.abs(hu - u).sum(2) > thr
    closed = ndimage.binary_closing(edge, structure=np.ones((3, 3)), iterations=2)
    closed = ndimage.binary_dilation(closed, iterations=1)
    inv = ~closed
    lab, n = ndimage.label(inv)
    border = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    boxes: list[list[int]] = []
    for i in range(1, n + 1):
        if i in border:
            continue
        ys, xs = np.where(lab == i)
        if len(xs) < min_area:
            continue
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        x0, y0 = max(0, x0 - 3), max(0, y0 - 3)
        x1, y1 = min(w - 1, x1 + 3), min(h - 1, y1 + 3)
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if min_w <= bw <= max_w and min_h <= bh <= max_h:
            boxes.append([x0, y0, bw, bh])
    lab_e, ne = ndimage.label(ndimage.binary_dilation(edge, iterations=1))
    for i in range(1, ne + 1):
        ys, xs = np.where(lab_e == i)
        if len(xs) < min_area:
            continue
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if not (min_w <= bw <= max_w and min_h <= bh <= max_h):
            continue
        if len(xs) / (bw * bh) < 0.2:
            continue
        boxes.append([x0, y0, bw, bh])
    boxes.sort(key=lambda b: b[2] * b[3])
    kept: list[list[int]] = []
    for b in boxes:
        x, y, bw, bh = b
        ok = True
        for kx, ky, kw, kh in kept:
            ix0, iy0 = max(x, kx), max(y, ky)
            ix1, iy1 = min(x + bw, kx + kw), min(y + bh, ky + kh)
            if ix1 > ix0 and iy1 > iy0 and (ix1 - ix0) * (iy1 - iy0) / min(bw * bh, kw * kh) > 0.45:
                ok = False
                break
        if ok:
            kept.append(b)
    kept.sort(key=lambda b: (b[1] // 2, b[0]))
    return w, h, kept


def _nms_add(hits: list[dict], rect: list[int], hid: str, kind: str = "button"):
    x, y, bw, bh = rect
    for h in hits:
        kx, ky, kw, kh = h["rect"]
        ix0, iy0 = max(x, kx), max(y, ky)
        ix1, iy1 = min(x + bw, kx + kw), min(y + bh, ky + kh)
        if ix1 > ix0 and iy1 > iy0 and (ix1 - ix0) * (iy1 - iy0) / min(bw * bh, kw * kh) > 0.55:
            return
    hits.append({"id": hid, "rect": rect, "kind": kind})


def build() -> dict:
    pe = json.load(open(PE)) if PE.exists() else {}
    dialogs = pe.get("mcp.dll", {}).get("dialogs", {})

    # ---- Select (SELEC1*) — HU outlines + PE dialog 9200 edits for filter/name
    sw, sh, sb = _diff_boxes("SELEC1", thr=35, min_w=16, min_h=14, max_w=126, max_h=55, min_area=40)
    # Expected Softimage order after NMS (see tools notes / HU glow):
    # group, center, object, point, edge, polygon, sample, nameNav, explore, scene, selection, clusters
    # (arrow circle often splits — we replace with a union rect)
    sel_hits: list[dict] = []
    _nms_add(sel_hits, [2, 2, 126, 18], "header", "header")
    _nms_add(sel_hits, [10, 22, 52, 60], "selectTool")
    # Prefer measured boxes when they match the Softimage grid
    labeled = [
        ("group", [68, 28, 60, 25]),
        ("center", [68, 57, 60, 25]),
        ("object", [5, 86, 60, 25]),
        ("point", [68, 86, 60, 25]),
        ("edge", [5, 115, 60, 25]),
        ("polygon", [68, 115, 60, 25]),
        ("sample", [4, 145, 104, 25]),
        ("filter", [6, 175, 118, 18], "field"),
        ("name", [6, 199, 99, 18], "field"),
        ("nameNav", [106, 199, 24, 22]),
        ("explore", [4, 224, 61, 25]),
        ("scene", [68, 224, 60, 25]),
        ("selection", [5, 253, 60, 25]),
        ("clusters", [68, 253, 60, 25]),
    ]
    # Snap measured boxes onto labeled slots when IoU is high
    for item in labeled:
        hid, rect = item[0], item[1]
        kind = item[2] if len(item) > 2 else "button"
        best, best_iou = None, 0.0
        for b in sb:
            ix0, iy0 = max(rect[0], b[0]), max(rect[1], b[1])
            ix1, iy1 = min(rect[0] + rect[2], b[0] + b[2]), min(rect[1] + rect[3], b[1] + b[3])
            if ix1 <= ix0 or iy1 <= iy0:
                continue
            inter = (ix1 - ix0) * (iy1 - iy0)
            iou = inter / (rect[2] * rect[3] + b[2] * b[3] - inter)
            if iou > best_iou:
                best_iou, best = iou, b
        use = best if best is not None and best_iou > 0.35 else rect
        _nms_add(sel_hits, use, hid, kind)
    # PE dialog 9200 edit overlays (DLU→bitmap via size ratio) — reinforce fields
    d9200 = dialogs.get("9200")
    if d9200:
        dw, dh = d9200["rect"][2], d9200["rect"][3]
        sx, sy = sw / dw, sh / dh
        for c in d9200.get("controls", []):
            if c.get("cls") != "edit":
                continue
            r = [int(c["x"] * sx), int(c["y"] * sy), max(8, int(c["w"] * sx)), max(10, int(c["h"] * sy))]
            hid = "name" if c["id"] == 267 else "filter" if c["id"] == 269 else f"edit_{c['id']}"
            # Prefer HU-measured field if present; else add
            if not any(h["id"] == hid for h in sel_hits):
                _nms_add(sel_hits, r, hid, "field")

    # ---- Transform (SRT*)
    tw, th, tb = _diff_boxes("SRT", thr=35, min_w=12, min_h=12, max_w=80, max_h=90, min_area=30)
    tr_hits: list[dict] = [{"id": "header", "rect": [2, 2, 126, 18], "kind": "header"}]
    # Softimage SRT column: value fields (left) + mode (s/r/t) + ≡ ; then 3×3 refs/modifiers
    # Measured HU boxes (stable across SP2 dumps):
    srt_map = [
        # scale
        ("scaleX", [5, 28, 97, 20], "field"),
        ("scaleY", [5, 50, 97, 20], "field"),
        ("scaleZ", [5, 72, 97, 20], "field"),
        ("scale", [110, 31, 20, 22], "button"),
        ("scaleOpt", [108, 68, 19, 25], "button"),
        # rotate
        ("rotateX", [5, 99, 97, 20], "field"),
        ("rotateY", [5, 121, 97, 20], "field"),
        ("rotateZ", [5, 143, 97, 20], "field"),
        ("rotate", [110, 102, 20, 22], "button"),
        ("rotateOpt", [108, 139, 19, 25], "button"),
        # translate
        ("translateX", [5, 170, 97, 20], "field"),
        ("translateY", [5, 192, 97, 20], "field"),
        ("translateZ", [5, 214, 97, 20], "field"),
        ("translate", [110, 174, 20, 22], "button"),
        ("translateOpt", [108, 210, 19, 25], "button"),
        # refs + modifiers
        ("refGlobal", [4, 240, 39, 25], "button"),
        ("refLocal", [46, 240, 39, 25], "button"),
        ("refView", [88, 240, 39, 25], "button"),
        ("refPar", [4, 269, 39, 25], "button"),
        ("refRef", [46, 269, 39, 25], "button"),
        ("refPlane", [88, 269, 39, 25], "button"),
        ("cog", [4, 303, 39, 25], "button"),
        ("prop", [46, 303, 39, 25], "button"),
        ("sym", [88, 303, 39, 25], "button"),
    ]
    for hid, rect, kind in srt_map:
        best, best_iou = rect, 0.0
        for b in tb:
            # mode buttons / opts: prefer measured
            if hid in ("scale", "rotate", "translate", "scaleOpt", "rotateOpt", "translateOpt") or hid.startswith("ref") or hid in ("cog", "prop", "sym"):
                ix0, iy0 = max(rect[0], b[0]), max(rect[1], b[1])
                ix1, iy1 = min(rect[0] + rect[2], b[0] + b[2]), min(rect[1] + rect[3], b[1] + b[3])
                if ix1 <= ix0 or iy1 <= iy0:
                    continue
                inter = (ix1 - ix0) * (iy1 - iy0)
                iou = inter / (rect[2] * rect[3] + b[2] * b[3] - inter)
                if iou > best_iou:
                    best_iou, best = iou, b
        use = best if best_iou > 0.3 else rect
        tr_hits.append({"id": hid, "rect": use, "kind": kind})
    # PE dialog 9400 SRT edit cells — keep as field authority when present
    d9400 = dialogs.get("9400")
    if d9400:
        dw, dh = d9400["rect"][2], d9400["rect"][3]
        sx, sy = tw / dw, th / dh
        id_map = {
            600: "scaleX", 602: "scaleY", 601: "scaleZ",
            603: "rotateX", 604: "rotateY", 605: "rotateZ",
            606: "translateX", 607: "translateY", 608: "translateZ",
        }
        for c in d9400.get("controls", []):
            if c.get("cls") != "edit":
                continue
            hid = id_map.get(c["id"])
            if not hid:
                continue
            r = [int(c["x"] * sx), int(c["y"] * sy), max(20, int(c["w"] * sx)), max(12, int(c["h"] * sy))]
            # widen field to Softimage painted well (~97px)
            r[2] = max(r[2], 90)
            for h in tr_hits:
                if h["id"] == hid:
                    # keep y from HU/map; adopt dialog-scaled x/h when close
                    h["rect"] = [min(h["rect"][0], r[0]), h["rect"][1], max(h["rect"][2], r[2]), h["rect"][3]]
                    h["peDialog"] = "9400"
                    break

    # ---- Snap
    nw, nh, nb = _diff_boxes("SNAP", thr=40, min_w=16, min_h=16, max_w=40, max_h=40, min_area=40)
    snap_ids = ["snapOn", "snapPoint", "snapCurve", "snapMidpoint", "snapGrid"]
    snap_hits = [{"id": "header", "rect": [2, 2, 126, 18], "kind": "header"}]
    for i, b in enumerate(nb[:5]):
        snap_hits.append({"id": snap_ids[i], "rect": b, "kind": "button"})

    # ---- Constrain
    cw, ch, cb = _diff_boxes("CONST", thr=30, min_w=30, min_h=16, max_w=70, max_h=40, min_area=50)
    const_ids = ["parent", "cut", "cnsComp", "childComp"]
    const_hits = [{"id": "header", "rect": [2, 2, 126, 18], "kind": "header"}]
    for i, b in enumerate(cb[:4]):
        const_hits.append({"id": const_ids[i], "rect": b, "kind": "button"})

    # ---- Edit (+ PE-missing +/- chrome to the right of top-right well)
    ew, eh, eb = _diff_boxes("EDIT", thr=30, min_w=20, min_h=14, max_w=70, max_h=40, min_area=40)
    edit_ids = ["freeze", "group", "freezeM", "immed"]
    edit_hits = [{"id": "header", "rect": [2, 2, 126, 18], "kind": "header"}]
    for i, b in enumerate(eb[:4]):
        edit_hits.append({"id": edit_ids[i], "rect": b, "kind": "button"})
    edit_hits.append({"id": "stackPlus", "rect": [116, 30, 12, 12], "kind": "button"})
    edit_hits.append({"id": "stackMinus", "rect": [116, 44, 12, 12], "kind": "button"})

    # ---- Mini Transform
    mw, mh, mb = _diff_boxes("MINITRANSFORMMCP_", thr=25, min_w=14, min_h=12, max_w=100, max_h=40, min_area=40)
    mini_ids = ["miniMarked", "miniFilter", "miniMenu", "miniScale", "miniRotate", "miniTranslate", "miniRef0", "miniRef1", "miniRef2"]
    mini_hits = []
    for i, b in enumerate(mb[:9]):
        mini_hits.append({"id": mini_ids[i], "rect": b, "kind": "button" if i != 0 else "field"})
    mini_hits.append({"id": "miniAxes", "rect": [114, 99, 80, 19], "kind": "button"})

    # ---- Layer (header strip; body is live list in Direct)
    lw, lh, _ = _diff_boxes("LAYER", thr=20, min_w=30, min_h=14, max_w=126, max_h=40, min_area=40)
    layer_hits = [
        {"id": "header", "rect": [2, 2, 126, 18], "kind": "header"},
        {"id": "layerMenu", "rect": [4, 24, 122, 32], "kind": "button"},
    ]

    doc = {
        "source": "mcp.dll RT_BITMAP U↔HU absdiff + pe_resources.json dialogs 9200/9400",
        "generator": "tools/build_mcp_hitmaps.py",
        "panels": {
            "Select": {"skin": "SELEC1U.png", "skinDown": "SELEC1D.png", "skinHover": "SELEC1HU.png", "w": sw, "h": sh, "hits": sel_hits},
            "Transform": {"skin": "SRTU.png", "skinDown": "SRTD.png", "skinHover": "SRTHU.png", "w": tw, "h": th, "hits": tr_hits},
            "Snap": {"skin": "SNAPU.png", "skinDown": "SNAPD.png", "skinHover": "SNAPHU.png", "w": nw, "h": nh, "hits": snap_hits},
            "Constrain": {"skin": "CONSTU.png", "skinDown": "CONSTD.png", "skinHover": "CONSTHU.png", "w": cw, "h": ch, "hits": const_hits},
            "Edit": {"skin": "EDITU.png", "skinDown": "EDITD.png", "skinHover": "EDITHU.png", "w": ew, "h": eh, "hits": edit_hits},
            "MiniTransform": {"skin": "MINITRANSFORMMCP_U.png", "w": mw, "h": mh, "hits": mini_hits},
            "Layer": {"skin": "LAYERU.png", "w": lw, "h": lh, "hits": layer_hits},
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    json.dump(doc, open(OUT, "w"), indent=2)
    print("wrote", OUT, "panels", list(doc["panels"]))
    for name, p in doc["panels"].items():
        print(f"  {name}: {p['w']}x{p['h']} hits={len(p['hits'])}")
    return doc


if __name__ == "__main__":
    build()
