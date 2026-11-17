#!/usr/bin/env python3
"""Parse Softimage `Application/CommandMaps/XSI.DSCommandMap` (magic `10mc`) into JSON.

The file is the built-in command registry: one fixed-size record per command with the
command GUID, the CLSID of the COM class that executes it, display / scripting names,
category, flags and a slice of the argument table. Script-implemented commands all share
one handler CLSID and carry `_ScriptEngine`, `_ScriptName`, `_ScriptProcedure` arguments.

Layout (little endian), attested on 2015 SP2, see docs/ghidra/cmd-registry-dscommandmap.md:
  0x00 char[4] "10mc"; u32 section count (6); then 6 x (u32 offset, u32 count, u32 record size);
  u32 file size.
  section 0: 1 x 0x1c   map identity (GUID, u32 1, u32 0, u32 0x28)
  section 1: N x 0x90   commands
  section 2: M x 0x20   arguments
  section 3: K x 0x20   (command GUID, GUID) pairs (not decoded further)
  section 4: UTF-16LE string pool; string references are offsets in UTF-16 code units
  section 5: bitmap pool (BMP files)

Optionally scans a folder of binaries for each handler CLSID (16 raw bytes, 4-aligned)
to list the DLLs that contain it.

Usage: parse_dscommandmap.py XSI.DSCommandMap out.json [--scan <install root>]
"""
import json, os, struct, sys, uuid, collections

SCRIPT_HANDLER = '5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9'

def parse(path):
    d = open(path, 'rb').read()
    magic, nsec = struct.unpack_from('<4sI', d, 0)
    if magic != b'10mc' or nsec != 6:
        raise SystemExit('not a 10mc command map')
    secs = [struct.unpack_from('<III', d, 8 + 12 * i) for i in range(6)]
    pool = d[secs[4][0]:secs[4][0] + secs[4][2]]

    def S(ix):
        if not ix:
            return ''
        e = ix * 2
        while pool[e:e + 2] != b'\0\0':
            e += 2
        return pool[ix * 2:e].decode('utf-16le')

    def G(b):
        return str(uuid.UUID(bytes_le=bytes(b)))

    aoff, acnt, asz = secs[2]

    def arg(j):
        a = d[aoff + j * asz:aoff + (j + 1) * asz]
        name, flags, vt, _ = struct.unpack_from('<IIII', a, 0)
        raw = a[16:32]
        out = {'name': S(name), 'flags': flags, 'vt': vt}
        if vt == 8:
            out['default'] = S(struct.unpack_from('<I', raw)[0])
        elif vt == 11:
            out['default'] = bool(struct.unpack_from('<I', raw)[0])
        elif vt in (2, 3, 16, 18, 19, 22, 23):
            out['default'] = struct.unpack_from('<i', raw)[0]
        elif vt == 5:
            out['default'] = struct.unpack_from('<d', raw)[0]
        elif vt == 4:
            out['default'] = struct.unpack_from('<f', raw)[0]
        elif vt == 72:
            out['handler_clsid'] = G(raw)
        elif any(raw):
            out['default_raw'] = raw.hex()
        return out

    off, cnt, sz = secs[1]
    cmds = []
    for i in range(cnt):
        r = d[off + i * sz:off + (i + 1) * sz]
        w = struct.unpack_from('<24I', r, 48)
        args = [arg(j) for j in range(w[16], w[16] + w[17])]
        c = {
            'index': i,
            'guid': G(r[0:16]),
            'handler_clsid': G(r[32:48]),
            'name': S(w[0]),
            'description': S(w[1]),
            'scripting_name': S(w[2]),
            'tooltip': S(w[3]),
            'disabled_label': S(w[4]),
            'category': S(w[5]),
            'compatibility': S(w[6]),
            'flags': w[13],
            'word14': w[14],
            'word15': w[15],
        }
        script = {a['name'][1:]: a.get('default') for a in args if a['name'].startswith('_Script')}
        if script:
            c['script'] = script
        c['args'] = [a for a in args if not a['name'].startswith('_Script')]
        cmds.append(c)
    return {'source': os.path.basename(path), 'sections': secs, 'commands': cmds}

def scan(root, clsids):
    import numpy as np
    keys = {uuid.UUID(c).bytes_le: c for c in clsids}
    first = np.array(sorted({struct.unpack('<I', k[:4])[0] for k in keys}), dtype='<u4')
    hits = collections.defaultdict(list)
    for dp, _, fn in os.walk(root):
        for f in sorted(fn):
            if not f.lower().endswith(('.dll', '.ocx', '.exe')):
                continue
            b = open(os.path.join(dp, f), 'rb').read()
            a = np.frombuffer(b[:len(b) // 4 * 4], dtype='<u4')
            for i in np.nonzero(np.isin(a, first))[0]:
                c = keys.get(b[int(i) * 4:int(i) * 4 + 16])
                if c and f not in hits[c]:
                    hits[c].append(f)
    return hits

if __name__ == '__main__':
    out = parse(sys.argv[1])
    if '--scan' in sys.argv:
        hits = scan(sys.argv[sys.argv.index('--scan') + 1], {c['handler_clsid'] for c in out['commands']})
        for c in out['commands']:
            c['handler_dlls'] = hits.get(c['handler_clsid'], [])
    json.dump(out, open(sys.argv[2], 'w'), indent=1)
    print(len(out['commands']), 'commands')
