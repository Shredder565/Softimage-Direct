"""Parse Softimage's phenolib shader .spdl files (SPDL 2.0 syntax: Parameter "x" input { title=; type=; value=; }) into
src/data/si/shaders.json: parameters with labels/types/defaults/UI ranges/enum items and the "Default" PPG layout.
Usage: python3 tools/build_shaders.py data/si/shaders src/data/si/shaders.json"""
import re, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from parse_spdl import strip_comments, block_body, parse_layout, parse_value

def parse_param2(name, body):
    p = {'sn': name}
    i = 0
    while i < len(body):
        m = re.match(r'\s*(\w+)(?:\s+"[^"]*")?\s*(=|\{)', body[i:])
        if not m:
            nl = body.find('\n', i); i = len(body) if nl < 0 else nl + 1; continue
        key = m.group(1)
        if m.group(2) == '{':
            inner, end = block_body(body, i + m.end() - 1)
            if key.lower() == 'items': p['items'] = [[a, parse_value(b)] for a, b in re.findall(r'"([^"]*)"\s*=\s*([^,;\s]+)', inner)]
            elif key.lower() == 'type': p['type'] = 'array'
            i = end; continue
        j = body.find(';', i + m.end()); val = body[i + m.end():j if j >= 0 else len(body)]
        i = (j + 1) if j >= 0 else len(body)
        k = key.lower(); v = val.strip()
        if k == 'title': p['label'] = parse_value(v)
        elif k == 'type': p['type'] = v
        elif k == 'value': p['value'] = [parse_value(x) for x in v.split()] if ' ' in v else parse_value(v)
        elif k in ('texturable', 'inspectable', 'animatable'): p[k] = v == 'on'
        elif k == 'uirange' or k == 'range':
            mm = re.match(r'\s*(\S+)\s+to\s+(\S+)(?:\s+by\s+(\S+))?', v)
            if mm: p[k] = [parse_value(mm.group(1)), parse_value(mm.group(2))]
        elif k == 'ui' and 'items' not in p:
            pass
    return p

def parse_shader(path):
    s = strip_comments(open(path, encoding='latin-1').read())
    m = re.search(r'PropertySet\s+"([^"]+)"\s*\{', s); r = {'file': os.path.basename(path), 'propset': m.group(1) if m else None}
    body, _ = block_body(s, m.end() - 1) if m else ('', 0)
    params = []
    i = 0
    while True:
        pm = re.compile(r'Parameter\s+"([^"]+)"\s+(input|output)\s*\{').search(body, i)
        if not pm: break
        pb, end = block_body(body, pm.end() - 1)
        p = parse_param2(pm.group(1), pb); p['dir'] = pm.group(2); params.append(p); i = end
    r['params'] = params
    out = next((p for p in params if p['dir'] == 'output'), None); r['title'] = out['label'] if out else r['propset']
    r['output'] = out['type'] if out else None
    lm = re.search(r'Layout\s+"Default"\s*\{', s)
    if lm: lb, _ = block_body(s, lm.end() - 1); r['layout'] = parse_layout(lb)
    rm = re.search(r'Layout\s+"RenderTree"\s*\{', s)
    if rm: lb, _ = block_body(s, rm.end() - 1); r['rtlayout'] = parse_layout(lb)
    m = re.search(r'Defaults\s*\{(.*?)\}', s, re.S)
    if m:
        for pm in re.finditer(r'(\w+)\s*\{([^}]*)\}', m.group(1)):
            d = dict(re.findall(r'(\w+)\s*=\s*([^;]+);', pm.group(2)))
            p = next((x for x in params if x['sn'] == pm.group(1)), None)
            if p:
                if 'UIRange' in d:
                    mm = re.match(r'\s*(\S+)\s+to\s+(\S+)', d['UIRange']); p['uirange'] = [parse_value(mm.group(1)), parse_value(mm.group(2))] if mm else None
                if 'Name' in d: p['label'] = parse_value(d['Name'])
                if 'UIType' in d: p['uitype'] = parse_value(d['UIType'])
                if 'Items' in d: pass
    return r

if __name__ == '__main__':
    d, out = sys.argv[1], sys.argv[2]; res = {}
    for f in sorted(os.listdir(d)):
        if f.lower().endswith('.spdl'):
            r = parse_shader(os.path.join(d, f))
            if not r['propset']: print('skip', f); continue
            res[r['propset'].replace('_params', '')] = r
    json.dump(res, open(out, 'w'), indent=0)
    for k, v in res.items(): print(k, v['title'], len(v['params']), 'params', 'layout' if v.get('layout') else '-')
