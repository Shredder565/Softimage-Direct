"""Minimal PE resource reader: dumps MENU (RT_MENU=4) trees and STRINGTABLE (RT_STRING=6) entries
from Softimage binaries so the clone can copy menubar labels and status-bar strings verbatim.
Usage: python3 tools/pe_resources.py <pe files...> -o out.json
"""
import struct, sys, json


def sections(data):
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    nsec = struct.unpack_from('<H', data, pe + 6)[0]
    opt = struct.unpack_from('<H', data, pe + 20)[0]
    magic = struct.unpack_from('<H', data, pe + 24)[0]
    dd_off = pe + 24 + (112 if magic == 0x20b else 96)
    rsrc_rva, rsrc_size = struct.unpack_from('<II', data, dd_off + 2 * 8)
    secs = []
    off = pe + 24 + opt
    for i in range(nsec):
        name, vsize, va, rsize, raw = struct.unpack_from('<8sIIII', data, off + i * 40)
        secs.append((va, vsize, raw, rsize))
    return secs, rsrc_rva


def rva2off(secs, rva):
    for va, vsize, raw, rsize in secs:
        if va <= rva < va + max(vsize, rsize): return raw + rva - va
    return None


def walk(data, base, off, secs, level=0):
    """Yield (type, name, lang, data_offset, size)."""
    n_named, n_id = struct.unpack_from('<HH', data, off + 12)
    out = []
    for i in range(n_named + n_id):
        ident, child = struct.unpack_from('<II', data, off + 16 + i * 8)
        if ident & 0x80000000:
            so = base + (ident & 0x7fffffff); ln = struct.unpack_from('<H', data, so)[0]
            key = data[so + 2: so + 2 + ln * 2].decode('utf-16le', 'replace')
        else: key = ident
        if child & 0x80000000:
            for k in walk(data, base, base + (child & 0x7fffffff), secs, level + 1): out.append((key,) + k)
        else:
            rva, size = struct.unpack_from('<II', data, base + child)
            o = rva2off(secs, rva); out.append((key, o, size))
    return out


def parse_menu(data, off, size):
    """Parse a MENU resource (standard or MENUEX) into a nested list."""
    end = off + size
    ver, hdr = struct.unpack_from('<HH', data, off)
    pos = off + 4 + hdr
    if ver == 1:  # MENUEX
        def items(pos):
            res = []
            while pos < end:
                pos = (pos + 3) & ~3
                mtype, state, mid, bres = struct.unpack_from('<IIIH', data, pos); pos += 14
                s = pos
                while data[pos:pos + 2] != b'\x00\x00': pos += 2
                text = data[s:pos].decode('utf-16le'); pos += 2
                it = {'label': text, 'id': mid}
                if mtype & 0x800: it = {'separator': True}
                if bres & 1:
                    pos = (pos + 3) & ~3; pos += 4
                    sub, pos = items(pos); it['items'] = sub
                res.append(it)
                if bres & 0x80: return res, pos
            return res, pos
        tree, _ = items(pos); return tree
    def items(pos):
        res = []
        while pos < end:
            flags = struct.unpack_from('<H', data, pos)[0]; pos += 2
            mid = None
            if not flags & 0x10: mid = struct.unpack_from('<H', data, pos)[0]; pos += 2
            s = pos
            while data[pos:pos + 2] != b'\x00\x00': pos += 2
            text = data[s:pos].decode('utf-16le'); pos += 2
            it = {'label': text, 'id': mid}
            if flags & 0x800 or (text == '' and not flags & 0x10): it = {'separator': True}
            if flags & 0x10: sub, pos = items(pos); it['items'] = sub
            res.append(it)
            if flags & 0x80: return res, pos
        return res, pos
    tree, _ = items(pos); return tree


def parse_strings(data, off, size, block):
    out = {}; pos = off
    for i in range(16):
        ln = struct.unpack_from('<H', data, pos)[0]; pos += 2
        if ln: out[(block - 1) * 16 + i] = data[pos:pos + ln * 2].decode('utf-16le', 'replace'); pos += ln * 2
    return out


