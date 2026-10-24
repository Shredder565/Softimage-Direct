#!/usr/bin/env python3
"""Softimage dialog / PPG PE scrape — no Softimage Desktop / GUI.

Scrapes RT_DIALOG + RT_BITMAP sizes from uiut.dll / genppg.dll / XSI.exe / prefs.dll
and records high-traffic Model SPDL layout stubs from Application/spdl.

Output (Project store or Documents fallback):
  internal/softimage-pc-dumps/dialogs/
    pe-dialog-chrome.json
    pe-bitmap-sizes.json
    model-spdl-layouts.json
    dump-manifest.json

Hard rule: never drive Softimage Desktop mouse/keyboard.
"""
from __future__ import annotations

import json
import os
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

SI_ROOT = Path(r"C:\Program Files\Autodesk\Softimage 2015 SP2")
BIN = SI_ROOT / "Application" / "bin"
SPDL = SI_ROOT / "Application" / "spdl"

# Prefer Project Agent Store when the softimage-pc worker mounts it; else Documents.
_CANDIDATES = [
    Path(os.environ.get("SOFTIMAGE_PROJECT_STORE", "")),
    Path(__file__).resolve().parents[2] / "internal" / "softimage-pc-dumps" / "dialogs",
    Path(os.path.expandvars(r"%USERPROFILE%\Documents\softimage_dump_factory\dialogs")),
]
OUT = next((p for p in _CANDIDATES if p and (str(p).startswith(os.path.expandvars("%USERPROFILE%")) or p.parent.exists() or True)), _CANDIDATES[-1])

DLLS = {
    "uiut.dll": BIN / "uiut.dll",
    "genppg.dll": BIN / "genppg.dll",
    "XSI.exe": BIN / "XSI.exe",
    "prefs.dll": BIN / "prefs.dll",
    "mcp.dll": BIN / "mcp.dll",
}

# Model-adjacent SPDL filenames (Get Primitive / common ops) — layout parameter order for PPG fidelity.
MODEL_SPDL_GLOBS = [
    "C3D*Prim*.spdl",
    "C3DCube*.spdl",
    "C3DSphere*.spdl",
    "C3DCone*.spdl",
    "C3DCylinder*.spdl",
    "C3DGrid*.spdl",
    "C3DTorus*.spdl",
    "C3DText*.spdl",
    "C3DBevel*.spdl",
    "C3DExtrude*.spdl",
    "C3DBoolean*.spdl",
    "C3DBend*.spdl",
    "C3DTaper*.spdl",
    "C3DTwist*.spdl",
    "C3DPolygonReduction*.spdl",
]


CLASSES = {0x80: "button", 0x81: "edit", 0x82: "static", 0x83: "listbox", 0x84: "scrollbar", 0x85: "combobox"}


def sections(data: bytes):
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    nsec = struct.unpack_from("<H", data, pe + 6)[0]
    opt = struct.unpack_from("<H", data, pe + 20)[0]
    magic = struct.unpack_from("<H", data, pe + 24)[0]
    dd_off = pe + 24 + (112 if magic == 0x20B else 96)
    rsrc_rva, _ = struct.unpack_from("<II", data, dd_off + 2 * 8)
    secs = []
    off = pe + 24 + opt
    for i in range(nsec):
        _name, vsize, va, rsize, raw = struct.unpack_from("<8sIIII", data, off + i * 40)
        secs.append((va, vsize, raw, rsize))
    return secs, rsrc_rva


def rva2off(secs, rva):
    for va, vsize, raw, rsize in secs:
        if va <= rva < va + max(vsize, rsize):
            return raw + rva - va
    return None


def walk_rsrc(data, base, off, secs):
    n_named, n_id = struct.unpack_from("<HH", data, off + 12)
    out = []
    for i in range(n_named + n_id):
        ident, child = struct.unpack_from("<II", data, off + 16 + i * 8)
        if ident & 0x80000000:
            so = base + (ident & 0x7FFFFFFF)
            ln = struct.unpack_from("<H", data, so)[0]
            key = data[so + 2 : so + 2 + ln * 2].decode("utf-16le", "replace")
        else:
            key = ident
        if child & 0x80000000:
            for k in walk_rsrc(data, base, base + (child & 0x7FFFFFFF), secs):
                out.append((key,) + k)
        else:
            rva, size = struct.unpack_from("<II", data, base + child)
            o = rva2off(secs, rva)
            out.append((key, o, size))
    return out


