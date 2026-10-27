"""UI-surface audit: inventory every UI symbol/table the committed Softimage 2015 SP2 dumps expose,
diff it against AfterImage's `src/` UI inventory, and emit the per-item verdict table.

Inputs (all committed — no Softimage install access needed):
  data/si/pe_resources.json   RT_MENU / RT_DIALOG templates per module (tools/pe_resources.py)
  data/si/dict.json           Application/Dictionary/en/*.dict string tables
  data/si/views/*.xsivw       view definitions
  data/si/layouts/*.xsily     relational-view layouts
  data/si/toolbars/*.xsitb    shelf / panel-switcher / palettes toolbars

Outputs:
  data/dump/si_ui_surface_audit.json   dump-side mirror (inventory + verdicts)
  src/data/si/ui_surface_audit.json    runtime audit table (src/ui/uiSurfaceAudit.ts)
  src/data/si/ui_dialogs.json          attested dialog templates for the wired dialog set
  docs/ghidra/ui-surface-audit.md      the audit table

Verdict is the state of AfterImage `src/` *before* this pass; `wired` marks the items the pass closed.

Clean room: dumps are specification only. Nothing here transcribes decompiler output; the tables carry
Softimage resource ids, item names, DLU rects, fonts and string ids, which is what the wire needs.
Run: python3 tools/build_ui_surface_audit.py
"""
import json
import os
import glob
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SI = os.path.join(ROOT, 'data', 'si')
DUMP = os.path.join(ROOT, 'data', 'dump')
OUT = os.path.join(ROOT, 'src', 'data', 'si')
DOCS = os.path.join(ROOT, 'docs', 'ghidra')

# Modules the audit covers: the five the pass names first, then every other module the committed PE dump
# carries a UI resource for. `toolbarobj.dll`, `sicoresdk.dll` and `Softimage.XSIOM.dll` have no RT_MENU /
# RT_DIALOG resource in the dump — they contribute string tables and docs-attested symbols only.
UI_MODULES = [
    'uiut.dll', 'genppg.dll', 'toolbarobj.dll', 'sicoresdk.dll', 'Softimage.XSIOM.dll',
    'XSI.exe', 'mcp.dll', 'vm.dll', 'viewinteraction.dll', 'viewcontrol.dll',
    'sceneexplorer.dll', 'toolbar.dll', 'siuitasks.dll', 'siviewtasks.dll', 'prefs.dll',
    'manipulators.dll', 'transformmanager.dll',
]

