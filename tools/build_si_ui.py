"""Build the clone's UI data straight from the Softimage 2015 SP2 install files copied under data/si/:
  bitmaps/*.bmp            -> public/si/icons.png + src/data/si/icons.json  (cyan = transparent)
  keymaps/*.xsikm          -> src/data/si/keymaps.json   (per key map, per context: name/key/modifiers)
  pe_resources.json        -> src/data/si/menus.json     (main menubar, viewport menus, MCP/tool option menus)
  dict.json                -> src/data/si/strings.json   (status-bar hints, MCP tooltips)
  toolbars/*.xsitb         -> src/data/si/shelf.json, panelswitcher.json
  layouts/default.xsily    -> src/data/si/layout_default.json
  views/*.xsivw            -> src/data/si/views.json
Run: python3 tools/build_si_ui.py
"""
import json, os, re, glob, math
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SI = os.path.join(ROOT, 'data', 'si'); OUT = os.path.join(ROOT, 'src', 'data', 'si'); PUB = os.path.join(ROOT, 'public', 'si')
os.makedirs(OUT, exist_ok=True); os.makedirs(PUB, exist_ok=True)

# ---------------------------------------------------------------- icons
def icons():
    files = sorted(glob.glob(os.path.join(SI, 'bitmaps', '*.bmp')))
    cell = 36; cols = 12; rows = math.ceil(len(files) / cols)
    sheet = Image.new('RGBA', (cols * cell, rows * cell), (0, 0, 0, 0)); index = {}
    for i, f in enumerate(files):
        im = Image.open(f).convert('RGBA'); px = im.load()
        key = px[0, 0][:3]
        if key == (0, 255, 255):
            for y in range(im.height):
                for x in range(im.width):
                    if px[x, y][:3] == key: px[x, y] = (0, 0, 0, 0)
        x = (i % cols) * cell + (cell - im.width) // 2; y = (i // cols) * cell + (cell - im.height) // 2
        sheet.paste(im, (x, y)); index[os.path.basename(f)[:-4].lower()] = {'x': x, 'y': y, 'w': im.width, 'h': im.height}
    sheet.save(os.path.join(PUB, 'icons.png'))
    json.dump({'cell': cell, 'sheet': 'si/icons.png', 'icons': index}, open(os.path.join(OUT, 'icons.json'), 'w'))
    print('icons', len(index))

# ---------------------------------------------------------------- keymaps
VK = {'VK_ESCAPE': 'Escape', 'VK_TAB': 'Tab', 'VK_RETURN': 'Enter', 'VK_SPACE': ' ', 'VK_DELETE': 'Delete', 'VK_BACK': 'Backspace', 'VK_INSERT': 'Insert',
      'VK_HOME': 'Home', 'VK_END': 'End', 'VK_PRIOR': 'PageUp', 'VK_NEXT': 'PageDown', 'VK_UP': 'ArrowUp', 'VK_DOWN': 'ArrowDown', 'VK_LEFT': 'ArrowLeft', 'VK_RIGHT': 'ArrowRight',
      'VK_ADD': '+', 'VK_SUBTRACT': '-', 'VK_MULTIPLY': '*', 'VK_DIVIDE': '/', 'VK_OEM_PLUS': '=', 'VK_OEM_MINUS': '-', 'VK_OEM_PERIOD': '.', 'VK_OEM_COMMA': ',',
      'VK_OEM_1': ';', 'VK_OEM_2': '/', 'VK_OEM_3': '`', 'VK_OEM_4': '[', 'VK_OEM_5': '\\', 'VK_OEM_6': ']', 'VK_OEM_7': "'", 'VK_APPS': 'ContextMenu'}
CONTEXTS = ['Global', 'XSI', 'View Shortcuts', 'Transform Tool', 'Transform Tool Proportional', 'Tweak Tool', 'Tweak Tool Proportional', 'Select Tool', 'Layout Shortcuts']
def keymaps():
    maps = {}
    for f in sorted(glob.glob(os.path.join(SI, 'keymaps', '*.xsikm'))):
        r = ET.parse(f).getroot(); km = r.find('keymap'); name = km.get('name'); ctxs = {}
        for kl in km.findall('keylist'):
            ctx = kl.get('name') or 'Global'
            if ctx not in CONTEXTS: continue
            keys = []
            for k in kl.findall('key'):
                key = k.get('key')
                if not key: continue
                if key.startswith('VK_F') and key[4:].isdigit(): js = 'F' + key[4:]
                elif key.startswith('VK_NUMPAD'): js = 'Numpad' + key[9:]
                else: js = VK.get(key, key.lower() if len(key) == 1 else key)
                mods = [m.replace('DSCMD_', '').replace('MOD_', '').lower() for m in (k.get('modifier') or '').split('|') if m]
                keys.append({'name': k.get('name'), 'key': js, 'mods': mods})
            ctxs[ctx] = keys
        maps[name] = ctxs
    json.dump(maps, open(os.path.join(OUT, 'keymaps.json'), 'w'), indent=0)
    print('keymaps', {k: sum(len(v) for v in c.values()) for k, c in maps.items()})