def sz_or_ord(data, pos):
    w = struct.unpack_from("<H", data, pos)[0]
    if w == 0xFFFF:
        return struct.unpack_from("<H", data, pos + 2)[0], pos + 4
    if w == 0:
        return "", pos + 2
    s = pos
    while data[pos : pos + 2] != b"\x00\x00":
        pos += 2
    return data[s:pos].decode("utf-16le", "replace"), pos + 2


def parse_dialog(data, off, size):
    sig = struct.unpack_from("<H", data, off + 2)[0]
    ex = struct.unpack_from("<H", data, off)[0] == 1 and sig == 0xFFFF
    if ex:
        _helpid, _exstyle, style, n, x, y, w, h = struct.unpack_from("<IIIHhhhh", data, off + 4)
        pos = off + 26
    else:
        style, _exstyle, n, x, y, w, h = struct.unpack_from("<IIHhhhh", data, off)
        pos = off + 18
    _menu, pos = sz_or_ord(data, pos)
    _cls, pos = sz_or_ord(data, pos)
    title, pos = sz_or_ord(data, pos)
    font = None
    if style & 0x40:
        pt = struct.unpack_from("<H", data, pos)[0]
        pos += 2
        if ex:
            pos += 4
        name, pos = sz_or_ord(data, pos)
        font = [pt, name]
    ctrls = []
    for _i in range(n):
        pos = (pos + 3) & ~3
        if ex:
            _chelp, _cex, cstyle, cx, cy, cw, ch, cid = struct.unpack_from("<IIIhhhhI", data, pos)
            pos += 24
        else:
            cstyle, _cex, cx, cy, cw, ch, cid = struct.unpack_from("<IIhhhhH", data, pos)
            pos += 18
        ccls, pos = sz_or_ord(data, pos)
        text, pos = sz_or_ord(data, pos)
        extra = struct.unpack_from("<H", data, pos)[0]
        pos += 2 + extra
        if isinstance(ccls, int):
            ccls = CLASSES.get(ccls, hex(ccls))
        ctrls.append({"cls": ccls, "text": text, "id": cid, "x": cx, "y": cy, "w": cw, "h": ch, "style": cstyle})
    return {"title": title, "style": style, "rect": [x, y, w, h], "font": font, "controls": ctrls}


def parse_bitmap_size(data, off, size):
    """BITMAPINFOHEADER width/height from RT_BITMAP payload (no file header)."""
    if size < 16:
        return None
    hdr = struct.unpack_from("<IiiHH", data, off)
    # biSize, biWidth, biHeight, biPlanes, biBitCount
    return {"w": abs(hdr[1]), "h": abs(hdr[2]), "bpp": hdr[4], "header": hdr[0]}


def dump_pe(path: Path) -> dict:
    data = path.read_bytes()
    secs, rsrc_rva = sections(data)
    base = rva2off(secs, rsrc_rva)
    res = {"dialogs": {}, "bitmaps": {}}
    if base is None:
        return res
    for entry in walk_rsrc(data, base, base, secs):
        typ, name, _lang, off, size = entry[0], entry[1], entry[2], entry[3], entry[4]
        if off is None:
            continue
        if typ == 5:
            try:
                res["dialogs"][str(name)] = parse_dialog(data, off, size)
            except Exception as e:
                res["dialogs"][str(name)] = {"error": str(e)}
        elif typ == 2:
            try:
                sz = parse_bitmap_size(data, off, size)
                if sz:
                    res["bitmaps"][str(name)] = sz
            except Exception as e:
                res["bitmaps"][str(name)] = {"error": str(e)}
    return res


