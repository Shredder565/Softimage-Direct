"""Merge the runtime dump (data/dump/si_model_dump*.json) with parsed SPDLs (data/spdl/spdl.json)
into src/data/opdefs.json: one entry per Softimage operator type (and per primitive preset for 'geom')
with ordered parameters, defaults, hard/UI ranges, enum items, labels and the PPG layout."""
import json, os, glob, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spdl = json.load(open(os.path.join(root, 'data/spdl/spdl.json')))
dumps = []
for f in sorted(glob.glob(os.path.join(root, 'data/dump/si_model_dump*.json'))): dumps += json.load(open(f))

VT = {2: 'int', 3: 'int', 4: 'double', 5: 'double', 11: 'bool', 8: 'string', 31: 'string', 17: 'int', 18: 'int', 19: 'int', 20: 'int', 21: 'int'}
SKIP_SN = {'mute'}  # handled generically
BIG = 1e300

def spdl_params_index():
    idx = {}
    for f, v in spdl.items():
        for p in v.get('params', []):
            idx.setdefault(f, {})[p['sn'].lower()] = p
    return idx
SP = spdl_params_index()

def best_spdl(sns, hint=None):
    """Pick SPDL by param overlap; boost filename/propset matches so Shear≠Bulge when params coincide."""
    sns = set(s.lower() for s in sns)
    best, score = None, -1
    hl = (hint or '').lower().replace(' ', '')
    stem = hl[:-2] if hl.endswith('op') else hl
    for f, ps in SP.items():
        overlap = len(sns & set(ps))
        if overlap == 0 and not hl: continue
        fl = f.lower(); prop = (spdl.get(f, {}).get('propset') or '').lower().replace(' ', '')
        boost = 0
        if hl:
            if fl == hl + '.spdl' or fl == 'c3d' + hl + '.spdl': boost = 100
            elif stem and (fl == stem + '.spdl' or fl == 'c3d' + stem + 'op.spdl' or fl.startswith('c3d' + stem)): boost = 80
            elif hl and hl in fl: boost = 40
            elif stem and stem in prop: boost = 60
            elif hl and hl in prop: boost = 50
        total = overlap * 10 + boost
        if total > score or (total == score and best and len(ps) < len(SP[best])):
            best, score = f, total
    need = max(10, (len(sns) // 2) * 10)
    return (best, score) if best and score >= need else (None, 0)

def conv(p, sp):
    t = VT.get(p.get('t'), 'double')
    d = {'sn': p['sn'], 'label': (sp or {}).get('label') or p.get('n') or p['sn'], 'type': t, 'default': p.get('v')}
    if t in ('double', 'int'):
        mn, mx = p.get('min'), p.get('max')
        if mn is not None and mn > -BIG and mn > -2147483648: d['min'] = mn
        if mx is not None and mx < BIG and mx < 2147483647: d['max'] = mx
        smn, smx = p.get('smin'), p.get('smax')
        if sp and sp.get('uirange') and all(isinstance(x,(int,float)) for x in sp['uirange']): smn, smx = sp['uirange']
        if smn is not None and smn > -BIG and smn > -2147483648: d['uimin'] = smn
        if smx is not None and smx < BIG and smx < 2147483647: d['uimax'] = smx
    if sp and sp.get('items'):
        d['type'] = 'enum'; d['items'] = sp['items']
    elif sp and sp.get('uitype') == 'Check': d['type'] = 'bool'
    if p.get('anim'): d['anim'] = True
    if p.get('ro'): d['ro'] = True
    if sp and sp.get('description'): d['desc'] = sp['description']
    if p.get('sub'):
        subs = [s['sn'] for s in p['sub']]
        if subs[:3] == ['red', 'green', 'blue']: d['type'] = 'color'; d['default'] = [s['v'] for s in p['sub']][:4]
        elif subs == ['x', 'y', 'z']: d['type'] = 'vector'; d['default'] = [s['v'] for s in p['sub']]
    return d

def layout_for(f, sns):
    lay = spdl.get(f, {}).get('layout')
    if not lay: return None
    sns = set(s.lower() for s in sns)
    def prune(nodes):
        out = []
        for n in nodes:
            if 'param' in n:
                if n['param'].lower() in sns: out.append(n)
            else:
                k = 'group' if 'group' in n else 'row' if 'row' in n else 'tab'
                items = prune(n['items'])
                if items: out.append({k: n[k], 'items': items})
        return out
    return prune(lay)

defs = {}; by_menu = {}; prims = {}
for item in dumps:
    if not item.get('ok'): continue
    for o in item.get('objects', []):
        for op in o.get('ops', []):
            t = op['type']; params = [p for p in op.get('params', []) if p['sn'] not in SKIP_SN]
            key = t
            if t == 'geom':
                if not item['l'].startswith('Get/Primitive/'): continue
                key = 'geom:' + item['l'].split('/')[-1] + ('' if '/Polygon Mesh/' in item['l'] else ':' + item['l'].split('/')[-2])
            if t != 'geom' and item['cmd'] in ('ApplyOp', 'ApplyTopoOp', 'ApplyGenOp', 'ApplyPropVolumeOp', 'ApplyKinematicOp'):
                by_menu[item['l']] = {'type': t, 'values': {p['sn']: p.get('v') for p in params}, 'used': item.get('used')}
            if key in defs or not params: continue
            hint = t if t != 'geom' else key.split(':')[1]
            f, score = best_spdl([p['sn'] for p in params], hint)
            sp = SP.get(f, {}) if f else {}
            d = {'type': t, 'name': op['name'], 'spdl': f, 'params': [conv(p, sp.get(p['sn'].lower())) for p in params]}
            lay = layout_for(f, [p['sn'] for p in params]) if f else None
            if lay: d['layout'] = lay
            d['source'] = item['l']
            defs[key] = d
        if item['l'].startswith('Get/Primitive/') and o.get('primParams'):
            key = 'prim:' + item['l'][len('Get/Primitive/'):]
            f, score = best_spdl([p['sn'] for p in o['primParams']], o.get('prim') or key); sp = SP.get(f, {}) if f else {}
            prims[key] = {'type': o.get('prim'), 'spdl': f, 'params': [conv(p, sp.get(p['sn'].lower())) for p in o['primParams']]}
            lay = layout_for(f, [p['sn'] for p in o['primParams']]) if f else None
            if lay: prims[key]['layout'] = lay
        if item['l'].startswith('Get/Primitive/') and o.get('prims') and not (o.get('type') in ('polymsh', 'surfmsh', 'pointcloud', 'crvlist') and not any(x in item['l'] for x in ('/Polygon Mesh/', '/Surface/', '/Point Cloud/', '/Curve/'))):
            cands = [pr for pr in o['prims'] if pr['type'] not in ('polymsh', 'surfmsh', 'crvlist', 'pointcloud') and pr.get('params')]
            cands.sort(key=lambda pr: 0 if pr['type'] == o.get('type') else 1)
            for pr in cands[:1]:
                key = 'shape:' + item['l'][len('Get/Primitive/'):]
                if key in prims: continue
                byname = [f for f, v in spdl.items() if (v.get('propset') or '').lower() == pr['type'].lower() and set(x['sn'].lower() for x in v['params']) >= set(x['sn'].lower() for x in pr['params'])]
                f = byname[0] if byname else best_spdl([p['sn'] for p in pr['params']], pr['type'])[0]; sp = SP.get(f, {}) if f else {}
                prims[key] = {'type': pr['type'], 'name': pr['name'], 'spdl': f, 'params': [conv(p, sp.get(p['sn'].lower())) for p in pr['params']]}
                lay = layout_for(f, [p['sn'] for p in pr['params']]) if f else None
                if lay: prims[key]['layout'] = lay
        # properties & shaders are also useful (material/visibility/display) — keep a few
        for pr in o.get('props', []) or []:
            key = 'prop:' + pr['type']
            if key in defs or not pr.get('params'): continue
            f, score = best_spdl([p['sn'] for p in pr['params']], pr['type']); sp = SP.get(f, {}) if f else {}
            d = {'type': pr['type'], 'name': pr['name'], 'spdl': f, 'params': [conv(p, sp.get(p['sn'].lower())) for p in pr['params'] if p['sn'] not in SKIP_SN]}
            lay = layout_for(f, [p['sn'] for p in pr['params']]) if f else None
            if lay: d['layout'] = lay
            defs[key] = d
        m = o.get('material')
        if m:
            for sh in m.get('shaders', []):
                key = 'shader:' + sh['progid']
                if key in defs: continue
                f, score = best_spdl([p['sn'] for p in sh['params']], sh.get('progid')); sp = SP.get(f, {}) if f else {}
                defs[key] = {'type': sh['progid'], 'name': sh['name'], 'spdl': f, 'params': [conv(p, sp.get(p['sn'].lower())) for p in sh['params']]}
                lay = layout_for(f, [p['sn'] for p in sh['params']]) if f else None
                if lay: defs[key]['layout'] = lay

# mesh statistics of primitives (for verification)
stats = {}
for item in dumps:
    if item.get('ok') and item['l'].startswith('Get/Primitive/'):
        for o in item.get('objects', []):
            if o.get('points') is not None: stats[item['l']] = {'points': o['points'], 'polys': o.get('polys'), 'edges': o.get('edges')}
out = {'ops': defs, 'prims': prims, 'byMenu': by_menu, 'primStats': stats}
os.makedirs(os.path.join(root, 'src/data'), exist_ok=True)
json.dump(out, open(os.path.join(root, 'src/data/opdefs.json'), 'w'), indent=0)
print(len(defs), 'definitions;', sum(1 for v in defs.values() if v.get('spdl')), 'matched to spdl;', sum(1 for v in defs.values() if v.get('layout')), 'with layout')
for k, v in defs.items():
    if not k.startswith('shader:'): print(k, '|', v['name'], '|', v['spdl'], '|', [(p['sn'], p['default']) for p in v['params']][:14])