# ---------------------------------------------------------------- menus from PE resources
def clean(tree):
    out = []
    for it in tree:
        if it.get('separator'): out.append({'separator': True}); continue
        label = (it.get('label') or '').replace('&&', '\x00').replace('&', '').replace('\x00', '&')
        label, _, accel = label.partition('\t')
        n = {'label': label.strip(), 'id': it.get('id')}
        if accel: n['accel'] = accel.strip()
        if it.get('items'): n['items'] = clean(it['items'])
        out.append(n)
    return out
def menus():
    pe = json.load(open(os.path.join(SI, 'pe_resources.json')))
    pick = {
        'mainMenu': ('XSI.exe', '128'), 'fileMenu': ('XSI.exe', '344'), 'toolbarMenu': ('XSI.exe', '245'), 'roomMenu': ('XSI.exe', '146'),
        'toolButtonMenu': ('XSI.exe', '244'), 'layoutItemMenu': ('XSI.exe', '308'), 'toolbarReadOnlyMenu': ('XSI.exe', '345'),
        'viewCamera': ('viewcontrol.dll', '101'), 'viewVisibility': ('viewcontrol.dll', '102'),
        'viewStereo': ('viewcontrol.dll', '127'), 'viewCube': ('viewcontrol.dll', '128'), 'viewContext': ('viewcontrol.dll', '106'), 'viewObjectContext': ('viewcontrol.dll', '124'),
        'vmLayout': ('vm.dll', '202'), 'vmResize': ('vm.dll', '272'), 'vmMuteSolo': ('vm.dll', '290'),
        'mcpSelect': ('mcp.dll', '201'), 'mcpAnimation': ('mcp.dll', '202'), 'mcpEdit': ('mcp.dll', '203'), 'mcpTransform': ('mcp.dll', '204'), 'mcpPlayback': ('mcp.dll', '219'),
        'mcpConstraints': ('mcp.dll', '293'), 'mcpGet': ('mcp.dll', '294'), 'mcpLayer': ('mcp.dll', '350'), 'mcpExplore': ('mcp.dll', '353'), 'mcpSelFilter': ('mcp.dll', '356'),
        'mcpNavigate': ('mcp.dll', '470'), 'mcpReference': ('mcp.dll', '482'), 'mcpSymmetry': ('mcp.dll', '483'), 'mcpSnap': ('mcp.dll', '10002'), 'mcpSnapPoints': ('mcp.dll', '10004'),
        'mcpSnapSegments': ('mcp.dll', '10005'), 'mcpSnapFacets': ('mcp.dll', '10006'),
        'mcpControlTips': ('mcp.dll', '325'), 'mcpRefModeTips': ('mcp.dll', '487'),
        'toolTranslate': ('viewinteraction.dll', '530'), 'toolRotate': ('viewinteraction.dll', '531'), 'toolScale': ('viewinteraction.dll', '532'), 'toolPivot': ('viewinteraction.dll', '533'),
        'toolTweak': ('viewinteraction.dll', '535'), 'toolTweakNormals': ('viewinteraction.dll', '536'), 'toolKnife': ('viewinteraction.dll', '345'), 'toolCurve': ('viewinteraction.dll', '534'),
        'toolCurveDirectManip': ('viewinteraction.dll', '349'),
        'explorerView': ('sceneexplorer.dll', '300'), 'explorerScope': ('sceneexplorer.dll', '302'), 'explorerFilters': ('sceneexplorer.dll', '303'), 'explorerContext': ('sceneexplorer.dll', '304'),
        'explorerTree': ('sceneexplorer.dll', '305'),
        'ppgMain': ('genppg.dll', '223'), 'ppgAnim': ('genppg.dll', '205'), 'keyingPanel': ('genppg.dll', '264'),
        'ppgTree': ('genppg.dll', '235'), 'ppgTabButton': ('genppg.dll', '247'),
        'uiModules': ('uiut.dll', '211'), 'uiEdit': ('uiut.dll', '213'), 'uiView': ('uiut.dll', '181'),
        'uiSplitter': ('uiut.dll', '163'), 'uiPaneContext': ('uiut.dll', '246'),
    }
    # uiut 246 and sceneexplorer 305 carry several named popups in one resource; keep every popup node so
    # the pane context menu can address Context / Relationship / Stack Window / Splitter Contextual.
    MULTI_POPUP = {'uiPaneContext'}
    out = {}
    for k, (f, mid) in pick.items():
        t = pe.get(f, {}).get('menus', {}).get(mid)
        if isinstance(t, list):
            t = clean(t)
            if k not in ('mainMenu', 'fileMenu') and k not in MULTI_POPUP and len(t) == 1 and t[0].get('items'): t = t[0]['items']  # popup resources wrap their items in one named node
            if k in MULTI_POPUP: t = [n for n in t if n.get('items')]  # drop the trailing bare separators between popups
            out[k] = t
    json.dump(out, open(os.path.join(OUT, 'menus.json'), 'w'), indent=0)
    print('menus', list(out))