CLASSES = {0x80: 'button', 0x81: 'edit', 0x82: 'static', 0x83: 'listbox', 0x84: 'scrollbar', 0x85: 'combobox'}


def sz_or_ord(data, pos):
    """Read a DLGTEMPLATE 'sz_Or_Ord' (0xFFFF + word, or a UTF-16 string)."""
    w = struct.unpack_from('<H', data, pos)[0]
    if w == 0xFFFF: return struct.unpack_from('<H', data, pos + 2)[0], pos + 4
    if w == 0: return '', pos + 2
    s = pos
    while data[pos:pos + 2] != b'\x00\x00': pos += 2
    return data[s:pos].decode('utf-16le', 'replace'), pos + 2


def parse_dialog(data, off, size):
    """Parse DLGTEMPLATE / DLGTEMPLATEEX into {title, style, rect, font, controls:[{cls,text,id,x,y,w,h,style}]}."""
    sig, = struct.unpack_from('<H', data, off + 2)
    ex = struct.unpack_from('<H', data, off)[0] == 1 and sig == 0xFFFF
    if ex:
        helpid, exstyle, style, n, x, y, w, h = struct.unpack_from('<IIIHhhhh', data, off + 4); pos = off + 26
    else:
        style, exstyle, n, x, y, w, h = struct.unpack_from('<IIHhhhh', data, off); pos = off + 18
    menu, pos = sz_or_ord(data, pos); cls, pos = sz_or_ord(data, pos); title, pos = sz_or_ord(data, pos)
    font = None
    if style & 0x40:  # DS_SETFONT
        pt = struct.unpack_from('<H', data, pos)[0]; pos += 2
        if ex: pos += 4
        name, pos = sz_or_ord(data, pos); font = [pt, name]
    ctrls = []
    for i in range(n):
        pos = (pos + 3) & ~3
        if ex: chelp, cex, cstyle, cx, cy, cw, ch, cid = struct.unpack_from('<IIIhhhhI', data, pos); pos += 24
        else: cstyle, cex, cx, cy, cw, ch, cid = struct.unpack_from('<IIhhhhH', data, pos); pos += 18
        ccls, pos = sz_or_ord(data, pos); text, pos = sz_or_ord(data, pos)
        extra = struct.unpack_from('<H', data, pos)[0]; pos += 2 + extra
        if isinstance(ccls, int): ccls = CLASSES.get(ccls, hex(ccls))
        ctrls.append({'cls': ccls, 'text': text, 'id': cid, 'x': cx, 'y': cy, 'w': cw, 'h': ch, 'style': cstyle})
    return {'title': title, 'style': style, 'rect': [x, y, w, h], 'font': font, 'controls': ctrls}


def dump(path):
    data = open(path, 'rb').read(); secs, rsrc_rva = sections(data)
    base = rva2off(secs, rsrc_rva)
    res = {'menus': {}, 'strings': {}, 'dialogs': {}}
    for entry in walk(data, base, base, secs):
        typ, name, lang, off, size = entry[0], entry[1], entry[2], entry[3], entry[4]
        if off is None: continue
        if typ == 4:
            try: res['menus'][str(name)] = parse_menu(data, off, size)
            except Exception as e: res['menus'][str(name)] = {'error': str(e)}
        elif typ == 5:
            try: res['dialogs'][str(name)] = parse_dialog(data, off, size)
            except Exception as e: res['dialogs'][str(name)] = {'error': str(e)}
        elif typ == 6 and isinstance(name, int):
            res['strings'].update({str(k): v for k, v in parse_strings(data, off, size, name).items()})
    return res


if __name__ == '__main__':
    args = sys.argv[1:]; out = 'pe_resources.json'
    if '-o' in args: i = args.index('-o'); out = args[i + 1]; del args[i:i + 2]
    allr = {}
    for p in args:
        r = dump(p); allr[p.split('/')[-1]] = r
        print(p.split('/')[-1], 'menus', len(r['menus']), 'strings', len(r['strings']), 'dialogs', len(r['dialogs']))
    json.dump(allr, open(out, 'w'), indent=0)