# Menu resources lifted into src/data/si/menus.json by tools/build_si_ui.py. Keep in step with the `pick`
# dict there. Value = (menus.json key, verdict before this pass).
MENU_KEYS = {
    ('XSI.exe', '128'): ('mainMenu', 'PRESENT'),
    ('XSI.exe', '344'): ('fileMenu', 'PRESENT'),
    ('XSI.exe', '245'): ('toolbarMenu', 'PRESENT'),
    ('XSI.exe', '146'): ('roomMenu', 'MISSING'),
    ('XSI.exe', '244'): ('toolButtonMenu', 'MISSING'),
    ('XSI.exe', '308'): ('layoutItemMenu', 'MISSING'),
    ('XSI.exe', '345'): ('toolbarReadOnlyMenu', 'MISSING'),
    ('viewcontrol.dll', '101'): ('viewCamera', 'PRESENT'),
    ('viewcontrol.dll', '102'): ('viewVisibility', 'PRESENT'),
    ('viewcontrol.dll', '127'): ('viewStereo', 'PRESENT'),
    ('viewcontrol.dll', '128'): ('viewCube', 'PRESENT'),
    ('viewcontrol.dll', '106'): ('viewContext', 'PRESENT'),
    ('viewcontrol.dll', '124'): ('viewObjectContext', 'PRESENT'),
    ('vm.dll', '202'): ('vmLayout', 'PRESENT'),
    ('vm.dll', '272'): ('vmResize', 'PRESENT'),
    ('vm.dll', '290'): ('vmMuteSolo', 'MISSING'),
    ('mcp.dll', '201'): ('mcpSelect', 'PRESENT'),
    ('mcp.dll', '202'): ('mcpAnimation', 'PRESENT'),
    ('mcp.dll', '203'): ('mcpEdit', 'PRESENT'),
    ('mcp.dll', '204'): ('mcpTransform', 'PRESENT'),
    ('mcp.dll', '219'): ('mcpPlayback', 'PRESENT'),
    ('mcp.dll', '293'): ('mcpConstraints', 'PRESENT'),
    ('mcp.dll', '294'): ('mcpGet', 'PRESENT'),
    ('mcp.dll', '350'): ('mcpLayer', 'PRESENT'),
    ('mcp.dll', '353'): ('mcpExplore', 'PRESENT'),
    ('mcp.dll', '356'): ('mcpSelFilter', 'PRESENT'),
    ('mcp.dll', '470'): ('mcpNavigate', 'PRESENT'),
    ('mcp.dll', '482'): ('mcpReference', 'PRESENT'),
    ('mcp.dll', '483'): ('mcpSymmetry', 'PRESENT'),
    ('mcp.dll', '10002'): ('mcpSnap', 'PRESENT'),
    ('mcp.dll', '10004'): ('mcpSnapPoints', 'PRESENT'),
    ('mcp.dll', '10005'): ('mcpSnapSegments', 'PRESENT'),
    ('mcp.dll', '10006'): ('mcpSnapFacets', 'PRESENT'),
    ('mcp.dll', '325'): ('mcpControlTips', 'PARTIAL'),
    ('mcp.dll', '487'): ('mcpRefModeTips', 'PARTIAL'),
    ('viewinteraction.dll', '530'): ('toolTranslate', 'PRESENT'),
    ('viewinteraction.dll', '531'): ('toolRotate', 'PRESENT'),
    ('viewinteraction.dll', '532'): ('toolScale', 'PRESENT'),
    ('viewinteraction.dll', '533'): ('toolPivot', 'PRESENT'),
    ('viewinteraction.dll', '535'): ('toolTweak', 'PRESENT'),
    ('viewinteraction.dll', '536'): ('toolTweakNormals', 'PRESENT'),
    ('viewinteraction.dll', '345'): ('toolKnife', 'PRESENT'),
    ('viewinteraction.dll', '534'): ('toolCurve', 'PRESENT'),
    ('viewinteraction.dll', '349'): ('toolCurveDirectManip', 'MISSING'),
    ('sceneexplorer.dll', '300'): ('explorerView', 'PRESENT'),
    ('sceneexplorer.dll', '302'): ('explorerScope', 'PRESENT'),
    ('sceneexplorer.dll', '303'): ('explorerFilters', 'PRESENT'),
    ('sceneexplorer.dll', '304'): ('explorerContext', 'PRESENT'),
    ('sceneexplorer.dll', '305'): ('explorerTree', 'MISSING'),
    ('genppg.dll', '223'): ('ppgMain', 'PRESENT'),
    ('genppg.dll', '205'): ('ppgAnim', 'PRESENT'),
    ('genppg.dll', '264'): ('keyingPanel', 'PRESENT'),
    ('genppg.dll', '235'): ('ppgTree', 'MISSING'),
    ('genppg.dll', '247'): ('ppgTabButton', 'MISSING'),
    ('uiut.dll', '211'): ('uiModules', 'PRESENT'),
    ('uiut.dll', '213'): ('uiEdit', 'PRESENT'),
    ('uiut.dll', '181'): ('uiView', 'PRESENT'),
    ('uiut.dll', '163'): ('uiSplitter', 'MISSING'),
    ('uiut.dll', '246'): ('uiPaneContext', 'MISSING'),
}