# ---------------------------------------------------------------- strings (status hints / tooltips)
def strings():
    d = json.load(open(os.path.join(SI, 'dict.json')))
    out = {}
    for mod, tbl in d.items():  # every dictionary; id 0 carries a stray header code unit in front of its text
        out[mod] = {k: (v.lstrip('\ufffd') if k != '0' else v[1:] if v and ord(v[0]) > 0x7f else v) for k, v in tbl.items()}
    json.dump(out, open(os.path.join(OUT, 'strings.json'), 'w'), indent=0, ensure_ascii=False)
    print('strings', {k: len(v) for k, v in out.items()})

# ---------------------------------------------------------------- toolbars
def toolbars():
    def items(tab):
        res = []
        for it in tab.findall('item'):
            n = {'type': it.get('type'), 'label': it.get('label'), 'bitmap': (it.get('bitmap') or '').replace('.bmp', '').lower() or None, 'tooltip': it.get('tooltip'), 'w': it.get('userwidth'), 'h': it.get('userheight')}
            st = it.find('scripttext')
            if st is not None and st.text:
                txt = re.sub(r'^\s*<!\[CDATA\[|\]\]>\s*$', '', st.text.strip()); n['script'] = txt
            res.append(n)
        return res
    shelf = ET.parse(os.path.join(SI, 'toolbars', 'Main_Shelf.xsitb')).getroot()
    tabs = [{'label': t.get('label'), 'items': items(t)} for t in shelf.iter('tab')]
    json.dump(tabs, open(os.path.join(OUT, 'shelf.json'), 'w'), indent=0)
    ps = ET.parse(os.path.join(SI, 'toolbars', 'PanelSwitcher.xsitb')).getroot()
    json.dump([items(t) for t in ps.iter('tab')][0], open(os.path.join(OUT, 'panelswitcher.json'), 'w'), indent=0)
    print('shelf tabs', [t['label'] for t in tabs])

# ---------------------------------------------------------------- layout
def layout():
    r = ET.parse(os.path.join(SI, 'layouts', 'default.xsily')).getroot(); rv = r.find('relationalview')
    def node(el):
        if el.tag == 'frameset':
            return {'kind': 'frameset', 'name': el.get('name'), 'displayname': el.get('displayname'), 'bitmap': el.get('bitmap'), 'orientation': el.get('orientation'), 'splitter': el.get('splitter'), 'sizes': el.get('sizechild', '').split(','), 'optional': el.get('optional'), 'children': [node(c) for c in el if c.tag in ('frameset', 'frame', 'switcher')]}
        if el.tag == 'switcher':
            return {'kind': 'switcher', 'name': el.get('name'), 'displayname': el.get('displayname'), 'type': el.get('type'), 'buttonside': el.get('buttonside'), 'orientation': el.get('orientation'), 'active': int(el.get('active') or 0), 'buttonsize': el.get('buttonsize'), 'sizes': el.get('sizechild', '').split(','), 'optional': el.get('optional'), 'children': [node(c) for c in el if c.tag in ('frameset', 'frame', 'switcher')]}
        props = {p.tag: (p.text or '').strip() for p in (el.find('properties') or [])}
        return {'kind': 'frame', 'name': el.get('name'), 'displayname': el.get('displayname'), 'type': el.get('type'), 'bitmap': el.get('bitmap'), 'optional': el.get('optional'), 'props': props}
    top = [c for c in rv if c.tag == 'frameset'][0]
    out = {'name': rv.get('name'), 'width': int(rv.get('width')), 'height': int(rv.get('height')), 'tree': node(top),
           'viewdefaultpos': {v.get('type'): v.get('position') for v in rv.find('viewdefaultpos')}}
    json.dump(out, open(os.path.join(OUT, 'layout_default.json'), 'w'), indent=0)
    print('layout', out['name'], out['width'], out['height'])
    # every layout shipped in Application/layouts (Default, Dual, 1024 x 768, Autohide) → layouts.json
    alls = {}
    for f in sorted(os.listdir(os.path.join(SI, 'layouts'))):
        if not f.endswith('.xsily'): continue
        r2 = ET.parse(os.path.join(SI, 'layouts', f)).getroot(); rv2 = r2.find('relationalview')
        tops = [c for c in rv2 if c.tag == 'frameset']
        alls[rv2.get('name')] = {'name': rv2.get('name'), 'file': f, 'width': int(rv2.get('width') or 0), 'height': int(rv2.get('height') or 0), 'trees': [node(t) for t in tops], 'tree': node(tops[0]) if tops else None}
    json.dump(alls, open(os.path.join(OUT, 'layouts.json'), 'w'), indent=0)
    print('layouts', list(alls.keys()), [len(v['trees']) for v in alls.values()])

