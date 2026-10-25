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
# Dump-backed Model generator SPDL picks (softimage-pc dialogs/spdl-layouts-model-ui.json).
# Prefer real generator SPDLs over the shared C3DParametricSurfaceGenerator / obsolete stubs.
SPDL_FORCE = {
    'extrude2profs': 'ExtrusionTwoProfiles.spdl',
    'revolution': 'revolutionAxisOp.spdl',
    'filletcrv': 'filletcrv.spdl',
}
# Model generators whose Softimage runtime dump missed the op (ApplyGenOp ok:false) but SPDL
# Layout/params exist in the dialogs pack — seed opdefs so GeneratorOperator PPG can bind.
SPDL_SEED = {
    'blendcrv': 'blendcrvop.spdl',
    'mergecrv': 'mergecrv.spdl',
    'mergemesh': 'C3DMergeMeshOp.spdl',
}
# When SPDL Layout is only `inline GenOp…` / empty after prune, synthesize Softimage-like groups.
SYNTH_LAYOUT = {
    'filletcrv': [{'group': 'Fillet', 'items': [{'param': 'rad'}, {'param': 'tol'}]}],
    'booleansrftopoop': [{'group': 'Boolean', 'items': [{'param': 'booleanmode'}]}],
    # extractcrvsegment Layout is GenOp-inline + invert stuck; Softimage page shows these params.
    'extractcrvseg': [{'group': 'Extract', 'items': [{'param': 'startpos'}, {'param': 'endpos'}, {'param': 'invert'}]}],
    'blendcrv': [{'group': 'Blend', 'items': [{'param': 'startscl'}, {'param': 'endscl'}]}],
    'mergemesh': [{'group': 'Merge', 'items': [{'param': 'tolerance'}, {'param': 'blend'}, {'param': 'NormalizeWeights'}]}],
}
# Softimage GenOpInputsButtonsDisplay.spdl (has_layout:false) — attested Button text only.
# Runtime siLayout() also prepends this for inline consumers; keep here for rebuild fidelity.
GENOP_INPUTS_CHROME = [
    {'group': 'Inputs', 'opts': ['continue', '30%'], 'items': [
        {'button': 'HideInputs', 'label': 'Hide/Unhide', 'opts': ['continue'], 'command': 'HideGeneratorInputs'},
        {'button': 'DeleteInputs', 'label': 'Delete', 'command': 'DeleteGeneratorInputs'},
        {'param': 'syncwithinputspose'},
    ]},
    {'group': "Inputs' construction mode", 'items': [
        {'param': 'inputreadregion', 'opts': ['NoLabel']},
    ]},
]
GENOP_INLINE_OPS = {
    'booleansrftopoop', 'CurveListToMesh', 'mergemesh', 'nurbstomesh', 'TransferAttributes',
    'extractcrvseg', 'filletcrv', 'fitcrv', 'fitsrf', 'intersectsrf', 'mergecrv', 'blendcrv',
}

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

def inline_trailing_param(param: str):
    """Recover `invert` / `booleanmode` stuck after GenOp `inline \"…\"\\n\\tname` dump artifacts."""
    s = str(param)
    if not s.lower().lstrip().startswith('inline'):
        return None
    if '\n' not in s:
        return None
    tail = s.split('\n')[-1].strip()
    if not tail:
        return None
    # last token; strip optional leading tabs
    name = tail.split()[-1].strip().strip('"').strip("'")
    return name or None

def layout_for_nodes(lay, sns):
    if not lay: return None
    sns = set(s.lower() for s in sns)
    def prune(nodes):
        out = []
        for n in nodes:
            if n.get('button'):
                # Attested GenOp SPDL Button chrome (Hide/Unhide, Delete) — keep text flags.
                out.append({k: n[k] for k in ('button', 'label', 'opts', 'command') if k in n and n[k] is not None})
                continue
            if 'param' in n:
                raw = str(n['param'])
                # Skip Softimage inline GenOp button includes (not Layout grammar), but keep
                # a trailing param name when the dump stuck it onto the inline line.
                if raw.lower().lstrip().startswith('inline'):
                    tail = inline_trailing_param(raw)
                    if tail and tail.lower() in sns:
                        out.append({**n, 'param': tail})
                    continue
                if raw.lower() in sns: out.append(n)
            else:
                k = 'group' if 'group' in n else 'row' if 'row' in n else 'tab'
                items = prune(n.get('items') or [])
                if items:
                    node = {k: n[k], 'items': items}
                    if n.get('opts'): node['opts'] = n['opts']
                    out.append(node)
        return out
    pruned = prune(lay)
    return pruned or None

def with_genop_chrome(op_type, lay, sns):
    """Prepend attested GenOp Hide/Delete Inputs groups for Softimage inline consumers."""
    if op_type not in GENOP_INLINE_OPS:
        return lay
    chrome = layout_for_nodes(GENOP_INPUTS_CHROME, sns) or []
    if not chrome:
        return lay
    if lay and any(n.get('group') == 'Inputs' and any(i.get('button') == 'HideInputs' for i in (n.get('items') or [])) for n in lay):
        return lay
    return chrome + (lay or [])

def layout_for(f, sns):
    return layout_for_nodes(spdl.get(f, {}).get('layout'), sns)