# Menu resources deliberately left ABSENT, with the reason: either the resource itself says the items were
# removed from the product, or it drives an internal debug/test surface with no AfterImage counterpart.
MENU_ABSENT = {
    ('uiut.dll', '215'): 'Resource is titled "REMOVED MENU ITEMS" — Softimage keeps the template, the product does not show it',
    ('mcp.dll', '354'): 'Resource is titled "REMOVED MENU ITEMS" — same as uiut 215',
    ('XSI.exe', '226'): 'DebugMenu — SDK / memory-tracking / crash-test developer items',
    ('vm.dll', '273'): 'Interface Test Menu — vm view-client self-test (SI3DVIEWTILE_* tiles)',
}

# Dialog templates this pass lifts into src/data/si/ui_dialogs.json, rendered from their attested PE
# template (title / DLU rect / font / control text) by src/ui/siDialog.ts. Value = AfterImage surface.
DIALOG_WIRE = {
    ('XSI.exe', '102'): 'File > Keyboard Mapping — key-map editor',
    ('XSI.exe', '104'): 'PPG Save Preset As…',
    ('XSI.exe', '159'): 'Toolbar button type picker',
    ('XSI.exe', '166'): 'View > Layouts > Rename Layout',
    ('XSI.exe', '167'): 'Toolbar spacer size',
    ('XSI.exe', '281'): 'File > Project Manager',
    ('XSI.exe', '315'): 'Save-modified-layouts prompt',
    ('XSI.exe', '316'): 'Toolbar button bitmap picker',
    ('XSI.exe', '319'): 'Toolbar Add Script Command',
    ('XSI.exe', '326'): 'Preset-list search folder',
    ('XSI.exe', '327'): 'Popup menu button item order',
    ('XSI.exe', '331'): 'Relational-view frame tree',
    ('XSI.exe', '364'): 'Restore factory default layout confirm',
    ('XSI.exe', '383'): 'Event handler grid',
    ('XSI.exe', '403'): 'View > Layouts > Manage…',
    ('XSI.exe', '404'): 'Toolbar button size / label / bitmap',
    ('XSI.exe', '405'): 'Interaction mode (key map + mouse)',
    ('XSI.exe', '406'): 'Toolbar button script command',
    ('XSI.exe', '410'): 'Preference migration version picker',
    ('uiut.dll', '129'): 'PPG parameter connect list',
    ('uiut.dll', '160'): 'Pane context > Set Relationships…',
    ('uiut.dll', '162'): 'Stack window > Bitmap Editor',
    ('genppg.dll', '232'): 'PPG logic-script error',
    ('viewinteraction.dll', '337'): 'Add Polygon winding conflict',
    ('vm.dll', '386'): 'Viewport capture',
    ('mcp.dll', '220'): 'Playback current-frame entry',
    ('siuitasks.dll', '201'): 'Assemble NurbsMesh (SCM)',
    ('siuitasks.dll', '202'): 'User keyword editor',
}

# Dialogs already wired before this pass.
DIALOG_PRESENT = {
    ('XSI.exe', '394'): ('PRESENT', 'src/data/si/pe_property_page_394.json (residual C3)', 'Wired by an earlier pass'),
    ('XSI.exe', 'IDD_PROPPAGE_LARGE'): ('PRESENT', 'Same stub pins as dialog 394', 'Wired by an earlier pass'),
    ('XSI.exe', '225'): ('PRESENT', 'src/ui/toolbars.ts customizeToolbars()', 'Wired by an earlier pass'),
    ('sceneexplorer.dll', '725'): ('PRESENT', 'ppg_chrome.json explorer.renameDialog', 'Wired by an earlier pass'),
    ('mcp.dll', '9200'): ('PRESENT', 'src/data/si/mcp_hitmaps.json SRT cells', 'Geometry pin'),
    ('mcp.dll', '9400'): ('PRESENT', 'src/data/si/mcp_hitmaps.json snap cells', 'Geometry pin'),
    ('uiut.dll', '138'): ('PRESENT', 'ppg_chrome.json hosts', 'PPG host frame pin'),
    ('uiut.dll', '139'): ('PRESENT', 'ppg_chrome.json hosts', 'PPG host frame pin'),
    ('uiut.dll', '141'): ('PRESENT', 'ppg_chrome.json hosts', 'PPG host frame pin'),
    ('uiut.dll', '142'): ('PRESENT', 'ppg_chrome.json hosts', 'PPG host frame pin'),
    ('uiut.dll', '144'): ('PRESENT', 'ppg_chrome.json hosts', 'PPG host frame pin'),
    ('uiut.dll', '145'): ('PRESENT', 'ppg_chrome.json hosts', 'PPG host frame pin'),
    ('uiut.dll', '147'): ('PRESENT', 'ppg_chrome.json canonicalHostDialog', 'PPG host frame pin'),
    ('uiut.dll', '157'): ('PRESENT', 'ppg_chrome.json softDialog.peAttest', 'Soft-dialog font / OK-Cancel DLU sample'),
}

