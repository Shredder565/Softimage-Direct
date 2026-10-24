"""Parse Softimage .spdl files into JSON: parameters (type, default, range, UI range, enum items, caps)
and the PPG layout tree. Usage: python3 parse_spdl.py <spdl_dir> <out.json>"""
import re, sys, os, json

def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'//[^\n]*', '', s)

def parse_value(v):
    v = v.strip().rstrip(';').strip()
    if v.startswith('"') and v.endswith('"'): return v[1:-1]
    if re.fullmatch(r'-?\d+', v): return int(v)
    if re.fullmatch(r'-?\d*\.\d+(e-?\d+)?|-?\d+e-?\d+', v, re.I): return float(v)
    if v.lower() == 'true': return True
    if v.lower() == 'false': return False
    return v

def block_body(s, start):
    """s[start] == '{' -> return (body, end_index_after_closing_brace)"""
    depth = 0
    for i in range(start, len(s)):
        if s[i] == '{': depth += 1
        elif s[i] == '}':
            depth -= 1
            if depth == 0: return s[start+1:i], i + 1
    return s[start+1:], len(s)

def parse_items(body):
    items = []
    for line in body.split(','):
        m = re.match(r'\s*"([^"]*)"\s*=\s*([^\s,]+)', line.strip())
        if m: items.append([m.group(1), parse_value(m.group(2))])
    return items

def parse_param(name, body):
    p = {'sn': name}
    i = 0
    while i < len(body):
        m = re.match(r'\s*(\w+)\s*(=|\{)', body[i:])
        if not m:
            nl = body.find('\n', i); i = len(body) if nl < 0 else nl + 1; continue
        key = m.group(1)
        if m.group(2) == '{':
            inner, end = block_body(body, i + m.end() - 1)
            if key == 'Items': p['items'] = parse_items(inner)
            elif key == 'Parameter':
                pass
            i = end; continue
        j = body.find(';', i + m.end()); val = body[i + m.end():j if j >= 0 else len(body)]
        i = (j + 1) if j >= 0 else len(body)
        if key == 'Range':
            mm = re.match(r'\s*(\S+)\s+to\s+(\S+)(?:\s+by\s+(\S+))?', val)
            if mm: p['range'] = [parse_value(mm.group(1)), parse_value(mm.group(2))] + ([parse_value(mm.group(3))] if mm.group(3) else [])
        elif key == 'UIRange':
            mm = re.match(r'\s*(\S+)\s+to\s+(\S+)', val)
            if mm: p['uirange'] = [parse_value(mm.group(1)), parse_value(mm.group(2))]
        elif key == 'Caps': p['caps'] = [c.strip() for c in val.split(',')]
        elif key in ('Name', 'Description', 'Type', 'Value', 'UIType', 'Class', 'Keywords', 'Texturable', 'ReadOnly', 'GUID'):
            p['label' if key == 'Name' else key.lower()] = parse_value(val)
    return p

def split_layout_parts(s):
    """Comma-split Softimage layout item args without breaking LabelWidth(80%, 10) or quoted strings."""
    parts, cur, depth, in_q = [], [], 0, None
    for ch in s:
        if in_q:
            cur.append(ch)
            if ch == in_q: in_q = None
            continue
        if ch in ('"', "'"):
            in_q = ch; cur.append(ch); continue
        if ch == '(':
            depth += 1; cur.append(ch); continue
        if ch == ')':
            depth = max(0, depth - 1); cur.append(ch); continue
        if ch == ',' and depth == 0:
            p = ''.join(cur).strip()
            if p: parts.append(p)
            cur = []; continue
        cur.append(ch)
    p = ''.join(cur).strip()
    if p: parts.append(p)
    return parts

def parse_layout(body):
    """returns list of nodes: {'group':name,'items':[...]} | {'param':name, 'opts':[...]} | {'row':[...]} | {'tab':name,'items':[...]}"""
    out = []; i = 0
    while i < len(body):
        m = re.match(r'\s*(Group|Row|Tab)\s*(?:"([^"]*)")?\s*\{', body[i:])
        if m:
            inner, end = block_body(body, i + m.end() - 1)
            out.append({m.group(1).lower(): m.group(2) or '', 'items': parse_layout(inner)}); i = end; continue
        m = re.match(r'\s*([^;{}]+);', body[i:])
        if m:
            parts = split_layout_parts(m.group(1))
            if parts and parts[0] not in ('mute',) and not parts[0].lower().startswith('inline') and not parts[0].startswith('Tab') and not parts[0].startswith('Group'):
                node = {'param': parts[0].strip('"')}
                if len(parts) > 1: node['opts'] = parts[1:]
                out.append(node)
            i += m.end(); continue
        i += 1
    return out

def parse_file(path):
    raw = open(path, encoding='latin-1').read()
    s = strip_comments(raw)
    r = {'file': os.path.basename(path)}
    m = re.search(r'include\s+"([^"]+)"', s); r['includes'] = re.findall(r'include\s+"([^"]+)"', s)
    m = re.search(r'Reference\s*=\s*"([^"]+)"', s); r['ref'] = m.group(1) if m else None
    m = re.search(r'PropertySet\s+"([^"]+)"\s*\{', s)
    r['propset'] = m.group(1) if m else None
    params = []
    for pm in re.finditer(r'Parameter\s+"([^"]+)"\s*\{', s):
        body, _ = block_body(s, pm.end() - 1)
        params.append(parse_param(pm.group(1), body))
    r['params'] = params
    m = re.search(r'Layout\s+"([^"]*)"\s*\{', s)
    if m:
        body, _ = block_body(s, m.end() - 1); r['layout'] = parse_layout(body)
    m = re.search(r'HelpFile\s*=\s*"([^"]+)"', s); r['help'] = m.group(1) if m else None
    return r

if __name__ == '__main__':
    d, out = sys.argv[1], sys.argv[2]
    res = {}
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith('.spdl'): continue
        try: res[f] = parse_file(os.path.join(d, f))
        except Exception as e: res[f] = {'error': str(e)}
    json.dump(res, open(out, 'w'), indent=0)
    n = sum(len(v.get('params', [])) for v in res.values()); print(len(res), 'files', n, 'params')