VT_NAME = {
    'VT_I2': 'int', 'VT_I4': 'int', 'VT_INT': 'int', 'VT_UI1': 'int', 'VT_UI2': 'int', 'VT_UI4': 'int',
    'VT_R4': 'double', 'VT_R8': 'double', 'VT_BOOL': 'bool', 'VT_BSTR': 'string', 'VT_EMPTY': None,
}

def conv_spdl_param(p):
    """Map parsed SPDL param → opdefs param (no runtime dump). Skip empty title stubs."""
    sn = p.get('sn')
    if not sn or sn.lower() in SKIP_SN: return None
    tname = VT_NAME.get((p.get('type') or '').upper())
    if tname is None and (p.get('type') or '').upper() == 'VT_EMPTY':
        return None
    if p.get('items'):
        tname = 'enum'
    elif (p.get('uitype') or '') == 'Check':
        tname = 'bool'
    elif tname is None:
        tname = 'double'
    d = {'sn': sn, 'label': p.get('label') or sn, 'type': tname, 'default': p.get('value')}
    if d['default'] is None:
        d['default'] = 0 if tname in ('double', 'int', 'enum') else False if tname == 'bool' else ''
    if tname in ('double', 'int') and p.get('uirange') and all(isinstance(x, (int, float)) for x in (p['uirange'] or [])[:2]):
        d['uimin'], d['uimax'] = p['uirange'][0], p['uirange'][1]
    if tname in ('double', 'int') and p.get('range'):
        mn, mx = (p['range'] + [None, None])[:2]
        if isinstance(mn, (int, float)) and mn > -BIG: d['min'] = mn
        if isinstance(mx, (int, float)) and mx < BIG: d['max'] = mx
    if p.get('items'):
        d['items'] = p['items']
    if p.get('description'):
        d['desc'] = p['description']
    return d

def seed_from_spdl(op_type, fname):
    entry = spdl.get(fname)
    if not entry: return None
    params = []
    for p in entry.get('params') or []:
        c = conv_spdl_param(p)
        if c: params.append(c)
    if not params: return None
    sns = [p['sn'] for p in params]
    d = {
        'type': op_type,
        'name': entry.get('propset') or op_type,
        'spdl': fname,
        'params': params,
        'source': f'spdl-seed:{fname}',
    }
    lay = layout_for(fname, sns)
    if not lay and op_type in SYNTH_LAYOUT:
        lay = layout_for_nodes(SYNTH_LAYOUT[op_type], sns)
    if lay: d['layout'] = lay
    return d

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
            sns = [p['sn'] for p in params]
            f = SPDL_FORCE.get(t) if SPDL_FORCE.get(t) in SP else None
            score = 0
            if not f:
                f, score = best_spdl(sns, hint)
            sp = SP.get(f, {}) if f else {}
            d = {'type': t, 'name': op['name'], 'spdl': f, 'params': [conv(p, sp.get(p['sn'].lower())) for p in params]}
            lay = layout_for(f, sns) if f else None
            if not lay and t in SYNTH_LAYOUT:
                lay = layout_for_nodes(SYNTH_LAYOUT[t], sns)
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

# Rematch dump-backed Model generator SPDLs / synth layouts (first dump entry may have locked a weaker SPDL).
for t, f in SPDL_FORCE.items():
    if t not in defs or f not in SP: continue
    d = defs[t]
    sns = [p['sn'] for p in d['params']]
    d['spdl'] = f
    lay = layout_for(f, sns)
    if not lay and t in SYNTH_LAYOUT:
        lay = layout_for_nodes(SYNTH_LAYOUT[t], sns)
    if lay: d['layout'] = lay
    elif 'layout' in d: del d['layout']
def layout_param_sns(nodes):
    out = []
    for n in nodes or []:
        if 'param' in n: out.append(str(n['param']).lower())
        else: out.extend(layout_param_sns(n.get('items')))
    return out

for t, nodes in SYNTH_LAYOUT.items():
    if t not in defs: continue
    d = defs[t]
    sns = [p['sn'] for p in d['params']]
    want = layout_param_sns(nodes)
    have = layout_param_sns(d.get('layout'))
    # Keep existing layout only when it already covers the synth param set (e.g. Boolean).
    # GenOp-residue pages that recovered only a trailing param (invert / rad) get replaced.
    if d.get('layout') and want and all(w in have for w in want):
        continue
    lay = layout_for_nodes(nodes, sns)
    if lay: d['layout'] = lay

# Seed Model generators present in SPDL dump pack but missing from runtime dump objects.
for t, fname in SPDL_SEED.items():
    if t in defs: continue
    seeded = seed_from_spdl(t, fname)
    if seeded: defs[t] = seeded

# Re-apply SYNTH after seeds (seed layout_for may leave GenOp-residue pages incomplete).
for t, nodes in SYNTH_LAYOUT.items():
    if t not in defs: continue
    d = defs[t]
    sns = [p['sn'] for p in d['params']]
    want = layout_param_sns(nodes)
    have = layout_param_sns(d.get('layout'))
    if d.get('layout') and want and all(w in have for w in want):
        continue
    lay = layout_for_nodes(nodes, sns)
    if lay: d['layout'] = lay

# Prepend attested GenOp Hide/Delete chrome for Softimage GenOpInputsButtonsDisplay inline consumers.
for t in list(GENOP_INLINE_OPS):
    if t not in defs: continue
    d = defs[t]
    sns = [p['sn'] for p in d['params']]
    lay = with_genop_chrome(t, d.get('layout'), sns)
    if lay: d['layout'] = lay

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
