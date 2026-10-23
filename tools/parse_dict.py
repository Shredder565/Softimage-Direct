"""Parse Softimage *.dict localisation files (big-endian count, then [BE uint32 id][UTF-16LE string\0] records)."""
import struct, sys, json, glob, os
def parse(path):
    d = open(path, 'rb').read(); n = struct.unpack_from('>I', d, 4)[0]; pos = 8; out = {}
    for _ in range(n):
        if pos + 4 > len(d): break
        sid = struct.unpack_from('>I', d, pos)[0]; pos += 4; s = pos
        while pos + 1 < len(d) and d[pos:pos + 2] != b'\x00\x00': pos += 2
        out[sid] = d[s:pos].decode('utf-16le', 'replace').replace('\ufffd', ''); pos += 2
    return out
if __name__ == '__main__':
    res = {}
    for p in sorted(glob.glob(sys.argv[1] + '/*.dict')):
        res[os.path.basename(p)[:-5]] = parse(p)
    json.dump(res, open(sys.argv[2], 'w'), indent=0, ensure_ascii=False)
    print({k: len(v) for k, v in res.items()})