# Titled dialogs deliberately left ABSENT, with the reason. These are host-platform, licensing or
# Autodesk-product surfaces, or they need a subsystem AfterImage does not have.
DIALOG_ABSENT = {
    ('XSI.exe', '287'): 'Autodesk product splash — product identity, not an AfterImage surface',
    ('XSI.exe', '317'): 'Autodesk product splash variant — same as 287',
    ('XSI.exe', '345'): 'Crash detected — Softimage crash-recovery host dialog',
    ('XSI.exe', '346'): 'Package Add-On — AfterImage has no add-on / workgroup subsystem',
    ('XSI.exe', '347'): 'Install Add-On — no add-on subsystem',
    ('XSI.exe', '375'): 'UnInstall Add-On — no add-on subsystem',
    ('XSI.exe', '376'): 'Add-On Information — no add-on subsystem',
    ('XSI.exe', '360'): 'License connection lost — licensing host dialog',
    ('XSI.exe', '361'): 'Duplicate Object Found — scene-merge path not reached by AfterImage import',
    ('XSI.exe', '364b'): 'unused',
    ('XSI.exe', '365'): 'New Features Tour — Autodesk product tour',
    ('XSI.exe', '366'): 'New Features Tour — Autodesk product tour',
    ('XSI.exe', '372'): 'New Features Tour — Autodesk product tour',
    ('XSI.exe', '374'): 'New Features Tour — Autodesk product tour',
    ('XSI.exe', '397'): 'Softimage Foundation licence tier prompt',
    ('XSI.exe', '398'): 'Softimage Foundation licence tier prompt',
    ('XSI.exe', '429'): 'OpenGL Context Lost — host GL driver dialog',
    ('vm.dll', '274'): 'Interface Test Dialog — vm self-test surface',
    ('vm.dll', '275'): 'Interface Test Dialog — vm self-test surface',
}