def parse_spdl_layout(text: str) -> dict:
    """Lightweight SPDL Layout stub: collect Parameter / Group / Tab names in order."""
    import re

    tabs, groups, params = [], [], []
    for m in re.finditer(r'\bTab\s+"([^"]+)"', text, re.I):
        tabs.append(m.group(1))
    for m in re.finditer(r'\bGroup\s+"([^"]+)"', text, re.I):
        groups.append(m.group(1))
    for m in re.finditer(r'\bParameter\s+"([^"]+)"', text, re.I):
        params.append(m.group(1))
    # Layout section Parameter refs often use bare identifiers after Layout
    layout_params = []
    lm = re.search(r"\bLayout\b(.*?)(?:Logic|OnInit|PPGLayout|End|$)", text, re.S | re.I)
    if lm:
        chunk = lm.group(1)
        for m in re.finditer(r'(?:AddItem|AddGroup|AddTab|AddRow|AddButton|Parameter)\s*\(\s*"([^"]+)"', chunk, re.I):
            layout_params.append(m.group(1))
        for m in re.finditer(r'^\s*([A-Za-z_][\w.]*)\s*$', chunk, re.M):
            name = m.group(1)
            if name.lower() not in {"end", "layout", "group", "tab", "row"}:
                layout_params.append(name)
    return {"tabs": tabs, "groups": groups, "parameters": params[:80], "layout_refs": layout_params[:120], "bytes": len(text)}


def scrape_model_spdl() -> dict:
    out = {"files": {}, "matched": 0}
    if not SPDL.is_dir():
        out["error"] = f"missing {SPDL}"
        return out
    seen = set()
    for pat in MODEL_SPDL_GLOBS:
        for path in sorted(SPDL.glob(pat)):
            if path.name in seen:
                continue
            seen.add(path.name)
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                text = path.read_text(encoding="latin-1", errors="replace")
            out["files"][path.name] = parse_spdl_layout(text)
    out["matched"] = len(out["files"])
    return out


def main() -> int:
    global OUT
    # Prefer store path when parent exists (agent store mount).
    store = Path(__file__).resolve().parents[2] / "internal" / "softimage-pc-dumps" / "dialogs"
    if store.parent.exists():
        OUT = store
    else:
        OUT = Path(os.path.expandvars(r"%USERPROFILE%\Documents\softimage_dump_factory\dialogs"))
    OUT.mkdir(parents=True, exist_ok=True)

    if not SI_ROOT.is_dir():
        print(f"Softimage install missing: {SI_ROOT}", file=sys.stderr)
        return 2

    chrome = {"softimage": "2015 SP2", "dlls": {}}
    bitmaps = {"softimage": "2015 SP2", "dlls": {}}
    for name, path in DLLS.items():
        if not path.exists():
            chrome["dlls"][name] = {"error": "missing"}
            bitmaps["dlls"][name] = {"error": "missing"}
            continue
        pe = dump_pe(path)
        chrome["dlls"][name] = {
            "path": str(path),
            "dialog_count": len(pe["dialogs"]),
            "dialogs": pe["dialogs"],
        }
        bitmaps["dlls"][name] = {
            "path": str(path),
            "bitmap_count": len(pe["bitmaps"]),
            "bitmaps": pe["bitmaps"],
        }
        print(f"{name}: dialogs={len(pe['dialogs'])} bitmaps={len(pe['bitmaps'])}")

    spdl = scrape_model_spdl()
    print(f"model SPDL layouts matched={spdl.get('matched')}")

    (OUT / "pe-dialog-chrome.json").write_text(json.dumps(chrome, indent=2) + "\n")
    (OUT / "pe-bitmap-sizes.json").write_text(json.dumps(bitmaps, indent=2) + "\n")
    (OUT / "model-spdl-layouts.json").write_text(json.dumps(spdl, indent=2) + "\n")
    manifest = {
        "when": datetime.now(timezone.utc).isoformat(),
        "si_root": str(SI_ROOT),
        "out": str(OUT),
        "files": [
            "pe-dialog-chrome.json",
            "pe-bitmap-sizes.json",
            "model-spdl-layouts.json",
        ],
        "notes": "Headless PE/SPDL scrape only — no Softimage Desktop takeover.",
    }
    (OUT / "dump-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