# ---------------------------------------------------------------- views
def views():
    out = []
    for f in sorted(glob.glob(os.path.join(SI, 'views', '*.xsivw'))):
        r = ET.parse(f).getroot(); vd = r.find('viewdef'); d = vd.find('definition')
        out.append({'file': os.path.basename(f), 'name': vd.get('name'), 'clsid': vd.get('clsid'), 'defaultsize': d.get('defaultsize'), 'maxinstances': d.get('maxinstances'), 'supportedtypes': d.get('supportedtypes')})
    json.dump(out, open(os.path.join(OUT, 'views.json'), 'w'), indent=0)
    print('views', len(out))

# ---------------------------------------------------------------- built-in property sets + preference pages (SPDL)
VT = {'VT_R8': 'double', 'VT_R4': 'double', 'VT_I4': 'int', 'VT_UI4': 'int', 'VT_I2': 'int', 'VT_UI2': 'int', 'VT_BOOL': 'bool', 'VT_BSTR': 'string', 'siDisplayMode': 'int'}
PROPSETS = ['C3DKineState', 'C3DVisibilityAndDisplay', 'C3DDisplayProp', 'C3DGeomApprox', 'C3DCamera', 'C3DCameraVisibilityProp', 'C3DCameraDisplayProp', 'C3DLightPoint', 'C3DSceneColors', 'C3DSceneAmbience', 'C3DTransformProps', 'C3DMaterial', 'C3DSpotRoot', 'C3DSpotInterest']
def propsets():
    spdl = json.load(open(os.path.join(ROOT, 'data', 'spdl', 'spdl.json')))
    keys = PROPSETS + [k[:-5] for k in spdl if k.startswith('C3DPrefs')]
    out = {}
    for k in keys:
        v = spdl.get(k + '.spdl')
        if not v: continue
        params = []
        for p in v.get('params', []):
            t = VT.get(p.get('type'));
            if not t or p['sn'].startswith('Button') or 'ReadOnly' in (p.get('caps') or []) and k.startswith('C3DPrefs'): continue
            d = {'sn': p['sn'], 'label': p.get('label') or p['sn'], 'type': t, 'default': p.get('value')}
            if p.get('items'): d['type'] = 'enum'; d['items'] = p['items']
            rng = p.get('range'); ui = p.get('uirange')
            if isinstance(rng, list) and len(rng) >= 2 and all(isinstance(x, (int, float)) for x in rng[:2]): d['min'], d['max'] = rng[0], rng[1]
            if isinstance(ui, list) and len(ui) >= 2 and all(isinstance(x, (int, float)) for x in ui[:2]): d['uimin'], d['uimax'] = ui[0], ui[1]
            if p.get('description'): d['desc'] = p['description']
            if d['default'] is None: d['default'] = 0 if t in ('double', 'int') else False if t == 'bool' else ''
            params.append(d)
        label = next((p.get('label') for p in v.get('params', []) if p.get('type') == 'VT_EMPTY'), None) or re.sub(r'(?<!^)(?=[A-Z])', ' ', k.replace('C3DPrefs', ''))
        out[k] = {'label': label, 'params': params, 'layout': v.get('layout') or []}
    json.dump(out, open(os.path.join(OUT, 'propsets.json'), 'w'), indent=0)
    print('propsets', len(out), [k for k in out if k.startswith('C3DPrefs')][:5], '...')

if __name__ == '__main__':
    icons(); keymaps(); menus(); strings(); toolbars(); layout(); views(); propsets()