# String tables the dumps expose, and the AfterImage surface that reads them.
STRING_WIRE = {
    'XSIUIUT': 'src/ui/si.ts siString — relational view / PPG / layout strings',
    'XSIGENPPG': 'src/ui/si.ts siString — PPG display / logic-script strings',
    'XSITOOLBAROBJ': 'src/ui/si.ts siString — toolbar object command hints',
    'XSIMCP': 'src/ui/mcp.ts tooltips + src/ui/si.ts siHint',
    'XSIVIEWINTERACTION': 'src/ui/si.ts siHintBy — tool status-bar hints',
    'XSIVIEWCONTROL': 'src/ui/viewManager.ts + viewExtras.ts',
    'XSIVIEWCORE': 'src/ui/viewManager.ts display modes',
    'XSISCENEEXPLORER': 'src/ui/explorer.ts',
    'XSIPREFS': 'src/ui/si.ts siPrefTitle + src/ui/prefs.ts',
    'XSIFILTERMGR': 'src/ui/si.ts siFilterNames',
    'XSIMSGCAT': 'src/ui/si.ts siMessage / siMessageLike',
    'XSIPLUGINUI': 'src/ui/shell.ts pluginManager',
    'XSITASKS': 'src/commands/* command labels',
    'XSIPROPS': 'src/core/opdefs.ts + PPG labels',
    'XSISCRIPTS': 'src/ui/shell.ts scriptLog / Script Editor',
    'XSISELECTIONMGR': 'src/ui/mcp.ts selection filters',
    'XSIPICKMGR': 'src/ui/viewManager.ts pick session',
    'XSITOOLMANAGER': 'src/ui/viewManager.ts tool activation',
    'XSICAMERA': 'src/ui/viewManager.ts camera menus',
    'XSIMANIPULATORS': 'src/ui/manipulatorHitbox.ts',
    'XSISCNMGR': 'src/core/scene.ts + File menu messages',
    'XSINODEOP': 'src/core/opdefs.ts operator names',
    'XSIDEFORMOP': 'src/core/opdefs.ts deformer names',
    'XSITOPOLOGYOP': 'src/core/topology.ts operator names',
    'XSIMODELTASKS': 'src/commands/model.ts labels',
    'XSIOPTASKS': 'src/commands/model2.ts labels',
    'XSIXSI': 'src/ui/menubar.ts + shell strings',
    'XSIVM': 'src/ui/viewManager.ts view-manager strings',
}

# Docs-attested UI symbols with no RT_MENU / RT_DIALOG / string row in the committed dump. Named here so
# the audit carries them rather than silently dropping them. (kind, module, item, verdict, wired, surface, note)
SYMBOL_ROWS = [
    ('symbol', 'uiut.dll', 'CDSBasePropertyFrame::OnDrawItem', 'PARTIAL', '',
     'src/ui/ppgChrome.ts + ppgTitleColorref.ts', 'Owner-draw COLORREF tokens wired; no paint pins in the dump'),
    ('symbol', 'uiut.dll', 'C3DTrackMenu::DrawItem', 'ABSENT', '', '—',
     'Owner-draw track-menu paint has no attested metric — DOM menus stay CSS-painted'),
    ('symbol', 'uiut.dll', 'InspNavCtrl / LoadSaveCtrl / DsAnimationCtrl2', 'PRESENT', '',
     'src/ui/ppg.ts nav + tools bitmaps', 'From ppg_chrome.json hosts'),
    ('symbol', 'uiut.dll', 'RT_BITMAP inventory (43 × 24bpp, 71×25 / 66×25)', 'PRESENT', '',
     'src/data/si/ppg_chrome.json bitmaps', 'Strips under public/si'),
    ('symbol', 'genppg.dll', 'PPGEvent OnInit / OnChanged', 'PRESENT', '',
     'src/ui/ppgLogic.ts', 'WR-06 attested event names'),
    ('symbol', 'genppg.dll', 'dscontrol unrecognised-class gate (XSIGENPPG 3522/3523)', 'MISSING', 'yes',
     'src/ui/siDialog.ts unknownClasses', 'Unknown control classes are skipped and reported, as genppg does'),
    ('symbol', 'toolbarobj.dll', 'Module MCP top strips', 'PRESENT', '',
     'src/data/si/*_module_mcp_tops.json → src/commands/*Module.ts', 'Per-module MENU tops'),
    ('symbol', 'toolbarobj.dll', 'DSCommandMap / .xsitb toolbar objects', 'PRESENT', '',
     'src/data/si/shelf.json + panelswitcher.json + src/ui/toolbars.ts', 'data/si/toolbars + data/si/commandmaps'),
    ('symbol', 'sicoresdk.dll', 'CXSICommandCore::GetEnabled / PutEnabled', 'PRESENT', '',
     'src/ui/cmdEnable.ts + src/ui/mcpEnableMatrix.ts', 'docs/ghidra/getenabled-callpath.md'),
    ('symbol', 'sicoresdk.dll', 'CanBeModified gate', 'PRESENT', '',
     'src/ui/cmdEnable.ts', 'null → canRun fallback (getenabled-deepen.md)'),
    ('symbol', 'Softimage.XSIOM.dll', 'OnBeginRenderPass / OnEndRenderPass', 'PRESENT', '',
     'src/core/sceneRender.ts + src/core/commands.ts', 'WR-01 attested event names'),
    ('symbol', 'Softimage.XSIOM.dll', 'OM view / layout automation entry points', 'ABSENT', '', '—',
     'No OM type library in the committed dump — only the two render-pass event names are attested'),
]


def label_of(items):
    """Top-level names of a menu resource — popup resources wrap their items under one named node."""
    tops = [i.get('label') for i in items if not i.get('separator')]
    return ' / '.join(t for t in tops if t) or '(unnamed)'


def leaf_count(items):
    n = 0
    for it in items:
        if it.get('separator'):
            continue
        n += leaf_count(it['items']) if it.get('items') else 1
    return n


def menu_rows(pe):
    rows = []
    for mod in UI_MODULES:
        for mid, items in sorted(pe.get(mod, {}).get('menus', {}).items(), key=lambda x: int(x[0])):
            key = (mod, mid)
            name = f'MENU {mid} — {label_of(items)}'
            if key in MENU_ABSENT:
                rows.append(('menu', mod, name, 'ABSENT', '', '—', MENU_ABSENT[key]))
                continue
            k, verdict = MENU_KEYS[key]
            rows.append(('menu', mod, name, verdict, 'yes' if verdict != 'PRESENT' else '',
                         f'menus.json `{k}`', f'{leaf_count(items)} leaves'))
    return rows


def dialog_rows(pe):
    rows = []
    for mod in UI_MODULES:
        dlgs = pe.get(mod, {}).get('dialogs', {})
        for did in sorted(dlgs, key=lambda d: (0, int(d)) if d.isdigit() else (1, 0)):
            d = dlgs[did]
            key = (mod, did)
            title = d.get('title') or ''
            name = f'DIALOG {did} — {title}' if title else f'DIALOG {did} — (untitled)'
            if key in DIALOG_WIRE:
                rows.append(('dialog', mod, name, 'MISSING', 'yes',
                             f'ui_dialogs.json `{mod}#{did}`', DIALOG_WIRE[key]))
            elif key in DIALOG_PRESENT:
                verdict, surface, note = DIALOG_PRESENT[key]
                rows.append(('dialog', mod, name, verdict, '', surface, note))
            elif key in DIALOG_ABSENT:
                rows.append(('dialog', mod, name, 'ABSENT', '', '—', DIALOG_ABSENT[key]))
            elif not title or title in ('Dialog', 'set from code using dictionnary'):
                rows.append(('dialog', mod, name, 'ABSENT', '', '—',
                             'No attestable Softimage dialog name in the committed dump'))
            else:
                rows.append(('dialog', mod, name, 'MISSING', '', '—',
                             f'Attested title "{title}"; no AfterImage surface'))
    return rows


def string_rows(dic):
    rows = []
    for table, entries in sorted(dic.items()):
        wire = STRING_WIRE.get(table)
        name = f'{table} ({len(entries)} strings)'
        rows.append(('strings', table, name, 'PRESENT' if wire else 'MISSING', '',
                     wire or '—', 'Lifted by tools/build_si_ui.py → strings.json'))
    return rows


def view_rows():
    """Softimage .xsivw view definitions vs the views AfterImage registers in src/main.ts."""
    src = open(os.path.join(ROOT, 'src', 'main.ts'), encoding='utf-8').read()
    rows = []
    for f in sorted(glob.glob(os.path.join(SI, 'views', '*.xsivw'))):
        vd = ET.parse(f).getroot().find('viewdef')
        name = vd.get('name')
        present = f"'{name}'" in src
        rows.append(('view', os.path.basename(f), name, 'PRESENT' if present else 'MISSING', '',
                     'src/main.ts layout.registerView' if present else '—', f'clsid {vd.get("clsid")}'))
    return rows


def layout_rows():
    rows = []
    have = json.load(open(os.path.join(OUT, 'layouts.json'), encoding='utf-8'))
    for f in sorted(glob.glob(os.path.join(SI, 'layouts', '*.xsily'))):
        rv = ET.parse(f).getroot().find('relationalview')
        name = rv.get('name')
        rows.append(('layout', os.path.basename(f), name, 'PRESENT' if name in have else 'MISSING', '',
                     'src/data/si/layouts.json' if name in have else '—',
                     f'{rv.get("width")}×{rv.get("height")}'))
    return rows


def toolbar_rows():
    wired = {
        'Main_Shelf.xsitb': 'src/data/si/shelf.json',
        'PanelSwitcher.xsitb': 'src/data/si/panelswitcher.json',
        'Palettes.xsitb': 'src/ui/toolbars.ts palettesView',
        'ScriptCommands.xsitb': 'src/ui/toolbars.ts Scripts toolbar',
    }
    rows = []
    for f in sorted(os.listdir(os.path.join(SI, 'toolbars'))):
        if not f.endswith('.xsitb'):
            continue
        tabs = [t.get('label') for t in ET.parse(os.path.join(SI, 'toolbars', f)).getroot().iter('tab')]
        rows.append(('toolbar', f, f, 'PRESENT' if f in wired else 'MISSING', '',
                     wired.get(f, '—'), f'{len(tabs)} tab(s)'))
    return rows


def dialog_templates(pe):
    """Attested PE templates for the wired dialog set — title, DLU rect, font, controls."""
    out = {}
    for (mod, did), surface in sorted(DIALOG_WIRE.items()):
        d = pe[mod]['dialogs'][did]
        out[f'{mod}#{did}'] = {
            'dll': mod,
            'id': did,
            'title': d.get('title') or '',
            'rectDlu': d.get('rect'),
            'font': d.get('font'),
            'surface': surface,
            'controls': [
                {'cls': c.get('cls'), 'text': c.get('text') or '', 'id': c.get('id'),
                 'dlu': [c.get('x'), c.get('y'), c.get('w'), c.get('h')], 'style': c.get('style')}
                for c in d.get('controls', [])
            ],
        }
    return out


def tally(rows):
    counts = {'PRESENT': 0, 'PARTIAL': 0, 'MISSING': 0, 'ABSENT': 0}
    for r in rows:
        counts[r[3]] += 1
    counts['total'] = len(rows)
    counts['wiredThisPass'] = sum(1 for r in rows if r[4] == 'yes')
    return counts


SECTIONS = [
    ('menu', 'Menu resources (RT_MENU)'),
    ('dialog', 'Dialog templates (RT_DIALOG)'),
    ('strings', 'String tables (Dictionary/en/*.dict)'),
    ('view', 'View definitions (*.xsivw)'),
    ('layout', 'Relational-view layouts (*.xsily)'),
    ('toolbar', 'Toolbar objects (*.xsitb)'),
    ('symbol', 'Docs-attested symbols'),
]


def markdown(rows, counts):
    L = [
        '# UI-surface audit — Softimage dumps vs AfterImage `src/`',
        '',
        '**Date:** 2026-10-27  ',
        '**Source:** committed dump artifacts only (softimage-pc not connected)  ',
        '**Generated by:** `tools/build_ui_surface_audit.py`  ',
        '**Runtime audit:** `src/ui/uiSurfaceAudit.ts` → `__uiAudit().uiSurface`',
        '',
        '## Verdicts',
        '',
        '| Verdict | Meaning |',
        '|---------|---------|',
        '| PRESENT | AfterImage already carried the item with dump-attested names / metrics. |',
        '| PARTIAL | Surface existed, behaviour or fields incomplete against the dump. |',
        '| MISSING | Dump exposes it, AfterImage had nothing. |',
        '| ABSENT | Deliberately not wired — no attestable Softimage name, or no AfterImage counterpart. |',
        '',
        'Verdicts describe `src/` **before** this pass. The **Wired** column marks the items the pass closed.',
        '',
        '## Counts',
        '',
        '| | n |',
        '|---|---|',
        f'| UI items inventoried | **{counts["total"]}** |',
        f'| PRESENT | {counts["PRESENT"]} |',
        f'| PARTIAL | {counts["PARTIAL"]} |',
        f'| MISSING | {counts["MISSING"]} |',
        f'| ABSENT (documented, not invented) | {counts["ABSENT"]} |',
        f'| Closed by this pass | **{counts["wiredThisPass"]}** |',
        '',
    ]
    for kind, heading in SECTIONS:
        sub = [r for r in rows if r[0] == kind]
        if not sub:
            continue
        L += [f'## {heading}', '',
              '| Module / file | Item | Verdict | Wired | AfterImage surface | Note |',
              '|---------------|------|---------|-------|--------------------|------|']
        for _, mod, name, verdict, wired, surface, note in sub:
            v = f'**{verdict}**' if verdict in ('MISSING', 'PARTIAL') else verdict
            L.append(f'| `{mod}` | {name} | {v} | {"✔" if wired else ""} | {surface} | {note} |')
        L.append('')
    L += [
        '## Clean-room rules applied',
        '',
        '- Dumps are specification only: resource ids, item names, DLU rects, fonts, string ids.',
        '- No decompiled or disassembled code is transcribed into `src/` or `native/`.',
        '- An item with no attestable Softimage name stays **ABSENT** here rather than invented.',
        '',
        'Related: [uiut-ppg-gdi.md](./uiut-ppg-gdi.md) · [ui-lock-binary-pins.md](./ui-lock-binary-pins.md) · [residual-index.md](./residual-index.md)',
        '',
    ]
    return '\n'.join(L)


def main():
    pe = json.load(open(os.path.join(SI, 'pe_resources.json'), encoding='utf-8'))
    dic = json.load(open(os.path.join(SI, 'dict.json'), encoding='utf-8'))

    rows = menu_rows(pe) + dialog_rows(pe) + string_rows(dic) + view_rows() + layout_rows() + toolbar_rows()
    rows += [tuple(r) for r in SYMBOL_ROWS]
    counts = tally(rows)

    audit = {
        'softimage': 'Softimage 2015 SP2',
        'source': 'data/si/pe_resources.json + data/si/dict.json + data/si/{views,layouts,toolbars}',
        'generated_by': 'tools/build_ui_surface_audit.py',
        'modules': UI_MODULES,
        'counts': counts,
        'items': [{'kind': k, 'module': m, 'item': n, 'verdict': v, 'wired': w == 'yes', 'surface': s, 'note': t}
                  for k, m, n, v, w, s, t in rows],
    }
    dialogs = dialog_templates(pe)

    os.makedirs(DUMP, exist_ok=True)
    json.dump(audit, open(os.path.join(DUMP, 'si_ui_surface_audit.json'), 'w', encoding='utf-8'),
              indent=1, ensure_ascii=False)
    json.dump(audit, open(os.path.join(OUT, 'ui_surface_audit.json'), 'w', encoding='utf-8'),
              indent=0, ensure_ascii=False)
    json.dump({'softimage': 'Softimage 2015 SP2', 'source': 'data/si/pe_resources.json RT_DIALOG',
               'generated_by': 'tools/build_ui_surface_audit.py', 'dialogs': dialogs},
              open(os.path.join(OUT, 'ui_dialogs.json'), 'w', encoding='utf-8'), indent=0, ensure_ascii=False)
    open(os.path.join(DOCS, 'ui-surface-audit.md'), 'w', encoding='utf-8').write(markdown(rows, counts))

    print('ui surface audit', counts)
    print('dialog templates', len(dialogs))


if __name__ == '__main__':
    main()
